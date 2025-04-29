const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const flash = require('connect-flash');
require('dotenv').config();

// Import routes
const academicRoutes = require('./routes/academic');
const administrativeRoutes = require('./routes/administrative');
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const teacherRoutes = require('./routes/teacher');
const adminRoutes = require('./routes/admin');

// Import controllers
const homeController = require('./controllers/homeController');
const authController = require('./controllers/authController');
const backupController = require('./controllers/backupController');

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/school_dashboard')
  .then(() => console.log('Đã kết nối với MongoDB'))
  .catch(err => console.error('Lỗi kết nối MongoDB:', err));

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/bootstrap', express.static(path.join(__dirname, '../node_modules/bootstrap/dist')));
app.use('/icons', express.static(path.join(__dirname, '../node_modules/bootstrap-icons/font')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Flash messages
app.use(flash());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'school_dashboard_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/school_dashboard',
    ttl: 24 * 60 * 60, // 1 day
    autoRemove: 'native', // Sử dụng cơ chế tự động xóa của MongoDB
    touchAfter: 24 * 3600 // Chỉ cập nhật session mỗi 24h thay vì mỗi request
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  }
}));

// Middleware để làm sẵn thông tin người dùng cho views
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.user = req.session.user;
  res.locals.userType = req.session.userType;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/teacher', teacherRoutes);
app.use('/academic', authController.isAuthenticated, academicRoutes);
app.use('/administrative', authController.isAuthenticated, administrativeRoutes);
app.use('/settings', authController.isAuthenticated, settingsRoutes);
app.use('/admin', adminRoutes);

// Global search
app.get('/search', authController.isAuthenticated, homeController.search);

// Home route
app.get('/', (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect('/auth/login');
  }
  
  // Chuyển hướng dựa vào loại người dùng
  if (req.session.userType === 'teacher') {
    return res.redirect('/teacher/dashboard');
  } else {
    return res.redirect('/dashboard');
  }
});

app.get('/dashboard', authController.isAuthenticated, authController.isAdmin, homeController.getDashboard);

// Xử lý 404
app.use((req, res) => {
  const username = req.session && req.session.user ? req.session.user.username : 'Người dùng';
  res.status(404).render('404', {
    title: 'Không tìm thấy trang',
    username: username,
    currentDate: new Date()
  });
});

// Xử lý lỗi server
app.use((err, req, res, next) => {
  console.error(err.stack);
  const username = req.session && req.session.user ? req.session.user.username : 'Người dùng';
  res.status(500).render('500', {
    title: 'Lỗi server',
    username: username,
    currentDate: new Date(),
    error: err.message
  });
});

// Thiết lập backup tự động
const scheduleBackupCheck = () => {
  // Kiểm tra và thực hiện backup mỗi 12 giờ
  setInterval(async () => {
    await backupController.checkAndRunAutoBackup();
  }, 12 * 60 * 60 * 1000); // 12 giờ
  
  // Kiểm tra ngay khi khởi động server
  backupController.checkAndRunAutoBackup();
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
  scheduleBackupCheck();
});