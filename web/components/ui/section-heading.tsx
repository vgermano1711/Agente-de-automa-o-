import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  align?: "left" | "center";
  tone?: "dark" | "light";
  className?: string;
}

/** Cabeçalho reutilizado em (quase) toda seção: selo dourado + título + descrição. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex w-fit items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]",
          tone === "light" ? "border-gold/40 text-bordeaux" : "border-gold/30 text-gold"
        )}
      >
        <span className="size-1.5 rounded-full bg-gold" aria-hidden />
        {eyebrow}
      </span>
      <h2
        className={cn(
          "font-display text-4xl font-medium leading-[1.08] tracking-tight md:text-5xl",
          tone === "light" ? "text-charcoal" : "text-ivory",
          align === "center" && "max-w-2xl"
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "max-w-xl text-base leading-relaxed",
            tone === "light" ? "text-graphite/80" : "text-ivory/70",
            align === "center" && "mx-auto"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
