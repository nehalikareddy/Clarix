const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
}

function getGroqClient() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

function parseAnalysisJson(raw) {
  try {
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}') + 1;
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("AI failed to generate a structured analysis.");
    }
    const jsonString = raw.substring(jsonStart, jsonEnd);
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('AI JSON Parsing Error:', raw);
    throw new Error('Analysis failed. The AI response was malformed. Please try again.');
  }
}

// ─── GROQ BACKUP IMPLEMENTATIONS ───────────────────────────────────────────
async function analyzeWithGroq(groq, extractedText) {
  const systemPrompt = `You are an expert legal document analyst. A user has uploaded a legal document.
Your job is to help non-lawyers understand it clearly and identify hidden risks.

### TASK:
1. SUMMARY: Write a plain-language summary in exactly 3 sentences.
2. SIMPLIFIED SECTIONS: Break the document down into 3-5 logical sections (e.g., "The Deal", "Your Responsibilities", "Termination"). Use simple, human-readable titles.
3. RISK CLAUSES: Identify between 3 to 7 risky or unusual clauses (adjust based on document length and complexity).
   - MANDATORY CHECKLIST: You MUST specifically look for and flag if present:
     - High interest rates or penalty fees.
     - Liquidated damages (fixed penalty amounts).
     - Broad indemnification (making the user pay for the company's mistakes).
     - Non-compete or non-solicitation restrictions.
     - Unilateral amendment rights (they can change terms without telling you).
   - For each clause provide:
     - clause: A short descriptive title.
     - severity: "high", "medium", or "low".
     - explanation: One sentence in plain English explaining the risk.
4. RISK SCORE (0-10): Provide an overall score based on this rubric:
   - 0-2: Extremely safe/standard (e.g., a simple NDA with mutual terms).
   - 3-5: Moderate risk (e.g., standard employment contracts or lease agreements).
   - 6-8: High risk (e.g., predatory clauses, massive penalties, or extreme non-competes).
   - 9-10: Dangerously aggressive (e.g., one-sided terms that waive almost all user rights).
   - **HARD RULE**: If you detect 3 or more "high" severity clauses, the RISK SCORE must be 8 or higher.

### RESPONSE FORMAT:
Return ONLY a valid JSON object. No markdown, no pre-amble.
{
  "summary": "...",
  "simplified": [
    { "section": "...", "content": "..." }
  ],
  "riskClauses": [
    { "clause": "...", "severity": "...", "explanation": "..." }
  ],
  "riskScore": 5
}`;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Document Text:\n"""\n${extractedText.slice(0, 30000)}\n"""` }
    ],
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.2,
    response_format: { type: 'json_object' }
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('Groq returned an empty response.');
  }

  return parseAnalysisJson(raw);
}

async function chatWithGroq(groq, documentText, chatHistory, userQuestion) {
  const systemContext = `You are a legal assistant helping a user understand their legal document.
Answer clearly and simply. Do not use legal jargon.
If you do not know the answer from the document, say so honestly.

Document:
"""
${documentText.slice(0, 20000)}
"""`;

  const messages = [
    { role: 'system', content: systemContext },
    ...chatHistory.map(msg => ({
      role: msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    })),
    { role: 'user', content: userQuestion }
  ];

  const completion = await groq.chat.completions.create({
    messages,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.3
  });

  return completion.choices[0]?.message?.content || '';
}

// ─── 1. ANALYZE DOCUMENT (with Groq fallback) ──────────────────────────────
async function analyzeDocument(extractedText) {
  let geminiError = null;

  // Try Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = getGeminiModel();
      const prompt = `
You are an expert legal document analyst. A user has uploaded a legal document.
Your job is to help non-lawyers understand it clearly and identify hidden risks.

### TASK:
1. SUMMARY: Write a plain-language summary in exactly 3 sentences.
2. SIMPLIFIED SECTIONS: Break the document down into 3-5 logical sections (e.g., "The Deal", "Your Responsibilities", "Termination"). Use simple, human-readable titles.
3. RISK CLAUSES: Identify between 3 to 7 risky or unusual clauses (adjust based on document length and complexity).
   - MANDATORY CHECKLIST: You MUST specifically look for and flag if present:
     - High interest rates or penalty fees.
     - Liquidated damages (fixed penalty amounts).
     - Broad indemnification (making the user pay for the company's mistakes).
     - Non-compete or non-solicitation restrictions.
     - Unilateral amendment rights (they can change terms without telling you).
   - For each clause provide:
     - clause: A short descriptive title.
     - severity: "high", "medium", or "low".
     - explanation: One sentence in plain English explaining the risk.
4. RISK SCORE (0-10): Provide an overall score based on this rubric:
   - 0-2: Extremely safe/standard (e.g., a simple NDA with mutual terms).
   - 3-5: Moderate risk (e.g., standard employment contracts or lease agreements).
   - 6-8: High risk (e.g., predatory clauses, massive penalties, or extreme non-competes).
   - 9-10: Dangerously aggressive (e.g., one-sided terms that waive almost all user rights).
   - **HARD RULE**: If you detect 3 or more "high" severity clauses, the RISK SCORE must be 8 or higher.

### RESPONSE FORMAT:
Return ONLY a valid JSON object. No markdown, no pre-amble.

{
  "summary": "...",
  "simplified": [
    { "section": "...", "content": "..." }
  ],
  "riskClauses": [
    { "clause": "...", "severity": "...", "explanation": "..." }
  ],
  "riskScore": 5
}

Document Text:
"""
${extractedText.slice(0, 30000)}
"""
      `;

      const result = await model.generateContent(prompt);
      const raw = result.response.text();
      return parseAnalysisJson(raw);
    } catch (err) {
      geminiError = err;
      console.warn(`[AI Service] Gemini analysis failed (${err.message}). Attempting fallback to Groq...`);
    }
  }

  // Backup: Groq API
  if (process.env.GROQ_API_KEY) {
    try {
      const groq = getGroqClient();
      return await analyzeWithGroq(groq, extractedText);
    } catch (groqErr) {
      console.error(`[AI Service] Groq fallback failed (${groqErr.message})`);
      if (geminiError) {
        throw new Error(`AI analysis failed on both Gemini (${geminiError.message}) and Groq fallback (${groqErr.message})`);
      }
      throw groqErr;
    }
  }

  if (geminiError) {
    throw geminiError;
  }

  throw new Error('No AI provider configured. Please set GEMINI_API_KEY or GROQ_API_KEY.');
}

// ─── 2. CHAT ABOUT DOCUMENT (with Groq fallback) ───────────────────────────
async function chatWithDocument(documentText, chatHistory, userQuestion) {
  let geminiError = null;

  // Try Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = getGeminiModel();
      const systemContext = `
You are a legal assistant helping a user understand their legal document.
Answer clearly and simply. Do not use legal jargon.
If you do not know the answer from the document, say so honestly.

Document:
"""
${documentText.slice(0, 20000)}
"""
      `;

      const history = chatHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemContext }] },
          { role: 'model', parts: [{ text: 'Understood. I have read the document and I am ready to answer questions about it.' }] },
          ...history
        ]
      });

      const result = await chat.sendMessage(userQuestion);
      return result.response.text();
    } catch (err) {
      geminiError = err;
      console.warn(`[AI Service] Gemini chat failed (${err.message}). Attempting fallback to Groq...`);
    }
  }

  // Backup: Groq API
  if (process.env.GROQ_API_KEY) {
    try {
      const groq = getGroqClient();
      return await chatWithGroq(groq, documentText, chatHistory, userQuestion);
    } catch (groqErr) {
      console.error(`[AI Service] Groq chat fallback failed (${groqErr.message})`);
      if (geminiError) {
        throw new Error(`AI chat failed on both Gemini (${geminiError.message}) and Groq fallback (${groqErr.message})`);
      }
      throw groqErr;
    }
  }

  if (geminiError) {
    throw geminiError;
  }

  throw new Error('No AI provider configured. Please set GEMINI_API_KEY or GROQ_API_KEY.');
}

module.exports = {
  analyzeDocument,
  chatWithDocument,
  analyzeWithGroq,
  chatWithGroq,
  getGeminiModel,
  getGroqClient,
  parseAnalysisJson
};
