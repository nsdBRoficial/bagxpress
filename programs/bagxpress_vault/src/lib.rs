// programs/bagxpress_vault/src/lib.rs
// BagxPress Vault — Smart Contract Layer
//
// Programa Anchor que registra compras on-chain e executa sweep de tokens.
// Designed for Token-2022 (token-extensions) via anchor-spl.
//
// Instruções:
//   - initialize_vault: setup inicial do vault PDA
//   - process_buy:      registra compra + encaminha royalty ao creator
//   - sweep_and_burn:   swepa tokens acumulados ao creator e queima fee protocolo
//
// NARRATIVA HACKATHON:
// "Smart contract próprio. IDL gerado. CPI-ready. Séries B-level tech."

use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

use instructions::*;

// IMPORTANTE: este Program ID é placeholder.
// Após `anchor deploy --provider.cluster devnet`, substitua pelo ID real.
declare_id!("BXPvau1tGodStackXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod bagxpress_vault {
    use super::*;

    /// Inicializa o vault PDA para o protocolo BagxPress.
    /// Chamado uma vez pelo authority (deployer).
    pub fn initialize_vault(ctx: Context<InitializeVault>, bump: u8) -> Result<()> {
        instructions::initialize::handler(ctx, bump)
    }

    /// Registra uma compra on-chain após pagamento Stripe confirmado.
    ///
    /// Fluxo:
    /// 1. Valida buyer e creator wallets
    /// 2. Calcula royalty em basis points
    /// 3. Emite evento BuyExecuted (indexável off-chain)
    /// 4. Incrementa contador no vault state
    pub fn process_buy(
        ctx: Context<ProcessBuy>,
        amount_lamports: u64,
        royalty_bps: u16,
        token_mint: Pubkey,
    ) -> Result<()> {
        instructions::process_buy::handler(ctx, amount_lamports, royalty_bps, token_mint)
    }

    /// Swepa tokens acumulados no vault para o creator wallet.
    /// Opcionalmente queima a fee de protocolo (via PermanentDelegate Token-2022).
    ///
    /// Fluxo:
    /// 1. Verifica authority
    /// 2. Transfere tokens acumulados para creator
    /// 3. Queima protocolo fee se burn_fee = true
    /// 4. Emite evento SweepExecuted
    pub fn sweep_and_burn(
        ctx: Context<SweepAndBurn>,
        amount: u64,
        burn_protocol_fee: bool,
    ) -> Result<()> {
        instructions::sweep_and_burn::handler(ctx, amount, burn_protocol_fee)
    }
}
