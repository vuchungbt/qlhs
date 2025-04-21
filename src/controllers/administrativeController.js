const Teacher = require('../models/Teacher');
const bcrypt = require('bcryptjs');

// Controller lấy danh sách giáo viên
exports.getTeachers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const totalTeachers = await Teacher.countDocuments();
    const totalPages = Math.ceil(totalTeachers / limit);
    const teachers = await Teacher.find()
                                .sort({ name: 1 })
                                .skip(skip)
                                .limit(limit);
    
    res.render('administrative/teachers', {
      title: 'Quản Lý Giáo Viên',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      teachers,
      pagination: {
        page,
        limit,
        totalTeachers,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      }
    });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách giáo viên:', err);
    res.status(500).send('Lỗi server');
  }
};

// Controller thêm giáo viên mới
exports.createTeacher = async (req, res) => {
  try {
    const { name, email, phone, password, subject } = req.body;
    
    // Băm mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newTeacher = new Teacher({
      name,
      email,
      phone,
      password: hashedPassword,
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
    const { name, email, phone, password, subject } = req.body;
    
    // Chuẩn bị dữ liệu cập nhật
    const updateData = {
      name,
      email,
      phone,
      subject
    };
    
    // Chỉ cập nhật mật khẩu nếu nó được cung cấp
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    await Teacher.findByIdAndUpdate(req.params.id, updateData);
    
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