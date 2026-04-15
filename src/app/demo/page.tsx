import Navbar from "@/components/Navbar";
import BuyWidget from "@/components/BuyWidget";

export const metadata = {
  title: 'Demo | BagxPress',
  description: 'Try the invisible checkout layer for Bags.',
};

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-[var(--color-brand-bg-1)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--color-brand-primary)]/10 via-[var(--color-brand-bg-1)] to-[var(--color-brand-bg-1)] flex flex-col pt-24 pb-12">
      <Navbar />
      <div className="flex-1 max-w-7xl mx-auto px-6 w-full flex flex-col lg:flex-row items-center justify-center gap-12 text-white">
        
        {/* Left Side: The Interactive MVP Widget */}
        <div className="flex-1 w-full max-w-md pt-8">
          <BuyWidget />
        </div>

        {/* Right Side: Presentation Context */}
        <div className="flex-1 w-full max-w-lg hidden lg:flex flex-col justify-center">
            <h1 className="text-4xl lg:text-5xl font-geist font-bold mb-6 text-glow">
              The 10-Second Web3 Onboarding
            </h1>
            <p className="text-lg text-[var(--color-text-secondary)] mb-8 leading-relaxed font-sans">
              Experience the frictionless payment flow. Select an amount, authenticate with FaceID or your preferred payment method, and watch the background process instantly fund a non-custodial wallet and deliver real assets.
            </p>
            
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 glass-panel">
               <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_#4ade80]" /> 
                 Live Server Status
               </h3>
               <div className="grid grid-cols-2 gap-4 text-sm font-mono text-gray-400">
                  <div className="flex flex-col"><span className="text-gray-500 text-xs uppercase mb-1">Relay Engine</span><span>zero-ux-v2</span></div>
                  <div className="flex flex-col"><span className="text-gray-500 text-xs uppercase mb-1">Crypto Network</span><span>solana-devnet</span></div>
                  <div className="flex flex-col"><span className="text-gray-500 text-xs uppercase mb-1">Payment Gateway</span><span>stripe-mcp</span></div>
                  <div className="flex flex-col"><span className="text-gray-500 text-xs uppercase mb-1">Ping</span><span className="text-green-400">42ms</span></div>
               </div>
            </div>
        </div>
      </div>
    </main>
  );
}
