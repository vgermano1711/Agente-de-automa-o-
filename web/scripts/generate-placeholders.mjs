// Gera imagens placeholder locais (SVG) para o site — sem depender de
// nenhuma imagem externa. Rode com `node scripts/generate-placeholders.mjs`
// sempre que quiser variar as artes antes de substituí-las por fotos reais.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "images");
mkdirSync(OUT, { recursive: true });

const PALETTE = {
  bordeaux: "#6B0F1A",
  bordeauxDark: "#3D0910",
  charcoal: "#1C1B1A",
  graphite: "#332F2C",
  ivory: "#FAF6EF",
  gold: "#C9A227",
  goldSoft: "#E4C77A",
};

function slice({
  crust = PALETTE.gold,
  cheese = "#E8B94D",
  sauce = PALETTE.bordeaux,
  toppings = [],
}) {
  const dots = toppings
    .map((t, i) => `<circle cx="${t.x}" cy="${t.y}" r="${t.r}" fill="${t.color}" opacity="0.92" />`)
    .join("");
  return `
    <g transform="translate(0,0)">
      <path d="M256 60 L452 400 A220 220 0 0 1 60 400 Z" fill="${sauce}" opacity="0.9"/>
      <path d="M256 96 L424 388 A184 184 0 0 1 88 388 Z" fill="${cheese}" opacity="0.95"/>
      ${dots}
      <path d="M256 60 L452 400 A220 220 0 0 1 60 400 Z" fill="none" stroke="${crust}" stroke-width="14" opacity="0.85"/>
    </g>`;
}

function bottle({ liquid = PALETTE.gold, glass = "#EDEADF" }) {
  return `
    <g>
      <path d="M212 40 h96 v70 l28 40 v290 a20 20 0 0 1-20 20 H204 a20 20 0 0 1-20-20 V150 l28-40 Z" fill="${glass}" opacity="0.18"/>
      <path d="M198 190 h124 v246 a16 16 0 0 1-16 16 H214 a16 16 0 0 1-16-16 Z" fill="${liquid}" opacity="0.9"/>
      <rect x="212" y="40" width="96" height="46" rx="10" fill="${glass}" opacity="0.3"/>
    </g>`;
}

function plate({ fill = PALETTE.gold }) {
  return `
    <g>
      <circle cx="256" cy="230" r="200" fill="none" stroke="${fill}" stroke-width="10" opacity="0.35"/>
      <circle cx="256" cy="230" r="150" fill="${fill}" opacity="0.85"/>
      <path d="M256 120 a110 110 0 0 1 95 165" stroke="${PALETTE.ivory}" stroke-width="8" fill="none" opacity="0.4"/>
    </g>`;
}

function svgWrap({ w, h, bgFrom, bgTo, angle = 135, content, id }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ilustração da Braseiro Pizzaria">
  <defs>
    <linearGradient id="bg-${id}" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${bgFrom}" />
      <stop offset="100%" stop-color="${bgTo}" />
    </linearGradient>
    <filter id="grain-${id}">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg-${id})" />
  <g transform="translate(${w / 2 - 256}, ${h / 2 - 230})" filter="url(#grain-${id})">
    ${content}
  </g>
</svg>`;
}

const items = [
  // Hero + institucional
  {
    file: "hero-bg.svg",
    w: 1920,
    h: 1080,
    angle: 160,
    bgFrom: PALETTE.charcoal,
    bgTo: PALETTE.bordeauxDark,
    content: slice({
      toppings: [
        { x: 180, y: 220, r: 22, color: PALETTE.bordeauxDark },
        { x: 280, y: 260, r: 18, color: PALETTE.bordeauxDark },
        { x: 220, y: 320, r: 20, color: PALETTE.bordeauxDark },
        { x: 320, y: 200, r: 16, color: PALETTE.bordeauxDark },
      ],
    }),
  },
  {
    file: "about.svg",
    w: 1200,
    h: 1400,
    angle: 145,
    bgFrom: PALETTE.graphite,
    bgTo: PALETTE.charcoal,
    content: slice({
      toppings: [
        { x: 200, y: 240, r: 20, color: "#2E5B3B" },
        { x: 300, y: 210, r: 16, color: "#2E5B3B" },
        { x: 250, y: 300, r: 18, color: PALETTE.bordeauxDark },
      ],
    }),
  },
  // Pizzas tradicionais
  {
    file: "pizza-marguerita.svg",
    w: 900,
    h: 900,
    angle: 120,
    bgFrom: "#EFE6D3",
    bgTo: "#DACBA5",
    content: slice({
      toppings: [
        { x: 200, y: 230, r: 14, color: "#2E5B3B" },
        { x: 300, y: 260, r: 12, color: "#2E5B3B" },
        { x: 250, y: 310, r: 13, color: "#2E5B3B" },
        { x: 180, y: 300, r: 11, color: "#2E5B3B" },
      ],
    }),
  },
  {
    file: "pizza-calabresa.svg",
    w: 900,
    h: 900,
    angle: 120,
    bgFrom: "#EFE6D3",
    bgTo: "#DACBA5",
    content: slice({
      toppings: Array.from({ length: 10 }).map((_, i) => ({
        x: 140 + ((i * 37) % 300),
        y: 210 + ((i * 53) % 180),
        r: 12,
        color: PALETTE.bordeauxDark,
      })),
    }),
  },
  {
    file: "pizza-mussarela.svg",
    w: 900,
    h: 900,
    angle: 120,
    bgFrom: "#EFE6D3",
    bgTo: "#DACBA5",
    content: slice({}),
  },
  {
    file: "pizza-portuguesa.svg",
    w: 900,
    h: 900,
    angle: 120,
    bgFrom: "#EFE6D3",
    bgTo: "#DACBA5",
    content: slice({
      toppings: [
        { x: 200, y: 230, r: 16, color: "#F4E7C1" },
        { x: 300, y: 260, r: 14, color: PALETTE.bordeauxDark },
        { x: 250, y: 310, r: 12, color: "#2E5B3B" },
        { x: 180, y: 300, r: 11, color: "#3B2A1A" },
      ],
    }),
  },
  // Especiais
  {
    file: "pizza-quatro-queijos.svg",
    w: 900,
    h: 900,
    angle: 200,
    bgFrom: "#2A2724",
    bgTo: "#171514",
    content: slice({
      cheese: "#F1CD6B",
      toppings: [
        { x: 200, y: 230, r: 15, color: "#E8B94D" },
        { x: 300, y: 260, r: 13, color: "#D8A93A" },
      ],
    }),
  },
  {
    file: "pizza-bacon-cheddar.svg",
    w: 900,
    h: 900,
    angle: 200,
    bgFrom: "#2A2724",
    bgTo: "#171514",
    content: slice({
      cheese: "#E8A93A",
      toppings: Array.from({ length: 8 }).map((_, i) => ({
        x: 150 + ((i * 41) % 280),
        y: 220 + ((i * 37) % 160),
        r: 10,
        color: "#7A2E12",
      })),
    }),
  },
  {
    file: "pizza-figo-gorgonzola.svg",
    w: 900,
    h: 900,
    angle: 200,
    bgFrom: "#2A2724",
    bgTo: "#171514",
    content: slice({
      cheese: "#E9E1CE",
      toppings: [
        { x: 210, y: 250, r: 18, color: "#5B1E3A" },
        { x: 290, y: 280, r: 16, color: "#5B1E3A" },
        { x: 250, y: 220, r: 12, color: PALETTE.gold },
      ],
    }),
  },
  // Doces
  {
    file: "pizza-chocolate.svg",
    w: 900,
    h: 900,
    angle: 90,
    bgFrom: "#3B2A1A",
    bgTo: "#1F160D",
    content: slice({
      cheese: "#5A3A22",
      crust: PALETTE.goldSoft,
      toppings: [
        { x: 220, y: 250, r: 14, color: "#D8A93A" },
        { x: 300, y: 230, r: 10, color: "#F1CD6B" },
      ],
    }),
  },
  {
    file: "pizza-banana-canela.svg",
    w: 900,
    h: 900,
    angle: 90,
    bgFrom: "#3B2A1A",
    bgTo: "#1F160D",
    content: slice({
      cheese: "#E9C86B",
      crust: PALETTE.goldSoft,
      toppings: [
        { x: 220, y: 250, r: 16, color: "#F1E2B0" },
        { x: 300, y: 230, r: 14, color: "#F1E2B0" },
      ],
    }),
  },
  // Bebidas / sobremesas (garrafa ou prato, em vez da "fatia")
  {
    file: "drink-refrigerante.svg",
    w: 700,
    h: 900,
    angle: 100,
    bgFrom: "#1C3B2E",
    bgTo: "#0E1F18",
    content: bottle({ liquid: "#6B3A1A" }),
  },
  {
    file: "drink-suco.svg",
    w: 700,
    h: 900,
    angle: 100,
    bgFrom: "#7A2E12",
    bgTo: "#3B140A",
    content: bottle({ liquid: PALETTE.gold }),
  },
  {
    file: "drink-cerveja.svg",
    w: 700,
    h: 900,
    angle: 100,
    bgFrom: "#8A6A1A",
    bgTo: "#4A3A10",
    content: bottle({ liquid: "#E4C77A", glass: "#2E5B3B" }),
  },
  {
    file: "dessert-tiramisu.svg",
    w: 900,
    h: 900,
    angle: 100,
    bgFrom: "#3B2A1A",
    bgTo: "#1F160D",
    content: plate({ fill: "#C9A87A" }),
  },
  {
    file: "dessert-petit-gateau.svg",
    w: 900,
    h: 900,
    angle: 100,
    bgFrom: "#2A1A12",
    bgTo: "#170D08",
    content: plate({ fill: "#5A3A22" }),
  },
  // Galeria (assimétrica, várias proporções)
  {
    file: "gallery-01.svg",
    w: 900,
    h: 1100,
    angle: 130,
    bgFrom: PALETTE.bordeauxDark,
    bgTo: PALETTE.charcoal,
    content: slice({}),
  },
  {
    file: "gallery-02.svg",
    w: 900,
    h: 700,
    angle: 60,
    bgFrom: "#EFE6D3",
    bgTo: "#DACBA5",
    content: slice({}),
  },
  {
    file: "gallery-03.svg",
    w: 900,
    h: 900,
    angle: 200,
    bgFrom: PALETTE.graphite,
    bgTo: PALETTE.charcoal,
    content: slice({ cheese: "#E8A93A" }),
  },
  {
    file: "gallery-04.svg",
    w: 700,
    h: 900,
    angle: 90,
    bgFrom: "#7A2E12",
    bgTo: "#3B140A",
    content: bottle({ liquid: PALETTE.gold }),
  },
  {
    file: "gallery-05.svg",
    w: 900,
    h: 900,
    angle: 145,
    bgFrom: "#1C3B2E",
    bgTo: "#0E1F18",
    content: slice({ cheese: "#E9E1CE" }),
  },
  {
    file: "gallery-06.svg",
    w: 900,
    h: 700,
    angle: 40,
    bgFrom: PALETTE.bordeauxDark,
    bgTo: "#1F160D",
    content: slice({}),
  },
  {
    file: "gallery-07.svg",
    w: 700,
    h: 900,
    angle: 110,
    bgFrom: "#3B2A1A",
    bgTo: "#1F160D",
    content: plate({ fill: "#C9A87A" }),
  },
  {
    file: "gallery-08.svg",
    w: 900,
    h: 900,
    angle: 180,
    bgFrom: PALETTE.charcoal,
    bgTo: PALETTE.bordeauxDark,
    content: slice({ toppings: [{ x: 220, y: 250, r: 16, color: PALETTE.gold }] }),
  },
  {
    file: "promo-banner.svg",
    w: 1600,
    h: 700,
    angle: 155,
    bgFrom: PALETTE.bordeauxDark,
    bgTo: PALETTE.charcoal,
    content: slice({}),
  },
];

for (const it of items) {
  const svg = svgWrap({ id: it.file.replace(/\W/g, ""), ...it });
  writeFileSync(join(OUT, it.file), svg, "utf-8");
}

// Avatares (monograma simples) para depoimentos
const avatars = [
  { file: "avatar-01.svg", initials: "MF", bg: PALETTE.bordeaux },
  { file: "avatar-02.svg", initials: "RS", bg: PALETTE.graphite },
  { file: "avatar-03.svg", initials: "CA", bg: PALETTE.gold },
  { file: "avatar-04.svg", initials: "TL", bg: PALETTE.bordeauxDark },
  { file: "avatar-05.svg", initials: "PB", bg: "#2E5B3B" },
  { file: "avatar-06.svg", initials: "JN", bg: "#3B2A1A" },
];
for (const a of avatars) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avatar de ${a.initials}">
  <circle cx="100" cy="100" r="100" fill="${a.bg}" />
  <text x="100" y="116" text-anchor="middle" font-family="Georgia, serif" font-size="72" fill="#FAF6EF">${a.initials}</text>
</svg>`;
  writeFileSync(join(OUT, a.file), svg, "utf-8");
}

console.log(`Gerados ${items.length + avatars.length} placeholders em ${OUT}`);
