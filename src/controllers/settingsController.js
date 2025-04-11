const User = require('../models/User');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Hiển thị trang thiết lập tài khoản
exports.getAccount = async (req, res) => {
  try {
    // Lấy thông tin user đầy đủ từ database
    const user = await User.findById(req.session.user._id);
    
    if (!user) {
      return res.redirect('/auth/login');
    }
    
    res.render('settings/account', {
      title: 'Thiết Lập Tài Khoản',
      username: user.username,
      currentDate: new Date(),
      user: user,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (err) {
    console.error('Lỗi khi lấy thông tin tài khoản:', err);
    res.status(500).send('Lỗi server');
  }
};

// Cập nhật thông tin tài khoản
exports.updateAccount = async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword, confirmPassword } = req.body;
    
    // Lấy thông tin user hiện tại
    const user = await User.findById(req.session.user._id);
    
    if (!user) {
      req.flash('error', 'Không tìm thấy thông tin người dùng');
      return res.redirect('/settings/account');
    }
    
    // Cập nhật thông tin cơ bản
    user.username = username;
    user.email = email;
    
    // Xử lý upload avatar nếu có
    if (req.file) {
      // Nếu đã có avatar cũ, xóa file
      if (user.profileImage && fs.existsSync(path.join(__dirname, '..', 'public', user.profileImage))) {
        fs.unlinkSync(path.join(__dirname, '..', 'public', user.profileImage));
      }
      
      // Cập nhật đường dẫn avatar mới
      user.profileImage = '/uploads/avatars/' + req.file.filename;
    }
    
    // Xử lý thay đổi mật khẩu nếu cung cấp
    if (currentPassword && newPassword) {
      // Kiểm tra mật khẩu hiện tại
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      
      if (!isMatch) {
        req.flash('error', 'Mật khẩu hiện tại không đúng');
        return res.redirect('/settings/account');
      }
      
      // Kiểm tra mật khẩu mới và xác nhận
      if (newPassword !== confirmPassword) {
        req.flash('error', 'Mật khẩu xác nhận không khớp');
        return res.redirect('/settings/account');
      }
      
      // Hash mật khẩu mới
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
    }
    
    // Lưu các thay đổi
    await user.save();
    
    // Cập nhật thông tin trong session
    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    req.flash('success', 'Thông tin tài khoản đã được cập nhật thành công');
    res.redirect('/settings/account');
  } catch (err) {
    console.error('Lỗi khi cập nhật tài khoản:', err);
    req.flash('error', 'Đã xảy ra lỗi khi cập nhật thông tin tài khoản');
    res.redirect('/settings/account');
  }
};

// Hiển thị trang thiết lập thông báo
exports.getNotifications = async (req, res) => {
  try {
    // Lấy thông tin user đầy đủ từ database
    const user = await User.findById(req.session.user._id);
    
    if (!user) {
      return res.redirect('/auth/login');
    }
    
    res.render('settings/notifications', {
      title: 'Thiết Lập Thông Báo',
      username: user.username,
      currentDate: new Date(),
      user: user,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (err) {
    console.error('Lỗi khi lấy thiết lập thông báo:', err);
    res.status(500).send('Lỗi server');
  }
};

// Cập nhật thiết lập thông báo
exports.updateNotifications = async (req, res) => {
  try {
    const {
      emailNotifications,
      browserNotifications,
      smsNotifications,
      attendanceNotifications,
      scheduleNotifications,
      systemNotifications
    } = req.body;
    
    // Lấy thông tin user hiện tại
    const user = await User.findById(req.session.user._id);
    
    if (!user) {
      req.flash('error', 'Không tìm thấy thông tin người dùng');
      return res.redirect('/settings/notifications');
    }
    
    // Cập nhật thiết lập thông báo
    user.notificationPreferences = {
      email: !!emailNotifications,
      browser: !!browserNotifications,
      sms: !!smsNotifications,
      types: {
        attendance: !!attendanceNotifications,
        schedule: !!scheduleNotifications,
        system: !!systemNotifications
      }
    };
    
    // Lưu các thay đổi
    await user.save();
    
    req.flash('success', 'Thiết lập thông báo đã được cập nhật thành công');
    res.redirect('/settings/notifications');
  } catch (err) {
    console.error('Lỗi khi cập nhật thiết lập thông báo:', err);
    req.flash('error', 'Đã xảy ra lỗi khi cập nhật thiết lập thông báo');
    res.redirect('/settings/notifications');
  }
}; 