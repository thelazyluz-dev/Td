/**
 * Generates PWA PNG icons using only Node.js built-ins (zlib + fs).
 * Icon design: dark background, red ring, white target cross — Last Stand theme.
 */
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

// ── CRC32 ────────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf, init = 0xffffffff) {
  let c = init;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── PNG chunk builder ────────────────────────────────────────────────────────
function chunk(type, data) {
  const typeB = Buffer.from(type, 'ascii');
  const crc   = crc32(Buffer.concat([typeB, data]));
  const out   = Buffer.alloc(4 + 4 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  typeB.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

// ── PNG encoder (RGBA, no transparency) ─────────────────────────────────────
function buildPNG(size, pixelFn) {
  const IHDR = Buffer.alloc(13);
  IHDR.writeUInt32BE(size, 0);
  IHDR.writeUInt32BE(size, 4);
  IHDR[8] = 8; // bit depth
  IHDR[9] = 6; // RGBA

  // Raw scanlines: 1 filter byte + W*4 bytes per row
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const off = y * (size * 4 + 1) + 1 + x * 4;
      raw[off] = r; raw[off+1] = g; raw[off+2] = b; raw[off+3] = a;
    }
  }

  const sig = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  return Buffer.concat([sig, chunk('IHDR', IHDR), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ── Icon pixel function ──────────────────────────────────────────────────────
function iconPixel(x, y, sz) {
  const cx = sz / 2, cy = sz / 2;
  const nx = (x - cx) / (sz / 2); // -1..1
  const ny = (y - cy) / (sz / 2);
  const d  = Math.hypot(nx, ny);

  // --- Background: near-black ---
  let r = 8, g = 5, b = 5, a = 255;

  // --- Outer red glow ring (0.7–0.88) ---
  if (d < 0.88 && d > 0.70) {
    const t = 1 - Math.abs(d - 0.79) / 0.09;
    r = Math.round(8  + (220 - 8)  * t);
    g = Math.round(5  + (38  - 5)  * t);
    b = Math.round(5  + (38  - 5)  * t);
  }

  // --- Filled red disc (0–0.70) ---
  if (d <= 0.70) {
    const t = 1 - d / 0.70 * 0.3; // slight vignette
    r = Math.round(200 * t);
    g = Math.round(30  * t);
    b = Math.round(30  * t);
  }

  // --- Dark inner circle (0–0.44) ---
  if (d <= 0.44) {
    r = 10; g = 8; b = 8;
  }

  // --- White cross / target lines ---
  const th = 0.085; // half-thickness (normalised)
  const ln = 0.36;  // half-length
  const inH = Math.abs(ny) < th && Math.abs(nx) < ln;
  const inV = Math.abs(nx) < th && Math.abs(ny) < ln;
  if ((inH || inV) && d <= 0.44) {
    r = 240; g = 240; b = 240;
  }

  // --- Centre dot ---
  if (d < 0.08) { r = 220; g = 38; b = 38; }

  // --- Anti-alias outer edge ---
  if (d > 0.86 && d < 0.90) {
    const edge = 1 - (d - 0.86) / 0.04;
    a = Math.round(255 * edge);
    // blend to transparent black
    r = Math.round(r * edge);
    g = Math.round(g * edge);
    b = Math.round(b * edge);
  }
  if (d >= 0.90) { a = 0; r = 0; g = 0; b = 0; }

  return [r, g, b, a];
}

// ── Generate files ───────────────────────────────────────────────────────────
mkdirSync('public', { recursive: true });

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
for (const sz of SIZES) {
  const out = `public/pwa-${sz}x${sz}.png`;
  writeFileSync(out, buildPNG(sz, iconPixel));
  console.log('✓', out);
}

// apple-touch-icon (180×180, no transparency needed)
function applePixel(x, y, sz) {
  const [r, g, b] = iconPixel(x, y, sz);
  return [r, g, b, 255]; // always opaque
}
writeFileSync('public/apple-touch-icon.png', buildPNG(180, applePixel));
console.log('✓ public/apple-touch-icon.png');

// Also copy as favicon.png
writeFileSync('public/favicon-32x32.png', buildPNG(32, iconPixel));
console.log('✓ public/favicon-32x32.png');
