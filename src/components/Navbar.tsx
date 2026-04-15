"use client";

import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { Wallet, Menu, X } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import AuthButton from "@/components/AuthButton";

export default function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 50) {
      setScrolled(true);
    } else {
      setScrolled(false);
    }
  });

  const links = [
    { name: "How it Works", href: "#how-it-works" },
    { name: "Economy", href: "#economy" },
    { name: "Live Demo", href: "#demo" },
    { name: "Security", href: "#security" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={clsx(
          "fixed top-0 inset-x-0 z-50 transition-all duration-300",
          scrolled ? "bg-[var(--color-brand-bg-1)]/80 backdrop-blur-md border-b border-white/5 py-3" : "bg-transparent py-5"
        )}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.4)] group-hover:shadow-[0_0_25px_rgba(124,58,237,0.6)] transition-all">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="font-geist font-bold text-2xl tracking-tight text-white">BagxPress</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-6">
              {links.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </div>
            <a
              href="https://github.com/nsdBRoficial/bagxpress"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white font-medium text-sm hover:bg-white/10 transition-colors"
            >
              GitHub
            </a>
            <AuthButton />
            <Link href="/demo" className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] text-white font-semibold text-sm shadow-[0_0_15px_rgba(124,58,237,0.3)] hover:shadow-[0_0_25px_rgba(124,58,237,0.5)] transition-all flex items-center">
              Launch Demo
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-white/70 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 bg-[var(--color-brand-bg-1)] flex flex-col items-center justify-center gap-8 md:hidden"
        >
          {links.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-2xl font-geist font-bold text-white/80 hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <div className="flex flex-col gap-4 mt-8 w-full max-w-xs">
            <div className="flex justify-center">
              <AuthButton />
            </div>
            <a
              href="https://github.com/nsdBRoficial/bagxpress"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-full bg-white/5 border border-white/10 text-center text-white font-medium"
            >
              GitHub
            </a>
            <Link href="/demo" className="w-full py-3 rounded-full bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] text-center text-white font-semibold shadow-[0_0_15px_rgba(124,58,237,0.4)]">
              Launch Demo
            </Link>
          </div>
        </motion.div>
      )}

      {/* Sticky Mobile CTA */}
      <div className="md:hidden fixed bottom-6 inset-x-6 z-40">
        <Link href="/demo" className="w-full py-4 rounded-2xl bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] text-white font-bold text-lg shadow-[0_10px_30px_rgba(124,58,237,0.5)] border border-white/10 active:scale-95 transition-transform flex justify-center items-center gap-2">
          Launch Demo
        </Link>
      </div>
    </>
  );
}
