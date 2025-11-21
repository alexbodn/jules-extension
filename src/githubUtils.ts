export interface GitHubUrlInfo {
    owner: string;
    repo: string;
}

/**
 * GitHub URLを解析してownerとrepoを取得する
 */
export function parseGitHubUrl(url: string): GitHubUrlInfo | null {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname !== 'github.com') {
            return null;
        }
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        if (pathParts.length < 2) {
            return null;
        }
        return {
            owner: pathParts[0],
            repo: pathParts[1]
        };
    } catch {
        return null;
    }
}

/**
 * リモートブランチを作成する
 */
export async function createRemoteBranch(
    pat: string,
    owner: string,
    repo: string,
    branchName: string
): Promise<void> {
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: pat });

    // デフォルトブランチのSHAを取得
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;
    const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`
    });
    const baseSha = refData.object.sha;

    await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha
    });
}