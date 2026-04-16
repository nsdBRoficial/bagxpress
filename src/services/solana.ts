import { Connection, Keypair, LAMPORTS_PER_SOL, clusterApiUrl, PublicKey } from '@solana/web3.js';

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

export async function createWalletIfNotExists(userId: string) {
  // Generate a legitimate ephemeral Keypair for this session
  const keypair = Keypair.generate();
  return { 
    address: keypair.publicKey.toBase58(),
    publicKey: keypair.publicKey,
    keypair 
  };
}

export async function executeJupiterSwap(publicKey: PublicKey, fiatAmount: number) {
  // Mock conversion rate
  const bxpAmount = fiatAmount * 1.5; 

  try {
    // We attempt an actual Airdrop to the generated wallet to simulate
    // the delivery of tokens and generate a real on-chain transaction hash.
    // 0.05 SOL is well within Devnet rate limits but can still fail during high strain.
    const signature = await connection.requestAirdrop(
      publicKey,
      0.05 * LAMPORTS_PER_SOL
    );
    
    // We confirm the transaction directly on-chain
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: signature,
    });

    console.log("Real transaction completed successfully:", signature);

    return {
      isRealTx: true,
      txHash: signature,
      bxpAmount
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("Solana Devnet Exception. Triggering Graceful Mock Fallback.", message);
    
    // Seamless Mock Fallback mechanism exactly as before, guaranteeing demo stability
    await new Promise(r => setTimeout(r, 1200));
    
    return {
      isRealTx: false,
      txHash: `5j${Math.random().toString(36).substring(2, 10)}...mock`,
      bxpAmount
    };
  }
}
