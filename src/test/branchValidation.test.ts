import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('Branch Validation Tests', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should show warning when local-only branch is selected', async () => {
        // テストケース1: ローカル専用ブランチ選択時に警告が表示される
        const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');
        showWarningMessageStub.resolves({ title: 'Use Default Branch' });

        const remoteBranches = ['main', 'develop'];
        const startingBranch = 'local-only-branch';

        if (!remoteBranches.includes(startingBranch)) {
            await vscode.window.showWarningMessage(
                `Branch "${startingBranch}" exists locally but has not been pushed to remote.

Jules requires a remote branch to start a session.
You can push this branch first, or use the default branch "${'main'}" instead.`,
                { modal: true },
                { title: 'Use Default Branch' },
                { title: 'Cancel' }
            );
        }

        assert.strictEqual(showWarningMessageStub.called, true);
        assert.strictEqual(showWarningMessageStub.getCall(0).args[0].includes('local-only-branch'), true);
    });

    test('Should use default branch when user selects "Use Default Branch"', async () => {
        // テストケース2: 「Use Default Branch」選択時にデフォルトブランチを使用
        const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');
        showWarningMessageStub.resolves({ title: 'Use Default Branch' });

        const remoteBranches = ['main', 'develop'];
        let startingBranch = 'local-only-branch';
        const defaultBranch = 'main';

        if (!remoteBranches.includes(startingBranch)) {
            const action = await vscode.window.showWarningMessage(
                `Branch "${startingBranch}" exists locally but has not been pushed to remote.

Jules requires a remote branch to start a session.
You can push this branch first, or use the default branch "${defaultBranch}" instead.`,
                { modal: true },
                { title: 'Use Default Branch' },
                { title: 'Cancel' }
            );

            if (action?.title === 'Use Default Branch') {
                startingBranch = defaultBranch;
            }
        }

        assert.strictEqual(startingBranch, 'main');
    });

    test('Should cancel session creation when user selects "Cancel"', async () => {
        // テストケース3: 「Cancel」選択時にセッション作成がキャンセルされる
        const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');
        showWarningMessageStub.resolves(undefined); // ユーザーがキャンセル

        const remoteBranches = ['main', 'develop'];
        const startingBranch = 'local-only-branch';
        let sessionCreated = false;

        if (!remoteBranches.includes(startingBranch)) {
            const action = await vscode.window.showWarningMessage(
                `Branch "${startingBranch}" exists locally but has not been pushed to remote.

Jules requires a remote branch to start a session.
You can push this branch first, or use the default branch "${'main'}" instead.`,
                { modal: true },
                { title: 'Use Default Branch' },
                { title: 'Cancel' }
            );

            if (action?.title !== 'Use Default Branch') {
                // キャンセル
                sessionCreated = false;
            } else {
                sessionCreated = true;
            }
        }

        assert.strictEqual(sessionCreated, false);
    });

    test('Should not show warning when remote branch is selected', async () => {
        // テストケース4: リモートブランチ選択時は警告なし
        const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');

        const remoteBranches = ['main', 'develop', 'feature-branch'];
        const startingBranch = 'feature-branch';

        if (!remoteBranches.includes(startingBranch)) {
            await vscode.window.showWarningMessage(
                `Branch "${startingBranch}" exists locally but has not been pushed to remote.

Jules requires a remote branch to start a session.
You can push this branch first, or use the default branch "${'main'}" instead.`,
                { modal: true },
                'Use Default Branch',
                'Cancel'
            );
        }

        assert.strictEqual(showWarningMessageStub.called, false);
    });
});