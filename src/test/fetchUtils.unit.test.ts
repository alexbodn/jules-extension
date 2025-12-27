import * as assert from 'assert';
import * as sinon from 'sinon';
import { fetchWithTimeout } from '../fetchUtils';

suite('fetchUtils Unit Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let fetchStub: sinon.SinonStub;
    let clock: sinon.SinonFakeTimers;
    let originalAbortSignalTimeout: any;

    setup(() => {
        sandbox = sinon.createSandbox();
        clock = sandbox.useFakeTimers();
        fetchStub = sandbox.stub(global, 'fetch');

        // AbortSignal.timeout が存在すると setTimeout が使われないため、テスト中は無効化する
        // @ts-ignore
        if (typeof AbortSignal.timeout === 'function') {
            // @ts-ignore
            originalAbortSignalTimeout = AbortSignal.timeout;
            // @ts-ignore
            AbortSignal.timeout = undefined;
        }
    });

    teardown(() => {
        // @ts-ignore
        if (originalAbortSignalTimeout) {
            // @ts-ignore
            AbortSignal.timeout = originalAbortSignalTimeout;
        }
        sandbox.restore();
    });

    // AbortSignal に反応する fetch のモックを作成するヘルパー
    const mockFetchWithSignalSupport = () => {
        fetchStub.callsFake((_input, init) => {
            return new Promise((_, reject) => {
                const signal = init?.signal as AbortSignal;
                if (signal) {
                    if (signal.aborted) {
                        reject(signal.reason);
                    } else {
                        signal.addEventListener('abort', () => reject(signal.reason));
                    }
                }
                // signalがない、またはabortされない場合は永遠に解決しない（タイムアウト待ち）
            });
        });
    };

    test('指定時間内にフェッチが成功すること', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            json: async () => ({ data: 'test' }),
            headers: new Headers()
        } as unknown as Response;

        fetchStub.resolves(mockResponse);

        const promise = fetchWithTimeout('https://example.com', { timeout: 5000 });

        // 即座に解決させる
        await promise;

        assert.strictEqual(fetchStub.calledOnce, true);
    });

    test('タイムアウト時にエラーがスローされること', async () => {
        mockFetchWithSignalSupport();

        const promise = fetchWithTimeout('https://example.com', { timeout: 1000 });

        // タイムアウト時間を経過させる
        await clock.tickAsync(1100);

        await assert.rejects(promise, (err: Error) => {
            assert.match(err.message, /Timeout/);
            return true;
        });
    });

    test('外部AbortSignalで中断できること', async () => {
        mockFetchWithSignalSupport();

        const controller = new AbortController();
        const promise = fetchWithTimeout('https://example.com', {
            timeout: 5000,
            signal: controller.signal
        });

        // 外部からアボート
        controller.abort(new Error('User cancelled'));

        await assert.rejects(promise, (err: Error) => {
            assert.strictEqual(err.message, 'User cancelled');
            return true;
        });
    });

    test('デフォルトのタイムアウト（30秒）が適用されること', async () => {
        mockFetchWithSignalSupport();

        const promise = fetchWithTimeout('https://example.com'); // timeout指定なし

        // 31秒経過させる
        await clock.tickAsync(31000);

        await assert.rejects(promise, (err: Error) => {
            assert.match(err.message, /Timeout/);
            return true;
        });
    });
});
