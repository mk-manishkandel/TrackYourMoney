// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    settings: {
      // Relative on purpose: an absolute path containing "(2)" is misread as a glob.
      'import/resolver': {
        typescript: { project: 'tsconfig.json' },
      },
    },
  },
]);
