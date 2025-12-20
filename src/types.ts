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

export interface Activity {
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
