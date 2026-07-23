import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-12 w-full rounded-lg border border-charcoal/15 bg-white px-4 text-sm text-charcoal placeholder:text-graphite/80 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bordeaux focus-visible:border-bordeaux",
          "aria-invalid:border-bordeaux aria-invalid:ring-bordeaux/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
