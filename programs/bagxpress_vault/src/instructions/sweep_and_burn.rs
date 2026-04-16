use anchor_lang::prelude::*;
use crate::state::{VaultState, SweepExecuted};

#[derive(Accounts)]
pub struct SweepAndBurn<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Apenas registramos para quem foi o sweep
    pub creator: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"bagxpress_vault", authority.key().as_ref()],
        bump = vault_state.bump,
        has_one = authority // garante que somente o authority do vault pode executar
    )]
    pub vault_state: Account<'info, VaultState>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SweepAndBurn>,
    amount: u64,
    burn_protocol_fee: bool,
) -> Result<()> {
    // Aqui no contrato full implementaríamos as transferências CPI e Token Accounts (SPL Token).
    // Para simplificar a integração da arquitetura, usamos um evento de comprovação que o state mudou.
    // O backend ou frontend assina a tx, e garante os transfers paralelamente ou expandimos o contrato no futuro.

    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.last_updated = Clock::get()?.unix_timestamp;

    emit!(SweepExecuted {
        creator: ctx.accounts.creator.key(),
        amount,
        burned_protocol_fee: burn_protocol_fee,
        timestamp: vault_state.last_updated,
    });

    Ok(())
}
