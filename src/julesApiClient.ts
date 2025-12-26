import { Source as SourceType } from './types';
import { fetchWithTimeout } from './fetchUtils';

export interface ApiResponse<T> {
    body: T;
    headers: Headers;
}

export class JulesApiClient {
    private baseUrl: string;
    private apiKey: string;

    constructor(apiKey: string, baseUrl: string) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    private async request<T>(endpoint: string, options?: RequestInit & { timeout?: number }): Promise<ApiResponse<T>> {
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

        const body = await response.json() as T;
        return { body, headers: response.headers };
    }

    async getSource(sourceName: string): Promise<ApiResponse<SourceType>> {
        return this.request<SourceType>(`/${sourceName}`);
    }
}