import * as assert from 'assert';
import { ChatParser } from '../chatParser';

suite('ChatParser Test Suite', () => {
    test('Parses simple chat correctly', () => {
        const json = JSON.stringify({
            sessionId: 'test-session',
            creationDate: Date.now(),
            requests: [
                {
                    message: { text: 'Hello' },
                    response: [{ value: 'Hi there!' }]
                }
            ]
        });

        const session = ChatParser.parseContent(json);
        assert.strictEqual(session.sessionId, 'test-session');
        assert.strictEqual(session.messages.length, 2);
        assert.strictEqual(session.messages[0].role, 'user');
        assert.strictEqual(session.messages[0].content, 'Hello');
        assert.strictEqual(session.messages[1].role, 'assistant');
        assert.strictEqual(session.messages[1].content, 'Hi there!');
    });

    test('Parses complex response with code blocks correctly', () => {
        const json = JSON.stringify({
            sessionId: 'complex-session',
            creationDate: Date.now(),
            requests: [
                {
                    message: { text: 'Code please' },
                    response: [
                        { value: 'Here is code:\n' },
                        { kind: 'codeblockUri', uri: { path: '/foo.ts' } },
                        { value: '```ts\nconst x = 1;\n```\n' },
                        { value: 'Done.' }
                    ]
                }
            ]
        });

        const session = ChatParser.parseContent(json);
        // Concatenated content
        const expected = 'Here is code:\n```ts\nconst x = 1;\n```\nDone.';
        assert.strictEqual(session.messages[1].content, expected);
    });
});
