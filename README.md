# BagxPress 💼⚡ — MVP 8.1.0

> **Hackathon Build — Bags x Stripe Track**  
> **Status: 🟢 LIVE on Solana Devnet** — CPMM Pool active with 9 SOL on-chain volume

The invisible checkout for creator tokens on Solana with **native DeFi and on-chain deflation**.  
Buy Bags.fm tokens with a credit card and automatically contribute to the $BXP buyback/burn — **no wallet, no gas, zero friction**.

---

## 📡 On-Chain Addresses (Devnet)

| Component | Address | Explorer |
|---|---|---|
| **BXP Token (SPL)** | `5xSwDXXc2pp5xy99sAAdFuhyGPv1XQPectZrxtG6tRKL` | [View Token](https://explorer.solana.com/address/5xSwDXXc2pp5xy99sAAdFuhyGPv1XQPectZrxtG6tRKL?cluster=devnet) |
| **CPMM Pool** | `3jygr64wdRBsfqyVLziPrEPwvNEDxrJ3sxRkTWEziAoy` | [View Pool](https://explorer.solana.com/address/3jygr64wdRBsfqyVLziPrEPwvNEDxrJ3sxRkTWEziAoy?cluster=devnet) |
| **Treasury** | `517XAbeMaaybt4G8BQrxcGAvnKNzGXCbsbQ2Hsqsge9G` | [View Treasury](https://explorer.solana.com/address/517XAbeMaaybt4G8BQrxcGAvnKNzGXCbsbQ2Hsqsge9G?cluster=devnet) |
| **WSOL Vault** | `HLHzWq8ev6LEMnh44XzejeQ1AojAczpdbM1wyptb91fc` | [View Vault](https://explorer.solana.com/address/HLHzWq8ev6LEMnh44XzejeQ1AojAczpdbM1wyptb91fc?cluster=devnet) |
| **BXP Vault** | `7wgn7H77GXppC2BWKEQruK4FerxUJj5nm9jBP19ZTo99` | [View Vault](https://explorer.solana.com/address/7wgn7H77GXppC2BWKEQruK4FerxUJj5nm9jBP19ZTo99?cluster=devnet) |
| **CPMM Program** | `DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb` | Raydium CPMM Devnet |

---

## 🏆 QA MVP 8.1.0 — Results

**Suite of 13 on-chain tests executed:**

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
| T13 | TypeScript build | ⚠️ Non-critical warnings |

**Score: 12 PASS / 0 FAIL / 1 WARN**

---

## 🚀 What is BagxPress?

BagxPress is a payment abstraction layer that connects:

- **Stripe** (fiat onramp) ↔ **Bags API** (creator tokens) ↔ **Solana** (blockchain)

The end user **never sees a wallet**. They simply:
1. Find the creator in the search field
2. Select the amount
3. Authenticate with FaceID or card
4. The token is delivered and a fraction goes to the $BXP buyback/burn — that's it.

---

## 💡 v8.1.0 — Native DeFi + Pure Fairlaunch

### New in this version

| Feature | Status | Description |
|---|---|---|
| `BXP_CLASSIC` Token (SPL) | ✅ | Fixed 10M, Mint Authority revoked |
| Raydium CPMM Pool | ✅ | BXP/WSOL active on Devnet |
| Traction Bot | ✅ | 90 swaps, 9 SOL volume, 0 failures |
| Automatic Buyback | ✅ | Raydium CPMM → Jupiter fallback |
| Atomic on-chain burn | ✅ | `burnChecked()` SPL Token |
| `tokenomics.ts` v3.1 | ✅ | Complete sweep engine |
| `DEVNET_LIMITATIONS.md` | ✅ | Technical documentation of limitations |

### Flywheel Architecture

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

### Why Classic SPL (and not Token-2022)?

The Raydium CPMM on Devnet returns `Error 6007: NotSupportMint` for tokens with Token-2022 extensions (`TransferFeeConfig`, `PermanentDelegate`). Technical details in [DEVNET_LIMITATIONS.md](./DEVNET_LIMITATIONS.md).

The complete Token-2022 architecture is prepared for **Mainnet**.

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

Edit `.env.local` with your keys.

### 3. Run

```bash
npm run dev
# http://localhost:3000
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

## 🗂️ Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── bags/creator/route.ts   ← Fetches creator/token from Bags API
│   │   ├── create-order/           ← Creates Stripe PaymentIntent
│   │   └── execute-buy/            ← Executes Jupiter + Solana swap
│   ├── demo/page.tsx               ← Demo with CreatorCard
│   └── page.tsx                    ← Landing page
├── components/
│   ├── CreatorCard.tsx             ← Search + dynamic profile card
│   ├── BuyWidget.tsx               ← Accepts creatorContext
│   └── ...
└── services/
    ├── tokenomics.ts               ← 🆕 v3.1 — Buyback/Burn engine
    ├── bags.ts                     ← Bags API REST service
    └── solana.ts                   ← Solana wallet + Jupiter swap

scripts/
├── create-classic-bxp.ts          ← 🆕 SPL Token mint
├── launch-cpmm-pool.ts            ← 🆕 Raydium CPMM Pool
├── simulate-traction-cpmm.ts      ← 🆕 90 swaps traction bot
├── test-cpmm-swap.ts              ← 🆕 1 swap test
└── qa-v3.ts                       ← 🆕 Complete QA suite

DEVNET_LIMITATIONS.md              ← 🆕 Technical documentation
```

---

## 🛠️ Tech Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Payments | Stripe Elements + PaymentIntents |
| Blockchain | Solana Web3.js |
| DeFi | **Raydium CPMM SDK v2** |
| Fallback | Jupiter Aggregator API v6 |
| Creator Layer | **Bags Public API v2** + `@bagsfm/bags-sdk` |
| Auth | Supabase Magic Link |
| Wallet Encryption | AES-256-GCM |

---

## 📜 License

MIT — Made for the Bags x Stripe Hackathon 2026.
