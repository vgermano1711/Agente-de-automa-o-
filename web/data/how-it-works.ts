import { ClipboardList, ChefHat, Bike as BikeIcon } from "lucide-react";
import type { HowItWorksStep } from "@/types/content";

// TROQUE AQUI — passos do "como funciona".
export const howItWorksSteps: HowItWorksStep[] = [
  {
    id: "escolha",
    title: "Escolha seu sabor",
    description: "Navegue pelo cardápio, filtre por categoria ou pesquise o que der vontade.",
    icon: ClipboardList,
  },
  {
    id: "preparo",
    title: "Vai direto pro forno",
    description: "Sua pizza é montada e assada na hora, no forno à lenha, sem fila de espera.",
    icon: ChefHat,
  },
  {
    id: "entrega",
    title: "Chega quentinha",
    description: "Entrega roteirizada pro seu bairro ou retirada rápida no balcão.",
    icon: BikeIcon,
  },
];
