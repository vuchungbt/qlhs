const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: false
  },
  parentName: {
    type: String,
    required: false
  },
  parentPhone: {
    type: String,
    required: false
  },
  address: {
    type: String,
    required: false
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual field để lấy danh sách lớp học mà học sinh tham gia
studentSchema.virtual('schedules', {
  ref: 'Schedule',
  localField: '_id',
  foreignField: 'students'
});

// Đảm bảo các trường ảo được bao gồm khi chuyển đổi sang JSON
studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);