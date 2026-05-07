const express = require('express');
const { uploadDocument, getAllDocuments, getDocument, deleteDocument } = require('../controllers/documentController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

router.post('/upload', upload.single('pdf'), uploadDocument);
router.get('/', getAllDocuments);
router.get('/:id', getDocument);
router.delete('/:id', deleteDocument);

module.exports = router;
