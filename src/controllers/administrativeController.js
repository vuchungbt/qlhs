const Teacher = require('../models/Teacher');

// Controller lấy danh sách giáo viên
exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find().sort({ name: 1 });
    
    res.render('administrative/teachers', {
      title: 'Quản Lý Giáo Viên',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      teachers
    });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách giáo viên:', err);
    res.status(500).send('Lỗi server');
  }
};

// Controller thêm giáo viên mới
exports.createTeacher = async (req, res) => {
  try {
    const { name, email, phone, subject } = req.body;
    
    const newTeacher = new Teacher({
      name,
      email,
      phone,
      subject
    });
    
    await newTeacher.save();
    res.redirect('/administrative/teachers');
  } catch (err) {
    console.error('Lỗi khi thêm giáo viên mới:', err);
    res.status(500).send('Lỗi server');
  }
};

// Xem thông tin chi tiết giáo viên
exports.getTeacherDetail = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).send('Không tìm thấy giáo viên');
    }
    
    res.render('administrative/teacher-detail', {
      title: 'Chi Tiết Giáo Viên',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      teacher
    });
  } catch (err) {
    console.error('Lỗi khi xem chi tiết giáo viên:', err);
    res.status(500).send('Lỗi server');
  }
};

// Cập nhật thông tin giáo viên
exports.updateTeacher = async (req, res) => {
  try {
    const { name, email, phone, subject } = req.body;
    
    await Teacher.findByIdAndUpdate(req.params.id, {
      name,
      email,
      phone,
      subject
    });
    
    res.redirect('/administrative/teachers');
  } catch (err) {
    console.error('Lỗi khi cập nhật giáo viên:', err);
    res.status(500).send('Lỗi server');
  }
};

// Xóa giáo viên
exports.deleteTeacher = async (req, res) => {
  try {
    await Teacher.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Lỗi khi xóa giáo viên:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}; 