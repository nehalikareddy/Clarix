const mongoose = require('mongoose');

const riskClauseSchema = new mongoose.Schema({
  clause: String,           // short title of the clause
  severity: { type: String, enum: ['high', 'medium', 'low'] },
  explanation: String       // plain English explanation of why it's risky
});

const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'model'] },
  content: String,
  timestamp: { type: Date, default: Date.now }
});

const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true },
  originalText: { type: String, required: true },   // raw extracted text from PDF
  summary: String,                                   // 3-sentence AI summary
  simplified: { type: mongoose.Schema.Types.Mixed },           // array of {section, content} or plain string
  riskClauses: [riskClauseSchema],
  riskScore: { type: Number, min: 0, max: 10 },
  chatHistory: [chatMessageSchema],
  language: { type: String, default: 'English' }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
