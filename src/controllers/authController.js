const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Middleware kiểm tra đăng nhập
exports.isAuthenticated = (req, res, next) => {
  if (req.session.isLoggedIn) {
    return next();
  }
  res.redirect('/auth/login');
};

// Hiển thị form đăng nhập
exports.getLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Đăng Nhập',
    errorMessage: null
  });
};

// Xử lý đăng nhập
exports.postLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Tìm người dùng với username
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.render('auth/login', {
        title: 'Đăng Nhập',
        errorMessage: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }
    
    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Đăng Nhập',
        errorMessage: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }
    
    // Thiết lập session
    req.session.isLoggedIn = true;
    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    req.session.save(err => {
      if (err) {
        console.error('Lỗi lưu session:', err);
      }
      res.redirect('/');
    });
    
  } catch (err) {
    console.error('Lỗi đăng nhập:', err);
    res.render('auth/login', {
      title: 'Đăng Nhập',
      errorMessage: 'Đã xảy ra lỗi khi đăng nhập'
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
        errorMessage: 'Mật khẩu xác nhận không khớp'
      });
    }
    
    // Kiểm tra username đã tồn tại chưa
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Đăng Ký',
        errorMessage: 'Tên đăng nhập hoặc email đã tồn tại'
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
      errorMessage: 'Đã xảy ra lỗi khi đăng ký'
    });
  }
};

// Xử lý đăng xuất
exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Lỗi khi xóa session:', err);
    }
    res.redirect('/auth/login');
  });
};

// Quản lý quyền truy cập
exports.isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Bạn không có quyền truy cập trang này');
}; 