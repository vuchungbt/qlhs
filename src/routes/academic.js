const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');
const scheduleController = require('../controllers/scheduleController');

// Lịch học
router.get('/schedule', academicController.getSchedule);
router.post('/schedule', scheduleController.createSchedule);
router.get('/schedule/:id', scheduleController.getScheduleDetail);
router.get('/schedule/:id/edit', scheduleController.getEditSchedule);
router.post('/schedule/:id', scheduleController.updateSchedule);
router.delete('/schedule/:id', scheduleController.deleteSchedule);

// Quản lý học sinh
router.get('/students', academicController.getStudents);
router.post('/students', academicController.createStudent);
router.get('/students/:id', academicController.getStudentDetail);
router.get('/students/:id/data', academicController.getStudentData);
router.post('/students/:id', academicController.updateStudent);
router.delete('/students/:id', academicController.deleteStudent);

// Quản lý phụ huynh
router.get('/parents', academicController.getParents);
router.post('/parents', academicController.createParent);
router.get('/parents/:id', academicController.getParentDetail);
router.get('/parents/:id/edit', academicController.getEditParent);
router.post('/parents/:id', academicController.updateParent);
router.delete('/parents/:id', academicController.deleteParent);

// Điểm danh
router.get('/attendance', academicController.getAttendance);
router.post('/attendance', academicController.createAttendance);
router.post('/attendance/batch', academicController.batchAttendance);

module.exports = router;