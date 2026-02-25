import * as fs from 'fs';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatSession {
    sessionId: string;
    date: string;
    title?: string;
    messages: ChatMessage[];
}

export interface MarkdownOptions {
    includeMetadata?: boolean;
    workspaceName?: string;
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

    private static deriveTitle(messages: ChatMessage[]): string {
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
            return firstUserMsg.content.substring(0, 50).replace(/[\r\n]+/g, ' ').trim();
        }
        return 'Untitled Session';
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
            title: this.deriveTitle(messages),
            messages
        };
    }

    private static parseJsonl(content: string): ChatSession {
        const lines = content.split('\n');
        const requestsDict: Record<number, { prompt: string, responses: any[] }> = {};
        let sessionId = '';
        let creationDate = '';
        let customTitle = '';

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
                // Custom Title parsing
                else if (kind === 1 && k.length === 1 && k[0] === 'customTitle') {
                    if (typeof v === 'string') {
                        customTitle = v;
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
                    const toolData = resp.toolSpecificData || {};
                    if (toolData.kind === 'terminal') {
                        const cmd = toolData.commandLine?.original || '';
                        const out = toolData.terminalCommandOutput?.text || '';

                        responseText += `\n\n> **[Terminal]** Executed Command:\n> \`\`\`bash\n> ${cmd}\n> \`\`\`\n`;

                        if (out.trim()) {
                            const cleanOut = out.replace(/\r\n/g, '\n').trim();
                            responseText += `\n**Output:**\n\`\`\`bash\n${cleanOut}\n\`\`\`\n\n`;
                        }
                    }
                }
            }
            
            if (responseText) {
                messages.push({ role: 'assistant', content: responseText });
            }
        }

        return {
            sessionId,
            date: creationDate || new Date().toISOString().split('T')[0],
            title: customTitle || this.deriveTitle(messages),
            messages
        };
    }

    public static toMarkdown(session: ChatSession, options?: MarkdownOptions): string {
        let md = '';

        if (options?.includeMetadata) {
            md += '---\n';
            md += `date: ${session.date}\n`;
            md += `title: "${(session.title || 'Copilot Chat').replace(/"/g, '\\"')}"\n`;
            md += `tags: [copilot, chat-export]\n`;
            if (options.workspaceName) {
                md += `workspace: "${options.workspaceName.replace(/"/g, '\\"')}"\n`;
            }
            md += '---\n\n';
        }

        md += `# ${session.title || `Copilot Chat — ${session.date}`}\n\n`;
        
        for (const msg of session.messages) {
            const roleHeader = msg.role === 'user' ? '**User**' : '**Copilot**';
            md += `${roleHeader}\n${msg.content}\n\n`;
        }

        return md;
    }
}
