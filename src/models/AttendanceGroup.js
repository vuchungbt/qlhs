const mongoose = require('mongoose');

const attendanceGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  // Có thể gồm nhiều lớp học
  schedules: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule'
  }],
  // Danh sách học sinh được chọn từ nhiều lớp
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Đảm bảo không có nhóm trùng tên cho một giáo viên
attendanceGroupSchema.index({ name: 1, teacher: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceGroup', attendanceGroupSchema); 