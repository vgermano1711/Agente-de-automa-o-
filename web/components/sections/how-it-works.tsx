import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal, StaggerGroup } from "@/components/ui/reveal";
import type { HowItWorksStep } from "@/types/content";

interface HowItWorksProps {
  steps: HowItWorksStep[];
}

export function HowItWorks({ steps }: HowItWorksProps) {
  return (
    <section className="bg-ivory py-24 md:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Como funciona"
            title="Do pedido à mesa, sem complicação."
            align="center"
          />
        </Reveal>

        <StaggerGroup className="relative mt-16 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
          <div
            className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent md:block"
            aria-hidden
          />
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <Reveal
                key={step.id}
                delay={i * 0.1}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative z-10 flex size-16 items-center justify-center rounded-full border border-gold/40 bg-ivory text-bordeaux shadow-sm">
                  <Icon className="size-7" aria-hidden />
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-bordeaux font-display text-xs font-semibold text-ivory">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-xl font-medium text-charcoal">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-graphite/75">
                  {step.description}
                </p>
              </Reveal>
            );
          })}
        </StaggerGroup>
      </Container>
    </section>
  );
}
