// Génère les icônes PWA (PNG) à partir du logo SVG. Usage : npm run icons
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";

const mark = (pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${32 + pad * 2} ${32 + pad * 2}">
  ${pad ? `<rect x="${-pad}" y="${-pad}" width="${32 + pad * 2}" height="${32 + pad * 2}" fill="#7357F6"/>` : ""}
  <rect width="32" height="32" rx="${pad ? 0 : 9}" fill="#7357F6"/>
  <path d="M10 8h7.2c3.3 0 5.3 1.7 5.3 4.3 0 1.7-.9 2.9-2.4 3.5 1.9.5 3.1 1.9 3.1 3.9 0 2.9-2.2 4.3-5.6 4.3H10V8Z" fill="#fff"/>
  <path d="M13.6 11v3.8h3.2c1.3 0 2-.7 2-1.9 0-1.2-.7-1.9-2-1.9h-3.2Zm0 6.6v4.4h3.7c1.5 0 2.3-.8 2.3-2.2 0-1.4-.8-2.2-2.3-2.2h-3.7Z" fill="#7357F6"/>
  <circle cx="24.5" cy="8" r="2.5" fill="#22C55E"/>
</svg>`;

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon.svg", mark());
const out = [
  ["icon-192.png", 192, 0], ["icon-512.png", 512, 0], ["apple-touch-icon.png", 180, 4], ["icon-maskable-512.png", 512, 8],
];
for (const [name, size, pad] of out) {
  await sharp(Buffer.from(mark(pad))).resize(size, size).png().toFile(`public/icons/${name}`);
}
await sharp(Buffer.from(mark())).resize(48, 48).png().toFile("src/app/icon.png");
console.log("icônes générées");
