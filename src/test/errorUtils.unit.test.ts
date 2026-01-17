import * as assert from 'assert';
import { sanitizeError } from '../errorUtils';

suite('エラーユーティリティテストスイート (Error Utils Test Suite)', () => {
    test('Errorオブジェクトのエラーメッセージが正しくサニタイズされて保持されること', () => {
        const error = new Error('テストエラー\n改行あり');
        const result = sanitizeError(error);
        // メッセージ部分は "テストエラー\n改行あり" -> "テストエラー\\n改行あり" にサニタイズされるはず
        assert.ok(result.startsWith('テストエラー\\n改行あり'));
    });

    test('Errorオブジェクトのスタックトレースが保持され、サニタイズされること', () => {
        const error = new Error('スタックエラー');
        // スタックトレースを強制的に設定（環境依存を減らすため）
        error.stack = 'Error: スタックエラー\n    at Object.<anonymous> (file.js:1:1)';

        const result = sanitizeError(error);
        const expectedMessage = 'スタックエラー';
        // sanitizeErrorの実装では、スタックトレースの各行は '\n' で結合される仕様
        // 各行の内容自体はsanitizeForLoggingされるが、行構造は維持される
        const expectedStackLine = '    at Object.<anonymous> (file.js:1:1)';

        assert.ok(result.includes(expectedMessage));
        assert.ok(result.includes(expectedStackLine));
        // 実装上、改行コードは含まれる
        assert.ok(result.includes('\n'));
    });

    test('スタックトレースがないErrorオブジェクトも正しく処理されること', () => {
        const error = new Error('スタックなし');
        error.stack = undefined;

        const result = sanitizeError(error);
        assert.strictEqual(result, 'スタックなし');
    });

    test('文字列のエラーも正しくサニタイズされること', () => {
        const errorMessage = '単純なエラー文字列\tタブあり';
        const result = sanitizeError(errorMessage);
        assert.strictEqual(result, '単純なエラー文字列\\tタブあり');
    });

    test('数値型のエラーも文字列化されて処理されること', () => {
        const result = sanitizeError(12345);
        assert.strictEqual(result, '12345');
    });

    test('オブジェクト型のエラーも文字列化されて処理されること', () => {
        const errorObj = { code: 500, message: '内部エラー' };
        const result = sanitizeError(errorObj);
        // オブジェクトは String(obj) で [object Object] になるのがデフォルトの挙動
        // sanitizeForLoggingの実装依存だが、通常はString()変換される
        assert.strictEqual(result, '[object Object]');
    });

    test('nullやundefinedも文字列として安全に処理されること', () => {
        assert.strictEqual(sanitizeError(null), 'null');
        assert.strictEqual(sanitizeError(undefined), 'undefined');
    });

    test('ANSIエスケープシーケンスが含まれるエラーメッセージが浄化されること', () => {
        const ansiError = new Error('\u001b[31m赤色エラー\u001b[0m');
        const result = sanitizeError(ansiError);
        // ANSIコードが除去されていること
        assert.ok(!result.includes('\u001b'));
        assert.ok(result.startsWith('赤色エラー'));
    });

    test('制御文字が含まれるエラーメッセージが浄化されること', () => {
        const controlCharError = new Error('エラー\x00NULL文字');
        const result = sanitizeError(controlCharError);
        // NULL文字が除去されていること
        assert.ok(result.startsWith('エラーNULL文字'));
    });
});
