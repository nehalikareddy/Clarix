const pdfParse = require('pdf-parse');
const fs = require('fs');

async function extractTextFromPDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  if (!data.text || data.text.trim().length < 100) {
    throw new Error('Could not extract text. The PDF may be scanned/image-based.');
  }

  return data.text;
}

module.exports = { extractTextFromPDF };
