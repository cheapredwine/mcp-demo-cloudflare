import { describe, it, expect } from 'vitest';
import { isAuthRequired, verifyCloudflareAccess } from '../auth';

describe('Cloudflare Access Auth', () => {
  describe('isAuthRequired', () => {
    it('should return false for public paths', () => {
      expect(isAuthRequired('/health')).toBe(false);
      expect(isAuthRequired('/api/health')).toBe(false);
      expect(isAuthRequired('/favicon.ico')).toBe(false);
    });

    it('should return true for protected paths', () => {
      expect(isAuthRequired('/')).toBe(true);
      expect(isAuthRequired('/api/ask')).toBe(true);
      expect(isAuthRequired('/admin')).toBe(true);
    });
  });

  describe('verifyCloudflareAccess', () => {
    it('should return null when no JWT header present', async () => {
      const request = new Request('http://test.com');
      const identity = await verifyCloudflareAccess(request);
      expect(identity).toBeNull();
    });

    it('should return null for invalid JWT format', async () => {
      const request = new Request('http://test.com', {
        headers: {
          'cf-access-jwt-assertion': 'invalid-token',
        },
      });
      const identity = await verifyCloudflareAccess(request);
      expect(identity).toBeNull();
    });
  });
});
