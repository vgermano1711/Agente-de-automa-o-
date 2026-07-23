import type { Promotion } from "@/types/content";

// TROQUE AQUI — promoções ativas. `endsAt` é só ilustrativo: o countdown
// visual (ver hooks/use-countdown.ts) sempre mira o fim da semana corrente,
// pra nunca aparecer "expirado" enquanto o conteúdo não for atualizado.
export const promotions: Promotion[] = [
  {
    id: "promo-terca",
    title: "Terça é dia de Germano's",
    description: "Todas as pizzas tradicionais com 20% de desconto, só na terça-feira.",
    code: "TERCA20",
    discountLabel: "20% OFF",
    image: "/images/promo-banner.svg",
    endsAt: "2026-12-31T23:59:59-03:00",
  },
  {
    id: "promo-combo",
    title: "Combo Casal",
    description: "2 pizzas médias + refrigerante 2L com preço especial pra dividir.",
    code: "CASALGERMANOS",
    discountLabel: "R$ 20 OFF",
    image: "/images/gallery-06.svg",
    endsAt: "2026-12-31T23:59:59-03:00",
  },
  {
    id: "promo-primeira-compra",
    title: "Primeiro pedido",
    description: "Ganhe uma sobremesa cortesia no seu primeiro pedido pelo site.",
    code: "BEMVINDO",
    discountLabel: "Brinde grátis",
    image: "/images/dessert-petit-gateau.svg",
    endsAt: "2026-12-31T23:59:59-03:00",
  },
];
