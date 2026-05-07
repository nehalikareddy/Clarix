const express = require('express');
const { sendMessage, getChatHistory } = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/:docId', sendMessage);
router.get('/:docId', getChatHistory);

module.exports = router;
