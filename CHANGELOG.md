# Change Log

All notable changes to the "copilot-chat-pkm-exporter" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.2] - 2026-02-25

### Added
- **Wingman Export**: New command "Copilot PKM: Export All to .wingman (Current Workspace)" to bulk export all chat sessions to a structured `.wingman` directory.
  - Creates `.wingman/history` with all chat sessions as Markdown.
  - Generates `.wingman/.project.json` with project identity and metadata (Git commit, Workspace ID, timestamps).
  - Adds `.wingman/WHAT_IS_THIS.md` documentation file.
- **Improved Parsing**: Enhanced JSONL parser to support `customTitle` fields, ensuring user-renamed chats are exported with the correct title.

### Fixed
- Fixed an issue where "Empty Session" was displayed for some chats by improving the file read buffer to handle large metadata lines.
- Fixed `date` initialization logic to prevent potential undefined errors during export.

## [0.0.1] - Initial Release

- Initial release