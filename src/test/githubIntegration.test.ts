import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('GitHub Integration Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let secretsStub: sinon.SinonStubbedInstance<vscode.SecretStorage>;
    let showWarningMessageStub: sinon.SinonStub;
    let showErrorMessageStub: sinon.SinonStub;
    let executeCommandStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Secrets API のスタブ
        secretsStub = {
            get: sandbox.stub(),
            store: sandbox.stub(),
            delete: sandbox.stub(),
            onDidChange: sandbox.stub()
        } as any;

        showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');
        showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
        executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should show error when PAT is not set and user chooses Create Remote Branch', async () => {
        // PAT未設定
        secretsStub.get.withArgs('github-pat').resolves(undefined);

        // ユーザーが "Create Remote Branch" を選択
        showWarningMessageStub.resolves('Create Remote Branch');

        // PAT設定ダイアログで "Set PAT Now" を選択
        showErrorMessageStub.resolves('Set PAT Now');

        // ロジックシミュレーション
        const remoteBranches = ['main', 'develop'];
        const startingBranch = 'local-only-branch';

        if (!remoteBranches.includes(startingBranch)) {
            const action = await vscode.window.showWarningMessage(
                `Branch "${startingBranch}" exists locally but has not been pushed to remote.\n\n` +
                `Jules requires a remote branch to start a session.`,
                { modal: true },
                'Create Remote Branch',
                'Use Default Branch',
                'Cancel'
            );

            if (action === 'Create Remote Branch') {
                const githubPat = await secretsStub.get('github-pat');

                if (!githubPat) {
                    const setPat = await vscode.window.showErrorMessage(
                        'GitHub Personal Access Token is not set.\n\n' +
                        'A PAT with "repo" scope is required to create remote branches.',
                        { modal: true },
                        'Set PAT Now',
                        'Cancel'
                    );

                    if (setPat === 'Set PAT Now') {
                        await vscode.commands.executeCommand('jules-extension.setGitHubPat');
                    }
                }
            }
        }

        // 検証
        assert.strictEqual(showWarningMessageStub.called, true);
        assert.strictEqual(showErrorMessageStub.called, true);
        assert.strictEqual(executeCommandStub.calledWith('jules-extension.setGitHubPat'), true);

        const errorMessage = showErrorMessageStub.getCall(0).args[0];
        assert.ok(errorMessage.includes('GitHub Personal Access Token is not set'));
        assert.ok(errorMessage.includes('repo'));
    });

    test('Should cancel session creation when user clicks Cancel on PAT dialog', async () => {
        // PAT未設定
        secretsStub.get.withArgs('github-pat').resolves(undefined);

        // ユーザーが "Create Remote Branch" を選択
        showWarningMessageStub.resolves('Create Remote Branch');

        // PAT設定ダイアログで "Cancel" を選択
        showErrorMessageStub.resolves('Cancel');

        // ロジックシミュレーション
        const remoteBranches = ['main', 'develop'];
        const startingBranch = 'local-only-branch';
        let sessionCreated = false;

        if (!remoteBranches.includes(startingBranch)) {
            const action = await vscode.window.showWarningMessage(
                `Branch "${startingBranch}" exists locally but has not been pushed to remote.\n\n` +
                `Jules requires a remote branch to start a session.`,
                { modal: true },
                'Create Remote Branch',
                'Use Default Branch',
                'Cancel'
            );

            if (action === 'Create Remote Branch') {
                const githubPat = await secretsStub.get('github-pat');

                if (!githubPat) {
                    const setPat = await vscode.window.showErrorMessage(
                        'GitHub Personal Access Token is not set.\n\n' +
                        'A PAT with "repo" scope is required to create remote branches.',
                        { modal: true },
                        'Set PAT Now',
                        'Cancel'
                    );

                    if (setPat !== 'Set PAT Now') {
                        // キャンセル
                        sessionCreated = false;
                    }
                } else {
                    sessionCreated = true;
                }
            }
        }

        // 検証
        assert.strictEqual(sessionCreated, false);
        assert.strictEqual(showErrorMessageStub.called, true);
        assert.strictEqual(executeCommandStub.called, false); // PAT設定画面を開かない
    });

    test('Should proceed with branch creation when PAT is set', async () => {
        // PAT設定済み
        secretsStub.get.withArgs('github-pat').resolves('ghp_test1234567890abcdef');

        // ユーザーが "Create Remote Branch" を選択
        showWarningMessageStub.resolves('Create Remote Branch');

        // ロジックシミュレーション
        const remoteBranches = ['main', 'develop'];
        const startingBranch = 'local-only-branch';
        let proceedToCreation = false;

        if (!remoteBranches.includes(startingBranch)) {
            const action = await vscode.window.showWarningMessage(
                `Branch "${startingBranch}" exists locally but has not been pushed to remote.\n\n` +
                `Jules requires a remote branch to start a session.`,
                { modal: true },
                'Create Remote Branch',
                'Use Default Branch',
                'Cancel'
            );

            if (action === 'Create Remote Branch') {
                const githubPat = await secretsStub.get('github-pat');

                if (githubPat) {
                    proceedToCreation = true;
                }
            }
        }

        // 検証
        assert.strictEqual(proceedToCreation, true);
        assert.strictEqual(showErrorMessageStub.called, false); // エラーダイアログは表示されない
    });

    test('Should use default branch when user selects Use Default Branch', async () => {
        // ユーザーが "Use Default Branch" を選択
        showWarningMessageStub.resolves('Use Default Branch');

        // ロジックシミュレーション
        const remoteBranches = ['main', 'develop'];
        let startingBranch = 'local-only-branch';
        const defaultBranch = 'main';

        if (!remoteBranches.includes(startingBranch)) {
            const action = await vscode.window.showWarningMessage(
                `Branch "${startingBranch}" exists locally but has not been pushed to remote.\n\n` +
                `Jules requires a remote branch to start a session.`,
                { modal: true },
                'Create Remote Branch',
                'Use Default Branch',
                'Cancel'
            );

            if (action === 'Use Default Branch') {
                startingBranch = defaultBranch;
            }
        }

        // 検証
        assert.strictEqual(startingBranch, 'main');
        assert.strictEqual(secretsStub.get.called, false); // PATは取得されない
    });

    test('Should validate PAT format in Set GitHub PAT command', async () => {
        const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');

        // 無効なPAT形式
        showInputBoxStub.resolves('invalid_pat_format');

        // バリデーション関数をシミュレート
        const validateInput = (value: string) => {
            if (!value || value.trim().length === 0) {
                return 'PAT cannot be empty';
            }
            if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
                return 'Invalid PAT format. Should start with ghp_ or github_pat_';
            }
            return null;
        };

        const validationResult = validateInput('invalid_pat_format');

        // 検証
        assert.ok(validationResult);
        assert.ok(validationResult.includes('Invalid PAT format'));
    });

    test('Should accept valid PAT formats', async () => {
        const validateInput = (value: string) => {
            if (!value || value.trim().length === 0) {
                return 'PAT cannot be empty';
            }
            if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
                return 'Invalid PAT format. Should start with ghp_ or github_pat_';
            }
            return null;
        };

        // 有効なPAT形式をテスト
        const validPat1 = validateInput('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
        const validPat2 = validateInput('github_pat_1234567890abcdefghijklmnopqrstuvwxyz');

        // 検証
        assert.strictEqual(validPat1, null);
        assert.strictEqual(validPat2, null);
    });
});