"use client";

import Image from "next/image";
import { Ticket } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal, StaggerGroup } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { PromotionCard } from "@/components/cards/promotion-card";
import { useCountdown } from "@/hooks/use-countdown";
import type { Promotion } from "@/types/content";

interface PromotionsProps {
  promotions: Promotion[];
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-gold/25 bg-charcoal/60 px-4 py-3 backdrop-blur-sm">
      <span className="font-display text-3xl font-semibold text-gold tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[0.65rem] uppercase tracking-widest text-ivory/60">{label}</span>
    </div>
  );
}

export function Promotions({ promotions }: PromotionsProps) {
  const countdown = useCountdown();
  const [featured, ...rest] = promotions;

  return (
    <section id="promocoes" className="bg-graphite py-24 md:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Promoções"
            title="Ofertas que valem a pizza inteira."
            description="Cupons ilustrativos, prontos pra você conectar num cupom real assim que tiver o backend próprio."
            tone="dark"
          />
        </Reveal>

        {featured && (
          <Reveal delay={0.1}>
            <div className="relative mt-12 overflow-hidden rounded-3xl border border-gold/20">
              <div className="absolute inset-0">
                <Image src={featured.image} alt="" fill aria-hidden className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/85 to-charcoal/40" />
              </div>

              <div className="relative flex flex-col gap-8 p-8 md:flex-row md:items-center md:justify-between md:p-12">
                <div className="max-w-lg">
                  <span className="mb-4 inline-block rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wider text-charcoal">
                    {featured.discountLabel}
                  </span>
                  <h3 className="font-display text-3xl font-medium text-ivory">{featured.title}</h3>
                  <p className="mt-3 text-ivory/70">{featured.description}</p>

                  <div className="mt-6 flex items-center gap-2 text-sm text-gold">
                    <Ticket className="size-4" aria-hidden />
                    Use o cupom{" "}
                    <span className="rounded border border-gold/40 px-2 py-0.5 font-mono tracking-widest">
                      {featured.code}
                    </span>
                  </div>

                  <Button asChild variant="primary" className="mt-8">
                    <a href="#contato">Aproveitar oferta</a>
                  </Button>
                </div>

                <div>
                  <p className="mb-3 text-center text-xs uppercase tracking-[0.2em] text-ivory/50">
                    Termina em
                  </p>
                  <div className="flex gap-3" aria-live="polite">
                    <CountdownUnit value={countdown.days} label="dias" />
                    <CountdownUnit value={countdown.hours} label="horas" />
                    <CountdownUnit value={countdown.minutes} label="min" />
                    <CountdownUnit value={countdown.seconds} label="seg" />
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {rest.length > 0 && (
          <StaggerGroup className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((promo) => (
              <Reveal key={promo.id}>
                <PromotionCard promotion={promo} />
              </Reveal>
            ))}
          </StaggerGroup>
        )}
      </Container>
    </section>
  );
}
