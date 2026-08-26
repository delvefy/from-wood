// Generates the PWA icons and the Android launcher icons (a stylized log
// cross-section with tree rings) as PNGs with no external dependencies.
// Run: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PWA_DIR = join(ROOT, 'public', 'icons');
const RES_DIR = join(ROOT, 'android', 'app', 'src', 'main', 'res');

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const BG = [30, 40, 26];
const BARK = [92, 64, 44];
const WOOD = [181, 138, 90];
const RING = [138, 104, 68];

// Returns the log's colour at (x, y), or null for anything outside the bark.
// `diameter` is the log's width as a fraction of the canvas's shorter side.
function pixel(x, y, w, h, diameter) {
  const d = Math.hypot(x - w / 2, y - h / 2);
  const r = (Math.min(w, h) * diameter) / 2;
  if (d > r) return null;
  if (d > r * (42 / 46)) return BARK;
  const ringStep = r / 5.98;
  if (d % ringStep < r / 36.8 || d < r / 18.4) return RING;
  return WOOD;
}

// `bg` is the colour behind the log, or null for a transparent (RGBA) PNG.
function makePng(w, h, { diameter, bg }) {
  const channels = bg ? 3 : 4;
  const raw = Buffer.alloc(h * (w * channels + 1));
  let off = 0;
  for (let y = 0; y < h; y++) {
    raw[off++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const c = pixel(x, y, w, h, diameter) ?? bg;
      raw[off++] = c ? c[0] : 0;
      raw[off++] = c ? c[1] : 0;
      raw[off++] = c ? c[2] : 0;
      if (!bg) raw[off++] = c ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = bg ? 2 : 6; // color type: truecolor / truecolor+alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function write(dir, name, w, h, opts) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, makePng(w, h, opts));
  console.log('wrote', file);
}

for (const size of [192, 512]) {
  write(PWA_DIR, `icon-${size}.png`, size, size, { diameter: 0.92, bg: BG });
}

// Android launcher icons. The legacy PNGs are 48dp; the adaptive-icon
// foreground is 108dp with only the inner 72dp guaranteed visible, so the log
// is drawn at 2/3 of that canvas to survive the launcher's mask.
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, scale] of Object.entries(DENSITIES)) {
  const dir = join(RES_DIR, `mipmap-${density}`);
  const legacy = Math.round(48 * scale);
  write(dir, 'ic_launcher.png', legacy, legacy, { diameter: 0.92, bg: BG });
  write(dir, 'ic_launcher_round.png', legacy, legacy, { diameter: 1, bg: null });
  const fg = Math.round(108 * scale);
  write(dir, 'ic_launcher_foreground.png', fg, fg, { diameter: 2 / 3, bg: null });
}

// Launch splash. Android picks the drawable by orientation and density and
// stretches it to fill the window, so the log is kept small enough to stay
// clear of the edges on the widest screens. `drawable/` is the fallback for
// densities Android can't match.
const SPLASHES = {
  mdpi: [480, 320],
  hdpi: [800, 480],
  xhdpi: [1280, 720],
  xxhdpi: [1600, 960],
  xxxhdpi: [1920, 1280],
};
const SPLASH_LOG = 0.34;
for (const [density, [long, short]] of Object.entries(SPLASHES)) {
  const opts = { diameter: SPLASH_LOG, bg: BG };
  write(join(RES_DIR, `drawable-land-${density}`), 'splash.png', long, short, opts);
  write(join(RES_DIR, `drawable-port-${density}`), 'splash.png', short, long, opts);
}
write(join(RES_DIR, 'drawable'), 'splash.png', ...SPLASHES.mdpi, {
  diameter: SPLASH_LOG,
  bg: BG,
});
