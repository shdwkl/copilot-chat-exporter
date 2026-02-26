import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	                test('Extension should be present and activate', async () => {
	                        const ext = vscode.extensions.getExtension('imperium-dev.copilot-chat-to-markdown');
	                assert.ok(ext, 'Extension not found');        await ext.activate();
        assert.ok(ext.isActive, 'Extension failed to activate');
	});

    test('Command should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const copilotCommands = commands.filter(c => c.startsWith('copilot'));
        console.log('Available copilot commands:', copilotCommands);
        assert.ok(commands.includes('copilot-pkm-bridge.exportChat'), 'Command copilot-pkm-bridge.exportChat not found');
        assert.ok(commands.includes('copilot-pkm-bridge.exportChatCurrent'), 'Command copilot-pkm-bridge.exportChatCurrent not found');
    });
});
