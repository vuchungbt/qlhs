const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const multer = require('multer');
const path = require('path');

// Cấu hình upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/avatars'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Không hỗ trợ định dạng file này!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Thiết lập tài khoản
router.get('/account', settingsController.getAccount);
router.post('/account', upload.single('profileImage'), settingsController.updateAccount);

// Thiết lập thông báo
router.get('/notifications', settingsController.getNotifications);
router.post('/notifications', settingsController.updateNotifications);

module.exports = router; 