import { vi } from 'vitest';

// Mock simple environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key";
process.env.BAGS_API_KEY = "mock-bags-key";
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.SOLANA_NETWORK = "devnet";

// Setup global mocks if needed
console.warn = vi.fn(); // Suppress expected warnings in test output
