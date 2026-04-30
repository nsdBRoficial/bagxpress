# BagxPress — v2.0 Hackathon Winner

> **Bags × Stripe Hackathon 2026**  
> **Status: 🟢 LIVE on Solana Devnet** — CPMM Pool active with 9 SOL on-chain volume

The **invisible checkout** for creator tokens on Solana.  
Buy Bags.fm tokens with a credit card, claim them with Phantom — **no signup, no gas, zero friction.**

---

## ✨ Why BagxPress Wins

| Problem | BagxPress Solution |
|---|---|
| Crypto UX is broken | **No wallet required to buy** |
| Anonymous users can't hold tokens | **Pending Claim system — claim later with Phantom** |
| Creator tokens have no economy | **Deflationary flywheel: 1.99% fee → buyback → burn** |
| Web2 fans can't access Web3 | **Stripe checkout → on-chain delivery. Done.** |

---

## 🚀 Features

| Feature | Status | Description |
|---|---|---|
| **Anonymous Purchase** | ✅ | Buy BXP with credit card, no wallet needed |
| **One-Click Claim** | ✅ | Connect Phantom → receive tokens instantly |
| **Wallet-Native UX** | ✅ | Phantom as primary identity layer |
| **Hybrid Identity** | ✅ | Wallet + email + guest, all unified |
| **Gasless Architecture** | ✅ | Treasury pays all fees |
| **On-Chain Proof** | ✅ | Every tx verifiable on Solana Explorer |
| **Deflationary Flywheel** | ✅ | Auto buyback + burn via Raydium CPMM |
| **Dashboard** | ✅ | Total Spent, Total Purchases, Purchase History |

---

## 🎬 Demo Flow

```
STEP 1 — BUY (anonymous)
  └─ Go to /demo
  └─ Search a creator
  └─ Enter amount → Stripe checkout (credit card)
  └─ BXP minted and held in escrow wallet

STEP 2 — CLAIM (Phantom)
  └─ Open claim link (sent/shown after purchase)
  └─ Connect Phantom wallet
  └─ Confirm → tokens transferred on-chain
  └─ TX verifiable on Solana Explorer

STEP 3 — DASHBOARD
  └─ Go to /dashboard
  └─ View Total Spent, Total Purchases, Purchase History
  └─ Identity auto-linked (wallet + email unified)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 + Framer Motion |
| Payments | **Stripe Elements + PaymentIntents** |
| Blockchain | **Solana Web3.js** |
| Wallet | **Phantom Wallet** (primary identity) |
| DeFi | **Raydium CPMM SDK v2** |
| DeFi Fallback | Jupiter Aggregator API v6 |
| Creator Layer | **Bags Public API v2** + `@bagsfm/bags-sdk` |
| Auth | Supabase Magic Link + Phantom |
| Database | Supabase (Postgres + RLS) |
| Encryption | AES-256-GCM (WebCrypto API, Node 18+) |
| Deployment | Vercel (Edge-ready) |

---

## 📡 On-Chain Addresses (Devnet)

| Component | Address | Explorer |
|---|---|---|
| **BXP Token (SPL)** | `5xSwDXXc2pp5xy99sAAdFuhyGPv1XQPectZrxtG6tRKL` | [View Token](https://explorer.solana.com/address/5xSwDXXc2pp5xy99sAAdFuhyGPv1XQPectZrxtG6tRKL?cluster=devnet) |
| **CPMM Pool** | `3jygr64wdRBsfqyVLziPrEPwvNEDxrJ3sxRkTWEziAoy` | [View Pool](https://explorer.solana.com/address/3jygr64wdRBsfqyVLziPrEPwvNEDxrJ3sxRkTWEziAoy?cluster=devnet) |
| **Treasury** | `517XAbeMaaybt4G8BQrxcGAvnKNzGXCbsbQ2Hsqsge9G` | [View Treasury](https://explorer.solana.com/address/517XAbeMaaybt4G8BQrxcGAvnKNzGXCbsbQ2Hsqsge9G?cluster=devnet) |
| **WSOL Vault** | `HLHzWq8ev6LEMnh44XzejeQ1AojAczpdbM1wyptb91fc` | [View Vault](https://explorer.solana.com/address/HLHzWq8ev6LEMnh44XzejeQ1AojAczpdbM1wyptb91fc?cluster=devnet) |
| **BXP Vault** | `7wgn7H77GXppC2BWKEQruK4FerxUJj5nm9jBP19ZTo99` | [View Vault](https://explorer.solana.com/address/7wgn7H77GXppC2BWKEQruK4FerxUJj5nm9jBP19ZTo99?cluster=devnet) |

---

## 🏆 QA MVP — On-Chain Test Results

| Test | Description | Status |
|---|---|---|
| T01 | Treasury SOL Balance (>5 SOL) | ✅ 19.1 SOL |
| T02 | BXP Mint exists on-chain | ✅ Supply 10M |
| T03 | Mint Authority revoked (hard cap) | ✅ Immutable |
| T04 | Treasury BXP ATA | ✅ ~9M BXP |
| T05 | Treasury WSOL ATA | ✅ 0.5 WSOL |
| T06 | CPMM Pool exists on-chain | ✅ 637 bytes |
| T07 | Pool owner = CPMM Program | ✅ Verified |
| T08 | WSOL Vault with real balance | ✅ 10.11 WSOL |
| T09 | BXP Vault with real balance | ✅ ~994K BXP |
| T10 | computeSwapAmount returns valid price | ✅ 0.099 SOL/BXP |
| T11 | Real on-chain swap executed | ✅ [View Tx](https://explorer.solana.com/tx/3WqvZ1nCViDHbCwGqpJiHCVV3Mzs3RbRNnVUDswTxkHmBXgF157ua49RndMBLyygvNDRQHSmc8c3HDU9WH4nyq6o?cluster=devnet) |
| T12 | On-chain burn executed (1 BXP) | ✅ [View Tx](https://explorer.solana.com/tx/d9Jurf5J5azaVd3AXZ8osFhHYiGUQq2jXtciEx1YRH71hnZeCswr1kaTdwftjW5BUPwpwYeKmZxUBhmVuzXsHBr?cluster=devnet) |

**Score: 12 PASS / 0 FAIL**

---

## 💡 Flywheel Architecture

```
Stripe Checkout (Fiat)
        │
        ▼  1.99% fee
╔═══════════════════╗
║    Treasury       ║  50% → Operational
║  517XAb...sge9G   ║  50% → Buyback → Burn (deflationary)
╚═══════════════════╝
        │
        ▼ Raydium CPMM (Primary)
  Pool: 3jygr...ziAoy
  WSOL → BXP → burnChecked()
        │
        ▼ Jupiter (Fallback)
  Automatic routing if CPMM fails
```

---

## ⚙️ Setup

### 1. Clone and install

```bash
git clone https://github.com/nsdBRoficial/bagxpress
cd bagxpress
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your keys:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
ENCRYPTION_SECRET=        # 64-char hex string
FEE_PAYER_SECRET_KEY=     # Solana treasury keypair
SOLANA_RPC_URL=           # Devnet or Mainnet RPC
BXP_TOKEN_MINT=5xSwDXXc2pp5xy99sAAdFuhyGPv1XQPectZrxtG6tRKL
NEXT_PUBLIC_SITE_URL=https://bagxpress.vercel.app
```

### 3. Run

```bash
npm run dev
# http://localhost:3000
```

---

## 🗂️ Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── orders/route.ts         ← Dashboard data (service role + RLS bypass)
│   │   ├── claim/[id]/route.ts     ← Claim resolver + identity binding
│   │   ├── execute-buy/            ← Executes Jupiter + Solana swap
│   │   └── create-order/           ← Creates Stripe PaymentIntent
│   ├── dashboard/page.tsx          ← User dashboard
│   ├── claim/[id]/page.tsx         ← Claim UI
│   └── demo/page.tsx               ← Live demo with CreatorCard
├── services/
│   ├── claim.ts                    ← Claim lifecycle + identity binding
│   ├── tokenomics.ts               ← Buyback/Burn engine
│   └── wallet.ts                   ← Wallet provisioning
├── lib/
│   ├── crypto.ts                   ← AES-256-GCM encryption
│   └── supabase/                   ← Server/client Supabase helpers
└── contexts/
    └── PhantomContext.tsx           ← Phantom wallet integration

scripts/
├── create-classic-bxp.ts           ← SPL Token mint
├── launch-cpmm-pool.ts             ← Raydium CPMM Pool
├── simulate-traction-cpmm.ts       ← 90 swaps traction bot
└── qa-v3.ts                        ← Complete QA suite (13 tests)
```

---

## 🔥 DeFi Scripts

```bash
# Creates BXP_CLASSIC token (SPL, 10M, mint revoked)
npx tsx scripts/create-classic-bxp.ts

# Creates CPMM BXP/WSOL Pool on Devnet
npx tsx scripts/launch-cpmm-pool.ts

# Validates a real swap before the bot
npx tsx scripts/test-cpmm-swap.ts

# Runs the traction bot (90 swaps of 0.1 SOL)
npx tsx scripts/simulate-traction-cpmm.ts

# Complete QA suite (13 on-chain tests)
npx tsx scripts/qa-v3.ts
```

---

## 🔑 Key Differentials

| Feature | Others | BagxPress |
|---|---|---|
| Signup required | Yes | **No** |
| Wallet to buy | Yes | **No** |
| On-chain execution | Simulated | **Real** |
| Identity system | Login-only | **Wallet + Email + Guest** |
| Token economy | None | **Deflation engine** |

---

## 📜 License

MIT — Made for the Bags × Stripe Hackathon 2026.
