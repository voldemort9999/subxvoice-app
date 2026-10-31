import { nativeImage } from "electron";

/**
 * The app mark: five waveform bars, the same glyph the sidebar draws. Generated rather than
 * shipped as a file so there is one definition of the logo and nothing to keep in sync.
 */

/** Bar heights as a fraction of the box, measured from the centre out. */
const BARS = [0.18, 0.46, 0.76, 0.38, 0.18];
const BAR_WIDTH = 0.085;
const BAR_GAP = 0.055;
const SUPERSAMPLE = 3;

const ACCENT = { r: 0x6d, g: 0x5e, b: 0xf8 };

/** Inside a bar, or inside the rounded square behind them. */
function shape(x: number, y: number): { bar: boolean; plate: boolean } {
  const span = BARS.length * BAR_WIDTH + (BARS.length - 1) * BAR_GAP;
  let left = 0.5 - span / 2;
  let bar = false;
  for (const height of BARS) {
    if (x >= left && x <= left + BAR_WIDTH) {
      const half = height / 2;
      // Rounded caps: the bar is a stadium, so the ends are circles of the bar's own radius.
      const radius = BAR_WIDTH / 2;
      const cx = left + radius;
      const top = 0.5 - half + radius;
      const bottom = 0.5 + half - radius;
      bar =
        (y >= top && y <= bottom) ||
        Math.hypot(x - cx, y - top) <= radius ||
        Math.hypot(x - cx, y - bottom) <= radius;
      if (bar) break;
    }
    left += BAR_WIDTH + BAR_GAP;
  }

  // Squircle-ish plate: a square with corners rounded at a quarter of its side.
  const inset = 0.06;
  const radius = 0.22;
  const min = inset;
  const max = 1 - inset;
  const dx = Math.max(min + radius - x, 0, x - (max - radius));
  const dy = Math.max(min + radius - y, 0, y - (max - radius));
  const plate = x >= min && x <= max && y >= min && y <= max && Math.hypot(dx, dy) <= radius;

  return { bar, plate };
}

/**
 * `plate: false` draws the bars alone, which is what a tray icon wants — it is 16 px and, on a
 * Mac, tinted by the system. The window icon gets the full mark on its violet plate.
 */
export function brandIcon(size: number, options: { plate: boolean; shade?: number }) {
  const buffer = Buffer.alloc(size * size * 4);
  const shade = options.shade ?? 255;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let barHits = 0;
      let plateHits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / size;
          const hit = shape(x, y);
          if (hit.bar) barHits++;
          else if (hit.plate) plateHits++;
        }
      }
      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const bar = barHits / samples;
      const plate = options.plate ? plateHits / samples : 0;
      const alpha = Math.min(1, bar + plate);
      const offset = (py * size + px) * 4;

      // BGRA, premultiplied alpha. Bars sit on top of the plate.
      const blue = options.plate ? bar * 255 + plate * ACCENT.b : bar * shade;
      const green = options.plate ? bar * 255 + plate * ACCENT.g : bar * shade;
      const red = options.plate ? bar * 255 + plate * ACCENT.r : bar * shade;
      buffer[offset] = blue;
      buffer[offset + 1] = green;
      buffer[offset + 2] = red;
      buffer[offset + 3] = 255 * alpha;
    }
  }

  return nativeImage.createFromBitmap(buffer, { width: size, height: size, scaleFactor: 1 });
}

/** Taskbar, Alt-Tab and the window's own corner. */
export const appIcon = () => brandIcon(256, { plate: true });
