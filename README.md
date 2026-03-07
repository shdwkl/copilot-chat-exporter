# Copilot Chat to Markdown

**Export your GitHub Copilot chat sessions to clean, usable Markdown.**

Recover your AI conversations from VS Code's internal storage or exported files and turn them into permanent knowledge notes for Obsidian, Logseq, Notion, or your personal docs.

<p align="center">
  <img src="src/assets/demo.gif" width="700" alt="Demo">
</p>

## 🚀 Features

*   **🔍 Auto-Discovery**: Automatically finds Copilot chat sessions hidden in VS Code's `workspaceStorage` across Windows, macOS, and Linux.
*   **📂 Universal Support**: Robustly handles both legacy (`.json`) and modern (`.jsonl`) Copilot storage formats.
*   **🔁 Manual Conversion**: Convert any exported Copilot JSON/JSONL file to Markdown.
* **📦 Bulk Export**: Export all chat sessions from your current workspace to a structured `.wingman` directory with a single command.
* **📝 Clean Markdown**: Converts complex internal JSON data into human-readable Markdown.
  * Preserves code blocks and language syntax highlighting.
  * Clearly distinguishes between **User** and **Copilot** messages.
  * **Terminal Output**: Captures and formats executed terminal commands and their output.
  * Handles streamed and chunked responses accurately.
* **⚡ Instant Access**: Fast "Quick Pick" interface lists all your sessions, sorted by recent activity and grouped by workspace.
* **🔒 Local & Private**: Runs entirely locally. No API keys required, no telemetry, and no data leaves your machine.

## 💡 Use Cases

* **Personal Knowledge Management (PKM)**: "I solved this with Copilot last week, but I lost the chat." -> Now you can save it to your Obsidian vault.
* **Documentation**: Quickly turn an architectural discussion or code explanation into a `DOCS.md` file for your repo.
* **Team Sharing**: Share a complex debugging session or solution with a colleague without sending multiple screenshots.
* **Audit Trail**: Keep a version-controlled history of AI decisions and code generation.
* **Wingman**: Create a comprehensive `.wingman` directory in your project root, containing all your AI chat history and project metadata. This is perfect for archiving, analyzing, or feeding into other AI tools.

## 📖 How to Use

### Exporting from Workspace History

1. Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Choose one of the following commands:
    * **`Export Copilot Chat: Current Workspace`**: Shows chats only from the currently open project.
    * **`Export Copilot Chat: All Workspaces`**: Scans all your local VS Code history and groups chats by workspace.
    * **`Export Copilot Chat: Backup to .wingman (Bulk Export)`**: Automatically exports *all* chat sessions from the current workspace into a `.wingman` folder at the root of your project. This includes a `history/` subdirectory with Markdown files and a `.project.json` file with metadata.
3. Select the session you want to export (for single export commands).
4.  The chat will open instantly in a new **Markdown editor tab**.
5.  Review the content and **Save** (`Ctrl+S` / `Cmd+S`) it to your preferred location.

### Converting an Existing File
1.  Run **`Export Copilot Chat: Convert JSON/JSONL File...`**.
2.  Select a `.json` or `.jsonl` file from your computer.
3.  The extension will parse it and open the Markdown version in a new tab.

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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
