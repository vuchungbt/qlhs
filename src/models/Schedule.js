const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ScheduleSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  teacher: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  students: [{
    type: Schema.Types.ObjectId,
    ref: 'Student'
  }],
  days: {
    type: [String],
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  dayOfWeek: {
    type: [String] // Tương thích với phiên bản cũ
  },
  time: {
    start: {
      type: String,
      required: true
    },
    end: {
      type: String,
      required: true
    }
  },
  startTime: {
    type: String
  },
  endTime: {
    type: String
  },
  room: {
    type: String
  },
  location: {
    type: String
  },
  academicYear: {
    type: String
  },
  tuitionAmount: {
    type: Number,
    default: 0
  },
  tuitionDueDay: {
    type: Number,
    min: 1,
    max: 31,
    default: 10
  },
  active: {
    type: Boolean,
    default: true
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
ScheduleSchema.virtual('scheduleDisplay').get(function() {
  if (this.days && this.days.length > 0) {
    return this.days.join(' & ');
  }
  if (this.dayOfWeek && this.dayOfWeek.length > 0) {
    return this.dayOfWeek.join(' & ');
  }
  return 'Chưa có lịch';
});

// Hàm ảo để lấy thông tin thời gian hiển thị
ScheduleSchema.virtual('timeDisplay').get(function() {
  if (this.time && this.time.start && this.time.end) {
    return `${this.time.start} - ${this.time.end}`;
  }
  if (this.startTime && this.endTime) {
    return `${this.startTime} - ${this.endTime}`;
  }
  return 'Chưa có thời gian';
});

// Cấu hình để include các trường ảo khi chuyển sang JSON
ScheduleSchema.set('toJSON', { virtuals: true });
ScheduleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Schedule', ScheduleSchema); 