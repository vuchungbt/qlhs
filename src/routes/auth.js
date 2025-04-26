const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Đăng nhập Admin
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

// Đăng nhập Giáo viên
router.get('/teacher-login', authController.getTeacherLogin);
router.post('/teacher-login', authController.postTeacherLogin);

// Đăng ký
router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);

// Đăng xuất
router.get('/logout', authController.logout);

module.exports = router;
module.exports.isAuthenticated = authController.isAuthenticated;
module.exports.isAdmin = authController.isAdmin;
module.exports.isTeacher = authController.isTeacher;
module.exports.isTeacherOfClass = authController.isTeacherOfClass; 