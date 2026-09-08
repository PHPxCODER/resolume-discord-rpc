import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import sharp from 'sharp';

function assetPath(filename: string): string {
  return path.join(__dirname, '..', '..', 'assets', filename);
}

// Resolume's mark, isolated from the full wordmark logo (resolume.com's
// press-kit "Resolume-Logo_black.svg" / "_white.svg") with the "RESOLUME"
// letterforms dropped and cropped tight to a square. The path/transform
// values are copied from that source SVG's "Path_378" element verbatim;
// only the outer viewBox and wrapping translate are new, computed from
// that path's actual rendered bounding box.
function resolumeMarkSvg(size: number, color: string, fillOpacity = 1): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 69.5 69.5">
  <g transform="translate(0, -2.125)">
    <path d="M235.687,444.86V412.4H180.258A14.237,14.237,0,0,0,166.4,426.827v33.029H221.26A15,15,0,0,0,235.687,444.86Z" transform="translate(-166.399 -399.302)" fill="${color}" fill-opacity="${fillOpacity}"/>
  </g>
</svg>`;
}

const TRAY_ICONS: { filename: string; size: number; color: string; fillOpacity?: number }[] = [
  { filename: 'tray-idle.png', size: 16, color: '#949494' },
  { filename: 'tray-connected.png', size: 16, color: '#5865F2' },
  // macOS template images: filenames ending in "Template" make Electron
  // recolor them to match the light/dark menu bar; only the alpha channel
  // matters, so the idle state is expressed as reduced opacity. @2x
  // variants are picked up automatically on retina displays.
  { filename: 'tray-idleTemplate.png', size: 16, color: '#000000', fillOpacity: 0.4 },
  { filename: 'tray-idleTemplate@2x.png', size: 32, color: '#000000', fillOpacity: 0.4 },
  { filename: 'tray-connectedTemplate.png', size: 16, color: '#000000' },
  { filename: 'tray-connectedTemplate@2x.png', size: 32, color: '#000000' },
];

const APP_ICON = {
  filename: 'app-icon.png',
  size: 1024,
  color: [88, 101, 242, 255] as [number, number, number, number],
};

async function main(): Promise<void> {
  for (const { filename, size, color, fillOpacity } of TRAY_ICONS) {
    await sharp(Buffer.from(resolumeMarkSvg(size, color, fillOpacity)))
      .png()
      .toFile(assetPath(filename));
  }

  const png = new PNG({ width: APP_ICON.size, height: APP_ICON.size });
  const [r, g, b, a] = APP_ICON.color;

  for (let y = 0; y < APP_ICON.size; y++) {
    for (let x = 0; x < APP_ICON.size; x++) {
      const idx = (APP_ICON.size * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  png.pack().pipe(fs.createWriteStream(assetPath(APP_ICON.filename)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
