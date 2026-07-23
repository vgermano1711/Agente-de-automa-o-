import Image from "next/image";
import { Star } from "lucide-react";
import type { Testimonial } from "@/types/content";

interface TestimonialCardProps {
  item: Testimonial;
}

export function TestimonialCard({ item }: TestimonialCardProps) {
  return (
    <figure className="flex h-full flex-col justify-between gap-6 rounded-2xl border border-charcoal/10 bg-white p-8 shadow-[0_1px_2px_rgba(28,27,26,0.04)]">
      <div
        className="flex gap-1 text-gold"
        role="img"
        aria-label={`Avaliação: ${item.rating} de 5 estrelas`}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="size-4"
            fill={i < item.rating ? "currentColor" : "none"}
            aria-hidden
          />
        ))}
      </div>

      <blockquote className="font-display text-lg leading-relaxed text-charcoal">
        “{item.quote}”
      </blockquote>

      <figcaption className="flex items-center gap-3 pt-2">
        <Image
          src={item.avatar}
          alt=""
          width={44}
          height={44}
          className="rounded-full"
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold text-charcoal">{item.name}</p>
          <p className="text-xs text-graphite/80">{item.location}</p>
        </div>
      </figcaption>
    </figure>
  );
}
