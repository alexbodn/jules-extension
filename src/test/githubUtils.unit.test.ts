import * as assert from 'assert';
import { parseGitHubUrl } from '../githubUtils';

suite('githubUtils Unit Tests', () => {
    test('HTTPS URL を正しくパースできること (末尾 .git なし)', () => {
        const url = 'https://github.com/owner/repo';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('HTTPS URL を正しくパースできること (末尾 .git あり)', () => {
        const url = 'https://github.com/owner/repo.git';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('SSH URL を正しくパースできること', () => {
        const url = 'git@github.com:owner/repo.git';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('ドットを含むリポジトリ名を正しくパースできること', () => {
        const url = 'https://github.com/owner/my.repo.git';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'owner', repo: 'my.repo' });
    });

    test('ハイフンを含むオーナー名とリポジトリ名を正しくパースできること', () => {
        const url = 'https://github.com/my-owner/my-repo.git';
        const result = parseGitHubUrl(url);
        assert.deepStrictEqual(result, { owner: 'my-owner', repo: 'my-repo' });
    });

    test('無効なドメインの URL は null を返すこと', () => {
        const url = 'https://gitlab.com/owner/repo.git';
        const result = parseGitHubUrl(url);
        assert.strictEqual(result, null);
    });

    test('GitHub 以外のホスト (Enterprise 等) は現状の正規表現ではサポート外であること', () => {
        // 現在の実装では github.com のみサポートしている前提
        const url = 'https://github.mycompany.com/owner/repo.git';
        const result = parseGitHubUrl(url);
        assert.strictEqual(result, null);
    });

    test('パスが不足している URL は null を返すこと', () => {
        const url = 'https://github.com/owner';
        const result = parseGitHubUrl(url);
        assert.strictEqual(result, null);
    });
});
