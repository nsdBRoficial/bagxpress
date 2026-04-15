# BagxPress 💼⚡

> **Hackathon Build — Bags x Stripe Track**

O checkout invisível para tokens de creators na Solana.  
Compre qualquer token da plataforma **Bags.fm** com cartão de crédito — **sem wallet, sem gas, sem atrito**.

---

## 🚀 O que é o BagxPress?

BagxPress é uma camada de abstração de pagamentos que conecta:

- **Stripe** (fiat onramp) ↔ **Bags API** (creator tokens) ↔ **Solana** (blockchain)

O usuário final **nunca vê uma wallet**. Ele simplesmente:
1. Encontra o creator no campo de busca
2. Seleciona o amount
3. Autentica com FaceID ou cartão
4. O token é entregue — ponto final.

---

## ✨ v0.9 — Integração Real com Bags

### O que foi integrado

| Feature | Status | Notes |
|---|---|---|
| `@bagsfm/bags-sdk` instalado | ✅ | v instalado e tipagens verificadas |
| Rota `/api/bags/creator` | ✅ | GET por `tokenMint` ou `handle` |
| `CreatorCard` component | ✅ | Busca + profile card dinâmico |
| BuyWidget com contexto do creator | ✅ | Avatar, nome, royalty, X badge |
| Demo `/demo` refatorada | ✅ | Layout 3 colunas, banner contextual |
| `next.config.ts` remotePatterns | ✅ | Avatares externos habilitados |
| Fallback demo mode | ✅ | UI funcional sem API key |

### Arquitetura da Integração

```
/demo (Client Component)
  ├── CreatorCard: busca handle/tokenMint → /api/bags/creator
  │     └── bags.ts service: Bags Public API REST (public-api-v2.bags.fm)
  └── BuyWidget: recebe CreatorContext → Stripe → execute-buy → Solana
```

### Por que REST e não SDK direto no server?

O `@bagsfm/bags-sdk` usa `@coral-xyz/anchor` e `BN.js` que dependem de APIs Node.js (`Buffer`, `crypto`) incompatíveis com o runtime do Next.js 16 App Router em modo edge. A solução adotada:

- **Server-side**: fetch REST direto para `public-api-v2.bags.fm` (confiável, sem polyfills)
- **SDK instalado**: disponível para uso em scripts Node.js autônomos, CLI, e futuras migrações

---

## 📡 Bags API — Endpoints Utilizados

```
GET /api/v1/token-launch/creator/v3?tokenMint=ADDRESS
Authorization: x-api-key: BAGS_API_KEY
```

**Resposta:**
```json
{
  "success": true,
  "response": [{
    "username": "string",
    "pfp": "url_do_avatar",
    "royaltyBps": 500,
    "isCreator": true,
    "wallet": "solana_pubkey",
    "provider": "twitter",
    "providerUsername": "handle_twitter"
  }]
}
```

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

Edite `.env.local`:

```env
# Stripe — obrigatório para o checkout
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Bags API — necessário para dados reais de creator/token
# Obtenha em: https://dev.bags.fm
BAGS_API_KEY=your_bags_api_key_here

# Solana RPC
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

> **Sem `BAGS_API_KEY`:** a demo funciona em modo fallback com dados simulados. O fluxo Stripe + Solana permanece operacional.

### 3. Rode

```bash
npm run dev
# http://localhost:3000
```

---

## 🗂️ Estrutura do Projeto

```
src/
├── app/
│   ├── api/
│   │   ├── bags/creator/route.ts   ← 🆕 Busca creator/token da Bags API
│   │   ├── create-order/           ← Cria PaymentIntent Stripe
│   │   └── execute-buy/            ← Executa swap Jupiter + Solana
│   ├── demo/page.tsx               ← 🔄 Refatorada com CreatorCard
│   └── page.tsx                    ← Landing page
├── components/
│   ├── CreatorCard.tsx             ← 🆕 Search + profile card dinâmico
│   ├── BuyWidget.tsx               ← 🔄 Aceita creatorContext
│   └── ...                         ← Hero, Navbar, Footer, etc.
└── services/
    ├── bags.ts                     ← 🆕 Bags API REST service
    └── solana.ts                   ← Solana wallet + Jupiter swap
```

---

## 🔮 Limitações do SDK (v0.9)

| Limitação | Impacto | Workaround |
|---|---|---|
| Anchor/BN.js incompatível com Next.js App Router | SDK não pode ser inicializado no server | Usa fetch REST direto |
| `getTokenCreators` requer `tokenMint` (PublicKey) | Não é possível buscar por username diretamente | Rota handle usa `unavatar.io` para avatar social |
| Sem endpoint público de busca por handle | Creator handle → tokenMint requer lookup externo | Usuário deve fornecer o tokenMint ou acessar bags.fm |
| Rate limit: 1.000 req/hora | Demo pública pode esgotar quota | Cache de resposta planejado para v1.0 |

---

## 🗺️ Roadmap — v1.0

- [ ] **Handle → tokenMint lookup**: Integrar `/fee-share/wallet/v2` para resolver o wallet do creator a partir do handle, então buscar os tokens dele
- [ ] **Cache Redis**: Memoizar responses da Bags API (TTL 60s)
- [ ] **WebSocket RestreamClient**: Real-time price updates via Bags SDK
- [ ] **Wallet provisioning real**: Integrar Turnkey/Privy para wallets não custodiais reais
- [ ] **Swap real na Solana**: Substituir mock Jupiter por transação real assinada
- [ ] **Token feed**: Listar tokens trending da Bags no `/demo`

---

## 🛠️ Tech Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Payments | Stripe Elements + PaymentIntents |
| Blockchain | Solana Web3.js + Jupiter |
| Creator Layer | **Bags Public API v2** + `@bagsfm/bags-sdk` |
| State | React useState (client components) |

---

## 📜 Licença

MIT — Feito para o Bags x Stripe Hackathon 2026.
