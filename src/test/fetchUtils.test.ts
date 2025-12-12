import * as assert from 'assert';
import { fetchWithTimeout } from '../fetchUtils';

describe('fetchUtils', () => {
    let originalFetch: any;
    let fetchCalls: any[] = [];

    beforeEach(() => {
        originalFetch = global.fetch;
        fetchCalls = [];
        // Mock global fetch
        // @ts-ignore
        global.fetch = async (input: any, init: any) => {
            fetchCalls.push({ input, init });
            return { ok: true } as any;
        };
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('should call fetch with provided arguments', async () => {
        await fetchWithTimeout('https://example.com');
        assert.strictEqual(fetchCalls.length, 1);
        assert.strictEqual(fetchCalls[0].input, 'https://example.com');
    });

    it('should pass a signal to fetch', async () => {
        await fetchWithTimeout('https://example.com');
        assert.strictEqual(fetchCalls.length, 1);
        const init = fetchCalls[0].init;
        assert.ok(init.signal, 'Signal should be present');
    });

    it('should respect custom timeout option', async () => {
        await fetchWithTimeout('https://example.com', { timeout: 1000 });
        assert.strictEqual(fetchCalls.length, 1);
    });
});
