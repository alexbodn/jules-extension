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
            // Check cache first? logic reused from listSources logic in extension.ts could be moved here or duplicated/imported.
            // For simplicity and robustness, let's fetch fresh or use extension's cache if accessible.
            // Accessing globalState directly.

            // Note: Ideally we share the fetch logic. For now, calling API directly.
            const client = this.apiClientFactory(apiKey);
            // We need a listSources method on client or fetch manually.
            // JulesApiClient doesn't have listSources yet (only getSource).
            // Let's implement listSources in JulesApiClient later or fetch here.
            // But wait, the extension already fetches sources.

            // Let's rely on the cache populated by the extension or fetch if missing?
            // Actually, best to just fetch using client.
            // I'll add listSources to JulesApiClient in the next step or mock it here.
            // Wait, I can't modify JulesApiClient in this step easily without context switch.
            // I'll assume I can add it or use raw fetch.
            // Let's check JulesApiClient again.

            // ... checking memory ... JulesApiClient has getSource.
            // I will add listSources to JulesApiClient.

            // Placeholder: Assume extension logic handles cache for now, or just fetch.
            // I'll implement fetch here to be self-contained.

            const response = await fetch("https://jules.googleapis.com/v1alpha/sources", {
                headers: {
                    "X-Goog-Api-Key": apiKey,
                    "Content-Type": "application/json",
                }
            });

            if (!response.ok) {
                throw new Error(`Failed: ${response.status}`);
            }

            const data = (await response.json()) as any;
            const sources = data.sources || [];

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
