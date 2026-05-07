# Legal Document Simplifier — Full Project Blueprint

> Stack: MongoDB + Express + React + Node.js + Gemini 2.0 Flash API  
> Hosting: Vercel (frontend) + Render (backend) + MongoDB Atlas (database)  
> Cost: ₹0

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Environment Setup](#2-environment-setup)
3. [Backend — Node + Express](#3-backend--node--express)
4. [Database — MongoDB Schemas](#4-database--mongodb-schemas)
5. [AI Integration — Gemini API](#5-ai-integration--gemini-api)
6. [All API Routes](#6-all-api-routes)
7. [Frontend — React](#7-frontend--react)
8. [PDF Parsing](#8-pdf-parsing)
9. [Auth Flow — JWT](#9-auth-flow--jwt)
10. [Deployment](#10-deployment)
11. [Folder-by-Folder File List](#11-folder-by-folder-file-list)
12. [npm Packages](#12-npm-packages)
13. [.env Variables](#13-env-variables)
14. [Build Order — What to Build First](#14-build-order--what-to-build-first)

---

## 1. Project Structure

```
legal-doc-simplifier/
│
├── client/                        ← React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── UploadBox.jsx
│   │   │   ├── DocumentCard.jsx
│   │   │   ├── RiskBadge.jsx
│   │   │   ├── ChatBox.jsx
│   │   │   └── Loader.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── DocumentView.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── utils/
│   │   │   └── api.js             ← axios instance with base URL + auth header
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   └── package.json
│
├── server/                        ← Express backend
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── documentController.js
│   │   └── chatController.js
│   ├── middleware/
│   │   ├── authMiddleware.js      ← JWT verify
│   │   └── uploadMiddleware.js    ← multer config
│   ├── models/
│   │   ├── User.js
│   │   └── Document.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── documentRoutes.js
│   │   └── chatRoutes.js
│   ├── services/
│   │   ├── geminiService.js       ← all Gemini API calls
│   │   └── pdfService.js          ← pdf-parse logic
│   ├── uploads/                   ← temp PDF storage (gitignored)
│   ├── .env
│   ├── index.js                   ← entry point
│   └── package.json
│
└── README.md
```

---

## 2. Environment Setup

### Prerequisites

- Node.js v18+
- MongoDB Atlas account (free) → https://cloud.mongodb.com
- Google AI Studio account (free) → https://aistudio.google.com
- Git

### Initial Setup Commands

```bash
# Create project folders
mkdir legal-doc-simplifier
cd legal-doc-simplifier

# Setup backend
mkdir server && cd server
npm init -y
cd ..

# Setup frontend
npm create vite@latest client -- --template react
cd client && npm install
cd ..
```

---

## 3. Backend — Node + Express

### server/index.js

```javascript
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/docs', documentRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/', (req, res) => res.json({ status: 'API running' }));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch(err => console.error('DB connection error:', err));
```

---

## 4. Database — MongoDB Schemas

### server/models/User.js

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  docsUploaded: { type: Number, default: 0 },   // track free tier usage
  plan: { type: String, enum: ['free'], default: 'free' }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  next();
});

// Compare password
userSchema.methods.comparePassword = function(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
```

### server/models/Document.js

```javascript
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
  simplified: String,                                // full plain-English version
  riskClauses: [riskClauseSchema],
  riskScore: { type: Number, min: 0, max: 10 },
  chatHistory: [chatMessageSchema],
  language: { type: String, default: 'English' }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
```

---

## 5. AI Integration — Gemini API

### server/services/geminiService.js

```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ─── 1. ANALYZE DOCUMENT (main function) ───────────────────────────────────
async function analyzeDocument(extractedText) {
  const prompt = `
You are an expert legal document analyst. A user has uploaded a legal document.
Your job is to help non-lawyers understand it clearly.

Given the document text below, do the following:
1. Write a plain-language SUMMARY in exactly 3 sentences.
2. Rewrite the document in SIMPLIFIED plain English section by section. Use simple words. No legal jargon.
3. Find all RISKY or UNUSUAL clauses. For each one provide:
   - clause: short title
   - severity: "high", "medium", or "low"
   - explanation: one sentence in plain English explaining why it matters
4. Give an overall RISK SCORE from 0 (very safe) to 10 (very risky).

Return ONLY valid JSON. No markdown, no explanation outside the JSON.

{
  "summary": "...",
  "simplified": "...",
  "riskClauses": [
    { "clause": "...", "severity": "high|medium|low", "explanation": "..." }
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

  // Strip markdown code fences if present
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
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
```

---

## 6. All API Routes

### Auth Routes — server/routes/authRoutes.js

```
POST /api/auth/register    → Create account
POST /api/auth/login       → Login, returns JWT token
GET  /api/auth/me          → Get logged-in user info (protected)
```

### Document Routes — server/routes/documentRoutes.js

```
POST   /api/docs/upload    → Upload PDF → extract text → call Gemini → save to DB
GET    /api/docs/           → Get all documents for logged-in user
GET    /api/docs/:id        → Get one document with full analysis
DELETE /api/docs/:id        → Delete a document
```

### Chat Routes — server/routes/chatRoutes.js

```
POST /api/chat/:docId      → Send a question about a document, get AI answer
GET  /api/chat/:docId      → Get full chat history for a document
```

---

### server/controllers/authController.js

```javascript
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const user = await User.create({ name, email, passwordHash: password });
    res.status(201).json({ token: generateToken(user._id), user: { id: user._id, name, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: generateToken(user._id), user: { id: user._id, name: user.name, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.me = async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
  res.json(user);
};
```

### server/controllers/documentController.js

```javascript
const Document = require('../models/Document');
const User = require('../models/User');
const { extractTextFromPDF } = require('../services/pdfService');
const { analyzeDocument } = require('../services/geminiService');
const fs = require('fs');

exports.uploadDocument = async (req, res) => {
  try {
    // Free tier limit: 3 docs per user
    const user = await User.findById(req.user.id);
    if (user.docsUploaded >= 3) {
      return res.status(403).json({ error: 'Free tier limit reached (3 documents)' });
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

    // 4. Update user doc count
    await User.findByIdAndUpdate(req.user.id, { $inc: { docsUploaded: 1 } });

    // 5. Delete temp file
    fs.unlinkSync(filePath);

    res.status(201).json(doc);
  } catch (err) {
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
```

---

## 7. Frontend — React

### How screens connect

```
App.jsx
├── / → Login.jsx
├── /register → Register.jsx
└── /dashboard (protected)
    ├── Dashboard.jsx → shows all uploaded docs + upload button
    └── /doc/:id → DocumentView.jsx → simplified text + risk panel + chat
```

### client/src/utils/api.js

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL   // e.g. http://localhost:5000
});

// Auto-attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

### client/src/context/AuthContext.jsx

```javascript
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      // Decode user from token or fetch /api/auth/me
      const decoded = JSON.parse(atob(token.split('.')[1]));
      setUser(decoded);
    }
  }, [token]);

  const login = (tokenFromServer, userData) => {
    localStorage.setItem('token', tokenFromServer);
    setToken(tokenFromServer);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### Key React logic — Upload Flow (Dashboard.jsx)

```javascript
const handleUpload = async (file) => {
  const formData = new FormData();
  formData.append('pdf', file);           // must match multer field name

  setLoading(true);
  try {
    const res = await api.post('/api/docs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    navigate(`/doc/${res.data._id}`);     // redirect to document view
  } catch (err) {
    setError(err.response?.data?.error || 'Upload failed');
  } finally {
    setLoading(false);
  }
};
```

### Key React logic — Chat (DocumentView.jsx)

```javascript
const sendMessage = async () => {
  if (!input.trim()) return;
  const userMsg = { role: 'user', content: input };
  setMessages(prev => [...prev, userMsg]);
  setInput('');

  const res = await api.post(`/api/chat/${docId}`, { message: input });
  setMessages(prev => [...prev, { role: 'model', content: res.data.reply }]);
};
```

---

## 8. PDF Parsing

### server/services/pdfService.js

```javascript
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
```

### server/middleware/uploadMiddleware.js (multer)

```javascript
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only PDF files are allowed'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }   // 10MB max
});

module.exports = upload;
```

---

## 9. Auth Flow — JWT

### How it works end to end

```
1. User registers → password hashed with bcrypt → saved to MongoDB
2. User logs in → password compared → JWT token generated (expires in 7 days)
3. Token sent to frontend → stored in localStorage
4. Every API request → token sent in Authorization: Bearer <token> header
5. authMiddleware verifies token → attaches req.user = { id, email }
6. Protected routes use authMiddleware before the controller
```

### server/middleware/authMiddleware.js

```javascript
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

---

## 10. Deployment

### Backend → Render.com (free)

1. Push `server/` folder to GitHub
2. Go to render.com → New Web Service → connect GitHub repo
3. Set build command: `npm install`
4. Set start command: `node index.js`
5. Add all environment variables from `.env`
6. Deploy → you get a URL like `https://your-app.onrender.com`

### Frontend → Vercel (free)

1. Push `client/` folder to GitHub
2. Go to vercel.com → New Project → connect GitHub repo
3. Framework: Vite
4. Add env variable: `VITE_API_URL=https://your-app.onrender.com`
5. Deploy → you get a URL like `https://your-app.vercel.app`

### Database → MongoDB Atlas (free)

1. Create account at cloud.mongodb.com
2. Create a free M0 cluster (512MB, enough for hundreds of documents)
3. Create a database user with password
4. Whitelist IP: `0.0.0.0/0` (allow all IPs for Render compatibility)
5. Copy connection string → paste into server `.env` as `MONGO_URI`

---

## 11. Folder-by-Folder File List

### What each file does

```
server/
├── index.js                  ← starts express server, connects MongoDB
├── routes/
│   ├── authRoutes.js         ← POST /register, POST /login, GET /me
│   ├── documentRoutes.js     ← POST /upload, GET /, GET /:id, DELETE /:id
│   └── chatRoutes.js         ← POST /:docId, GET /:docId
├── controllers/
│   ├── authController.js     ← register/login logic
│   ├── documentController.js ← upload, fetch, delete logic
│   └── chatController.js     ← send message, fetch history
├── middleware/
│   ├── authMiddleware.js     ← JWT verification
│   └── uploadMiddleware.js   ← multer PDF upload config
├── models/
│   ├── User.js               ← user schema + password hashing
│   └── Document.js           ← document + risk + chat schema
├── services/
│   ├── geminiService.js      ← analyzeDocument(), chatWithDocument()
│   └── pdfService.js         ← extractTextFromPDF()
└── uploads/                  ← temp PDF files (auto-deleted after processing)

client/src/
├── main.jsx                  ← React entry, wraps app in AuthProvider
├── App.jsx                   ← routes (react-router-dom)
├── context/
│   └── AuthContext.jsx       ← global auth state
├── utils/
│   └── api.js                ← axios instance with auto token
├── pages/
│   ├── Login.jsx             ← login form → calls /api/auth/login
│   ├── Register.jsx          ← register form → calls /api/auth/register
│   ├── Dashboard.jsx         ← doc list + drag-drop upload
│   └── DocumentView.jsx      ← simplified text + risks + chat
└── components/
    ├── Navbar.jsx            ← top bar with logout
    ├── UploadBox.jsx         ← drag and drop PDF upload area
    ├── DocumentCard.jsx      ← card showing doc name + risk score
    ├── RiskBadge.jsx         ← colored badge (high/medium/low)
    ├── ChatBox.jsx           ← chat UI for asking questions
    └── Loader.jsx            ← loading spinner
```

---

## 12. npm Packages

### Backend (server/)

```bash
npm install express mongoose dotenv cors bcryptjs jsonwebtoken multer pdf-parse @google/generative-ai
npm install --save-dev nodemon
```

Add to `package.json` scripts:
```json
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js"
}
```

### Frontend (client/)

```bash
npm install axios react-router-dom react-dropzone react-markdown
```

---

## 13. .env Variables

### server/.env

```
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/legaldocs
JWT_SECRET=some_very_long_random_secret_string_here
GEMINI_API_KEY=your_gemini_api_key_from_aistudio
CLIENT_URL=http://localhost:5173
```

### client/.env

```
VITE_API_URL=http://localhost:5000
```

> For production, change `CLIENT_URL` to your Vercel URL and `VITE_API_URL` to your Render URL.

---

## 14. Build Order — What to Build First

Follow this exact order to avoid confusion:

```
Week 1 — Backend Core
─────────────────────
Day 1:  Setup server/, install packages, write index.js, connect MongoDB Atlas
Day 2:  Create User model + authController + authRoutes → test with Postman
Day 3:  Create Document model + uploadMiddleware + pdfService → test PDF extraction
Day 4:  Wire Gemini API in geminiService.js → test with a sample contract text
Day 5:  Complete documentController (upload → extract → analyze → save) → test full flow

Week 2 — Frontend
─────────────────
Day 6:  Setup React app, install packages, configure api.js + AuthContext
Day 7:  Build Login + Register pages → connect to backend auth routes
Day 8:  Build Dashboard → fetch documents list, show upload box
Day 9:  Build DocumentView → show summary, simplified text, risk cards
Day 10: Build ChatBox component → connect to chat routes

Week 3 — Polish + Deploy
────────────────────────
Day 11: Test everything end to end, fix bugs
Day 12: Add error handling, loading states, empty states
Day 13: Deploy backend to Render, frontend to Vercel
Day 14: Test on deployed URLs, fix CORS/env issues, write README
```

---

## Quick Reference — Request/Response Examples

### POST /api/auth/register
```json
Request:  { "name": "Arjun", "email": "arjun@email.com", "password": "abc123" }
Response: { "token": "eyJ...", "user": { "id": "...", "name": "Arjun", "email": "arjun@email.com" } }
```

### POST /api/docs/upload
```
Request: multipart/form-data with file field named "pdf"
Response: { "_id": "...", "fileName": "lease.pdf", "summary": "...", "riskScore": 7, "riskClauses": [...] }
```

### POST /api/chat/:docId
```json
Request:  { "message": "Can I sublet the property?" }
Response: { "reply": "No, clause 8.3 prohibits subletting without written landlord approval." }
```

---

*Built with MERN Stack + Google Gemini 2.0 Flash | Student Project*
