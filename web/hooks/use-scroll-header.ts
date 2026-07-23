"use client";

import { useEffect, useState } from "react";

/**
 * Controla a transição do header: transparente no topo, com fundo
 * desfocado (blur) e sombra depois de rolar `threshold` pixels.
 */
export function useScrollHeader(threshold = 24) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return isScrolled;
}
