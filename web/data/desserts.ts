import type { MenuItem } from "@/types/menu";

// TROQUE AQUI — sobremesas (além das pizzas doces, já listadas em pizzas.ts).
export const desserts: MenuItem[] = [
  {
    id: "tiramisu",
    category: "sobremesas",
    name: "Tiramisù da Casa",
    description: "Receita italiana clássica, com café espresso e mascarpone.",
    ingredients: ["Biscoito champagne", "Café espresso", "Mascarpone", "Cacau em pó"],
    price: 28.0,
    image: "/images/dessert-tiramisu.svg",
    tags: ["mais-vendida", "vegetariana"],
  },
  {
    id: "petit-gateau",
    category: "sobremesas",
    name: "Petit Gâteau",
    description: "Casquinha crocante, recheio cremoso e sorvete de creme.",
    ingredients: ["Chocolate 70%", "Sorvete de creme", "Calda de frutas vermelhas"],
    price: 32.0,
    image: "/images/dessert-petit-gateau.svg",
    tags: ["vegetariana"],
  },
];
