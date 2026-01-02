import * as vscode from 'vscode';
import { fetchWithTimeout } from './fetchUtils';
import { ActivitiesResponse, Plan, Session } from './types';
import { formatPlanForNotification } from './sessionUtils';

const JULES_API_BASE_URL = "https://jules.googleapis.com/v1alpha";
const VIEW_DETAILS_ACTION = 'View Details';
const SHOW_ACTIVITIES_COMMAND = 'jules-extension.showActivities';

export async function fetchPlanFromActivities(
    sessionId: string,
    apiKey: string
): Promise<Plan | null> {
    try {
        const response = await fetchWithTimeout(
            `${JULES_API_BASE_URL}/${sessionId}/activities`,
            {
                method: "GET",
                headers: {
                    "X-Goog-Api-Key": apiKey,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!response.ok) {
            console.log(`Jules: Failed to fetch activities for plan: ${response.status}`);
            return null;
        }

        const data = (await response.json()) as ActivitiesResponse;
        if (!data.activities || !Array.isArray(data.activities)) {
            return null;
        }

        // Find the most recent planGenerated activity (reverse to get latest first)
        const planActivity = [...data.activities].reverse().find((a) => a.planGenerated);
        return planActivity?.planGenerated?.plan || null;
    } catch (error) {
        console.error(`Jules: Error fetching plan from activities: ${error}`);
        return null;
    }
}

export async function notifyPlanAwaitingApproval(
    session: Session,
    context: vscode.ExtensionContext
): Promise<void> {
    // Fetch plan details from activities
    const apiKey = await context.secrets.get("jules-api-key");
    let planDetails = '';

    if (apiKey) {
        const plan = await fetchPlanFromActivities(session.name, apiKey);
        if (plan) {
            planDetails = formatPlanForNotification(plan);
        }
    }

    // Build notification message with plan content
    let message = `Jules has a plan ready for your approval in session: "${session.title}"`;
    if (planDetails) {
        message += `\n\n${planDetails}`;
    }

    const selection = await vscode.window.showInformationMessage(
        message,
        { modal: true },
        "Approve Plan",
        VIEW_DETAILS_ACTION
    );

    if (selection === "Approve Plan") {
        // Execute the command with the specific session ID to ensure we approve the correct session
        await vscode.commands.executeCommand('jules-extension.approvePlan', session.name);
    } else if (selection === VIEW_DETAILS_ACTION) {
        await vscode.commands.executeCommand(
            SHOW_ACTIVITIES_COMMAND,
            session.name
        );
    }
}

export async function notifyUserFeedbackRequired(session: Session): Promise<void> {
    const selection = await vscode.window.showInformationMessage(
        `Jules is waiting for your feedback in session: "${session.title}"`,
        VIEW_DETAILS_ACTION
    );

    if (selection === VIEW_DETAILS_ACTION) {
        await vscode.commands.executeCommand(
            SHOW_ACTIVITIES_COMMAND,
            session.name
        );
    }
}

export async function notifyPRCreated(session: Session, prUrl: string): Promise<void> {
    const result = await vscode.window.showInformationMessage(
        `Session "${session.title}" has completed and created a PR!`,
        "Open PR"
    );
    if (result === "Open PR") {
        vscode.env.openExternal(vscode.Uri.parse(prUrl));
    }
}
