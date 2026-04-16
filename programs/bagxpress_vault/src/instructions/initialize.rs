use anchor_lang::prelude::*;
use crate::state::VaultState;

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = VaultState::SPACE,
        seeds = [b"bagxpress_vault", authority.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeVault>, bump: u8) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.authority = ctx.accounts.authority.key();
    vault_state.bump = bump;
    vault_state.total_buys = 0;
    vault_state.total_royalty_lamports = 0;
    vault_state.last_updated = Clock::get()?.unix_timestamp;

    msg!("BagxPress Vault inicializado com sucesso.");
    Ok(())
}
