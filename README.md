# BagxPress MVP v0.8 🦄

> "No wallet. No gas. No friction."

BagxPress is the invisible checkout layer designed for the **Bags** and **Solana** ecosystems. It bridges the gap between Web2 onboarding and Web3 holder retention by enabling lightning-fast, fiat-to-crypto transactions without exposing the friction of blockchain mechanics.

This MVP was specifically built for **The Bags Hackathon**, emphasizing extreme front-end stability, premium UI/UX, and robust fallback mocks suitable for live pitching.

## 🌟 O Problema

A jornada típica para apoiar um Creator na Web3 é inaceitável. O usuário precisa saber o que é Wallet, Seed Phrase, Gas, Swap de Tokens, Dex e RCPs. Para fãs Web2 nativos de plataformas tradicionais como Patreon ou Instagram, essa barreira técnica aniquila o funil de conversão. 

## 💡 Nossa Solução

O **BagxPress** resolve matematicamente esse gargalo com um fluxo invisível de 10 segundos:
1. **Passkey Auth**: Autentica e cria o hardware enclave na face ou biometria.
2. **Fiat Checkout**: Transaciona rapidamente com Apple Pay, Google Pay ou Cartões através de um Widget minimalista (Powered by Stripe).
3. **Ghost On-Ramp e Execute**: O Backend roteia a ordem on-chain, delegando o gás remotamente e mintando o Creator Token invisivelmente para a "Stealth Wallet" em centésimos de segundos na Solana.

## 🛠 Tech Stack

- **Frontend**: Next.js 16 (App Router), Tailwind CSS v4, Framer Motion, TypeScript
- **Visual & UI**: Otimizado para 120 FPS "Glassmorphism", micro-interações animadas (`canvas-confetti`), Three.js interativo (Fiber Drei).
- **Trilhos Financeiros**: Stripe Elements API
- **Arquitetura Web3**: `@solana/web3.js`

## 🚀 Como Rodar Localmente

1. **Faça o Clone e Instale**
   ```bash
   git clone https://github.com/MathsBraz/bagxpress.git
   cd bagxpress
   npm install
   ```

2. **Copie e configure as Variáveis do Stripe**
   ```bash
   cp .env.example .env.local
   # Preencha NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY e STRIPE_SECRET_KEY
   ```

3. **Inicie o Ambiente**
   ```bash
   npm run dev
   ```
   *Navegue até `http://localhost:3000` para a Landing Page e `http://localhost:3000/demo` para testar o Widget Fullstack.*

## 🗺 Rotas Principais

- `/` (Landing Page): Interface 3D otimizada demonstrando as propostas de valor com botão de chamada para a Demo.
- `/demo` (Demo Page): BuyWidget Component (Payment Flow Real via Stripe Element).
- `/api/create-order`: Gateway entre interface React e backend para criar PaymentIntents via Stripe e garantir sessão do Passkey Mock.
- `/api/execute-buy`: Controlador de infraestrutura Solana. Realiza Airdrop Devnet nativamente e valida TxHash. Dispõe de proteção em Graceful Mock Fallback para contornar qualquer limite de TPS/RPC da Blockhain localmente e garantir show em apresentações de hackathons.

## 🏁 Roadmap 

| Status | Funcionalidade | Target Version |
| :------- | :----------- | :------ |
| ✅ | Engine Gráfica & Branding "No friction" | `v0.1` |
| ✅ | BuyWidget State-Machine Flow (UX/UI) | `v0.5` |
| ✅ | Integração Web3.JS Fake/Devnet on-chain + Stripe Real | `v0.8` |
| 🚧 | Integração `@bagsfm/bags-sdk` e Bags Creators API | `v0.9` |
| ⏳ | Lançamento Mainnet Smart Contract | `v1.0 RC` |
| ⏳ | Passkeys Hardware On-Chain Secp256r1 | `v1.0` |

---
**Hackathon Context:** Construído totalmente do zero para O *Bags Hackathon*. A arquitetura prioriza experiência do usuário excepcional acima do padrão da indústria Web3 e conversão transacional via infraestrutura Híbrida tolerante à quedas. 
