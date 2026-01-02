import * as vscode from 'vscode';
import { Source as SourceType, Session, SessionsResponse } from './types';
import { SessionStateManager } from './sessionState';
import { mapApiStateToSessionState, areSessionListsEqual, extractPRUrl, getPrivacyIcon, getPrivacyStatusText } from './sessionUtils';
import { notifyPlanAwaitingApproval, notifyUserFeedbackRequired, notifyPRCreated } from './notificationUtils';
import { fetchWithTimeout } from './fetchUtils';
import { JulesApiClient } from './julesApiClient';
import { getBranchesForSession } from './branchUtils';
import { sanitizeForLogging } from './securityUtils';

const JULES_API_BASE_URL = "https://jules.googleapis.com/v1alpha";
const SHOW_ACTIVITIES_COMMAND = 'jules-extension.showActivities';

const SESSION_STATE = {
    AWAITING_PLAN_APPROVAL: "AWAITING_PLAN_APPROVAL",
    AWAITING_USER_FEEDBACK: "AWAITING_USER_FEEDBACK",
};

export class SessionTreeItem extends vscode.TreeItem {
    // API state to icon mapping for 10 states
    private static readonly stateIconMap: Record<string, vscode.ThemeIcon> = {
        'STATE_UNSPECIFIED': new vscode.ThemeIcon('question'),
        'QUEUED': new vscode.ThemeIcon('watch'),
        'PLANNING': new vscode.ThemeIcon('loading~spin'),
        'AWAITING_PLAN_APPROVAL': new vscode.ThemeIcon('checklist'),
        'AWAITING_USER_FEEDBACK': new vscode.ThemeIcon('comment-discussion'),
        'IN_PROGRESS': new vscode.ThemeIcon('sync~spin'),
        'PAUSED': new vscode.ThemeIcon('debug-pause'),
        'FAILED': new vscode.ThemeIcon('error'),
        'COMPLETED': new vscode.ThemeIcon('check'),
        'CANCELLED': new vscode.ThemeIcon('close'),
    };

    // State descriptions for tooltips (English)
    private static readonly stateDescriptionMap: Record<string, string> = {
        'STATE_UNSPECIFIED': 'Unknown state',
        'QUEUED': 'Queued',
        'PLANNING': 'Planning',
        'AWAITING_PLAN_APPROVAL': 'Awaiting plan approval',
        'AWAITING_USER_FEEDBACK': 'Awaiting user feedback',
        'IN_PROGRESS': 'In progress',
        'PAUSED': 'Paused',
        'FAILED': 'Failed',
        'COMPLETED': 'Completed',
        'CANCELLED': 'Cancelled',
    };

    constructor(public readonly session: Session, private readonly selectedSource?: SourceType) {
        super(session.title || session.name, vscode.TreeItemCollapsibleState.None);

        const tooltip = new vscode.MarkdownString(`**${session.title || session.name}**`, true);
        tooltip.appendMarkdown(`\n\nStatus: **${session.state}**`);

        // Add state description from rawState
        if (session.rawState && SessionTreeItem.stateDescriptionMap[session.rawState]) {
            const stateDescription = SessionTreeItem.stateDescriptionMap[session.rawState];
            tooltip.appendMarkdown(`\n\nState: ${stateDescription}`);
        }

        if (session.requirePlanApproval) {
            tooltip.appendMarkdown(`\n\n⚠️ **Plan Approval Required**`);
        }

        if (session.sourceContext?.source) {
            // Extract repo name if possible for cleaner display
            const source = session.sourceContext.source;
            if (typeof source === 'string') {
                const repoMatch = source.match(/sources\/github\/(.+)/);
                const repoName = repoMatch ? repoMatch[1] : source;
                const lockIcon = getPrivacyIcon(this.selectedSource?.isPrivate);
                const privacyStatus = getPrivacyStatusText(this.selectedSource?.isPrivate, 'long');

                tooltip.appendMarkdown(`\n\nSource: ${lockIcon}\`${repoName}\`${privacyStatus}`);
            }
        }

        tooltip.appendMarkdown(`\n\nID: \`${session.name}\``);
        this.tooltip = tooltip;

        this.description = session.state;
        this.iconPath = this.getIcon(session.rawState);
        this.contextValue = "jules-session";
        if (session.url) {
            this.contextValue += " jules-session-with-url";
        }
        this.command = {
            command: SHOW_ACTIVITIES_COMMAND,
            title: "Show Activities",
            arguments: [session.name],
        };
    }

    private getIcon(rawState?: string): vscode.ThemeIcon {
        if (!rawState) {
            return SessionTreeItem.stateIconMap['STATE_UNSPECIFIED'];
        }

        // Use direct mapping for all 9 states
        return SessionTreeItem.stateIconMap[rawState] || SessionTreeItem.stateIconMap['STATE_UNSPECIFIED'];
    }
}

export class JulesSessionsProvider
    implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
    private static silentOutputChannel: vscode.OutputChannel = {
        name: 'silent-channel',
        append: () => { },
        appendLine: () => { },
        replace: () => { },
        clear: () => { },
        show: () => { },
        hide: () => { },
        dispose: () => { },
    };

    private _onDidChangeTreeData: vscode.EventEmitter<
        vscode.TreeItem | undefined | null | void
    > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<
        vscode.TreeItem | undefined | null | void
    > = this._onDidChangeTreeData.event;

    private sessionsCache: Session[] = [];
    private isFetching = false;
    private autoRefreshInterval: NodeJS.Timeout | undefined;
    private isFetchingSensitiveData = false;

    constructor(
        private context: vscode.ExtensionContext,
        private logChannel: vscode.OutputChannel,
        private sessionStateManager: SessionStateManager
    ) { }

    public setFastRefreshMode(enabled: boolean) {
        this.isFetchingSensitiveData = enabled;
        this.resetAutoRefresh();
    }

    private async getStoredApiKey(): Promise<string | undefined> {
        const apiKey = await this.context.secrets.get("jules-api-key");
        if (!apiKey) {
            vscode.window.showErrorMessage(
                'API Key not found. Please set it first using "Set Jules API Key" command.'
            );
            return undefined;
        }
        return apiKey;
    }

    private async fetchAndProcessSessions(
        isBackground: boolean = false
    ): Promise<void> {
        if (this.isFetching) {
            this.logChannel.appendLine("Jules: Fetch already in progress. Skipping.");
            return;
        }
        this.isFetching = true;
        this.logChannel.appendLine("Jules: Starting to fetch and process sessions...");

        try {
            const apiKey = await this.getStoredApiKey();
            if (!apiKey) {
                this.sessionsCache = [];
                return;
            }

            const response = await fetchWithTimeout(`${JULES_API_BASE_URL}/sessions`, {
                method: "GET",
                headers: {
                    "X-Goog-Api-Key": apiKey,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorMsg = `Failed to fetch sessions: ${response.status} ${response.statusText}`;
                this.logChannel.appendLine(`Jules: ${errorMsg}`);
                if (!isBackground) {
                    vscode.window.showErrorMessage(errorMsg);
                }
                this.sessionsCache = [];
                this._onDidChangeTreeData.fire();
                return;
            }

            const data = (await response.json()) as SessionsResponse;
            if (!data.sessions || !Array.isArray(data.sessions)) {
                this.logChannel.appendLine("Jules: No sessions found or invalid response format");
                this.sessionsCache = [];
                this._onDidChangeTreeData.fire();
                return;
            }

            // デバッグ: APIレスポンスの生データを確認
            this.logChannel.appendLine(`Jules: Debug - Raw API response sample (first 3 sessions):`);
            data.sessions.slice(0, 3).forEach((s: any, i: number) => {
                this.logChannel.appendLine(`  [${i}] name=${s.name}, state=${s.state}, title=${sanitizeForLogging(s.title)}`);
                this.logChannel.appendLine(`      updateTime=${s.updateTime}`);
            });

            this.logChannel.appendLine(`Jules: Found ${data.sessions.length} total sessions`);

            const allSessionsMapped = data.sessions.map((session) => ({
                ...session,
                rawState: session.state,
                state: mapApiStateToSessionState(session.state),
            }));

            // デバッグ: 全セッションのrawStateをログ出力
            this.logChannel.appendLine(`Jules: Debug - Total sessions: ${allSessionsMapped.length}`);
            const stateCounts = allSessionsMapped.reduce((acc, s) => {
                acc[s.rawState] = (acc[s.rawState] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            this.logChannel.appendLine(`Jules: Debug - State counts: ${JSON.stringify(stateCounts)}`);

            // --- Optimization: Check if sessions changed ---
            const sessionsChanged = !areSessionListsEqual(this.sessionsCache, allSessionsMapped);

            if (sessionsChanged) {
                this.processSessionNotifications(
                    allSessionsMapped,
                    SESSION_STATE.AWAITING_PLAN_APPROVAL,
                    (session) => notifyPlanAwaitingApproval(session, this.context),
                    "plan approval"
                );

                this.processSessionNotifications(
                    allSessionsMapped,
                    SESSION_STATE.AWAITING_USER_FEEDBACK,
                    notifyUserFeedbackRequired,
                    "user feedback"
                );

                // --- Check for completed sessions (PR created) ---
                const completedSessions = this.sessionStateManager.checkForCompletedSessions(allSessionsMapped);
                if (completedSessions.length > 0) {
                    this.logChannel.appendLine(
                        `Jules: Found ${completedSessions.length} completed sessions`
                    );
                    for (const session of completedSessions) {
                        const prUrl = extractPRUrl(session);
                        if (prUrl) {
                            notifyPRCreated(session, prUrl).catch((error) => {
                                this.logChannel.appendLine(`Jules: Failed to show PR notification: ${error}`);
                            });
                        }
                    }
                }
            } else {
                this.logChannel.appendLine("Jules: Sessions unchanged, skipping notifications.");
            }

            // --- Update previous states after all checks ---
            // We always run this to check PR status for completed sessions (external state)
            const statesChanged = await this.sessionStateManager.updatePreviousStates(allSessionsMapped);

            // --- Update the cache ---
            this.sessionsCache = allSessionsMapped;
            if (isBackground) {
                // Errors are handled inside _refreshBranchCacheInBackground, so we call it fire-and-forget.
                void this._refreshBranchCacheInBackground(apiKey);
            }

            // Only fire event if meaningful change occurred
            if (sessionsChanged || statesChanged) {
                this._onDidChangeTreeData.fire();
            } else {
                this.logChannel.appendLine("Jules: No view updates required.");
            }
        } catch (error) {
            this.logChannel.appendLine(`Jules: Error during fetchAndProcessSessions: ${error}`);
            // Retain cache on error to avoid losing data
        } finally {
            this.isFetching = false;
            this.logChannel.appendLine("Jules: Finished fetching and processing sessions.");
        }
    }

    private async _refreshBranchCacheInBackground(apiKey: string): Promise<void> {
        const selectedSource = this.context.globalState.get<SourceType>("selected-source");
        if (!selectedSource) {
            return;
        }

        console.log(`Jules: Background refresh, updating branches for ${selectedSource.name}`);
        try {
            const apiClient = new JulesApiClient(apiKey, JULES_API_BASE_URL);
            // Use forceRefresh: false to respect the cache TTL (5 min).
            await getBranchesForSession(selectedSource, apiClient, JulesSessionsProvider.silentOutputChannel, this.context, { forceRefresh: false, showProgress: false });
            console.log("Jules: Branch cache updated successfully during background refresh");
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Jules: Failed to update branch cache during background refresh for ${selectedSource.name}: ${errorMessage}`);
        }
    }

    async refresh(isBackground: boolean = false): Promise<void> {
        console.log(
            `Jules: refresh() called (isBackground: ${isBackground}), starting fetch.`
        );
        await this.fetchAndProcessSessions(isBackground);
    }

    private processSessionNotifications(
        sessions: Session[],
        state: string,
        notifier: (session: Session) => Promise<void>,
        notificationType: string
    ) {
        const sessionsToNotify = this.sessionStateManager.checkForSessionsInState(sessions, state);
        if (sessionsToNotify.length > 0) {
            this.logChannel.appendLine(
                `Jules: Found ${sessionsToNotify.length} sessions awaiting ${notificationType}`
            );
            for (const session of sessionsToNotify) {
                if (!this.sessionStateManager.isNotified(session.name)) {
                    notifier(session).catch((error) => {
                        this.logChannel.appendLine(
                            `Jules: Failed to show ${notificationType} notification for session '${session.name}' (${sanitizeForLogging(session.title)}): ${error}`
                        );
                    });
                    this.sessionStateManager.markAsNotified(session.name);
                }
            }
        }
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) {
            return [];
        }

        // If the cache is empty, it might be the first load.
        if (this.sessionsCache.length === 0 && !this.isFetching) {
            await this.fetchAndProcessSessions();
        }

        const selectedSource =
            this.context.globalState.get<SourceType>("selected-source");

        if (!selectedSource) {
            return [];
        }

        // Now, use the cache to build the tree
        let filteredSessions = this.sessionsCache.filter(
            (session) =>
                (session as any).sourceContext?.source === selectedSource.name
        );

        console.log(
            `Jules: Found ${filteredSessions.length} sessions for the selected source from cache`
        );

        // Filter out sessions with closed PRs if the setting is enabled
        const hideClosedPRs = vscode.workspace
            .getConfiguration("jules-extension")
            .get<boolean>("hideClosedPRSessions", true);

        if (hideClosedPRs) {
            const beforeFilterCount = filteredSessions.length;
            filteredSessions = filteredSessions.filter((session) => {
                const prevState = this.sessionStateManager.getPreviousState(session.name);
                // Hide if the session is marked as terminated.
                return !prevState?.isTerminated;
            });
            const filteredCount = beforeFilterCount - filteredSessions.length;
            if (filteredCount > 0) {
                console.log(
                    `Jules: Filtered out ${filteredCount} terminated sessions (${beforeFilterCount} -> ${filteredSessions.length})`
                );
            }
        }

        if (filteredSessions.length === 0) {
            return [];
        }

        return filteredSessions.map((session) => new SessionTreeItem(session, selectedSource));
    }

    // Auto Refresh Logic
    public startAutoRefresh(): void {
        const config = vscode.workspace.getConfiguration(
            "jules-extension.autoRefresh"
        );
        const isEnabled = config.get<boolean>("enabled");

        // 動的に間隔を選択
        const intervalSeconds = this.isFetchingSensitiveData
            ? config.get<number>("fastInterval", 30)
            : config.get<number>("interval", 60);
        const interval = intervalSeconds * 1000;

        this.logChannel.appendLine(
            `Jules: Auto-refresh enabled=${isEnabled}, interval=${intervalSeconds}s (${interval}ms), fastMode=${this.isFetchingSensitiveData}`
        );

        if (!isEnabled) {
            return;
        }

        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }

        this.autoRefreshInterval = setInterval(() => {
            this.logChannel.appendLine("Jules: Auto-refresh triggered");
            this.refresh(true); // Pass true for background refresh
        }, interval);
    }

    public stopAutoRefresh(): void {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = undefined;
        }
    }

    public resetAutoRefresh(): void {
        this.stopAutoRefresh();
        this.startAutoRefresh();
    }

    public dispose(): void {
        this.stopAutoRefresh();
    }
}
