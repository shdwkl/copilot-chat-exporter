**Optimal Revised PRD (v1.0 — Development-Ready)**

**Product Name**
Copilot PKM Bridge

**Version**
1.0 (MVP) — Feb 2026

**Overview**
A lightweight, local-first VS Code extension that automatically discovers Copilot chat sessions from VS Code’s storage, parses them accurately, and converts them into clean, customizable Markdown files ready for Obsidian, Logseq, Notion, or git commits.

**Core Value Proposition**
One command → beautiful, searchable Markdown of your AI reasoning, code decisions, and agent outputs — no manual export, no copy-paste, no lost context.

**Target Users**

- Solo developers building personal knowledge bases
- Teams that want AI decisions version-controlled in the repo
- Anyone tired of “I solved this with Copilot last week but can’t find it”

**User Problem (Unchanged)**
Copilot chats live in hidden, volatile storage and are lost or painful to recover.

**MVP Scope (Strict — This is what we ship first)**

**Commands (Command Palette)**

1. `Copilot PKM: Export Chat to Markdown` (main command)

**Behavior**

- Automatically detects the active workspace (or global/empty-window sessions).
- Shows a Quick Pick of available sessions (sorted by last modified, shows title + date + turn count).
- Parses the chosen session.
- Generates clean Markdown.
- Opens it in a new unsaved editor tab (user can Save As… or use later features).

**Output Format (MVP)**

```markdown
# Copilot Chat — 2026-02-25 — Django Debug Session

**User**
How do I fix the migration conflict in Django 5.1?

**Copilot**
The issue is...

```python
# code block preserved with language
```

**Agent / Terminal**
(when present)

```bash
python manage.py ...
```

**References / Files edited** (if in JSON)

```

- User messages clearly marked.
- Assistant responses with preserved Markdown, code blocks, lists.
- Tool calls / agent terminal commands in fenced blocks with type label.
- No internal VS Code metadata.

**Settings (contributes.configuration)**
```json
{
  "copilot-pkm-bridge.defaultExportFolder": "${workspaceFolder}/.docs/ai-logs",   // supports ${workspaceFolder}, ${userHome}
  "copilot-pkm-bridge.includeMetadata": true
}
```

**Technical Requirements & Architecture**

**Storage Discovery** (cross-platform)

```ts
// Pseudo-code — we will implement a robust StorageLocator
const base = process.platform === 'win32'
  ? path.join(process.env.APPDATA!, 'Code', 'User')
  : process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library/Application Support/Code/User')
    : path.join(os.homedir(), '.config/Code/User');

// Then workspaceStorage/<hash>/chatSessions/*.json (and *.jsonl)
```

Map `<hash>` → workspace path using the `workspace.json` file inside each hash folder (standard pattern used by existing history extensions).

**Parser**

- Primary: `.json` files → `{ requests: [{ message: { text, role? }, response: [{ value, ... }], ... }] }`
- Fallback: `.jsonl` lines → accumulate streamed chunks (for agent sessions).
- Handle both exported sessions and raw internal files.
- Extract: user prompt, final assistant text, code blocks (preserve language), tool/terminal outputs.

**Formatter**
Simple string template + marked + basic regex for sections. No heavy dependencies.

**Non-Functional**

- < 500 ms for typical session (even with 50 turns).
- Graceful degradation if Copilot storage format changes (log warning, fallback message).
- No network, no telemetry.
- Works on Stable + Insiders, Windows/macOS/Linux.
- Handles chats with 10k+ tokens.

**Acceptance Criteria for MVP**

- Install → activate → run command → see Quick Pick of real sessions.
- Select one → new tab with properly formatted Markdown (user/AI separation, code blocks intact, agent commands visible).
- Works on a fresh workspace with no prior settings.
- No crashes on missing storage or malformed files.
- All code typed, tested on all 3 OSes in dev host.

**Out of Scope for MVP (moved to roadmap)**

- YAML frontmatter (Phase 2)
- Direct save to configured folder (Phase 2)
- Webview pruning UI
- Auto-archiving
- Code-only mode

**Full Roadmap (post-MVP, in order of impact)**

1. YAML Frontmatter + template engine (`${date}`, `${workspaceName}`, `${tags}`) + Direct Save.
2. Code-Only Extraction command.
3. Selective Pruning Webview (checkboxes per turn).
4. Workspace-Aware Auto-Export (on window close or manual trigger).
5. Git integration / Obsidian vault sync helpers.

**Success Metrics**

- 100+ GitHub stars in first 3 months (realistic for useful dev tool).
- Users report “finally I can keep my Copilot brain”.

**Recommended Development Start Plan (Optimal Order)**

**Phase 0 (Today — 1-2 hours)**

- Create standard VS Code extension skeleton (`yo code`).
- Add command, settings skeleton, activation on `onCommand`.
- Implement `StorageLocator` class with unit tests (mock paths).

**Phase 1 (Core — 2-3 days)**

- List all sessions across all workspaces + global.
- Quick Pick UI.
- Read file → parse JSON → basic Markdown dump (just concatenate user + assistant text).
- Open in new tab.
→ This validates the hardest part (storage + parsing).

**Phase 2 (Polish MVP — 2 days)**

- Rich formatting (distinguish roles, code fences, agent blocks).
- Add basic settings.
- Error messages / telemetry-off logging.

**Phase 3 (First Delight Feature)**
Implement YAML frontmatter + configurable default folder + auto-save (the “Direct Vault Sync”). This is higher value than just opening a tab.

**Why this order?**
Storage discovery + parsing is the risky/unknown part. Once that works reliably, everything else (frontmatter, saving, UI) is straightforward TypeScript + VS Code API.

The original PRD is already 80% there — this revised version removes ambiguity, adds concrete specs, and gives you a clear “day 1 → shippable MVP” path.

Ready to start? I recommend we begin with the **StorageLocator + session listing** (Phase 0/1). I can provide the exact TypeScript code skeleton for the locator and parser right now if you want.

Or tell me your preference: storage/parser first, or jump straight to YAML + direct save on top of your existing code?
