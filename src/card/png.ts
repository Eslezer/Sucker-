import type { CharaCardV2 } from '../parser/types';

// Minimal 1x1 transparent PNG (68 bytes)
const MINIMAL_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, // IHDR length
  0x49, 0x48, 0x44, 0x52, // "IHDR"
  0x00, 0x00, 0x00, 0x01, // width: 1
  0x00, 0x00, 0x00, 0x01, // height: 1
  0x08, 0x06,             // 8-bit RGBA
  0x00, 0x00, 0x00,       // compression, filter, interlace
  0x1f, 0x15, 0xc4, 0x89, // IHDR CRC
  0x00, 0x00, 0x00, 0x0a, // IDAT length
  0x49, 0x44, 0x41, 0x54, // "IDAT"
  0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x00, // compressed data
  // -- we'll skip the CRC and IEND and compute them properly below
]);

/** CRC32 lookup table */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32BE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = (value >>> 24) & 0xff;
  buf[1] = (value >>> 16) & 0xff;
  buf[2] = (value >>> 8) & 0xff;
  buf[3] = value & 0xff;
  return buf;
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const length = uint32BE(data.length);
  // CRC covers type + data
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const crcBytes = uint32BE(crc32(crcInput));

  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  chunk.set(length, 0);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  chunk.set(crcBytes, 8 + data.length);
  return chunk;
}

/** Build a minimal valid PNG with no tEXt chunks */
function buildBasePng(): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 1x1, 8-bit RGBA
  const ihdrData = new Uint8Array([
    0x00, 0x00, 0x00, 0x01, // width
    0x00, 0x00, 0x00, 0x01, // height
    0x08, 0x06, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
  ]);
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT: minimal compressed transparent pixel
  const idatData = new Uint8Array([
    0x78, 0x9c, 0x62, 0x60, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01,
  ]);
  const idat = createChunk('IDAT', idatData);

  // IEND
  const iend = createChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
  let offset = 0;
  png.set(signature, offset); offset += signature.length;
  png.set(ihdr, offset); offset += ihdr.length;
  png.set(idat, offset); offset += idat.length;
  png.set(iend, offset);

  return png;
}

/**
 * Embed a Character Card V2 JSON into a PNG file as a tEXt chunk.
 * If no source PNG is provided, generates a minimal 1x1 transparent PNG.
 *
 * The tEXt chunk uses keyword "chara" and the value is base64-encoded JSON.
 */
export function embedCardInPng(card: CharaCardV2, sourcePng?: Uint8Array): Uint8Array {
  const png = sourcePng || buildBasePng();

  // Encode card JSON to base64
  const jsonStr = JSON.stringify(card);
  const base64 = btoa(
    Array.from(new TextEncoder().encode(jsonStr))
      .map(b => String.fromCharCode(b))
      .join('')
  );

  // Build tEXt chunk: keyword "chara" + null separator + base64 data
  const keyword = new TextEncoder().encode('chara');
  const value = new TextEncoder().encode(base64);
  const textData = new Uint8Array(keyword.length + 1 + value.length);
  textData.set(keyword, 0);
  textData[keyword.length] = 0; // null separator
  textData.set(value, keyword.length + 1);

  const textChunk = createChunk('tEXt', textData);

  // Insert tEXt chunk before IEND (last 12 bytes of any valid PNG)
  const iendStart = png.length - 12;
  const result = new Uint8Array(png.length + textChunk.length);
  result.set(png.subarray(0, iendStart), 0);
  result.set(textChunk, iendStart);
  result.set(png.subarray(iendStart), iendStart + textChunk.length);

  return result;
}
