/**
 * Generate favicon PNG files from SVG
 * Run: node scripts/generate-icons.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Sizes to generate
const sizes = [16, 32, 180, 192, 512];

async function generateIcons() {
  try {
    // Dynamic import sharp (optional dependency)
    const sharp = (await import('sharp')).default;

    const svgPath = join(publicDir, 'favicon.svg');
    const svgBuffer = readFileSync(svgPath);

    for (const size of sizes) {
      const pngBuffer = await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toBuffer();

      let filename;
      if (size === 180) {
        filename = 'apple-touch-icon.png';
      } else if (size === 16 || size === 32) {
        filename = `favicon-${size}.png`;
      } else {
        filename = `icon-${size}.png`;
      }

      writeFileSync(join(publicDir, filename), pngBuffer);
      console.log(`Generated ${filename}`);
    }

    console.log('All icons generated successfully!');
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      console.log('sharp not installed. Install with: npm install -D sharp');
      console.log('Skipping PNG generation, SVG favicon will be used.');
    } else {
      console.error('Error generating icons:', error);
    }
  }
}

generateIcons();
