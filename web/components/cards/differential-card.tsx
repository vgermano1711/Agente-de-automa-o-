import type { Differential } from "@/types/content";

interface DifferentialCardProps {
  item: Differential;
}

export function DifferentialCard({ item }: DifferentialCardProps) {
  const Icon = item.icon;
  return (
    <div className="group relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl border border-ivory/10 bg-graphite/40 p-8 transition-all duration-500 hover:-translate-y-1.5 hover:border-gold/40 hover:bg-graphite/70">
      <div className="absolute -right-8 -top-8 size-28 rounded-full bg-gold/0 blur-2xl transition-all duration-500 group-hover:bg-gold/20" />
      <div className="relative flex size-14 items-center justify-center rounded-xl border border-gold/30 bg-charcoal text-gold transition-colors duration-500 group-hover:bg-gold group-hover:text-charcoal">
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="relative flex flex-col gap-2">
        <h3 className="font-display text-xl font-medium text-ivory">{item.title}</h3>
        <p className="text-sm leading-relaxed text-ivory/65">{item.description}</p>
      </div>
    </div>
  );
}
