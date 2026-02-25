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
        try {
            const json = JSON.parse(content);
            return this.parseJson(json);
        } catch (e) {
            return this.parseJsonl(content);
        }
    }

    private static parseJson(json: any): ChatSession {
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

    private static parseJsonl(content: string): ChatSession {
        const lines = content.split('\n');
        const requestsDict: Record<number, { prompt: string, responses: any[] }> = {};
        let sessionId = '';
        let creationDate = '';

        for (const line of lines) {
            if (!line.trim()) {
                continue;
            }
            
            try {
                const data = JSON.parse(line);
                const kind = data.kind;
                const k = data.k || [];
                const v = data.v;

                // Base state parsing (kind 0)
                if (kind === 0 && v) {
                    if (v.sessionId) {
                        sessionId = v.sessionId;
                    }
                    if (v.creationDate) {
                        creationDate = new Date(v.creationDate).toISOString().split('T')[0];
                    }
                    
                    if (v.requests) {
                        v.requests.forEach((req: any, idx: number) => {
                            const prompt = req.message?.text || '';
                            requestsDict[idx] = { prompt, responses: req.response || [] };
                        });
                    }
                }
                // Appended requests parsing
                else if (kind === 2 && k.length === 1 && k[0] === 'requests') {
                    // v is an array of new requests being appended
                    if (Array.isArray(v)) {
                        v.forEach((req: any) => {
                            const idx = Object.keys(requestsDict).length;
                            const prompt = req.message?.text || '';
                            requestsDict[idx] = { prompt, responses: req.response || [] };
                        });
                    }
                }
                // Streamed AI responses parsing
                else if (kind === 2 && k.length >= 3 && k[0] === 'requests' && k[2] === 'response') {
                    const idx = k[1];
                    if (requestsDict[idx] && Array.isArray(v)) {
                        requestsDict[idx].responses.push(...v);
                    }
                }
            } catch (e) {
                continue;
            }
        }

        // Convert dict to messages array
        const messages: ChatMessage[] = [];
        const sortedKeys = Object.keys(requestsDict).map(Number).sort((a, b) => a - b);

        for (const idx of sortedKeys) {
            const req = requestsDict[idx];
            messages.push({ role: 'user', content: req.prompt });

            let responseText = '';
            for (const resp of req.responses) {
                if (!resp || typeof resp !== 'object') {
                    continue;
                }
                
                if (resp.value && typeof resp.value === 'string') {
                    responseText += resp.value;
                } else if (resp.kind === 'toolInvocationSerialized') {
                    // Include basic tool info if helpful, or skip
                    // For now, let's include terminal commands if we can find them, matching user snippet
                    // The user snippet accessed resp.toolSpecificData.terminalCommandOutput etc.
                    // We'll stick to 'value' for now to keep it simple and safe unless we see data.
                }
            }
            
            if (responseText) {
                messages.push({ role: 'assistant', content: responseText });
            }
        }

        return {
            sessionId,
            date: creationDate || new Date().toISOString().split('T')[0],
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
