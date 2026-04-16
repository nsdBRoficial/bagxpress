use anchor_lang::prelude::*;
use crate::state::{VaultState, BuyExecuted};
use crate::errors::VaultError;

#[derive(Accounts)]
pub struct ProcessBuy<'info> {
    pub buyer: Signer<'info>,
    
    /// CHECK: Public key do criador. Não executaremos writes diretamente nele aqui, apenas lido para log/index.
    pub creator: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"bagxpress_vault", vault_state.authority.as_ref()],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ProcessBuy>,
    amount_lamports: u64,
    royalty_bps: u16,
    token_mint: Pubkey,
) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;

    // Calcula os royalties (amount * bps / 10000)
    let royalty_lamports = (amount_lamports as u128)
        .checked_mul(royalty_bps as u128)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(10000)
        .ok_or(VaultError::MathOverflow)? as u64;

    // Atualiza estado do Vault
    vault_state.total_buys = vault_state.total_buys.checked_add(1).unwrap_or(vault_state.total_buys);
    vault_state.total_royalty_lamports = vault_state.total_royalty_lamports.checked_add(royalty_lamports).unwrap_or(vault_state.total_royalty_lamports);
    vault_state.last_updated = Clock::get()?.unix_timestamp;

    // Emite o evento indexável (usamos emit! para que seja guardado nos logs on-chain)
    emit!(BuyExecuted {
        buyer: ctx.accounts.buyer.key(),
        creator: ctx.accounts.creator.key(),
        amount_lamports,
        royalty_lamports,
        token_mint,
        timestamp: vault_state.last_updated,
    });

    Ok(())
}
