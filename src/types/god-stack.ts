/**
 * src/types/god-stack.ts
 * Tipos centralizados do God Stack — BagxPress
 *
 * Todos os módulos do God Stack importam tipos daqui.
 * Evita duplicação e garante contrato único entre camadas.
 */

// ---------------------------------------------------------------------------
// ZK Compression Types
// ---------------------------------------------------------------------------

/** Estado de uma conta comprimida via Light Protocol */
export interface CompressedAccount {
  /** Public key do owner da conta comprimida */
  owner: string;
  /** Hash da conta no Merkle tree */
  hash: string;
  /** Lamports comprimidos na conta */
  lamports: number;
  /** Se a conta é realmente comprimida ou fallback normal */
  isCompressed: boolean;
  /** Endereço do state tree que contém a conta */
  treeAddress?: string;
}

/** Balance de token comprimido */
export interface CompressedTokenBalance {
  /** Mint address do token */
  mint: string;
  /** Owner da conta */
  owner: string;
  /** Amount em unidades do token (já com decimals aplicados) */
  amount: number;
  /** Raw amount em unidades base (sem decimals) */
  rawAmount: bigint;
  /** Se veio de conta comprimida ou normal */
  isCompressed: boolean;
}

/** Resultado de operação de compressão */
export interface CompressionResult {
  success: boolean;
  txHash: string | null;
  /** Economia estimada em USD vs conta normal */
  costSavingsUsd?: number;
  /** Se usou compressão real ou fallback */
  usedCompression: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Gasless / Relayer Types
// ---------------------------------------------------------------------------

/** Evento do relayer para logging estruturado */
export interface RelayerEvent {
  eventType: 'fee_sponsored' | 'fallback_self_pay' | 'error';
  /** Public key do usuário que assinou */
  userSigner: string;
  /** Public key do fee payer (se gasless) */
  feePayer?: string;
  /** Custo em lamports coberto pelo fee payer */
  feeSponsored?: number;
  /** Tx hash da transação */
  txHash?: string;
  /** Timestamp do evento */
  timestamp: string;
  error?: string;
}

/** Parâmetros para uma transação patrocinada */
export interface SponsoredTxParams {
  /** Transação serializada (base64) ou objeto Transaction */
  transaction: string | import('@solana/web3.js').Transaction;
  /** Keypair do usuário para assinar */
  userKeypair: import('@solana/web3.js').Keypair;
  /** RPC endpoint */
  rpcUrl: string;
  /** Network para logs */
  network: string;
}

/** Resultado de uma transação patrocinada */
export interface SponsoredTxResult {
  success: boolean;
  txHash: string | null;
  explorerUrl: string | null;
  /** True se fee payer cobriu o custo, false se usuário pagou */
  wasSponsored: boolean;
  /** Lamports cobertos pelo relayer */
  sponsoredLamports?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Token BXP (Token-2022) Types
// ---------------------------------------------------------------------------

/** Configuração do token BXP */
export interface BxpTokenConfig {
  /** Mint address na rede ativa */
  mintAddress: string;
  /** Decimals do token */
  decimals: number;
  /** Supply total */
  totalSupply: bigint;
  /** Nome do token */
  name: string;
  /** Símbolo */
  symbol: string;
  /** URI dos metadados */
  metadataUri?: string;
  /** Fee de transferência em basis points (ex: 250 = 2.5%) */
  transferFeeBps: number;
  /** Máximo de fee por transfer em amount base */
  maxTransferFee: bigint;
}

// ---------------------------------------------------------------------------
// Smart Contract / Anchor Types
// ---------------------------------------------------------------------------

/** Parâmetros para instrução process_buy */
export interface ProcessBuyParams {
  /** Buyer public key */
  buyer: string;
  /** Creator wallet para royalties */
  creatorWallet: string;
  /** Amount em lamports ou token units */
  amount: bigint;
  /** Token mint sendo comprado */
  tokenMint: string;
  /** Royalty em basis points */
  royaltyBps: number;
}

/** Parâmetros para instrução sweep_and_burn */
export interface SweepAndBurnParams {
  /** Vault PDA address */
  vaultPda: string;
  /** Creator wallet de destino */
  creatorWallet: string;
  /** Amount a swepar */
  amount: bigint;
  /** Se deve queimar a fee de protocolo */
  burnProtocolFee: boolean;
}

/** Evento emitido pelo programa on-chain */
export interface BuyExecutedEvent {
  buyer: string;
  creator: string;
  amount: bigint;
  tokenMint: string;
  timestamp: number;
  txHash: string;
}

// ---------------------------------------------------------------------------
// God Stack unified status (para dashboard e monitoring)
// ---------------------------------------------------------------------------

/** Status consolidado de todos os módulos do God Stack */
export interface GodStackStatus {
  zkCompression: {
    enabled: boolean;
    rpcConnected: boolean;
    fallbackActive: boolean;
  };
  gaslessEngine: {
    enabled: boolean;
    feePayerConfigured: boolean;
    feePayerBalance?: number;
  };
  anchorContracts: {
    enabled: boolean;
    programDeployed: boolean;
    programId?: string;
  };
  bxpToken: {
    enabled: boolean;
    mintAddress?: string;
    network: string;
  };
}
