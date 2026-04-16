/**
 * src/lib/flags.ts
 * Feature Flags — God Stack BagxPress
 *
 * Controla quais módulos experimentais estão ativos.
 * Todas as flags são FALSE por padrão → nenhum módulo
 * novo ativa sem consentimento explícito via .env.
 *
 * REGRA DE OURO: Qualquer código do God Stack deve verificar
 * a flag correspondente antes de executar. Se a flag estiver
 * false, a aplicação cai silenciosamente no fluxo legado.
 *
 * Uso:
 *   import { FLAGS } from '@/lib/flags';
 *   if (FLAGS.ZK_COMPRESSION) { ... } else { /* fluxo normal *\/ }
 */

// ---------------------------------------------------------------------------
// Feature Flags — lidas em runtime (server-side apenas)
// ---------------------------------------------------------------------------

export const FLAGS = {
  /**
   * ZK Compression — Light Protocol + Helius
   * Ativa criação de contas comprimidas via stateless.js.
   * Requer: HELIUS_API_KEY configurado.
   * Fallback: conta Solana normal.
   */
  ZK_COMPRESSION: process.env.ENABLE_ZK_COMPRESSION === 'true',

  /**
   * Gasless Engine — Fee Payer patrocinado
   * Ativa transações sem SOL para o usuário (fee payer cobre).
   * Requer: FEE_PAYER_SECRET_KEY configurado com saldo SOL.
   * Fallback: wallet do usuário paga fee (comportamento atual).
   */
  GASLESS_ENGINE: process.env.ENABLE_GASLESS === 'true',

  /**
   * Anchor Smart Contracts — Programa BagxPress Vault
   * Ativa chamadas ao programa on-chain para process_buy e sweep_and_burn.
   * Requer: BAGXPRESS_PROGRAM_ID configurado, programa deployado.
   * Fallback: swap direto sem programa (comportamento atual).
   */
  ANCHOR_CONTRACTS: process.env.ENABLE_ANCHOR === 'true',

  /**
   * Token BXP — Token-2022 nativo
   * Ativa uso do mint BXP real (Token-2022) nas transações.
   * Requer: BXP_TOKEN_MINT configurado e mint criado em devnet/mainnet.
   * Fallback: tokens simulados (comportamento atual).
   */
  BXP_TOKEN: process.env.ENABLE_BXP_TOKEN === 'true',

  /**
   * Debug Mode — logs extendidos do God Stack
   * Ativa logs detalhados para todos os serviços do God Stack.
   * Nunca ativar em produção.
   */
  GOD_STACK_DEBUG: process.env.GOD_STACK_DEBUG === 'true',
} as const;

// ---------------------------------------------------------------------------
// Tipo inferido das flags (utilitário para tipagem)
// ---------------------------------------------------------------------------

export type FeatureFlag = keyof typeof FLAGS;

// ---------------------------------------------------------------------------
// Helper de logging condicional
// ---------------------------------------------------------------------------

/**
 * Loga apenas se GOD_STACK_DEBUG estiver ativo.
 * Prefixo automático do módulo para rastreabilidade.
 */
export function godLog(module: string, message: string, data?: unknown): void {
  if (!FLAGS.GOD_STACK_DEBUG) return;
  const prefix = `[god-stack:${module}]`;
  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

/**
 * Status summary de todas as flags — útil para logs de inicialização.
 * Nunca expor via API (pode revelar estado de features).
 */
export function getFlagsStatus(): Record<FeatureFlag, boolean> {
  return { ...FLAGS };
}
