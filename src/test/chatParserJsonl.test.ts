import * as assert from 'assert';
import { ChatParser } from '../chatParser';

suite('ChatParser JSONL Test Suite', () => {
    test('Parses simple JSONL chat correctly', () => {
        const jsonl = [
            JSON.stringify({ kind: 0, v: { sessionId: 'jsonl-session', creationDate: 1700000000000, requests: [] } }),
            JSON.stringify({ kind: 2, k: ['requests'], v: [{ message: { text: 'Hello JSONL' }, response: [] }] }),
            JSON.stringify({ kind: 2, k: ['requests', 0, 'response'], v: [{ value: 'Hi ' }] }),
            JSON.stringify({ kind: 2, k: ['requests', 0, 'response'], v: [{ value: 'there' }] })
        ].join('\n');

        const session = ChatParser.parseContent(jsonl);
        assert.strictEqual(session.sessionId, 'jsonl-session');
        assert.strictEqual(session.messages.length, 2);
        assert.strictEqual(session.messages[0].role, 'user');
        assert.strictEqual(session.messages[0].content, 'Hello JSONL');
        assert.strictEqual(session.messages[1].role, 'assistant');
        assert.strictEqual(session.messages[1].content, 'Hi there');
    });

    test('Parses JSONL with base state requests', () => {
        const jsonl = JSON.stringify({ 
            kind: 0, 
            v: { 
                sessionId: 'base-state-session', 
                creationDate: 1700000000000, 
                requests: [{ message: { text: 'Base Prompt' }, response: [{ value: 'Base Response' }] }] 
            } 
        });

        const session = ChatParser.parseContent(jsonl);
        assert.strictEqual(session.sessionId, 'base-state-session');
        assert.strictEqual(session.messages.length, 2);
        assert.strictEqual(session.messages[0].content, 'Base Prompt');
        assert.strictEqual(session.messages[1].content, 'Base Response');
    });
});
