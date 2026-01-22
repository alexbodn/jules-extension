import * as vscode from 'vscode';
import { Source as SourceType } from './types';
import { JulesApiClient } from './julesApiClient';

export class JulesSourcesProvider implements vscode.TreeDataProvider<SourceTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SourceTreeItem | undefined | null | void> = new vscode.EventEmitter<SourceTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SourceTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private context: vscode.ExtensionContext,
        private apiClientFactory: (apiKey: string) => JulesApiClient
    ) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SourceTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SourceTreeItem): Promise<SourceTreeItem[]> {
        if (element) {
            return []; // Sources are flat for now
        }

        const apiKey = await this.context.secrets.get("jules-api-key");
        if (!apiKey) {
            return [new SourceTreeItem({ name: 'Sign in to see sources', id: 'signin' } as any, false, 'signin')];
        }

        try {
            const client = this.apiClientFactory(apiKey);
            const sources = await client.listSources();

            const selectedSource = this.context.globalState.get<SourceType>("selected-source");

            return sources.map((source: SourceType) => {
                const isSelected = !!(selectedSource && source.name === selectedSource.name);
                return new SourceTreeItem(source, isSelected);
            });

        } catch (error) {
            return [new SourceTreeItem({ name: 'Error fetching sources', id: 'error' } as any, false, 'error')];
        }
    }
}

export class SourceTreeItem extends vscode.TreeItem {
    constructor(
        public readonly source: SourceType,
        public readonly isSelected: boolean,
        public readonly type?: string
    ) {
        super(source.name || "Unknown", vscode.TreeItemCollapsibleState.None);

        if (type === 'signin') {
            this.label = "Set API Key";
            this.command = { command: 'jules-extension.setApiKey', title: 'Set API Key' };
            this.iconPath = new vscode.ThemeIcon('key');
            return;
        }
        if (type === 'error') {
            this.label = "Error loading sources";
            this.description = "Click to retry";
            this.command = { command: 'jules-extension.refreshSources', title: 'Refresh' };
            return;
        }

        // Extract repo name
        const repoMatch = source.name?.match(/sources\/github\/(.+)/);
        const repoName = repoMatch ? repoMatch[1] : (source.name || source.id);

        this.label = repoName;
        this.description = isSelected ? "(Selected)" : "";
        this.iconPath = isSelected ? new vscode.ThemeIcon('check') : new vscode.ThemeIcon('repo');

        if (source.isPrivate) {
            this.iconPath = isSelected ? new vscode.ThemeIcon('pass-filled') : new vscode.ThemeIcon('lock');
        }

        this.command = {
            command: 'jules-extension.selectSourceFromView',
            title: 'Select Source',
            arguments: [source]
        };
    }
}
