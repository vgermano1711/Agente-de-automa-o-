import type { SiteSettings } from "@/types/site";

// TROQUE AQUI — dados institucionais. Tudo que aparece no header, rodapé,
// contato e schema.org (SEO) vem centralizado deste arquivo.
export const siteSettings: SiteSettings = {
  name: "Braseiro Pizzaria",
  shortName: "Braseiro",
  tagline: "A pizza perfeita começa com ingredientes de verdade.",
  description:
    "Pizzaria artesanal com forno à lenha, massa de fermentação natural e ingredientes selecionados. Delivery e balcão na Vila Mariana, São Paulo.",
  foundedYear: 2011,
  phone: "+5511987654321",
  phoneDisplay: "(11) 98765-4321",
  whatsapp: "5511987654321",
  email: "contato@braseiropizzaria.com.br",
  address: {
    street: "Rua Coronel Oscar Porto, 210",
    neighborhood: "Vila Mariana",
    city: "São Paulo",
    state: "SP",
    zip: "04003-000",
    mapsQuery: "Rua Coronel Oscar Porto, 210, Vila Mariana, São Paulo, SP",
  },
  hours: [
    { label: "Terça a sexta", days: "ter-sex", hours: "18h30 às 23h30" },
    { label: "Sábado", days: "sab", hours: "18h00 às 00h00" },
    { label: "Domingo", days: "dom", hours: "18h00 às 23h00" },
    { label: "Segunda", days: "seg", hours: "Fechado" },
  ],
  socials: [
    { label: "Instagram", href: "https://instagram.com", icon: "instagram" },
    { label: "Facebook", href: "https://facebook.com", icon: "facebook" },
    { label: "WhatsApp", href: "https://wa.me/5511987654321", icon: "whatsapp" },
  ],
  stats: [
    { value: 15, suffix: "+", label: "anos de forno à lenha" },
    { value: 50, suffix: "+", label: "sabores no cardápio" },
    { value: 100, suffix: "mil+", label: "clientes atendidos" },
    { value: 48, suffix: "h", label: "de fermentação natural" },
  ],
};
