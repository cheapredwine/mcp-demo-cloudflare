import { vi } from 'vitest';

// Mock Cloudflare Workers types
globalThis.ENV = {} as Env;

// Set up any global test utilities
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));
