const express = require('express');
const router = express.Router();
const TemplateController = require('../controllers/templateController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', TemplateController.createTemplate);
router.get('/', TemplateController.getTemplates);
router.get('/:id', TemplateController.getTemplateById);
router.put('/:id', TemplateController.updateTemplate);
router.delete('/:id', TemplateController.deleteTemplate);

module.exports = router;
