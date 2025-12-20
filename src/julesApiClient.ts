import { Source as SourceType, Session, Activity } from './types';
import { fetchWithTimeout } from './fetchUtils';

export class JulesApiClient {
    private baseUrl: string;
    private apiKey: string;

    constructor(apiKey: string, baseUrl: string) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    private async request<T>(endpoint: string, options?: RequestInit & { timeout?: number }): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetchWithTimeout(url, {
            ...options,
            headers: {
                'X-Goog-Api-Key': this.apiKey,
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<T>;
    }

    async getSource(sourceName: string): Promise<SourceType> {
        return this.request<SourceType>(`/${sourceName}`);
    }

    async getSession(sessionId: string): Promise<Session> {
        return this.request<Session>(`/sessions/${sessionId}`);
    }

    async getActivities(sessionId: string): Promise<Activity[]> {
        const response = await this.request<{ activities: Activity[] }>(`/sessions/${sessionId}/activities`);
        return response.activities || [];
    }

    async sendMessage(sessionId: string, text: string): Promise<void> {
        await this.request<void>(`/sessions/${sessionId}:sendMessage`, {
            method: 'POST',
            body: JSON.stringify({ prompt: text }),
        });
    }
}
