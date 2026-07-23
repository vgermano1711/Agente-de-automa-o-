import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider",
  {
    variants: {
      variant: {
        bordeaux: "bg-bordeaux text-ivory",
        gold: "bg-gold text-charcoal",
        outline: "border border-current text-charcoal",
        charcoal: "bg-charcoal text-ivory",
      },
    },
    defaultVariants: {
      variant: "bordeaux",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
