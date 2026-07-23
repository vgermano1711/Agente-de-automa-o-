"use client";

import { useMemo, useState } from "react";
import { filterMenuItems } from "@/lib/menu";
import type { MenuCategoryId, MenuItem, MenuTag } from "@/types/menu";

/** Estado + lógica da busca instantânea e filtros do cardápio (100% client-side). */
export function useMenuFilter(items: MenuItem[]) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MenuCategoryId | "todas">("todas");
  const [tag, setTag] = useState<MenuTag | "todas">("todas");
  const [maxPrice, setMaxPrice] = useState<number>(80);

  const filteredItems = useMemo(
    () => filterMenuItems(items, { query, category, tag, maxPrice }),
    [items, query, category, tag, maxPrice]
  );

  const resetFilters = () => {
    setQuery("");
    setCategory("todas");
    setTag("todas");
    setMaxPrice(80);
  };

  return {
    query,
    setQuery,
    category,
    setCategory,
    tag,
    setTag,
    maxPrice,
    setMaxPrice,
    filteredItems,
    resetFilters,
  };
}
