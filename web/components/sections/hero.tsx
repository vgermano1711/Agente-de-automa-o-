"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronDown, Flame, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteSettings } from "@/types/site";

interface HeroProps {
  settings: SiteSettings;
}

export function Hero({ settings }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "35%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      id="topo"
      ref={sectionRef}
      className="relative flex h-[100svh] min-h-[640px] items-center overflow-hidden bg-charcoal"
    >
      <motion.div className="absolute inset-0 scale-110" style={{ y: imageY }}>
        <Image
          src="/images/hero-bg.svg"
          alt="Pizza artesanal recém-saída do forno à lenha da Braseiro"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/70 to-charcoal/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal/60 via-transparent to-transparent" />
      </motion.div>

      {/* elementos flutuantes discretos */}
      <motion.div
        className="pointer-events-none absolute right-[8%] top-[22%] hidden text-gold/50 md:block"
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Flame className="size-10" aria-hidden />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute right-[18%] top-[52%] hidden text-ivory/20 lg:block"
        animate={{ y: [0, 16, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <Leaf className="size-8" aria-hidden />
      </motion.div>

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto w-full max-w-7xl px-6 md:px-10"
      >
        <div className="max-w-2xl">
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-ivory/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold backdrop-blur-sm"
          >
            <span className="size-1.5 rounded-full bg-gold" aria-hidden />
            Forno à lenha desde {settings.foundedYear}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-4xl font-medium leading-[1.06] tracking-tight text-ivory sm:text-5xl md:text-6xl lg:text-[4.25rem]"
          >
            {settings.tagline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-6 max-w-lg text-lg leading-relaxed text-ivory/75"
          >
            Massa de fermentação natural, forno à lenha construído à mão e ingredientes selecionados
            todos os dias. Peça pelo site e receba quentinha em casa, ou venha sentir o cheiro de
            perto.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-10 flex flex-col gap-4 sm:flex-row"
          >
            <Button asChild size="lg" variant="primary">
              <a href="#contato">Peça Agora</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#cardapio">Ver Cardápio</a>
            </Button>
          </motion.div>
        </div>
      </motion.div>

      <motion.a
        href="#sobre"
        aria-label="Rolar para a seção Sobre"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute inset-x-0 bottom-8 z-10 mx-auto flex w-fit flex-col items-center gap-2 text-ivory/60 transition-colors hover:text-gold"
      >
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em]">Explore</span>
        <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
          <ChevronDown className="size-5" aria-hidden />
        </motion.span>
      </motion.a>
    </section>
  );
}
