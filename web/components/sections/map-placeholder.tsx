import { MapPin, Navigation } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import type { SiteSettings } from "@/types/site";

interface MapPlaceholderProps {
  settings: SiteSettings;
}

// Placeholder visual pronto pra virar um embed real do Google Maps —
// troque o conteúdo do <div> abaixo por um <iframe> com a chave da API
// quando ela existir. Nenhum outro componente depende disso.
export function MapPlaceholder({ settings }: MapPlaceholderProps) {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    settings.address.mapsQuery
  )}`;

  return (
    <section className="bg-charcoal pb-24 md:pb-32">
      <Container>
        <Reveal>
          <div className="relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-3xl border border-ivory/10 bg-[radial-gradient(circle_at_30%_30%,rgba(201,162,39,0.12),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(107,15,26,0.25),transparent_55%)] bg-graphite/40">
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #F3EDE1 1px, transparent 1px), linear-gradient(to bottom, #F3EDE1 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
              aria-hidden
            />
            <div className="relative flex flex-col items-center gap-4 text-center">
              <span className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-charcoal text-gold">
                <MapPin className="size-6" aria-hidden />
              </span>
              <div>
                <p className="font-display text-xl text-ivory">
                  {settings.address.street} — {settings.address.neighborhood}
                </p>
                <p className="text-sm text-ivory/60">
                  {settings.address.city}/{settings.address.state} · {settings.address.zip}
                </p>
              </div>
              <Button asChild variant="secondary">
                <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                  <Navigation className="size-4" aria-hidden />
                  Traçar rota
                </a>
              </Button>
              <p className="text-xs text-ivory/35">Mapa interativo em breve</p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
