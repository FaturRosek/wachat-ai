const express = require('express');
const router = express.Router();
const SendingJobController = require('../controllers/sendingJobController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', SendingJobController.createJob);
router.get('/', SendingJobController.getJobs);
router.get('/:id', SendingJobController.getJobById);
router.patch('/:id/cancel', SendingJobController.cancelJob);
router.delete('/:id', SendingJobController.deleteJob);

module.exports = router;
