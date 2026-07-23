import type { MenuItem } from "@/types/menu";

// TROQUE AQUI — bebidas do cardápio.
export const drinks: MenuItem[] = [
  {
    id: "refrigerante-lata",
    category: "bebidas",
    name: "Refrigerante Lata 350ml",
    description: "Coca-Cola, Guaraná ou Sprite geladíssimos.",
    ingredients: ["Coca-Cola", "Guaraná Antarctica", "Sprite"],
    price: 7.0,
    image: "/images/drink-refrigerante.svg",
  },
  {
    id: "refrigerante-2l",
    category: "bebidas",
    name: "Refrigerante 2L",
    description: "Pra compartilhar com a família ou com quem topar dividir a pizza.",
    ingredients: ["Coca-Cola 2L", "Guaraná Antarctica 2L"],
    price: 12.0,
    image: "/images/drink-refrigerante.svg",
  },
  {
    id: "suco-natural",
    category: "bebidas",
    name: "Suco Natural 500ml",
    description: "Feito na hora, sem adição de açúcar.",
    ingredients: ["Fruta da estação", "Água ou água de coco"],
    price: 12.0,
    image: "/images/drink-suco.svg",
    tags: ["vegetariana"],
  },
  {
    id: "cerveja-artesanal",
    category: "bebidas",
    name: "Cerveja Artesanal 500ml",
    description: "Rótulos de cervejarias locais, sempre gelada.",
    ingredients: ["IPA", "Pilsen", "Weiss"],
    price: 18.0,
    image: "/images/drink-cerveja.svg",
    tags: ["novidade"],
  },
];
