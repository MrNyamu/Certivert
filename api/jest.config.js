export default {
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(kubo-rpc-client|ipfs-core-utils|multiformats|@multiformats|uint8arrays)/)'
  ],
  transform: {},
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/index.js', // Exclude main entry file
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
};