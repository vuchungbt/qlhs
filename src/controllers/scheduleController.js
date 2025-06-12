const Schedule = require('../models/Schedule');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');
const moment = require('moment');
const Attendance = require('../models/Attendance');
const Tuition = require('../models/Tuition');

// Lấy danh sách lịch học
exports.getSchedules = async (req, res) => {
  try {
    // Lấy danh sách lịch học
    const schedules = await Schedule.find()
      .populate('teacher', 'name')
      .populate('assistantTeachers', 'name')
      .populate('students', 'name');
    
    // Lấy danh sách giáo viên và học sinh
    const teachers = await Teacher.find().sort('name');
    const students = await Student.find({ status: 'active' }).sort('name');
    
    // Tính toán số lượng học sinh thực tế từ Enrollment
    for (let schedule of schedules) {
      // Đếm số lượng enrollment có trạng thái active
      const enrollments = await Enrollment.find({
        class: schedule._id,
        status: 'active'
      });
      
      // Ghi đè số lượng học sinh từ Enrollment
      schedule.studentCount = enrollments.length;
      
      console.log(`Số học sinh trong lớp ${schedule.name} (từ Enrollment): ${schedule.studentCount}`);
      console.log(`Số học sinh trong lớp ${schedule.name} (từ students array): ${schedule.students ? schedule.students.length : 0}`);
    }
    
    // Log dữ liệu students lấy từ DB cho trang schedule
    console.log('--- Debug getSchedules ---');
    console.log('Query result for active students (schedule page):', students.length);
    // console.log(students); // Bỏ comment dòng này nếu muốn xem chi tiết danh sách
    console.log('------------------------');

    res.render('academic/schedule', { 
      title: 'Quản lý Lịch Học',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      schedules,
      teachers,
      students,
      moment
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách lịch học:', error);
    req.flash('error', 'Không thể lấy danh sách lịch học');
    res.redirect('/dashboard');
  }
};

// Tạo lịch học mới
exports.createSchedule = async (req, res) => {
  try {
    const { name, teacherId, dayOfWeek, startTime, endTime, location } = req.body;
    let { studentIds, assistantTeacherIds } = req.body;
    
    // Đảm bảo assistantTeacherIds luôn là mảng
    if (assistantTeacherIds) {
      assistantTeacherIds = Array.isArray(assistantTeacherIds) ? assistantTeacherIds : [assistantTeacherIds];
    } else {
      assistantTeacherIds = [];
    }
    
    // Chuyển đổi dayOfWeek từ chuỗi sang mảng nếu cần
    const days = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek];
    
    // Đảm bảo studentIds luôn là mảng
    if (studentIds) {
      studentIds = Array.isArray(studentIds) ? studentIds : [studentIds];
    } else {
      studentIds = [];
    }
    
    // Debug log để kiểm tra ngày được chọn
    console.log('Ngày được chọn (gốc):', dayOfWeek);
    console.log('Ngày được chọn (mảng):', days);
    console.log('Học sinh được chọn:', studentIds);
    console.log('Trợ giảng được chọn:', assistantTeacherIds);
    
    // Tìm thông tin giáo viên để lấy môn học
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw new Error('Không tìm thấy thông tin giáo viên');
    }
    
    // Tạo lịch học mới
    const newSchedule = new Schedule({
      name,
      teacher: teacherId,
      assistantTeachers: assistantTeacherIds,
      dayOfWeek: days,
      days: days,
      startTime,
      endTime,
      time: {
        start: startTime,
        end: endTime
      },
      location: location || '',
      room: location || '',
      students: studentIds
    });

    await newSchedule.save();
    
    // Tạo enrollment cho mỗi học sinh được chọn
    if (studentIds.length > 0) {
      const enrollmentPromises = [];
      
      studentIds.forEach(studentId => {
        const newEnrollment = new Enrollment({
          student: studentId,
          class: newSchedule._id,
          status: 'active',
          academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
        });
        
        enrollmentPromises.push(newEnrollment.save());
        console.log(`Tạo enrollment mới cho học sinh ${studentId} vào lớp ${newSchedule.name}`);
      });
      
      await Promise.all(enrollmentPromises);
      console.log(`Đã tạo ${enrollmentPromises.length} enrollment cho lớp ${newSchedule.name}`);
    }
    
    req.flash('success', 'Lịch học đã được tạo thành công');
    res.redirect('/academic/schedule');
  } catch (error) {
    console.error('Lỗi khi tạo lịch học:', error);
    req.flash('error', 'Không thể tạo lịch học: ' + error.message);
    res.redirect('/academic/schedule');
  }
};

// Lấy dữ liệu để hiển thị form tạo lịch học
exports.getScheduleForm = async (req, res) => {
  try {
    const teachers = await Teacher.find().sort('name');
    const students = await Student.find({ status: 'active' }).sort('name');
    
    res.render('academic/add-schedule', {
      teachers,
      students
    });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu form lịch học:', error);
    req.flash('error', 'Không thể tải form thêm lịch học');
    res.redirect('/academic/schedule');
  }
};

// Xóa lịch học
exports.deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    
    const schedule = await Schedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch học' });
    }

    // Xóa tất cả bản ghi điểm danh liên quan
    await Attendance.deleteMany({ class: id });
    console.log(`Đã xóa điểm danh của lớp ${schedule.name}`);

    // Xóa tất cả bản ghi học phí liên quan
    await Tuition.deleteMany({ schedule: id });
    console.log(`Đã xóa học phí của lớp ${schedule.name}`);

    // Xóa tất cả bản ghi ghi danh liên quan
    await Enrollment.deleteMany({ class: id });
    console.log(`Đã xóa ghi danh của lớp ${schedule.name}`);
    
    // Xóa lịch học
    await Schedule.findByIdAndDelete(id);
    console.log(`Đã xóa lớp ${schedule.name}`);
    
    // Trả về JSON thay vì redirect vì frontend dùng fetch API
    res.status(200).json({ success: true, message: 'Lịch học và các bản ghi liên quan đã được xóa thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa lịch học:', error);
    res.status(500).json({ success: false, message: 'Không thể xóa lịch học' });
  }
};

// Lấy dữ liệu một lịch học để chỉnh sửa
exports.getEditSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    
    const schedule = await Schedule.findById(id)
      .populate('teacher')
      .populate('assistantTeachers')
      .populate('students');
      
    if (!schedule) {
      req.flash('error', 'Không tìm thấy lịch học');
      return res.redirect('/academic/schedule');
    }
    
    const teachers = await Teacher.find().sort('name');
    const students = await Student.find({ status: 'active' }).sort('name');
    
    // Log dữ liệu students lấy từ DB
    console.log('--- Debug getEditSchedule ---');
    console.log('Query result for active students:', students.length);
    // console.log(students); // Bỏ comment dòng này nếu muốn xem chi tiết danh sách
    console.log('-----------------------------');
    
    res.render('academic/edit-schedule', {
      title: 'Chỉnh Sửa Lịch Học',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      schedule,
      teachers,
      students
    });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu để chỉnh sửa:', error);
    req.flash('error', 'Không thể tải thông tin lịch học');
    res.redirect('/academic/schedule');
  }
};

// Cập nhật lịch học
exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, teacherId, dayOfWeek, startTime, endTime, location, status } = req.body;
    let { studentIds, assistantTeacherIds } = req.body;
    
    // Đảm bảo assistantTeacherIds luôn là mảng
    if (assistantTeacherIds) {
      assistantTeacherIds = Array.isArray(assistantTeacherIds) ? assistantTeacherIds : [assistantTeacherIds];
    } else {
      assistantTeacherIds = [];
    }
    
    // Kiểm tra và đảm bảo dayOfWeek không null/undefined
    const daysInput = dayOfWeek || [];
    
    // Chuyển đổi dayOfWeek từ chuỗi sang mảng nếu cần và lọc giá trị null/undefined
    const days = Array.isArray(daysInput) ? daysInput.filter(day => day) : [daysInput].filter(day => day);
    
    // Đảm bảo studentIds luôn là mảng
    if (studentIds) {
      studentIds = Array.isArray(studentIds) ? studentIds : [studentIds];
    } else {
      studentIds = [];
    }
    
    console.log('Ngày trong tuần đã chọn (raw):', dayOfWeek);
    console.log('Ngày trong tuần đã xử lý:', days);
    console.log('Học sinh được chọn:', studentIds);
    console.log('Trợ giảng được chọn:', assistantTeacherIds);
    
    // Đảm bảo tương thích với cả hai cấu trúc dữ liệu
    const updatedSchedule = {
      name,
      teacher: teacherId,
      assistantTeachers: assistantTeacherIds,
      // Lưu ở cả hai định dạng để đảm bảo tương thích
      dayOfWeek: days,
      // Chỉ chuyển đổi những giá trị không null/undefined
      days: days,
      // Lưu ở cả hai định dạng 
      startTime,
      endTime,
      time: {
        start: startTime,
        end: endTime
      },
      // Cập nhật cả hai trường location và room với cùng giá trị
      location: location || '',
      room: location || '',
      students: studentIds,
      status
    };
    
    console.log('Cập nhật lịch học:', updatedSchedule);
    
    // Lấy thông tin lịch học cũ
    const oldSchedule = await Schedule.findById(id);
    
    // Cập nhật thông tin lịch học
    await Schedule.findByIdAndUpdate(id, updatedSchedule);
    
    // Đồng bộ hóa Enrollments với danh sách học sinh mới
    if (studentIds) {
      // Lấy danh sách học sinh hiện tại trong enrollment
      const currentEnrollments = await Enrollment.find({
        class: id,
        status: 'active'
      });
      
      const currentStudentIds = currentEnrollments.map(enrollment => 
        enrollment.student.toString()
      );
      
      console.log('Danh sách học sinh hiện tại trong enrollment:', currentStudentIds);
      console.log('Danh sách học sinh mới được chọn:', studentIds);
      
      // Tìm học sinh cần thêm mới (có trong studentIds nhưng không có trong currentStudentIds)
      const studentsToAdd = studentIds.filter(studentId => 
        !currentStudentIds.includes(studentId.toString())
      );
      
      // Thêm enrollment mới cho học sinh chưa có
      if (studentsToAdd.length > 0) {
        const addPromises = [];
        
        studentsToAdd.forEach(studentId => {
          const newEnrollment = new Enrollment({
            student: studentId,
            class: id,
            status: 'active',
            academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
          });
          
          addPromises.push(newEnrollment.save());
          console.log(`Thêm enrollment mới cho học sinh ${studentId} vào lớp ${name}`);
        });
        
        await Promise.all(addPromises);
        console.log(`Đã thêm ${addPromises.length} enrollment mới`);
      }
      
      // Tìm học sinh cần đánh dấu không còn hoạt động (có trong currentStudentIds nhưng không có trong studentIds)
      const studentsToRemove = currentStudentIds.filter(studentId => 
        !studentIds.includes(studentId)
      );
      
      // Cập nhật trạng thái enrollment thành không hoạt động cho học sinh bị xóa
      if (studentsToRemove.length > 0) {
        await Enrollment.updateMany(
          {
            class: id,
            student: { $in: studentsToRemove },
            status: 'active'
          },
          {
            $set: { status: 'inactive' }
          }
        );
        
        console.log(`Đã cập nhật ${studentsToRemove.length} enrollment thành không hoạt động`);
      }
    }
    
    req.flash('success', 'Lịch học đã được cập nhật thành công');
    res.redirect('/academic/schedule');
  } catch (error) {
    console.error('Lỗi khi cập nhật lịch học:', error);
    req.flash('error', 'Không thể cập nhật lịch học: ' + error.message);
    res.redirect('/academic/schedule');
  }
};

// Lấy thông tin chi tiết một lịch học
exports.getScheduleDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const schedule = await Schedule.findById(id)
      .populate('teacher', 'name email phone')
      .populate('assistantTeachers', 'name email phone')
      .populate('students', 'name class dateOfBirth status');
      
    if (!schedule) {
      req.flash('error', 'Không tìm thấy lịch học');
      return res.redirect('/academic/schedule');
    }
    
    res.render('academic/schedule-detail', {
      title: 'Chi Tiết Lịch Học',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      schedule,
      moment
    });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết lịch học:', error);
    req.flash('error', 'Không thể tải thông tin lịch học');
    res.redirect('/academic/schedule');
  }
};

// API endpoint để lấy danh sách học sinh của một lịch học
exports.getScheduleStudentsData = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await Schedule.findById(id).populate({
      path: 'students',
      select: 'name dateOfBirth status note' // Chọn các trường cần thiết
    });

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch học' });
    }

    // Kiểm tra nếu không có học sinh hoặc mảng học sinh rỗng
    if (!schedule.students || schedule.students.length === 0) {
      return res.json({ 
        success: true, 
        students: [], 
        message: 'Lịch học này không có học sinh nào' 
      });
    }

    res.json({ success: true, students: schedule.students });

  } catch (error) {
    console.error('Lỗi khi lấy danh sách học sinh cho lịch học:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách học sinh' });
  }
};

async function cleanOrphanTuitions() {
  const validSchedules = await Schedule.find().distinct('_id');
  const result = await Tuition.deleteMany({ schedule: { $nin: validSchedules } });
  console.log('Đã xoá', result.deletedCount, 'bản ghi học phí không còn lớp.');
}

cleanOrphanTuitions(); 