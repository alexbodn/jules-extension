export interface GitHubBranch {
    displayName: string;
}

export interface GitHubRepo {
    owner: string;
    repo: string;
    isPrivate: boolean;
    defaultBranch: GitHubBranch;
    branches: GitHubBranch[];
}

export interface Source {
    name: string;
    id: string;
    url?: string;
    description?: string;
    githubRepo?: GitHubRepo;
}

export interface SourcesResponse {
    sources: Source[];
}

/**
 * Artifact types for Jules API Activity
 */

/** Base artifact interface */
export interface BaseArtifact {
    type: string;
    [key: string]: unknown;
}

/** Media artifact - スクリーンショットなどの画像 */
export interface MediaArtifact extends BaseArtifact {
    type: 'media';
    /** MIMEタイプ (例: 'image/png', 'image/jpeg') */
    mimeType: string;
    /** Base64エンコードされた画像データ */
    data: string;
    /** オプションのファイル名 */
    filename?: string;
    /** オプションの説明 */
    description?: string;
}

/** ChangeSet artifact - Git Patch形式のコード変更 */
export interface ChangeSetArtifact extends BaseArtifact {
    type: 'changeSet';
    /** Git Patch形式の差分 */
    unidiffPatch: string;
    /** 推奨コミットメッセージ */
    suggestedCommitMessage?: string;
    /** ベースコミットID */
    baseCommitId?: string;
}

/** BashOutput artifact - コマンド実行結果 */
export interface BashOutputArtifact extends BaseArtifact {
    type: 'bashOutput';
    /** 実行されたコマンド */
    command: string;
    /** コマンドの出力 */
    output: string;
    /** 終了コード */
    exitCode: number;
}

/** Artifact union type */
export type Artifact = MediaArtifact | ChangeSetArtifact | BashOutputArtifact | BaseArtifact;

/** Activity with artifacts */
export interface Activity {
    name: string;
    createTime: string;
    originator: 'user' | 'agent';
    id: string;
    type?: string;
    planGenerated?: { plan: Plan };
    planApproved?: { planId: string };
    progressUpdated?: { title: string; description?: string };
    sessionCompleted?: Record<string, never>;
    /** Artifacts associated with this activity */
    artifacts?: Artifact[];
}

export interface Plan {
    title?: string;
    steps?: string[];
}

export interface ActivitiesResponse {
    activities: Activity[];
}
