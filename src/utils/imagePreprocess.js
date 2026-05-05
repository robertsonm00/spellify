/**
 * imagePreprocess.js
 * Canvas-based image preprocessing for handwritten / photographed
 * spelling-list OCR. Exposes a single pipeline function that performs:
 *   - downscale to an OCR-friendly long edge
 *   - greyscale conversion
 *   - contrast boost
 *   - optional Otsu thresholding (kept off for handwriting by default —
 *     it tends to chew up thin pen strokes)
 *   - optional small-angle deskew using a horizontal-projection variance
 *     scan
 *
 * The output is a fresh PNG File ready to hand to Tesseract.
 */

const TARGET_LONG_EDGE = 1800; // OCR sweet spot for printed/handwritten text
const MAX_LONG_EDGE    = 2400; // never upscale beyond this even if huge

// ── File ↔ Image helpers ──────────────────────────────────────────────────

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}

export function canvasToFile(canvas, name = 'preprocessed.png') {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('toBlob returned null')); return; }
        resolve(new File([blob], name, { type: 'image/png' }));
      },
      'image/png',
    );
  });
}

// ── Step 1: resize ─────────────────────────────────────────────────────────

export function drawResized(img, longEdge = TARGET_LONG_EDGE) {
  const w  = img.naturalWidth  || img.width;
  const h  = img.naturalHeight || img.height;
  const max = Math.max(w, h);
  // Don't upscale tiny images by more than 2× — pixel art doesn't help OCR.
  const target = Math.min(longEdge, MAX_LONG_EDGE, Math.max(max, max * 2));
  const scale = target / max;

  const outW = Math.round(w * scale);
  const outH = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width  = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, outW, outH);
  return canvas;
}

// ── Step 2: greyscale + contrast (in-place ImageData mutation) ────────────

/**
 * Convert to greyscale and apply a contrast curve.
 * @param {ImageData} imageData
 * @param {number} contrast - 0 = no change, 50 = strong boost (recommended 25–60 for photos)
 */
export function applyGreyscaleAndContrast(imageData, contrast = 40) {
  const d = imageData.data;
  // Standard contrast formula factor
  const f = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < d.length; i += 4) {
    // Luma weighting (Rec. 709)
    const grey = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    let v = f * (grey - 128) + 128;
    if (v < 0)   v = 0;
    if (v > 255) v = 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  return imageData;
}

// ── Step 3: Otsu threshold (binarisation) ─────────────────────────────────

/**
 * Find the Otsu threshold value for a greyscale ImageData.
 * Returns a number 0..255.
 */
export function otsuThreshold(imageData) {
  const d = imageData.data;
  const histogram = new Array(256).fill(0);
  let totalPixels = 0;
  for (let i = 0; i < d.length; i += 4) {
    histogram[d[i] | 0] += 1;
    totalPixels += 1;
  }

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let wB   = 0;
  let varMax = 0;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > varMax) {
      varMax = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Apply Otsu thresholding so all pixels are either 0 or 255.
 * This is aggressive — only useful for crisp printed text on plain backgrounds.
 */
export function applyOtsuThreshold(imageData) {
  const t = otsuThreshold(imageData);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] >= t ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  return imageData;
}

// ── Step 3.5: erase long lines (cell borders, ruled paper lines) ──────────

/**
 * Detect runs of dark pixels that are much longer than typical text
 * strokes and paint them white. This is critical for boxed-grid spelling
 * worksheets — Tesseract's layout analyser can't handle text trapped
 * inside borders, but if we strip the borders first the cells look like
 * scattered words on a plain page (which Tesseract handles well).
 *
 * The heuristic is intentionally conservative: only runs ≥ minRun pixels
 * long get erased, so text strokes are left intact.
 */
export function eraseLongLines(
  imageData,
  { darknessThreshold = 100, minRunFraction = 0.10, absoluteMinRun = 60 } = {},
) {
  const { width, height, data } = imageData;
  const minRunH = Math.max(absoluteMinRun, Math.round(width  * minRunFraction));
  const minRunV = Math.max(absoluteMinRun, Math.round(height * minRunFraction));

  const eraseRow = (y, x0, x1) => {
    for (let xx = x0; xx < x1; xx++) {
      const i = (y * width + xx) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
    }
  };
  const eraseCol = (x, y0, y1) => {
    for (let yy = y0; yy < y1; yy++) {
      const i = (yy * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
    }
  };

  // Horizontal scan — find long runs of dark pixels per row.
  for (let y = 0; y < height; y++) {
    let runStart = -1;
    for (let x = 0; x < width; x++) {
      const dark = data[(y * width + x) * 4] < darknessThreshold;
      if (dark) {
        if (runStart < 0) runStart = x;
      } else {
        if (runStart >= 0 && (x - runStart) >= minRunH) eraseRow(y, runStart, x);
        runStart = -1;
      }
    }
    if (runStart >= 0 && (width - runStart) >= minRunH) eraseRow(y, runStart, width);
  }

  // Vertical scan — same idea, column by column.
  for (let x = 0; x < width; x++) {
    let runStart = -1;
    for (let y = 0; y < height; y++) {
      const dark = data[(y * width + x) * 4] < darknessThreshold;
      if (dark) {
        if (runStart < 0) runStart = y;
      } else {
        if (runStart >= 0 && (y - runStart) >= minRunV) eraseCol(x, runStart, y);
        runStart = -1;
      }
    }
    if (runStart >= 0 && (height - runStart) >= minRunV) eraseCol(x, runStart, height);
  }
  return imageData;
}

// ── Step 4: deskew via projection-profile variance ────────────────────────

/**
 * Project a binary-ish greyscale image onto the y-axis (row sum of dark
 * pixels) and return the variance of that projection. Higher variance =
 * tighter horizontal text rows = better aligned.
 */
function rowProjectionVariance(imageData) {
  const { data, width, height } = imageData;
  const rowSums = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let s = 0;
    const base = y * width * 4;
    for (let x = 0; x < width; x++) {
      // Use inverted brightness so dark text contributes more.
      s += 255 - data[base + x * 4];
    }
    rowSums[y] = s;
  }
  // Normalise & return variance
  let mean = 0;
  for (let i = 0; i < height; i++) mean += rowSums[i];
  mean /= height;
  let variance = 0;
  for (let i = 0; i < height; i++) {
    const dv = rowSums[i] - mean;
    variance += dv * dv;
  }
  return variance / height;
}

/**
 * Find the small angle (in degrees) that maximises horizontal projection
 * variance. Search range is intentionally narrow — phone snaps of paper
 * usually only need a couple of degrees of correction. Larger skews tend
 * to mean the photo is upside-down or sideways and the user should rotate
 * the camera, not us.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ range?: number, step?: number }} opts
 * @returns {number} best angle in degrees (negative = rotate clockwise)
 */
export function estimateSkewAngle(canvas, { range = 6, step = 1 } = {}) {
  // Work on a downsized greyscale copy for speed
  const w = Math.min(canvas.width,  600);
  const h = Math.round(canvas.height * (w / canvas.width));

  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const sctx = small.getContext('2d', { willReadFrequently: true });

  let best = { angle: 0, score: -Infinity };

  for (let a = -range; a <= range; a += step) {
    sctx.save();
    sctx.fillStyle = '#fff';
    sctx.fillRect(0, 0, w, h);
    sctx.translate(w / 2, h / 2);
    sctx.rotate((a * Math.PI) / 180);
    sctx.drawImage(canvas, -w / 2, -h / 2, w, h);
    sctx.restore();
    const id = sctx.getImageData(0, 0, w, h);
    applyGreyscaleAndContrast(id, 30);
    const v = rowProjectionVariance(id);
    if (v > best.score) best = { angle: a, score: v };
  }
  return best.angle;
}

/**
 * Rotate a canvas by `angle` degrees and return a new canvas.
 */
export function rotateCanvas(canvas, angle) {
  if (Math.abs(angle) < 0.25) return canvas;
  const rad = (angle * Math.PI) / 180;
  const w = canvas.width;
  const h = canvas.height;

  // Bounding box of the rotated image
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const newW = Math.ceil(w * cos + h * sin);
  const newH = Math.ceil(w * sin + h * cos);

  const out = document.createElement('canvas');
  out.width  = newW;
  out.height = newH;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, newW, newH);
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -w / 2, -h / 2);
  return out;
}

// ── Top-level pipeline ─────────────────────────────────────────────────────

/**
 * Full preprocessing pipeline.
 *
 * @param {File} file
 * @param {Object} opts
 * @param {boolean} [opts.deskew=true]      Run small-angle deskew.
 * @param {boolean} [opts.eraseLines=true]  Strip cell borders / ruled lines.
 * @param {boolean} [opts.threshold=false]  Apply Otsu binarisation (printed text only).
 * @param {number}  [opts.contrast=40]      Contrast boost amount.
 * @param {number}  [opts.longEdge]         Target long edge in pixels.
 * @returns {Promise<File>}                 PNG File ready for OCR.
 */
export async function preprocessImageFile(file, opts = {}) {
  const {
    deskew     = true,
    eraseLines = true,
    threshold  = false,
    contrast   = 40,
    longEdge   = TARGET_LONG_EDGE,
  } = opts;

  const img = await loadImageFromFile(file);
  let canvas = drawResized(img, longEdge);

  if (deskew) {
    // estimateSkewAngle returns the rotation that, when applied to the
    // image, maximises horizontal-projection variance — i.e. the
    // correction itself. Apply it directly. (Earlier revisions negated
    // this and ended up rotating clean images *away* from upright.)
    const angle = estimateSkewAngle(canvas, { range: 6, step: 1 });
    if (Math.abs(angle) >= 1) {
      canvas = rotateCanvas(canvas, angle);
    }
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyGreyscaleAndContrast(id, contrast);
  if (eraseLines) eraseLongLines(id);
  if (threshold)  applyOtsuThreshold(id);
  ctx.putImageData(id, 0, 0);

  return canvasToFile(canvas, 'preprocessed.png');
}
