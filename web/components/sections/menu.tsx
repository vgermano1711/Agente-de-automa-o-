"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { Input } from "@/components/ui/input";
import { PizzaCard } from "@/components/cards/pizza-card";
import { useMenuFilter } from "@/hooks/use-menu-filter";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuItem, MenuTag } from "@/types/menu";

const TAG_OPTIONS: { value: MenuTag | "todas"; label: string }[] = [
  { value: "todas", label: "Todas as etiquetas" },
  { value: "mais-vendida", label: "Mais vendida" },
  { value: "novidade", label: "Novidade" },
  { value: "promocao", label: "Promoção" },
  { value: "picante", label: "Picante" },
  { value: "vegetariana", label: "Vegetariana" },
];

interface MenuSectionProps {
  items: MenuItem[];
  categories: MenuCategory[];
}

export function MenuSection({ items, categories }: MenuSectionProps) {
  const {
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
  } = useMenuFilter(items);

  return (
    <section id="cardapio" className="bg-ivory py-24 md:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Cardápio"
            title="Um sabor pra cada momento."
            description="Busque pelo nome, filtre por categoria, etiqueta ou faixa de preço — tudo instantâneo, direto no navegador."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-col gap-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-[0_1px_2px_rgba(28,27,26,0.04)] md:p-8">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-graphite/40"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por sabor ou ingrediente (ex: gorgonzola)"
                className="pl-11"
                aria-label="Buscar no cardápio"
              />
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
              <button
                type="button"
                onClick={() => setCategory("todas")}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  category === "todas"
                    ? "border-bordeaux bg-bordeaux text-ivory"
                    : "border-charcoal/15 text-charcoal hover:border-bordeaux hover:text-bordeaux"
                )}
                aria-pressed={category === "todas"}
              >
                Todas
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    category === cat.id
                      ? "border-bordeaux bg-bordeaux text-ivory"
                      : "border-charcoal/15 text-charcoal hover:border-bordeaux hover:text-bordeaux"
                  )}
                  aria-pressed={category === cat.id}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-graphite/70">
                Etiqueta
                <select
                  value={tag}
                  onChange={(e) => setTag(e.target.value as MenuTag | "todas")}
                  className="h-12 rounded-lg border border-charcoal/15 bg-white px-4 text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bordeaux"
                >
                  {TAG_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-graphite/70">
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="size-3.5" aria-hidden />
                  Preço até {formatPrice(maxPrice)}
                </span>
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={2}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="h-12 w-full accent-bordeaux"
                  aria-label="Filtrar por preço máximo"
                />
              </label>
            </div>
          </div>
        </Reveal>

        <div className="mt-6 flex items-center justify-between text-sm text-graphite/80">
          <span>
            {filteredItems.length}{" "}
            {filteredItems.length === 1 ? "item encontrado" : "itens encontrados"}
          </span>
          <button
            type="button"
            onClick={resetFilters}
            className="font-medium text-bordeaux underline-offset-4 hover:underline"
          >
            Limpar filtros
          </button>
        </div>

        <motion.div layout className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <PizzaCard key={item.id} item={item} />
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredItems.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-charcoal/20 p-12 text-center text-graphite/80">
            Nenhum item encontrado com esses filtros. Tente ampliar a busca.
          </div>
        )}
      </Container>
    </section>
  );
}
