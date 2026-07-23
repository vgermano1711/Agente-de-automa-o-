export type MenuCategoryId = "tradicionais" | "especiais" | "doces" | "bebidas" | "sobremesas";

export interface MenuCategory {
  id: MenuCategoryId;
  label: string;
  description: string;
}

export type MenuTag = "mais-vendida" | "novidade" | "promocao" | "picante" | "vegetariana";

export interface MenuItem {
  id: string;
  category: MenuCategoryId;
  name: string;
  description: string;
  ingredients: string[];
  price: number;
  /** Preço original, presente só quando o item está em promoção. */
  originalPrice?: number;
  image: string;
  tags?: MenuTag[];
}
