const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Attendance = require('../models/Attendance');
const moment = require('moment');
const Schedule = require('../models/Schedule');
const Teacher = require('../models/Teacher');

// Controller cho lịch học
exports.getSchedule = async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate('teacher', 'name')
      .populate('students', 'name class')
      .sort({ name: 1 });
    
    const teachers = await Teacher.find().sort({ name: 1 });
    const students = await Student.find().sort({ name: 1 });
    
    res.render('academic/schedule', {
      title: 'Lịch Học',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      schedules,
      teachers,
      students
    });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách lịch học:', err);
    res.status(500).send('Lỗi server');
  }
};

// Controller cho thông tin học sinh
exports.getStudents = async (req, res) => {
  try {
    // Lấy danh sách học sinh và populate thông tin phụ huynh và lịch học
    const students = await Student.find()
      .populate('parent', 'name phone address')
      .populate({
        path: 'schedules',
        select: 'name dayOfWeek startTime endTime'
      })
      .sort({ createdAt: -1 });
    
    const parents = await Parent.find().sort({ name: 1 });
    
    res.render('academic/students', {
      title: 'Thông Tin Học Sinh',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      students,
      parents
    });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách học sinh:', err);
    req.flash('error', 'Không thể tải danh sách học sinh: ' + err.message);
    res.redirect('/dashboard');
  }
};

// Controller thêm học sinh mới
exports.createStudent = async (req, res) => {
  try {
    const { name, dateOfBirth, parent, parentName, parentPhone, address } = req.body;
    
    // Chuẩn bị thông tin học sinh
    const studentData = {
      name,
      dateOfBirth: dateOfBirth || null,
      address: address || '',
      parentName: '',
      parentPhone: '',
      parent: null
    };
    
    // Nếu đã chọn phụ huynh có sẵn
    if (parent) {
      studentData.parent = parent;
    } 
    // Nếu nhập thông tin phụ huynh mới
    else if (parentName && parentPhone) {
      studentData.parentName = parentName;
      studentData.parentPhone = parentPhone;
    }
    
    // Tạo học sinh mới
    const newStudent = new Student(studentData);
    await newStudent.save();
    
    // Nếu đã chọn phụ huynh có sẵn
    if (parent) {
      await Parent.findByIdAndUpdate(
        parent,
        { $addToSet: { children: newStudent._id } }
      );
    } 
    // Nếu nhập thông tin phụ huynh mới
    else if (parentName && parentPhone) {
      // Kiểm tra xem phụ huynh đã tồn tại chưa (theo số điện thoại)
      let existingParent = await Parent.findOne({ phone: parentPhone });
      
      if (!existingParent) {
        // Tạo phụ huynh mới
        existingParent = new Parent({
          name: parentName,
          phone: parentPhone,
          address,
          children: [newStudent._id]
        });
        await existingParent.save();
      } else {
        // Cập nhật danh sách con cho phụ huynh đã tồn tại
        existingParent.children.push(newStudent._id);
        await existingParent.save();
      }
      
      // Cập nhật lại thông tin parent cho học sinh
      newStudent.parent = existingParent._id;
      await newStudent.save();
    }
    
    req.flash('success', 'Thêm học sinh thành công');
    res.redirect('/academic/students');
  } catch (err) {
    console.error('Lỗi khi thêm học sinh mới:', err);
    req.flash('error', 'Không thể thêm học sinh: ' + err.message);
    res.redirect('/academic/students');
  }
};

// Xem thông tin chi tiết học sinh
exports.getStudentDetail = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('parent')
      .populate({
        path: 'schedules',
        select: 'name dayOfWeek startTime endTime location teacher',
        populate: {
          path: 'teacher',
          select: 'name'
        }
      });
    
    if (!student) {
      return res.status(404).send('Không tìm thấy học sinh');
    }
    
    res.render('academic/student-detail', {
      title: 'Chi Tiết Học Sinh',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      student,
      moment
    });
  } catch (err) {
    console.error('Lỗi khi xem chi tiết học sinh:', err);
    res.status(500).send('Lỗi server');
  }
};

// Cập nhật thông tin học sinh
exports.updateStudent = async (req, res) => {
  try {
    const { name, dateOfBirth, parent, parentName, parentPhone, address } = req.body;
    const studentId = req.params.id;
    
    // Tìm học sinh cần cập nhật
    const student = await Student.findById(studentId);
    if (!student) {
      req.flash('error', 'Không tìm thấy học sinh');
      return res.redirect('/academic/students');
    }
    
    // Xử lý phụ huynh cũ (nếu có)
    if (student.parent) {
      await Parent.findByIdAndUpdate(
        student.parent,
        { $pull: { children: studentId } }
      );
    }
    
    // Cập nhật thông tin học sinh
    student.name = name;
    student.dateOfBirth = dateOfBirth || null;
    student.address = address || '';
    student.parentName = '';
    student.parentPhone = '';
    student.parent = null;
    
    // Nếu đã chọn phụ huynh có sẵn
    if (parent) {
      student.parent = parent;
      
      await Parent.findByIdAndUpdate(
        parent,
        { $addToSet: { children: studentId } }
      );
    } 
    // Nếu nhập thông tin phụ huynh mới
    else if (parentName && parentPhone) {
      student.parentName = parentName;
      student.parentPhone = parentPhone;
      
      // Kiểm tra xem phụ huynh đã tồn tại chưa (theo số điện thoại)
      let existingParent = await Parent.findOne({ phone: parentPhone });
      
      if (existingParent) {
        student.parent = existingParent._id;
        existingParent.children.push(studentId);
        await existingParent.save();
      }
    }
    
    await student.save();
    
    req.flash('success', 'Cập nhật học sinh thành công');
    res.redirect('/academic/students');
  } catch (err) {
    console.error('Lỗi khi cập nhật học sinh:', err);
    req.flash('error', 'Không thể cập nhật học sinh: ' + err.message);
    res.redirect('/academic/students');
  }
};

// Xóa học sinh
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy học sinh' 
      });
    }
    
    // Nếu học sinh có phụ huynh, cập nhật thông tin phụ huynh
    if (student.parent) {
      await Parent.findByIdAndUpdate(
        student.parent,
        { $pull: { children: student._id } }
      );
    }
    
    // Xóa học sinh khỏi danh sách học sinh trong các lịch học
    await Schedule.updateMany(
      { students: student._id },
      { $pull: { students: student._id } }
    );
    
    // Xóa các bản ghi điểm danh của học sinh
    await Attendance.deleteMany({ student: student._id });
    
    // Xóa học sinh
    await Student.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ 
      success: true,
      message: 'Xóa học sinh thành công'
    });
  } catch (err) {
    console.error('Lỗi khi xóa học sinh:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + err.message 
    });
  }
};

// Controller cho thông tin phụ huynh
exports.getParents = async (req, res) => {
  try {
    const parents = await Parent.find()
      .sort({ createdAt: -1 })
      .populate('children', 'name class');
    const students = await Student.find();
    
    res.render('academic/parents', {
      title: 'Thông Tin Phụ Huynh',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      parents,
      students
    });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách phụ huynh:', err);
    res.status(500).send('Lỗi server');
  }
};

// Controller thêm phụ huynh mới
exports.createParent = async (req, res) => {
  try {
    const { name, phone, email, address, occupation, children } = req.body;
    
    const newParent = new Parent({
      name,
      phone,
      email,
      address,
      occupation,
      children: Array.isArray(children) ? children : children ? [children] : []
    });
    
    await newParent.save();
    
    // Cập nhật thông tin phụ huynh cho học sinh
    if (children) {
      const childrenArray = Array.isArray(children) ? children : [children];
      await Student.updateMany(
        { _id: { $in: childrenArray } },
        { parent: newParent._id }
      );
    }
    
    res.redirect('/academic/parents');
  } catch (err) {
    console.error('Lỗi khi thêm phụ huynh mới:', err);
    res.status(500).send('Lỗi server');
  }
};

// Xem thông tin chi tiết phụ huynh
exports.getParentDetail = async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id)
      .populate({
        path: 'children',
        select: 'name dateOfBirth class address parentName parentPhone'
      });
      
    if (!parent) {
      return res.status(404).send('Không tìm thấy phụ huynh');
    }
    
    res.render('academic/parent-detail', {
      title: 'Chi Tiết Phụ Huynh',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      parent
    });
  } catch (err) {
    console.error('Lỗi khi xem chi tiết phụ huynh:', err);
    res.status(500).send('Lỗi server');
  }
};

// Form chỉnh sửa phụ huynh
exports.getEditParent = async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id)
      .populate({
        path: 'children',
        select: 'name class'
      });
    const students = await Student.find().sort({ name: 1 });
    
    if (!parent) {
      return res.status(404).send('Không tìm thấy phụ huynh');
    }
    
    res.render('academic/edit-parent', {
      title: 'Chỉnh Sửa Phụ Huynh',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      parent,
      students
    });
  } catch (err) {
    console.error('Lỗi khi lấy form chỉnh sửa phụ huynh:', err);
    res.status(500).send('Lỗi server');
  }
};

// Cập nhật thông tin phụ huynh
exports.updateParent = async (req, res) => {
  try {
    const { name, phone, email, address, occupation, children } = req.body;
    const parentId = req.params.id;
    
    // Lấy thông tin phụ huynh cũ để cập nhật quan hệ với học sinh
    const oldParent = await Parent.findById(parentId);
    if (!oldParent) {
      return res.status(404).send('Không tìm thấy phụ huynh');
    }
    
    // Cập nhật thông tin phụ huynh
    oldParent.name = name;
    oldParent.phone = phone;
    oldParent.email = email;
    oldParent.address = address;
    oldParent.occupation = occupation;
    
    // Xử lý danh sách học sinh
    const newChildren = Array.isArray(children) ? children : children ? [children] : [];
    const oldChildren = oldParent.children.map(child => child.toString());
    
    // Học sinh đã bị xóa khỏi danh sách
    const removedChildren = oldChildren.filter(child => !newChildren.includes(child));
    if (removedChildren.length > 0) {
      await Student.updateMany(
        { _id: { $in: removedChildren } },
        { $unset: { parent: "" } }
      );
    }
    
    // Học sinh mới được thêm vào danh sách
    const addedChildren = newChildren.filter(child => !oldChildren.includes(child));
    if (addedChildren.length > 0) {
      await Student.updateMany(
        { _id: { $in: addedChildren } },
        { parent: parentId }
      );
    }
    
    // Cập nhật danh sách học sinh của phụ huynh
    oldParent.children = newChildren;
    await oldParent.save();
    
    res.redirect('/academic/parents');
  } catch (err) {
    console.error('Lỗi khi cập nhật phụ huynh:', err);
    res.status(500).send('Lỗi server');
  }
};

// Xóa phụ huynh
exports.deleteParent = async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id);
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phụ huynh' });
    }
    
    // Cập nhật thông tin học sinh liên quan
    if (parent.children && parent.children.length > 0) {
      await Student.updateMany(
        { _id: { $in: parent.children } },
        { $unset: { parent: "" } }
      );
    }
    
    await Parent.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Lỗi khi xóa phụ huynh:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Controller cho điểm danh
exports.getAttendance = async (req, res) => {
  try {
    // Lấy ngày từ query params hoặc sử dụng ngày hiện tại
    const requestDate = req.query.date ? new Date(req.query.date) : new Date();
    const targetDate = moment(requestDate).startOf('day');
    
    // Lấy lớp được chọn từ query params hoặc mặc định là null
    const selectedClassId = req.query.classId || null;
    
    // Lấy danh sách tất cả các lớp học
    const schedules = await Schedule.find().sort({ name: 1 });
    
    // Lấy danh sách học sinh với thông tin lớp học
    let students = [];
    
    if (selectedClassId) {
      // Nếu có lớp được chọn, lấy học sinh của lớp đó
      const selectedSchedule = await Schedule.findById(selectedClassId).populate('students');
      students = selectedSchedule ? selectedSchedule.students : [];
    } else {
      // Nếu không chọn lớp nào, không hiển thị học sinh
      students = [];
    }
    
    // Lấy danh sách điểm danh cho ngày được chọn
    const attendance = await Attendance.find({
      date: {
        $gte: targetDate.toDate(),
        $lt: moment(targetDate).endOf('day').toDate()
      }
    }).populate('student');

    res.render('academic/attendance', {
      title: 'Điểm Danh',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      selectedDate: targetDate.toDate(),
      students,
      schedules,
      selectedClassId,
      attendance,
      moment
    });
  } catch (err) {
    console.error('Lỗi khi lấy thông tin điểm danh:', err);
    req.flash('error', 'Không thể tải danh sách điểm danh: ' + err.message);
    res.redirect('/dashboard');
  }
};

// Controller thêm điểm danh
exports.createAttendance = async (req, res) => {
  try {
    const { studentId, status, note } = req.body;
    
    // Kiểm tra xem học sinh đã được điểm danh hôm nay chưa
    const today = moment().startOf('day');
    const existingAttendance = await Attendance.findOne({
      student: studentId,
      date: {
        $gte: today.toDate(),
        $lt: moment(today).endOf('day').toDate()
      }
    });
    
    if (existingAttendance) {
      // Cập nhật điểm danh nếu đã tồn tại
      existingAttendance.status = status;
      existingAttendance.note = note;
      await existingAttendance.save();
    } else {
      // Tạo mới nếu chưa tồn tại
      const newAttendance = new Attendance({
        student: studentId,
        date: new Date(),
        status,
        note
      });
      await newAttendance.save();
    }
    
    res.redirect('/academic/attendance');
  } catch (err) {
    console.error('Lỗi khi thêm điểm danh:', err);
    res.status(500).send('Lỗi server');
  }
};

// Điểm danh hàng loạt (batch)
exports.batchAttendance = async (req, res) => {
  try {
    const { date, attendances } = req.body;
    
    if (!date || !attendances || !Array.isArray(attendances)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
    }
    
    const results = [];
    
    // Xử lý từng bản ghi điểm danh
    for (const attendance of attendances) {
      const { studentId, status, note } = attendance;
      
      // Kiểm tra xem đã có điểm danh cho học sinh này vào ngày này chưa
      const existingAttendance = await Attendance.findOne({
        student: studentId,
        date: new Date(date)
      });
      
      if (existingAttendance) {
        // Cập nhật điểm danh đã tồn tại
        existingAttendance.status = status;
        existingAttendance.note = note;
        await existingAttendance.save();
        results.push({ studentId, updated: true });
      } else {
        // Tạo bản ghi điểm danh mới
        const newAttendance = new Attendance({
          student: studentId,
          date: new Date(date),
          status,
          note
        });
        await newAttendance.save();
        results.push({ studentId, created: true });
      }
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Điểm danh đã được lưu thành công',
      results
    });
  } catch (err) {
    console.error('Lỗi khi lưu điểm danh hàng loạt:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Lấy thông tin học sinh qua API (cho form chỉnh sửa)
exports.getStudentData = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('parent', 'name phone');
    
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy học sinh' 
      });
    }
    
    res.json({
      success: true,
      student: {
        _id: student._id,
        name: student.name,
        dateOfBirth: student.dateOfBirth,
        class: student.class,
        parent: student.parent ? student.parent._id : null,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        address: student.address
      }
    });
  } catch (err) {
    console.error('Lỗi khi lấy thông tin học sinh:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + err.message 
    });
  }
}; 