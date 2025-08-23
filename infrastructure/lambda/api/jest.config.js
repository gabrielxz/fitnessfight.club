module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: [
    '*.js',
    '!*.test.js',
    '!jest.config.js',
    '!node_modules/**',
  ],
};