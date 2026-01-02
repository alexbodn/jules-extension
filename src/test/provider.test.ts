import * as assert from "assert";
import * as vscode from "vscode";
import { JulesSessionsProvider } from "../sessionViewProvider";
import { SessionStateManager } from "../sessionState";
import * as sinon from "sinon";
import * as fetchUtils from "../fetchUtils";

suite("JulesSessionsProvider Test Suite", () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;
    let fetchStub: sinon.SinonStub;
    let sessionStateManager: SessionStateManager;

    setup(() => {
        sandbox = sinon.createSandbox();
        mockContext = {
            globalState: {
                get: sandbox.stub().returns({}),
                update: sandbox.stub().resolves(),
            },
            subscriptions: [],
            secrets: {
                get: sandbox.stub().resolves('fake-api-key'),
            }
        } as any;
        sessionStateManager = new SessionStateManager(mockContext, { appendLine: () => {} } as any);
        fetchStub = sandbox.stub(fetchUtils, 'fetchWithTimeout');
    });

    teardown(() => {
        sandbox.restore();
    });

    test("getChildren should return empty array when no source selected", async () => {
        (mockContext.globalState.get as sinon.SinonStub).withArgs("selected-source").returns(undefined);

        const provider = new JulesSessionsProvider(mockContext, { appendLine: () => {} } as any, sessionStateManager);
        const children = await provider.getChildren();

        assert.deepStrictEqual(children, [], "Should return empty array when no source selected");
    });

    test("getChildren should return empty array when source selected but no sessions found", async () => {
        (mockContext.globalState.get as sinon.SinonStub).withArgs("selected-source").returns({ name: "source1" });

        // Mock fetch to return empty sessions
        fetchStub.resolves({
            ok: true,
            json: async () => ({ sessions: [] })
        } as any);

        const provider = new JulesSessionsProvider(mockContext, { appendLine: () => {} } as any, sessionStateManager);
        const children = await provider.getChildren();

        assert.deepStrictEqual(children, [], "Should return empty array when sessions list is empty");
    });
});
