module.exports = {
  // Middleware xác thực người dùng đã đăng nhập
  ensureAuthenticated: function(req, res, next) {
    if (req.session.isLoggedIn) {
      return next();
    }
    
    // Nếu người dùng chưa đăng nhập, chuyển hướng về trang đăng nhập
    req.flash('error', 'Vui lòng đăng nhập để truy cập trang này');
    res.redirect('/auth/login');
  }
}; 