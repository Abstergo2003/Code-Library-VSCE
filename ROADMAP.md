# Code Library Roadmap

This roadmap describes the planned development direction for the Code Library VS Code extension.

## Completed

- Local global-storage library for scripts and bundles.
- Language-based tree organization with drag and drop.
- Script and bundle creation from selections and files.
- Function extraction for supported programming languages.
- QuickPick search and context-aware script insertion.
- Marker-based synchronization in files and directories.
- Tags, descriptions, and source metadata.
- Metadata-aware search and tooltips.
- JSON import, export, and timestamped backups.
- Expanded parser tests across supported language families.

## Near Term

### Improve synchronization safety

- Add a preview of changes before synchronization.
- Detect local edits made after a snippet was pasted.
- Report missing library items instead of silently skipping them.
- Support duplicate or malformed markers with clear diagnostics.
- Use correct paired comment syntax for HTML and CSS markers.

### Improve metadata workflows

- Replace sequential input boxes with a single metadata editor.
- Add metadata fields for author, framework, and usage examples.
- Add tag suggestions and tag filtering.
- Show metadata in QuickPick results.

### Strengthen persistence

- Validate and migrate `main.json` when the data format changes.
- Recover gracefully from corrupted metadata or missing content files.
- Write library files atomically to prevent partial updates.
- Add explicit import conflict strategies: merge, replace, or skip.

## Medium Term

### Better parser architecture

- Move parsing logic into a dedicated module.
- Add language-specific parser adapters instead of one large dispatcher.
- Use VS Code language services or syntax trees where available.
- Preserve comments and decorators as configurable extraction options.
- Add parser fixtures for real-world source files and edge cases.

### Library organization

- Add user-created collections independent of language.
- Support favorites, recently used items, and pinned items.
- Allow ordering scripts inside bundles.
- Add duplicate detection based on content hashes.
- Add an item preview panel before opening or inserting code.

### Import and portability

- Support ZIP export for large libraries.
- Add optional workspace-local libraries.
- Add configurable backup locations and automatic backups.
- Support importing common snippet formats.

## Long Term

### Search and productivity

- Add fuzzy search and keyboard-first navigation.
- Add full-text content search.
- Add reusable search filters and saved views.
- Track usage statistics locally to improve ranking.

### Collaboration and integrations

- Add optional Git-backed library synchronization.
- Support GitHub Gist and other snippet providers.
- Add team-shared libraries with explicit user opt-in.
- Provide configurable privacy controls for external integrations.

### Quality and maintainability

- Add integration tests for tree operations, persistence, import/export, and synchronization.
- Add performance tests for large libraries.
- Add telemetry only as an explicit opt-in feature.
- Improve accessibility, localization, and command discoverability.
- Publish a documented library file format for third-party tooling.

## Guiding Principles

1. Keep the default library local and private.
2. Prefer safe previews and explicit confirmation for destructive operations.
3. Preserve existing library data during migrations and imports.
4. Keep parsing resilient when a language-specific parser is unavailable.
5. Add automation only when users can control and disable it.
