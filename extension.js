const vscode = require('vscode');
const path = require('path');
const { LibraryTreeProvider } = require('./LibraryTreeProvider');

// @ts-ignore
String.prototype.getFileExtension = function() {
    if (!this.includes('.')) {
        const parts = this.split('/');
        const lastPart = parts[parts.length - 1];
        return lastPart.toLowerCase();
    }
    return this.split('.').pop().toLowerCase();
};

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	try {
		await vscode.workspace.fs.stat(context.globalStorageUri);
		const itemsUri = vscode.Uri.joinPath(context.globalStorageUri, "items");
		const itemsMainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
		await vscode.workspace.fs.stat(itemsUri);
		await vscode.workspace.fs.stat(itemsMainUri);
	} catch {
		vscode.workspace.fs.createDirectory(context.globalStorageUri);
		const itemsUri = vscode.Uri.joinPath(context.globalStorageUri, "items");
		vscode.workspace.fs.createDirectory(itemsUri);
		const itemsMainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
		const data = new TextEncoder().encode("[]");
		vscode.workspace.fs.writeFile(itemsMainUri, data);
	}

    const libraryTreeProvider = new LibraryTreeProvider(context);
    vscode.window.createTreeView('abstergos-codelibrary-view', {
        treeDataProvider: libraryTreeProvider,
        dragAndDropController: libraryTreeProvider,
        showCollapseAll: true
    });

    // Custom FileSystemProvider to show nice tab names
    const fsProvider = new class {
        constructor() {
            this._onDidChangeFile = new vscode.EventEmitter();
            this.onDidChangeFile = this._onDidChangeFile.event;
        }
        watch() { return new vscode.Disposable(() => { }); }
        async stat(uri) {
            const id = uri.query;
            const scriptUri = vscode.Uri.joinPath(context.globalStorageUri, 'items', `${id}.txt`);
            return await vscode.workspace.fs.stat(scriptUri);
        }
        async readDirectory() { return []; }
        createDirectory() { }
        async readFile(uri) {
            const id = uri.query;
            const scriptUri = vscode.Uri.joinPath(context.globalStorageUri, 'items', `${id}.txt`);
            return await vscode.workspace.fs.readFile(scriptUri);
        }
        async writeFile(uri, content) {
            const id = uri.query;
            const scriptUri = vscode.Uri.joinPath(context.globalStorageUri, 'items', `${id}.txt`);
            await vscode.workspace.fs.writeFile(scriptUri, content);
            this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
        }
        delete() { }
        rename() { }
    };
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider('codelibrary', fsProvider, { isCaseSensitive: true }));

    const refreshCommand = vscode.commands.registerCommand('abstergos-codelibrary.refresh', () => {
        libraryTreeProvider.refresh();
    });

    const searchCommand = vscode.commands.registerCommand('abstergos-codelibrary.search', async () => {
        const query = await vscode.window.showInputBox({
            prompt: 'Search in library (name, language, tags)',
            placeHolder: 'Enter search term...'
        });
        if (query !== undefined) {
            libraryTreeProvider.refresh(query);
            vscode.commands.executeCommand('setContext', 'abstergos-codelibrary.isSearching', query !== '');
        }
    });

    const clearSearchCommand = vscode.commands.registerCommand('abstergos-codelibrary.clearSearch', () => {
        libraryTreeProvider.refresh('');
        vscode.commands.executeCommand('setContext', 'abstergos-codelibrary.isSearching', false);
    });

    const openItemCommand = vscode.commands.registerCommand('abstergos-codelibrary.openItem', async (script) => {
        const uri = vscode.Uri.parse(`codelibrary:/CL-${script.name}?${script.id}`);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
        vscode.languages.setTextDocumentLanguage(doc, script.lang);
    });

    const deleteItemCommand = vscode.commands.registerCommand('abstergos-codelibrary.deleteItem', async (node) => {
        const mainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
        const bytes = await vscode.workspace.fs.readFile(mainUri);
        let data = JSON.parse(Buffer.from(bytes).toString('utf8'));

        if (node.contextValue === 'script') {
            if (node.bundleId) {
                const bundle = data.find(b => b.id === node.bundleId);
                if (bundle) {
                    bundle.children = bundle.children.filter(s => s.id !== node.script.id);
                }
            } else {
                data = data.filter(s => s.id !== node.script.id);
            }
            const scriptUri = vscode.Uri.joinPath(context.globalStorageUri, 'items', `${node.script.id}.txt`);
            try { await vscode.workspace.fs.delete(scriptUri); } catch (e) {}
        } else if (node.contextValue === 'bundle') {
            const bundle = data.find(b => b.id === node.bundle.id);
            if (bundle) {
                for (const child of bundle.children) {
                    const scriptUri = vscode.Uri.joinPath(context.globalStorageUri, 'items', `${child.id}.txt`);
                    try { await vscode.workspace.fs.delete(scriptUri); } catch (e) {}
                }
            }
            data = data.filter(b => b.id !== node.bundle.id);
        }

        await vscode.workspace.fs.writeFile(mainUri, new TextEncoder().encode(JSON.stringify(data)));
        libraryTreeProvider.refresh();
    });

    const renameItemCommand = vscode.commands.registerCommand('abstergos-codelibrary.renameItem', async (node) => {
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name',
            value: node.label
        });

        if (!newName) { return; }

        const mainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
        const bytes = await vscode.workspace.fs.readFile(mainUri);
        let data = JSON.parse(Buffer.from(bytes).toString('utf8'));

        if (node.contextValue === 'script') {
            if (node.bundleId) {
                const bundle = data.find(b => b.id === node.bundleId);
                if (bundle) {
                    const script = bundle.children.find(s => s.id === node.script.id);
                    if (script) { script.name = newName; }
                }
            } else {
                const script = data.find(s => s.id === node.script.id);
                if (script) { script.name = newName; }
            }
        } else if (node.contextValue === 'bundle') {
            const bundle = data.find(b => b.id === node.bundle.id);
            if (bundle) { bundle.name = newName; }
        }

        await vscode.workspace.fs.writeFile(mainUri, new TextEncoder().encode(JSON.stringify(data)));
        libraryTreeProvider.refresh();
    });

    const pasteScriptCommand = vscode.commands.registerCommand('abstergos-codelibrary.pasteScript', async () => {
        const mainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
        const bytes = await vscode.workspace.fs.readFile(mainUri);
        const data = JSON.parse(Buffer.from(bytes).toString('utf8'));

        const editor = vscode.window.activeTextEditor;
        const currentLang = editor ? editor.document.languageId : null;

        // Grouping items by language
        const grouped = {};
        data.forEach(item => {
            if (item.type === 'bundle') {
                const lang = item.children && item.children.length > 0 ? item.children[0].lang : 'unknown';
                if (!grouped[lang]) { grouped[lang] = { bundles: [], scripts: [] }; }
                grouped[lang].bundles.push(item);
            } else {
                const lang = item.lang;
                if (!grouped[lang]) { grouped[lang] = { bundles: [], scripts: [] }; }
                grouped[lang].scripts.push(item);
            }
        });

        // Sorting languages: current first, then alphabetical
        const sortedLangs = Object.keys(grouped).sort((a, b) => {
            if (a === currentLang) return -1;
            if (b === currentLang) return 1;
            return a.localeCompare(b);
        });

        const quickPickItems = [];
        sortedLangs.forEach(lang => {
            quickPickItems.push({
                label: lang.toUpperCase(),
                kind: vscode.QuickPickItemKind.Separator
            });

            // Bundles first
            grouped[lang].bundles.sort((a, b) => a.name.localeCompare(b.name)).forEach(bundle => {
                bundle.children.forEach(child => {
                    quickPickItems.push({
                        label: `$(package) ${child.name}`,
                        description: bundle.name,
                        detail: `Language: ${child.lang}${child.tags && child.tags.length > 0 ? ' | Tags: ' + child.tags.join(', ') : ''}`,
                        script: child
                    });
                });
            });

            // Then standalone scripts
            grouped[lang].scripts.sort((a, b) => a.name.localeCompare(b.name)).forEach(script => {
                quickPickItems.push({
                    label: `$(code) ${script.name}`,
                    detail: `Language: ${script.lang}${script.tags && script.tags.length > 0 ? ' | Tags: ' + script.tags.join(', ') : ''}`,
                    script: script
                });
            });
        });

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select a script to paste'
        });

        if (selected) {
            if (editor) {
                const scriptUri = vscode.Uri.joinPath(context.globalStorageUri, 'items', `${selected.script.id}.txt`);
                const scriptBytes = await vscode.workspace.fs.readFile(scriptUri);
                let content = Buffer.from(scriptBytes).toString('utf8');
                content = content.replace(/\u00a0/g, ' '); // Replace NBSP with regular space
                
                const lang = selected.script.lang;
                const marker = getCommentMarker(lang);
                const startMarker = `${marker} @library-id: ${selected.script.id}\n`;
                const endMarker = `\n${marker} @library-end`;

                editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, startMarker + content + endMarker);
                });
            } else {
                vscode.window.showErrorMessage('No active editor found to paste the script.');
            }
        }
    });

    const syncScriptsFileCommand = vscode.commands.registerCommand('abstergos-codelibrary.syncScriptsFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        const count = await syncFile(editor.document.uri, context);
        if (count > 0) {
            vscode.window.showInformationMessage(`Synchronized ${count} scripts in current file.`);
        } else {
            vscode.window.showInformationMessage('No library scripts found to synchronize.');
        }
    });

    const syncScriptsDirCommand = vscode.commands.registerCommand('abstergos-codelibrary.syncScriptsDir', async (uri) => {
        let targetUri = uri;
        if (!targetUri) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                targetUri = workspaceFolders[0].uri;
            }
        }

        if (!targetUri) {
            vscode.window.showErrorMessage('No directory selected for synchronization.');
            return;
        }

        let totalUpdates = 0;
        let filesProcessed = 0;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Synchronizing Library Scripts",
            cancellable: false
        }, async (progress) => {
            const files = await vscode.workspace.findFiles(new vscode.RelativePattern(targetUri.fsPath, '**/*'), '**/node_modules/**');
            for (const file of files) {
                const count = await syncFile(file, context);
                if (count > 0) {
                    totalUpdates += count;
                    filesProcessed++;
                }
            }
        });

        if (totalUpdates > 0) {
            vscode.window.showInformationMessage(`Synchronized ${totalUpdates} scripts across ${filesProcessed} files.`);
        } else {
            vscode.window.showInformationMessage('No library scripts found to synchronize in the selected directory.');
        }
    });

    async function syncFile(uri, context) {
        const mainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
        const bytes = await vscode.workspace.fs.readFile(mainUri);
        const data = JSON.parse(Buffer.from(bytes).toString('utf8'));

        const libraryItems = {};
        data.forEach(item => {
            if (item.type === 'bundle') {
                item.children.forEach(child => { libraryItems[child.id] = child; });
            } else {
                libraryItems[item.id] = item;
            }
        });

        const document = await vscode.workspace.openTextDocument(uri);
        const text = document.getText();
        const lang = document.languageId;
        const marker = getCommentMarker(lang);
        const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`${escapedMarker} @library-id: ([a-zA-Z0-9]+)[\\s\\S]*?${escapedMarker} @library-end`, 'g');

        let match;

        const edits = [];

        while ((match = regex.exec(text)) !== null) {
            const fullMatchText = match[0];
            const id = match[1];

            // Check if synchronization is disabled for this instance
            if (fullMatchText.includes('@library-sync: disable')) {
                continue;
            }

            const item = libraryItems[id];
            if (item) {
                const scriptUri = vscode.Uri.joinPath(context.globalStorageUri, 'items', `${id}.txt`);
                const scriptBytes = await vscode.workspace.fs.readFile(scriptUri);
                let newContent = Buffer.from(scriptBytes).toString('utf8');
                newContent = newContent.replace(/\u00a0/g, ' '); // Replace NBSP
                
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);
                const newFullText = `${marker} @library-id: ${id}\n${newContent}\n${marker} @library-end`;
                
                edits.push({ range: new vscode.Range(startPos, endPos), newText: newFullText });
            }
        }

        if (edits.length > 0) {
            const edit = new vscode.WorkspaceEdit();
            edits.forEach(e => edit.replace(uri, e.range, e.newText));
            await vscode.workspace.applyEdit(edit);
            return edits.length;
        }
        return 0;
    }

    function getCommentMarker(lang) {
        const markers = {
            'javascript': '//',
            'typescript': '//',
            'java': '//',
            'cpp': '//',
            'c': '//',
            'csharp': '//',
            'php': '//',
            'swift': '//',
            'kotlin': '//',
            'rust': '//',
            'go': '//',
            'python': '#',
            'ruby': '#',
            'shellscript': '#',
            'haskell': '--',
            'css': '/*',
            'html': '<!--'
        };
        // CSS and HTML are special but for sync markers we'll use these or default to //
        return markers[lang] || '//';
    }

	const saveAsBundle = vscode.commands.registerCommand('abstergos-codelibrary.saveAsBundle', async (uri) => {
		await _saveAsBundle(uri, context);
        libraryTreeProvider.refresh();
	});

	const saveAsScript = vscode.commands.registerCommand('abstergos-codelibrary.saveAsScript', async ()=> {
		await _saveAsScript(context);
        libraryTreeProvider.refresh();
	});

	context.subscriptions.push(refreshCommand, searchCommand, clearSearchCommand, openItemCommand, deleteItemCommand, renameItemCommand, pasteScriptCommand, syncScriptsFileCommand, syncScriptsDirCommand, saveAsBundle, saveAsScript);
}

/**
 * @param {vscode.Uri} uri
 * @param {vscode.ExtensionContext} context
 */
async function _saveAsBundle(uri, context) {
	if (uri && uri.fsPath) {
		
		let readed = await vscode.workspace.fs.readFile(uri)
		let selectedText = Buffer.from(readed).toString('utf8');
		selectedText = selectedText.replace(/\u00a0/g, ' '); // Replace NBSP
		// @ts-ignore
		const languageID = languages[uri.toString().getFileExtension()];
		const mainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
		const data = await vscode.workspace.fs.readFile(mainUri);
		const fileText = Buffer.from(data).toString('utf8');
		let parsed = JSON.parse(fileText);
        const fullFileName = path.basename(uri.fsPath);
        const fileName = path.parse(fullFileName).name;
        const fileExtension = uri.toString().getFileExtension();

		if (fileExtension === "ipynb") {
            // ... (notebook logic remains same)
            const bundleName = await vscode.window.showInputBox({ prompt: 'Enter name for the notebook bundle', value: fileName });
            if (bundleName === undefined) { return; }

            let notebook;
            try {
                notebook = JSON.parse(selectedText);
            } catch (e) {
                vscode.window.showErrorMessage('Failed to parse notebook JSON.');
                return;
            }

            const excludeIds = [];
			let bundle = {
				type: "bundle",
				id: generateShortId(parsed),
				name: bundleName || fileName,
                lang: 'ipynb',
				children: []
			}
            excludeIds.push(bundle.id);

            let cellCount = 1;
            for (const cell of notebook.cells) {
                const cellSource = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
                if (!cellSource.trim()) continue;

                if (cell.cell_type === 'code') {
                    const functions = getFunctionsAsObjects(cellSource, 'python');
                    for (const fn of functions) {
                        let scriptID = generateShortId(parsed, excludeIds);
                        excludeIds.push(scriptID);
                        
                        let scriptName = fn.name === 'python Script' ? `Cell ${cellCount}` : fn.name;
                        
                        const script = {
                            id: scriptID,
                            name: scriptName,
                            lang: 'python',
                            type: "item",
                            tags: []
                        };
                        bundle.children.push(script);
                        const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
                        const content = new TextEncoder().encode(fn.text);
                        vscode.workspace.fs.writeFile(fileUri, content);
                    }
                    cellCount++;
                } else if (cell.cell_type === 'markdown') {
                    let scriptID = generateShortId(parsed, excludeIds);
                    excludeIds.push(scriptID);
                    
                    const script = {
                        id: scriptID,
                        name: `Note ${cellCount}`,
                        lang: 'markdown',
                        type: "item",
                        tags: []
                    };
                    bundle.children.push(script);
                    const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
                    const content = new TextEncoder().encode(cellSource);
                    vscode.workspace.fs.writeFile(fileUri, content);
                    cellCount++;
                }
            }
            parsed.push(bundle);
		} else if (["html", "css", "dockerfile", "makefile", "json", "yaml", "sql", "terraform", "markdown", "vue"].includes(languageID)) {
            const name = await vscode.window.showInputBox({ prompt: `Enter name for the ${languageID} script`, value: fileName });
            if (name === undefined) { return; }
			const scriptID = generateShortId(parsed);
			const script = {
				id: scriptID,
				name: name || fileName,
				lang: languageID,
				type: "item",
				tags: []
			};
			parsed.push(script);
			const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
			const content = new TextEncoder().encode(selectedText);
			vscode.workspace.fs.writeFile(fileUri, content);
		} else {
            const bundleName = await vscode.window.showInputBox({ prompt: 'Enter name for the bundle', value: fileName });
            if (bundleName === undefined) { return; }
			const functions = getFunctionsAsObjects(selectedText, languageID);
            const excludeIds = [];
			let bundle = {
				type: "bundle",
				id: generateShortId(parsed),
				name: bundleName || fileName,
                lang: languageID,
				children: []
			}
            excludeIds.push(bundle.id);
			for (var fn of functions) {
				let scriptID = generateShortId(parsed, excludeIds);
                excludeIds.push(scriptID);
				const script = {
					id: scriptID,
					name: fn.name,
					lang: languageID,
					type: "item",
					tags: []
				};
				bundle.children.push(script);
				const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
				const content = new TextEncoder().encode(fn.text);
				vscode.workspace.fs.writeFile(fileUri, content);
			}
			parsed.push(bundle);
		}
		const encoded = new TextEncoder().encode(JSON.stringify(parsed));
		vscode.workspace.fs.writeFile(mainUri, encoded);
	}
}

async function _saveAsScript (context) {
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		const selection = editor.selection;
		let selectedText = editor.document.getText(selection);
		selectedText = selectedText.replace(/\u00a0/g, ' '); // Replace NBSP
		const languageID = editor.document.languageId;
        const fullFileName = path.basename(editor.document.fileName);
        const fileName = path.parse(fullFileName).name;
		const mainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
		const data = await vscode.workspace.fs.readFile(mainUri);
		const fileText = Buffer.from(data).toString('utf8');
		let parsed = JSON.parse(fileText);
		if (languageID == "html") {
            const name = await vscode.window.showInputBox({ prompt: 'Enter name for the HTML script', value: fileName });
            if (name === undefined) { return; }
			const scriptID = generateShortId(parsed);
			const script = {
				id: scriptID,
				name: name || fileName,
				lang: languageID,
				type: "item",
				tags: []
			};
			parsed.push(script);
			const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
			const content = new TextEncoder().encode(selectedText);
			vscode.workspace.fs.writeFile(fileUri, content);
		} else if (languageID == "css") {
            const name = await vscode.window.showInputBox({ prompt: 'Enter name for the CSS script', value: fileName });
            if (name === undefined) { return; }
			const scriptID = generateShortId(parsed);
			const script = {
				id: scriptID,
				name: name || fileName,
				lang: languageID,
				type: "item",
				tags: []
			};
			parsed.push(script);
			const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
			const content = new TextEncoder().encode(selectedText);
			vscode.workspace.fs.writeFile(fileUri, content);
		} else {
			const functions = getFunctionsAsObjects(selectedText, languageID);
            const excludeIds = [];
			for (var fn of functions) {
				let scriptID = generateShortId(parsed, excludeIds);
                excludeIds.push(scriptID);

                let finalName = fn.name;
                if (functions.length === 1) {
                    const name = await vscode.window.showInputBox({ prompt: 'Enter name for the script', value: fn.name });
                    if (name === undefined) { return; }
                    finalName = name || fn.name;
                }

				const script = {
					id: scriptID,
					name: finalName,
					lang: languageID,
					type: "item",
					tags: []
				};
				parsed.push(script);
				const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
				const content = new TextEncoder().encode(fn.text);
				vscode.workspace.fs.writeFile(fileUri, content);
			}
		}
		const encoded = new TextEncoder().encode(JSON.stringify(parsed));
		vscode.workspace.fs.writeFile(mainUri, encoded);
	}
}


const patterns = {
	javascript: /\bfunction\s+([a-zA-Z0-9_$]+)\s*\(/,
	react: /\bfunction\s+([a-zA-Z0-9_$]+)\s*\(/,
	python: /\b(?:async\s+)?def\s+([a-zA-Z0-9_$]+)\s*\(/,
	rust: /\bfn\s+([a-zA-Z0-9_$]+)\s*\(/,
	java: /\b(?:public|private|protected)?\s*(?:static)?\s*(?:void|int|float|double|char|[A-Z][A-Za-z0-9_]*)\s+([a-zA-Z0-9_$]+)\s*\(/,
	cpp: /\b(?:void|int|float|double|char|[A-Za-z0-9_$]+)\s+([a-zA-Z0-9_$]+)\s*\(/,
	php: /\bfunction\s+([a-zA-Z0-9_$]+)\s*\(/,
	csharp: /\b(?:public|private|protected|internal)?\s*(?:static)?\s*(?:void|int|float|double|char|string|[A-Z][A-Za-z0-9_]*)\s+([a-zA-Z0-9_$]+)\s*\(/,
	kotlin: /\bfun\s+([a-zA-Z0-9_$]+)\s*\(/,
	swift: /\bfunc\s+([a-zA-Z0-9_$]+)\s*\(/,
	ruby: /\bdef\s+([a-zA-Z0-9_$]+)\s*\(/,
	typescript: /\bfunction\s+([a-zA-Z0-9_$]+)\s*\(/,
	go: /\bfunc\s+([a-zA-Z0-9_$]+)\s*\(/,
	dart: /\b(?:[a-zA-Z0-9_$]+)?\s*([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*(?:async)?\s*{/,
	c: /\b(?:void|int|float|double|char|[A-Za-z0-9_$]+)\s+([a-zA-Z0-9_$]+)\s*\(/,
	shellscript: /\b(?:function\s+)?([a-zA-Z0-9_$]+)\s*\(\s*\)\s*{/,
	haskell: /^([a-zA-Z0-9_$]+)\s+.*=/m,
	makefile: /^([a-zA-Z0-9._-]+)\s*:/m,
	sql: /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION)\s+([a-zA-Z0-9_$]+)/i,
	mysql: /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION)\s+([a-zA-Z0-9_$]+)/i,
	postgresql: /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION)\s+([a-zA-Z0-9_$]+)/i
};
const languages = {
	js: "javascript",
	jsx: "react",
	py: "python",
	ipynb: "python",
	rs: "rust",
	java: "java",
	cpp: "cpp",
	php: "php",
	cs: "csharp",
	kt: "kotlin",
	swift: "swift",
	ru: "ruby",
	ts: "typescript",
	tsx: "react",
	go: "go",
	dart: "dart",
	c: "c",
	bash: "shellscript",
	sh: "shellscript",
	hs: "haskell",
	html: "html",
	css: "css",
	md: "markdown",
	dockerfile: "dockerfile",
	makefile: "makefile",
	json: "json",
	yaml: "yaml",
	yml: "yaml",
	sql: "sql",
	mysql: "mysql",
	postgresql: "postgresql",
	tf: "terraform",
	hcl: "terraform",
	vue: "vue"
}


function getFunctionsAsObjects(codeString, language) {
    const regex = patterns[language];
    if (!regex) {
        return [{
			name: "Plain Text",
			text: codeString
		}]
    }
    
    const functions = [];
    let match;
    const globalRegex = new RegExp(regex.source, 'g');
	let wasMatch = false;
    while ((match = globalRegex.exec(codeString)) !== null) {
		wasMatch = true;
        const funcName = match[1];
        const funcStartIndex = match.index;
        let funcBody = match[0]; // Start with the matched line
        let endIndex = funcStartIndex + match[0].length;

        if (language === 'python') {
            // Determine base indentation from the start of the line
            const lineStart = codeString.lastIndexOf('\n', funcStartIndex) + 1;
            const leadingText = codeString.slice(lineStart, funcStartIndex);
            const indentationMatch = leadingText.match(/^\s*/);
            const baseIndentation = (indentationMatch ? indentationMatch[0].length : 0);

            // Look back for decorators
            let decorators = [];
            const linesBefore = codeString.slice(0, lineStart).split('\n');
            for (let i = linesBefore.length - 2; i >= 0; i--) { // -2 because split adds an empty string if it ends in \n
                const line = linesBefore[i];
                if (line.trim().startsWith('@')) {
                    decorators.unshift(line);
                } else if (line.trim().length === 0) {
                    continue;
                } else {
                    break;
                }
            }

            if (decorators.length > 0) {
                funcBody = decorators.join('\n') + '\n' + leadingText + funcBody;
            }

            // Get the rest of the current line after the match
            let currentLineEnd = codeString.indexOf('\n', endIndex);
            if (currentLineEnd === -1) currentLineEnd = codeString.length;
            funcBody += codeString.slice(endIndex, currentLineEnd);
            endIndex = currentLineEnd;

            const lines = codeString.slice(endIndex).split('\n');
            if (lines.length > 0 && lines[0] === '') lines.shift();

            for (const line of lines) {
                if (line.trim().length === 0) {
                    funcBody += '\n' + line;
                    endIndex += line.length + 1;
                    continue;
                }
                const lineIndentationMatch = line.match(/^\s*/);
                const lineIndentation = lineIndentationMatch ? lineIndentationMatch[0].length : 0;
                if (lineIndentation > baseIndentation) {
                    funcBody += '\n' + line;
                    // Update endIndex as we consume lines
                    endIndex += line.length + 1; // +1 for the newline
                } else {
                    break;
                }
            }
        } else if (language === 'haskell') {
            const lines = codeString.slice(endIndex).split("\n");
            for (const line of lines) {
                if (/^\s*[a-zA-Z0-9_$]+\s*.*=/.test(line)) break;
                if (line.trim()) {
                    funcBody += `\n${line}`;
                    endIndex += line.length + 1;
                }
            }
        } else if (language === 'makefile') {
            const lines = codeString.slice(endIndex).split("\n");
            for (const line of lines) {
                // If line starts with a non-tab character and contains a colon, it's likely the next target
                if (line.trim() && !line.startsWith('\t') && line.includes(':')) break;
                funcBody += `\n${line}`;
                endIndex += line.length + 1;
            }
        } else {
            let braceCount = 1;
			let omitFirst = true;
            while (braceCount > 0 && endIndex < codeString.length) {
                const char = codeString[endIndex];
                if (char === '{') {
					if (omitFirst) {
						omitFirst = false;
					} else {
						braceCount++;
					}
				}
                if (char === '}') {
					braceCount--;
				}
                funcBody += char;
                endIndex++;
            }
        }

        functions.push({
            name: funcName,
            text: funcBody.trim()
        });
        
        // Advance the regex to the end of this function to avoid matching nested functions
        globalRegex.lastIndex = endIndex;
    }
	if (!wasMatch) {
		return [{
			name: `${language} Script`,
			text: codeString
		}]
	}
    return functions;
}
function deactivate() {}

function generateShortId(existingData, excludeIds = []) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const existingIds = new Set(excludeIds);
    existingData.forEach(item => {
        existingIds.add(item.id);
        if (item.type === 'bundle' && item.children) {
            item.children.forEach(child => existingIds.add(child.id));
        }
    });

    let id;
    do {
        id = '';
        for (let i = 0; i < 5; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (existingIds.has(id));
    return id;
}

module.exports = {
	activate,
	deactivate
}
