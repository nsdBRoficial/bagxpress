import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSponsoredProofTx } from '../relayer';

global.fetch = vi.fn();

vi.mock('@/lib/flags', () => ({
  FLAGS: { GASLESS_ENGINE: true },
  godLog: vi.fn(),
}));

describe('Relayer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error if FEE_PAYER_SECRET_KEY is missing', async () => {
    const original = process.env.FEE_PAYER_SECRET_KEY;
    process.env.FEE_PAYER_SECRET_KEY = '';

    const result = await executeSponsoredProofTx('test_wallet', 'http://localhost', 'devnet');
    expect(result.success).toBe(false);
    expect(result.error).toContain('FEE_PAYER_SECRET_KEY não configurado');

    process.env.FEE_PAYER_SECRET_KEY = original;
  });
});
