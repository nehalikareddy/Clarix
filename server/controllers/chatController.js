const Document = require('../models/Document');
const { chatWithDocument } = require('../services/geminiService');

exports.sendMessage = async (req, res) => {
  try {
    const { docId } = req.params;
    const { message } = req.body;

    const doc = await Document.findOne({ _id: docId, userId: req.user.id });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    let reply = '';
    let sources = [];
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    // 1. Try FastAPI RAG Microservice
    try {
      let chatRes = await fetch(`${aiServiceUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: docId,
          message,
          chat_history: (doc.chatHistory || []).map(m => ({ role: m.role, content: m.content }))
        })
      });

      // If document wasn't indexed yet (e.g. uploaded previously), index it on-the-fly and retry
      if (chatRes.status === 404) {
        console.log(`[RAG Service] Document ${docId} not indexed yet. Auto-indexing on the fly...`);
        await fetch(`${aiServiceUrl}/index`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_id: docId, text: doc.originalText })
        });

        // Retry chat
        chatRes = await fetch(`${aiServiceUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doc_id: docId,
            message,
            chat_history: (doc.chatHistory || []).map(m => ({ role: m.role, content: m.content }))
          })
        });
      }

      if (chatRes.ok) {
        const data = await chatRes.json();
        reply = data.reply;
        sources = data.sources || [];
      } else {
        throw new Error(`AI Microservice responded with status ${chatRes.status}`);
      }
    } catch (microserviceErr) {
      console.warn(`[Chat] RAG microservice unavailable (${microserviceErr.message}). Falling back to direct LLM.`);
      reply = await chatWithDocument(doc.originalText, doc.chatHistory, message);
    }

    // 2. Save history in MongoDB
    doc.chatHistory.push({ role: 'user', content: message });
    doc.chatHistory.push({ role: 'model', content: reply });
    await doc.save();

    res.json({ reply, sources });
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
