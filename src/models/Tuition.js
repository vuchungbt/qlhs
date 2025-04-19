const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TuitionSchema = new Schema({
    student: {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    schedule: {
        type: Schema.Types.ObjectId,
        ref: 'Schedule'
    },
    name: {
        type: String,
        default: 'Học phí'
    },
    amount: {
        type: Number,
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'overdue'],
        default: 'pending'
    },
    paymentDate: {
        type: Date
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'transfer', 'card', 'other'],
        default: 'cash'
    },
    note: {
        type: String
    },
    academicYear: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Virtual để kiểm tra nếu học phí quá hạn
TuitionSchema.virtual('isOverdue').get(function() {
    if (this.status === 'paid') return false;
    return new Date() > this.dueDate;
});

// Middleware trước khi lưu để cập nhật trạng thái overdue
TuitionSchema.pre('save', function(next) {
    const currentDate = new Date();
    if (this.status === 'pending' && this.dueDate < currentDate) {
        this.status = 'overdue';
    }
    next();
});

// Phương thức tính toán khoản học phí còn nợ (nếu đã thanh toán một phần)
TuitionSchema.methods.getRemainingAmount = function() {
  // Logic tính toán khoản còn lại nếu cần thiết
  return this.status === 'paid' ? 0 : this.amount;
};

// Hàm tĩnh để lấy tất cả khoản học phí còn nợ
TuitionSchema.statics.getAllDueTuition = async function() {
  const now = new Date();
  return this.find({
    status: 'pending',
    dueDate: { $lt: now }
  }).populate('student').populate('schedule');
};

// Hàm tĩnh tìm khoản học phí theo tháng, năm và học sinh
TuitionSchema.statics.findMonthlyTuition = async function(studentId, month, year) {
  return this.findOne({
    student: studentId,
    month: month,
    year: year
  }).populate('student').populate('schedule');
};

module.exports = mongoose.model('Tuition', TuitionSchema); 