import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['.next/**', '.next-e2e/**', '.netlify/**', 'components/icons/**', 'node_modules/**', 'public/sw.js', 'public/swe-worker-*.js', 'db/migrations/**', 'test-results/**', 'playwright-report/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];

export default config;
