module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended'],
  env: {
    node: true,
  },
  rules: {
    'arrow-parens': 'error',
    'func-names': 'off',
    'id-length': ['error', { exceptions: ['i', 'j', 'e', 'a', 'b', 't'] }],
    'import/prefer-default-export': 'off',
    'prefer-arrow-callback': 'error',
    'quote-props': ['error', 'as-needed'],
    'space-before-function-paren': ['error', 'never'],
  },
  plugins: ['prettier'],
  overrides: [
    {
      files: ['src/**/*.ts', 'test/**/*.ts'],
      plugins: ['@typescript-eslint'],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './tsconfig.test.json',
      },
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'plugin:prettier/recommended',
        'prettier',
      ],
    },
    {
      files: ['*.js'],
      extends: ['plugin:prettier/recommended', 'prettier'],
    },
  ],
};
