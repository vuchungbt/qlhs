const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const backupController = require('../controllers/backupController');

// Middleware bảo vệ routes admin
router.use(authController.isAuthenticated);
router.use(authController.isAdmin);

// Routes quản lý backup
router.get('/backup', backupController.getBackupSettings);
router.post('/backup/settings', backupController.updateBackupSettings);
router.post('/backup/create', backupController.performBackup);
router.get('/backup/download/:filename', backupController.downloadBackup);
router.post('/backup/delete/:filename', backupController.deleteBackup);
router.post('/backup/restore/:filename', backupController.restoreBackup);

module.exports = router; 