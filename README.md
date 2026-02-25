# Copilot PKM Bridge

**Export your GitHub Copilot chat sessions to clean, usable Markdown.**

Recover your AI conversations from VS Code's internal storage and turn them into permanent knowledge notes for Obsidian, Logseq, Notion, or your personal docs.

## 🚀 Features

*   **🔍 Auto-Discovery**: Automatically finds Copilot chat sessions hidden in VS Code's `workspaceStorage` across Windows, macOS, and Linux.
*   **📂 Universal Support**: Robustly handles both legacy (`.json`) and modern (`.jsonl`) Copilot storage formats.
*   **📝 Clean Markdown**: Converts complex internal JSON data into human-readable Markdown.
    *   Preserves code blocks and language syntax highlighting.
    *   Clearly distinguishes between **User** and **Copilot** messages.
    *   Handles streamed and chunked responses accurately.
*   **⚡ Instant Access**: Fast "Quick Pick" interface lists all your sessions, sorted by recent activity.
*   **🔒 Local & Private**: Runs entirely locally. No API keys required, no telemetry, and no data leaves your machine.

## 💡 Use Cases

*   **Personal Knowledge Management (PKM)**: "I solved this with Copilot last week, but I lost the chat." -> Now you can save it to your Obsidian vault.
*   **Documentation**: Quickly turn an architectural discussion or code explanation into a `DOCS.md` file for your repo.
*   **Team Sharing**: Share a complex debugging session or solution with a colleague without sending multiple screenshots.
*   **Audit Trail**: Keep a version-controlled history of AI decisions and code generation.

## 📖 How to Use

1.  Open the **Command Palette** (`Ctrl+Shift+P` on Windows/Linux, `Cmd+Shift+P` on macOS).
2.  Type and select: **`Copilot PKM: Export Chat to Markdown`**.
3.  A list of your recent Copilot sessions will appear (showing date and turn count).
4.  Select the session you want to export.
5.  The chat will open instantly in a new **Markdown editor tab**.
6.  Review the content and **Save** (`Ctrl+S` / `Cmd+S`) it to your preferred location.

## ⚙️ Extension Settings

*   `copilot-pkm-bridge.defaultExportFolder`: (Coming Soon) Define a default folder (e.g., `${workspaceFolder}/docs`) for quicker saving.
*   `copilot-pkm-bridge.includeMetadata`: (Coming Soon) Toggle inclusion of YAML frontmatter (dates, model info) in the exported file.

## 📦 Requirements

*   **Visual Studio Code** (v1.90.0 or newer recommended).
*   **GitHub Copilot Chat** extension installed and used (so that chat history exists locally).

## 🔧 Known Issues

*   If you have moved or renamed workspaces, some sessions might be listed under "Unknown Workspace" until you open that workspace again.
*   Very large sessions (>50k tokens) might take a second or two to parse.

---

**Enjoy building your AI knowledge base!**
