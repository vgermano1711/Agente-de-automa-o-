"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-bordeaux text-ivory shadow-[0_8px_24px_-8px_rgba(107,15,26,0.6)] hover:bg-bordeaux-dark hover:-translate-y-0.5 focus-visible:ring-gold",
        secondary:
          "border border-ivory/25 bg-transparent text-ivory hover:border-gold hover:text-gold hover:-translate-y-0.5 focus-visible:ring-gold",
        outline:
          "border border-charcoal/15 bg-transparent text-charcoal hover:border-bordeaux hover:text-bordeaux focus-visible:ring-bordeaux",
        ghost: "text-charcoal hover:text-bordeaux focus-visible:ring-bordeaux",
        gold: "bg-gold text-charcoal hover:bg-gold-soft hover:-translate-y-0.5 focus-visible:ring-charcoal",
      },
      size: {
        default: "h-12 px-7",
        sm: "h-10 px-5 text-xs",
        lg: "h-14 px-9 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
