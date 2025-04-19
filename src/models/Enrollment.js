const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EnrollmentSchema = new Schema({
    student: {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    class: {
        type: Schema.Types.ObjectId,
        ref: 'Schedule',
        required: true
    },
    enrollmentDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'completed', 'withdrawn'],
        default: 'active'
    },
    academicYear: {
        type: String
    },
    semester: {
        type: String
    },
    note: {
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

// Virtual để kiểm tra nếu ghi danh còn hoạt động
EnrollmentSchema.virtual('isActive').get(function() {
    return this.status === 'active';
});

// Middleware trước khi lưu để cập nhật ngày
EnrollmentSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Phương thức tìm tất cả ghi danh đang hoạt động của một học sinh
EnrollmentSchema.statics.findActiveEnrollments = async function(studentId) {
    return this.find({
        student: studentId,
        status: 'active'
    }).populate('class').populate('student');
};

// Phương thức tìm tất cả ghi danh trong một lớp
EnrollmentSchema.statics.findClassEnrollments = async function(classId) {
    return this.find({
        class: classId
    }).populate('student');
};

// Phương thức đếm số lượng học sinh đang học trong một lớp
EnrollmentSchema.statics.countActiveStudentsInClass = async function(classId) {
    return this.countDocuments({
        class: classId,
        status: 'active'
    });
};

// Phương thức lấy số lượng học sinh trong nhiều lớp
EnrollmentSchema.statics.countActiveStudentsInClasses = async function(classIds) {
    const result = await this.aggregate([
        {
            $match: {
                class: { $in: classIds.map(id => new mongoose.Types.ObjectId(id)) },
                status: 'active'
            }
        },
        {
            $group: {
                _id: '$class',
                count: { $sum: 1 }
            }
        }
    ]);
    
    // Chuyển kết quả thành đối tượng với classId là key và count là value
    const counts = {};
    result.forEach(item => {
        counts[item._id.toString()] = item.count;
    });
    
    return counts;
};

module.exports = mongoose.model('Enrollment', EnrollmentSchema); 