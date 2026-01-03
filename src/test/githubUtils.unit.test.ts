import * as assert from 'assert';
import { parseGitHubUrl } from '../githubUtils';

suite('GitHub Utils Unit Tests', () => {
    test('parseGitHubUrl は標準的な HTTPS URL を正しく解析すること', () => {
        const url = 'https://github.com/owner/repo';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('parseGitHubUrl は .git 付きの HTTPS URL を正しく解析すること', () => {
        const url = 'https://github.com/owner/repo.git';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('parseGitHubUrl は http プロトコルの URL を正しく解析すること', () => {
        const url = 'http://github.com/owner/repo.git';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('parseGitHubUrl は SSH URL (コロン区切り) を正しく解析すること', () => {
        const url = 'git@github.com:owner/repo.git';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('parseGitHubUrl は .git なしの SSH URL を正しく解析すること', () => {
        const url = 'git@github.com:owner/repo';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('parseGitHubUrl は github.com 以外のドメインの場合に null を返すこと', () => {
        const url = 'https://gitlab.com/owner/repo.git';
        const result = parseGitHubUrl(url);
        assert.strictEqual(result, null);
    });

    test('parseGitHubUrl は無効な形式の URL の場合に null を返すこと', () => {
        const url = 'not-a-url';
        const result = parseGitHubUrl(url);
        assert.strictEqual(result, null);
    });

    test('parseGitHubUrl はリポジトリルート以外のパスが含まれる場合に null を返すこと', () => {
        // 現在の実装では末尾が repo(.git)?$ で終わることを期待しているため
        const url = 'https://github.com/owner/repo/blob/main/README.md';
        const result = parseGitHubUrl(url);
        assert.strictEqual(result, null);
    });

    test('parseGitHubUrl はハイフンを含むユーザー名やリポジトリ名を正しく処理すること', () => {
        const url = 'https://github.com/my-owner/my-repo.git';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'my-owner', repo: 'my-repo' });
    });

    test('parseGitHubUrl はドットを含むリポジトリ名を正しく処理すること', () => {
        const url = 'https://github.com/owner/repo.js.git';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo.js' });
    });
});
