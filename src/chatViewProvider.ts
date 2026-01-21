import * as vscode from 'vscode';
import MarkdownIt = require('markdown-it');
import { Activity, Session } from './types';
import { JulesApiClient } from './julesApiClient';

export class JulesChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'julesChatView';

    private _view?: vscode.WebviewView;
    private _md = new MarkdownIt();

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
        private readonly _apiClientFactory: (apiKey: string) => JulesApiClient
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage': {
                    await this._handleSendMessage(data.text);
                    break;
                }
                case 'checkoutBranch': {
                    await vscode.commands.executeCommand('jules-extension.checkoutBranch', this._currentSessionId);
                    break;
                }
                case 'closeSession': {
                    this._currentSessionId = undefined;
                    break;
                }
            }
        });
    }

    private _currentSessionId?: string;

    public async updateSession(session: Session, activities: Activity[]) {
        if (!this._view) {
            return;
        }

        this._currentSessionId = session.name;
        const processedActivities = activities.map(a => this._processActivity(a));

        await this._view.webview.postMessage({
            type: 'updateSession',
            session: {
                name: session.name,
                title: session.title,
                state: session.state
            },
            activities: processedActivities
        });
    }

    public clearSession() {
        this._currentSessionId = undefined;
        if (this._view) {
            this._view.webview.postMessage({ type: 'clearSession' });
        }
    }

    public reset() {
        this._currentSessionId = undefined;
        if (this._view) {
            this._view.webview.postMessage({ type: 'reset' });
        }
    }

    private async _handleSendMessage(text: string) {
        if (!text.trim()) return;

        if (this._currentSessionId) {
             try {
                const apiKey = await this._context.secrets.get("jules-api-key");
                if (!apiKey) {
                    vscode.window.showErrorMessage("API Key not found.");
                    return;
                }
                const client = this._apiClientFactory(apiKey);

                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'appendActivity',
                        activity: this._processActivity({
                            name: 'pending',
                            createTime: new Date().toISOString(),
                            originator: 'user',
                            id: 'pending-' + Date.now(),
                        }, text)
                    });
                }

                await client.sendMessage(this._currentSessionId, text);
                await vscode.commands.executeCommand('jules-extension.refreshActivities');

            } catch (e: any) {
                vscode.window.showErrorMessage(`Failed to send message: ${e.message}`);
            }
        } else {
             vscode.window.showInformationMessage("Please create or select a session first.");
        }
    }

    private _processActivity(activity: Activity, overrideText?: string): any {
        let content = '';
        let type = 'info';
        let icon = 'ℹ️';

        if (overrideText) {
             content = overrideText;
             type = 'user-message';
             icon = '👤';
        } else if (activity.planGenerated) {
            content = `**Plan Generated:** ${activity.planGenerated.plan?.title || 'Plan'}`;
            type = 'plan';
            icon = '📝';
        } else if (activity.planApproved) {
            content = `Plan approved: ${activity.planApproved.planId}`;
            type = 'info';
            icon = '👍';
        } else if (activity.progressUpdated) {
            content = `**Progress:** ${activity.progressUpdated.title}`;
            if (activity.progressUpdated.description) {
                content += `\n\n${activity.progressUpdated.description}`;
            }
            type = 'progress';
            icon = '🔄';
        } else if (activity.sessionCompleted) {
            content = 'Session completed';
            type = 'success';
            icon = '✅';
        } else {
            content = 'Unknown activity';
        }

        const renderedContent = this._md.render(content);

        return {
            ...activity,
            renderedContent,
            displayType: type,
            icon
        };
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <link href="${styleMainUri}" rel="stylesheet">
                <title>Jules Chat</title>
            </head>
            <body>
                <div id="app">
                    <div id="sidebar">
                        <!-- Session icons will be injected here -->
                    </div>
                    <div id="main-chat">
                        <div id="header" class="hidden">
                            <div class="title-container">
                                <span id="session-title">Session Title</span>
                            </div>
                            <div class="actions">
                                <button id="checkout-btn" title="Checkout Branch" class="icon-btn">
                                    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M7 10h1v1H7v-1zM7 8h1v1H7V8z"/><path d="M12.5 14H10v-1h2.5a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 1-.5-.5V3.707l1.146 1.147.708-.708L4 1.293 1.146 4.146l.708.708L3 3.707V7.5a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 1 13 10.5v3a1.5 1.5 0 0 1-1.5 1.5z"/></svg>
                                </button>
                                <button id="close-btn" title="Close Session" class="icon-btn">
                                    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.647.707.708L8 8.707z"/></svg>
                                </button>
                            </div>
                        </div>

                        <div id="messages">
                            <div class="welcome-message">
                                Select a session from the side bar or the "Jules Sessions" view to start chatting.
                            </div>
                        </div>

                        <div id="input-area">
                            <textarea id="message-input" placeholder="Ask Jules..."></textarea>
                            <button id="send-btn">Send</button>
                        </div>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
