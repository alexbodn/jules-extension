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

export interface PlanStep {
    description: string;
}

export interface Plan {
    title?: string;
    steps?: PlanStep[];
    state?: string;
}

export interface Activity {
    name: string;
    createTime: string;
    originator: "user" | "agent";
    id: string;
    type?: string;
    userPrompt?: { text: string };
    thought?: { text: string };
    planGenerated?: { plan: Plan };
    planApproved?: { planId: string };
    progressUpdated?: { title: string; description?: string };
    outputGenerated?: { output: string };
    sessionCompleted?: Record<string, never>;
}

export interface ActivitiesResponse {
    activities: Activity[];
}

export interface SessionOutput {
    pullRequest?: {
        url: string;
        title: string;
        description: string;
    };
}

export interface Session {
    name: string;
    title: string;
    state: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
    rawState: string;
    url?: string;
    outputs?: SessionOutput[];
    sourceContext?: {
        source: string;
    };
    requirePlanApproval?: boolean;
}
