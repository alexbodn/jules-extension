import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	launchArgs: [
		'--no-sandbox',
		'--disable-gpu',
		'--disable-extensions',
		'--enable-features=UseOzonePlatform',
		'--ozone-platform=headless',
	],
});