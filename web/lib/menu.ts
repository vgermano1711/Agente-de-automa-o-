import { pizzas } from "@/data/pizzas";
import { drinks } from "@/data/drinks";
import { desserts } from "@/data/desserts";
import type { MenuCategory, MenuItem, MenuTag } from "@/types/menu";

// Camada de acesso ao cardápio. Hoje lê arrays locais; no dia em que existir
// uma API própria, só o corpo destas funções muda (pra `fetch(...)`, por
// exemplo) — nenhum componente que as consome precisa saber a diferença,
// já que todas retornam Promise.
export const menuCategories: MenuCategory[] = [
  {
    id: "tradicionais",
    label: "Tradicionais",
    description: "Os clássicos que nunca saem de moda.",
  },
  { id: "especiais", label: "Especiais", description: "Combinações autorais da casa." },
  { id: "doces", label: "Doces", description: "Pra fechar a noite com chave de ouro." },
  { id: "bebidas", label: "Bebidas", description: "Pra acompanhar sem errar." },
  { id: "sobremesas", label: "Sobremesas", description: "Além da pizza, claro." },
];

export async function getAllMenuItems(): Promise<MenuItem[]> {
  return [...pizzas, ...drinks, ...desserts];
}

export async function getMenuCategories(): Promise<MenuCategory[]> {
  return menuCategories;
}

export async function getMenuItemsByCategory(
  categoryId: MenuItem["category"]
): Promise<MenuItem[]> {
  const items = await getAllMenuItems();
  return items.filter((item) => item.category === categoryId);
}

export interface MenuFilters {
  query?: string;
  category?: MenuItem["category"] | "todas";
  tag?: MenuTag | "todas";
  maxPrice?: number;
}

/** Filtro local (sem backend) usado pela busca instantânea do cardápio. */
export function filterMenuItems(items: MenuItem[], filters: MenuFilters): MenuItem[] {
  const query = filters.query?.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.category && filters.category !== "todas" && item.category !== filters.category) {
      return false;
    }

    if (filters.tag && filters.tag !== "todas" && !item.tags?.includes(filters.tag)) {
      return false;
    }

    if (typeof filters.maxPrice === "number" && item.price > filters.maxPrice) {
      return false;
    }

    if (query) {
      const haystack = [item.name, item.description, ...item.ingredients].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}
