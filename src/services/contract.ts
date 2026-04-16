/**
 * src/services/contract.ts
 * Maestro Anchor Client para o Programa BagxPress Vault
 *
 * Arquitetura God Stack:
 * Quando a feature flag `SMART_CONTRACT_LAYER` estiver ativada,
 * as compras executarão esta integração com o Anchor Program
 * em vez de registrar apenas no banco de dados e repassar sol via wallet comum.
 * 
 * Requer o IDL mock carregado do diretório de build (target/idl).
 */

import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { FLAGS, godLog } from "@/lib/flags";

export class NodeWallet {
  constructor(readonly payer: Keypair) {}
  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if ("partialSign" in tx) {
      tx.partialSign(this.payer);
    } else {
      tx.sign([this.payer]);
    }
    return tx;
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs.map((tx) => {
      if ("partialSign" in tx) {
        tx.partialSign(this.payer);
      } else {
        tx.sign([this.payer]);
      }
      return tx;
    });
  }
}

// O IDL só é injetado se ele existir fisicamente no disco.
// Como estamos lidando com um mock (fallback), faremos um mock simples interno se falhar no import.
let idlObj: Record<string, unknown>;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  idlObj = require("../../target/idl/bagxpress_vault.json");
} catch (e) {
  godLog("anchor", "Aviso: IDL bagxpress_vault.json não encontrado. Usando fallback runtime.", e);
  idlObj = {
    version: "0.1.0",
    name: "bagxpress_vault",
    instructions: [],
    metadata: {
      address: "BXPvau1tGodStackXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    }
  };
}

export const PROGRAM_ID = new PublicKey((idlObj as { metadata: { address: string } }).metadata.address);

/**
 * Retorna uma instância do Program do Anchor conectada a uma carteira de serviço (admin ou carteira relayer)
 */
export function getVaultProgram(connection: Connection, wallet: NodeWallet): Program {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  
  // No Anchor 0.30+, a assinatura é Program(idl, provider). O programId é lido de idl.metadata.address.
  return new Program(idlObj as anchor.Idl, provider);
}

/**
 * Wrapper de processamento de compra para integração transparente.
 * Emite a instrução on-chain usando CPI Anchor.
 */
export async function executeContractBuy(
  connection: Connection,
  wallet: NodeWallet, // Carteira que paga e executa
  buyerPubkey: PublicKey,
  creatorPubkey: PublicKey,
  amountLamports: number,
  royaltyBps: number,
  tokenMint: PublicKey
): Promise<string | null> {
  if (!FLAGS.ANCHOR_CONTRACTS) {
    godLog("anchor", "ANCHOR_CONTRACTS flag desativada. Bypass do contrato executado.");
    return null; // Retorna null indicando fallback
  }

  try {
    const program = getVaultProgram(connection, wallet);
    
    // Obter Vault PDA
    const [vaultStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bagxpress_vault"), wallet.publicKey.toBuffer()],
      program.programId
    );

    const txHash = await program.methods
      .processBuy(
        new anchor.BN(amountLamports),
        royaltyBps,
        tokenMint
      )
      .accounts({
        buyer: buyerPubkey,
        creator: creatorPubkey,
        // vaultState foi alterado para lower camelCase no JSON automaticamente se fosse via anchor-cli, 
        // mas aqui mapeamos conforme nossa tipagem.
        vaultState: vaultStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([wallet.payer])
      .rpc();

    godLog("anchor", "Compra on-chain executada via Anchor!", { txHash });
    
    return txHash;
  } catch (error) {
    console.error("[anchor] Falha ao executar instrução de contrato:", error);
    // Em caso de falha do smart contract, retornamos null e o sistema usará o fallback 
    // de transferência simples do supabase (conforme estabelecido pela flag arquitetura God Stack).
    return null;
  }
}
