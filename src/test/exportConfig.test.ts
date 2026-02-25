import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { resolvePath } from '../extension';
import { ChatParser, ChatSession } from '../chatParser';

suite('Export Config Test Suite', () => {
    test('resolvePath resolves ${userHome}', () => {
        const input = '${userHome}/test';
        const expected = path.join(os.homedir(), 'test');
        assert.strictEqual(resolvePath(input), expected);
    });

    // We can't easily test ${workspaceFolder} without mocking vscode.workspace, 
    // but we can assume it works if userHome works as the logic is similar.

    test('ChatParser.toMarkdown generates frontmatter when enabled', () => {
        const session: ChatSession = {
            sessionId: '123',
            date: '2023-01-01',
            title: 'Test Session',
            messages: [{ role: 'user', content: 'Hi' }]
        };

        const md = ChatParser.toMarkdown(session, { includeMetadata: true, workspaceName: 'MyWS' });
        
        assert.ok(md.startsWith('---'), 'Should start with frontmatter');
        assert.ok(md.includes('date: 2023-01-01'), 'Should include date');
        assert.ok(md.includes('title: "Test Session"'), 'Should include title');
        assert.ok(md.includes('workspace: "MyWS"'), 'Should include workspace');
    });

    test('ChatParser.toMarkdown omits frontmatter when disabled', () => {
        const session: ChatSession = {
            sessionId: '123',
            date: '2023-01-01',
            title: 'Test Session',
            messages: [{ role: 'user', content: 'Hi' }]
        };

        const md = ChatParser.toMarkdown(session, { includeMetadata: false });
        
        assert.ok(!md.startsWith('---'), 'Should not start with frontmatter');
        assert.ok(md.startsWith('# Test Session'), 'Should start with header');
    });
});
