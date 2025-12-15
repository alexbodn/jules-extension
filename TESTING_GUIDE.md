# Testing Guide - Security Utils

## Quick Reference

### Running Tests
```bash
# Run only unit tests for security utils
npm run test:unit

# Run all tests
npm test

# Compile tests first
npm run compile-tests
```

### Test File Location
`src/test/securityUtils.unit.test.ts`

### Functions Tested

#### `sanitizeForLogging(value: unknown, maxLength?: number): string`
Sanitizes values for safe logging by:
- Stripping ANSI escape codes
- Escaping control characters (\n, \r, \t)
- Removing non-printable characters
- Truncating to specified length
- Handling null/undefined with strict equality

**Key Test Areas:**
- ANSI code stripping (CSI, OSC, RGB, cursor movement)
- Truncation with various maxLength values
- Type coercion (null, undefined, 0, false, NaN, Infinity)
- Unicode and emoji preservation
- Real-world scenarios (GitHub API errors, stack traces)

#### `stripUrlCredentials(url: string): string`
Removes credentials from URLs for secure logging:
- Strips username:password from HTTP/HTTPS URLs
- Preserves SSH URLs unchanged
- Handles malformed URLs gracefully
- Supports IPv4/IPv6 addresses

**Key Test Areas:**
- Various URL formats (with/without credentials)
- Different protocols (HTTP, HTTPS, FTP, Git, File)
- Special characters in credentials
- Edge cases (empty strings, IPv6, ports, fragments)

## Test Coverage Summary

| Category | Tests | Description |
|----------|-------|-------------|
| ANSI Escape Codes | 11 | Various ANSI patterns and edge cases |
| Null/Undefined | 4 | Strict equality checks |
| Truncation | 5 | Length boundary conditions |
| Real-World | 3 | GitHub API, stack traces, JSON |
| Type Coercion | 5 | Boolean, object, array, NaN, Infinity |
| Combined Ops | 2 | ANSI + truncation interactions |
| Performance | 3 | Large strings, edge cases |
| Control Chars | 3 | Newlines, tabs, Windows CRLF |
| Unicode | 3 | International chars, emoji |
| URL Stripping | 12 | Various URL formats and protocols |

**Total: 66 tests with 76 assertions**

## Adding New Tests

When adding new tests to this file, follow these conventions:

1. **Naming**: Use descriptive names starting with the function name
   ```typescript
   test("functionName should do something specific", () => {
   ```

2. **Structure**: Arrange-Act-Assert pattern
   ```typescript
   test("description", () => {
       const input = "test data";  // Arrange
       const result = func(input); // Act
       assert.strictEqual(result, expected); // Assert
   });
   ```

3. **Comments**: Group related tests with comments
   ```typescript
   // Category description
   test("test 1", () => { ... });
   test("test 2", () => { ... });
   ```

## Common Issues

### Test Failures
If tests fail, check:
1. ANSI escape code regex pattern
2. Control character handling order
3. Truncation logic with edge cases
4. URL parsing error handling

### Running Individual Tests
Mocha TDD interface doesn't support `.only` easily, but you can:
```bash
# Run specific test file
npm run compile-tests && mocha out/test/securityUtils.unit.test.js
```

## Security Considerations

These tests validate security-critical functions:
- **Log Injection**: ANSI codes can inject malicious terminal commands
- **Information Disclosure**: URLs may contain credentials
- **Log Flooding**: Unlimited strings can fill disk space
- **Terminal Hijacking**: Control characters can manipulate terminal state

All tests ensure these vulnerabilities are properly mitigated.