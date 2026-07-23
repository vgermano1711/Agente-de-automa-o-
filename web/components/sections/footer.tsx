import Link from "next/link";
import { Camera, ThumbsUp, MessageCircle, Music2 } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Separator } from "@/components/ui/separator";
import type { SiteSettings } from "@/types/site";

// Lucide não inclui logos de marca — usamos o ícone genérico mais próximo
// do significado de cada rede (câmera pro Instagram, "curtir" pro Facebook...).
const SOCIAL_ICONS = {
  instagram: Camera,
  facebook: ThumbsUp,
  whatsapp: MessageCircle,
  tiktok: Music2,
} as const;

const QUICK_LINKS = [
  { href: "#sobre", label: "Sobre" },
  { href: "#cardapio", label: "Cardápio" },
  { href: "#promocoes", label: "Promoções" },
  { href: "#galeria", label: "Galeria" },
  { href: "#contato", label: "Contato" },
];

interface FooterProps {
  settings: SiteSettings;
}

export function Footer({ settings }: FooterProps) {
  return (
    <footer className="bg-charcoal pt-20">
      <Container>
        <div className="grid gap-12 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <Link href="#topo" className="w-fit font-display text-2xl font-semibold text-ivory">
              {settings.shortName}
              <span className="text-gold">.</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-ivory/60">{settings.description}</p>
            <div className="mt-2 flex gap-3">
              {settings.socials.map((social) => {
                const Icon = SOCIAL_ICONS[social.icon];
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="flex size-10 items-center justify-center rounded-full border border-ivory/15 text-ivory/70 transition-colors hover:border-gold hover:text-gold"
                  >
                    <Icon className="size-4" aria-hidden />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-display text-lg text-ivory">Navegação</h3>
            <ul className="flex flex-col gap-2.5">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-ivory/60 transition-colors hover:text-gold"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-display text-lg text-ivory">Horários</h3>
            <ul className="flex flex-col gap-2.5">
              {settings.hours.map((h) => (
                <li key={h.label} className="flex justify-between gap-4 text-sm text-ivory/60">
                  <span>{h.label}</span>
                  <span className="text-ivory/80">{h.hours}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-display text-lg text-ivory">Contato</h3>
            <ul className="flex flex-col gap-2.5 text-sm text-ivory/60">
              <li>{settings.address.street}</li>
              <li>
                {settings.address.neighborhood}, {settings.address.city}/{settings.address.state}
              </li>
              <li>
                <a href={`tel:${settings.phone}`} className="hover:text-gold">
                  {settings.phoneDisplay}
                </a>
              </li>
              <li>
                <a href={`mailto:${settings.email}`} className="hover:text-gold">
                  {settings.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="bg-ivory/10" />

        <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-ivory/60 sm:flex-row sm:justify-between sm:text-left">
          <p>
            © {new Date().getFullYear()} {settings.name}. Todos os direitos reservados.
          </p>
          <p>Feito sem banco de dados — conteúdo gerenciado em /data.</p>
        </div>
      </Container>
    </footer>
  );
}
