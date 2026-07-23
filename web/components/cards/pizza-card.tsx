"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Flame, Sparkles, Tag as TagIcon, Leaf, Percent, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import type { MenuItem, MenuTag } from "@/types/menu";

const TAG_META: Record<MenuTag, { label: string; icon: LucideIcon }> = {
  "mais-vendida": { label: "Mais vendida", icon: Sparkles },
  novidade: { label: "Novidade", icon: TagIcon },
  promocao: { label: "Promoção", icon: Percent },
  picante: { label: "Picante", icon: Flame },
  vegetariana: { label: "Vegetariana", icon: Leaf },
};

interface PizzaCardProps {
  item: MenuItem;
}

export function PizzaCard({ item }: PizzaCardProps) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal/10 bg-white transition-shadow duration-300 hover:shadow-[0_24px_48px_-24px_rgba(28,27,26,0.35)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        {item.tags && item.tags.length > 0 && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => {
              const meta = TAG_META[tag];
              const Icon = meta.icon;
              return (
                <Badge key={tag} variant={tag === "promocao" ? "gold" : "bordeaux"}>
                  <Icon className="size-3" aria-hidden />
                  {meta.label}
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl font-medium text-charcoal">{item.name}</h3>
          <div className="text-right">
            {item.originalPrice && (
              <span className="block text-xs text-graphite/80 line-through">
                {formatPrice(item.originalPrice)}
              </span>
            )}
            <span className="whitespace-nowrap font-display text-lg font-semibold text-bordeaux">
              {formatPrice(item.price)}
            </span>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-graphite/80">{item.description}</p>

        <p className="mt-auto pt-2 text-xs uppercase tracking-wide text-graphite/80">
          {item.ingredients.join(" · ")}
        </p>
      </div>
    </motion.article>
  );
}
