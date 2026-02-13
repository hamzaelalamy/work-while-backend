/**
 * CV Text Extraction Service
 * Extracts plain text from PDF and DOCX files for embedding generation.
 * pdf-parse v2 uses PDFParse class; v1 used a default function.
 */
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

const ALLOWED_MIME = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc'
};

/**
 * Extract text from a buffer based on MIME type.
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - e.g. 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
 * @returns {Promise<{ text: string }>} - Extracted and cleaned text
 */
async function extractTextFromBuffer(buffer, mimeType) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid buffer');
  }

  const type = ALLOWED_MIME[mimeType];
  if (!type) {
    throw new Error(`Unsupported file type: ${mimeType}. Use PDF or DOCX.`);
  }

  let rawText = '';

  if (type === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      rawText = (result && result.text) ? result.text : '';
    } finally {
      await parser.destroy();
    }
  } else if (type === 'docx' || type === 'doc') {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value || '';
    if (result.messages && result.messages.length > 0) {
      console.warn('[CV Extraction] Mammoth messages:', result.messages);
    }
  }

  const text = cleanExtractedText(rawText);
  if (!text || text.length < 50) {
    throw new Error('Could not extract enough text from the document. Ensure the file is a valid PDF or DOCX with readable text.');
  }

  return { text };
}

/**
 * Clean and normalize extracted text for embedding.
 * @param {string} raw
 * @returns {string}
 */
function cleanExtractedText(raw) {
  if (!raw || typeof raw !== 'string') return '';

  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 30000); // Cap length for embedding API
}

module.exports = {
  extractTextFromBuffer,
  cleanExtractedText,
  ALLOWED_MIME
};
