const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

// ─── 1. ANALYZE DOCUMENT (main function) ───────────────────────────────────
async function analyzeDocument(extractedText) {
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

  try {
    // Robust JSON extraction: Find the first '{' and last '}'
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}') + 1;
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("AI failed to generate a structured analysis.");
    }
    
    const jsonString = raw.substring(jsonStart, jsonEnd);
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('Gemini Parsing Error:', raw);
    throw new Error('Analysis failed. The AI response was malformed. Please try again.');
  }
}

// ─── 2. CHAT ABOUT DOCUMENT ────────────────────────────────────────────────
async function chatWithDocument(documentText, chatHistory, userQuestion) {
  const systemContext = `
You are a legal assistant helping a user understand their legal document.
Answer clearly and simply. Do not use legal jargon.
If you do not know the answer from the document, say so honestly.

Document:
"""
${documentText.slice(0, 20000)}
"""
  `;

  // Build conversation history for Gemini
  const history = chatHistory.map(msg => ({
    role: msg.role,
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
}

module.exports = { analyzeDocument, chatWithDocument };
