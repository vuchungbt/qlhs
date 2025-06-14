const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const teacherSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: false,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  profileImage: {
    type: String,
    required: false
  }
});

// Phương thức so sánh mật khẩu
teacherSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Teacher', teacherSchema);