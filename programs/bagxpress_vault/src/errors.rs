// programs/bagxpress_vault/src/errors.rs
use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("A operação não está autorizada para este usuário.")]
    Unauthorized,
    #[msg("O cálculo de royalty resultou em overflow matemático.")]
    MathOverflow,
    #[msg("A conta de token fornecida é inválida.")]
    InvalidTokenAccount,
    #[msg("A taxa de transferência (TransferFee) não confere com o esperado.")]
    InvalidTransferFee,
}
