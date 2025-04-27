const User = require('../models/User');
const Teacher = require('../models/Teacher');
const bcrypt = require('bcryptjs');

// Middleware kiểm tra đăng nhập
exports.isAuthenticated = (req, res, next) => {
  if (req.session.isLoggedIn) {
    return next();
  }
  
  // Chuyển hướng đến trang đăng nhập phù hợp dựa vào loại người dùng
  if (req.originalUrl.startsWith('/teacher')) {
    return res.redirect('/auth/teacher-login');
  }
  res.redirect('/auth/login');
};

// Middleware kiểm tra quyền của giáo viên
exports.isTeacher = (req, res, next) => {
  if (req.session.isLoggedIn && req.session.userType === 'teacher') {
    return next();
  }
  res.status(403).render('errors/403', {
    title: 'Lỗi Quyền Truy Cập',
    message: 'Bạn không có quyền truy cập trang này',
    isAuthenticated: false
  });
};

// Middleware kiểm tra quyền và chỉ cho phép giáo viên truy cập các lớp của mình
exports.isTeacherOfClass = async (req, res, next) => {
  try {
    if (!req.session.isLoggedIn || req.session.userType !== 'teacher') {
      return res.status(403).render('errors/403', {
        title: 'Lỗi Quyền Truy Cập',
        message: 'Bạn không có quyền truy cập trang này',
        isAuthenticated: false
      });
    }

    const scheduleId = req.params.id;
    const teacherId = req.session.user._id;

    // Kiểm tra xem lớp có thuộc về giáo viên không
    const Schedule = require('../models/Schedule');
    const schedule = await Schedule.findById(scheduleId);

    if (!schedule) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy',
        message: 'Không tìm thấy lớp học',
        isAuthenticated: false
      });
    }

    if (schedule.teacher.toString() !== teacherId.toString()) {
      return res.status(403).render('errors/403', {
        title: 'Lỗi Quyền Truy Cập',
        message: 'Bạn không phải là giáo viên của lớp này',
        isAuthenticated: false
      });
    }

    next();
  } catch (error) {
    console.error('Lỗi kiểm tra quyền giáo viên:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi Server',
      message: 'Đã xảy ra lỗi, vui lòng thử lại sau',
      isAuthenticated: false
    });
  }
};

// Hiển thị form đăng nhập Admin
exports.getLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Đăng Nhập Admin',
    errorMessage: null
  });
};

// Hiển thị form đăng nhập Giáo viên
exports.getTeacherLogin = (req, res) => {
  res.render('auth/teacher-login', {
    title: 'Đăng Nhập Giáo Viên',
    errorMessage: null
  });
};

// Xử lý đăng nhập Admin
exports.postLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Đăng nhập với tư cách admin
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.render('auth/login', {
        title: 'Đăng Nhập Admin',
        errorMessage: 'Tên đăng nhập hoặc mật khẩu không đúng',
        isAuthenticated: false
      });
    }
    
    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Đăng Nhập Admin',
        errorMessage: 'Tên đăng nhập hoặc mật khẩu không đúng',
        isAuthenticated: false
      });
    }
    
    // Thiết lập session cho admin
    req.session.isLoggedIn = true;
    req.session.userType = 'admin';
    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage
    };
    
    return req.session.save(err => {
      if (err) {
        console.error('Lỗi lưu session:', err);
      }
      res.redirect('/');
    });
  } catch (err) {
    console.error('Lỗi đăng nhập:', err);
    res.render('auth/login', {
      title: 'Đăng Nhập Admin',
      errorMessage: 'Đã xảy ra lỗi khi đăng nhập',
      isAuthenticated: false
    });
  }
};

// Xử lý đăng nhập Giáo viên
exports.postTeacherLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Đăng nhập với tư cách giáo viên (sử dụng email)
    const teacher = await Teacher.findOne({ email: username });
    
    if (!teacher) {
      return res.render('auth/teacher-login', {
        title: 'Đăng Nhập Giáo Viên',
        errorMessage: 'Email hoặc mật khẩu không đúng',
        isAuthenticated: false
      });
    }
    
    // Nếu giáo viên không hoạt động thì không cho đăng nhập
    if (teacher.status !== 'active') {
      return res.render('auth/teacher-login', {
        title: 'Đăng Nhập Giáo Viên',
        errorMessage: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
        isAuthenticated: false
      });
    }
    
    // Kiểm tra mật khẩu
    const isMatch = await teacher.comparePassword(password);
    
    if (!isMatch) {
      return res.render('auth/teacher-login', {
        title: 'Đăng Nhập Giáo Viên',
        errorMessage: 'Email hoặc mật khẩu không đúng',
        isAuthenticated: false
      });
    }
    
    // Thiết lập session cho giáo viên
    req.session.isLoggedIn = true;
    req.session.userType = 'teacher';
    req.session.user = {
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      subject: teacher.subject,
      profileImage: teacher.profileImage
    };
    
    return req.session.save(err => {
      if (err) {
        console.error('Lỗi lưu session:', err);
      }
      res.redirect('/teacher/dashboard');
    });
  } catch (err) {
    console.error('Lỗi đăng nhập:', err);
    res.render('auth/teacher-login', {
      title: 'Đăng Nhập Giáo Viên',
      errorMessage: 'Đã xảy ra lỗi khi đăng nhập',
      isAuthenticated: false
    });
  }
};

// Hiển thị form đăng ký
exports.getRegister = (req, res) => {
  res.render('auth/register', {
    title: 'Đăng Ký',
    errorMessage: null
  });
};

// Xử lý đăng ký
exports.postRegister = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    
    // Kiểm tra password và confirmPassword
    if (password !== confirmPassword) {
      return res.render('auth/register', {
        title: 'Đăng Ký',
        errorMessage: 'Mật khẩu xác nhận không khớp',
        isAuthenticated: false
      });
    }
    
    // Kiểm tra username đã tồn tại chưa
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Đăng Ký',
        errorMessage: 'Tên đăng nhập hoặc email đã tồn tại',
        isAuthenticated: false
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Tạo user mới
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: 'user' // Mặc định là user, admin sẽ được thay đổi trực tiếp trong database
    });
    
    await newUser.save();
    
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Lỗi đăng ký:', err);
    res.render('auth/register', {
      title: 'Đăng Ký',
      errorMessage: 'Đã xảy ra lỗi khi đăng ký',
      isAuthenticated: false
    });
  }
};

// Xử lý đăng xuất
exports.logout = (req, res) => {
  const userType = req.session.userType;
  req.session.destroy(err => {
    if (err) {
      console.error('Lỗi khi xóa session:', err);
    }
    // Chuyển hướng đến trang đăng nhập tương ứng
    if (userType === 'teacher') {
      res.redirect('/auth/teacher-login');
    } else {
      res.redirect('/auth/login');
    }
  });
};

// Quản lý quyền truy cập
exports.isAdmin = (req, res, next) => {
  if (req.session.user && req.session.userType === 'admin') {
    return next();
  }
  res.status(403).render('errors/403', {
    title: 'Lỗi Quyền Truy Cập',
    message: 'Bạn không có quyền truy cập trang này',
    isAuthenticated: false
  });
}; 