import { jest } from '@jest/globals';

// Global test setup
// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.STACKS_NETWORK = 'simnet';
process.env.PORT = '3001';