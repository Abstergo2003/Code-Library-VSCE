const vscode = require('vscode');

class LibraryTreeProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.searchQuery = '';
        
        this.dropMimeTypes = ['application/vnd.code.tree.abstergos-codelibrary-view'];
        this.dragMimeTypes = ['application/vnd.code.tree.abstergos-codelibrary-view'];
    }

    refresh(query = '') {
        this.searchQuery = query.toLowerCase();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async handleDrag(source, dataTransfer, token) {
        dataTransfer.set('application/vnd.code.tree.abstergos-codelibrary-view', new vscode.DataTransferItem(source));
    }

    async handleDrop(target, dataTransfer, token) {
        const transferItem = dataTransfer.get('application/vnd.code.tree.abstergos-codelibrary-view');
        if (!transferItem || !target) {
            return;
        }

        const sourceItems = transferItem.value;
        if (!sourceItems || !Array.isArray(sourceItems) || sourceItems.length === 0) {
            return;
        }

        const sourceNode = sourceItems[0];
        if (!sourceNode || sourceNode.contextValue !== 'script') {
            return;
        }

        const mainUri = vscode.Uri.joinPath(this.context.globalStorageUri, "main.json");
        const bytes = await vscode.workspace.fs.readFile(mainUri);
        let data = JSON.parse(Buffer.from(bytes).toString('utf8'));

        if (target.contextValue === 'bundle') {
            // Determine bundle language
            const bundleLang = target.bundle.children && target.bundle.children.length > 0 
                ? target.bundle.children[0].lang 
                : null;

            if (bundleLang && sourceNode.script.lang !== bundleLang) {
                vscode.window.showErrorMessage(`Cannot move ${sourceNode.script.lang} script into ${bundleLang} bundle.`);
                return;
            }

            // Remove from current location
            let movingScript;
            if (sourceNode.bundleId) {
                const oldBundle = data.find(b => b.id === sourceNode.bundleId);
                if (oldBundle) {
                    movingScript = oldBundle.children.find(s => s.id === sourceNode.script.id);
                    oldBundle.children = oldBundle.children.filter(s => s.id !== sourceNode.script.id);
                }
            } else {
                movingScript = data.find(s => s.id === sourceNode.script.id);
                data = data.filter(s => s.id !== sourceNode.script.id);
            }

            if (movingScript) {
                const newBundle = data.find(b => b.id === target.bundle.id);
                if (newBundle) {
                    newBundle.children.push(movingScript);
                    await vscode.workspace.fs.writeFile(mainUri, new TextEncoder().encode(JSON.stringify(data)));
                    this.refresh(this.searchQuery);
                }
            }
        } else if (target.contextValue === 'language') {
            if (sourceNode.script.lang !== target.lang) {
                vscode.window.showErrorMessage(`Cannot move ${sourceNode.script.lang} script into ${target.lang} section.`);
                return;
            }

            // Only move if it's currently inside a bundle
            if (sourceNode.bundleId) {
                let movingScript;
                const oldBundle = data.find(b => b.id === sourceNode.bundleId);
                if (oldBundle) {
                    movingScript = oldBundle.children.find(s => s.id === sourceNode.script.id);
                    oldBundle.children = oldBundle.children.filter(s => s.id !== sourceNode.script.id);
                    
                    if (movingScript) {
                        data.push(movingScript);
                        await vscode.workspace.fs.writeFile(mainUri, new TextEncoder().encode(JSON.stringify(data)));
                        this.refresh(this.searchQuery);
                    }
                }
            }
        }
    }

    async getChildren(element) {
        const mainUri = vscode.Uri.joinPath(this.context.globalStorageUri, "main.json");
        let data;
        try {
            const bytes = await vscode.workspace.fs.readFile(mainUri);
            data = JSON.parse(Buffer.from(bytes).toString('utf8'));
        } catch (e) {
            return [];
        }

        const isMatch = (item) => {
            if (!this.searchQuery) return true;
            const nameMatch = item.name.toLowerCase().includes(this.searchQuery);
            const langMatch = item.lang && item.lang.toLowerCase().includes(this.searchQuery);
            const tagsMatch = item.tags && item.tags.some(t => t.toLowerCase().includes(this.searchQuery));
            return nameMatch || langMatch || tagsMatch;
        };

        if (!element) {
            // Root level: Languages
            const languages = new Set();
            data.forEach(item => {
                const lang = item.lang || (item.type === 'bundle' && item.children && item.children.length > 0 ? item.children[0].lang : null);
                if (lang) {
                    if (this.searchQuery) {
                        if (item.type === 'bundle') {
                            const matchingChildren = item.children ? item.children.filter(child => isMatch(child)) : [];
                            if (matchingChildren.length > 0 || item.name.toLowerCase().includes(this.searchQuery)) {
                                languages.add(lang);
                            }
                        } else if (isMatch(item)) {
                            languages.add(lang);
                        }
                    } else {
                        languages.add(lang);
                    }
                }
            });

            return Array.from(languages).sort().map(lang => new LanguageItem(lang, vscode.TreeItemCollapsibleState.Expanded, this.context));
        } else if (element.contextValue === 'language') {
            // Level 1: Bundles and items for this language
            const items = data.filter(item => {
                const itemLang = item.lang || (item.type === 'bundle' && item.children && item.children.length > 0 ? item.children[0].lang : null);
                if (item.type === 'bundle') {
                    const matchingChildren = item.children ? item.children.filter(child => isMatch(child)) : [];
                    const bundleMatch = item.name.toLowerCase().includes(this.searchQuery);
                    return itemLang === element.lang && (matchingChildren.length > 0 || bundleMatch);
                } else {
                    return itemLang === element.lang && isMatch(item);
                }
            });

            return items.map(item => {
                if (item.type === 'bundle') {
                    return new BundleItem(item, this.searchQuery ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
                } else {
                    return new ScriptItem(item, vscode.TreeItemCollapsibleState.None);
                }
            });
        } else if (element.contextValue === 'bundle') {
            // Level 2: Children of a bundle
            if (element.bundle && element.bundle.children) {
                const filtered = element.bundle.children.filter(child => isMatch(child) || element.bundle.name.toLowerCase().includes(this.searchQuery));
                return filtered.map(item => new ScriptItem(item, vscode.TreeItemCollapsibleState.None, element.bundle.id));
            }
        }

        return [];
    }
}

class LanguageItem extends vscode.TreeItem {
    constructor(lang, collapsibleState, context) {
        super(lang, collapsibleState);
        this.lang = lang;
        this.context = context;
        this.contextValue = 'language';
        this.iconPath = this.getIcon(lang);
    }

    getIcon(lang) {
        const iconMapping = {
            'csharp': 'csharp.svg',
            'cpp': 'c++.svg',
            'php': 'php.png',
            'terraform': 'terraform.png',
            'ipynb': 'ipynb.svg',
            'markdown': 'json.svg',
            'dockerfile': 'docker.svg',
            'makefile': 'ansible.svg',
            'yaml': 'ansible.svg',
            'json': 'json.svg',
            'sql': 'mysql.svg',
            'postgresql': 'postgresql.svg',
            'mysql': 'mysql.svg',
            'mongodb': 'mongodb.svg',
            'redis': 'redis.svg',
            'oracle': 'oracle.svg',
            'cassandra': 'cassandra.svg',
            'vue': 'vuejs.svg',
            'react': 'react.svg',
            'angular': 'angular.svg',
            'nodejs': 'nodejs.svg',
            'javascript': 'javascript.svg',
            'typescript': 'typescript.svg',
            'python': 'python.svg',
            'ruby': 'ruby.svg',
            'go': 'go.svg',
            'rust': 'rust.svg',
            'kotlin': 'kotlin.svg',
            'java': 'java.svg',
            'dart': 'dart.svg',
            'haskell': 'haskell.svg',
            'shellscript': 'shellscript.svg',
            'ansible': 'ansible.svg',
            'django': 'django.svg',
            'flask': 'flask.svg',
            'laravel': 'laravel.svg',
            'rails': 'rails.svg',
            'spring': 'spring.svg',
            'amazon': 'amazon.svg',
            'azure': 'azure.svg',
            'gcloud': 'gcloud.svg',
            'android': 'android.svg',
            'firebase': 'firebase.svg',
            'heroku': 'heroku.svg',
            'jquery': 'jquery.svg',
            'redux': 'redux.svg',
            'npm': 'npm.svg',
            'git': 'git.svg',
            'github': 'github.svg',
            'gitlab': 'gitlab.svg',
            'bitbucket': 'bitbucket.svg',
            'gitkraken': 'gitkraken.svg',
            'bootstrap': 'boostrap.svg',
            'materialize': 'materialize.svg',
            'deno': 'deno.svg',
            'codeigniter': 'codeigniter.svg'
        };
        const iconFile = iconMapping[lang] || `${lang}.svg`;
        const iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'icons', iconFile);
        return {
            light: iconPath,
            dark: iconPath
        };
    }
}

class BundleItem extends vscode.TreeItem {
    constructor(bundle, collapsibleState) {
        super(bundle.name, collapsibleState);
        this.bundle = bundle;
        this.contextValue = 'bundle';
        this.iconPath = new vscode.ThemeIcon('package');
        this.id = bundle.id;
    }
}

class ScriptItem extends vscode.TreeItem {
    constructor(script, collapsibleState, bundleId = null) {
        super(script.name, collapsibleState);
        this.script = script;
        this.bundleId = bundleId;
        this.contextValue = 'script';
        this.iconPath = new vscode.ThemeIcon('code');
        this.id = script.id;
        this.command = {
            command: 'abstergos-codelibrary.openItem',
            title: 'Open Item',
            arguments: [script]
        };
    }
}

module.exports = { LibraryTreeProvider };
