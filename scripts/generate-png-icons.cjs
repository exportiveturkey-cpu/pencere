const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Minimal PNG generator using Node.js built-in zlib
function createPng(width, height, drawPixel) {
  // 1 scanline filter byte (0 = None) per row + RGBA pixels
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression: Deflate
  ihdr[11] = 0; // Filter: None
  ihdr[12] = 0; // Interlace: None

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([len, typeAndData, crcBuf]);
}

// Alumetric Branding Color Palette
// Background: Deep Slate #0f172a (15, 23, 42)
// Primary Frame / Glow: Sky / Royal Blue #2563eb / #38bdf8
// Interior Glass: #1e293b with Cyan tint
function drawAlumetricIcon(x, y, w, h, isMaskable = false) {
  const nx = x / w;
  const ny = y / h;

  // Background gradient: from deep navy (15, 23, 42) to dark slate (30, 41, 59)
  const bgR = Math.round(15 + ny * 15);
  const bgG = Math.round(23 + ny * 18);
  const bgB = Math.round(42 + ny * 25);

  // Margin: for maskable, 18% safe padding; for standard, 12% padding
  const pad = isMaskable ? 0.18 : 0.12;
  const frameLeft = pad;
  const frameRight = 1 - pad;
  const frameTop = pad;
  const frameBottom = 1 - pad - 0.05;

  // Check if inside outer frame
  if (nx >= frameLeft && nx <= frameRight && ny >= frameTop && ny <= frameBottom) {
    const borderThick = 0.035;
    // Outer border
    const isOuterBorder = 
      nx <= frameLeft + borderThick || 
      nx >= frameRight - borderThick || 
      ny <= frameTop + borderThick || 
      ny >= frameBottom - borderThick;

    if (isOuterBorder) {
      // Primary Blue Glow Gradient
      const grad = (nx + ny) / 2;
      return [Math.round(40 + grad * 30), Math.round(130 + grad * 60), 245, 255];
    }

    // Grid mullion / transom
    const midX = (frameLeft + frameRight) / 2;
    const midY = frameTop + (frameBottom - frameTop) * 0.44;
    const mullionW = 0.025;

    const isVerticalMullion = Math.abs(nx - midX) < mullionW;
    const isHorizontalTransom = Math.abs(ny - midY) < mullionW;

    if (isVerticalMullion || isHorizontalTransom) {
      return [56, 189, 248, 255]; // Cyan mullion
    }

    // Inner Glass Panes: Cyan subtle tint
    const glassR = 25;
    const glassG = 45;
    const glassB = 75;
    // Diagonal glass sheen
    const diag = (nx - frameLeft) - (ny - frameTop);
    const sheen = Math.abs(diag - 0.1) < 0.04 ? 70 : 0;

    return [glassR + sheen, glassG + sheen, glassB + sheen, 255];
  }

  // Rounded corners or background
  return [bgR, bgG, bgB, 255];
}

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate Icons
console.log('Generating PWA icons...');
const icon192 = createPng(192, 192, (x, y, w, h) => drawAlumetricIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), icon192);

const icon512 = createPng(512, 512, (x, y, w, h) => drawAlumetricIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), icon512);

const iconMaskable = createPng(512, 512, (x, y, w, h) => drawAlumetricIcon(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), iconMaskable);

const appleIcon = createPng(180, 180, (x, y, w, h) => drawAlumetricIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);

console.log('Successfully generated all PWA icons: 192x192, 512x512, maskable 512x512, apple-touch-icon.png');
