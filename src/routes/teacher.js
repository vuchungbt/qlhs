const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { isTeacher, isTeacherOfClass } = require('./auth');
const Tuition = require('../models/Tuition');

// Middleware để kiểm tra giáo viên đã đăng nhập
const ensureTeacherLoggedIn = (req, res, next) => {
  if (!req.session.isLoggedIn || req.session.userType !== 'teacher') {
    return res.redirect('/auth/login');
  }
  next();
};

// Trang dashboard
router.get('/dashboard', ensureTeacherLoggedIn, teacherController.showDashboard);

// Quản lý lớp học
router.get('/classes', ensureTeacherLoggedIn, teacherController.showClasses);
router.get('/classes/:id', ensureTeacherLoggedIn, isTeacherOfClass, teacherController.showClassDetails);

// Quản lý điểm danh
router.get('/attendance/take/:id', ensureTeacherLoggedIn, isTeacherOfClass, teacherController.showAttendance);
router.post('/attendance/submit/:id', ensureTeacherLoggedIn, isTeacherOfClass, teacherController.submitAttendance);

// Quản lý điểm danh theo lớp
router.get('/attendance', ensureTeacherLoggedIn, teacherController.getAttendanceByClass);
router.get('/attendance/class/:id', ensureTeacherLoggedIn, isTeacherOfClass, teacherController.getAttendanceByClassDetail);

// Quản lý điểm danh theo học sinh
router.get('/attendance/student', ensureTeacherLoggedIn, teacherController.getAttendanceByStudent);
router.get('/attendance/student/:id', ensureTeacherLoggedIn, teacherController.getAttendanceByStudentDetail);

// Cập nhật và xóa điểm danh
router.post('/attendance/update', ensureTeacherLoggedIn, teacherController.updateAttendance);
router.delete('/attendance/:id', ensureTeacherLoggedIn, teacherController.deleteAttendance);

// Routes cho điểm danh nhóm
router.get('/attendance/create-group', ensureTeacherLoggedIn, teacherController.showCreateAttendanceGroup);
router.post('/attendance/create-group', ensureTeacherLoggedIn, teacherController.createAttendanceGroup);
router.get('/attendance/groups', ensureTeacherLoggedIn, teacherController.showAttendanceGroups);
router.get('/attendance/groups/:id', ensureTeacherLoggedIn, teacherController.showAttendanceGroupDetail);
router.get('/attendance/groups/:id/take', ensureTeacherLoggedIn, teacherController.showTakeGroupAttendance);
router.post('/attendance/groups/:id/take', ensureTeacherLoggedIn, teacherController.submitGroupAttendance);
router.get('/api/students-by-class/:id', ensureTeacherLoggedIn, teacherController.getStudentsByClass);

// Quản lý học phí
router.get('/tuition', ensureTeacherLoggedIn, teacherController.showTuition);
router.post('/tuition/payment', ensureTeacherLoggedIn, teacherController.recordTuitionPayment);
router.post('/tuition/generate', ensureTeacherLoggedIn, teacherController.generateTuition);
router.post('/tuition/create', ensureTeacherLoggedIn, teacherController.createManualTuition);
router.post('/tuition/create-manual', ensureTeacherLoggedIn, teacherController.createManualTuition);
router.post('/tuition/update', ensureTeacherLoggedIn, teacherController.updateTuition);
router.post('/tuition/update-note', ensureTeacherLoggedIn, teacherController.updateTuitionNote);
router.post('/tuition/delete', ensureTeacherLoggedIn, teacherController.deleteTuition);

// Route lấy danh sách học phí theo trạng thái
router.get('/tuition/list/:status', async (req, res) => {
    try {
        const { status } = req.params;
        const { month, year, scheduleId } = req.query;
        if (!month || !year || !scheduleId) {
            return res.json({ success: false, message: 'Thiếu tham số' });
        }
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        const today = new Date();
        let query = {
            schedule: scheduleId,
            dueDate: { $gte: startDate, $lte: endDate }
        };
        if (status === 'pending') {
            query.status = 'pending';
            query.dueDate.$gte = today;
        } else if (status === 'overdue') {
            query.$or = [
                { schedule: scheduleId, status: 'pending', dueDate: { $lt: today, $gte: startDate, $lte: endDate } },
                { schedule: scheduleId, status: 'overdue', dueDate: { $gte: startDate, $lte: endDate } }
            ];
            delete query.dueDate;
            delete query.schedule;
        } else {
            return res.json({ success: false, message: 'Trạng thái không hợp lệ' });
        }
        const tuitions = await Tuition.find(query)
            .populate('student')
            .sort({ dueDate: 1 });
        res.json({ success: true, tuitions });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Quản lý học sinh
router.get('/students', ensureTeacherLoggedIn, teacherController.showMyStudents);
router.get('/students/:id', ensureTeacherLoggedIn, teacherController.showStudentDetail);
router.put('/students/:id/note', ensureTeacherLoggedIn, teacherController.updateStudentNote);

// Quản lý phụ huynh
router.get('/parents', ensureTeacherLoggedIn, teacherController.showMyParents);
router.get('/parents/:id', ensureTeacherLoggedIn, teacherController.showParentDetail);
router.post('/parents/:id/contact', ensureTeacherLoggedIn, teacherController.addParentContact);

// API routes
router.get('/api/attendance/:id', ensureTeacherLoggedIn, teacherController.getAttendanceDetail);

// API routes cho modal
router.get('/api/students/:id', ensureTeacherLoggedIn, teacherController.getStudentInfo);
router.get('/api/parents/:id', ensureTeacherLoggedIn, teacherController.getParentInfo);

module.exports = router; 