import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  }
];
