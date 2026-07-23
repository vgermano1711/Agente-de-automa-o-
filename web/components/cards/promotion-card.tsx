import Image from "next/image";
import { Ticket } from "lucide-react";
import type { Promotion } from "@/types/content";

interface PromotionCardProps {
  promotion: Promotion;
}

export function PromotionCard({ promotion }: PromotionCardProps) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-ivory/10 bg-graphite/40 transition-all duration-500 hover:-translate-y-1.5 hover:border-gold/40">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={promotion.image}
          alt=""
          fill
          aria-hidden
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wider text-charcoal">
          {promotion.discountLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <h3 className="font-display text-lg font-medium text-ivory">{promotion.title}</h3>
        <p className="text-sm leading-relaxed text-ivory/65">{promotion.description}</p>

        <div className="mt-auto flex items-center gap-2 rounded-lg border border-dashed border-gold/40 px-3 py-2 text-sm text-gold">
          <Ticket className="size-4 shrink-0" aria-hidden />
          <span className="font-mono tracking-widest">{promotion.code}</span>
        </div>
      </div>
    </article>
  );
}
