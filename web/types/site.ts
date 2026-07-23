export interface BusinessHours {
  label: string;
  days: string;
  hours: string;
}

export interface SocialLink {
  label: string;
  href: string;
  icon: "instagram" | "facebook" | "whatsapp" | "tiktok";
}

export interface SiteSettings {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  foundedYear: number;
  phone: string;
  phoneDisplay: string;
  whatsapp: string;
  email: string;
  address: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
    mapsQuery: string;
  };
  hours: BusinessHours[];
  socials: SocialLink[];
  stats: { value: number; suffix: string; label: string }[];
}
