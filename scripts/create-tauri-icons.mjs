import fs from 'fs';
import path from 'path';

// Ensure icons folder exists
const iconsDir = path.resolve('src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1x1 transparent PNG base64 for minimal valid PNG
const minPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const minPngBuffer = Buffer.from(minPngBase64, 'base64');

// Minimal valid ICO file buffer (1 icon entry 16x16)
const icoHeader = Buffer.from([
  0x00, 0x00, // Reserved
  0x01, 0x00, // Type 1 = ICO
  0x01, 0x00, // 1 image
  // Directory entry
  0x10, // Width 16
  0x10, // Height 16
  0x00, // Colors
  0x00, // Reserved
  0x01, 0x00, // Color planes
  0x20, 0x00, // Bits per pixel (32)
  minPngBuffer.length, 0x00, 0x00, 0x00, // Size
  0x16, 0x00, 0x00, 0x00, // Offset 22
]);
const icoBuffer = Buffer.concat([icoHeader, minPngBuffer]);

fs.writeFileSync(path.join(iconsDir, '32x32.png'), minPngBuffer);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), minPngBuffer);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), minPngBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), minPngBuffer);

console.log('✅ Tauri icons generated in src-tauri/icons');
