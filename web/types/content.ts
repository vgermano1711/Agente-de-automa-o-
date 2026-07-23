import type { LucideIcon } from "lucide-react";

export interface Differential {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  rating: 1 | 2 | 3 | 4 | 5;
  quote: string;
  avatar: string;
}

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  /** Controla o tamanho do item no grid assimétrico. */
  span: "sm" | "md" | "lg" | "tall" | "wide";
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface HowItWorksStep {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  code: string;
  discountLabel: string;
  image: string;
  /** Data-alvo (ISO) usada só pro countdown visual — não é validado em servidor. */
  endsAt: string;
}
