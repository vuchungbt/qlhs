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

// Import controllers
const homeController = require('./controllers/homeController');
const authController = require('./controllers/authController');

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
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/school_dashboard' }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Middleware để làm sẵn thông tin người dùng cho views
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.user = req.session.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/academic', authController.isAuthenticated, academicRoutes);
app.use('/administrative', authController.isAuthenticated, administrativeRoutes);
app.use('/settings', authController.isAuthenticated, settingsRoutes);

// Global search
app.get('/search', authController.isAuthenticated, homeController.search);

// Home route
app.get('/', authController.isAuthenticated, homeController.getDashboard);

// Xử lý 404
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Không tìm thấy trang',
    username: req.session.user ? req.session.user.username : 'Người dùng',
    currentDate: new Date()
  });
});

// Xử lý lỗi server
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('500', {
    title: 'Lỗi server',
    username: req.session.user ? req.session.user.username : 'Người dùng',
    currentDate: new Date(),
    error: err.message
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});