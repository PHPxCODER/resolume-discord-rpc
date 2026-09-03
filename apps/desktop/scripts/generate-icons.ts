import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

interface IconSpec {
  filename: string;
  size: number;
  color: [number, number, number, number];
}

const ICONS: IconSpec[] = [
  { filename: 'tray-idle.png', size: 16, color: [148, 148, 148, 255] },
  { filename: 'tray-connected.png', size: 16, color: [88, 101, 242, 255] },
  { filename: 'app-icon.png', size: 1024, color: [88, 101, 242, 255] },
];

for (const { filename, size, color } of ICONS) {
  const png = new PNG({ width: size, height: size });
  const [r, g, b, a] = color;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  const outPath = path.join(__dirname, '..', '..', 'assets', filename);
  png.pack().pipe(fs.createWriteStream(outPath));
}
