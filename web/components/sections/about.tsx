"use client";

import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { useCountUp } from "@/hooks/use-count-up";
import { useInView } from "@/hooks/use-in-view";
import type { SiteSettings } from "@/types/site";

interface AboutProps {
  settings: SiteSettings;
}

function Stat({
  value,
  suffix,
  label,
  start,
}: {
  value: number;
  suffix: string;
  label: string;
  start: boolean;
}) {
  const count = useCountUp({ end: value, start });
  return (
    <div className="flex flex-col gap-1 border-l-2 border-gold/40 pl-5">
      <span className="font-display text-4xl font-semibold text-bordeaux">
        {count}
        {suffix}
      </span>
      <span className="text-sm text-graphite/70">{label}</span>
    </div>
  );
}

export function About({ settings }: AboutProps) {
  const { ref, isInView } = useInView<HTMLDivElement>();

  return (
    <section id="sobre" className="bg-ivory py-24 md:py-32">
      <Container>
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <Reveal direction="right">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-2xl">
              <Image
                src="/images/about.svg"
                alt={`Interior da pizzaria ${settings.shortName}, com o forno à lenha ao fundo`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </Reveal>

          <div className="flex flex-col gap-8">
            <Reveal>
              <SectionHeading
                eyebrow="Nossa história"
                title={
                  <>
                    Tradição de família,
                    <br />
                    forno que não apaga.
                  </>
                }
              />
            </Reveal>

            <Reveal delay={0.1}>
              <p className="max-w-xl text-base leading-relaxed text-graphite/80">
                A {settings.name} nasceu em {settings.foundedYear}, quando construímos nosso
                primeiro forno à lenha à mão, tijolo por tijolo. Desde então, a receita da massa não
                mudou: farinha selecionada, fermentação natural de 48 horas e o tempo que for
                preciso — nunca menos que isso. Hoje atendemos a região inteira, mas cada pizza
                ainda sai do mesmo forno que começou tudo.
              </p>
            </Reveal>

            <div ref={ref} className="grid grid-cols-2 gap-6 pt-4 sm:grid-cols-4 lg:grid-cols-2">
              {settings.stats.map((stat, i) => (
                <Reveal key={stat.label} delay={0.15 + i * 0.08}>
                  <Stat {...stat} start={isInView} />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
