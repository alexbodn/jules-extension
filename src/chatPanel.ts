import * as vscode from 'vscode';
import { Session, Activity } from './types';
import { JulesApiClient } from './julesApiClient';
import { getStoredApiKey, JULES_API_BASE_URL } from './extension';

/**
 * Open a chat webview for a session, render the provided activities, and keep the view synchronized with remote activity updates.
 *
 * The panel polls the Jules API (when an API key is stored) for activity updates every 5 seconds while visible, forwards updates to the webview, and handles messages from the webview to send user messages or trigger plan approval. The polling interval is cleared when the panel is disposed.
 *
 * @param session - The session to display (used for panel title and API requests)
 * @param activities - Initial list of activities to render in the chat panel
 */
export async function showChatPanel(
    context: vscode.ExtensionContext,
    session: Session,
    activities: Activity[]
) {
    const panel = vscode.window.createWebviewPanel(
        'julesChatPanel',
        `Session: ${session.title}`,
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [context.extensionUri]
        }
    );

    panel.webview.html = getChatPanelHtml(panel.webview, context.extensionUri, session, activities);

    const apiKey = await getStoredApiKey(context);
    const client = apiKey ? new JulesApiClient(apiKey, JULES_API_BASE_URL) : undefined;

    const pollInterval = setInterval(async () => {
        if (!client || !panel.visible) {
            return;
        }
        try {
            const updatedActivities = await client.getActivities(session.name);
            panel.webview.postMessage({
                command: 'updateActivities',
                activities: updatedActivities
            });
        } catch (error) {
            console.error('Failed to poll activities:', error);
        }
    }, 5000);

    panel.onDidDispose(() => {
        clearInterval(pollInterval);
    }, null, context.subscriptions);

    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    const apiKey = await getStoredApiKey(context);
                    if (!apiKey) {
                        return;
                    }
                    const client = new JulesApiClient(apiKey, JULES_API_BASE_URL);
                    try {
                        await client.sendMessage(session.name, message.text);
                        // Optimistic update or refresh will be handled in Phase 3
                        vscode.window.showInformationMessage('Message sent');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to send message: ${error}`);
                    }
                    break;
                case 'approvePlan':
                    vscode.commands.executeCommand('jules-extension.approvePlan');
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

/**
 * Generate the HTML content used for the Jules chat webview panel.
 *
 * @param webview - The VS Code webview instance used to construct CSP sources.
 * @param extensionUri - The extension's URI (used to resolve local resources if needed).
 * @param session - The session metadata used to personalize the panel (e.g., title).
 * @param initialActivities - The initial list of activities to render in the chat timeline.
 * @returns The complete HTML string to set as the webview's content for the chat panel.
 */
function getChatPanelHtml(webview: vscode.Webview, extensionUri: vscode.Uri, session: Session, initialActivities: Activity[]): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        <style>
            body {
                font-family: var(--vscode-font-family);
                padding: 0;
                display: flex;
                flex-direction: column;
                height: 100vh;
                color: var(--vscode-editor-foreground);
                background-color: var(--vscode-editor-background);
                box-sizing: border-box;
            }
            #activity-list {
                flex: 1;
                overflow-y: auto;
                padding: 10px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .activity-item {
                padding: 8px 12px;
                border-radius: 4px;
                max-width: 85%;
                word-wrap: break-word;
            }
            .activity-user {
                align-self: flex-end;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
            .activity-bot {
                align-self: flex-start;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
            }
            .activity-header {
                font-size: 0.8em;
                margin-bottom: 4px;
                opacity: 0.8;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .activity-content {
                white-space: pre-wrap;
            }
            .plan-container {
                margin-top: 10px;
                padding: 10px;
                background-color: var(--vscode-welcomePage-tileBackground);
                border: 1px solid var(--vscode-welcomePage-tileBorder);
                border-radius: 4px;
            }
            .plan-step {
                margin: 5px 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .step-status {
                font-size: 1.2em;
            }
            #input-container {
                padding: 10px;
                border-top: 1px solid var(--vscode-panel-border);
                display: flex;
                gap: 8px;
            }
            #message-input {
                flex: 1;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                padding: 6px;
                border-radius: 2px;
            }
            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 6px 12px;
                cursor: pointer;
                border-radius: 2px;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            .approve-button {
                margin-top: 10px;
                width: 100%;
                background-color: var(--vscode-statusBarItem-remoteBackground);
            }
        </style>
    </head>
    <body>
        <div id="activity-list"></div>
        <div id="input-container">
            <input type="text" id="message-input" placeholder="Type a message..." />
            <button id="send-button">Send</button>
        </div>

        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const activityList = document.getElementById('activity-list');
            const messageInput = document.getElementById('message-input');
            const sendButton = document.getElementById('send-button');

            let currentActivities = ${JSON.stringify(initialActivities)};

            function getActivityIcon(activity) {
                if (activity.planGenerated) return '📝';
                if (activity.planApproved) return '👍';
                if (activity.progressUpdated) return '🔄';
                if (activity.sessionCompleted) return '✅';
                return '🤖';
            }

            function renderActivities(activities) {
                activityList.innerHTML = '';
                activities.forEach(activity => {
                    const isAgent = activity.originator === 'agent';
                    const item = document.createElement('div');
                    item.className = 'activity-item ' + (isAgent ? 'activity-bot' : 'activity-user');
                    
                    const header = document.createElement('div');
                    header.className = 'activity-header';
                    header.innerHTML = \`<span>\${getActivityIcon(activity)}</span> <span>\${new Date(activity.createTime).toLocaleTimeString()}</span>\`;
                    item.appendChild(header);

                    const content = document.createElement('div');
                    content.className = 'activity-content';
                    
                    if (activity.userPrompt) {
                        content.textContent = activity.userPrompt.text;
                    } else if (activity.thought) {
                        content.innerHTML = \`<em>Thought: \${activity.thought.text}</em>\`;
                    } else if (activity.planGenerated) {
                        content.innerHTML = \`
                            <strong>Plan generated: \${activity.planGenerated.plan?.title || 'Plan'}</strong>
                            <ul>
                                \${activity.planGenerated.plan?.steps?.map(step => \`<li>\${step.description}</li>\`).join('') || ''}
                            </ul>
                        \`;
                        if (activity.planGenerated.plan?.state === 'PROPOSED') {
                            const approveBtn = document.createElement('button');
                            approveBtn.className = 'approve-button';
                            approveBtn.textContent = 'Approve Plan';
                            approveBtn.onclick = () => vscode.postMessage({ command: 'approvePlan' });
                            content.appendChild(approveBtn);
                        }
                    } else if (activity.planApproved) {
                        content.textContent = \`Plan approved: \${activity.planApproved.planId}\`;
                    } else if (activity.progressUpdated) {
                        content.innerHTML = \`
                            <strong>\${activity.progressUpdated.title}</strong>
                            \${activity.progressUpdated.description ? \`<p>\${activity.progressUpdated.description}</p>\` : ''}
                        \`;
                    } else if (activity.outputGenerated) {
                        content.innerHTML = \`<strong>Output:</strong><br>\${activity.outputGenerated.output}\`;
                    } else if (activity.sessionCompleted) {
                        content.textContent = 'Session completed';
                    } else {
                        content.textContent = 'Unknown activity';
                    }

                    item.appendChild(content);
                    activityList.appendChild(item);
                });
                activityList.scrollTop = activityList.scrollHeight;
            }

            renderActivities(currentActivities);

            sendButton.addEventListener('click', () => {
                const text = messageInput.value.trim();
                if (text) {
                    sendButton.disabled = true;
                    messageInput.disabled = true;
                    vscode.postMessage({ command: 'sendMessage', text });
                    messageInput.value = '';
                    // Re-enable after a short delay or when update received
                    setTimeout(() => {
                        sendButton.disabled = false;
                        messageInput.disabled = false;
                        messageInput.focus();
                    }, 1000);
                }
            });

            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendButton.click();
                }
            });

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'updateActivities':
                        if (JSON.stringify(message.activities) !== JSON.stringify(currentActivities)) {
                            currentActivities = message.activities;
                            renderActivities(currentActivities);
                        }
                        break;
                }
            });
        </script>
    </body>
    </html>`;
}

/**
 * Generates a 32-character alphanumeric nonce suitable for use in CSP nonces and similar contexts.
 *
 * @returns A 32-character string containing uppercase letters, lowercase letters, and digits.
 */
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}