# BagxPress 💼⚡ — MVP 3.0

> **Hackathon Build — Bags x Stripe Track**  
> **Status: 🟢 LIVE na Solana Devnet** — Pool CPMM ativa com 9 SOL de volume on-chain

O checkout invisível para tokens de creators na Solana com **DeFi nativo e deflação on-chain**.  
Compre tokens Bags.fm com cartão de crédito e contribua automaticamente para o buyback/burn do $BXP — **sem wallet, sem gas, sem atrito**.

---

## 📡 Endereços On-Chain (Devnet)

| Componente | Endereço | Explorer |
|---|---|---|
| **BXP Token (SPL)** | `5xSwDXXc2pp5xy99sAAdFuhyGPv1XQPectZrxtG6tRKL` | [Ver Token](https://explorer.solana.com/address/5xSwDXXc2pp5xy99sAAdFuhyGPv1XQPectZrxtG6tRKL?cluster=devnet) |
| **Pool CPMM** | `3jygr64wdRBsfqyVLziPrEPwvNEDxrJ3sxRkTWEziAoy` | [Ver Pool](https://explorer.solana.com/address/3jygr64wdRBsfqyVLziPrEPwvNEDxrJ3sxRkTWEziAoy?cluster=devnet) |
| **Treasury** | `517XAbeMaaybt4G8BQrxcGAvnKNzGXCbsbQ2Hsqsge9G` | [Ver Treasury](https://explorer.solana.com/address/517XAbeMaaybt4G8BQrxcGAvnKNzGXCbsbQ2Hsqsge9G?cluster=devnet) |
| **Vault WSOL** | `HLHzWq8ev6LEMnh44XzejeQ1AojAczpdbM1wyptb91fc` | [Ver Vault](https://explorer.solana.com/address/HLHzWq8ev6LEMnh44XzejeQ1AojAczpdbM1wyptb91fc?cluster=devnet) |
| **Vault BXP** | `7wgn7H77GXppC2BWKEQruK4FerxUJj5nm9jBP19ZTo99` | [Ver Vault](https://explorer.solana.com/address/7wgn7H77GXppC2BWKEQruK4FerxUJj5nm9jBP19ZTo99?cluster=devnet) |
| **CPMM Program** | `DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb` | Raydium CPMM Devnet |

---

## 🏆 QA MVP 3.0 — Resultados

**Bateria de 13 testes on-chain executados em 2026-04-17:**

| Teste | Descrição | Status |
|---|---|---|
| T01 | Treasury SOL Balance (>5 SOL) | ✅ 19.1 SOL |
| T02 | BXP Mint existe on-chain | ✅ Supply 10M |
| T03 | Mint Authority revogada (hard cap) | ✅ Imutável |
| T04 | BXP ATA da Treasury | ✅ ~9M BXP |
| T05 | WSOL ATA da Treasury | ✅ 0.5 WSOL |
| T06 | CPMM Pool existe on-chain | ✅ 637 bytes |
| T07 | Pool owner = CPMM Program | ✅ Verificado |
| T08 | Vault WSOL com saldo real | ✅ 10.11 WSOL |
| T09 | Vault BXP com saldo real | ✅ ~994K BXP |
| T10 | computeSwapAmount retorna preço válido | ✅ 0.099 SOL/BXP |
| T11 | Swap real on-chain executado | ✅ [Ver Tx](https://explorer.solana.com/tx/3WqvZ1nCViDHbCwGqpJiHCVV3Mzs3RbRNnVUDswTxkHmBXgF157ua49RndMBLyygvNDRQHSmc8c3HDU9WH4nyq6o?cluster=devnet) |
| T12 | Burn on-chain executado (1 BXP) | ✅ [Ver Tx](https://explorer.solana.com/tx/d9Jurf5J5azaVd3AXZ8osFhHYiGUQq2jXtciEx1YRH71hnZeCswr1kaTdwftjW5BUPwpwYeKmZxUBhmVuzXsHBr?cluster=devnet) |
| T13 | TypeScript build | ⚠️ Avisos não-críticos |

**Score: 12 PASS / 0 FAIL / 1 WARN**

---

## 🚀 O que é o BagxPress?

BagxPress é uma camada de abstração de pagamentos que conecta:

- **Stripe** (fiat onramp) ↔ **Bags API** (creator tokens) ↔ **Solana** (blockchain)

O usuário final **nunca vê uma wallet**. Ele simplesmente:
1. Encontra o creator no campo de busca
2. Seleciona o amount
3. Autentica com FaceID ou cartão
4. O token é entregue e uma fração vai para o buyback/burn do $BXP — ponto final.

---

## 💡 v3.0 — DeFi Nativo + Pure Fairlaunch

### Novidades desta versão

| Feature | Status | Descrição |
|---|---|---|
| `BXP_CLASSIC` Token (SPL) | ✅ | 10M fixos, Mint Authority revogada |
| Raydium CPMM Pool | ✅ | BXP/WSOL ativa na Devnet |
| Bot de Tração | ✅ | 90 swaps, 9 SOL de volume, 0 falhas |
| Buyback automático | ✅ | Raydium CPMM → Jupiter fallback |
| Burn atômico on-chain | ✅ | `burnChecked()` SPL Token |
| `tokenomics.ts` v3.1 | ✅ | Engine de sweep completa |
| `DEVNET_LIMITATIONS.md` | ✅ | Documentação técnica das limitações |

### Arquitetura do Flywheel

```
Stripe Checkout (Fiat)
        │  
        ▼  1.99% fee
╔═══════════════════╗
║    Treasury       ║  50% → Operacional
║  517XAb...sge9G   ║  50% → Buyback → Burn (deflacionário)
╚═══════════════════╝
        │
        ▼ Raydium CPMM (Primary)
  Pool: 3jygr...ziAoy
  WSOL → BXP → burnChecked()
        │
        ▼ Jupiter (Fallback)
  Roteamento automático se CPMM falhar
```

### Por que SPL Clássico (e não Token-2022)?

O Raydium CPMM na Devnet retorna `Error 6007: NotSupportMint` para tokens com extensões Token-2022 (`TransferFeeConfig`, `PermanentDelegate`). Detalhes técnicos em [DEVNET_LIMITATIONS.md](./DEVNET_LIMITATIONS.md).

A arquitetura Token-2022 completa está preparada para a **Mainnet**.

---

## ⚙️ Setup

### 1. Clone e instale

```bash
git clone https://github.com/nsdBRoficial/bagxpress
cd bagxpress
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com suas chaves.

### 3. Rode

```bash
npm run dev
# http://localhost:3000
```

---

## 🔥 Scripts DeFi

```bash
# Cria token BXP_CLASSIC (SPL, 10M, mint revogada)
npx tsx scripts/create-classic-bxp.ts

# Cria Pool CPMM BXP/WSOL na Devnet
npx tsx scripts/launch-cpmm-pool.ts

# Valida um swap real antes do bot
npx tsx scripts/test-cpmm-swap.ts

# Roda o bot de tração (90 swaps de 0.1 SOL)
npx tsx scripts/simulate-traction-cpmm.ts

# Bateria completa de QA (13 testes on-chain)
npx tsx scripts/qa-v3.ts
```

---

## 🗂️ Estrutura do Projeto

```
src/
├── app/
│   ├── api/
│   │   ├── bags/creator/route.ts   ← Busca creator/token da Bags API
│   │   ├── create-order/           ← Cria PaymentIntent Stripe
│   │   └── execute-buy/            ← Executa swap Jupiter + Solana
│   ├── demo/page.tsx               ← Demo com CreatorCard
│   └── page.tsx                    ← Landing page
├── components/
│   ├── CreatorCard.tsx             ← Search + profile card dinâmico
│   ├── BuyWidget.tsx               ← Aceita creatorContext
│   └── ...
└── services/
    ├── tokenomics.ts               ← 🆕 v3.1 — Buyback/Burn engine
    ├── bags.ts                     ← Bags API REST service
    └── solana.ts                   ← Solana wallet + Jupiter swap

scripts/
├── create-classic-bxp.ts          ← 🆕 SPL Token mint
├── launch-cpmm-pool.ts            ← 🆕 Raydium CPMM Pool
├── simulate-traction-cpmm.ts      ← 🆕 Bot de tração 90 swaps
├── test-cpmm-swap.ts              ← 🆕 Teste de 1 swap
└── qa-v3.ts                       ← 🆕 Bateria QA completa

DEVNET_LIMITATIONS.md              ← 🆕 Documentação técnica
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

## 📜 Licença

MIT — Feito para o Bags x Stripe Hackathon 2026.
