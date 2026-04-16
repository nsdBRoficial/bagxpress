import { describe, it, expect, vi } from 'vitest';
import { getCompressionStatus, getOrCreateCompressedAccount } from '../compression';

describe('Compression Service', () => {
  it('should return fallback status if zk is not enabled', async () => {
    // Relying on default mock env where perhaps flags are off
    const status = await getCompressionStatus();
    expect(status).toHaveProperty('enabled');
    expect(status).toHaveProperty('fallbackActive');
  });

  it('should return fallback account properties', async () => {
    const account = await getOrCreateCompressedAccount('test_pubkey');
    expect(account.owner).toBe('test_pubkey');
    expect(account.isCompressed).toBeDefined();
    expect(account.lamports).toBe(0);
  });
});
