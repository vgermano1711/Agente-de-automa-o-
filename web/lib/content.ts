import { siteSettings } from "@/data/settings";
import { testimonials } from "@/data/testimonials";
import { gallery } from "@/data/gallery";
import { faq } from "@/data/faq";
import { differentials } from "@/data/differentials";
import { promotions } from "@/data/promotions";
import { howItWorksSteps } from "@/data/how-it-works";

// Mesma ideia de lib/menu.ts: hoje lê /data local, amanhã pode virar fetch
// numa API própria sem precisar tocar em nenhum componente.
export async function getSiteSettings() {
  return siteSettings;
}

export async function getTestimonials() {
  return testimonials;
}

export async function getGalleryImages() {
  return gallery;
}

export async function getFaqItems() {
  return faq;
}

export async function getDifferentials() {
  return differentials;
}

export async function getPromotions() {
  return promotions;
}

export async function getHowItWorksSteps() {
  return howItWorksSteps;
}
