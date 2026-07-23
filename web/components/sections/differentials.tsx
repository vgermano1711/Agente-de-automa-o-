import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal, StaggerGroup } from "@/components/ui/reveal";
import { DifferentialCard } from "@/components/cards/differential-card";
import type { Differential } from "@/types/content";
import type { SiteSettings } from "@/types/site";

interface DifferentialsProps {
  items: Differential[];
  settings: SiteSettings;
}

export function Differentials({ items, settings }: DifferentialsProps) {
  return (
    <section className="bg-charcoal py-24 md:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={`Por que a ${settings.shortName}`}
            title="Cada detalhe pensado antes de chegar até você."
            description="Não é sorte — é processo. Cinco pilares que sustentam cada pizza que sai do nosso forno."
            tone="dark"
          />
        </Reveal>

        <StaggerGroup className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Reveal key={item.id}>
              <DifferentialCard item={item} />
            </Reveal>
          ))}
        </StaggerGroup>
      </Container>
    </section>
  );
}
