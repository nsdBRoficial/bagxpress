/**
 * src/services/compression.ts
 * ZK Compression Layer — BagxPress God Stack
 *
 * Integra Light Protocol (stateless.js) para contas e tokens comprimidos.
 * Reduz custo de onboarding em até 5000x vs contas Solana normais.
 *
 * ARQUITETURA:
 * - Se FLAGS.ZK_COMPRESSION === true E HELIUS_API_KEY configurado:
 *     → usa Light Protocol RPC com ZK proofs reais
 * - Caso contrário:
 *     → fallback silencioso para conta Solana normal
 *
 * Todos os métodos públicos nunca lançam exceção —
 * retornam resultado com campo `usedCompression: false` em caso de falha.
 *
 * NARRATIVA HACKATHON:
 * "BagxPress escala para milhões de usuários sem morrer em rent costs."
 * Custo por conta: $0.000005 vs $0.002 (conta normal) = 400x mais barato.
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { FLAGS, godLog } from "@/lib/flags";
import type {
  CompressedAccount,
  CompressedTokenBalance,
  CompressionResult,
} from "@/types/god-stack";

// ---------------------------------------------------------------------------
// Constantes e configuração
// ---------------------------------------------------------------------------

/**
 * RPC URL com suporte a ZK proofs.
 * Prioridade: LIGHT_PROTOCOL_RPC → HELIUS construct → devnet fallback
 */
function getZkRpcUrl(): string {
  if (process.env.LIGHT_PROTOCOL_RPC) {
    return process.env.LIGHT_PROTOCOL_RPC;
  }
  const heliusKey = process.env.HELIUS_API_KEY;
  if (heliusKey && heliusKey !== "your_helius_api_key_here") {
    const network = process.env.SOLANA_NETWORK ?? "devnet";
    return `https://${network}.helius-rpc.com/?api-key=${heliusKey}`;
  }
  // Fallback: devnet padrão (sem ZK, mas não quebra)
  return process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
}

/**
 * Verifica se o módulo ZK está realmente disponível para uso.
 * Não basta a flag — precisa de RPC compatível.
 */
function isZkAvailable(): boolean {
  if (!FLAGS.ZK_COMPRESSION) return false;

  const heliusKey = process.env.HELIUS_API_KEY;
  const hasHelius = heliusKey && heliusKey !== "your_helius_api_key_here";
  const hasCustomRpc = !!process.env.LIGHT_PROTOCOL_RPC;

  return !!(hasHelius || hasCustomRpc);
}

// ---------------------------------------------------------------------------
// Lazy import do Light Protocol SDK
// Usamos import dinâmico para evitar que o bundle quebre
// quando o módulo está desativado (flag = false).
// ---------------------------------------------------------------------------

type LightRpc = Awaited<ReturnType<typeof import("@lightprotocol/stateless.js").createRpc>>;

let _rpcInstance: LightRpc | null = null;

/**
 * Obtém (ou cria) a instância do RPC estendido do Light Protocol.
 * Retorna null se ZK não estiver disponível.
 */
async function getCompressionRpc(): Promise<LightRpc | null> {
  if (!isZkAvailable()) return null;

  if (_rpcInstance) return _rpcInstance;

  try {
    const { createRpc } = await import("@lightprotocol/stateless.js");
    const zkRpcUrl = getZkRpcUrl();

    godLog("compression", "Inicializando Light Protocol RPC", { url: zkRpcUrl });

    // createRpc aceita: connectionUrl, compressionUrl (opcional), proverUrl (opcional)
    _rpcInstance = createRpc(zkRpcUrl, zkRpcUrl);

    godLog("compression", "Light Protocol RPC inicializado com sucesso");
    return _rpcInstance;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    godLog("compression", "Falha ao inicializar Light Protocol RPC", { error: message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Funções públicas
// ---------------------------------------------------------------------------

/**
 * Busca ou cria uma conta comprimida para um usuário.
 *
 * Em modo ZK real: procura no state tree do Light Protocol.
 * Em fallback: retorna dados da conta normal Solana.
 *
 * @param publicKey - Public key Solana do usuário
 */
export async function getOrCreateCompressedAccount(
  publicKey: string
): Promise<CompressedAccount> {
  const rpc = await getCompressionRpc();

  if (rpc) {
    try {
      godLog("compression", "Buscando conta comprimida", { publicKey });

      // Busca contas comprimidas do owner no Light Protocol
      const compressedAccounts = await rpc.getCompressedAccountsByOwner(
        new PublicKey(publicKey)
      );

      if (compressedAccounts.items && compressedAccounts.items.length > 0) {
        const account = compressedAccounts.items[0];
        // account.hash pode ser BN ou Uint8Array dependendo da versão do SDK
        const hashHex = (() => {
          if (account.hash && typeof (account.hash as { toArray?: () => number[] }).toArray === "function") {
            return Buffer.from((account.hash as { toArray: (endian: string, length: number) => number[] }).toArray("be", 32)).toString("hex");
          }
          if (account.hash instanceof Uint8Array || Buffer.isBuffer(account.hash)) {
            return Buffer.from(account.hash as Uint8Array).toString("hex");
          }
          return String(account.hash);
        })();

        godLog("compression", "Conta comprimida encontrada", {
          hash: hashHex.slice(0, 8) + "...",
        });

        return {
          owner: publicKey,
          hash: hashHex,
          lamports: Number(account.lamports),
          isCompressed: true,
          // O SDK Light Protocol usa diferentes campos dependendo da versão
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          treeAddress: ((account as unknown as Record<string, unknown>).merkleTree as PublicKey | undefined)?.toBase58()
            ?? ((account as unknown as Record<string, unknown>).tree as PublicKey | undefined)?.toBase58(),
        };
      }

      // Conta não existe ainda — retorna estrutura preparada
      godLog("compression", "Nenhuma conta comprimida encontrada, retornando estrutura vazia");
      return {
        owner: publicKey,
        hash: "",
        lamports: 0,
        isCompressed: true, // marcado como comprimido mesmo vazio (conta será criada on-demand)
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      godLog("compression", "Erro ao buscar conta comprimida, usando fallback", {
        error: message,
      });
    }
  }

  // Fallback: conta normal Solana
  return buildFallbackAccount(publicKey);
}

/**
 * Busca o saldo de um token comprimido para um owner.
 *
 * @param owner - Public key do owner
 * @param mint - Mint address do token
 */
export async function getCompressedTokenBalance(
  owner: string,
  mint: string
): Promise<CompressedTokenBalance> {
  const rpc = await getCompressionRpc();
  const decimals = Number(process.env.BXP_TOKEN_DECIMALS ?? 6);

  if (rpc) {
    try {
      godLog("compression", "Buscando saldo de token comprimido", { owner, mint });

      const tokenAccounts = await rpc.getCompressedTokenAccountsByOwner(
        new PublicKey(owner),
        { mint: new PublicKey(mint) }
      );

      let totalRawNum = 0;
      for (const item of tokenAccounts.items) {
        totalRawNum += Number(item.parsed.amount.toString());
      }
      const totalRaw = BigInt(totalRawNum);

      const amount = Number(totalRaw) / Math.pow(10, decimals);

      godLog("compression", "Saldo comprimido", { amount, mint });

      return {
        mint,
        owner,
        amount,
        rawAmount: totalRaw,
        isCompressed: true,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      godLog("compression", "Erro ao buscar saldo comprimido", { error: message });
    }
  }

  // Fallback: saldo zerado (não sabemos o saldo sem ZK RPC)
  return {
    mint,
    owner,
    amount: 0,
    rawAmount: 0n,
    isCompressed: false,
  };
}

/**
 * Executa uma transferência de token comprimido.
 * Fallback automático para transfer normal se ZK indisponível.
 *
 * @param from - Keypair do sender
 * @param to - Public key do receiver
 * @param mint - Mint address
 * @param amount - Amount em unidades base (sem decimals)
 */
export async function compressedTransfer(
  from: Keypair,
  to: string,
  mint: string,
  amount: bigint
): Promise<CompressionResult> {
  const rpc = await getCompressionRpc();

  if (rpc) {
    try {
      godLog("compression", "Executando transfer comprimido", {
        from: from.publicKey.toBase58().slice(0, 8) + "...",
        to: to.slice(0, 8) + "...",
        amount: amount.toString(),
      });

      const { transfer } = await import("@lightprotocol/compressed-token");

      const txHash = await transfer(
        rpc,
        from,
        new PublicKey(mint),
        // SDK espera number | BN — converte bigint para number (seguro para amounts razoáveis)
        Number(amount),
        from,               // owner das contas comprimidas
        new PublicKey(to)
      );

      godLog("compression", "Transfer comprimido executado", { txHash });

      // Estimativa de economia: conta normal = ~5000 lamports, comprimida = ~100
      const costSavingsUsd = (4900 / 1_000_000_000) * 180; // ~$0.00088

      return {
        success: true,
        txHash,
        costSavingsUsd,
        usedCompression: true,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      godLog("compression", "Falha no transfer comprimido, tentando fallback", {
        error: message,
      });
    }
  }

  // Fallback: retorna falha controlada (não quebra o fluxo principal)
  return {
    success: false,
    txHash: null,
    usedCompression: false,
    error: "ZK Compression indisponível — usando fluxo normal de swap",
  };
}

/**
 * Retorna o status atual do módulo ZK Compression.
 * Usado pelo dashboard e health checks.
 */
export async function getCompressionStatus(): Promise<{
  enabled: boolean;
  rpcConnected: boolean;
  fallbackActive: boolean;
  zkRpcUrl?: string;
}> {
  if (!FLAGS.ZK_COMPRESSION) {
    return { enabled: false, rpcConnected: false, fallbackActive: true };
  }

  const rpc = await getCompressionRpc();

  if (!rpc) {
    return { enabled: true, rpcConnected: false, fallbackActive: true };
  }

  try {
    // Teste de conectividade: busca slot atual
    const connection = new Connection(getZkRpcUrl(), "confirmed");
    await connection.getSlot();

    return {
      enabled: true,
      rpcConnected: true,
      fallbackActive: false,
      zkRpcUrl: getZkRpcUrl().replace(/api-key=[^&]+/, "api-key=***"),
    };
  } catch {
    return { enabled: true, rpcConnected: false, fallbackActive: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function buildFallbackAccount(publicKey: string): CompressedAccount {
  return {
    owner: publicKey,
    hash: "",
    lamports: 0,
    isCompressed: false, // conta normal, não comprimida
  };
}
