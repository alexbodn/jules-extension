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
 * @param ttlMs TTL（ミリ秒）
 * @returns 有効ならtrue
 */
export function isCacheValid(timestamp: number, ttlMs: number = CACHE_TTL_MINUTES * 60 * 1000): boolean {
    const now = Date.now();
    return (now - timestamp) < ttlMs;
}
