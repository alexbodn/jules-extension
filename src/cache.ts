import { Source as SourceType } from './types';

export interface SourcesCache {
    sources: SourceType[];
    timestamp: number;
}

export interface BranchesCache {
    branches: string[];
    defaultBranch: string;
    currentBranch: string | null;
    remoteBranches: string[];
    timestamp: number;
}

export const CACHE_TTL_MINUTES = 5;

/**
 * キャッシュが有効かどうかをチェックする
 * @param timestamp キャッシュのタイムスタンプ
 * @param ttlMinutes TTL（分）
 * @returns 有効ならtrue
 */
export function isCacheValid(timestamp: number, ttlMinutes: number = CACHE_TTL_MINUTES): boolean {
    const now = Date.now();
    const ttlMs = ttlMinutes * 60 * 1000;
    return (now - timestamp) < ttlMs;
}