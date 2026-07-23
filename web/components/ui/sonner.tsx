"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "bg-charcoal! text-ivory! border! border-gold/30! rounded-xl! shadow-xl! font-body!",
          title: "font-medium!",
          description: "text-ivory/70!",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
