"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { TestimonialCard } from "@/components/cards/testimonial-card";
import { cn } from "@/lib/utils";
import type { Testimonial } from "@/types/content";

interface TestimonialsProps {
  items: Testimonial[];
}

export function Testimonials({ items }: TestimonialsProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" }, [
    Autoplay({ delay: 5500, stopOnInteraction: true }),
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  return (
    <section className="bg-ivory py-24 md:py-32">
      <Container>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <Reveal>
            <SectionHeading eyebrow="Depoimentos" title="Quem prova, vira cliente fiel." />
          </Reveal>

          <Reveal delay={0.1} className="flex gap-3 self-start md:self-auto">
            <button
              type="button"
              onClick={scrollPrev}
              aria-label="Depoimento anterior"
              className="flex size-11 items-center justify-center rounded-full border border-charcoal/15 text-charcoal transition-colors hover:border-bordeaux hover:text-bordeaux focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bordeaux"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              aria-label="Próximo depoimento"
              className="flex size-11 items-center justify-center rounded-full border border-charcoal/15 text-charcoal transition-colors hover:border-bordeaux hover:text-bordeaux focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bordeaux"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <div className="mt-12 overflow-hidden" ref={emblaRef}>
            <div className="-ml-6 flex">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="min-w-0 shrink-0 grow-0 basis-full pl-6 sm:basis-1/2 lg:basis-1/3"
                >
                  <TestimonialCard item={item} />
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div
          className="mt-8 flex justify-center gap-2"
          role="tablist"
          aria-label="Selecionar depoimento"
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === selectedIndex}
              aria-label={`Ver depoimento de ${item.name}`}
              onClick={() => scrollTo(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === selectedIndex ? "w-8 bg-bordeaux" : "w-2 bg-charcoal/20"
              )}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
