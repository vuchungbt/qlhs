const Schedule = require('../models/Schedule');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const moment = require('moment');

// Lấy danh sách lịch học
exports.getSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate('teacher', 'name')
      .populate('students', 'name');

    res.render('academic/schedule', { 
      schedules,
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
    const { name, teacherId, dayOfWeek, startTime, endTime, location, studentIds } = req.body;
    
    // Chuyển đổi dayOfWeek từ chuỗi sang mảng nếu cần
    const days = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek];
    
    // Tạo lịch học mới
    const newSchedule = new Schedule({
      name,
      teacher: teacherId,
      dayOfWeek: days,
      startTime,
      endTime,
      location,
      students: studentIds || []
    });

    await newSchedule.save();
    
    req.flash('success', 'Lịch học đã được tạo thành công');
    res.redirect('/academic/schedule');
  } catch (error) {
    console.error('Lỗi khi tạo lịch học:', error);
    req.flash('error', 'Không thể tạo lịch học');
    res.redirect('/academic/schedule');
  }
};

// Lấy dữ liệu để hiển thị form tạo lịch học
exports.getScheduleForm = async (req, res) => {
  try {
    const teachers = await Teacher.find().sort('name');
    const students = await Student.find().sort('name');
    
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
    
    await Schedule.findByIdAndDelete(id);
    
    // Trả về JSON thay vì redirect vì frontend dùng fetch API
    res.status(200).json({ success: true, message: 'Lịch học đã được xóa thành công' });
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
      .populate('students');
      
    if (!schedule) {
      req.flash('error', 'Không tìm thấy lịch học');
      return res.redirect('/academic/schedule');
    }
    
    const teachers = await Teacher.find().sort('name');
    const students = await Student.find().sort('name');
    
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
    const { name, teacherId, dayOfWeek, startTime, endTime, location, studentIds, status } = req.body;
    
    // Chuyển đổi dayOfWeek từ chuỗi sang mảng nếu cần
    const days = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek];
    
    const updatedSchedule = {
      name,
      teacher: teacherId,
      dayOfWeek: days,
      startTime,
      endTime,
      location,
      students: studentIds || [],
      status
    };
    
    await Schedule.findByIdAndUpdate(id, updatedSchedule);
    
    req.flash('success', 'Lịch học đã được cập nhật thành công');
    res.redirect('/academic/schedule');
  } catch (error) {
    console.error('Lỗi khi cập nhật lịch học:', error);
    req.flash('error', 'Không thể cập nhật lịch học');
    res.redirect('/academic/schedule');
  }
};

// Lấy thông tin chi tiết một lịch học
exports.getScheduleDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const schedule = await Schedule.findById(id)
      .populate('teacher', 'name email phone subject')
      .populate('students', 'name class dateOfBirth');
      
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