// One-shot script: render the brand logo (matches the dashboard sidebar Logo
// component in apps/web/components/app-shell.tsx) to a 1024×1024 PNG that
// electron-builder uses for the Mac/Windows/Linux app icon.
//
// Run:  node apps/desktop/scripts/generate-icon.mjs
// Output: apps/desktop/assets/icon.png

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, '..', 'assets', 'icon.png');

// Brand colors converted from oklch (light theme) to sRGB hex.
// --accent     oklch(0.402 0.115 18)  ≈ deep wine-red
// --accent-ink oklch(0.985 0.008 60)  ≈ warm off-white
const ACCENT = '#6E2A2A';
const ACCENT_INK = '#FAF5EE';

// 1024×1024 with safe-area padding so the rounded square doesn't get cropped
// by Mac's masking. Padding ~96px = ~9.4% on each side.
const PAD = 96;
const TILE = 1024 - PAD * 2; // 832
const RADIUS = 196;          // proportional to the dashboard's 10px-of-36
const ICON_SIZE = 560;       // larger than the dashboard ratio for app-icon visibility
const ICON_OFFSET_X = (TILE - ICON_SIZE) / 2;
// SVG path fills viewBox y=3..10.5 (center ≈ 6.75 of 16). Shift down so the
// speech bubble appears optically centered in the tile.
const ICON_OFFSET_Y = (TILE - ICON_SIZE) / 2 - ICON_SIZE * (6.75 / 16 - 0.5);

// Speech-bubble shape from app-shell.tsx Logo (16x16 viewBox), scaled to
// ICON_SIZE. The path uses M2 3h12v7.5l-3.5-2.5H2V3Z + stroke line at 5.5,6.
// We render in the icon's local space (0..16) and let SVG transform handle scaling.
// Canvas stays transparent — OS expects a rounded-square tile with
// transparent corners so the system background shows through (no cream box).
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect
    x="${PAD}" y="${PAD}"
    width="${TILE}" height="${TILE}"
    rx="${RADIUS}" ry="${RADIUS}"
    fill="${ACCENT}"
  />
  <g transform="translate(${PAD + ICON_OFFSET_X}, ${PAD + ICON_OFFSET_Y}) scale(${ICON_SIZE / 16})">
    <path d="M2 3h12v7.5l-3.5-2.5H2V3Z" fill="${ACCENT_INK}" opacity="0.95"/>
    <path d="M5.5 6h5" stroke="${ACCENT}" stroke-width="1.1" stroke-linecap="round"/>
  </g>
</svg>
`.trim();

await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`Wrote ${out}`);
