const Document = require('../models/Document');
const { chatWithDocument } = require('../services/geminiService');

exports.sendMessage = async (req, res) => {
  try {
    const { docId } = req.params;
    const { message } = req.body;

    const doc = await Document.findOne({ _id: docId, userId: req.user.id });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Call Gemini to get reply
    const reply = await chatWithDocument(doc.originalText, doc.chatHistory, message);

    // Save history
    doc.chatHistory.push({ role: 'user', content: message });
    doc.chatHistory.push({ role: 'model', content: reply });
    await doc.save();

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { docId } = req.params;
    const doc = await Document.findOne({ _id: docId, userId: req.user.id });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    res.json(doc.chatHistory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
