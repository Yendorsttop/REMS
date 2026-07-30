import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      'playwright-report/**',
      '**/next-env.d.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  { files: ['apps/web/**/*.tsx'], rules: { '@typescript-eslint/no-unused-vars': 'off' } },
);
