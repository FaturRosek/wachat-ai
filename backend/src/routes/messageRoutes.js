const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', MessageController.sendMessage);
router.get('/', MessageController.getMessages);
router.get('/history/:phone', MessageController.getPhoneHistory);
router.get('/:id', MessageController.getMessageById);

module.exports = router;
