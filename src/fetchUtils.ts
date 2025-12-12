/**
 * Performs a fetch with a specified timeout.
 * Defaults to 30 seconds.
 */
export async function fetchWithTimeout(input: string | URL | Request, init?: RequestInit & { timeout?: number }): Promise<Response> {
    const timeout = init?.timeout ?? 30000;

    // AbortSignal.timeout is available in Node 17.3+ and recent browsers
    const timeoutSignal = AbortSignal.timeout(timeout);

    let finalSignal = timeoutSignal;
    if (init?.signal) {
        finalSignal = anySignal([init.signal, timeoutSignal]);
    }

    return fetch(input, {
        ...init,
        signal: finalSignal
    });
}

/**
 * Polyfill-like helper for AbortSignal.any
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
    // @ts-ignore - AbortSignal.any might not be in the TS definition if target is older
    if (typeof AbortSignal.any === 'function') {
        // @ts-ignore
        return AbortSignal.any(signals);
    }

    const controller = new AbortController();

    const onAbort = (reason: any) => {
        controller.abort(reason);
        // Cleanup not strictly necessary for short lived requests but good practice
        // We can't easily remove listeners here without tracking them
    };

    for (const signal of signals) {
        if (signal.aborted) {
            controller.abort(signal.reason);
            return controller.signal;
        }
        signal.addEventListener('abort', () => onAbort(signal.reason), { once: true });
    }

    return controller.signal;
}
