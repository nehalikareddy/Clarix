const Document = require('../models/Document');
const User = require('../models/User');
const { extractTextFromPDF } = require('../services/pdfService');
const { analyzeDocument } = require('../services/geminiService');
const fs = require('fs');

exports.uploadDocument = async (req, res) => {
  try {
    // 0. Check daily limit (5 per day)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyCount = await Document.countDocuments({
      userId: req.user.id,
      createdAt: { $gte: twentyFourHoursAgo }
    });

    if (dailyCount >= 5) {
      return res.status(403).json({ 
        error: 'Daily limit reached. You can only analyze 5 documents per 24 hours.' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    // 1. Extract text from PDF
    const extractedText = await extractTextFromPDF(filePath);

    // 2. Call Gemini
    const analysis = await analyzeDocument(extractedText);

    // 3. Save to MongoDB
    const doc = await Document.create({
      userId: req.user.id,
      fileName,
      originalText: extractedText,
      summary: analysis.summary,
      simplified: analysis.simplified,
      riskClauses: analysis.riskClauses,
      riskScore: analysis.riskScore
    });

    // 4. Delete temp file
    fs.unlinkSync(filePath);

    res.status(201).json(doc);
  } catch (err) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
};

exports.getAllDocuments = async (req, res) => {
  const docs = await Document.find({ userId: req.user.id })
    .select('fileName summary riskScore createdAt')
    .sort({ createdAt: -1 });
  res.json(docs);
};

exports.getDocument = async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user.id });
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json(doc);
};

exports.deleteDocument = async (req, res) => {
  await Document.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ message: 'Deleted' });
};
