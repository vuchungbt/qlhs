const bcrypt = require('bcryptjs');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');
const Attendance = require('../models/Attendance');
const Tuition = require('../models/Tuition');
const logger = require('../config/logger');
const moment = require('moment');
const Parent = require('../models/Parent');
const ContactLog = require('../models/ContactLog');
const AttendanceGroup = require('../models/AttendanceGroup');

// Hiển thị trang đăng nhập
exports.showLoginForm = (req, res) => {
  res.render('teacher/login');
};

// Xử lý đăng nhập
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Tìm giáo viên theo email
    const teacher = await Teacher.findOne({ email });
    
    if (!teacher) {
      logger.warn(`Đăng nhập thất bại: Email không tồn tại ${email}`);
      return res.render('teacher/login', { errorMessage: 'Email hoặc mật khẩu không chính xác' });
    }
    
    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, teacher.password);
    
    if (!isPasswordValid) {
      logger.warn(`Đăng nhập thất bại: Mật khẩu không chính xác cho giáo viên ${email}`);
      return res.render('teacher/login', { errorMessage: 'Email hoặc mật khẩu không chính xác' });
    }
    
    // Lưu thông tin giáo viên vào session
    req.session.isLoggedIn = true;
    req.session.userType = 'teacher';
    req.session.user = {
      _id: teacher._id,
      name: `${teacher.firstName} ${teacher.lastName}`,
      email: teacher.email,
      subject: teacher.subject
    };
    
    logger.info(`Giáo viên đăng nhập thành công: ${teacher.email}`);
    
    // Chuyển hướng đến trang dashboard
    res.redirect('/teacher/dashboard');
    
  } catch (error) {
    logger.error(`Lỗi đăng nhập giáo viên: ${error.message}`);
    res.render('teacher/login', { errorMessage: 'Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại sau.' });
  }
};

// Đăng xuất
exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      logger.error(`Lỗi đăng xuất giáo viên: ${err.message}`);
      return res.redirect('/teacher/dashboard');
    }
    res.redirect('/teacher/login');
  });
};

// Hiển thị trang dashboard
exports.showDashboard = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    
    // Lấy danh sách lớp của giáo viên
    const schedules = await Schedule.find({ teacher: teacherId })
      .sort({ dayOfWeek: 1, startTime: 1 });
    
    // Đếm số học sinh trong mỗi lớp
    const schedulesWithCounts = await Promise.all(schedules.map(async (schedule) => {
      const activeEnrollments = await Enrollment.countDocuments({
        class: schedule._id,
        status: 'active'
      });
      
      return {
        _id: schedule._id,
        className: schedule.name,
        days: schedule.days,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime || (schedule.time ? schedule.time.start : ''),
        endTime: schedule.endTime || (schedule.time ? schedule.time.end : ''),
        studentCount: activeEnrollments
      };
    }));
    
    // Lấy thông tin điểm danh gần đây nhất
    const recentAttendance = await Attendance.find({ teacher: teacherId })
      .sort({ date: -1 })
      .limit(5)
      .populate('schedule', 'name');
    
    res.render('teacher/dashboard', {
      title: 'Trang Quản Lý Giáo Viên',
      teacherName: req.session.user.name,
      classes: schedulesWithCounts,
      recentAttendance: recentAttendance,
      moment: moment
    });
  } catch (error) {
    console.error('Lỗi hiển thị dashboard giáo viên:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi Server',
      message: 'Đã xảy ra lỗi khi tải trang quản lý.',
      isAuthenticated: req.session && req.session.isLoggedIn || false
    });
  }
};

// Hiển thị danh sách lớp học
exports.showClasses = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    
    // Lấy danh sách lớp của giáo viên với đầy đủ thông tin
    const schedules = await Schedule.find({ teacher: teacherId })
      .sort({ dayOfWeek: 1, startTime: 1 });
    
    // Đếm số học sinh trong mỗi lớp và lấy thông tin điểm danh gần nhất
    const classesWithDetails = await Promise.all(schedules.map(async (schedule) => {
      const activeEnrollments = await Enrollment.countDocuments({
        class: schedule._id,
        status: 'active'
      });
      
      // Lấy điểm danh gần nhất của lớp
      const lastAttendance = await Attendance.findOne({
        schedule: schedule._id
      }).sort({ date: -1 });
      
      return {
        _id: schedule._id,
        className: schedule.name,
        days: schedule.days,
        dayOfWeek: schedule.dayOfWeek,
        time: schedule.time,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        scheduleDisplay: schedule.scheduleDisplay,
        timeDisplay: schedule.timeDisplay,
        studentCount: activeEnrollments,
        lastAttendance: lastAttendance ? moment(lastAttendance.date).format('DD/MM/YYYY') : 'Chưa có'
      };
    }));
    
    res.render('teacher/classes', {
      title: 'Danh Sách Lớp Học',
      teacherName: req.session.user.name,
      classes: classesWithDetails
    });
  } catch (error) {
    console.error('Lỗi hiển thị danh sách lớp học:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi Server',
      message: 'Đã xảy ra lỗi khi tải danh sách lớp học.',
      isAuthenticated: req.session && req.session.isLoggedIn || false
    });
  }
};

// Hiển thị chi tiết lớp học
exports.showClassDetails = async (req, res) => {
  try {
    const scheduleId = req.params.id;
    
    // Lấy thông tin lớp học
    const schedule = await Schedule.findById(scheduleId);
    
    if (!schedule) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy',
        message: 'Không tìm thấy lớp học'
      });
    }
    
    // Lấy danh sách học sinh trong lớp
    const enrollments = await Enrollment.find({
      class: scheduleId,
      status: 'active'
    }).populate({
      path: 'student',
      select: 'name contactNumber parentName address notes parent status endDate',
      populate: {
        path: 'parent',
        select: 'name phone email'
      }
    });
    
    // Lấy lịch sử điểm danh của lớp
    const attendanceHistory = await Attendance.find({
      schedule: scheduleId
    }).sort({ date: -1 }).limit(10);
    
    // Tính thống kê điểm danh
    const presentCount = enrollments.length > 0 ? Math.floor(Math.random() * enrollments.length) : 0; // Demo data
    const absentCount = enrollments.length - presentCount;
    const attendanceRate = enrollments.length > 0 ? (presentCount / enrollments.length) * 100 : 0;
    
    res.render('teacher/class-details', {
      title: `Chi tiết lớp ${schedule.name}`,
      teacherName: req.session.user.name,
      schedule: schedule,
      students: enrollments,
      attendanceHistory: attendanceHistory,
      stats: {
        totalStudents: enrollments.length,
        presentCount: presentCount,
        absentCount: absentCount,
        attendanceRate: attendanceRate.toFixed(2)
      },
      moment: moment
    });
  } catch (error) {
    console.error('Lỗi hiển thị chi tiết lớp học:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi Server',
      message: 'Đã xảy ra lỗi khi tải chi tiết lớp học.',
      isAuthenticated: req.session && req.session.isLoggedIn || false
    });
  }
};

// Hiển thị trang điểm danh
exports.showAttendance = async (req, res) => {
  try {
    const scheduleId = req.params.id;
    
    // Lấy thông tin lớp học
    const schedule = await Schedule.findById(scheduleId);
    
    if (!schedule) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy',
        message: 'Không tìm thấy lớp học'
      });
    }
    
    // Xác định ngày cần điểm danh (từ query param hoặc ngày hiện tại)
    const selectedDate = req.query.date ? new Date(req.query.date) : new Date();
    selectedDate.setHours(0, 0, 0, 0);
    
    // Lấy danh sách học sinh trong lớp
    const enrollments = await Enrollment.find({
      class: scheduleId,
      status: 'active'
    }).populate('student', 'name contactNumber status endDate');
    
    // Lọc học sinh để chỉ hiển thị những học sinh đang học (active) và chưa đến ngày nghỉ học
    const filteredEnrollments = enrollments.filter(enrollment => {
      // Kiểm tra học sinh có tồn tại và có trạng thái
      if (!enrollment.student) return false;
      
      // Kiểm tra trạng thái active
      if (enrollment.student.status !== 'active') return false;
      
      // Kiểm tra ngày nghỉ học: nếu có ngày nghỉ học (endDate) và ngày điểm danh sau ngày nghỉ học, thì không hiển thị
      if (enrollment.student.endDate && new Date(enrollment.student.endDate) < selectedDate) return false;
      
      return true;
    });
    
    // Kiểm tra xem đã có dữ liệu điểm danh cho ngày đã chọn chưa
    const existingAttendance = await Attendance.findOne({
      schedule: scheduleId,
      date: {
        $gte: selectedDate,
        $lt: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    let attendanceData = null;
    if (existingAttendance) {
      attendanceData = existingAttendance.students.map(student => {
        return {
          studentId: student.student.toString(),
          status: student.status,
          note: student.note || ''
        };
      });
    }
    
    res.render('teacher/take-attendance', {
      title: `Điểm Danh - ${schedule.name}`,
      teacherName: req.session.user.name,
      schedule: schedule,
      students: filteredEnrollments,
      existingAttendance: attendanceData,
      today: moment(selectedDate).format('YYYY-MM-DD')
    });
  } catch (error) {
    console.error('Lỗi hiển thị trang điểm danh:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi Server',
      message: 'Đã xảy ra lỗi khi tải trang điểm danh.',
      isAuthenticated: req.session && req.session.isLoggedIn || false
    });
  }
};

// Xử lý gửi dữ liệu điểm danh
exports.submitAttendance = async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const { date, studentStatus, studentNote } = req.body;
    
    // Chuyển đổi dữ liệu điểm danh từ form
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    
    // Kiểm tra xem có dữ liệu điểm danh không
    if (!studentStatus || Object.keys(studentStatus).length === 0) {
      req.flash('info', 'Chưa có điểm danh nào được ghi nhận. Vui lòng kiểm tra lại.');
      return res.redirect(`/teacher/attendance/take/${scheduleId}`);
    }
    
    // Chuẩn bị dữ liệu học sinh
    const students = [];
    for (const [studentId, status] of Object.entries(studentStatus)) {
      const note = studentNote && studentNote[studentId] ? studentNote[studentId] : '';
      students.push({
        student: studentId,
        status: status,
        note: note
      });
    }
    
    // Kiểm tra xem đã có điểm danh cho ngày này chưa
    const existingAttendance = await Attendance.findOne({
      schedule: scheduleId,
      date: {
        $gte: attendanceDate,
        $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    if (existingAttendance) {
      // Cập nhật điểm danh hiện có
      existingAttendance.students = students;
      existingAttendance.updatedAt = new Date();
      await existingAttendance.save();
    } else {
      // Tạo bản ghi điểm danh mới
      const newAttendance = new Attendance({
        schedule: scheduleId,
        teacher: req.session.user._id,
        date: attendanceDate,
        students: students
      });
      await newAttendance.save();
    }
    
    req.flash('success', 'Đã lưu điểm danh thành công.');
    res.redirect(`/teacher/classes/${scheduleId}`);
  } catch (error) {
    console.error('Lỗi khi lưu điểm danh:', error);
    req.flash('error', 'Đã xảy ra lỗi khi lưu điểm danh.');
    res.redirect(`/teacher/attendance/take/${req.params.id}`);
  }
};

// Hiển thị học phí của các lớp học của giáo viên
exports.showTuition = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    
    // Lấy danh sách lớp của giáo viên
    const schedules = await Schedule.find({ teacher: teacherId })
      .sort({ name: 1 });
    
    // Lọc dữ liệu
    const month = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const selectedScheduleId = req.query.scheduleId || (schedules.length > 0 ? schedules[0]._id : null);
    
    let tuitions = [];
    let tuitionStats = {
      total: 0,
      paid: 0,
      pending: 0,
      overdue: 0,
      totalCount: 0,
      paidCount: 0,
      pendingCount: 0,
      overdueCount: 0
    };
    
    let selectedSchedule = null;
    
    if (selectedScheduleId) {
      // Lấy thông tin lớp học đã chọn với đầy đủ thông tin
      selectedSchedule = await Schedule.findById(selectedScheduleId);
      
      // Lấy học sinh trong lớp
      const enrollments = await Enrollment.find({
        class: selectedScheduleId,
        status: 'active'
      }).populate('student');
      
      // Thêm danh sách học sinh vào thông tin lớp học
      selectedSchedule.enrollments = enrollments;
      
      // Tìm các khoản học phí của lớp trong tháng/năm đã chọn
      console.log(`[showTuition] Đang tìm học phí với: scheduleId=${selectedScheduleId}, tháng=${month}, năm=${year}`);
      
      // Tạo khoảng thời gian cho tháng/năm đã chọn
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      // Sử dụng dueDate để tìm học phí vì đã chứng minh là cách hiệu quả nhất
      tuitions = await Tuition.find({
        schedule: selectedScheduleId, 
        dueDate: { $gte: startDate, $lte: endDate }
      }).populate('student');
      
      console.log(`[showTuition] Tìm thấy ${tuitions.length} học phí với dueDate từ ${startDate.toLocaleDateString()} đến ${endDate.toLocaleDateString()}`);
      
      // Tính toán thống kê
      tuitionStats.totalCount = enrollments.length;
      tuitionStats.paidCount = 0;
      tuitionStats.pendingCount = 0;
      tuitionStats.overdueCount = 0;
      
      const today = new Date();
      
      tuitions.forEach(tuition => {
        tuitionStats.total += tuition.amount;
        
        if (tuition.status === 'paid') {
          tuitionStats.paid += tuition.amount;
          tuitionStats.paidCount++;
        } else {
          // Kiểm tra ngày đến hạn
          const dueDate = new Date(tuition.dueDate);
          
          if (today > dueDate) {
            // Quá hạn
            tuitionStats.overdue += tuition.amount;
            tuitionStats.overdueCount++;
            
            // Cập nhật trạng thái hiển thị nếu chưa cập nhật trong DB
            if (tuition.status !== 'overdue') {
              tuition._displayStatus = 'overdue';
            }
          } else {
            // Chưa đến hạn
            tuitionStats.pending += tuition.amount;
            tuitionStats.pendingCount++;
          }
        }
      });
      
      // Log thống kê để debug
      console.log('[showTuition] Thống kê học phí:', {
        total: tuitionStats.total,
        paid: tuitionStats.paid,
        pending: tuitionStats.pending,
        overdue: tuitionStats.overdue,
        totalCount: tuitionStats.totalCount,
        paidCount: tuitionStats.paidCount,
        pendingCount: tuitionStats.pendingCount,
        overdueCount: tuitionStats.overdueCount
      });
    }
    
    res.render('teacher/tuition', {
      title: 'Quản Lý Học Phí',
      teacherName: req.session.user.name,
      schedules,
      selectedScheduleId,
      selectedSchedule,
      tuitions,
      tuitionStats,
      selectedMonth: month,
      selectedYear: year,
      moment
    });
  } catch (error) {
    logger.error(`Lỗi hiển thị trang học phí: ${error.message}`);
    res.status(500).render('errors/500', {
      title: 'Lỗi Server',
      message: 'Đã xảy ra lỗi khi tải trang quản lý học phí.',
      isAuthenticated: req.session && req.session.isLoggedIn || false
    });
  }
};

// Ghi nhận thanh toán học phí
exports.recordTuitionPayment = async (req, res) => {
  try {
    const { tuitionId, paymentDate, paymentMethod, notes } = req.body;
    
    // Tìm bản ghi học phí
    const tuition = await Tuition.findById(tuitionId);
    if (!tuition) {
      req.flash('error', 'Không tìm thấy bản ghi học phí');
      return res.redirect('/teacher/tuition');
    }
    
    // Kiểm tra giáo viên có quyền với lớp học này không
    const schedule = await Schedule.findById(tuition.schedule);
    if (!schedule || schedule.teacher.toString() !== req.session.user._id.toString()) {
      req.flash('error', 'Bạn không có quyền ghi nhận thanh toán cho khoản học phí này');
      return res.redirect('/teacher/tuition');
    }
    
    // Cập nhật thông tin thanh toán
    tuition.status = 'paid';
    tuition.paymentDate = new Date(paymentDate);
    tuition.paymentMethod = paymentMethod;
    if (notes) tuition.notes = notes;
    tuition.updatedAt = new Date();
    
    await tuition.save();
    
    req.flash('success', 'Đã ghi nhận thanh toán học phí thành công');
    res.redirect('/teacher/tuition');
  } catch (error) {
    logger.error(`Lỗi ghi nhận thanh toán học phí: ${error.message}`);
    req.flash('error', 'Đã xảy ra lỗi khi ghi nhận thanh toán học phí');
    res.redirect('/teacher/tuition');
  }
};

// Hiển thị danh sách học sinh của giáo viên
exports.showMyStudents = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    
    // Tìm tất cả các lớp mà giáo viên này dạy
    const schedules = await Schedule.find({ teacher: teacherId });
    const scheduleIds = schedules.map(s => s._id);
    
    // Lấy tất cả các enrollment đang active của các lớp này
    const enrollments = await Enrollment.find({
      class: { $in: scheduleIds },
      status: 'active'
    }).populate({
      path: 'student',
      select: 'name contactNumber parentName address notes parent status endDate',
      populate: {
        path: 'parent',
        select: 'name phone email'
      }
    });
    
    // Tạo danh sách học sinh duy nhất từ tất cả các lớp
    let uniqueStudents = new Map();
    
    enrollments.forEach(enrollment => {
      const student = enrollment.student;
      if (!student) return;
      
      const studentId = student._id.toString();
      const schedule = schedules.find(s => s._id.toString() === enrollment.class.toString());
      
      if (!schedule) return;
      
      // Nếu học sinh chưa có trong map, thêm vào với danh sách lớp rỗng
      if (!uniqueStudents.has(studentId)) {
        const studentObj = student.toObject();
        studentObj.classes = [];
        
        // Đảm bảo trường status có giá trị
        if (!studentObj.status) {
          studentObj.status = 'active'; // Giá trị mặc định là 'active' nếu không có
        }
        
        uniqueStudents.set(studentId, studentObj);
      }
      
      // Thêm thông tin lớp học vào danh sách lớp của học sinh
      uniqueStudents.get(studentId).classes.push({
        name: schedule.name,
        schedule: schedule.scheduleDisplay || `${schedule.dayOfWeek} ${schedule.startTime}-${schedule.endTime}`,
        classId: schedule._id
      });
    });
    
    // Chuyển map thành mảng để render
    const allStudents = Array.from(uniqueStudents.values());
    
    // Thiết lập trạng thái học sinh một cách rõ ràng
    allStudents.forEach(student => {
      // Nếu không có trạng thái hoặc không phải là giá trị hợp lệ
      if (!student.status || !['active', 'inactive'].includes(student.status)) {
        student.status = 'active'; // Mặc định là active
      }
    });
    
    // Kiểm tra trạng thái học sinh
    console.log('Danh sách học sinh:');
    allStudents.forEach((student, index) => {
      console.log(`Học sinh ${index + 1}: ${student.name}, Trạng thái: ${student.status}`);
    });
    
    // Lấy danh sách lớp để hiển thị bộ lọc
    const classOptions = schedules.map(schedule => ({
      id: schedule._id,
      name: schedule.name
    }));
    
    res.render('teacher/students', {
      title: 'Danh sách học sinh',
      students: allStudents,
      classes: classOptions,
      moment: moment
    });
  } catch (err) {
    console.error('Lỗi khi hiển thị danh sách học sinh:', err);
    res.render('errors/500', {
      message: 'Không thể tải danh sách học sinh. Vui lòng thử lại sau.',
      isAuthenticated: req.session && req.session.isLoggedIn || false
    });
  }
};

// Hiển thị chi tiết học sinh
exports.showStudentDetail = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const studentId = req.params.id;

    // Tìm học sinh
    const student = await Student.findById(studentId);
    if (!student) {
      return res.render('errors/404', {
        message: 'Không tìm thấy học sinh'
      });
    }

    // Kiểm tra xem học sinh có thuộc lớp nào của giáo viên này không
    const teacherSchedules = await Schedule.find({ 
      teacher: teacherId,
      students: studentId 
    });

    if (teacherSchedules.length === 0) {
      return res.render('errors/403', {
        message: 'Bạn không có quyền xem thông tin của học sinh này'
      });
    }

    // Lấy thông tin điểm danh của học sinh
    const attendanceRecords = await Attendance.find({
      schedule: { $in: teacherSchedules.map(s => s._id) },
      'students.student': studentId
    }).populate('schedule', 'name').sort({ date: -1 }).limit(10);

    // Chuẩn bị dữ liệu điểm danh để hiển thị
    const attendanceHistory = attendanceRecords.map(record => {
      const studentAttendance = record.students.find(s => 
        s.student.toString() === studentId.toString()
      );
      
      return {
        date: record.date,
        schedule: record.schedule,
        status: studentAttendance ? studentAttendance.status : 'unknown',
        note: studentAttendance ? studentAttendance.note : ''
      };
    });

    // Lấy thông tin phụ huynh
    const parent = await Parent.findOne({ 
      children: studentId 
    });

    res.render('teacher/student-detail', {
      title: `Chi tiết học sinh: ${student.name}`,
      student: student,
      classes: teacherSchedules,
      attendanceHistory: attendanceHistory,
      parent: parent
    });
  } catch (err) {
    console.error('Lỗi khi hiển thị chi tiết học sinh:', err);
    res.render('errors/500', {
      message: 'Không thể tải thông tin học sinh. Vui lòng thử lại sau.',
      isAuthenticated: req.session && req.session.isLoggedIn || false
    });
  }
};

// Hiển thị danh sách phụ huynh
exports.showMyParents = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    
    // Tìm các lớp của giáo viên (sử dụng Schedule thay vì Class)
    const teacherSchedules = await Schedule.find({ teacher: teacherId })
      .populate({
        path: 'students',
        select: 'name'
      });
    
    // Tạo mảng chứa tất cả học sinh từ các lớp của giáo viên
    let allStudentIds = [];
    teacherSchedules.forEach(schedule => {
      if (schedule.students && schedule.students.length > 0) {
        schedule.students.forEach(student => {
          if (!allStudentIds.includes(student._id.toString())) {
            allStudentIds.push(student._id.toString());
          }
        });
      }
    });
    
    // Tìm tất cả phụ huynh của những học sinh này
    const parents = await Parent.find({
      children: { $in: allStudentIds }
    }).populate({
      path: 'children',
      select: 'name class'
    });
    
    // Lấy danh sách lớp học để hiển thị lọc
    const classOptions = teacherSchedules.map(schedule => ({
      id: schedule._id,
      name: schedule.name
    }));
    
    res.render('teacher/parents', {
      title: 'Danh Sách Phụ Huynh',
      parents: parents,
      classOptions: classOptions
    });
  } catch (err) {
    console.error('Lỗi khi hiển thị danh sách phụ huynh:', err);
    res.render('errors/500', {
      message: 'Không thể tải danh sách phụ huynh. Vui lòng thử lại sau.',
      isAuthenticated: req.session && req.session.isLoggedIn || false
    });
  }
};

// Hiển thị chi tiết phụ huynh
exports.showParentDetail = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const parentId = req.params.id;
    
    // Tìm thông tin phụ huynh
    const parent = await Parent.findById(parentId).populate({
      path: 'children',
      select: 'name dateOfBirth gender address phone class'
    });
    
    if (!parent) {
      return res.status(404).render('errors/404', {
        message: 'Không tìm thấy thông tin phụ huynh'
      });
    }
    
    // Tìm các lớp của giáo viên (sử dụng Schedule thay vì Class)
    const teacherSchedules = await Schedule.find({ teacher: teacherId });
    const scheduleIds = teacherSchedules.map(schedule => schedule._id);
    
    // Kiểm tra xem có bất kỳ học sinh nào của phụ huynh này học trong lớp của giáo viên không
    let hasStudentInClass = false;
    for (const child of parent.children) {
      const isInTeacherClass = await Student.exists({
        _id: child._id,
        class: { $in: scheduleIds }
      });
      
      if (isInTeacherClass) {
        hasStudentInClass = true;
        break;
      }
    }
    
    if (!hasStudentInClass) {
      return res.status(403).render('errors/403', {
        message: 'Bạn không có quyền xem thông tin của phụ huynh này'
      });
    }
    
    // Lấy thông tin học sinh của phụ huynh trong các lớp của giáo viên
    const students = await Student.find({ 
        parent: parentId
    });
    
    // Thêm thông tin lớp học cho mỗi học sinh
    for (const student of students) {
        // Tìm các lớp học của học sinh mà giáo viên này dạy
        const studentSchedules = await Schedule.find({
            teacher: teacherId,
            students: student._id
        });
        
        student.classes = studentSchedules;
        student.className = studentSchedules.length > 0 ? 
            studentSchedules.map(s => s.name).join(', ') : 'Chưa có lớp';
    }
    
    // Lấy lịch sử liên lạc
    const contactHistory = await ContactLog.find({ 
        parent: parentId
    }).sort({ date: -1 }).populate('teacher');
    
    // Đổ dữ liệu vào parent để render
    const parentData = parent.toObject();
    parentData.children = students || [];
    parentData.contactHistory = contactHistory;
    
    res.render('teacher/parent-detail', {
      title: `Thông tin phụ huynh - ${parent.name}`,
      parent: parentData,
      currentPage: 'parents'
    });
  } catch (err) {
    console.error('Lỗi khi hiển thị chi tiết phụ huynh:', err);
    res.render('errors/500', {
      message: 'Không thể tải thông tin phụ huynh. Vui lòng thử lại sau.',
      isAuthenticated: req.session && req.session.isLoggedIn || false
    });
  }
};

// Cập nhật ghi chú cho học sinh
exports.updateStudentNote = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const studentId = req.params.id;
    const { note } = req.body;
    
    // Lấy thông tin học sinh
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy học sinh'
      });
    }
    
    // Kiểm tra xem học sinh có thuộc lớp của giáo viên không
    const schedules = await Schedule.find({ teacher: teacherId });
    const scheduleIds = schedules.map(schedule => schedule._id);
    
    const enrollment = await Enrollment.findOne({
      class: { $in: scheduleIds },
      student: studentId,
      status: 'active'
    });
    
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'Học sinh này không thuộc lớp dạy của bạn'
      });
    }
    
    // Cập nhật ghi chú của học sinh
    student.note = note;
    await student.save();
    
    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật ghi chú thành công'
    });
  } catch (error) {
    logger.error(`Lỗi cập nhật ghi chú học sinh: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi cập nhật ghi chú học sinh'
    });
  }
};

/**
 * Get list of parents for the teacher's classes
 */
exports.getParentsList = async (req, res) => {
    try {
        const teacherId = req.session.user._id;
        const teacher = await Teacher.findById(teacherId);
        
        if (!teacher) {
            req.flash('error', 'Không tìm thấy thông tin giáo viên');
            return res.redirect('/teacher/dashboard');
        }

        // Lấy danh sách lớp học của giáo viên
        const schedules = await Schedule.find({ teacher: teacherId });
        const scheduleIds = schedules.map(s => s._id);
        
        // Lấy học sinh trong các lớp của giáo viên
        const students = await Student.find({ class: { $in: scheduleIds } })
            .populate('parent');
        
        // Tạo danh sách phụ huynh không trùng lặp
        const parentsMap = new Map();
        students.forEach(student => {
            if (student.parent && !parentsMap.has(student.parent._id.toString())) {
                // Đếm số học sinh của phụ huynh này
                const studentCount = students.filter(s => 
                    s.parent && s.parent._id.toString() === student.parent._id.toString()
                ).length;
                
                const parentData = {
                    ...student.parent.toObject(),
                    studentCount
                };
                
                parentsMap.set(student.parent._id.toString(), parentData);
            }
        });
        
        const parents = Array.from(parentsMap.values());
        
        res.render('teacher/parents', {
            title: 'Danh Sách Phụ Huynh',
            parents,
            currentPage: 'parents'
        });
    } catch (error) {
        logger.error(`Error in getParentsList: ${error.message}`);
        req.flash('error', 'Có lỗi xảy ra khi lấy danh sách phụ huynh');
        res.redirect('/teacher/dashboard');
    }
};

/**
 * Get parent details
 */
exports.getParentDetails = async (req, res) => {
    try {
        const teacherId = req.session.user._id;
        const parentId = req.params.id;
        
        // Kiểm tra thông tin giáo viên
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            req.flash('error', 'Không tìm thấy thông tin giáo viên');
            return res.redirect('/teacher/parents');
        }
        
        // Lấy danh sách lớp học của giáo viên
        const schedules = await Schedule.find({ teacher: teacherId });
        const scheduleIds = schedules.map(s => s._id);
        
        // Lấy thông tin phụ huynh
        const parent = await Parent.findById(parentId);
        if (!parent) {
            req.flash('error', 'Không tìm thấy thông tin phụ huynh');
            return res.redirect('/teacher/parents');
        }
        
        // Lấy danh sách học sinh của phụ huynh này mà thuộc lớp của giáo viên
        const students = await Student.find({ 
            parent: parentId,
            class: { $in: scheduleIds }
        }).populate('class');
        
        // Lấy lịch sử liên lạc
        const contactHistory = await ContactLog.find({ 
            parent: parentId
        }).sort({ date: -1 }).populate('teacher');
        
        // Đổ dữ liệu vào parent để render
        const parentData = parent.toObject();
        parentData.students = students;
        parentData.contactHistory = contactHistory;
        
        res.render('teacher/parent-detail', {
            title: `Thông tin phụ huynh - ${parent.name}`,
            parent: parentData,
            currentPage: 'parents'
        });
    } catch (error) {
        logger.error(`Error in getParentDetails: ${error.message}`);
        req.flash('error', 'Có lỗi xảy ra khi lấy thông tin chi tiết phụ huynh');
        res.redirect('/teacher/parents');
    }
};

/**
 * Add contact log for a parent
 */
exports.addParentContact = async (req, res) => {
    try {
        const teacherId = req.session.user._id;
        const parentId = req.params.id;
        const { date, method, content } = req.body;
        
        // Kiểm tra thông tin giáo viên
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            req.flash('error', 'Không tìm thấy thông tin giáo viên');
            return res.redirect('/teacher/parents');
        }
        
        // Kiểm tra thông tin phụ huynh
        const parent = await Parent.findById(parentId);
        if (!parent) {
            req.flash('error', 'Không tìm thấy thông tin phụ huynh');
            return res.redirect('/teacher/parents');
        }
        
        // Tạo log liên lạc mới
        const newContact = new ContactLog({
            parent: parentId,
            teacher: teacherId,
            date: date || new Date(),
            method,
            content
        });
        
        await newContact.save();
        
        req.flash('success', 'Đã thêm ghi chú liên lạc thành công');
        res.redirect(`/teacher/parents/${parentId}`);
    } catch (error) {
        logger.error(`Error in addParentContact: ${error.message}`);
        req.flash('error', 'Có lỗi xảy ra khi thêm ghi chú liên lạc');
        res.redirect(`/teacher/parents/${req.params.id}`);
    }
};

// Lấy danh sách điểm danh theo lớp cho giáo viên
exports.getAttendanceByClass = async (req, res) => {
  try {
    // Lấy ID giáo viên từ session
    const teacherId = req.session.user._id;

    // Lấy danh sách lớp mà giáo viên này dạy
    const schedules = await Schedule.find({ teacher: teacherId })
      .sort({ name: 1 });

    if (!schedules || schedules.length === 0) {
      req.flash('info', 'Bạn chưa được phân công lớp nào');
      return res.render('teacher/attendance-by-class', {
        title: 'Điểm Danh Theo Lớp',
        teacher: req.session.user,
        currentDate: new Date(),
        schedules: [],
        selectedClassId: null,
        selectedClass: null,
        attendanceRecords: [],
        startDate: moment().subtract(7, 'days').format('YYYY-MM-DD'),
        endDate: moment().format('YYYY-MM-DD'),
        moment
      });
    }

    // Lấy thông số lọc từ query params
    const selectedClassId = req.query.classId || schedules[0]._id.toString();
    const startDate = req.query.startDate 
      ? moment(req.query.startDate) 
      : moment().subtract(7, 'days');
    const endDate = req.query.endDate 
      ? moment(req.query.endDate) 
      : moment();

    // Xác minh lớp học này thuộc giáo viên hiện tại
    const classExists = schedules.some(s => s._id.toString() === selectedClassId);
    if (!classExists) {
      req.flash('error', 'Bạn không có quyền xem lớp này');
      return res.redirect('/teacher/dashboard');
    }

    // Tìm lịch học cụ thể
    const selectedClass = await Schedule.findById(selectedClassId);

    // Lấy tất cả bản ghi điểm danh cho lớp này trong khoảng thời gian
    const attendanceRecords = await Attendance.find({
      schedule: selectedClassId,
      date: {
        $gte: startDate.startOf('day').toDate(),
        $lte: endDate.endOf('day').toDate()
      }
    })
    .populate({
      path: 'students.student',
      model: 'Student',
      select: 'name'
    })
    .populate('schedule', 'name')
    .sort({ date: -1 });

    res.render('teacher/attendance-by-class', {
      title: 'Điểm Danh Theo Lớp',
      teacher: req.session.user,
      currentDate: new Date(),
      schedules,
      selectedClassId,
      selectedClass,
      attendanceRecords,
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      moment
    });
  } catch (err) {
    console.error('Lỗi khi lấy thông tin điểm danh theo lớp:', err);
    req.flash('error', 'Không thể tải thông tin điểm danh: ' + err.message);
    res.redirect('/teacher/dashboard');
  }
};

// Lấy chi tiết điểm danh theo lớp/ngày cụ thể cho giáo viên
exports.getAttendanceByClassDetail = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const scheduleId = req.params.id;
    const selectedDate = req.query.date ? new Date(req.query.date) : new Date();

    // Kiểm tra xem giáo viên có quyền với lớp này không
    const schedule = await Schedule.findOne({
      _id: scheduleId,
      teacher: teacherId
    }).populate('teacher', 'name').populate('students');

    if (!schedule) {
      req.flash('error', 'Bạn không có quyền xem lớp này hoặc lớp không tồn tại');
      return res.redirect('/teacher/attendance/class');
    }

    // Tìm tất cả bản ghi điểm danh cho lớp này vào ngày đã chọn
    const attendanceRecord = await Attendance.findOne({
      schedule: scheduleId,
      date: {
        $gte: moment(selectedDate).startOf('day').toDate(),
        $lte: moment(selectedDate).endOf('day').toDate()
      }
    }).populate({
      path: 'students.student',
      model: 'Student',
      select: 'name'
    });

    // Tạo map để dễ truy cập
    const attendanceMap = {};
    if (attendanceRecord && attendanceRecord.students) {
      attendanceRecord.students.forEach(student => {
        attendanceMap[student.student._id.toString()] = student;
      });
    }

    res.render('teacher/attendance-class-detail', {
      title: 'Chi Tiết Điểm Danh Lớp',
      teacher: req.session.user,
      schedule,
      selectedDate,
      attendanceMap,
      attendanceRecord,
      moment
    });
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết điểm danh lớp:', err);
    req.flash('error', 'Không thể tải thông tin điểm danh: ' + err.message);
    res.redirect('/teacher/attendance/class');
  }
};

// Cập nhật điểm danh cho giáo viên
exports.updateAttendance = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const { scheduleId, studentId, status, note, date } = req.body;

    // Xác minh giáo viên có quyền với lớp này không
    const schedule = await Schedule.findOne({
      _id: scheduleId,
      teacher: teacherId
    });

    if (!schedule) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật điểm danh cho lớp này'
      });
    }

    // Kiểm tra đầu vào
    if (!scheduleId || !studentId || !status || !date) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin cần thiết'
      });
    }

    // Chuyển đổi ngày thành đầu ngày để tránh vấn đề múi giờ
    const attendanceDate = moment(date).startOf('day').toDate();

    // Tìm bản ghi điểm danh hiện có nếu có
    let attendance = await Attendance.findOne({
      schedule: scheduleId,
      date: {
        $gte: moment(attendanceDate).startOf('day').toDate(),
        $lte: moment(attendanceDate).endOf('day').toDate()
      }
    });

    if (attendance) {
      // Kiểm tra xem học sinh đã có trong danh sách điểm danh chưa
      const studentIndex = attendance.students.findIndex(
        s => s.student._id && s.student._id.toString() === studentId || s.student.toString() === studentId
      );

      if (studentIndex >= 0) {
        // Cập nhật thông tin điểm danh của học sinh
        attendance.students[studentIndex].status = status;
        attendance.students[studentIndex].note = note || '';
      } else {
        // Thêm học sinh vào danh sách điểm danh
        attendance.students.push({
          student: studentId,
          status: status,
          note: note || ''
        });
      }

      attendance.updatedAt = new Date();
      await attendance.save();
    } else {
      // Tạo bản ghi điểm danh mới
      attendance = new Attendance({
        schedule: scheduleId,
        date: attendanceDate,
        students: [{
          student: studentId,
          status: status,
          note: note || ''
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await attendance.save();
    }

    res.json({
      success: true,
      message: 'Cập nhật điểm danh thành công',
      data: attendance
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật điểm danh:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật điểm danh: ' + err.message
    });
  }
};

// Xóa điểm danh cho giáo viên
exports.deleteAttendance = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const attendanceId = req.params.id;
    const studentId = req.query.studentId;

    // Tìm bản ghi điểm danh
    const attendance = await Attendance.findById(attendanceId).populate('schedule');
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bản ghi điểm danh'
      });
    }

    // Kiểm tra xem giáo viên có quyền xóa không
    const schedule = await Schedule.findOne({
      _id: attendance.schedule._id,
      teacher: teacherId
    });

    if (!schedule) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa điểm danh này'
      });
    }

    if (studentId) {
      // Xóa chỉ một học sinh khỏi bản ghi điểm danh
      const studentIndex = attendance.students.findIndex(s => 
        s.student.toString() === studentId
      );

      if (studentIndex >= 0) {
        attendance.students.splice(studentIndex, 1);
        
        // Nếu không còn học sinh nào, xóa toàn bộ bản ghi
        if (attendance.students.length === 0) {
          await Attendance.findByIdAndDelete(attendanceId);
          return res.json({
            success: true,
            message: 'Đã xóa bản ghi điểm danh thành công'
          });
        } else {
          // Lưu lại bản ghi sau khi xóa học sinh
          await attendance.save();
          return res.json({
            success: true,
            message: 'Đã xóa điểm danh của học sinh thành công'
          });
        }
      } else {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy học sinh trong bản ghi điểm danh'
        });
      }
    } else {
      // Xóa toàn bộ bản ghi điểm danh
      await Attendance.findByIdAndDelete(attendanceId);
      return res.json({
        success: true,
        message: 'Đã xóa bản ghi điểm danh thành công'
      });
    }
  } catch (err) {
    console.error('Lỗi khi xóa điểm danh:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa điểm danh: ' + err.message
    });
  }
};

// Lấy danh sách điểm danh theo học sinh cho giáo viên
exports.getAttendanceByStudent = async (req, res) => {
  try {
    const teacherId = req.session.user._id;

    // Lấy danh sách lớp mà giáo viên này dạy
    const schedules = await Schedule.find({ teacher: teacherId })
      .sort({ name: 1 });

    if (!schedules || schedules.length === 0) {
      req.flash('info', 'Bạn chưa được phân công lớp nào');
      return res.render('teacher/attendance-by-student', {
        title: 'Điểm Danh Theo Học Sinh',
        teacher: req.session.user,
        currentDate: new Date(),
        schedules: [],
        students: [],
        selectedClassId: null,
        selectedStudentId: null,
        selectedStudent: null,
        attendanceRecords: [],
        stats: { present: 0, absent: 0, late: 0 },
        startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
        endDate: moment().format('YYYY-MM-DD'),
        moment
      });
    }

    // Lấy ID lớp từ query, hoặc lấy lớp đầu tiên nếu không có
    const selectedClassId = req.query.classId || schedules[0]._id.toString();

    // Lấy danh sách học sinh trong lớp đã chọn
    const selectedSchedule = await Schedule.findById(selectedClassId)
      .populate('students', 'name');

    if (!selectedSchedule || !selectedSchedule.students) {
      req.flash('error', 'Không tìm thấy thông tin lớp hoặc học sinh');
      return res.redirect('/teacher/dashboard');
    }

    const students = selectedSchedule.students;

    // Lấy học sinh được chọn từ query params
    const selectedStudentId = req.query.studentId || (students.length > 0 ? students[0]._id.toString() : null);
    
    let selectedStudent = null;
    let attendanceRecords = [];
    const stats = { present: 0, absent: 0, late: 0 };

    // Xác định khoảng thời gian
    const startDate = req.query.startDate 
      ? moment(req.query.startDate) 
      : moment().subtract(30, 'days');
    const endDate = req.query.endDate 
      ? moment(req.query.endDate) 
      : moment();

    if (selectedStudentId) {
      // Tìm thông tin chi tiết của học sinh
      selectedStudent = await Student.findById(selectedStudentId);

      // Lấy bản ghi điểm danh của học sinh trong khoảng thời gian
      const attendanceDocs = await Attendance.find({
        'students.student': selectedStudentId,
        date: {
          $gte: startDate.startOf('day').toDate(),
          $lte: endDate.endOf('day').toDate()
        }
      })
      .populate('schedule', 'name')
      .sort({ date: -1 });

      // Trích xuất thông tin điểm danh của học sinh
      attendanceRecords = attendanceDocs.map(record => {
        const studentAttendance = record.students.find(s => 
          s.student.toString() === selectedStudentId.toString()
        );
        
        return {
          date: record.date,
          schedule: record.schedule,
          status: studentAttendance ? studentAttendance.status : 'unknown',
          note: studentAttendance ? studentAttendance.note : ''
        };
      });

      // Tính toán thống kê
      attendanceRecords.forEach(record => {
        if (record.status === 'present') stats.present++;
        else if (record.status === 'absent') stats.absent++;
        else if (record.status === 'late') stats.late++;
      });
    }
    
    res.render('teacher/attendance-by-student', {
      title: 'Điểm Danh Theo Học Sinh',
      teacher: req.session.user,
      currentDate: new Date(),
      schedules,
      students,
      selectedClassId,
      selectedStudentId,
      selectedStudent,
      attendanceRecords,
      stats,
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      moment
    });
  } catch (err) {
    console.error('Lỗi khi lấy thông tin điểm danh theo học sinh:', err);
    req.flash('error', 'Không thể tải thông tin điểm danh: ' + err.message);
    res.redirect('/teacher/dashboard');
  }
};

// Xem chi tiết điểm danh của một học sinh cho giáo viên
exports.getAttendanceByStudentDetail = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const studentId = req.params.id;
    const month = req.query.month ? parseInt(req.query.month) : moment().month();
    const year = req.query.year ? parseInt(req.query.year) : moment().year();
    
    // Lấy tên tháng từ moment
    const currentMonthName = moment().month(month).format('MMMM');
    
    // Kiểm tra xem học sinh này có thuộc lớp của giáo viên không
    const studentInTeacherClass = await Schedule.exists({
      teacher: teacherId,
      students: studentId
    });

    if (!studentInTeacherClass) {
      req.flash('error', 'Bạn không có quyền xem thông tin điểm danh của học sinh này');
      return res.redirect('/teacher/attendance/student');
    }
    
    // Lấy thông tin học sinh
    const student = await Student.findById(studentId)
      .populate({
        path: 'schedules',
        select: 'name dayOfWeek startTime endTime'
      });
    
    if (!student) {
      req.flash('error', 'Không tìm thấy học sinh');
      return res.redirect('/teacher/attendance/student');
    }
    
    // Tính khoảng thời gian (tháng được chọn)
    const startDate = moment().year(year).month(month).startOf('month');
    const endDate = moment().year(year).month(month).endOf('month');
    
    // Lấy lịch sử điểm danh của học sinh trong tháng
    const attendanceDocs = await Attendance.find({
      'students.student': studentId,
      date: {
        $gte: startDate.toDate(),
        $lte: endDate.toDate()
      }
    })
    .populate('schedule', 'name dayOfWeek')
    .sort({ date: 1 });
    
    // Trích xuất thông tin điểm danh của học sinh
    const attendanceRecords = attendanceDocs.map(record => {
      const studentAttendance = record.students.find(s => 
        s.student.toString() === studentId.toString()
      );
      
      return {
        date: record.date,
        schedule: record.schedule,
        status: studentAttendance ? studentAttendance.status : 'unknown',
        note: studentAttendance ? studentAttendance.note : ''
      };
    });
    
    // Chuẩn bị dữ liệu thống kê
    const totalDays = endDate.date();
    const attendanceStats = {
      present: 0,
      absent: 0,
      late: 0,
      total: attendanceRecords.length
    };
    
    // Tạo map theo ngày để hiển thị trên lịch
    const attendanceByDay = {};
    
    attendanceRecords.forEach(record => {
      const day = moment(record.date).date();
      
      // Cập nhật thống kê
      if (record.status === 'present') attendanceStats.present++;
      else if (record.status === 'absent') attendanceStats.absent++;
      else if (record.status === 'late') attendanceStats.late++;
      
      // Lưu vào map theo ngày
      if (!attendanceByDay[day]) {
        attendanceByDay[day] = [];
      }
      attendanceByDay[day].push(record);
    });
    
    // Tạo dữ liệu lịch
    const calendarDays = [];
    const today = moment();
    
    // Lấy ngày đầu tiên của tháng và danh sách tất cả các ngày
    const firstDay = moment([year, month, 1]);
    const daysInMonth = firstDay.daysInMonth();
    
    // Thêm các ngày từ tháng trước để điền vào tuần đầu tiên
    const dayOfWeekOfFirstDay = firstDay.day(); // 0 = Chủ nhật, 6 = Thứ bảy
    for (let i = 0; i < dayOfWeekOfFirstDay; i++) {
      const prevMonthDay = moment(firstDay).subtract(dayOfWeekOfFirstDay - i, 'days');
      calendarDays.push({
        date: prevMonthDay.toDate(),
        currentMonth: false,
        isToday: prevMonthDay.isSame(today, 'day'),
        attendance: null
      });
    }
    
    // Thêm các ngày trong tháng
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = moment([year, month, i]);
      const dateStr = currentDate.format('YYYY-MM-DD');
      
      // Tìm bản ghi điểm danh cho ngày này
      const dayAttendance = attendanceRecords.find(record => 
        moment(record.date).format('YYYY-MM-DD') === dateStr
      );
      
      calendarDays.push({
        date: currentDate.toDate(),
        currentMonth: true,
        isToday: currentDate.isSame(today, 'day'),
        attendance: dayAttendance || null
      });
    }
    
    // Thêm các ngày từ tháng sau để điền đủ lịch
    const lastDayOfMonth = moment([year, month, daysInMonth]);
    const dayOfWeekOfLastDay = lastDayOfMonth.day();
    const daysToAdd = 6 - dayOfWeekOfLastDay;
    
    for (let i = 1; i <= daysToAdd; i++) {
      const nextMonthDay = moment(lastDayOfMonth).add(i, 'days');
      calendarDays.push({
        date: nextMonthDay.toDate(),
        currentMonth: false,
        isToday: nextMonthDay.isSame(today, 'day'),
        attendance: null
      });
    }
    
    res.render('teacher/attendance-student-detail', {
      title: 'Chi Tiết Điểm Danh Học Sinh',
      teacher: req.session.user,
      student,
      month,
      year,
      calendarDays,
      attendanceStats,
      attendanceRecords,
      filteredAttendance: attendanceRecords,
      stats: attendanceStats,
      moment,
      currentMonthName,
      currentYear: year,
      currentMonth: month
    });
  } catch (err) {
    console.error('Lỗi khi xem chi tiết điểm danh học sinh:', err);
    req.flash('error', 'Không thể tải thông tin điểm danh: ' + err.message);
    res.redirect('/teacher/attendance/student');
  }
};

// Hiển thị trang tạo nhóm điểm danh
exports.showCreateAttendanceGroup = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    
    // Lấy danh sách lớp mà giáo viên này dạy
    const schedules = await Schedule.find({ teacher: teacherId })
      .sort({ name: 1 });
      
    if (!schedules || schedules.length === 0) {
      req.flash('info', 'Bạn chưa được phân công lớp nào');
      return res.render('teacher/create-attendance-group', {
        title: 'Tạo Nhóm Điểm Danh',
        teacher: req.session.user,
        schedules: [],
        moment
      });
    }
    
    res.render('teacher/create-attendance-group', {
      title: 'Tạo Nhóm Điểm Danh',
      teacher: req.session.user,
      schedules,
      moment
    });
  } catch (err) {
    console.error('Lỗi khi hiển thị trang tạo nhóm điểm danh:', err);
    req.flash('error', 'Không thể tải trang tạo nhóm điểm danh: ' + err.message);
    res.redirect('/teacher/dashboard');
  }
};

// API lấy học sinh theo lớp
exports.getStudentsByClass = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const scheduleId = req.params.id;
    
    // Xác minh giáo viên có quyền với lớp này không
    const schedule = await Schedule.findOne({
      _id: scheduleId,
      teacher: teacherId
    }).populate({
      path: 'enrollments',
      populate: {
        path: 'student',
        model: 'Student',
        select: 'name studentId gender contactInfo'
      }
    });
    
    if (!schedule) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem danh sách học sinh lớp này'
      });
    }
    
    const students = schedule.enrollments.map(enrollment => ({
      _id: enrollment.student._id,
      name: enrollment.student.name,
      studentId: enrollment.student.studentId,
      gender: enrollment.student.gender,
      contactInfo: enrollment.student.contactInfo,
      enrollmentId: enrollment._id
    }));
    
    res.json({
      success: true,
      data: students
    });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách học sinh theo lớp:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách học sinh: ' + err.message
    });
  }
};

// Lưu nhóm điểm danh
exports.createAttendanceGroup = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const { name, description, scheduleIds, studentIds } = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!name || !scheduleIds || !studentIds || !Array.isArray(scheduleIds) || !Array.isArray(studentIds)) {
      req.flash('error', 'Thiếu thông tin cần thiết để tạo nhóm điểm danh');
      return res.redirect('/teacher/attendance/create-group');
    }
    
    // Xác minh giáo viên có quyền với các lớp đã chọn
    const validSchedules = await Schedule.find({
      _id: { $in: scheduleIds },
      teacher: teacherId
    });
    
    if (validSchedules.length !== scheduleIds.length) {
      req.flash('error', 'Bạn không có quyền với một hoặc nhiều lớp đã chọn');
      return res.redirect('/teacher/attendance/create-group');
    }
    
    // Tạo nhóm điểm danh mới
    const newGroup = new AttendanceGroup({
      name,
      description: description || '',
      teacher: teacherId,
      schedules: scheduleIds,
      students: studentIds,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await newGroup.save();
    
    req.flash('success', 'Đã tạo nhóm điểm danh thành công');
    res.redirect('/teacher/attendance/groups');
  } catch (err) {
    console.error('Lỗi khi tạo nhóm điểm danh:', err);
    req.flash('error', 'Không thể tạo nhóm điểm danh: ' + err.message);
    res.redirect('/teacher/attendance/create-group');
  }
};

// Hiển thị danh sách nhóm điểm danh
exports.showAttendanceGroups = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    
    // Lấy danh sách nhóm điểm danh của giáo viên
    const groups = await AttendanceGroup.find({ teacher: teacherId })
      .populate('schedules', 'name')
      .sort({ createdAt: -1 });
    
    res.render('teacher/attendance-groups', {
      title: 'Nhóm Điểm Danh',
      teacher: req.session.user,
      groups,
      moment
    });
  } catch (err) {
    console.error('Lỗi khi hiển thị danh sách nhóm điểm danh:', err);
    req.flash('error', 'Không thể tải danh sách nhóm điểm danh: ' + err.message);
    res.redirect('/teacher/dashboard');
  }
};

// Hiển thị chi tiết nhóm điểm danh
exports.showAttendanceGroupDetail = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const groupId = req.params.id;
    
    // Lấy thông tin nhóm điểm danh
    const group = await AttendanceGroup.findOne({
      _id: groupId,
      teacher: teacherId
    })
    .populate('schedules', 'name')
    .populate('students', 'name studentId gender');
    
    if (!group) {
      req.flash('error', 'Không tìm thấy nhóm điểm danh hoặc bạn không có quyền truy cập');
      return res.redirect('/teacher/attendance/groups');
    }
    
    // Lấy lịch sử điểm danh của nhóm này
    const recentAttendances = await Attendance.find({
      'group': groupId
    })
    .sort({ date: -1 })
    .limit(10);
    
    res.render('teacher/attendance-group-detail', {
      title: 'Chi Tiết Nhóm Điểm Danh',
      teacher: req.session.user,
      group,
      recentAttendances,
      moment
    });
  } catch (err) {
    console.error('Lỗi khi hiển thị chi tiết nhóm điểm danh:', err);
    req.flash('error', 'Không thể tải chi tiết nhóm điểm danh: ' + err.message);
    res.redirect('/teacher/attendance/groups');
  }
};

// Hiển thị trang điểm danh cho nhóm
exports.showTakeGroupAttendance = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const groupId = req.params.id;
    
    // Lấy thông tin nhóm
    const group = await AttendanceGroup.findOne({
      _id: groupId,
      teacher: teacherId
    })
    .populate('schedules', 'name')
    .populate('students', 'name studentId gender status endDate');
    
    if (!group) {
      req.flash('error', 'Không tìm thấy nhóm điểm danh hoặc bạn không có quyền truy cập');
      return res.redirect('/teacher/attendance/groups');
    }
    
    // Xác định ngày điểm danh (ngày hiện tại)
    const today = moment().startOf('day');
    
    // Lọc học sinh để chỉ hiển thị những học sinh đang học (active) và chưa đến ngày nghỉ học
    if (group.students && group.students.length > 0) {
      group.students = group.students.filter(student => {
        // Kiểm tra trạng thái active
        if (student.status !== 'active') return false;
        
        // Kiểm tra ngày nghỉ học: nếu có ngày nghỉ học (endDate) và ngày điểm danh sau ngày nghỉ học, thì không hiển thị
        if (student.endDate && new Date(student.endDate) < today.toDate()) return false;
        
        return true;
      });
    }
    
    // Kiểm tra nếu đã có điểm danh hôm nay
    const todayAttendance = await Attendance.findOne({
      group: groupId,
      date: {
        $gte: today.toDate(),
        $lt: moment(today).endOf('day').toDate()
      }
    }).populate({
      path: 'students.student',
      select: 'name studentId'
    });
    
    let attendanceData = null;
    if (todayAttendance) {
      attendanceData = todayAttendance.students.map(student => ({
        studentId: student.student._id.toString(),
        name: student.student.name,
        status: student.status,
        note: student.note || ''
      }));
    }
    
    res.render('teacher/take-group-attendance', {
      title: 'Điểm Danh Nhóm',
      teacher: req.session.user,
      group,
      today: moment().format('YYYY-MM-DD'),
      existingAttendance: attendanceData,
      moment
    });
  } catch (err) {
    console.error('Lỗi khi hiển thị trang điểm danh nhóm:', err);
    req.flash('error', 'Không thể tải trang điểm danh nhóm: ' + err.message);
    res.redirect('/teacher/attendance/groups');
  }
};

// Lưu điểm danh cho nhóm
exports.submitGroupAttendance = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const groupId = req.params.id;
    const { date, studentStatus } = req.body;
    
    // Tìm nhóm và xác minh quyền truy cập
    const group = await AttendanceGroup.findOne({
      _id: groupId,
      teacher: teacherId
    });
    
    if (!group) {
      req.flash('error', 'Không tìm thấy nhóm điểm danh hoặc bạn không có quyền truy cập');
      return res.redirect('/teacher/attendance/groups');
    }
    
    // Định dạng danh sách học sinh với trạng thái điểm danh
    const students = [];
    for (const [studentId, status] of Object.entries(studentStatus)) {
      students.push({
        student: studentId,
        status,
        note: ''
      });
    }
    
    // Chuyển đổi ngày thành đối tượng Date
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    
    // Kiểm tra xem đã có điểm danh cho nhóm này trong ngày chưa
    const existingAttendance = await Attendance.findOne({
      group: groupId,
      date: {
        $gte: attendanceDate,
        $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    if (existingAttendance) {
      // Cập nhật bản ghi điểm danh hiện có
      existingAttendance.students = students;
      existingAttendance.updatedAt = new Date();
      await existingAttendance.save();
    } else {
      // Tạo bản ghi điểm danh mới
      const newAttendance = new Attendance({
        group: groupId,
        schedules: group.schedules,
        date: attendanceDate,
        students,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await newAttendance.save();
    }
    
    req.flash('success', 'Đã lưu điểm danh thành công');
    res.redirect(`/teacher/attendance/groups/${groupId}`);
  } catch (err) {
    console.error('Lỗi khi lưu điểm danh nhóm:', err);
    req.flash('error', 'Không thể lưu điểm danh: ' + err.message);
    res.redirect(`/teacher/attendance/groups/${req.params.id}/take`);
  }
};

// API lấy chi tiết điểm danh
exports.getAttendanceDetail = async (req, res) => {
  try {
    const teacherId = req.session.user._id;
    const attendanceId = req.params.id;
    
    // Tìm bản ghi điểm danh
    const attendance = await Attendance.findById(attendanceId)
      .populate({
        path: 'students.student',
        select: 'name studentId'
      })
      .populate('schedules', 'name')
      .populate('group', 'name');
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bản ghi điểm danh'
      });
    }
    
    // Xác minh quyền truy cập
    let hasAccess = false;
    
    if (attendance.schedule) {
      const schedule = await Schedule.findOne({
        _id: attendance.schedule,
        teacher: teacherId
      });
      hasAccess = !!schedule;
    } else if (attendance.group) {
      const group = await AttendanceGroup.findOne({
        _id: attendance.group,
        teacher: teacherId
      });
      hasAccess = !!group;
    } else if (attendance.schedules && attendance.schedules.length > 0) {
      const scheduleCount = await Schedule.countDocuments({
        _id: { $in: attendance.schedules },
        teacher: teacherId
      });
      hasAccess = scheduleCount > 0;
    }
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem điểm danh này'
      });
    }
    
    res.json({
      success: true,
      data: attendance
    });
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết điểm danh:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết điểm danh: ' + err.message
    });
  }
};

// API lấy thông tin học sinh cho modal
exports.getStudentInfo = async (req, res) => {
  try {
    const studentId = req.params.id;
    
    // Lấy thông tin học sinh
    const student = await Student.findById(studentId)
      .populate({
        path: 'parent', 
        select: 'name phone email address occupation'
      });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy học sinh'
      });
    }
    
    // Lấy lịch sử điểm danh của học sinh
    const attendanceRecords = await Attendance.find({
      'students.student': studentId
    })
    .sort({ date: -1 })
    .limit(5)
    .populate('schedule', 'name');
    
    // Chuẩn bị danh sách lịch sử điểm danh
    const attendanceHistory = [];
    
    for (const record of attendanceRecords) {
      const studentAttendance = record.students.find(s => 
        s.student.toString() === studentId
      );
      
      if (studentAttendance) {
        attendanceHistory.push({
          date: record.date,
          className: record.schedule ? record.schedule.name : 'Không xác định',
          status: studentAttendance.status,
          note: studentAttendance.note || ''
        });
      }
    }
    
    // Chuẩn bị dữ liệu trả về
    const studentData = {
      id: student._id,
      name: student.name,
      dateOfBirth: student.dateOfBirth,
      status: student.status,
      contactNumber: student.contactNumber || student.phone,
      address: student.address,
      notes: student.notes || student.note,
      parent: student.parent ? {
        id: student.parent._id,
        name: student.parent.name,
        phone: student.parent.phone,
        email: student.parent.email,
        address: student.parent.address
      } : null,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      attendanceHistory: attendanceHistory
    };
    
    res.json(studentData);
  } catch (err) {
    console.error('Lỗi khi lấy thông tin học sinh:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin học sinh: ' + err.message
    });
  }
};

// API lấy thông tin phụ huynh cho modal
exports.getParentInfo = async (req, res) => {
  try {
    const parentId = req.params.id;
    
    // Lấy thông tin phụ huynh
    const parent = await Parent.findById(parentId);
    
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phụ huynh'
      });
    }
    
    // Lấy danh sách học sinh của phụ huynh
    const children = await Student.find({ parent: parentId })
      .select('name dateOfBirth status');
    
    // Chuẩn bị dữ liệu trả về
    const parentData = {
      id: parent._id,
      name: parent.name,
      phone: parent.phone,
      email: parent.email,
      address: parent.address,
      occupation: parent.occupation,
      notes: parent.notes,
      children: children.map(child => ({
        id: child._id,
        name: child.name,
        dateOfBirth: child.dateOfBirth,
        status: child.status
      }))
    };
    
    res.json(parentData);
  } catch (err) {
    console.error('Lỗi khi lấy thông tin phụ huynh:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin phụ huynh: ' + err.message
    });
  }
};

// Tạo học phí hàng loạt cho cả lớp
exports.generateTuition = async (req, res) => {
  try {
    const { scheduleId, month, year, dueDay, amount, name, status } = req.body;
    const teacherId = req.session.user._id;
    
    // Kiểm tra xem giáo viên có dạy lớp này không
    const schedule = await Schedule.findOne({ _id: scheduleId, teacher: teacherId });
    if (!schedule) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bạn không có quyền tạo học phí cho lớp này' 
      });
    }
    
    // Kiểm tra dữ liệu đầu vào
    if (!scheduleId || !month || !year || !dueDay || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc' 
      });
    }
    
    // Chuyển đổi dữ liệu sang số
    const monthInt = parseInt(month);
    const yearInt = parseInt(year);
    const dueDayInt = parseInt(dueDay);
    const amountFloat = parseFloat(amount);
    
    // Kiểm tra tính hợp lệ của dữ liệu
    if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tháng không hợp lệ. Vui lòng nhập số từ 1 đến 12' 
      });
    }
    
    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Năm không hợp lệ. Vui lòng nhập số từ 2000 đến 2100' 
      });
    }
    
    if (isNaN(dueDayInt) || dueDayInt < 1 || dueDayInt > 31) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ngày đến hạn không hợp lệ. Vui lòng nhập số từ 1 đến 31' 
      });
    }
    
    if (isNaN(amountFloat) || amountFloat <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Số tiền không hợp lệ. Vui lòng nhập số dương' 
      });
    }
    
    // Lấy danh sách học sinh trong lớp
    const enrollments = await Enrollment.find({
      class: scheduleId,
      status: 'active'
    }).populate('student');
    
    if (enrollments.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không có học sinh nào trong lớp học này' 
      });
    }
    
    // Kiểm tra xem đã tạo học phí cho tháng này chưa
    const existingTuitions = await Tuition.find({
      schedule: scheduleId,
      month: monthInt,
      year: yearInt
    });
    
    if (existingTuitions.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Đã tồn tại ${existingTuitions.length} khoản học phí cho lớp này trong tháng ${monthInt}/${yearInt}` 
      });
    }
    
    // Tạo ngày đến hạn và ngày đầu tháng cho việc kiểm tra
    const dueDate = new Date(yearInt, monthInt - 1, dueDayInt);
    // Ngày đầu tiên của tháng được tạo học phí - dùng để so sánh với ngày nghỉ học
    const firstDayOfMonth = new Date(yearInt, monthInt - 1, 1);
    
    // Tạo tên học phí nếu không được cung cấp
    const tuitionName = name || `Học phí tháng ${monthInt}/${yearInt} - ${schedule.name}`;
    
    // Xác định trạng thái học phí
    const tuitionStatus = status && ['pending', 'paid'].includes(status) ? status : 'pending';
    
    console.log(`Bắt đầu tạo học phí cho lớp ${schedule.name}, tháng ${monthInt}/${yearInt}, số tiền ${amountFloat}`);
    
    // Tạo học phí cho từng học sinh trong lớp
    const tuitionPromises = [];
    let successCount = 0;
    let skippedCount = 0;
    
    for (const enrollment of enrollments) {
      try {
        if (!enrollment.student || !enrollment.student._id) {
          console.error('Học sinh không hợp lệ trong enrollment:', enrollment);
          continue;
        }
        
        // Kiểm tra trạng thái học sinh
        if (enrollment.student.status !== 'active') {
          console.log(`Bỏ qua học sinh ${enrollment.student.name} do trạng thái không active (${enrollment.student.status})`);
          skippedCount++;
          continue;
        }
        
        // Kiểm tra nếu học sinh đã nghỉ học trước khi tháng học phí bắt đầu
        if (enrollment.student.endDate && new Date(enrollment.student.endDate) < firstDayOfMonth) {
          console.log(`Bỏ qua học sinh ${enrollment.student.name} do đã nghỉ học từ ${new Date(enrollment.student.endDate).toLocaleDateString('vi-VN')}`);
          skippedCount++;
          continue;
        }
        
        console.log(`Đang tạo học phí cho học sinh ${enrollment.student.name || 'không tên'} (ID: ${enrollment.student._id})`);
        
        const tuition = new Tuition({
          student: enrollment.student._id,
          schedule: scheduleId,
          amount: amountFloat,
          name: tuitionName,
          month: monthInt,
          year: yearInt,
          dueDate: dueDate,
          status: tuitionStatus,
          academicYear: `${yearInt}-${yearInt + 1}`
        });
        
        // Nếu trạng thái là đã thanh toán, cập nhật thông tin thanh toán
        if (tuitionStatus === 'paid') {
          tuition.paymentDate = new Date();
          tuition.paymentMethod = 'cash';
        }
        
        tuitionPromises.push(tuition.save());
        successCount++;
      } catch (error) {
        console.error(`Lỗi khi tạo học phí cho học sinh ID ${enrollment.student?._id}:`, error);
      }
    }
    
    await Promise.all(tuitionPromises);
    
    let message = `Đã tạo học phí cho ${successCount} học sinh trong lớp ${schedule.name}`;
    if (skippedCount > 0) {
      message += `. Đã bỏ qua ${skippedCount} học sinh đã nghỉ học hoặc không còn hoạt động.`;
    }
    
    return res.status(200).json({ 
      success: true, 
      message: message
    });
  } catch (error) {
    console.error('Lỗi khi tạo học phí hàng loạt:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Đã xảy ra lỗi: ' + (error.message || 'Lỗi không xác định')
    });
  }
};

// Tạo học phí thủ công cho một học sinh
exports.createManualTuition = async (req, res) => {
  try {
    console.log('createManualTuition - Dữ liệu nhận được:', req.body);
    const { scheduleId, studentId, amount, month, year, dueDay, name, status, notes } = req.body;
    const teacherId = req.session.user._id;
    
    // Kiểm tra giáo viên có quyền với lớp học này không
    const schedule = await Schedule.findOne({ _id: scheduleId, teacher: teacherId });
    if (!schedule) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bạn không có quyền tạo học phí cho lớp này' 
      });
    }
    
    // Kiểm tra dữ liệu đầu vào
    if (!scheduleId || !studentId || !amount || !month || !year || !dueDay) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc' 
      });
    }
    
    // Chuyển đổi dữ liệu sang số
    const monthInt = parseInt(month);
    const yearInt = parseInt(year);
    const dueDayInt = parseInt(dueDay);
    const amountFloat = parseFloat(amount);
    
    // Kiểm tra tính hợp lệ của dữ liệu
    if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tháng không hợp lệ. Vui lòng nhập số từ 1 đến 12' 
      });
    }
    
    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Năm không hợp lệ. Vui lòng nhập số từ 2000 đến 2100' 
      });
    }
    
    if (isNaN(dueDayInt) || dueDayInt < 1 || dueDayInt > 31) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ngày đến hạn không hợp lệ. Vui lòng nhập số từ 1 đến 31' 
      });
    }
    
    if (isNaN(amountFloat) || amountFloat <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Số tiền không hợp lệ. Vui lòng nhập số dương' 
      });
    }
    
    // Kiểm tra học sinh có tồn tại không
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy học sinh' 
      });
    }
    
    // Kiểm tra học sinh có thuộc lớp này không
    const enrollment = await Enrollment.findOne({
      student: studentId,
      class: scheduleId,
      status: 'active'
    });
    
    if (!enrollment) {
      return res.status(400).json({ 
        success: false, 
        message: 'Học sinh không thuộc lớp học này hoặc không còn hoạt động' 
      });
    }
    
    // Tạo ngày đến hạn
    const dueDate = new Date(yearInt, monthInt - 1, dueDayInt);
 
    
    console.log(`Tạo học phí thủ công cho học sinh ${student.name} (ID: ${studentId}) trong lớp ${schedule.name}, tháng ${monthInt}/${yearInt}, số tiền ${amountFloat}, ngày đến hạn ${dueDate.toLocaleDateString()}`);
    
    // Tạo bản ghi học phí mới
    const tuition = new Tuition({
      student: studentId,
      schedule: scheduleId,
      name: name || `Học phí tháng ${monthInt}/${yearInt} - ${schedule.name}`,
      amount: amountFloat,
      dueDate: dueDate,
      status: status || 'pending',
      notes: notes || '',
      academicYear: `${yearInt}-${yearInt + 1}`
    });
    
    // Nếu trạng thái là đã thanh toán, cập nhật thông tin thanh toán
    if (status === 'paid') {
      tuition.paymentDate = new Date();
      tuition.paymentMethod = 'cash';
    }
    
    // Lưu bản ghi học phí
    await tuition.save();
    
    console.log(`Đã lưu học phí thủ công thành công cho học sinh ID ${studentId}`);
    
    return res.status(200).json({ 
      success: true, 
      message: `Đã tạo học phí thành công cho học sinh ${student.name}` 
    });
  } catch (error) {
    console.error('Lỗi khi tạo học phí thủ công:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Đã xảy ra lỗi: ' + (error.message || 'Lỗi không xác định')
    });
  }
}; 

// Cập nhật thông tin học phí
exports.updateTuition = async (req, res) => {
  try {
    const { tuitionId, amount, dueDate, notes, status } = req.body;
    const teacherId = req.session.user._id;

    // Kiểm tra dữ liệu đầu vào
    if (!tuitionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu ID học phí cần chỉnh sửa' 
      });
    }

    // Tìm bản ghi học phí
    const tuition = await Tuition.findById(tuitionId);
    if (!tuition) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy bản ghi học phí' 
      });
    }

    // Kiểm tra giáo viên có quyền với lớp học này không
    const schedule = await Schedule.findById(tuition.schedule);
    if (!schedule || schedule.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền chỉnh sửa học phí này' 
      });
    }

    // Cập nhật thông tin học phí
    if (amount && !isNaN(parseFloat(amount))) {
      tuition.amount = parseFloat(amount);
    }
    
    if (dueDate) {
      tuition.dueDate = new Date(dueDate);
    }
    
    if (notes !== undefined) {
      tuition.notes = notes;
    }
    
    if (status && ['pending', 'paid', 'overdue'].includes(status)) {
      tuition.status = status;
      
      // Nếu trạng thái là đã thanh toán, cập nhật thông tin thanh toán
      if (status === 'paid' && tuition.status !== 'paid') {
        tuition.paymentDate = new Date();
        tuition.paymentMethod = 'cash';
      }
    } else if (!status && tuition.status !== 'paid') {
      // Tự động kiểm tra và cập nhật trạng thái quá hạn nếu không có status được chỉ định
      const now = new Date();
      const dueDate = tuition.dueDate ? new Date(tuition.dueDate) : null;
      
      if (dueDate && now > dueDate) {
        tuition.status = 'overdue';
      }
    }

    // Cập nhật ngày chỉnh sửa
    tuition.updatedAt = new Date();

    // Lưu bản ghi học phí
    await tuition.save();

    return res.status(200).json({ 
      success: true, 
      message: 'Đã cập nhật thông tin học phí thành công',
      tuition
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật học phí:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Đã xảy ra lỗi: ' + (error.message || 'Lỗi không xác định')
    });
  }
};

// Xóa học phí
exports.deleteTuition = async (req, res) => {
  try {
    const { tuitionId } = req.body;
    const teacherId = req.session.user._id;

    if (!tuitionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu ID học phí cần xóa' 
      });
    }

    // Tìm bản ghi học phí
    const tuition = await Tuition.findById(tuitionId);
    if (!tuition) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy bản ghi học phí' 
      });
    }

    // Kiểm tra giáo viên có quyền với lớp học này không
    const schedule = await Schedule.findById(tuition.schedule);
    if (!schedule || schedule.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền xóa học phí này' 
      });
    }

    // Xóa học phí
    await Tuition.findByIdAndDelete(tuitionId);

    return res.status(200).json({ 
      success: true, 
      message: 'Đã xóa học phí thành công'
    });
  } catch (error) {
    console.error('Lỗi khi xóa học phí:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Đã xảy ra lỗi: ' + (error.message || 'Lỗi không xác định')
    });
  }
};

/**
 * Cập nhật ghi chú cho học phí
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
exports.updateTuitionNote = async (req, res) => {
  try {
    const { tuitionId, notes, isPaid } = req.body;
    
    if (!tuitionId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin học phí' });
    }
    
    // Tìm học phí
    const tuition = await Tuition.findById(tuitionId).populate('student schedule');
    
    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học phí' });
    }
    
    // Kiểm tra quyền hạn giáo viên
    const teacherId = req.session.user._id;
    if (!tuition.schedule || !tuition.schedule.teacher || tuition.schedule.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ success: false, message: 'Không có quyền cập nhật học phí này' });
    }
    
    // Cập nhật ghi chú
    tuition.notes = notes;
    
    // Cập nhật trạng thái thanh toán nếu được cung cấp
    if (isPaid !== undefined) {
      if (isPaid === 'true') {
        tuition.status = 'paid';
        tuition.paymentDate = new Date();
        tuition.paymentMethod = 'cash';
      } else if (isPaid === 'false' && tuition.status === 'paid') {
        // Nếu đổi từ đã thanh toán sang chưa thanh toán
        const now = new Date();
        const dueDate = tuition.dueDate ? new Date(tuition.dueDate) : null;
        
        if (dueDate && now > dueDate) {
          tuition.status = 'overdue';
        } else {
          tuition.status = 'pending';
        }
        
        tuition.paymentDate = null;
        tuition.paymentMethod = null;
      }
    }
    
    await tuition.save();
    
    // Log thay đổi
    console.log(`Giáo viên ${req.session.user.name} đã cập nhật ghi chú và trạng thái thanh toán cho học phí ${tuitionId}`);
    
    return res.json({
      success: true,
      message: 'Đã cập nhật thông tin thành công',
      tuition: {
        id: tuition._id,
        notes: tuition.notes,
        status: tuition.status,
        amount: tuition.amount
      }
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật ghi chú học phí:', error);
    return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi cập nhật ghi chú học phí' });
  }
};