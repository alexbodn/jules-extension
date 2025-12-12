import * as assert from 'assert';
import * as sinon from 'sinon';
import { fetchWithTimeout } from '../fetchUtils';

describe('fetchUtils', () => {
    let fetchStub: sinon.SinonStub;
    let originalFetch: any;

    beforeEach(() => {
        originalFetch = global.fetch;
        fetchStub = sinon.stub();
        global.fetch = fetchStub as any;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        sinon.restore();
    });

    it('should call fetch with provided arguments', async () => {
        fetchStub.resolves(new Response('ok'));
        await fetchWithTimeout('https://example.com');
        assert.ok(fetchStub.calledWith('https://example.com'));
    });

    it('should pass a signal to fetch', async () => {
        fetchStub.resolves(new Response('ok'));
        await fetchWithTimeout('https://example.com');

        const call = fetchStub.getCall(0);
        const args = call.args;
        const init = args[1];
        assert.ok(init.signal, 'Signal should be present');
    });

    it('should respect custom timeout option', async () => {
        fetchStub.resolves(new Response('ok'));
        await fetchWithTimeout('https://example.com', { timeout: 1000 });
        assert.ok(fetchStub.calledOnce);
    });
});
