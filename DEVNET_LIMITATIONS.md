# DEVNET_LIMITATIONS.md

## 🔴 Limitações da Raydium Devnet — BXP Token-2022

### Contexto

Durante o desenvolvimento do BagxPress Fairlaunch na Solana Devnet, identificamos uma incompatibilidade crítica entre a arquitetura escolhida para o token $BXP e os programas AMM disponíveis na rede de testes.

---

### Erro Confirmado On-Chain (6 Transações)

```
Error Code: NotSupportMint (6007)
Error Message: Not support token_2022 mint extension.
File: programs/cp-swap/src/instructions/initialize.rs:173
Program: DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb (Raydium CPMM Devnet)
```

| Protocolo Testado | Program ID (Devnet) | Resultado |
|---|---|---|
| Raydium AMM V4 | `HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8` | ❌ `InvalidSplTokenProgram` |
| Raydium CPMM | `DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb` | ❌ `NotSupportMint (6007)` |

---

### Causa Raiz

O token $BXP original (`ABJ54vC6hTUP1mAat89CbbKCHSHtiogFa5a5wSfBENr2`) foi criado com o **Token-2022 Program** (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) e inclui as seguintes extensões:

- `TransferFeeConfig` — cobrança automática de 1% em cada transferência
- `PermanentDelegate` — delegação permanente para operações de burn soberano
- `MetadataPointer` — metadados on-chain (nome, símbolo, URI)

**Os programas Raydium deployados na Devnet são versões desatualizadas** que não implementam suporte às extensões do Token-2022. Na **Mainnet**, o Raydium CPMM já suporta certos tokens Token-2022, mas a Devnet pública ficou defasada.

---

### Estratégia Adotada: Dual-Track

Para o funcionamento na Devnet durante o período de hackathon, adotamos uma estratégia **Dual-Track**:

#### Track 1 — Devnet Demo (BXP_CLASSIC)
- Token: **BXP_CLASSIC** (SPL Token padrão, sem extensões)
- Pool: Raydium CPMM (funcional)
- Objetivo: demonstrar o fluxo completo de Fairlaunch, Buyback e Burn on-chain

#### Track 2 — Arquitetura Mainnet (BXP Token-2022)
- Token original preservado: `ABJ54vC6hTUP1mAat89CbbKCHSHtiogFa5a5wSfBENr2`
- Implementação de `TransferFeeConfig` e `PermanentDelegate` mantida no código
- Pool: Raydium CPMM Mainnet (compatível com Token-2022)
- Objetivo: lançamento real pós-hackathon

---

### Impacto no Modelo de Negócio

| Feature | Devnet (BXP_CLASSIC) | Mainnet (BXP Token-2022) |
|---|---|---|
| Pool de Liquidez | ✅ Raydium CPMM | ✅ Raydium CPMM |
| Buyback automático | ✅ Funcional | ✅ Funcional |
| Burn Manual | ✅ `burnChecked()` | ✅ `burnChecked()` |
| TransferFee 1% | ❌ (extensão removida) | ✅ Automático |
| PermanentDelegate | ❌ (extensão removida) | ✅ Burn soberano |
| MetadataPointer | ❌ (extensão removida) | ✅ On-chain |

---

### Referências

- [Raydium SDK v2 - CPMM Source](https://github.com/raydium-io/raydium-sdk-V2)
- [Solana Token-2022 Extensions](https://spl.solana.com/token-2022/extensions)
- [Issue: Raydium CPMM Devnet Token-2022 Support](https://github.com/raydium-io/raydium-sdk-V2/issues)

---

*Documento gerado automaticamente pelo Agente BagxPress em 2026-04-17 durante processo de debug on-chain.*
