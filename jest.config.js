// Unit tests cover plain TypeScript logic in src/lib, so they run in Node without the
// jest-expo native preset (which also mis-resolves paths containing "(2)" on Windows).
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
