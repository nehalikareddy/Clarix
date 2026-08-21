const {
  analyzeDocument,
  chatWithDocument,
  parseAnalysisJson
} = require('../services/geminiService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

jest.mock('@google/generative-ai');
jest.mock('groq-sdk');

describe('AI Service - JSON parsing', () => {
  test('parses valid JSON analysis output', () => {
    const raw = '```json\n{"summary":"Sample summary","simplified":[],"riskClauses":[],"riskScore":3}\n```';
    const parsed = parseAnalysisJson(raw);
    expect(parsed.summary).toBe('Sample summary');
    expect(parsed.riskScore).toBe(3);
  });

  test('throws an error for non-JSON string', () => {
    expect(() => parseAnalysisJson('This is not json')).toThrow();
  });
});

describe('AI Service - Provider and Fallback Logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('throws error if neither Gemini nor Groq key is provided', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;

    await expect(analyzeDocument('Sample text')).rejects.toThrow(
      /No AI provider configured/
    );
  });

  test('uses Gemini when GEMINI_API_KEY is configured and succeeds', async () => {
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    delete process.env.GROQ_API_KEY;

    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          summary: 'Gemini summary',
          simplified: [{ section: 'Terms', content: 'Details' }],
          riskClauses: [{ clause: 'Penalty', severity: 'high', explanation: 'High fee' }],
          riskScore: 7
        })
      }
    });

    GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
      generateContent: mockGenerateContent
    });

    const result = await analyzeDocument('Contract content');
    expect(mockGenerateContent).toHaveBeenCalled();
    expect(result.summary).toBe('Gemini summary');
    expect(result.riskScore).toBe(7);
  });

  test('falls back to Groq when Gemini fails', async () => {
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    process.env.GROQ_API_KEY = 'groq-test-key';

    // Make Gemini fail
    GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
      generateContent: jest.fn().mockRejectedValue(new Error('Gemini quota exceeded'))
    });

    // Make Groq succeed
    const mockGroqCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Groq fallback summary',
              simplified: [],
              riskClauses: [],
              riskScore: 4
            })
          }
        }
      ]
    });

    Groq.prototype.chat = {
      completions: {
        create: mockGroqCreate
      }
    };

    const result = await analyzeDocument('Contract content');
    expect(mockGroqCreate).toHaveBeenCalled();
    expect(result.summary).toBe('Groq fallback summary');
    expect(result.riskScore).toBe(4);
  });

  test('falls back to Groq for chatWithDocument when Gemini chat fails', async () => {
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    process.env.GROQ_API_KEY = 'groq-test-key';

    // Make Gemini fail
    GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
      startChat: jest.fn().mockReturnValue({
        sendMessage: jest.fn().mockRejectedValue(new Error('Gemini 500 error'))
      })
    });

    // Make Groq succeed
    const mockGroqCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: 'This is the Groq chat answer.'
          }
        }
      ]
    });

    Groq.prototype.chat = {
      completions: {
        create: mockGroqCreate
      }
    };

    const reply = await chatWithDocument('Contract text', [], 'What does this clause mean?');
    expect(mockGroqCreate).toHaveBeenCalled();
    expect(reply).toBe('This is the Groq chat answer.');
  });
});
