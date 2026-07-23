"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GalleryImage } from "@/types/content";

const SPAN_CLASSES: Record<GalleryImage["span"], string> = {
  sm: "md:col-span-1 md:row-span-1 aspect-square",
  md: "md:col-span-1 md:row-span-1 aspect-[4/5]",
  lg: "md:col-span-2 md:row-span-2 aspect-square",
  tall: "md:col-span-1 md:row-span-2 aspect-[3/5]",
  wide: "md:col-span-2 md:row-span-1 aspect-[16/9]",
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

interface GalleryItemProps {
  image: GalleryImage;
  onOpen: () => void;
}

export function GalleryItem({ image, onOpen }: GalleryItemProps) {
  return (
    <motion.button
      type="button"
      variants={itemVariants}
      onClick={onOpen}
      className={cn(
        "group relative overflow-hidden rounded-xl aspect-square focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal",
        SPAN_CLASSES[image.span]
      )}
      aria-label={`Ampliar foto: ${image.alt}`}
    >
      <Image
        src={image.src}
        alt={image.alt}
        fill
        loading="lazy"
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-charcoal/0 opacity-0 transition-all duration-300 group-hover:bg-charcoal/40 group-hover:opacity-100">
        <Expand className="size-6 text-ivory" aria-hidden />
      </div>
    </motion.button>
  );
}
