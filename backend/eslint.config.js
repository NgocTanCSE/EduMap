/* eslint flat config — NestJS + TypeScript + Node.js */
const js = require('@eslint/js');
const ts = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    plugins: { '@typescript-eslint': ts },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      ...ts.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'no-unused-vars': 'off',
      'no-console': 'warn',
      'no-undef': 'off',
    },
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
  prettier,
];
