// Lấy thông tin học sinh theo lớp
router.get('/students/by-schedule/:id', isAuthenticated, academicController.getStudentsBySchedule);

// API để lấy thống kê điểm danh cho một học sinh
router.get('/api/attendance/stats', isAuthenticated, academicController.getStudentAttendanceStats); 