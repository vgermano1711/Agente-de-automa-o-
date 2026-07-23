import type { GalleryImage } from "@/types/content";

// TROQUE AQUI — fotos reais do salão, forno e pizzas. `span` controla o
// tamanho do item no grid assimétrico (ver components/sections/Gallery.tsx).
export const gallery: GalleryImage[] = [
  {
    id: "g1",
    src: "/images/gallery-01.svg",
    alt: "Pizza recém-saída do forno à lenha",
    span: "tall",
  },
  {
    id: "g2",
    src: "/images/gallery-02.svg",
    alt: "Massa sendo aberta à mão no balcão",
    span: "wide",
  },
  {
    id: "g3",
    src: "/images/gallery-03.svg",
    alt: "Detalhe da borda crocante da pizza",
    span: "md",
  },
  { id: "g4", src: "/images/gallery-04.svg", alt: "Ingredientes frescos selecionados", span: "sm" },
  {
    id: "g5",
    src: "/images/gallery-05.svg",
    alt: "Salão da pizzaria em uma noite de movimento",
    span: "wide",
  },
  { id: "g6", src: "/images/gallery-06.svg", alt: "Fatia de pizza sendo servida", span: "md" },
  { id: "g7", src: "/images/gallery-07.svg", alt: "Forno à lenha aceso", span: "tall" },
  {
    id: "g8",
    src: "/images/gallery-08.svg",
    alt: "Pizza especial com toppings nobres",
    span: "sm",
  },
];
