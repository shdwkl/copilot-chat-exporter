import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as cp from 'child_process';
import { StorageLocator, ChatSessionSummary } from './storageLocator';
import { ChatParser, ChatSession, MarkdownOptions } from './chatParser';

export function activate(context: vscode.ExtensionContext) {
    const locator = new StorageLocator();

    // Command 1: Export from All Workspaces
    context.subscriptions.push(vscode.commands.registerCommand('copilot-pkm-bridge.exportChat', async () => {
        await pickAndExportSession(locator, undefined, true);
    }));

    // Command 2: Export from Current Workspace
    context.subscriptions.push(vscode.commands.registerCommand('copilot-pkm-bridge.exportChatCurrent', async () => {
        let currentWorkspaceId: string | undefined;
        
        // Try to derive workspace ID from context.storageUri
        // Path format: .../User/workspaceStorage/<hash>/<extension-id>
        if (context.storageUri) {
            try {
                currentWorkspaceId = path.basename(path.dirname(context.storageUri.fsPath));
            } catch (e) {
                // Ignore path errors
            }
        }

        if (!currentWorkspaceId) {
            vscode.window.showWarningMessage('Could not detect current workspace storage ID. Showing all sessions instead.');
        }

        await pickAndExportSession(locator, currentWorkspaceId, false);
    }));

    // Command 3: Export All to .wingman
    context.subscriptions.push(vscode.commands.registerCommand('copilot-pkm-bridge.exportAllToWingman', async () => {
        let currentWorkspaceId: string | undefined;
        
        if (context.storageUri) {
            try {
                currentWorkspaceId = path.basename(path.dirname(context.storageUri.fsPath));
            } catch (e) { }
        }

        if (!currentWorkspaceId) {
            vscode.window.showErrorMessage('Cannot determine current workspace ID. Open a workspace folder first.');
            return;
        }

        const wsFolder = vscode.workspace.workspaceFolders?.[0];
        if (!wsFolder) {
             vscode.window.showErrorMessage('No workspace folder open. Please open a folder to use this feature.');
             return;
        }

        await exportAllToWingman(locator, currentWorkspaceId, wsFolder.uri.fsPath);
    }));

    // Command 4: Convert File
    context.subscriptions.push(vscode.commands.registerCommand('copilot-pkm-bridge.convertFile', async () => {
        const fileUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Convert Copilot Chat',
            filters: {
                'Copilot Exports': ['json', 'jsonl'],
                'All Files': ['*']
            }
        });

        if (!fileUris || fileUris.length === 0) {
            return;
        }

        const filePath = fileUris[0].fsPath;
        try {
            const parsed = await ChatParser.parse(filePath);
            await exportMarkdown(parsed, { workspaceName: 'Imported File' });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to convert file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
}

async function exportAllToWingman(locator: StorageLocator, workspaceId: string, workspacePath: string) {
    const sessions = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Scanning chat sessions...",
    }, async () => {
        return await locator.getAllSessions(workspaceId);
    });

    if (sessions.length === 0) {
        vscode.window.showInformationMessage('No chat sessions found to export.');
        return;
    }

    // Setup .wingman structure
    const wingmanDir = path.join(workspacePath, '.wingman');
    const historyDir = path.join(wingmanDir, 'history');
    
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
    }

    // Write metadata files
    const projectName = vscode.workspace.name || path.basename(workspacePath);
    const gitId = await getGitId(workspacePath);
    const now = new Date().toISOString();
    
    const projectJson = {
        workspace_id: workspaceId,
        workspace_id_at: now,
        project_name: projectName,
        cloud_sync: true,
        git_id: gitId,
        git_id_at: now,
        user_id: "unknown" 
    };

    fs.writeFileSync(path.join(wingmanDir, '.project.json'), JSON.stringify(projectJson, null, 2), 'utf8');
    
    const whatIsThis = `# Wingman Artifacts Directory
    
This directory is automatically created and maintained by the Copilot PKM Bridge extension to preserve your AI chat history.
    
## What's Here?
    
- \`.wingman/history\`: Contains markdown files of your AI coding sessions.
    - Each file represents a separate AI chat session.
- \`.wingman/.project.json\`: Contains the persistent project identity for the current workspace.
    
## Version Control
    
We recommend keeping this directory under version control to maintain a history of your AI interactions.
`;
    fs.writeFileSync(path.join(wingmanDir, 'WHAT_IS_THIS.md'), whatIsThis, 'utf8');

    // Export sessions
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Exporting ${sessions.length} sessions to .wingman...`,
        cancellable: true
    }, async (progress, token) => {
        let count = 0;
        for (const session of sessions) {
            if (token.isCancellationRequested) {
                break;
            }
            
            try {
                const parsed = await ChatParser.parse(session.path);
                const markdown = ChatParser.toMarkdown(parsed, { workspaceName: projectName, includeMetadata: true });
                
                const safeTitle = (parsed.title || 'chat').replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 100);
                const dateStr = parsed.date;
                const fileName = `${dateStr}-${safeTitle}.md`;
                
                await fs.promises.writeFile(path.join(historyDir, fileName), markdown, 'utf8');
                count++;
                progress.report({ increment: (1 / sessions.length) * 100, message: `${count}/${sessions.length}` });
            } catch (e) {
                console.error(`Failed to export session ${session.sessionId}:`, e);
            }
        }
    });

    vscode.window.showInformationMessage(`Successfully exported ${sessions.length} sessions to .wingman/history`);
}

function getGitId(workspacePath: string): Promise<string | undefined> {
    return new Promise((resolve) => {
        cp.exec('git rev-parse HEAD', { cwd: workspacePath }, (error, stdout) => {
            if (error) {
                resolve(undefined);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

async function pickAndExportSession(locator: StorageLocator, filterWorkspaceId?: string, groupByWorkspace: boolean = false) {
    // Show progress indicator while loading sessions
    const sessions = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: filterWorkspaceId ? "Scanning current workspace chat sessions..." : "Scanning all Copilot chat sessions...",
        cancellable: false
    }, async () => {
        return await locator.getAllSessions(filterWorkspaceId);
    });

    if (sessions.length === 0) {
        const msg = filterWorkspaceId 
            ? 'No Copilot chat sessions found for this workspace.' 
            : 'No Copilot chat sessions found.';
        vscode.window.showInformationMessage(msg);
        return;
    }

    let items: (vscode.QuickPickItem & { session?: ChatSessionSummary })[] = [];

    if (groupByWorkspace) {
        // Sort by workspace name first, then date
        sessions.sort((a, b) => {
            const wsCompare = a.workspaceName.localeCompare(b.workspaceName);
            if (wsCompare !== 0) {
                return wsCompare;
            }
            return b.date.getTime() - a.date.getTime();
        });

        let lastWorkspace = '';
        for (const session of sessions) {
            if (session.workspaceName !== lastWorkspace) {
                items.push({
                    label: session.workspaceName,
                    kind: vscode.QuickPickItemKind.Separator
                });
                lastWorkspace = session.workspaceName;
            }
            items.push(createQuickPickItem(session));
        }
    } else {
        // Simple date sort for single workspace or flat list
        sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
        items = sessions.map(createQuickPickItem);
    }

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: filterWorkspaceId ? 'Select a chat session to export' : 'Select a chat session (grouped by workspace)',
        matchOnDescription: true,
        matchOnDetail: true
    });

    if (selected && selected.session) {
        try {
            const parsed = await ChatParser.parse(selected.session.path);
            await exportMarkdown(parsed, { workspaceName: selected.session.workspaceName });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export chat: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

function createQuickPickItem(session: ChatSessionSummary): vscode.QuickPickItem & { session: ChatSessionSummary } {
    return {
        label: session.title || 'Untitled Session',
        description: `${session.date.toLocaleDateString()} — ${session.turnCount} turns`,
        detail: session.workspaceName,
        session: session
    };
}

async function exportMarkdown(session: ChatSession, options?: MarkdownOptions) {
    const config = vscode.workspace.getConfiguration('copilot-pkm-bridge');
    const includeMetadata = config.get<boolean>('includeMetadata', true);
    const defaultFolder = config.get<string>('defaultExportFolder', '');

    const markdown = ChatParser.toMarkdown(session, { ...options, includeMetadata });

    if (defaultFolder && defaultFolder.trim() !== '') {
        try {
            const resolvedPath = resolvePath(defaultFolder);
            
            // Create folder if not exists
            if (!fs.existsSync(resolvedPath)) {
                fs.mkdirSync(resolvedPath, { recursive: true });
            }

            // Sanitize filename
            const safeTitle = (session.title || 'chat').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const dateStr = session.date; // YYYY-MM-DD
            const fileName = `copilot-${dateStr}-${safeTitle}.md`;
            const fullPath = path.join(resolvedPath, fileName);

            // Write file
            await fs.promises.writeFile(fullPath, markdown, 'utf8');

            // Open document
            const doc = await vscode.workspace.openTextDocument(fullPath);
            await vscode.window.showTextDocument(doc);
            
            vscode.window.showInformationMessage(`Exported to ${fileName}`);
            return;

        } catch (e) {
            vscode.window.showErrorMessage(`Failed to save to default folder: ${e}. Opening unsaved tab instead.`);
            // Fallthrough to unsaved tab
        }
    }

    // Fallback: Open untitled document
    const doc = await vscode.workspace.openTextDocument({
        content: markdown,
        language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
}

export function resolvePath(p: string): string {
    if (p.includes('${userHome}')) {
        p = p.replace('${userHome}', os.homedir());
    }
    
    if (p.includes('${workspaceFolder}')) {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (ws) {
            p = p.replace('${workspaceFolder}', ws.uri.fsPath);
        } else {
            // Fallback if no workspace is open
            p = p.replace('${workspaceFolder}', os.homedir()); 
        }
    }
    
    return path.normalize(p);
}

export function deactivate() {}
