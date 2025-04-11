const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Student = require('./models/Student');
const Parent = require('./models/Parent');
const Teacher = require('./models/Teacher');
require('dotenv').config();

// Kết nối tới MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/school_dashboard')
  .then(() => console.log('Đã kết nối với MongoDB'))
  .catch(err => console.error('Lỗi kết nối MongoDB:', err));

// Xóa dữ liệu cũ
const clearDatabase = async () => {
  try {
    await User.deleteMany({});
    await Student.deleteMany({});
    await Parent.deleteMany({});
    await Teacher.deleteMany({});
    console.log('Đã xóa dữ liệu cũ');
  } catch (error) {
    console.error('Lỗi khi xóa dữ liệu cũ:', error);
  }
};

// Tạo dữ liệu người dùng mẫu
const createUsers = async () => {
  try {
    const users = [
      {
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      },
      {
        username: 'teacher',
        email: 'teacher@example.com',
        password: 'teacher123',
        role: 'teacher'
      },
      {
        username: 'parent',
        email: 'parent@example.com',
        password: 'parent123',
        role: 'parent'
      }
    ];

    // Sử dụng model User sẽ tự động hash mật khẩu nhờ middleware pre save
    for (const userData of users) {
      const user = new User(userData);
      await user.save();
    }

    console.log('Đã tạo dữ liệu người dùng mẫu');
  } catch (error) {
    console.error('Lỗi khi tạo dữ liệu người dùng:', error);
  }
};

// Tạo dữ liệu giáo viên mẫu
const createTeachers = async () => {
  try {
    const teachers = [
      {
        name: 'Nguyễn Văn A',
        subject: 'Toán',
        email: 'teacher@example.com',
        phone: '0123456789'
      },
      {
        name: 'Trần Thị B',
        subject: 'Văn',
        email: 'teacher2@example.com',
        phone: '0987654321'
      },
      {
        name: 'Lê Văn C',
        subject: 'Tiếng Anh',
        email: 'teacher3@example.com',
        phone: '0369852147'
      }
    ];

    for (const teacherData of teachers) {
      const teacher = new Teacher(teacherData);
      await teacher.save();
    }

    console.log('Đã tạo dữ liệu giáo viên mẫu');
  } catch (error) {
    console.error('Lỗi khi tạo dữ liệu giáo viên:', error);
  }
};

// Tạo dữ liệu phụ huynh mẫu
const createParents = async () => {
  try {
    const parents = [
      {
        name: 'Phạm Văn X',
        phone: '0123456789',
        email: 'parent1@example.com',
        address: 'Số 1, Đường ABC, Quận 1, TP.HCM',
        occupation: 'Kỹ sư'
      },
      {
        name: 'Ngô Thị Y',
        phone: '0987654321',
        email: 'parent2@example.com',
        address: 'Số 2, Đường DEF, Quận 2, TP.HCM',
        occupation: 'Giáo viên'
      },
      {
        name: 'Hoàng Văn Z',
        phone: '0369852147',
        email: 'parent3@example.com',
        address: 'Số 3, Đường GHI, Quận 3, TP.HCM',
        occupation: 'Bác sĩ'
      }
    ];

    const createdParents = [];
    for (const parentData of parents) {
      const parent = new Parent(parentData);
      await parent.save();
      createdParents.push(parent);
    }

    console.log('Đã tạo dữ liệu phụ huynh mẫu');
    return createdParents;
  } catch (error) {
    console.error('Lỗi khi tạo dữ liệu phụ huynh:', error);
    return [];
  }
};

// Tạo dữ liệu học sinh mẫu
const createStudents = async (parents) => {
  try {
    if (!parents || parents.length === 0) {
      console.error('Không có dữ liệu phụ huynh để liên kết với học sinh');
      return;
    }

    const students = [
      {
        name: 'Phạm Văn An',
        dateOfBirth: new Date('2015-05-10'),
        class: 'Lớp thứ 2-4',
        parentName: parents[0].name,
        parentPhone: parents[0].phone,
        address: parents[0].address,
        parent: parents[0]._id
      },
      {
        name: 'Ngô Thị Bình',
        dateOfBirth: new Date('2014-08-15'),
        class: 'Lớp thứ 3-5',
        parentName: parents[1].name,
        parentPhone: parents[1].phone,
        address: parents[1].address,
        parent: parents[1]._id
      },
      {
        name: 'Hoàng Văn Cường',
        dateOfBirth: new Date('2015-02-20'),
        class: 'Lớp thứ 2-4',
        parentName: parents[2].name,
        parentPhone: parents[2].phone,
        address: parents[2].address,
        parent: parents[2]._id
      },
      {
        name: 'Lê Thị Dung',
        dateOfBirth: new Date('2014-11-25'),
        class: 'Lớp thứ 3-5',
        parentName: parents[0].name,
        parentPhone: parents[0].phone,
        address: parents[0].address,
        parent: parents[0]._id
      }
    ];

    const createdStudents = [];
    for (const studentData of students) {
      const student = new Student(studentData);
      await student.save();
      createdStudents.push(student);
    }

    // Cập nhật lại danh sách học sinh cho phụ huynh
    await Parent.findByIdAndUpdate(
      parents[0]._id,
      { children: [createdStudents[0]._id, createdStudents[3]._id] }
    );
    await Parent.findByIdAndUpdate(
      parents[1]._id,
      { children: [createdStudents[1]._id] }
    );
    await Parent.findByIdAndUpdate(
      parents[2]._id,
      { children: [createdStudents[2]._id] }
    );

    console.log('Đã tạo dữ liệu học sinh mẫu');
  } catch (error) {
    console.error('Lỗi khi tạo dữ liệu học sinh:', error);
  }
};

// Thực thi quá trình tạo dữ liệu mẫu
const seedDatabase = async () => {
  try {
    await clearDatabase();
    await createUsers();
    await createTeachers();
    const parents = await createParents();
    await createStudents(parents);
    
    console.log('Đã hoàn thành việc tạo dữ liệu mẫu!');
    console.log('=== Thông tin đăng nhập ===');
    console.log('Admin: admin / admin123');
    console.log('Giáo viên: teacher / teacher123');
    console.log('Phụ huynh: parent / parent123');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Lỗi khi tạo dữ liệu mẫu:', error);
    mongoose.connection.close();
  }
};

seedDatabase(); 