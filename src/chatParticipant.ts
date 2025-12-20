import * as vscode from 'vscode';
import { JulesApiClient } from './julesApiClient';
import { Session, Activity } from './types';

// Chat Participant IDはpackage.jsonと一致させる
const PARTICIPANT_ID = 'jules-extension.jules';
const BASE_URL = 'https://jules.secure.googleapis.com/v1alpha';

/**
 * Chat Participantを登録
 */
export function registerChatParticipant(context: vscode.ExtensionContext): void {
    const participant = vscode.chat.createChatParticipant(
        PARTICIPANT_ID,
        (request, chatContext, stream, token) => chatHandler(request, chatContext, stream, token, context)
    );
    
    // アイコン設定（icon.pngがある場合）
    const iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
    participant.iconPath = iconPath;
    
    context.subscriptions.push(participant);
}

/**
 * メインのチャットハンドラ
 */
async function chatHandler(
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    extensionContext: vscode.ExtensionContext
): Promise<vscode.ChatResult> {
    
    // API Keyの取得
    const apiKey = await extensionContext.secrets.get('julius-api-key');
    if (!apiKey) {
        stream.markdown('⚠️ API Keyが設定されていません。\n\n');
        stream.markdown('設定から `jules-extension.apiKey` を設定するか、コマンドパレットから **Jules: Set Jules API Key** を実行してください。');
        return { metadata: { command: '' } };
    }
    
    const client = new JulesApiClient(apiKey, BASE_URL);
    
    // コマンド処理
    if (request.command === 'list') {
        return handleListCommand(stream, client, token);
    }
    
    if (request.command === 'session') {
        return handleSessionCommand(request, stream, client, token);
    }
    
    // デフォルト: メッセージ送信
    return handleDefaultChat(request.prompt, stream, client, token);
}

/**
 * セッション一覧表示コマンド
 */
async function handleListCommand(
    stream: vscode.ChatResponseStream,
    client: JulesApiClient,
    token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
    
    stream.progress('セッション一覧を取得中...');
    
    try {
        // ソース一覧を取得
        const sourcesResponse = await client.request<{ sources: any[] }>('/sources');
        const sources = sourcesResponse.sources || [];
        
        if (sources.length === 0) {
            stream.markdown('ソースが見つかりません。Jules Web UIからソースを作成してください。');
            return { metadata: { command: 'list' } };
        }
        
        stream.markdown('## Jules セッション一覧\n\n');
        
        // 各ソースのセッションを取得
        for (const source of sources) {
            const sourceData = await client.getSource(source.name);
            const sessions = sourceData.sessions || [];
            
            if (sessions.length > 0) {
                stream.markdown(`### 📁 ${source.displayName || source.name}\n\n`);
                
                for (const session of sessions) {
                    const stateIcon = getSessionStateIcon(session.state);
                    const sessionTitle = session.title || 'Untitled';
                    stream.markdown(`${stateIcon} **${sessionTitle}**\n`);
                    stream.markdown(`   ID: \`${session.name}\`\n`);
                    if (session.url) {
                        stream.markdown(`   🔗 [Web UIで開く](${session.url})\n`);
                    }
                    stream.markdown('\n');
                }
            }
        }
        
        stream.markdown('\n💡 **ヒント**: `/session <session-id>` でセッションの詳細を表示できます。');
        
    } catch (error) {
        stream.markdown(`❌ エラー: ${error}`);
    }
    
    return { metadata: { command: 'list' } };
}

/**
 * 特定セッションの詳細・履歴表示コマンド
 */
async function handleSessionCommand(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    client: JulesApiClient,
    token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
    
    const sessionId = request.prompt.trim();
    
    if (!sessionId) {
        stream.markdown('⚠️ セッションIDを指定してください。\n\n');
        stream.markdown('**使用例**: `/session sources/xxx/sessions/yyy`');
        return { metadata: { command: 'session' } };
    }
    
    stream.progress('セッション情報を取得中...');
    
    try {
        // セッション情報を取得
        const session = await client.getSession(sessionId);
        const activities = await client.getActivities(sessionId);
        
        // セッションヘッダー
        stream.markdown(`## ${getSessionStateIcon(session.state)} ${session.title || 'Untitled Session'}\n\n`);
        stream.markdown(`**状態**: ${translateState(session.state)}\n`);
        stream.markdown(`**ID**: \`${session.name}\`\n`);
        if (session.url) {
            stream.markdown(`**リンク**: [Web UIで開く](${session.url})\n`);
        }
        stream.markdown('\n---\n\n');
        
        // アクティビティ履歴
        if (activities.length === 0) {
            stream.markdown('📭 アクティビティがありません。\n');
        } else {
            stream.markdown(`## アクティビティ履歴 (${activities.length}件)\n\n`);
            
            for (const activity of activities) {
                renderActivity(activity, stream);
            }
        }
        
        // フッター
        stream.markdown('\n---\n');
        stream.markdown('💡 **ヒント**: このセッションにメッセージを送信するには、`@jules <メッセージ>` と入力してください。');
        
    } catch (error) {
        stream.markdown(`❌ エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return { metadata: { command: 'session' } };
}

/**
 * Activity をチャットレスポンスとしてレンダリング
 */
function renderActivity(activity: Activity, stream: vscode.ChatResponseStream): void {
    const timestamp = new Date(activity.createTime).toLocaleString('ja-JP');
    
    // User Prompt
    if (activity.userPrompt) {
        stream.markdown(`### 👤 ユーザー (${timestamp})\n`);
        stream.markdown(`${activity.userPrompt.text}\n\n`);
    }
    
    // Thought
    if (activity.thought) {
        stream.markdown(`### 🤔 思考プロセス\n`);
        stream.markdown(`${activity.thought.text}\n\n`);
    }
    
    // Plan
    if (activity.planGenerated?.plan) {
        stream.markdown(`### 📋 プラン生成\n`);
        const plan = activity.planGenerated.plan;
        if (plan.title) {
            stream.markdown(`**${plan.title}**\n\n`);
        }
        if (plan.steps && plan.steps.length > 0) {
            for (let i = 0; i < plan.steps.length; i++) {
                const step = plan.steps[i];
                stream.markdown(`${i + 1}. ${step.description}\n`);
            }
        }
        stream.markdown('\n');
    }
    
    // Plan Approved
    if (activity.planApproved) {
        stream.markdown(`### ✅ プラン承認\n`);
        stream.markdown(`プランID: \`${activity.planApproved.planId}\`\n\n`);
    }
    
    // Progress Update
    if (activity.progressUpdated) {
        stream.markdown(`### ⚙️ 進捗更新\n`);
        stream.markdown(`**${activity.progressUpdated.title}**\n`);
        if (activity.progressUpdated.description) {
            stream.markdown(`${activity.progressUpdated.description}\n`);
        }
        stream.markdown('\n');
    }
    
    // Output
    if (activity.outputGenerated) {
        stream.markdown(`### 📤 出力\n`);
        stream.markdown('```\n');
        stream.markdown(activity.outputGenerated.output);
        stream.markdown('\n```\n\n');
    }
    
    // Session Completed
    if (activity.sessionCompleted) {
        stream.markdown(`### 🎉 セッション完了 (${timestamp})\n\n`);
    }
}

/**
 * デフォルトチャット処理（メッセージ送信）
 */
async function handleDefaultChat(
    prompt: string,
    stream: vscode.ChatResponseStream,
    client: JulesApiClient,
    token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
    
    stream.progress('セッション情報を取得中...');
    
    try {
        // すべてのソースからアクティブなセッションを検索
        const sourcesResponse = await client.request<{ sources: any[] }>('/sources');
        const sources = sourcesResponse.sources || [];
        
        let activeSession: Session | null = null;
        
        for (const source of sources) {
            const sourceData = await client.getSource(source.name);
            const sessions = sourceData.sessions || [];
            
            // 最初のRUNNINGセッションを使用
            const runningSession = sessions.find((s: Session) => s.state === 'RUNNING');
            if (runningSession) {
                activeSession = runningSession;
                break;
            }
        }
        
        if (activeSession) {
            stream.progress('メッセージを送信中...');
            
            // カスタムプロンプトを前置
            const customPrompt = vscode.workspace.getConfiguration('jules-extension').get<string>('customPrompt');
            const finalPrompt = customPrompt ? `${customPrompt}\n\n${prompt}` : prompt;
            
            await client.sendMessage(activeSession.name, finalPrompt);
            
            stream.markdown(`✅ メッセージを送信しました！\n\n`);
            stream.markdown(`**セッション**: ${activeSession.title}\n`);
            stream.markdown(`**ID**: \`${activeSession.name}\`\n\n`);
            stream.markdown(`💡 **ヒント**: \`@jules /session ${activeSession.name}\` で履歴を確認できます。`);
            
        } else {
            stream.markdown('⚠️ アクティブな（実行中の）セッションが見つかりません。\n\n');
            stream.markdown('Jules Web UIまたはGitHub Issueから新しいタスクを開始してください。\n\n');
            stream.markdown('📝 **参考**: `/list` でセッション一覧を表示できます。');
        }
        
    } catch (error) {
        stream.markdown(`❌ エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return { metadata: { command: '' } };
}

/**
 * ユーティリティ: セッション状態アイコン
 */
function getSessionStateIcon(state: string): string {
    switch (state) {
        case 'RUNNING':
            return '🔄';
        case 'COMPLETED':
            return '✅';
        case 'FAILED':
            return '❌';
        case 'CANCELLED':
            return '🚫';
        default:
            return '📄';
    }
}

/**
 * ユーティリティ: セッション状態の日本語訳
 */
function translateState(state: string): string {
    switch (state) {
        case 'RUNNING':
            return '実行中';
        case 'COMPLETED':
            return '完了';
        case 'FAILED':
            return '失敗';
        case 'CANCELLED':
            return 'キャンセル';
        default:
            return state;
    }
}
