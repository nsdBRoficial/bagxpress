# BagxPress Tokenomics ($BXP)

O **$BXP** é o token utilitário e deflacionário no coração da infraestrutura da BagxPress.  
Projetado sob um modelo hiper-sustentável de Buyback & Burn contínuo alimentado pelas taxas reais do protocolo.

## 📊 1. Macroeconomia (Supply & Alocação)
- **Token Type:** SPL Token-2022
- **Network:** Solana Mainnet
- **Total Supply (Hard Cap):** 10,000,000 $BXP (Mint Authority revogada permanentemente)

**Distribuição:**
1. **Liquidez Inicial (Meteora DLMM):** 10% (1,000,000 BXP) — Totalmente travada.
2. **Treasury & Protocol Reserve:** 30% (3,000,000 BXP) — Usada para market making e pools B2B.
3. **Ecosystem Growth / Community (Airdrops):** 40% (4,000,000 BXP).
4. **Team & Advisors:** 20% (2,000,000 BXP) — Vesting linear over 36 months, cliff de 6 meses.

---

## 🔥 2. Motor Deflacionário (Deflation Engine)

O protocolo cobra uma **Platform Fee de 1.99%** por cada transação fiat iniciada por usuários Web2.
Quando a transação é convertida para cripto on-chain, o contrato aciona uma operação atômica de "Sweep".

**O que acontece com os 1.99%?**
- **50% vai para o Cofre (Treasury):** Reinvestimento na estabilidade dos Relay Nodes e pagamento de contas da infra.
- **50% é transformado em Buyback & Burn:**
  1. A taxa é roteada para a Meteora Pool, atuando como força de compra (market buy) massiva por tokens $BXP.
  2. O $BXP recém-comprado é permanentemente **QUEIMADO** (`executeBurn` contract path) através de delegações da Extension `PermanentDelegate` do ecossistema Token-2022.

> **Impacto Direto:** Cada compra dentro da BagxPress gera escassez imediata do token no mercado, valorizando progressivamente os holders sem a necessidade de emissão inflacionária de rewards ("yield farmings" insustentáveis).
