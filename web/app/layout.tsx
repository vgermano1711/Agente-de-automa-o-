import type { Metadata } from "next";
import { Playfair_Display, Manrope } from "next/font/google";
import { siteSettings } from "@/data/settings";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

// TROQUE AQUI quando o domínio definitivo estiver no ar.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://germanospizza.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${siteSettings.name} — ${siteSettings.tagline}`,
    template: `%s — ${siteSettings.shortName}`,
  },
  description: siteSettings.description,
  keywords: [
    "pizzaria",
    "pizza artesanal",
    "forno à lenha",
    "delivery de pizza",
    "pizzaria São Paulo",
    "Vila Mariana",
  ],
  authors: [{ name: siteSettings.name }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: siteSettings.name,
    title: siteSettings.name,
    description: siteSettings.description,
    images: [{ url: "/images/hero-bg.svg", width: 1920, height: 1080, alt: siteSettings.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteSettings.name,
    description: siteSettings.description,
    images: ["/images/hero-bg.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

function RestaurantJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: siteSettings.name,
    description: siteSettings.description,
    servesCuisine: "Pizza",
    url: SITE_URL,
    telephone: siteSettings.phone,
    email: siteSettings.email,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: siteSettings.address.street,
      addressLocality: siteSettings.address.city,
      addressRegion: siteSettings.address.state,
      postalCode: siteSettings.address.zip,
      addressCountry: "BR",
    },
    openingHoursSpecification: siteSettings.hours
      .filter((h) => h.hours !== "Fechado")
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: h.days,
        description: h.hours,
      })),
    sameAs: siteSettings.socials.map((s) => s.href),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${playfair.variable} ${manrope.variable} scroll-smooth antialiased`}
    >
      <head>
        <RestaurantJsonLd />
      </head>
      <body className="min-h-screen bg-ivory font-body text-charcoal">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
