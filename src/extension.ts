import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
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

    // Command 3: Convert File
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
