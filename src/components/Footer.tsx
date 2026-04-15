export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[var(--color-brand-bg-1)] py-12 relative z-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        
        <div className="flex items-center gap-2 opacity-50">
          <span className="font-geist font-bold text-xl tracking-tight text-white">BagxPress</span>
          <span className="text-sm">© 2026</span>
        </div>

        <div className="flex items-center gap-6 text-sm text-[var(--color-text-secondary)]">
          <a href="#" className="hover:text-white transition-colors">GitHub</a>
          <a href="#" className="hover:text-white transition-colors">Demo</a>
          <a href="#" className="hover:text-white transition-colors">Video</a>
          <a href="#" className="hover:text-white transition-colors">Docs</a>
        </div>

        <div className="text-sm text-gray-600 font-mono">
          Token: <span className="text-gray-400">BAGSX...xyz</span>
        </div>
        
      </div>
    </footer>
  );
}
