import type { Testimonial } from "@/types/content";

// TROQUE AQUI — depoimentos reais de clientes (nomes e fotos são fictícios).
export const testimonials: Testimonial[] = [
  {
    id: "t1",
    name: "Marina Ferraz",
    location: "Vila Mariana, SP",
    rating: 5,
    quote:
      "A massa é completamente diferente de qualquer pizzaria da região. Dá pra sentir a fermentação natural. Virou tradição de sexta-feira aqui em casa.",
    avatar: "/images/avatar-01.svg",
  },
  {
    id: "t2",
    name: "Ricardo Santoro",
    location: "Paraíso, SP",
    rating: 5,
    quote:
      "Pedimos toda semana pelo delivery e a pizza sempre chega quente, no ponto. O atendimento pelo WhatsApp também é rápido e atencioso.",
    avatar: "/images/avatar-02.svg",
  },
  {
    id: "t3",
    name: "Camila Andrade",
    location: "Ibirapuera, SP",
    rating: 5,
    quote:
      "A Figo com Gorgonzola é surreal. Nunca tinha visto uma pizzaria com esse nível de cuidado num sabor especial.",
    avatar: "/images/avatar-03.svg",
  },
  {
    id: "t4",
    name: "Thiago Lemos",
    location: "Vila Clementino, SP",
    rating: 4,
    quote:
      "Ambiente aconchegante e forno à lenha de verdade — dá pra ver o processo todo pelo balcão. Recomendo demais.",
    avatar: "/images/avatar-04.svg",
  },
  {
    id: "t5",
    name: "Patrícia Bezerra",
    location: "Vila Mariana, SP",
    rating: 5,
    quote:
      "Sempre que tenho visita em casa, peço a Quatro Queijos e todo mundo pergunta a receita. Impecável.",
    avatar: "/images/avatar-05.svg",
  },
  {
    id: "t6",
    name: "João Nakamura",
    location: "Saúde, SP",
    rating: 5,
    quote: "A pizza de chocolate belga fechou o jantar com chave de ouro. Vamos voltar sempre.",
    avatar: "/images/avatar-06.svg",
  },
];
