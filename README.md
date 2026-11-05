# Abstergo's Code Library

The ultimate companion for developers who want to build and maintain their own personal repository of reusable code snippets. Stop searching through old projects for that one perfect function—store it once, and use it everywhere.

## 🚀 Key Features

### 📂 Organized Side Bar Integration
Access your entire library directly from the VS Code Activity Bar. Your snippets are automatically organized into an expandable tree view:
* **Grouped by Language**: Automatically sorted with native icons for over 50+ languages, frameworks, and tools.
* **Bundles & Scripts**: View individual scripts or logical bundles (like a collection of utility functions).
* **Drag and Drop**: Reorganize your library by dragging scripts into bundles or moving them between sections.
* **Instant Preview**: Clicking an item in the tree opens it directly in a new editor tab with full syntax highlighting.

### 🔍 Advanced Search
Quickly find what you need with the integrated search feature in the Sidebar.
* **Filter Everything**: Search by script name, language, tags, description, or source.
* **Inline Toggle**: Toggle between full view and filtered results instantly.

### 🏷️ Tags & Metadata
Use **Edit Metadata** from a library item's context menu to add comma-separated tags, a description, and a source or reference. Metadata is shown in the tree and tooltip, and is included in library search.

### ✍️ Intelligent Saving
* **Save as Script**: Highlight any code selection, right-click, and name it on the fly.
* **Save as Bundle**: Right-click a file in the explorer to automatically extract and bundle its functions.
* **Smart Parsing**: 
    * **Python**: Full support for decorators, indentation-based scoping, and async functions.
    * **Jupyter Notebooks**: Automatically extracts code cells and markdown notes from `.ipynb` files.
    * **Web**: Native support for Vue, React (JSX/TSX), HTML, and CSS.
    * **Systems & DevOps**: Specialized parsing for Makefiles, Dockerfiles, Terraform (HCL), and Shell scripts.
    * **Databases**: Extraction logic for SQL Procedures and Functions (MySQL, PostgreSQL).

### 📋 Search & Paste
Press `Ctrl+Shift+P` and type **"Code Library: Paste Script"** to instantly find and insert snippets.
* **Context Aware**: The list automatically puts scripts matching your current file's language at the top.
* **Fast Search**: Quickly filter through your library using standard VS Code QuickPick.

### 🔄 Powerful Synchronization
Keep your projects up to date with your library.
* **Sync Markers**: Pasted scripts include subtle comment markers (`@library-id`) that link them back to your library.
* **File & Directory Sync**: Update all snippets in your current file or your entire project directory with one command.
* **Selective Sync**: Add `@library-sync: disable` inside a snippet's markers to protect a specific instance from being overwritten.

### 💾 Import, Export & Backup
* **Export Library**: Save scripts, bundles, metadata, and content to a portable JSON file.
* **Import Library**: Merge an exported library into the current library without overwriting existing items.
* **Backup Library**: Create a timestamped full-library snapshot for safekeeping.

## 🌐 Supported Ecosystems

Code Library features specialized icons and parsing for:
* **Languages**: JavaScript, TypeScript, Python, Rust, Go, Java, C#, C++, C, PHP, Ruby, Kotlin, Swift, Dart, Haskell, and more.
* **Web & Frameworks**: React, Vue, Angular, Django, Flask, Laravel, Rails, Spring, Bootstrap.
* **Cloud & DevOps**: AWS, Azure, Google Cloud, Docker, Terraform, Ansible, Heroku, Firebase.
* **Databases**: MySQL, PostgreSQL, MongoDB, Redis, Oracle, Cassandra.

## ⌨️ Available Commands

Search for **"Code Library"** in the Command Palette (`Ctrl+Shift+P`):
* `Refresh`: Reload the library tree.
* `Search in Library`: Filter the tree view by name, language, or tags.
* `Clear Search`: Restore the full tree view.
* `Paste Script from Library`: Search and insert a snippet at the cursor.
* `Synchronize Library Scripts in File`: Update snippets in the active tab.
* `Synchronize Library Scripts in Directory`: Update snippets across the whole folder.
* `Save as Script`: Store the current selection.
* `Save as Bundle`: Bundle functions from a file.
* `Edit Metadata`: Add or update tags, description, and source for a script or bundle.
* `Export Library`: Save the complete library as a portable JSON file.
* `Import Library`: Merge a library JSON export into the current library.
* `Backup Library`: Save a timestamped library backup.

## 📝 Usage Note
The extension stores your data locally in VS Code's global storage, ensuring your library is accessible across all your workspaces while remaining private and secure.
