/**
 * fileValidator.js
 * Security validation for uploaded files.
 * Checks MIME type, file extension, magic bytes, and size.
 */

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif',
  'pdf',
  'txt', 'csv',
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Magic-byte signatures: [offset, bytes[]] */
const MAGIC_BYTES = [
  { ext: 'jpeg', offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
  { ext: 'png',  offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] },
  { ext: 'pdf',  offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { ext: 'gif',  offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  // webp: RIFF at 0, WEBP at 8
  { ext: 'webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
];

/**
 * Read the first N bytes of a File as a Uint8Array.
 */
function readHeader(file, bytes = 12) {
  return new Promise((resolve, reject) => {
    const slice = file.slice(0, bytes);
    const reader = new FileReader();
    reader.onload  = (e) => resolve(new Uint8Array(e.target.result));
    reader.onerror = () => reject(new Error('Could not read file header'));
    reader.readAsArrayBuffer(slice);
  });
}

function headerMatches(header, offset, sig) {
  return sig.every((byte, i) => header[offset + i] === byte);
}

/**
 * Validate a File object.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export async function validateFile(file) {
  // 1. Size check
  if (file.size === 0) {
    console.warn('[FileValidator] Rejected: empty file', file.name);
    return { valid: false, reason: 'The file is empty.' };
  }
  if (file.size > MAX_SIZE_BYTES) {
    console.warn('[FileValidator] Rejected: too large', file.name, file.size);
    return { valid: false, reason: 'File must be under 5 MB.' };
  }

  // 2. Extension check
  const nameParts = file.name.split('.');
  const ext = (nameParts[nameParts.length - 1] || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    console.warn('[FileValidator] Rejected: bad extension', file.name);
    return {
      valid: false,
      reason: `Unsupported file type ".${ext}". Please upload a JPG, PNG, PDF, or TXT file.`,
    };
  }

  // 3. MIME type check (browser-reported — not fully trusted but good first gate)
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    console.warn('[FileValidator] Rejected: bad MIME', file.name, file.type);
    return {
      valid: false,
      reason: `Unsupported file type. Please upload an image, PDF, or text file.`,
    };
  }

  // 4. Magic bytes check (skip for plain text / csv — no reliable signature)
  if (!['txt', 'csv'].includes(ext)) {
    let header;
    try {
      header = await readHeader(file, 12);
    } catch {
      return { valid: false, reason: 'Could not read the file.' };
    }

    const matched = MAGIC_BYTES.some(({ ext: sigExt, offset, bytes }) => {
      // Allow jpeg check for jpg/jpeg
      if (sigExt === 'jpeg' && !['jpg', 'jpeg'].includes(ext)) return false;
      if (sigExt !== 'jpeg' && sigExt !== ext) return false;
      return headerMatches(header, offset, bytes);
    });

    // For webp we need RIFF at 0 AND WEBP at 8
    if (ext === 'webp') {
      const riff = headerMatches(header, 0, [0x52, 0x49, 0x46, 0x46]);
      const webp = headerMatches(header, 8, [0x57, 0x45, 0x42, 0x50]);
      if (!riff || !webp) {
        console.warn('[FileValidator] Rejected: bad magic bytes (webp)', file.name);
        return { valid: false, reason: 'File does not appear to be a valid image.' };
      }
    } else if (!matched) {
      console.warn('[FileValidator] Rejected: bad magic bytes', file.name, ext);
      return { valid: false, reason: 'File does not match its extension. Please try again.' };
    }
  }

  return { valid: true };
}
