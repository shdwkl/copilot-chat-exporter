import * as fs from 'fs';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatSession {
    sessionId: string;
    date: string;
    messages: ChatMessage[];
}

export class ChatParser {
    public static async parse(filePath: string): Promise<ChatSession> {
        const content = await fs.promises.readFile(filePath, 'utf8');
        return this.parseContent(content);
    }

    public static parseContent(content: string): ChatSession {
        const json = JSON.parse(content);

        const requests = json.requests || [];
        const messages: ChatMessage[] = [];

        for (const req of requests) {
            // User message
            if (req.message && req.message.text) {
                messages.push({
                    role: 'user',
                    content: req.message.text
                });
            }

            // Assistant response
            if (req.response && Array.isArray(req.response)) {
                let responseText = '';
                for (const item of req.response) {
                    if (item.value) {
                        responseText += item.value;
                    }
                }
                
                if (responseText) {
                    messages.push({
                        role: 'assistant',
                        content: responseText
                    });
                }
            }
        }

        return {
            sessionId: json.sessionId,
            date: new Date(json.creationDate).toISOString().split('T')[0],
            messages
        };
    }

    public static toMarkdown(session: ChatSession): string {
        let md = `# Copilot Chat — ${session.date}

`;
        
        for (const msg of session.messages) {
            const roleHeader = msg.role === 'user' ? '**User**' : '**Copilot**';
            md += `${roleHeader}
${msg.content}

`;
        }

        return md;
    }
}
