"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal, StaggerGroup } from "@/components/ui/reveal";
import { GalleryItem } from "@/components/cards/gallery-item";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLightbox } from "@/hooks/use-lightbox";
import type { GalleryImage } from "@/types/content";

interface GallerySectionProps {
  images: GalleryImage[];
}

export function GallerySection({ images }: GallerySectionProps) {
  const { activeIndex, open, close, next, prev } = useLightbox(images.length);
  const activeImage = activeIndex !== null ? images[activeIndex] : null;

  return (
    <section id="galeria" className="bg-charcoal py-24 md:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Galeria"
            title="Da massa ao forno, do forno até você."
            tone="dark"
          />
        </Reveal>

        <StaggerGroup
          className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:auto-rows-[180px]"
          stagger={0.06}
        >
          {images.map((image, i) => (
            <GalleryItem key={image.id} image={image} onOpen={() => open(i)} />
          ))}
        </StaggerGroup>
      </Container>

      <Dialog open={activeIndex !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-4xl">
          <DialogTitle className="sr-only">{activeImage?.alt ?? "Foto da galeria"}</DialogTitle>
          {activeImage && (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-graphite">
              <Image
                src={activeImage.src}
                alt={activeImage.alt}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </div>
          )}

          <button
            type="button"
            onClick={prev}
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/60 text-ivory transition-colors hover:bg-bordeaux focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold md:-left-14"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Próxima foto"
            className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/60 text-ivory transition-colors hover:bg-bordeaux focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold md:-right-14"
          >
            <ChevronRight className="size-6" aria-hidden />
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
