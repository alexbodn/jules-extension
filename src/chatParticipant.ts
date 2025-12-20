import * as vscode from 'vscode';
import { fetchWithTimeout } from './fetchUtils';

const PARTICIPANT_ID = 'julius-extension.julius';
const JULIUS_API_BASE_URL = "https://julius.googleapis.com/v1alpha";

interface Activity {
  name: string;
  createTime: string;
  originator: "user" | "agent";
  id: string;
  type?: string;
  userPrompt?: { text: string };
  thought?: { text: string };
  planGenerated?: { plan: { steps?: { description: string }[] } };
  outputGenerated?: { output: string };
}

interface Session {
  name: string;
  title: string;
  state: string;
}

interface SessionsResponse {
  sessions: Session[];
}

interface ActivitiesResponse {
  activities: Activity[];
}

export function registerChatParticipant(context: vscode.ExtensionContext): void {
  const participant = vscode.chat.createChatParticipant(
    PARTICIPANT_ID,
    (request, chatContext, stream, token) => 
      chatHandler(request, chatContext, stream, token, context)
  );
  
  context.subscriptions.push(participant);
}

async function chatHandler(
  request: vscode.ChatRequest,
  chatContext: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  extensionContext: vscode.ExtensionContext
): Promise<vscode.ChatResult> {
  
  const apiKey = await extensionContext.secrets.get('julius-api-key');
  if (!apiKey) {
    stream.markdown('⚠️ API Keyが設定されていません。\n\n');
    stream.markdown('コマンドパレットから **Jules: Set Jules API Key** を実行してください。');
    return { metadata: { command: '' } };
  }
  
  switch (request.command) {
    case 'list':
      return handleListCommand(stream, apiKey);
    case 'session':
      return handleSessionCommand(request.prompt, stream, apiKey);
    default:
      return handleDefaultChat(request.prompt, stream, apiKey);
  }
}

async function handleListCommand(
  stream: vscode.ChatResponseStream,
  apiKey: string
): Promise<vscode.ChatResult> {
  stream.progress('セッション一覧を取得中...');
  
  try {
    const response = await fetchWithTimeout(`${JULIUS_API_BASE_URL}/sessions`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.status}`);
    }

    const data = (await response.json()) as SessionsResponse;
    const sessions = data.sessions || [];
    
    if (!sessions || sessions.length === 0) {
      stream.markdown('📭 セッションがありません。');
      return { metadata: { command: 'list' } };
    }
    
    stream.markdown('## Julius セッション一覧\n\n');
    
    for (const session of sessions) {
      const icon = getStateIcon(session.state);
      stream.markdown(`${icon} **${session.title || 'Untitled'}**\n`);
      stream.markdown(`   \`${session.name}\`\n\n`);
    }
    
    stream.markdown('\n💡 \`/session <id>\` で詳細を表示');
    
  } catch (error) {
    stream.markdown(`❌ エラー: ${error}`);
  }
  
  return { metadata: { command: 'list' } };
}

async function handleSessionCommand(
  sessionId: string,
  stream: vscode.ChatResponseStream,
  apiKey: string
): Promise<vscode.ChatResult> {
  const id = sessionId.trim();
  
  if (!id) {
    stream.markdown('⚠️ セッションIDを指定してください。\n\n');
    stream.markdown('例: \`/session sources/xxx/sessions/yyy\`');
    return { metadata: { command: 'session' } };
  }
  
  stream.progress('セッション情報を取得中...');
  
  try {
    const response = await fetchWithTimeout(`${JULIUS_API_BASE_URL}/${id}/activities`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch activities: ${response.status}`);
    }

    const data = (await response.json()) as ActivitiesResponse;
    const activities = data.activities || [];
    
    stream.markdown(`## セッション詳細\n\n`);
    stream.markdown(`**ID**: \`${id}\`\n\n`);
    stream.markdown('---\n\n');
    
    if (!activities || activities.length === 0) {
      stream.markdown('📭 アクティビティがありません。');
    } else {
      for (const activity of activities) {
        renderActivity(activity, stream);
      }
    }
    
  } catch (error) {
    stream.markdown(`❌ エラー: ${error}`);
  }
  
  return { metadata: { command: 'session' } };
}

async function handleDefaultChat(
  prompt: string,
  stream: vscode.ChatResponseStream,
  apiKey: string
): Promise<vscode.ChatResult> {
  stream.progress('処理中...');
  
  try {
    const response = await fetchWithTimeout(`${JULIUS_API_BASE_URL}/sessions`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.status}`);
    }

    const data = (await response.json()) as SessionsResponse;
    const sessions = data.sessions || [];
    const activeSession = sessions.find((s: Session) => s.state === 'RUNNING');
    
    if (activeSession) {
      const sendResponse = await fetchWithTimeout(`${JULIUS_API_BASE_URL}/${activeSession.name}:sendMessage`, {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!sendResponse.ok) {
        throw new Error(`Failed to send message: ${sendResponse.status}`);
      }

      stream.markdown('✅ メッセージを送信しました！\n\n');
      stream.markdown(`**セッション**: ${activeSession.title}\n`);
      stream.markdown(`💡 \`/session ${activeSession.name}\` で履歴確認`);
    } else {
      stream.markdown('⚠️ アクティブなセッションがありません。\n\n');
      stream.markdown('Julius Web UIから新しいタスクを開始してください。');
    }
    
  } catch (error) {
    stream.markdown(`❌ エラー: ${error}`);
  }
  
  return { metadata: { command: '' } };
}

function getStateIcon(state: string): string {
  switch (state) {
    case 'RUNNING': return '🔄';
    case 'COMPLETED': return '✅';
    case 'FAILED': return '❌';
    default: return '📄';
  }
}

function renderActivity(activity: Activity, stream: vscode.ChatResponseStream): void {
  const time = new Date(activity.createTime).toLocaleString('ja-JP');
  
  if (activity.userPrompt?.text) {
    stream.markdown(`### 👤 User (${time})\n`);
    stream.markdown(`${activity.userPrompt.text}\n\n`);
  }
  
  if (activity.thought?.text) {
    stream.markdown(`### 🤔 Thought\n`);
    stream.markdown(`${activity.thought.text}\n\n`);
  }
  
  if (activity.planGenerated?.plan) {
    stream.markdown(`### 📋 Plan\n`);
    const steps = activity.planGenerated.plan.steps || [];
    for (const step of steps) {
      stream.markdown(`- ${step.description}\n`);
    }
    stream.markdown('\n');
  }
  
  if (activity.outputGenerated?.output) {
    stream.markdown(`### 📤 Output\n`);
    stream.markdown('```\n');
    stream.markdown(activity.outputGenerated.output);
    stream.markdown('\n```\n\n');
  }
}
