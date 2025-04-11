const express = require('express');
const router = express.Router();
const administrativeController = require('../controllers/administrativeController');

// Quản lý giáo viên
router.get('/teachers', administrativeController.getTeachers);
router.post('/teachers', administrativeController.createTeacher);
router.get('/teachers/:id', administrativeController.getTeacherDetail);
router.post('/teachers/:id', administrativeController.updateTeacher);
router.delete('/teachers/:id', administrativeController.deleteTeacher);

module.exports = router;