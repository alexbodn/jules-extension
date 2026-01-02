import { Source, Session, SessionState, SessionOutput, Activity, Plan } from './types';
import { MAX_PLAN_STEPS_IN_NOTIFICATION, MAX_PLAN_STEP_LENGTH, PlanStep } from './types';
import * as vscode from 'vscode';

export function mapApiStateToSessionState(
    apiState: string
): "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" {
    switch (apiState) {
        case "PLANNING":
        case "AWAITING_PLAN_APPROVAL":
        case "AWAITING_USER_FEEDBACK":
        case "IN_PROGRESS":
        case "QUEUED":
        case "STATE_UNSPECIFIED":
            return "RUNNING";
        case "COMPLETED":
            return "COMPLETED";
        case "FAILED":
            return "FAILED";
        case "PAUSED":
        case "CANCELLED":
            return "CANCELLED";
        default:
            return "RUNNING"; // default to RUNNING
    }
}

export function areOutputsEqual(a?: SessionOutput[], b?: SessionOutput[]): boolean {
    if (a === b) {
        return true;
    }
    if (!a || !b || a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        const prA = a[i]?.pullRequest;
        const prB = b[i]?.pullRequest;

        if (
            prA?.url !== prB?.url ||
            prA?.title !== prB?.title ||
            prA?.description !== prB?.description
        ) {
            return false;
        }
    }
    return true;
}

export function areSessionListsEqual(a: Session[], b: Session[]): boolean {
    if (a === b) {
        return true;
    }
    if (a.length !== b.length) {
        return false;
    }

    const mapA = new Map(a.map((s) => [s.name, s]));

    for (const s2 of b) {
        const s1 = mapA.get(s2.name);
        if (!s1) {
            return false;
        }
        if (
            s1.state !== s2.state ||
            s1.rawState !== s2.rawState ||
            s1.title !== s2.title ||
            s1.requirePlanApproval !== s2.requirePlanApproval ||
            JSON.stringify(s1.sourceContext) !== JSON.stringify(s2.sourceContext) ||
            !areOutputsEqual(s1.outputs, s2.outputs)
        ) {
            return false;
        }
    }
    return true;
}

export function extractPRUrl(sessionOrState: Session | SessionState): string | null {
    return (
        sessionOrState.outputs?.find((o) => o.pullRequest)?.pullRequest?.url || null
    );
}

/**
 * Get privacy icon for a source
 * @param isPrivate - The isPrivate field from Source
 * @returns Lock icon for private repos, empty string otherwise
 */
export function getPrivacyIcon(isPrivate?: boolean): string {
    return isPrivate === true ? '$(lock) ' : '';
}

/**
 * Get privacy status text for tooltip/status bar
 * @param isPrivate - The isPrivate field from Source
 * @param format - Format style ('short' for status bar, 'long' for tooltip)
 * @returns Privacy status text or empty string if undefined
 */
export function getPrivacyStatusText(isPrivate?: boolean, format: 'short' | 'long' = 'short'): string {
    if (isPrivate === true) {
        return format === 'short' ? ' (Private)' : ' (Private Repository)';
    } else if (isPrivate === false) {
        return format === 'short' ? ' (Public)' : ' (Public Repository)';
    }
    return '';
}

/**
 * Get description for QuickPick source item
 * @param source - The source object
 * @returns Description text for QuickPick item
 */
export function getSourceDescription(source: Source): string {
    if (source.isPrivate === true) {
        return 'Private';
    }
    return source.url || (source.isPrivate === false ? 'Public' : '');
}

export function formatPlanForNotification(plan: Plan): string {
    const parts: string[] = [];
    if (plan.title) {
        parts.push(`📋 ${plan.title}`);
    }
    if (plan.steps && plan.steps.length > 0) {
        const stepsPreview = plan.steps
            .filter((step): step is PlanStep => !!step)
            .slice(0, MAX_PLAN_STEPS_IN_NOTIFICATION);
        stepsPreview.forEach((step, index) => {
            const stepDescription = step?.description || '';
            // Truncate long steps for notification display
            const truncatedStep = stepDescription.length > MAX_PLAN_STEP_LENGTH
                ? stepDescription.substring(0, MAX_PLAN_STEP_LENGTH - 3) + '...'
                : stepDescription;
            parts.push(`${index + 1}. ${truncatedStep}`);
        });
        if (plan.steps.length > MAX_PLAN_STEPS_IN_NOTIFICATION) {
            parts.push(`... and ${plan.steps.length - MAX_PLAN_STEPS_IN_NOTIFICATION} more steps`);
        }
    }
    return parts.join('\n');
}

export function getActivityIcon(activity: Activity): string {
    if (activity.planGenerated) {
        return "📝";
    }
    if (activity.planApproved) {
        return "👍";
    }
    if (activity.progressUpdated) {
        return "🔄";
    }
    if (activity.sessionCompleted) {
        return "✅";
    }
    return "ℹ️";
}
