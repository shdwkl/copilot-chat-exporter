import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as readline from 'readline';

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
                        let date: Date = new Date();
                        let turnCount = 0;
                        let sessionId = '';
                        let title = 'Empty Session';

                        if (file.endsWith('.jsonl')) {
                            const fileStream = fs.createReadStream(filePath);
                            const rl = readline.createInterface({
                                input: fileStream,
                                crlfDelay: Infinity
                            });

                            let linesRead = 0;
                            const maxLinesToRead = 50; // Read enough lines to likely find customTitle

                            try {
                                for await (const line of rl) {
                                    linesRead++;
                                    if (linesRead > maxLinesToRead && title !== 'Empty Session') {
                                        break;
                                    }
                                    
                                    if (!line.trim()) {continue;}

                                    try {
                                        const jsonlData = JSON.parse(line);
                                        const kind = jsonlData.kind;
                                        const k = jsonlData.k || [];
                                        const v = jsonlData.v;

                                        // 1. Session Metadata (kind: 0)
                                        if (kind === 0 && v) {
                                            if (v.sessionId) {sessionId = v.sessionId;}
                                            if (v.creationDate) {date = new Date(v.creationDate);}
                                            
                                            // Check for initial requests in metadata
                                            if (v.requests && Array.isArray(v.requests)) {
                                                turnCount += v.requests.length;
                                                if (v.requests.length > 0) {
                                                    const firstMsg = v.requests[0].message?.text;
                                                    if (firstMsg && title === 'Empty Session') {
                                                        title = firstMsg.substring(0, 50).replace(/[\r\n]+/g, ' ');
                                                    }
                                                }
                                            }
                                        }
                                        
                                        // 2. Custom Title (kind: 1, k: ["customTitle"])
                                        else if (kind === 1 && k.length === 1 && k[0] === 'customTitle' && typeof v === 'string') {
                                            title = v;
                                        }

                                        // 3. Appended Requests (kind: 2, k: ["requests"])
                                        else if (kind === 2 && k.length === 1 && k[0] === 'requests' && Array.isArray(v)) {
                                            turnCount += v.length;
                                            if (v.length > 0) {
                                                const firstMsg = v[0].message?.text;
                                                if (firstMsg && title === 'Empty Session') {
                                                    title = firstMsg.substring(0, 50).replace(/[\r\n]+/g, ' ');
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        continue;
                                    }
                                }
                            } finally {
                                rl.close();
                                fileStream.destroy();
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
