import { getAllMenuItems, getMenuCategories } from "@/lib/menu";
import {
  getSiteSettings,
  getTestimonials,
  getGalleryImages,
  getFaqItems,
  getDifferentials,
  getPromotions,
  getHowItWorksSteps,
} from "@/lib/content";

import { Header } from "@/components/sections/header";
import { Hero } from "@/components/sections/hero";
import { About } from "@/components/sections/about";
import { Differentials } from "@/components/sections/differentials";
import { MenuSection } from "@/components/sections/menu";
import { Promotions } from "@/components/sections/promotions";
import { GallerySection } from "@/components/sections/gallery";
import { Testimonials } from "@/components/sections/testimonials";
import { HowItWorks } from "@/components/sections/how-it-works";
import { FaqSection } from "@/components/sections/faq";
import { Contact } from "@/components/sections/contact";
import { MapPlaceholder } from "@/components/sections/map-placeholder";
import { Footer } from "@/components/sections/footer";

// Server Component: hoje todo o conteúdo vem de /data (via lib/*), mas como
// cada chamada já é `await`, trocar por uma API própria no futuro é uma
// mudança isolada em lib/*.ts — nenhuma seção abaixo precisa mudar.
export default async function Home() {
  const [
    settings,
    menuItems,
    menuCategories,
    testimonials,
    galleryImages,
    faqItems,
    differentials,
    promotions,
    howItWorksSteps,
  ] = await Promise.all([
    getSiteSettings(),
    getAllMenuItems(),
    getMenuCategories(),
    getTestimonials(),
    getGalleryImages(),
    getFaqItems(),
    getDifferentials(),
    getPromotions(),
    getHowItWorksSteps(),
  ]);

  return (
    <>
      <Header settings={settings} />
      <main>
        <Hero settings={settings} />
        <About settings={settings} />
        <Differentials items={differentials} />
        <MenuSection items={menuItems} categories={menuCategories} />
        <Promotions promotions={promotions} />
        <GallerySection images={galleryImages} />
        <Testimonials items={testimonials} />
        <HowItWorks steps={howItWorksSteps} />
        <FaqSection items={faqItems} />
        <Contact settings={settings} />
        <MapPlaceholder settings={settings} />
      </main>
      <Footer settings={settings} />
    </>
  );
}
