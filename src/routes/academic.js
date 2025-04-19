const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');
const scheduleController = require('../controllers/scheduleController');
const { ensureAuthenticated } = require('../config/auth');

// Middleware để log request body cho debugging
const logRequestBody = (req, res, next) => {
  console.log('Request Body:', req.body);
  console.log('Content-Type:', req.headers['content-type']);
  next();
};

// Lịch học
router.get('/schedule', ensureAuthenticated, scheduleController.getSchedules);
router.post('/schedule', ensureAuthenticated, scheduleController.createSchedule);
router.get('/schedule/:id', ensureAuthenticated, scheduleController.getScheduleDetail);
router.get('/schedule/:id/edit', ensureAuthenticated, scheduleController.getEditSchedule);
router.post('/schedule/:id', ensureAuthenticated, scheduleController.updateSchedule);
router.delete('/schedule/:id', ensureAuthenticated, scheduleController.deleteSchedule);

// API để lấy danh sách học sinh của lịch học
router.get('/schedule/:id/students-data', ensureAuthenticated, scheduleController.getScheduleStudentsData);

// Quản lý học sinh
router.get('/students', ensureAuthenticated, academicController.getStudents);
router.post('/students', ensureAuthenticated, academicController.createStudent);
router.get('/students/:id', ensureAuthenticated, academicController.getStudentDetail);
router.get('/students/:id/data', ensureAuthenticated, academicController.getStudentData);
router.post('/students/:id', ensureAuthenticated, academicController.updateStudent);
router.delete('/students/:id', ensureAuthenticated, academicController.deleteStudent);

// Quản lý phụ huynh
router.get('/parents', ensureAuthenticated, academicController.getParents);
router.post('/parents', ensureAuthenticated, academicController.createParent);
router.get('/parents/:id', ensureAuthenticated, academicController.getParentDetail);
router.get('/parents/:id/edit', ensureAuthenticated, academicController.getEditParent);
router.post('/parents/:id', ensureAuthenticated, academicController.updateParent);
router.delete('/parents/:id', ensureAuthenticated, academicController.deleteParent);

// Quản lý học phí
router.get('/tuition', ensureAuthenticated, academicController.getTuition);
router.post('/tuition', ensureAuthenticated, academicController.addTuition);
router.get('/tuition/student/:id', ensureAuthenticated, academicController.getTuitionByStudent);
router.get('/tuition/class/:id', ensureAuthenticated, academicController.getTuitionByClass);
router.post('/tuition/generate', ensureAuthenticated, logRequestBody, academicController.generateTuition);
router.post('/tuition/payment', ensureAuthenticated, academicController.recordTuitionPayment);
router.post('/tuition/update', ensureAuthenticated, academicController.updateTuition);
router.post('/tuition/delete', ensureAuthenticated, academicController.deleteTuition);
router.delete('/api/tuition/:id', ensureAuthenticated, academicController.deleteTuitionApi);

// Quản lý điểm danh theo lớp học
router.get('/attendance/class', ensureAuthenticated, academicController.getAttendanceByClass);
router.get('/attendance/class/:id', ensureAuthenticated, academicController.getAttendanceByClassDetail);

// Quản lý điểm danh theo học sinh
router.get('/attendance/student', ensureAuthenticated, academicController.getAttendanceByStudent);
router.get('/attendance/student/:id', ensureAuthenticated, academicController.getAttendanceByStudentDetail);

// Routes điểm danh
router.get('/attendance', ensureAuthenticated, academicController.getAttendance);
router.post('/attendance', ensureAuthenticated, academicController.batchAttendance);
router.post('/attendance/update', ensureAuthenticated, academicController.updateAttendance);
router.delete('/attendance/:id', ensureAuthenticated, academicController.deleteAttendance);

// Tuition by student - simple views
router.get('/tuition-by-student', ensureAuthenticated, academicController.getTuitionByStudent);
router.get('/tuition-student/:studentId', ensureAuthenticated, academicController.getTuitionByStudentDetail);

// Thêm route mới cho đồng bộ hóa enrollment
router.get('/sync-enrollments', ensureAuthenticated, academicController.syncEnrollments);

module.exports = router;