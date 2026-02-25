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

    public async getAllSessions(): Promise<ChatSessionSummary[]> {
        const workspaceStorageDir = path.join(this.userDir, 'workspaceStorage');
        
        if (!fs.existsSync(workspaceStorageDir)) {
            console.warn(`Workspace storage directory not found at: ${workspaceStorageDir}`);
            return [];
        }

        const entries = await fs.promises.readdir(workspaceStorageDir, { withFileTypes: true });
        const workspaceFolders = entries.filter(e => e.isDirectory());

        const sessions: ChatSessionSummary[] = [];

        // Limit concurrency? Maybe not needed for local FS, but good practice.
        // We'll process in chunks or just Promise.all all of them.
        // There might be many workspaces.
        const promises = workspaceFolders.map(async (folder) => {
            const workspaceId = folder.name;
            const folderPath = path.join(workspaceStorageDir, workspaceId);
            const chatSessionsDir = path.join(folderPath, 'chatSessions');

            if (!fs.existsSync(chatSessionsDir)) {
                return;
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
                    if (file.endsWith('.json')) {
                        const filePath = path.join(chatSessionsDir, file);
                        try {
                            // Read only the start of the file or just stat it for date?
                            // We need title (first message?) and turn count.
                            // Reading full file might be slow if huge.
                            // But for MVP let's read it. If it's slow we optimize.
                            const contentStr = await fs.promises.readFile(filePath, 'utf8');
                            const content = JSON.parse(contentStr);
                            
                            // Basic validation
                            if (!content.sessionId) {
                                continue;
                            }

                            const requests = content.requests || [];
                            const turnCount = requests.length;
                            const date = new Date(content.creationDate || content.lastMessageDate || Date.now());
                            
                            // Derive a title from the first user message
                            let title = 'Empty Session';
                            if (requests.length > 0 && requests[0].message && requests[0].message.text) {
                                title = requests[0].message.text.substring(0, 50).replace(/[\r\n]+/g, ' ');
                            }

                            sessions.push({
                                sessionId: content.sessionId,
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
        });

        await Promise.all(promises);
        
        // Sort by date descending
        return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
}
