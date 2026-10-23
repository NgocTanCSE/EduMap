/* eslint flat config — React Native + Expo + TypeScript */
const js = require('@eslint/js');
const ts = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const prettier = require('eslint-config-prettier');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': ts,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.browser,
        ...globals.reactNative,
      },
    },
    rules: {
      ...ts.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'no-unused-vars': 'off',
      'no-console': 'warn',
      'no-undef': 'off',
      'no-useless-catch': 'off',
      'no-empty': 'off',
      'preserve-caught-error': 'off',
    },
    ignores: [
      'node_modules/',
      'dist/',
      '.expo/',
      'coverage/',
      'babel.config.js',
    ],
  },
  prettier,
];
