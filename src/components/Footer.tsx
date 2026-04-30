import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[var(--color-brand-bg-1)] py-12 relative z-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
        
        <div className="flex items-center gap-3 group">
          <img src="/logobxp.png" alt="BagxPress" className="w-8 h-8 object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
          <span className="font-geist font-bold text-xl tracking-tight text-white opacity-50 group-hover:opacity-80 transition-opacity">BagxPress</span>
          <span className="text-xs text-white/20">© 2026</span>
        </div>
        <div className="text-xs text-gray-600 font-mono text-center">
          v2.0 — Hackathon Winner Build
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--color-text-secondary)]">
          <a href="https://github.com/nsdBRoficial/bagxpress" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          <a href="https://bagxpress.vercel.app/" className="hover:text-white transition-colors">Demo</a>
          <Link href="/docs" className="hover:text-white transition-colors">Whitepaper</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
        </div>

        <div className="text-xs text-gray-600 font-mono flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Official Token Contract</span>
          <a 
            href="https://solscan.io/token/5xSwDXXc2pp5xy99sAAdFuhyGPv1XQPectZrxtG6tRKL" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-[var(--color-brand-accent)] transition-colors"
          >
            5xSwDXXc...6tRKL
          </a>
        </div>
        
      </div>
    </footer>
  );
}
