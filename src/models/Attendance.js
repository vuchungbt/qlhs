const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  schedule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule'
  },
  // Liên kết nhiều lịch học cho nhóm điểm danh
  schedules: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule'
  }],
  // Thêm liên kết tới nhóm điểm danh
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceGroup'
  },
  date: {
    type: Date,
    required: true
  },
  students: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
      required: true
    },
    note: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Đảm bảo chỉ có một bản ghi điểm danh cho mỗi lớp học trong một ngày
attendanceSchema.index({ schedule: 1, date: 1 }, { unique: true, partialFilterExpression: { schedule: { $exists: true } } });

// Index cho nhóm điểm danh
attendanceSchema.index({ group: 1, date: 1 }, { unique: true, partialFilterExpression: { group: { $exists: true } } });

module.exports = mongoose.model('Attendance', attendanceSchema);