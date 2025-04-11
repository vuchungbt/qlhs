const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  dayOfWeek: {
    type: [String],
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  location: {
    type: String,
    default: 'Phòng học chính'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hàm ảo để lấy thông tin lịch học hiển thị
scheduleSchema.virtual('scheduleDisplay').get(function() {
  return this.dayOfWeek.join(' & ');
});

// Hàm ảo để lấy thông tin thời gian hiển thị
scheduleSchema.virtual('timeDisplay').get(function() {
  return `${this.startTime} - ${this.endTime}`;
});

// Cấu hình để include các trường ảo khi chuyển sang JSON
scheduleSchema.set('toJSON', { virtuals: true });
scheduleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Schedule', scheduleSchema); 