import * as vscode from 'vscode';
import { StorageLocator } from './storageLocator';
import { ChatParser } from './chatParser';

export function activate(context: vscode.ExtensionContext) {
    const locator = new StorageLocator();

    context.subscriptions.push(vscode.commands.registerCommand('copilot-pkm-bridge.exportChat', async () => {
        // Show progress indicator while loading sessions
        const sessions = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Scanning Copilot chat sessions...",
            cancellable: false
        }, async () => {
            return await locator.getAllSessions();
        });

        if (sessions.length === 0) {
            vscode.window.showInformationMessage('No Copilot chat sessions found.');
            return;
        }

        // Sort by date descending
        sessions.sort((a, b) => b.date.getTime() - a.date.getTime());

        const items = sessions.map(s => ({
            label: s.title || 'Untitled Session',
            description: `${s.date.toLocaleDateString()} — ${s.turnCount} turns`,
            detail: s.workspaceName,
            session: s
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a Copilot chat session to export',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            try {
                const parsed = await ChatParser.parse(selected.session.path);
                const markdown = ChatParser.toMarkdown(parsed);

                const doc = await vscode.workspace.openTextDocument({
                    content: markdown,
                    language: 'markdown'
                });

                await vscode.window.showTextDocument(doc);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to export chat: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }));
}

export function deactivate() {}
