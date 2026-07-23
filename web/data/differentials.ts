import { Wheat, Flame, Leaf, Bike, HeartHandshake } from "lucide-react";
import type { Differential } from "@/types/content";

// TROQUE AQUI — diferenciais da casa.
export const differentials: Differential[] = [
  {
    id: "massa-artesanal",
    title: "Massa artesanal",
    description: "Fermentação natural de 48 horas, sem atalhos nem aditivos industriais.",
    icon: Wheat,
  },
  {
    id: "forno-a-lenha",
    title: "Forno à lenha",
    description: "Construído à mão, atinge mais de 400°C — o segredo da borda perfeita.",
    icon: Flame,
  },
  {
    id: "ingredientes-frescos",
    title: "Ingredientes frescos",
    description: "Compra diária com fornecedores locais selecionados a dedo.",
    icon: Leaf,
  },
  {
    id: "entrega-rapida",
    title: "Entrega rápida",
    description: "Roteirização inteligente pro seu bairro em até 40 minutos.",
    icon: Bike,
  },
  {
    id: "atendimento-premium",
    title: "Atendimento premium",
    description: "Time treinado pra te tratar como parte da família Germano's.",
    icon: HeartHandshake,
  },
];
