import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

export interface ChatSessionSummary {
    sessionId: string;
    title: string;
    date: Date;
    workspaceName: string;
    workspaceId: string; // The hash
    path: string;
    turnCount: number;
}

export class StorageLocator {
    private userDir: string;

    constructor() {
        this.userDir = this.resolveUserDir();
    }

    private resolveUserDir(): string {
        switch (process.platform) {
            case 'win32':
                return path.join(process.env.APPDATA!, 'Code', 'User');
            case 'darwin':
                return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User');
            case 'linux':
                return path.join(os.homedir(), '.config', 'Code', 'User');
            default:
                throw new Error(`Unsupported platform: ${process.platform}`);
        }
    }

    public async getAllSessions(filterWorkspaceId?: string): Promise<ChatSessionSummary[]> {
        const workspaceStorageDir = path.join(this.userDir, 'workspaceStorage');
        
        if (!fs.existsSync(workspaceStorageDir)) {
            console.warn(`Workspace storage directory not found at: ${workspaceStorageDir}`);
            return [];
        }

        let workspaceFolders: { name: string }[] = [];

        if (filterWorkspaceId) {
            // Check if the specific workspace folder exists
            const specificPath = path.join(workspaceStorageDir, filterWorkspaceId);
            if (fs.existsSync(specificPath)) {
                workspaceFolders = [{ name: filterWorkspaceId }];
            }
        } else {
            const entries = await fs.promises.readdir(workspaceStorageDir, { withFileTypes: true });
            workspaceFolders = entries.filter(e => e.isDirectory());
        }

        const sessions: ChatSessionSummary[] = [];

        const promises = workspaceFolders.map(folder => this.processWorkspaceFolder(workspaceStorageDir, folder.name));
        const results = await Promise.all(promises);
        
        // Flatten results
        for (const res of results) {
            sessions.push(...res);
        }
        
        // Sort by date descending
        return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    private async processWorkspaceFolder(storageDir: string, workspaceId: string): Promise<ChatSessionSummary[]> {
        const folderPath = path.join(storageDir, workspaceId);
        const chatSessionsDir = path.join(folderPath, 'chatSessions');
        const sessions: ChatSessionSummary[] = [];

        if (!fs.existsSync(chatSessionsDir)) {
            return [];
        }

        // Get workspace info
        let workspaceName = 'Unknown Workspace';
        try {
            const workspaceJsonPath = path.join(folderPath, 'workspace.json');
            if (fs.existsSync(workspaceJsonPath)) {
                const content = JSON.parse(await fs.promises.readFile(workspaceJsonPath, 'utf8'));
                if (content.folder) {
                    workspaceName = path.basename(content.folder);
                } else if (content.workspace) {
                        workspaceName = path.basename(content.workspace); // Multi-root
                }
            }
        } catch (e) {
            // Ignore errors reading workspace.json
        }

        // Get sessions
        try {
            const sessionFiles = await fs.promises.readdir(chatSessionsDir);
            for (const file of sessionFiles) {
                if (file.endsWith('.json') || file.endsWith('.jsonl')) {
                    const filePath = path.join(chatSessionsDir, file);
                    try {
                        let content: any;
                        let date: Date;
                        let turnCount = 0;
                        let sessionId = '';
                        let title = 'Empty Session';

                        if (file.endsWith('.jsonl')) {
                            // For JSONL, we read the first line to get the session metadata (kind: 0)
                            const fd = await fs.promises.open(filePath, 'r');
                            try {
                                const stream = fd.createReadStream({ encoding: 'utf8', start: 0, end: 4096 }); // Read first 4KB
                                let chunk = '';
                                for await (const part of stream) {
                                    chunk += part;
                                    if (chunk.includes('\n')) {
                                        break;
                                    }
                                }
                                
                                const firstLine = chunk.split('\n')[0];
                                try {
                                    const jsonlData = JSON.parse(firstLine);
                                    if (jsonlData.kind === 0 && jsonlData.v) {
                                        content = jsonlData.v;
                                        sessionId = content.sessionId;
                                        date = new Date(content.creationDate || Date.now());
                                        turnCount = content.requests ? content.requests.length : 0;
                                        
                                        // Initial title from first request if available
                                        if (content.requests && content.requests.length > 0 && content.requests[0].message && content.requests[0].message.text) {
                                            title = content.requests[0].message.text.substring(0, 50).replace(/[\r\n]+/g, ' ');
                                        }
                                    } else {
                                        continue;
                                    }
                                } catch (e) {
                                    continue;
                                }
                            } finally {
                                await fd.close();
                            }
                        } else {
                            const contentStr = await fs.promises.readFile(filePath, 'utf8');
                            content = JSON.parse(contentStr);
                            sessionId = content.sessionId;
                            date = new Date(content.creationDate || content.lastMessageDate || Date.now());
                            const requests = content.requests || [];
                            turnCount = requests.length;
                            if (requests.length > 0 && requests[0].message && requests[0].message.text) {
                                title = requests[0].message.text.substring(0, 50).replace(/[\r\n]+/g, ' ');
                            }
                        }
                        
                        // Basic validation
                        if (!sessionId) {
                            continue;
                        }

                        sessions.push({
                            sessionId,
                            title,
                            date,
                            workspaceName,
                            workspaceId,
                            path: filePath,
                            turnCount
                        });

                    } catch (e) {
                        // Malformed JSON, skip
                    }
                }
            }
        } catch (e) {
            // Error reading chatSessions dir
        }

        return sessions;
    }
}
