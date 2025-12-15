import * as assert from "assert";
import { stripUrlCredentials, sanitizeForLogging } from "../securityUtils";

suite("Security Utils Test Suite", () => {
    test("stripUrlCredentials should remove credentials from HTTPS URLs", () => {
        const url = "https://user:password@github.com/owner/repo";
        const expected = "https://github.com/owner/repo";
        const result = stripUrlCredentials(url);
        assert.strictEqual(result, expected);
    });

    test("stripUrlCredentials should remove username only from HTTPS URLs", () => {
        const url = "https://token@github.com/owner/repo";
        const expected = "https://github.com/owner/repo";
        const result = stripUrlCredentials(url);
        assert.strictEqual(result, expected);
    });

    test("stripUrlCredentials should handle URLs without credentials", () => {
        const url = "https://github.com/owner/repo";
        const result = stripUrlCredentials(url);
        assert.strictEqual(result, url);
    });

    test("stripUrlCredentials should handle HTTP URLs", () => {
        const url = "http://user:pass@example.com";
        const expected = "http://example.com/";
        // Note: new URL() might normalize "http://example.com" to "http://example.com/"
        // Let's verify what the function returns
        const result = stripUrlCredentials(url);
        assert.ok(result === "http://example.com/" || result === "http://example.com");
    });

    test("stripUrlCredentials should keep path intact", () => {
        const url = "https://user:pass@github.com/owner/repo.git";
        const expected = "https://github.com/owner/repo.git";
        const result = stripUrlCredentials(url);
        assert.strictEqual(result, expected);
    });

    test("stripUrlCredentials should return SSH URLs as is", () => {
        const url = "git@github.com:owner/repo.git";
        const result = stripUrlCredentials(url);
        assert.strictEqual(result, url);
    });

    test("stripUrlCredentials should return malformed URLs as is (fallback)", () => {
        const url = "not-a-valid-url";
        const result = stripUrlCredentials(url);
        assert.strictEqual(result, url);
    });

    test("stripUrlCredentials should handle complex passwords", () => {
        const url = "https://user:p@ss:w0rd@github.com/owner/repo";
        const expected = "https://github.com/owner/repo";
        const result = stripUrlCredentials(url);
        assert.strictEqual(result, expected);
    });

    test("stripUrlCredentials should strip credentials from malformed URLs (fallback)", () => {
        // This URL causes new URL() to throw because of invalid port format
        const url = "https://user:pass@github.com:invalidport/repo";
        const expected = "https://github.com:invalidport/repo";
        const result = stripUrlCredentials(url);
        assert.strictEqual(result, expected);
    });

    test("sanitizeForLogging should escape newlines and tabs", () => {
        const input = "Line 1\nLine 2\tTabbed\rReturn";
        const expected = "Line 1\\nLine 2\\tTabbed\\rReturn";
        const result = sanitizeForLogging(input);
        assert.strictEqual(result, expected);
    });

    test("sanitizeForLogging should truncate long strings", () => {
        const input = "a".repeat(20);
        assert.strictEqual(sanitizeForLogging(input, 10), "aaaaaaa...");
        assert.strictEqual(sanitizeForLogging(input, 3), "aaa");
    });

    test("sanitizeForLogging should handle null/undefined", () => {
        assert.strictEqual(sanitizeForLogging(null), "null");
        assert.strictEqual(sanitizeForLogging(undefined), "undefined");
    });

    test("sanitizeForLogging should handle numbers", () => {
        assert.strictEqual(sanitizeForLogging(123), "123");
    });

    test("sanitizeForLogging should remove non-printable control characters", () => {
        const input = "Text\x00\x1FWith\x7FDeleteEnd";
        const expected = "TextWithDeleteEnd";
        const result = sanitizeForLogging(input);
        assert.strictEqual(result, expected);
    });

    test("sanitizeForLogging should strip ANSI escape codes", () => {
        const input = "\u001b[31mRed Error\u001b[0m";
        const expected = "Red Error";
        const result = sanitizeForLogging(input);
        assert.strictEqual(result, expected);
    });
});
