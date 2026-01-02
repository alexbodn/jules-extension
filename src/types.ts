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
    isPrivate?: boolean;
}

export interface SourcesResponse {
    sources: Source[];
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

export interface SessionResponse {
    name: string;
    // Add other fields if needed
}

export interface SessionState {
    name: string;
    state: string;
    rawState: string;
    outputs?: SessionOutput[];
    isTerminated?: boolean;
}

// Plan notification display constants
export const MAX_PLAN_STEPS_IN_NOTIFICATION = 5;
export const MAX_PLAN_STEP_LENGTH = 80;

export interface PlanStep {
    description: string;
}

export interface Plan {
    title?: string;
    steps?: PlanStep[];
}

export interface Activity {
    name: string;
    createTime: string;
    originator: "user" | "agent";
    id: string;
    type?: string;
    planGenerated?: { plan: Plan };
    planApproved?: { planId: string };
    progressUpdated?: { title: string; description?: string };
    sessionCompleted?: Record<string, never>;
}

export interface ActivitiesResponse {
    activities: Activity[];
}

export interface SessionsResponse {
    sessions: Session[];
}

// GitHub PR status cache to avoid excessive API calls
export interface PRStatusCache {
    [prUrl: string]: {
        isClosed: boolean;
        lastChecked: number;
    };
}
