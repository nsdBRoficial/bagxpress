// programs/bagxpress_vault/src/state.rs
// Estado on-chain do BagxPress Vault

use anchor_lang::prelude::*;

/// PDA que armazena o estado global do vault.
/// Seeds: ["bagxpress_vault", authority.key()]
#[account]
#[derive(Default)]
pub struct VaultState {
    /// Authority que pode executar sweep_and_burn
    pub authority: Pubkey,
    /// Bump do PDA
    pub bump: u8,
    /// Total de compras processadas on-chain
    pub total_buys: u64,
    /// Total em lamports rogyal enviados aos creators
    pub total_royalty_lamports: u64,
    /// Timestamp da última atualização
    pub last_updated: i64,
}

impl VaultState {
    pub const SPACE: usize = 8   // discriminator
        + 32  // authority
        + 1   // bump
        + 8   // total_buys
        + 8   // total_royalty_lamports
        + 8;  // last_updated
}

/// Evento emitido quando uma compra é processada on-chain.
/// Indexável por explorers e subgraphs.
#[event]
pub struct BuyExecuted {
    pub buyer: Pubkey,
    pub creator: Pubkey,
    pub amount_lamports: u64,
    pub royalty_lamports: u64,
    pub token_mint: Pubkey,
    pub timestamp: i64,
}

/// Evento emitido quando sweep é executado.
#[event]
pub struct SweepExecuted {
    pub creator: Pubkey,
    pub amount: u64,
    pub burned_protocol_fee: bool,
    pub timestamp: i64,
}
