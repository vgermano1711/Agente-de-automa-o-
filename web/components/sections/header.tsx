"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useScrollHeader } from "@/hooks/use-scroll-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";
import type { SiteSettings } from "@/types/site";

const NAV_LINKS = [
  { href: "#topo", label: "Home" },
  { href: "#sobre", label: "Sobre" },
  { href: "#cardapio", label: "Cardápio" },
  { href: "#promocoes", label: "Promoções" },
  { href: "#galeria", label: "Galeria" },
  { href: "#contato", label: "Contato" },
];

interface HeaderProps {
  settings: SiteSettings;
}

export function Header({ settings }: HeaderProps) {
  const isScrolled = useScrollHeader(24);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-500",
        isScrolled
          ? "bg-charcoal/80 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md"
          : "bg-transparent"
      )}
    >
      <Container className="flex h-20 items-center justify-between">
        <Link
          href="#topo"
          className="flex items-baseline gap-1 font-display text-2xl font-semibold text-ivory"
        >
          {settings.shortName}
          <span className="text-gold">.</span>
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium tracking-wide text-ivory/80 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-sm"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Button asChild variant="primary">
            <a href="#contato">Peça Agora</a>
          </Button>
        </div>

        <DialogPrimitive.Root open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <DialogPrimitive.Trigger asChild>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-full border border-ivory/20 text-ivory lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label="Abrir menu"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </DialogPrimitive.Trigger>

          <AnimatePresence>
            {isMobileOpen && (
              <DialogPrimitive.Portal forceMount>
                <DialogPrimitive.Overlay asChild forceMount>
                  <motion.div
                    className="fixed inset-0 z-50 bg-charcoal/95 backdrop-blur-md"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  />
                </DialogPrimitive.Overlay>
                <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
                  <motion.div
                    className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col gap-10 bg-charcoal p-8 focus:outline-none"
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="flex items-center justify-between">
                      <DialogPrimitive.Title className="font-display text-xl text-ivory">
                        Menu
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Close asChild>
                        <button
                          type="button"
                          className="flex size-10 items-center justify-center rounded-full border border-ivory/20 text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                          aria-label="Fechar menu"
                        >
                          <X className="size-5" aria-hidden />
                        </button>
                      </DialogPrimitive.Close>
                    </div>

                    <nav aria-label="Navegação mobile" className="flex flex-col gap-1">
                      {NAV_LINKS.map((link, i) => (
                        <motion.a
                          key={link.href}
                          href={link.href}
                          onClick={() => setIsMobileOpen(false)}
                          initial={{ opacity: 0, x: 24 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + i * 0.05 }}
                          className="border-b border-ivory/10 py-4 font-display text-2xl text-ivory transition-colors hover:text-gold"
                        >
                          {link.label}
                        </motion.a>
                      ))}
                    </nav>

                    <div className="mt-auto flex flex-col gap-4">
                      <a
                        href={`tel:${settings.phone}`}
                        className="flex items-center gap-2 text-sm text-ivory/70"
                      >
                        <Phone className="size-4" aria-hidden />
                        {settings.phoneDisplay}
                      </a>
                      <Button asChild variant="primary" size="lg">
                        <a href="#contato" onClick={() => setIsMobileOpen(false)}>
                          Peça Agora
                        </a>
                      </Button>
                    </div>
                  </motion.div>
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            )}
          </AnimatePresence>
        </DialogPrimitive.Root>
      </Container>
    </header>
  );
}
