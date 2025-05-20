const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Attendance = require('../models/Attendance');
const moment = require('moment');
const Schedule = require('../models/Schedule');
const Teacher = require('../models/Teacher');
const Tuition = require('../models/Tuition');
const Enrollment = require('../models/Enrollment');

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

// Form tạo học sinh mới
exports.getCreateStudentForm = async (req, res) => {
  try {
    const parents = await Parent.find().sort({ name: 1 });
    const schedules = await Schedule.find().sort({ name: 1 }).populate('teacher');
    
    res.render('academic/student-form', {
      title: 'Thêm Học Sinh Mới',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      student: {},
      parents,
      schedules,
      isNew: true
    });
  } catch (err) {
    console.error('Lỗi khi hiển thị form tạo học sinh:', err);
    req.flash('error', 'Không thể hiển thị form tạo học sinh: ' + err.message);
    res.redirect('/academic/students');
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
    const { name, dateOfBirth, parent, parentName, parentPhone, note, status, startDate, endDate } = req.body;
    const studentId = req.params.id;
    
    // Kiểm tra xem request có phải là Ajax không
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    
    // Tìm học sinh cần cập nhật
    const student = await Student.findById(studentId);
    if (!student) {
      if (isAjax) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
      }
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
    student.note = note || '';
    student.status = status || 'active';
    student.startDate = startDate || null;
    student.endDate = endDate || null;
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
    
    // Trả về JSON nếu là Ajax request
    if (isAjax) {
      return res.json({
        success: true,
        message: 'Cập nhật học sinh thành công',
        student: student
      });
    }
    
    req.flash('success', 'Cập nhật học sinh thành công');
    res.redirect('/academic/students');
  } catch (err) {
    console.error('Lỗi khi cập nhật học sinh:', err);
    
    // Trả về lỗi dạng JSON nếu là Ajax request
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(500).json({ 
        success: false, 
        message: 'Không thể cập nhật học sinh: ' + err.message 
      });
    }
    
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
      const selectedSchedule = await Schedule.findById(selectedClassId).populate({
        path: 'students',
        match: { status: 'active' } // Chỉ lấy học sinh có trạng thái 'active'
      });
      students = selectedSchedule ? selectedSchedule.students : [];
      console.log(`Đã lọc học sinh active cho lớp ${selectedClassId}: ${students.length} học sinh`);
    } else {
      // Nếu không chọn lớp nào, không hiển thị học sinh
      students = [];
    }
    
    // Lấy danh sách điểm danh cho ngày được chọn
    const attendanceRecords = await Attendance.find({
      date: {
        $gte: targetDate.toDate(),
        $lt: moment(targetDate).endOf('day').toDate()
      }
    })
    .populate({
      path: 'students.student',
      model: 'Student',
      select: 'name'
    })
    .populate('schedule', 'name');

    // Chuyển đổi dữ liệu điểm danh để phù hợp với view
    const attendance = [];
    attendanceRecords.forEach(record => {
      record.students.forEach(studentAttendance => {
        attendance.push({
          _id: record._id,
          date: record.date,
          schedule: record.schedule,
          student: studentAttendance.student,
          status: studentAttendance.status,
          note: studentAttendance.note || ''
        });
      });
    });
    
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
    const { studentId, scheduleId, status, note } = req.body;
    
    // Kiểm tra xem học sinh đã được điểm danh hôm nay chưa
    const today = moment().startOf('day');
    const existingAttendance = await Attendance.findOne({
      schedule: scheduleId,
      date: {
        $gte: today.toDate(),
        $lt: moment(today).endOf('day').toDate()
      }
    });
    
    if (existingAttendance) {
      // Kiểm tra xem học sinh đã có trong danh sách điểm danh chưa
      const studentIndex = existingAttendance.students.findIndex(
        s => s.student._id && s.student._id.toString() === studentId || s.student.toString() === studentId
      );

      if (studentIndex >= 0) {
        // Cập nhật thông tin điểm danh của học sinh
        existingAttendance.students[studentIndex].status = status;
        existingAttendance.students[studentIndex].note = note || '';
      } else {
        // Thêm học sinh vào danh sách điểm danh
        existingAttendance.students.push({
          student: studentId,
          status: status,
          note: note || ''
        });
      }

      existingAttendance.updatedAt = new Date();
      await existingAttendance.save();
    } else {
      // Tạo bản ghi điểm danh mới
      const newAttendance = new Attendance({
        schedule: scheduleId,
        date: new Date(),
        students: [{
          student: studentId,
          status: status,
          note: note || ''
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await newAttendance.save();
    }
    
    res.redirect('/academic/attendance');
  } catch (err) {
    console.error('Lỗi khi thêm điểm danh:', err);
    res.status(500).send('Lỗi server');
  }
};

// Điểm danh hàng loạt
exports.batchAttendance = async (req, res) => {
  try {
    const { date, classId, attendances } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!date || !attendances || !Array.isArray(attendances) || !classId) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
    }

    // Chuyển đổi ngày sang đối tượng Date
    const attendanceDate = moment(date, 'YYYY-MM-DD').startOf('day').toDate();

    // Kiểm tra nếu ngày không hợp lệ
    if (!moment(attendanceDate).isValid()) {
      return res.status(400).json({ success: false, message: 'Ngày không hợp lệ' });
    }

    console.log('Đang lưu điểm danh cho ngày:', moment(attendanceDate).format('YYYY-MM-DD'));

    // Tìm bản ghi điểm danh hiện có cho lớp và ngày
    let attendanceRecord = await Attendance.findOne({
      schedule: classId,
      date: {
        $gte: moment(attendanceDate).startOf('day').toDate(),
        $lte: moment(attendanceDate).endOf('day').toDate()
      }
    });

    if (!attendanceRecord) {
      // Tạo bản ghi điểm danh mới nếu chưa tồn tại
      attendanceRecord = new Attendance({
        schedule: classId,
        date: attendanceDate,
        students: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Cập nhật hoặc thêm mới thông tin điểm danh cho từng học sinh
    attendances.forEach(item => {
      const studentIndex = attendanceRecord.students.findIndex(
        s => s.student.toString() === item.studentId
      );

      if (studentIndex >= 0) {
        // Cập nhật thông tin điểm danh của học sinh
        attendanceRecord.students[studentIndex].status = item.status;
        attendanceRecord.students[studentIndex].note = item.note || '';
      } else {
        // Thêm học sinh vào danh sách điểm danh
        attendanceRecord.students.push({
          student: item.studentId,
          status: item.status,
          note: item.note || ''
        });
      }
    });

    attendanceRecord.updatedAt = new Date();
    await attendanceRecord.save();

    res.json({ success: true, message: 'Đã lưu điểm danh thành công' });
  } catch (err) {
    console.error('Lỗi khi lưu điểm danh:', err);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
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
        parent: student.parent ? student.parent._id : null,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        address: student.address,
        status: student.status,
        startDate: student.startDate,
        endDate: student.endDate,
        note: student.note
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

// Quản lý điểm danh theo lớp
exports.getAttendanceByClass = async (req, res) => {
  try {
    console.log('Đang truy cập trang quản lý điểm danh theo lớp');
    // Lấy danh sách tất cả các lớp học
    const schedules = await Schedule.find().sort({ name: 1 });
    
    // Lấy lớp được chọn từ query params (nếu có)
    const selectedClassId = req.query.classId || null;
    
    // Lấy khoảng thời gian từ query params hoặc mặc định là tháng hiện tại
    const startDate = req.query.startDate 
      ? moment(req.query.startDate).startOf('day') 
      : moment().startOf('month');
    
    const endDate = req.query.endDate 
      ? moment(req.query.endDate).endOf('day') 
      : moment().endOf('month');
    
    // Khởi tạo attendanceRecords
    let attendanceRecords = [];
    let selectedClass = null;
    
    // Nếu có lớp được chọn, lấy lịch sử điểm danh của lớp đó
    if (selectedClassId) {
      // Lấy thông tin lớp
      selectedClass = await Schedule.findById(selectedClassId);
      
      // Lấy lịch sử điểm danh
      const attendanceDocs = await Attendance.find({
        schedule: selectedClassId,
        date: {
          $gte: startDate.toDate(),
          $lte: endDate.toDate()
        }
      })
      .populate({
        path: 'students.student',
        model: 'Student',
        select: 'name'
      })
      .populate('schedule', 'name')
      .sort({ date: -1 });

      // Chuyển đổi dữ liệu điểm danh để phù hợp với view
      attendanceRecords = [];
      attendanceDocs.forEach(record => {
        record.students.forEach(studentAttendance => {
          attendanceRecords.push({
            _id: record._id,
            date: record.date,
            schedule: record.schedule,
            student: studentAttendance.student,
            status: studentAttendance.status,
            note: studentAttendance.note || ''
          });
        });
      });
    }
    
    res.render('academic/attendance-by-class', {
      title: 'Điểm Danh Theo Lớp',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      schedules,
      selectedClassId,
      selectedClass,
      attendanceRecords,
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      moment
    });
  } catch (err) {
    console.error('Lỗi khi lấy thông tin điểm danh theo lớp:', err);
    req.flash('error', 'Không thể tải thông tin điểm danh: ' + err.message);
    res.redirect('/dashboard');
  }
};

// Xem chi tiết điểm danh theo lớp (theo ngày)
exports.getAttendanceByClassDetail = async (req, res) => {
  try {
    const classId = req.params.id;
    const dateStr = req.query.date || moment().format('YYYY-MM-DD');
    const targetDate = moment(dateStr).startOf('day');
    
    // Lấy thông tin lớp học
    const schedule = await Schedule.findById(classId)
      .populate('students', 'name status endDate') // Thêm trường status và endDate
      .populate('teacher', 'name');
    
    if (!schedule) {
      req.flash('error', 'Không tìm thấy lớp học');
      return res.redirect('/academic/attendance/class');
    }
    
    // Lấy bản ghi điểm danh của lớp vào ngày đã chọn
    const attendanceRecord = await Attendance.findOne({
      schedule: classId,
      date: {
        $gte: targetDate.toDate(),
        $lt: moment(targetDate).endOf('day').toDate()
      }
    }).populate({
      path: 'students.student',
      model: 'Student',
      select: 'name status endDate' // Thêm trường status và endDate
    });
    
    // Tạo map để tra cứu nhanh điểm danh của học sinh
    const attendanceMap = {};
    if (attendanceRecord && attendanceRecord.students) {
      attendanceRecord.students.forEach(studentAttendance => {
        attendanceMap[studentAttendance.student._id.toString()] = studentAttendance;
      });
    }
    
    // Thêm debug để kiểm tra
    console.log('Thông tin học sinh trong lớp:');
    if (schedule.students && schedule.students.length > 0) {
      schedule.students.forEach(student => {
        console.log(`- Học sinh: ${student.name}, Trạng thái: ${student.status || 'không có'}`);
      });
    }
    
    res.render('academic/attendance-class-detail', {
      title: 'Chi Tiết Điểm Danh Lớp',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      schedule,
      selectedDate: targetDate.toDate(),
      attendanceRecord,
      attendanceMap,
      moment
    });
  } catch (err) {
    console.error('Lỗi khi xem chi tiết điểm danh lớp:', err);
    req.flash('error', 'Không thể tải thông tin điểm danh: ' + err.message);
    res.redirect('/academic/attendance/class');
  }
};

// Cập nhật điểm danh
exports.updateAttendance = async (req, res) => {
  try {
    console.log('===== CẬP NHẬT ĐIỂM DANH =====');
    console.log('Body data:', req.body);
    console.log('Headers:', req.headers['content-type']);
    
    const { studentId, date, status, note, scheduleId, attendanceId } = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!studentId || !scheduleId || !status || !date) {
      console.log('Thiếu dữ liệu:', { studentId, scheduleId, status, date });
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ. Vui lòng cung cấp đủ thông tin.'
      });
    }
    
    // Chuyển đổi ngày thành đầu ngày để tránh vấn đề múi giờ
    const attendanceDate = moment(date).startOf('day').toDate();
    console.log('Ngày điểm danh:', attendanceDate);
    
    // Tìm bản ghi điểm danh cho lớp và ngày đã chọn
    let attendanceRecord;
    
    if (attendanceId) {
      console.log('Tìm bản ghi theo attendanceId:', attendanceId);
      attendanceRecord = await Attendance.findById(attendanceId);
    } else {
      console.log('Tìm bản ghi theo lớp và ngày');
      attendanceRecord = await Attendance.findOne({
        schedule: scheduleId,
        date: {
          $gte: moment(attendanceDate).startOf('day').toDate(),
          $lte: moment(attendanceDate).endOf('day').toDate()
        }
      });
    }
    
    if (attendanceRecord) {
      console.log('Đã tìm thấy bản ghi điểm danh:', attendanceRecord._id);
      // Kiểm tra xem học sinh đã có trong danh sách điểm danh chưa
      const studentIndex = attendanceRecord.students.findIndex(
        s => s.student && ((s.student._id && s.student._id.toString() === studentId) || s.student.toString() === studentId)
      );
      
      console.log('Vị trí học sinh trong mảng:', studentIndex);
      
      if (studentIndex >= 0) {
        // Cập nhật thông tin điểm danh của học sinh
        attendanceRecord.students[studentIndex].status = status;
        attendanceRecord.students[studentIndex].note = note || '';
        console.log('Đã cập nhật trạng thái cho học sinh thành:', status);
      } else {
        // Thêm học sinh vào danh sách điểm danh
        attendanceRecord.students.push({
          student: studentId,
          status: status,
          note: note || ''
        });
        console.log('Đã thêm học sinh mới vào bản ghi điểm danh');
      }
      
      attendanceRecord.updatedAt = new Date();
      await attendanceRecord.save();
      console.log('Đã lưu bản ghi điểm danh');
    } else {
      // Tạo bản ghi điểm danh mới
      console.log('Không tìm thấy bản ghi điểm danh, tạo mới');
      attendanceRecord = new Attendance({
        schedule: scheduleId,
        date: attendanceDate,
        students: [{
          student: studentId,
          status: status,
          note: note || ''
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await attendanceRecord.save();
      console.log('Đã tạo bản ghi điểm danh mới:', attendanceRecord._id);
    }
    
    res.status(200).json({
      success: true,
      message: 'Cập nhật điểm danh thành công',
      data: attendanceRecord
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật điểm danh:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server: ' + err.message
    });
  }
};

// Xóa điểm danh
exports.deleteAttendance = async (req, res) => {
  try {
    console.log('=== XÓA ĐIỂM DANH ===');
    console.log('Params ID:', req.params.id);
    console.log('Query:', req.query);
    
    const attendanceId = req.params.id;
    const studentId = req.query.studentId;
    
    // Tìm bản ghi điểm danh
    const attendance = await Attendance.findById(attendanceId);
    
    if (!attendance) {
      console.log('Không tìm thấy bản ghi điểm danh với ID:', attendanceId);
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy bản ghi điểm danh' 
      });
    }
    
    // In thông tin bản ghi điểm danh để debug
    console.log('Tìm thấy bản ghi điểm danh:');
    console.log('- ID:', attendance._id);
    console.log('- Lớp:', attendance.schedule);
    console.log('- Ngày:', attendance.date);
    console.log('- Số học sinh:', attendance.students.length);
    
    // Nếu có studentId, chỉ xóa điểm danh của học sinh cụ thể
    if (studentId) {
      console.log('Xóa điểm danh cho học sinh cụ thể:', studentId);
      
      // Tìm vị trí của học sinh trong mảng
      const studentIndex = attendance.students.findIndex(s => 
        s.student && s.student.toString() === studentId
      );
      
      console.log('Vị trí học sinh trong mảng:', studentIndex);
      
      if (studentIndex >= 0) {
        // Xóa học sinh khỏi mảng students
        attendance.students.splice(studentIndex, 1);
        console.log('Đã xóa học sinh khỏi mảng, số học sinh còn lại:', attendance.students.length);
        
        // Nếu không còn học sinh nào, xóa toàn bộ bản ghi
        if (attendance.students.length === 0) {
          await Attendance.findByIdAndDelete(attendanceId);
          console.log('Đã xóa toàn bộ bản ghi điểm danh vì không còn học sinh nào');
        } else {
          // Lưu lại bản ghi sau khi xóa học sinh
          await attendance.save();
          console.log('Đã lưu bản ghi điểm danh sau khi xóa học sinh');
        }
        
        return res.json({
          success: true,
          message: 'Đã xóa điểm danh của học sinh thành công'
        });
      } else {
        console.log('Không tìm thấy học sinh trong bản ghi điểm danh');
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy học sinh trong bản ghi điểm danh'
        });
      }
    } else {
      // Xóa toàn bộ bản ghi điểm danh
      console.log('Xóa toàn bộ bản ghi điểm danh');
      await Attendance.findByIdAndDelete(attendanceId);
      console.log('Đã xóa bản ghi điểm danh thành công');
      
      return res.json({
        success: true,
        message: 'Xóa điểm danh thành công'
      });
    }
  } catch (err) {
    console.error('Lỗi khi xóa điểm danh:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + err.message 
    });
  }
};

// Quản lý điểm danh theo học sinh
exports.getAttendanceByStudent = async (req, res) => {
  try {
    console.log('Đang truy cập trang quản lý điểm danh theo học sinh');
    // Lấy thông tin lớp từ query params
    const selectedClassId = req.query.classId || null;
    
    // Lấy thông tin học sinh từ query params
    const selectedStudentId = req.query.studentId || null;
    
    // Lấy khoảng thời gian từ query params hoặc mặc định là tháng hiện tại
    const startDate = req.query.startDate 
      ? moment(req.query.startDate).startOf('day') 
      : moment().startOf('month');
    
    const endDate = req.query.endDate 
      ? moment(req.query.endDate).endOf('day') 
      : moment().endOf('month');
    
    // Lấy danh sách lớp học
    const schedules = await Schedule.find().sort({ name: 1 });
    
    // Biến lưu danh sách học sinh
    let students = [];
    let selectedStudent = null;
    
    // Tải danh sách học sinh dựa trên lớp được chọn (nếu có)
    if (selectedClassId) {
      const schedule = await Schedule.findById(selectedClassId).populate('students');
      if (schedule && schedule.students) {
        students = schedule.students;
        // Log để debug
        console.log(`Lớp học ${selectedClassId} có ${students.length} học sinh`);
      } else {
        console.log(`Lớp học ${selectedClassId} không có học sinh hoặc không tìm thấy`);
        students = [];
      }
    } else {
      // Nếu không chọn lớp, lấy tất cả học sinh
      students = await Student.find().sort({ name: 1 });
    }
    
    // Khởi tạo attendanceRecords
    let attendanceRecords = [];
    
    // Nếu có học sinh được chọn, lấy lịch sử điểm danh
    if (selectedStudentId) {
      selectedStudent = await Student.findById(selectedStudentId);
      
      console.log(`Tìm điểm danh cho học sinh: ${selectedStudentId}, tên: ${selectedStudent?.name}`);
      console.log(`Thời gian từ: ${startDate.format('DD/MM/YYYY')} đến: ${endDate.format('DD/MM/YYYY')}`);
      
      // Xây dựng query điều kiện
      let query = {};
      
      // Cấu trúc có 2 loại:
      // 1. Attendance có trường student trực tiếp
      // 2. Attendance có mảng students chứa học sinh
      
      // Tìm trong cả hai cấu trúc dữ liệu
      query = {
        $or: [
          // Trường hợp 1: record.student trực tiếp
          {
            student: selectedStudentId,
            date: {
              $gte: startDate.toDate(),
              $lte: endDate.toDate()
            }
          },
          // Trường hợp 2: record.students là mảng các học sinh
          {
            'students.student': selectedStudentId,
            date: {
              $gte: startDate.toDate(),
              $lte: endDate.toDate()
            }
          }
        ]
      };
      
      // Nếu có lớp được chọn, thêm điều kiện lớp
      if (selectedClassId) {
        query.$or[0].schedule = selectedClassId;
        query.$or[1].schedule = selectedClassId;
      }
      
      console.log('Query điểm danh:', JSON.stringify(query, null, 2));
      
      // Lấy lịch sử điểm danh trực tiếp
      const directRecords = await Attendance.find(query.$or[0])
        .populate('schedule', 'name')
        .sort({ date: -1 });
        
      console.log(`Tìm thấy ${directRecords.length} bản ghi điểm danh trực tiếp`);
      
      // Lấy điểm danh từ mảng students
      const groupRecords = await Attendance.find(query.$or[1])
        .populate('schedule', 'name')
        .sort({ date: -1 });
        
      console.log(`Tìm thấy ${groupRecords.length} bản ghi điểm danh từ nhóm`);
      
      // Xử lý kết quả từ groupRecords
      const processedGroupRecords = [];
      
      groupRecords.forEach(record => {
        // Tìm thông tin học sinh trong mảng students
        const studentRecord = record.students.find(s => 
          s.student.toString() === selectedStudentId
        );
        
        if (studentRecord) {
          // Tạo bản ghi mới với cấu trúc tương thích
          const processedRecord = {
            _id: record._id,
            schedule: record.schedule,
            date: record.date,
            student: { _id: selectedStudentId },
            status: studentRecord.status,
            note: studentRecord.note || ''
          };
          
          processedGroupRecords.push(processedRecord);
        }
      });
      
      // Gộp kết quả từ cả hai nguồn
      attendanceRecords = [...directRecords, ...processedGroupRecords];
      console.log(`Tổng số bản ghi điểm danh: ${attendanceRecords.length}`);
    }
    
    // Tính toán thống kê điểm danh
    const stats = {
      present: 0,
      absent: 0,
      late: 0
    };
    
    // Nếu có dữ liệu điểm danh, tính toán các thống kê
    if (attendanceRecords && attendanceRecords.length > 0) {
      attendanceRecords.forEach(record => {
        if (record.status === 'present') stats.present++;
        else if (record.status === 'absent') stats.absent++;
        else if (record.status === 'late') stats.late++;
      });
    }
    
    res.render('academic/attendance-by-student', {
      title: 'Điểm Danh Theo Học Sinh',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      schedules,
      students,
      selectedClassId,
      selectedStudentId,
      selectedStudent,
      attendanceRecords,
      stats,
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      moment
    });
  } catch (err) {
    console.error('Lỗi khi lấy thông tin điểm danh theo học sinh:', err);
    req.flash('error', 'Không thể tải thông tin điểm danh: ' + err.message);
    res.redirect('/dashboard');
  }
};

// Xem chi tiết điểm danh của một học sinh
exports.getAttendanceByStudentDetail = async (req, res) => {
  try {
    const studentId = req.params.id;
    const month = req.query.month ? parseInt(req.query.month) : moment().month();
    const year = req.query.year ? parseInt(req.query.year) : moment().year();
    
    // Lấy tên tháng từ moment
    const currentMonthName = moment().month(month).format('MMMM');
    
    // Lấy thông tin học sinh
    const student = await Student.findById(studentId)
      .populate({
        path: 'schedules',
        select: 'name dayOfWeek startTime endTime'
      });
    
    if (!student) {
      req.flash('error', 'Không tìm thấy học sinh');
      return res.redirect('/academic/attendance/student');
    }
    
    // Tính khoảng thời gian (tháng được chọn)
    const startDate = moment().year(year).month(month).startOf('month');
    const endDate = moment().year(year).month(month).endOf('month');
    
    // Lấy lịch sử điểm danh của học sinh trong tháng
    const attendanceRecords = await Attendance.find({
      student: studentId,
      date: {
        $gte: startDate.toDate(),
        $lte: endDate.toDate()
      }
    })
    .populate('schedule', 'name dayOfWeek')
    .sort({ date: 1 });
    
    // Chuẩn bị dữ liệu thống kê
    const totalDays = endDate.date();
    const attendanceStats = {
      present: 0,
      absent: 0,
      late: 0,
      total: attendanceRecords.length
    };
    
    // Tạo map theo ngày để hiển thị trên lịch
    const attendanceByDay = {};
    
    attendanceRecords.forEach(record => {
      const day = moment(record.date).date();
      
      // Cập nhật thống kê
      if (record.status === 'present') attendanceStats.present++;
      else if (record.status === 'absent') attendanceStats.absent++;
      else if (record.status === 'late') attendanceStats.late++;
      
      // Lưu vào map theo ngày
      if (!attendanceByDay[day]) {
        attendanceByDay[day] = [];
      }
      attendanceByDay[day].push(record);
    });
    
    // Tạo dữ liệu lịch
    const calendarData = [];
    const firstDayOfMonth = startDate.day();
    
    // Thêm ngày trống đầu tháng
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarData.push({ day: '', isEmpty: true });
    }
    
    // Thêm các ngày trong tháng
    for (let day = 1; day <= totalDays; day++) {
      calendarData.push({
        day,
        isEmpty: false,
        attendances: attendanceByDay[day] || [],
        date: moment().year(year).month(month).date(day).format('YYYY-MM-DD')
      });
    }
    
    // Tạo dữ liệu ngày cho lịch
    const calendarDays = [];
    const today = moment();
    
    // Lấy ngày đầu tiên của tháng và danh sách tất cả các ngày
    const firstDay = moment([year, month, 1]);
    const daysInMonth = firstDay.daysInMonth();
    
    // Thêm các ngày từ tháng trước để điền vào tuần đầu tiên
    const dayOfWeekOfFirstDay = firstDay.day(); // 0 = Chủ nhật, 6 = Thứ bảy
    for (let i = 0; i < dayOfWeekOfFirstDay; i++) {
      const prevMonthDay = moment(firstDay).subtract(dayOfWeekOfFirstDay - i, 'days');
      calendarDays.push({
        date: prevMonthDay.toDate(),
        currentMonth: false,
        isToday: prevMonthDay.isSame(today, 'day'),
        attendance: null
      });
    }
    
    // Thêm các ngày trong tháng
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = moment([year, month, i]);
      const dateStr = currentDate.format('YYYY-MM-DD');
      
      // Tìm bản ghi điểm danh cho ngày này
      const dayAttendance = attendanceRecords.find(record => 
        moment(record.date).format('YYYY-MM-DD') === dateStr
      );
      
      calendarDays.push({
        date: currentDate.toDate(),
        currentMonth: true,
        isToday: currentDate.isSame(today, 'day'),
        attendance: dayAttendance || null
      });
    }
    
    // Thêm các ngày từ tháng sau để điền đủ lịch
    const lastDayOfMonth = moment([year, month, daysInMonth]);
    const dayOfWeekOfLastDay = lastDayOfMonth.day();
    const daysToAdd = 6 - dayOfWeekOfLastDay;
    
    for (let i = 1; i <= daysToAdd; i++) {
      const nextMonthDay = moment(lastDayOfMonth).add(i, 'days');
      calendarDays.push({
        date: nextMonthDay.toDate(),
        currentMonth: false,
        isToday: nextMonthDay.isSame(today, 'day'),
        attendance: null
      });
    }
    
    res.render('academic/attendance-student-detail', {
      title: 'Chi Tiết Điểm Danh Học Sinh',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      student,
      month,
      year,
      calendarData,
      calendarDays,
      attendanceStats,
      attendanceRecords,
      filteredAttendance: attendanceRecords,
      stats: attendanceStats,
      moment,
      currentMonthName,
      currentYear: year,
      currentMonth: month
    });
  } catch (err) {
    console.error('Lỗi khi xem chi tiết điểm danh học sinh:', err);
    req.flash('error', 'Không thể tải thông tin điểm danh: ' + err.message);
    res.redirect('/academic/attendance/student');
  }
};

// Tuition Management
exports.getTuition = async (req, res) => {
  try {
    // Lấy tháng/năm từ query params hoặc sử dụng tháng hiện tại
    const selectedMonth = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;
    const selectedYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    // Tính toán khoảng thời gian
    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0);

    // Lấy danh sách học phí
    const tuitions = await Tuition.find({
      dueDate: {
        $gte: startDate,
        $lte: endDate
      }
    })
    .populate('student')
    .populate('schedule')
    .sort({ dueDate: 1 });
    
    // Lấy danh sách học sinh và lớp học (populate teacher)
    const students = await Student.find({}).sort({ name: 1 });
    const schedules = await Schedule.find({}).populate('teacher').sort({ name: 1 });
    
    // Tính số lượng học sinh thực tế cho mỗi lớp từ Enrollment
    for (let schedule of schedules) {
      const enrollments = await Enrollment.find({
        class: schedule._id,
        status: 'active'
      });
      
      schedule.studentCount = enrollments.length;
      console.log(`Số học sinh trong lớp ${schedule.name} (từ Enrollment): ${schedule.studentCount}`);
    }
    
    // Tính toán thống kê học phí
    const stats = {
      totalAmount: tuitions.reduce((sum, t) => sum + (t.amount || 0), 0),
      paidAmount: tuitions.filter(t => t.status === 'paid').reduce((sum, t) => sum + (t.amount || 0), 0),
      pendingAmount: tuitions.filter(t => t.status === 'pending').reduce((sum, t) => sum + (t.amount || 0), 0),
      overdueAmount: tuitions.filter(t => t.status === 'overdue').reduce((sum, t) => sum + (t.amount || 0), 0),
      paidCount: tuitions.filter(t => t.status === 'paid').length,
      pendingCount: tuitions.filter(t => t.status === 'pending').length,
      overdueCount: tuitions.filter(t => t.status === 'overdue').length
    };
    
    // Truyền thông tin người dùng vào template
    const userInfo = {
      user: req.session.user,
      username: req.session.user ? req.session.user.username : 'Người dùng',
      isAuthenticated: req.session.isLoggedIn || false,
      userType: req.session.userType || ''
    };
    
    console.log('Thông tin người dùng truyền vào template:', userInfo);
    
    res.render('academic/tuition', {
      tuitions,
      students,
      schedules,
      stats,
      selectedMonth,
      selectedYear,
      title: 'Quản lý học phí',
      currentYear: new Date().getFullYear(),
      error: req.flash('error'),
      success: req.flash('success'),
      currentDate: new Date(),
      // Thông tin người dùng
      user: req.session.user,
      username: req.session.user ? req.session.user.username : 'Người dùng',
      isAuthenticated: req.session.isLoggedIn || false,
      userType: req.session.userType || ''
    });
  } catch (error) {
    console.error('Lỗi khi tải trang học phí:', error);
    req.flash('error', 'Có lỗi khi tải trang học phí');
    res.redirect('/dashboard');
  }
};

exports.addTuition = async (req, res) => {
  try {
    const { studentId, scheduleId, name, amount, dueDate, note, academicYear } = req.body;
    
    if (!studentId || !amount || !dueDate) {
      req.flash('error_msg', 'Vui lòng điền đầy đủ thông tin học phí');
      return res.redirect('/academic/tuition');
    }

    const newTuition = new Tuition({
      student: studentId,
      schedule: scheduleId || null,
      name,
      amount,
      dueDate,
      status: 'pending',
      note,
      academicYear
    });

    await newTuition.save();
    req.flash('success_msg', 'Đã thêm thông tin học phí thành công');
    res.redirect('/academic/tuition');
  } catch (error) {
    console.error('Lỗi khi thêm học phí:', error);
    req.flash('error_msg', 'Có lỗi khi thêm thông tin học phí');
    res.redirect('/academic/tuition');
  }
};

exports.updateTuition = async (req, res) => {
  try {
    // Log để debug
    console.log('updateTuition - Dữ liệu nhận được:', req.body);
    
    const { tuitionId, amount, month, year, status, notes, paymentDate, paymentMethod } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!tuitionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu ID học phí cần chỉnh sửa' 
      });
    }

    // Tìm bản ghi học phí
    const tuition = await Tuition.findById(tuitionId);
    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi học phí' });
    }

    // Kiểm tra nếu chỉ cập nhật ghi chú (chỉ có tuitionId và notes trong request)
    const isOnlyNotesUpdate = Object.keys(req.body).length === 2 && tuitionId && notes !== undefined;
    
    // Kiểm tra nếu đang cập nhật trạng thái thanh toán
    const isPaymentStatusUpdate = status === 'paid' && (req.body.status || paymentDate);
    
    if (isOnlyNotesUpdate) {
      // Chỉ cập nhật ghi chú mà không thay đổi các trường khác
      tuition.notes = notes;
      console.log('Chỉ cập nhật ghi chú, giữ nguyên trạng thái:', tuition.status);
    } else {
      // Cập nhật thông tin học phí
      if (amount && !isNaN(parseFloat(amount))) {
        tuition.amount = parseFloat(amount);
      }
      
      if (month && !isNaN(parseInt(month))) {
        tuition.month = parseInt(month);
      }
      
      if (year && !isNaN(parseInt(year))) {
        tuition.year = parseInt(year);
      }
      
      // Cập nhật ghi chú nếu có
      if (notes !== undefined) {
        tuition.notes = notes;
      }
      
      // Cập nhật trạng thái nếu được cung cấp
      if (status && ['pending', 'partial', 'paid', 'overdue'].includes(status)) {
        tuition.status = status;
        
        // Nếu đánh dấu là paid và có paymentDate, cập nhật ngày thanh toán
        if (status === 'paid' && paymentDate) {
          tuition.paymentDate = new Date(paymentDate);
        }
        
        // Nếu đánh dấu là paid và có paymentMethod, cập nhật phương thức thanh toán
        if (status === 'paid' && paymentMethod) {
          tuition.paymentMethod = paymentMethod;
        }
        
        console.log('Đã cập nhật trạng thái thành:', status);
      } else if (!isPaymentStatusUpdate) {
        // Nếu không phải là cập nhật trạng thái thanh toán, mới thực hiện logic tự động cập nhật trạng thái
        if (tuition.amountPaid >= tuition.amount) {
          tuition.status = 'paid';
        } else if (tuition.amountPaid > 0) {
          tuition.status = 'partial';
        } else if (new Date() > new Date(tuition.dueDate)) {
          tuition.status = 'overdue';
        } else {
          tuition.status = 'pending';
        }
      }
    }

    // Lưu bản ghi học phí
    await tuition.save();
    
    // Log thông tin sau khi lưu để debug
    console.log('Đã cập nhật học phí:', {
      id: tuition._id,
      status: tuition.status,
      notes: tuition.notes,
      isOnlyNotesUpdate,
      paymentDate: tuition.paymentDate
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Đã cập nhật thông tin học phí thành công',
      tuition: {
        _id: tuition._id,
        amount: tuition.amount,
        status: tuition.status,
        notes: tuition.notes,
        paymentDate: tuition.paymentDate,
        paymentMethod: tuition.paymentMethod
      }
    });
  } catch (error) {
    console.error('Lỗi khi chỉnh sửa học phí:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Đã xảy ra lỗi: ' + (error.message || 'Lỗi không xác định')
    });
  }
};

exports.deleteTuition = async (req, res) => {
  try {
    const { tuitionId } = req.body;
    
    if (!tuitionId) {
      // Kiểm tra nếu là yêu cầu AJAX
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(400).json({ success: false, message: 'Không tìm thấy thông tin học phí' });
      }
      
      req.flash('error_msg', 'Không tìm thấy thông tin học phí');
      return res.redirect('/academic/tuition');
    }
    
    const tuition = await Tuition.findByIdAndDelete(tuitionId);
    
    if (!tuition) {
      // Kiểm tra nếu là yêu cầu AJAX
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy học phí với ID đã cung cấp' });
      }
      
      req.flash('error_msg', 'Không tìm thấy thông tin học phí');
      return res.redirect('/academic/tuition');
    }
    
    // Kiểm tra nếu là yêu cầu AJAX
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.json({
        success: true,
        message: 'Đã xóa thông tin học phí thành công',
        deletedTuition: tuition
      });
    }
    
    // Nếu không phải AJAX request, redirect như thông thường
    req.flash('success_msg', 'Đã xóa thông tin học phí thành công');
    res.redirect('/academic/tuition');
  } catch (error) {
    console.error('Lỗi khi xóa học phí:', error);
    
    // Kiểm tra nếu là yêu cầu AJAX
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(500).json({ 
        success: false, 
        message: 'Đã xảy ra lỗi khi xóa thông tin học phí' 
      });
    }
    
    req.flash('error_msg', 'Có lỗi khi cập nhật thông tin học phí');
    res.redirect('/academic/tuition');
  }
};

exports.deleteTuitionApi = async (req, res) => {
  try {
    const tuitionId = req.params.id || req.body.tuitionId;
    
    if (!tuitionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không tìm thấy thông tin học phí' 
      });
    }
    
    const tuition = await Tuition.findByIdAndDelete(tuitionId);
    
    if (!tuition) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy học phí với ID đã cung cấp' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Đã xóa thông tin học phí thành công',
      deletedTuition: tuition
    });
  } catch (error) {
    console.error('Lỗi khi xóa học phí:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Đã xảy ra lỗi khi xóa thông tin học phí' 
    });
  }
};

exports.getTuitionByStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    const students = await Student.find({}).sort({ name: 1 });
    
    // Nếu có studentId, lấy thông tin chi tiết của học sinh đó
    if (studentId) {
      const student = await Student.findById(studentId);
      if (!student) {
        req.flash('error_msg', 'Không tìm thấy thông tin học sinh');
        return res.redirect('/academic/tuition');
      }
      
      const classes = await Schedule.find({}).sort({ name: 1 });
      
      // Lấy thông tin học phí của học sinh
      const tuitionHistory = await Tuition.find({ student: studentId })
        .populate('class')
        .sort({ dueDate: -1 });
      
      // Tính toán thống kê học phí
      const tuitionStats = {
        total: tuitionHistory.reduce((sum, t) => sum + t.amount, 0),
        paid: tuitionHistory.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.amount, 0),
        pending: tuitionHistory.filter(t => t.status === 'pending' && new Date(t.dueDate) >= new Date()).reduce((sum, t) => sum + t.amount, 0),
        overdue: tuitionHistory.filter(t => t.status === 'pending' && new Date(t.dueDate) < new Date()).reduce((sum, t) => sum + t.amount, 0)
      };
      
      return res.render('academic/tuition-by-student', {
        title: `Học phí của ${student.name}`,
        student,
        students,
        classes,
        tuitionHistory,
        tuitionStats,
        user: req.user
      });
    } else {
      // Nếu không có studentId, hiển thị trang danh sách học sinh
      res.render('academic/tuition-by-student', {
        title: 'Quản lý học phí theo học sinh',
        students,
        user: req.user,
        student: null,
        tuitionHistory: [],
        tuitionStats: { total: 0, paid: 0, pending: 0, overdue: 0 },
        classes: []
      });
    }
  } catch (error) {
    console.error('Lỗi khi tải trang quản lý học phí theo học sinh:', error);
    req.flash('error_msg', 'Có lỗi khi tải trang quản lý học phí');
    res.redirect('/dashboard');
  }
};

exports.getTuitionByStudentDetail = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    if (!studentId) {
      req.flash('error_msg', 'Không tìm thấy thông tin học sinh');
      return res.redirect('/academic/tuition-by-student');
    }

    const student = await Student.findById(studentId);
    if (!student) {
      req.flash('error_msg', 'Không tìm thấy thông tin học sinh');
      return res.redirect('/academic/tuition-by-student');
    }

    const tuitions = await Tuition.find({ student: studentId })
      .populate('schedule')
      .sort({ dueDate: 1 });
    
    // Thống kê học phí
    const tuitionStats = {
      total: tuitions.length,
      paid: tuitions.filter(t => t.status === 'paid').length,
      pending: tuitions.filter(t => t.status === 'pending').length,
      overdue: tuitions.filter(t => t.status === 'overdue').length,
      totalAmount: tuitions.reduce((sum, t) => sum + t.amount, 0),
      paidAmount: tuitions.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.amount, 0),
      pendingAmount: tuitions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0),
      overdueAmount: tuitions.filter(t => t.status === 'overdue').reduce((sum, t) => sum + t.amount, 0)
    };

    res.render('academic/tuition-student-detail', {
      title: `Học phí của ${student.name}`,
      student,
      tuitions,
      tuitionStats,
      user: req.user
    });
  } catch (error) {
    console.error('Lỗi khi tải trang chi tiết học phí học sinh:', error);
    req.flash('error_msg', 'Có lỗi khi tải trang chi tiết học phí');
    res.redirect('/academic/tuition-by-student');
  }
};

exports.recordTuitionPayment = async (req, res) => {
  try {
    const { tuitionId, amount, paymentDate, paymentMethod, notes } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!tuitionId || !amount || !paymentDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin cần thiết: ID học phí, số tiền và ngày thanh toán' 
      });
    }

    // Tìm bản ghi học phí
    const tuition = await Tuition.findById(tuitionId);
    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi học phí' });
    }

    // Chuyển đổi số tiền thanh toán
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền thanh toán không hợp lệ' });
    }

    // Tạo ghi chú thanh toán mới
    const newPayment = {
      amount: paymentAmount,
      date: new Date(paymentDate),
      method: paymentMethod || 'Tiền mặt',
      notes: notes || ''
    };

    // Cập nhật bản ghi học phí
    tuition.payments.push(newPayment);
    tuition.amountPaid += paymentAmount;

    // Cập nhật trạng thái
    if (tuition.amountPaid >= tuition.amount) {
      tuition.status = 'paid';
    } else if (tuition.amountPaid > 0) {
      tuition.status = 'partial';
    } else if (new Date() > new Date(tuition.dueDate)) {
      tuition.status = 'overdue';
    } else {
      tuition.status = 'pending';
    }

    // Lưu bản ghi học phí
    await tuition.save();

    return res.status(200).json({ 
      success: true, 
      message: 'Đã ghi nhận thanh toán học phí thành công',
      tuition: tuition
    });
  } catch (error) {
    console.error('Lỗi khi ghi nhận thanh toán học phí:', error);
      return res.status(500).json({
        success: false,
      message: 'Đã xảy ra lỗi khi ghi nhận thanh toán học phí' 
    });
  }
};

exports.getTuitionByClass = async (req, res) => {
  try {
    // lấy thông tin scheduleId từ params
    const scheduleId = req.params.id;
    
    // Filter tháng và năm
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();
    const status = req.query.status || 'all';
    
    // Tìm thông tin lịch học và populate thông tin giáo viên
    const scheduleInfo = await Schedule.findById(scheduleId).populate('teacher');
    
    if (!scheduleInfo) {
      req.flash('error', 'Không tìm thấy thông tin lịch học.');
      return res.redirect('/academic/tuition');
    }
    
    // Tìm học sinh ghi danh vào lịch học này
    const enrollments = await Enrollment.find({
      class: scheduleId,
      status: 'active'
    }).populate('student');
    
    // Đếm số lượng học sinh trong lớp
    const studentCount = enrollments.length;
    console.log(`Số học sinh trong lớp ${scheduleInfo.name}: ${studentCount}`);
    
    // Lấy danh sách học phí của lớp này
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    let tuitionQuery = {
      schedule: scheduleId,
      dueDate: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    // Lọc theo trạng thái nếu có
    if (status !== 'all') {
      tuitionQuery.status = status;
    }
    
    const tuitions = await Tuition.find(tuitionQuery)
      .populate('student')
      .populate('schedule')
      .sort({ dueDate: 1 });
    
    // Tính toán thống kê học phí
    const tuitionStats = {
      total: 0,
      paid: 0,
      pending: 0,
      overdue: 0,
      totalCount: studentCount, // Sử dụng số học sinh từ enrollments
      paidCount: 0,
      pendingCount: 0,
      overdueCount: 0
    };
    
    tuitions.forEach(tuition => {
      tuitionStats.total += tuition.amount;
      
      if (tuition.status === 'paid') {
        tuitionStats.paid += tuition.amount;
        tuitionStats.paidCount++;
      } else if (tuition.status === 'overdue') {
        // Đã được đánh dấu là quá hạn trong database
        tuitionStats.overdue += tuition.amount;
        tuitionStats.overdueCount++;
      } else if (tuition.status === 'pending') {
        // Kiểm tra ngày hiện tại với ngày đến hạn
        if (new Date() > new Date(tuition.dueDate)) {
          tuitionStats.overdue += tuition.amount;
          tuitionStats.overdueCount++;
          
          // Đánh dấu để hiển thị đúng trên giao diện
          tuition._displayStatus = 'overdue';
        } else {
          tuitionStats.pending += tuition.amount;
          tuitionStats.pendingCount++;
        }
      }
    });
    
    // Danh sách tất cả các lịch học/lớp học
    const schedules = await Schedule.find({}).populate('teacher').sort({ name: 1 });
    
    res.render('academic/tuition-by-class', {
      title: 'Quản lý học phí theo lớp',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      schedule: scheduleInfo,
      schedules,
      tuitions,
      tuitionStats,
      enrollments,
      selectedMonth: month,
      selectedYear: year,
      selectedStatus: status,
      studentCount, // Truyền số lượng học sinh cho view
      moment
    });
  } catch (err) {
    console.error('Lỗi khi xem học phí theo lớp:', err);
    req.flash('error', 'Đã xảy ra lỗi: ' + err.message);
    res.redirect('/academic/tuition');
  }
};

exports.generateClassTuition = async (req, res) => {
  try {
    const { scheduleId, month, year } = req.body;
    
    if (!scheduleId || !month || !year) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin lớp học hoặc thời gian' });
    }
    
    // Lấy thông tin lớp học
    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }
    
    // Kiểm tra tuitionAmount có được thiết lập trong lịch học
    if (!schedule.tuitionAmount || schedule.tuitionAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lớp học chưa thiết lập số tiền học phí, vui lòng cập nhật thông tin lớp học trước' 
      });
    }
    
    // Lấy danh sách học sinh đang học trong lớp
    const enrollments = await Enrollment.find({ 
      class: scheduleId, 
      status: 'active' 
    }).populate('student');
    
    if (enrollments.length === 0) {
      return res.status(400).json({ success: false, message: 'Lớp học không có học sinh nào đang hoạt động' });
    }
    
    // Kiểm tra học phí đã tồn tại chưa
    const existingTuitions = await Tuition.find({
      schedule: scheduleId,
      month: parseInt(month),
      year: parseInt(year)
    });
    
    if (existingTuitions.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Đã tồn tại ${existingTuitions.length} khoản học phí cho lớp này trong tháng ${month}/${year}` 
      });
    }
    
    // Tạo học phí cho tất cả học sinh trong lớp
    const paymentDay = schedule.tuitionDueDay || 10;
    const dueDate = new Date(year, month - 1, paymentDay);
    const tuitionName = `Học phí tháng ${month}/${year} - ${schedule.name}`;
    // Ngày đầu tiên của tháng được tạo học phí - dùng để so sánh với ngày nghỉ học
    const startDate = new Date(year, month - 1, 1);
    
    const tuitionPromises = [];
    let successCount = 0;
    let skippedCount = 0;
    
    for (const enrollment of enrollments) {
      try {
        if (!enrollment.student || !enrollment.student._id) {
          console.error('Học sinh không hợp lệ trong enrollment:', enrollment);
          continue;
        }
        
        // Kiểm tra trạng thái học sinh
        if (enrollment.student.status !== 'active') {
          console.log(`Bỏ qua học sinh ${enrollment.student.name} - Trạng thái: ${enrollment.student.status}`);
          skippedCount++;
          continue;
        }
        
        // Kiểm tra nếu học sinh đã nghỉ học trước khi tháng học phí bắt đầu
        if (enrollment.student.endDate && new Date(enrollment.student.endDate) <= startDate) {
          console.log(`Bỏ qua học sinh ${enrollment.student.name} - Đã nghỉ học từ: ${new Date(enrollment.student.endDate).toLocaleDateString()}`);
          skippedCount++;
          continue;
        }
        
        const newTuition = new Tuition({
          student: enrollment.student._id,
          schedule: scheduleId,
          name: tuitionName,
          amount: schedule.tuitionAmount,
          month: parseInt(month),
          year: parseInt(year),
          dueDate: dueDate,
          status: 'pending',
          academicYear: `${year}-${parseInt(year) + 1}`
        });
        
        tuitionPromises.push(newTuition.save());
        successCount++;
      } catch (enrollmentError) {
        console.error('Lỗi khi tạo học phí cho học sinh:', enrollment.student?.name || 'Không xác định', enrollmentError);
      }
    }
    
    await Promise.all(tuitionPromises);
    
    return res.status(200).json({ 
      success: true,
      message: `Đã tạo học phí cho ${successCount} học sinh trong lớp ${schedule.name}. Đã bỏ qua ${skippedCount} học sinh đã nghỉ học.` 
    });
  } catch (error) {
    console.error('Lỗi khi tạo học phí cho lớp:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi tạo học phí cho lớp: ' + (error.message || 'Lỗi không xác định')
    });
  }
};

// Tạo học phí cho học sinh trong lớp
exports.generateTuition = async (req, res) => {
  try {
    // Log dữ liệu nhận được để debug
    console.log('generateTuition - Dữ liệu nhận được:', {
      body: req.body,
      contentType: req.headers['content-type']
    });
    
    const { scheduleId, month, year, dueDay, amount, name, status } = req.body;
    
    // Log từng trường dữ liệu sau khi parse
    console.log('generateTuition - Dữ liệu sau khi parse:', {
      scheduleId: scheduleId,
      month: month,
      year: year,
      dueDay: dueDay,
      amount: amount,
      name: name,
      status: status
    });
    
    if (!scheduleId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin lớp học cần tạo học phí' 
      });
    }
    
    // Kiểm tra month và year
    if (!month || !year) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin tháng/năm cho học phí' 
      });
    }
    
    // Convert dữ liệu sang số
    const monthInt = parseInt(month);
    const yearInt = parseInt(year);
    const amountFloat = parseFloat(amount);
    const dueDayInt = parseInt(dueDay);
    
    if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tháng không hợp lệ. Vui lòng nhập số từ 1 đến 12' 
      });
    }
    
    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Năm không hợp lệ. Vui lòng nhập số từ 2000 đến 2100' 
      });
    }
    
    // Kiểm tra lịch học có tồn tại không
    const scheduleInfo = await Schedule.findById(scheduleId);
    
    if (!scheduleInfo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không tìm thấy thông tin lịch học' 
      });
    }
    
    // Kiểm tra số tiền học phí
    const tuitionAmount = amountFloat || scheduleInfo.tuitionAmount;
    if (!tuitionAmount || tuitionAmount <= 0 || isNaN(tuitionAmount)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng nhập số tiền học phí hợp lệ' 
      });
    }
    
    // Tìm danh sách học sinh trong lớp (thông qua Enrollment)
    const enrollments = await Enrollment.find({
      class: scheduleId,
      status: 'active'
    }).populate('student');
    
    console.log(`Tìm thấy ${enrollments.length} học sinh trong lớp ${scheduleInfo.name}`);
    
    if (enrollments.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không có học sinh nào trong lớp học này. Vui lòng thêm học sinh vào lớp trước khi tạo học phí.' 
      });
    }
    
    // Kiểm tra xem đã tạo học phí cho tháng này chưa
    const startDate = new Date(yearInt, monthInt - 1, 1);
    const endDate = new Date(yearInt, monthInt, 0);
    
    const existingTuitions = await Tuition.find({
      schedule: scheduleId,
      month: monthInt,
      year: yearInt
    });
    
    if (existingTuitions.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Đã tồn tại ${existingTuitions.length} khoản học phí cho lớp này trong tháng ${monthInt}/${yearInt}` 
      });
    }
    
    // Xác định ngày đến hạn từ dueDay
    let dueDateObj;
    if (dueDayInt && dueDayInt >= 1 && dueDayInt <= 31) {
      // Nếu có dueDay, sử dụng dueDay để tạo ngày đến hạn
      dueDateObj = new Date(yearInt, monthInt - 1, dueDayInt);
    } else {
      // Nếu không có dueDay, sử dụng ngày mặc định từ lịch học hoặc ngày 10
      dueDateObj = new Date(yearInt, monthInt - 1, scheduleInfo.tuitionDueDay || 10);
    }
    
    // Tạo tên học phí nếu không được cung cấp
    const tuitionName = name || `Học phí tháng ${monthInt}/${yearInt} - ${scheduleInfo.name}`;
    const tuitionPromises = [];
    let successCount = 0;
    let skippedCount = 0;
    const createdTuitions = [];
    
    // Xác định trạng thái học phí (mặc định là 'pending' nếu không được cung cấp hoặc không hợp lệ)
    const tuitionStatus = status && ['pending', 'paid'].includes(status) ? status : 'pending';
    
    // Tạo học phí cho từng học sinh trong lớp với trạng thái được chọn
    for (const enrollment of enrollments) {
      try {
        if (!enrollment.student || !enrollment.student._id) {
          console.error('Học sinh không hợp lệ trong enrollment:', enrollment);
          continue;
        }
        
        // Kiểm tra trạng thái học sinh
        if (enrollment.student.status !== 'active') {
          console.log(`Bỏ qua học sinh ${enrollment.student.name} - Trạng thái: ${enrollment.student.status}`);
          skippedCount++;
          continue;
        }
        
        // Kiểm tra nếu học sinh đã nghỉ học trước khi tháng học phí bắt đầu
        if (enrollment.student.endDate && new Date(enrollment.student.endDate) <= startDate) {
          console.log(`Bỏ qua học sinh ${enrollment.student.name} - Đã nghỉ học từ: ${new Date(enrollment.student.endDate).toLocaleDateString()}`);
          skippedCount++;
          continue;
        }
        
        // Tạo đối tượng học phí mới với trạng thái từ form
        const tuition = new Tuition({
          student: enrollment.student._id,
          schedule: scheduleId,
          amount: tuitionAmount,
          name: tuitionName,
          month: monthInt,
          year: yearInt,
          dueDate: dueDateObj,
          status: tuitionStatus,  // Sử dụng trạng thái từ form
          academicYear: `${yearInt}-${yearInt + 1}`
        });
        
        // Lưu vào mảng để kiểm tra sau khi lưu
        createdTuitions.push(tuition);
        
        // Lưu học phí vào database
        const savedPromise = tuition.save();
        tuitionPromises.push(savedPromise);
        successCount++;
      } catch (enrollmentError) {
        console.error('Lỗi khi tạo học phí cho học sinh:', enrollment.student?.name || 'Không xác định', enrollmentError);
      }
    }
    
    // Chờ tất cả các promise hoàn thành
    const savedResults = await Promise.all(tuitionPromises);
    
    // Kiểm tra xem tất cả các bản ghi đã được lưu với trạng thái đúng chưa
    let statusCountMap = {
      pending: 0,
      paid: 0
    };
    
    for (const tuition of savedResults) {
      statusCountMap[tuition.status] = (statusCountMap[tuition.status] || 0) + 1;
    }
    
    console.log(`Đã tạo ${successCount} học phí, bỏ qua ${skippedCount} học sinh đã nghỉ học.
      - ${statusCountMap.pending || 0} có trạng thái 'pending'
      - ${statusCountMap.paid || 0} có trạng thái 'paid'`);
    
    // Trả về kết quả thành công
    return res.status(200).json({ 
      success: true, 
      message: `Đã tạo học phí cho ${successCount} học sinh trong lớp ${scheduleInfo.name} với trạng thái '${tuitionStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}'. Đã bỏ qua ${skippedCount} học sinh đã nghỉ học.` 
    });
  } catch (err) {
    console.error('Lỗi khi tạo học phí hàng loạt:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Đã xảy ra lỗi: ' + (err.message || 'Lỗi không xác định')
    });
  }
};

// Chỉnh sửa thông tin học phí
exports.editTuition = async (req, res) => {
  try {
    const { tuitionId, amount, dueDate, description, status } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!tuitionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu ID học phí cần chỉnh sửa' 
      });
    }

    // Tìm bản ghi học phí
    const tuition = await Tuition.findById(tuitionId);
    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi học phí' });
    }

    // Cập nhật thông tin học phí
    if (amount && !isNaN(parseFloat(amount))) {
      tuition.amount = parseFloat(amount);
    }
    
    if (dueDate) {
      tuition.dueDate = new Date(dueDate);
    }
    
    if (description) {
      tuition.description = description;
    }
    
    if (status && ['pending', 'partial', 'paid', 'overdue'].includes(status)) {
      tuition.status = status;
    }

    // Cập nhật trạng thái dựa trên số tiền đã thanh toán
    if (tuition.amountPaid >= tuition.amount) {
      tuition.status = 'paid';
    } else if (tuition.amountPaid > 0) {
      tuition.status = 'partial';
    } else if (new Date() > new Date(tuition.dueDate)) {
      tuition.status = 'overdue';
    } else {
      tuition.status = 'pending';
    }

    // Lưu bản ghi học phí
    await tuition.save();

    return res.status(200).json({ 
      success: true, 
      message: 'Đã cập nhật thông tin học phí thành công',
      tuition
    });
  } catch (error) {
    console.error('Lỗi khi chỉnh sửa học phí:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Đã xảy ra lỗi: ' + (error.message || 'Lỗi không xác định')
    });
  }
};

// Đồng bộ hóa dữ liệu Enrollment với students trong Schedule
exports.syncEnrollments = async (req, res) => {
  try {
    console.log('Bắt đầu đồng bộ hóa dữ liệu Enrollment...');
    
    // Lấy tất cả lớp học
    const schedules = await Schedule.find().select('_id name students');
    console.log(`Tìm thấy ${schedules.length} lớp học`);
    
    let totalSynced = 0;
    let totalCreated = 0;
    
    // Duyệt qua từng lớp
    for (const schedule of schedules) {
      console.log(`\nĐang đồng bộ cho lớp ${schedule.name} (${schedule._id})`);
      console.log(`Số học sinh trong mảng students: ${schedule.students ? schedule.students.length : 0}`);
      
      if (!schedule.students || schedule.students.length === 0) {
        console.log('Lớp này không có học sinh, bỏ qua.');
        continue;
      }
      
      // Lấy danh sách enrollment hiện tại
      const existingEnrollments = await Enrollment.find({
        class: schedule._id
      });
      
      console.log(`Số enrollment hiện tại: ${existingEnrollments.length}`);
      
      // Lấy danh sách student IDs từ các enrollment hiện tại
      const existingStudentIds = existingEnrollments.map(e => e.student.toString());
      
      // Duyệt qua từng học sinh trong mảng students
      const newEnrollmentPromises = [];
      
      for (const studentId of schedule.students) {
        // Bỏ qua nếu đã có enrollment
        if (existingStudentIds.includes(studentId.toString())) {
          console.log(`- Học sinh ${studentId} đã có enrollment, kiểm tra trạng thái`);
          
          // Kiểm tra trạng thái enrollment
          const enrollment = existingEnrollments.find(e => 
            e.student.toString() === studentId.toString()
          );
          
          // Nếu enrollment không active, cập nhật thành active
          if (enrollment && enrollment.status !== 'active') {
            console.log(`  Cập nhật trạng thái enrollment từ ${enrollment.status} thành active`);
            enrollment.status = 'active';
            await enrollment.save();
            totalSynced++;
          }
          
          continue;
        }
        
        // Tạo enrollment mới cho học sinh
        console.log(`- Tạo enrollment mới cho học sinh ${studentId}`);
        const newEnrollment = new Enrollment({
          student: studentId,
          class: schedule._id,
          status: 'active',
          academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
          enrollmentDate: new Date()
        });
        
        newEnrollmentPromises.push(newEnrollment.save());
        totalCreated++;
      }
      
      // Lưu tất cả enrollment mới
      if (newEnrollmentPromises.length > 0) {
        await Promise.all(newEnrollmentPromises);
        console.log(`Đã tạo ${newEnrollmentPromises.length} enrollment mới cho lớp ${schedule.name}`);
      }
    }
    
    const message = `Đồng bộ hóa hoàn tất. Đã tạo ${totalCreated} enrollment mới và cập nhật ${totalSynced} enrollment.`;
    console.log(message);
    
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({
        success: true,
        message,
        totalCreated,
        totalSynced
      });
    }
    
    req.flash('success', message);
    res.redirect('/academic/schedule');
  } catch (error) {
    console.error('Lỗi khi đồng bộ hóa enrollment:', error);
    
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi đồng bộ hóa: ' + error.message
      });
    }
    
    req.flash('error', 'Lỗi khi đồng bộ hóa: ' + error.message);
    res.redirect('/academic/schedule');
  }
};

// Báo cáo học phí theo lớp
exports.getTuitionReport = async (req, res) => {
  try {
    const scheduleId = req.params.id;
    
    if (!scheduleId) {
      req.flash('error_msg', 'Không tìm thấy thông tin lớp học');
      return res.redirect('/academic/tuition');
    }
    
    // Lấy thông tin lớp học
    const scheduleInfo = await Schedule.findById(scheduleId).populate('teacher');
    
    if (!scheduleInfo) {
      req.flash('error_msg', 'Không tìm thấy thông tin lớp học');
      return res.redirect('/academic/tuition');
    }
    
    // Lấy danh sách học sinh trong lớp này
    const enrollments = await Enrollment.find({
      class: scheduleId,
      status: 'active'
    }).populate('student');
    
    // Danh sách học sinh đã ghi danh
    const studentIds = enrollments.map(e => e.student._id);
    const studentCount = studentIds.length;
    
    // Xử lý tham số từ query
    const selectedStudentId = req.query.studentId || null;
    const timeRange = req.query.timeRange || '6'; // Mặc định là 6 tháng
    let startDate, endDate;
    
    // Xác định khoảng thời gian dựa vào tham số
    if (timeRange === 'custom' && req.query.startDate && req.query.endDate) {
      // Nếu là tùy chỉnh và có ngày bắt đầu, kết thúc
      startDate = new Date(req.query.startDate);
      endDate = new Date(req.query.endDate);
      // Đảm bảo endDate là cuối tháng
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
    } else {
      // Nếu không phải tùy chỉnh, lấy theo số tháng gần nhất
      const months = parseInt(timeRange) || 6;
      endDate = new Date();
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - (months - 1));
      startDate.setDate(1); // Ngày đầu tiên của tháng
    }
    
    // Định dạng startDate và endDate để hiển thị trong form
    const formattedStartDate = startDate ? `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}` : '';
    const formattedEndDate = endDate ? `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}` : '';
    
    // Xây dựng query để lấy học phí
    let tuitionQuery = {
      schedule: scheduleId,
      dueDate: { $gte: startDate, $lte: endDate }
    };
    
    // Nếu có chọn học sinh cụ thể
    if (selectedStudentId) {
      tuitionQuery.student = selectedStudentId;
    }
    
    // Lấy tất cả học phí theo điều kiện đã lọc
    const tuitions = await Tuition.find(tuitionQuery)
      .populate('student')
      .sort({ dueDate: -1 });
    
    // Tính toán thống kê học phí theo tháng
    const monthlyStats = {};
    const months = [];
    
    // Tạo danh sách các tháng trong khoảng thời gian
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const monthKey = `${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
      months.push(monthKey);
      
      const monthTuitions = tuitions.filter(t => {
        const tuitionDate = new Date(t.dueDate);
        return tuitionDate.getMonth() === currentDate.getMonth() && 
               tuitionDate.getFullYear() === currentDate.getFullYear();
      });
      
      monthlyStats[monthKey] = {
        totalAmount: monthTuitions.reduce((sum, t) => sum + (t.amount || 0), 0),
        paidAmount: monthTuitions.filter(t => t.status === 'paid').reduce((sum, t) => sum + (t.amount || 0), 0),
        pendingAmount: monthTuitions.filter(t => t.status === 'pending' && new Date(t.dueDate) >= new Date()).reduce((sum, t) => sum + (t.amount || 0), 0),
        overdueAmount: monthTuitions.filter(t => (t.status === 'overdue') || (t.status === 'pending' && new Date(t.dueDate) < new Date())).reduce((sum, t) => sum + (t.amount || 0), 0),
        paidCount: monthTuitions.filter(t => t.status === 'paid').length,
        pendingCount: monthTuitions.filter(t => t.status === 'pending' && new Date(t.dueDate) >= new Date()).length,
        overdueCount: monthTuitions.filter(t => (t.status === 'overdue') || (t.status === 'pending' && new Date(t.dueDate) < new Date())).length,
        totalCount: monthTuitions.length
      };
      
      // Chuyển sang tháng tiếp theo
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // Tính tổng thống kê cho toàn bộ khoảng thời gian
    const totalStats = {
      totalAmount: tuitions.reduce((sum, t) => sum + (t.amount || 0), 0),
      paidAmount: tuitions.filter(t => t.status === 'paid').reduce((sum, t) => sum + (t.amount || 0), 0),
      pendingAmount: tuitions.filter(t => t.status === 'pending' && new Date(t.dueDate) >= new Date()).reduce((sum, t) => sum + (t.amount || 0), 0),
      overdueAmount: tuitions.filter(t => (t.status === 'overdue') || (t.status === 'pending' && new Date(t.dueDate) < new Date())).reduce((sum, t) => sum + (t.amount || 0), 0),
      paidCount: tuitions.filter(t => t.status === 'paid').length,
      pendingCount: tuitions.filter(t => t.status === 'pending' && new Date(t.dueDate) >= new Date()).length,
      overdueCount: tuitions.filter(t => (t.status === 'overdue') || (t.status === 'pending' && new Date(t.dueDate) < new Date())).length,
      totalCount: tuitions.length
    };
    
    // Lấy 10 học sinh có học phí quá hạn nhiều nhất
    let overdueStudents = [];
    
    if (selectedStudentId) {
      // Nếu đã chọn học sinh cụ thể, chỉ tính toán cho học sinh đó
      const studentTuitions = tuitions.filter(t => 
        t.student && t.student._id.toString() === selectedStudentId &&
        t.status === 'pending' && new Date(t.dueDate) < new Date()
      );
      
      if (studentTuitions.length > 0) {
        const student = enrollments.find(e => e.student._id.toString() === selectedStudentId)?.student;
        if (student) {
          overdueStudents = [{
            student: student,
            overdueAmount: studentTuitions.reduce((sum, t) => sum + (t.amount || 0), 0),
            overdueCount: studentTuitions.length
          }];
        }
      }
    } else {
      // Nếu không chọn học sinh cụ thể, tính toán cho tất cả học sinh
      overdueStudents = studentIds.map(studentId => {
        const studentTuitions = tuitions.filter(t => 
          t.student && t.student._id.toString() === studentId.toString() && 
          t.status === 'pending' && new Date(t.dueDate) < new Date()
        );
        
        return {
          student: enrollments.find(e => e.student._id.toString() === studentId.toString())?.student,
          overdueAmount: studentTuitions.reduce((sum, t) => sum + (t.amount || 0), 0),
          overdueCount: studentTuitions.length
        };
      })
      .filter(s => s.overdueAmount > 0 && s.student)
      .sort((a, b) => b.overdueAmount - a.overdueAmount)
      .slice(0, 10);
    }
    
    // Render trang báo cáo với các thông tin đã lọc
    res.render('academic/tuition-report', {
      title: selectedStudentId ? 
        `Báo cáo học phí của ${enrollments.find(e => e.student._id.toString() === selectedStudentId)?.student?.name || 'Học sinh'} - Lớp ${scheduleInfo.name}` : 
        `Báo cáo học phí lớp ${scheduleInfo.name}`,
      schedule: scheduleInfo,
      months: months,
      monthlyStats,
      totalStats,
      overdueStudents,
      studentCount,
      tuitions,
      enrollments,
      selectedStudentId,
      timeRange,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      user: req.user,
      moment: require('moment')
    });
  } catch (error) {
    console.error('Lỗi khi tạo báo cáo học phí:', error);
    req.flash('error_msg', 'Có lỗi khi tạo báo cáo học phí: ' + error.message);
    res.redirect('/academic/tuition');
  }
};

// Tạo học phí thủ công
exports.createManualTuition = async (req, res) => {
  try {
    console.log('createManualTuition - Dữ liệu nhận được:', req.body);
    
    const { 
      scheduleId, 
      studentId, 
      amount, 
      month, 
      year, 
      dueDay, 
      name,
      status, 
      notes 
    } = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!scheduleId || !studentId || !amount || !month || !year || !dueDay) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc' 
      });
    }
    
    // Chuyển đổi dữ liệu sang số
    const monthInt = parseInt(month);
    const yearInt = parseInt(year);
    const dueDayInt = parseInt(dueDay);
    const amountFloat = parseFloat(amount);
    
    // Kiểm tra tính hợp lệ của dữ liệu
    if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tháng không hợp lệ. Vui lòng nhập số từ 1 đến 12' 
      });
    }
    
    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Năm không hợp lệ. Vui lòng nhập số từ 2000 đến 2100' 
      });
    }
    
    if (isNaN(dueDayInt) || dueDayInt < 1 || dueDayInt > 31) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ngày đến hạn không hợp lệ. Vui lòng nhập số từ 1 đến 31' 
      });
    }
    
    if (isNaN(amountFloat) || amountFloat <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Số tiền không hợp lệ. Vui lòng nhập số dương' 
      });
    }
    
    // Kiểm tra student và schedule có tồn tại không
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy học sinh' 
      });
    }
    
    // Bỏ kiểm tra trạng thái học sinh - cho phép thêm học phí kể cả khi học sinh đã nghỉ học
    
    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy lớp học' 
      });
    }
    
    // Kiểm tra enrollment nhưng không bắt buộc phải active
    const enrollment = await Enrollment.findOne({
      student: studentId,
      class: scheduleId
    });
    
    // Không bắt buộc học sinh phải còn học trong lớp
    
    // Tạo ngày đến hạn
    const dueDate = new Date(yearInt, monthInt - 1, dueDayInt);
    
    // Tạo bản ghi học phí mới
    const tuition = new Tuition({
      student: studentId,
      schedule: scheduleId,
      name: name || `Học phí tháng ${monthInt}/${yearInt} - ${schedule.name}`,
      amount: amountFloat,
      month: monthInt,
      year: yearInt,
      dueDate: dueDate,
      status: status || 'pending',
      notes: notes || '',
      academicYear: `${yearInt}-${yearInt + 1}`
    });
    
    // Nếu trạng thái là đã thanh toán, cập nhật thông tin thanh toán
    if (status === 'paid') {
      tuition.paymentDate = new Date();
      tuition.paymentMethod = 'cash'; // Mặc định là tiền mặt
    }
    
    // Lưu bản ghi học phí
    await tuition.save();
    
    console.log('Đã tạo học phí thủ công:', {
      id: tuition._id,
      student: student.name,
      amount: amountFloat,
      dueDate: dueDate,
      status: status
    });
    
    // Phản hồi thành công
    return res.status(200).json({ 
      success: true, 
      message: `Đã tạo học phí thủ công cho học sinh ${student.name}`,
      tuition: tuition
    });
  } catch (error) {
    console.error('Lỗi khi tạo học phí thủ công:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Đã xảy ra lỗi: ' + (error.message || 'Lỗi không xác định')
    });
  }
};

// Lưu điểm danh
exports.saveAttendance = async (req, res) => {
  try {
    const { classId, date, attendances } = req.body;
    
    console.log('Dữ liệu điểm danh nhận được:', JSON.stringify(req.body, null, 2));
    
    // Kiểm tra dữ liệu đầu vào
    if (!date || !attendances || !Array.isArray(attendances) || attendances.length === 0) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
    }

    // Chuyển đổi ngày sang đối tượng Date, đảm bảo sử dụng múi giờ local
    const attendanceDate = moment(date, 'YYYY-MM-DD').startOf('day').toDate();

    // Kiểm tra nếu ngày không hợp lệ
    if (!moment(attendanceDate).isValid()) {
      return res.status(400).json({ success: false, message: 'Ngày không hợp lệ' });
    }

    console.log('Đang lưu điểm danh cho ngày:', moment(attendanceDate).format('YYYY-MM-DD'));

    if (!classId) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn lớp học' });
    }

    // Tìm bản ghi điểm danh hiện có hoặc tạo mới
    let attendanceRecord = await Attendance.findOne({
      schedule: classId,
      date: {
        $gte: moment(attendanceDate).startOf('day').toDate(),
        $lt: moment(attendanceDate).endOf('day').toDate()
      }
    });

    if (!attendanceRecord) {
      // Tạo bản ghi mới nếu chưa tồn tại
      attendanceRecord = new Attendance({
        schedule: classId,
        date: attendanceDate,
        students: []
      });
    }

    // Cập nhật danh sách học sinh
    attendanceRecord.students = attendances.map(item => ({
      student: item.studentId,
      status: item.status,
      note: item.note || ''
    }));

    // Lưu bản ghi điểm danh
    await attendanceRecord.save();
    console.log('Đã lưu điểm danh thành công cho lớp:', classId);
    
    res.json({ success: true, message: 'Đã lưu điểm danh thành công' });
    
  } catch (err) {
    console.error('Lỗi khi lưu điểm danh:', err);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
}; 

// API endpoint để lấy thống kê điểm danh cho một học sinh
exports.getStudentAttendanceStats = async (req, res) => {
  try {
    const { studentId, classId, startDate, endDate } = req.query;
    
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu ID học sinh'
      });
    }
    
    // Tạo khoảng thời gian
    const startDateObj = startDate ? moment(startDate).startOf('day') : moment().subtract(30, 'days').startOf('day');
    const endDateObj = endDate ? moment(endDate).endOf('day') : moment().endOf('day');
    
    console.log(`Lấy thống kê điểm danh cho học sinh ${studentId} từ ${startDateObj.format('DD/MM/YYYY')} đến ${endDateObj.format('DD/MM/YYYY')}`);
    
    // Xây dựng query điều kiện
    let query = {
      $or: [
        // Trường hợp 1: record.student trực tiếp
        {
          student: studentId,
          date: {
            $gte: startDateObj.toDate(),
            $lte: endDateObj.toDate()
          }
        },
        // Trường hợp 2: record.students là mảng các học sinh
        {
          'students.student': studentId,
          date: {
            $gte: startDateObj.toDate(),
            $lte: endDateObj.toDate()
          }
        }
      ]
    };
    
    // Nếu có lớp được chọn, thêm điều kiện lớp
    if (classId) {
      query.$or[0].schedule = classId;
      query.$or[1].schedule = classId;
    }
    
    // Lấy lịch sử điểm danh trực tiếp
    const directRecords = await Attendance.find(query.$or[0])
      .populate('schedule', 'name')
      .sort({ date: -1 });
      
    // Lấy điểm danh từ mảng students
    const groupRecords = await Attendance.find(query.$or[1])
      .populate('schedule', 'name')
      .sort({ date: -1 });
      
    // Xử lý kết quả từ groupRecords
    const processedGroupRecords = [];
    
    groupRecords.forEach(record => {
      // Tìm thông tin học sinh trong mảng students
      const studentRecord = record.students.find(s => 
        s.student && (s.student._id && s.student._id.toString() === studentId || s.student.toString() === studentId)
      );
      
      if (studentRecord) {
        // Tạo bản ghi mới với cấu trúc tương thích
        const processedRecord = {
          _id: record._id,
          schedule: record.schedule,
          date: record.date,
          student: { _id: studentId },
          status: studentRecord.status,
          note: studentRecord.note || ''
        };
        
        processedGroupRecords.push(processedRecord);
      }
    });
    
    // Gộp kết quả từ cả hai nguồn
    const attendanceRecords = [...directRecords, ...processedGroupRecords];
    
    // Tính toán thống kê điểm danh
    const stats = {
      present: 0,
      absent: 0,
      late: 0,
      total: attendanceRecords.length
    };
    
    // Nếu có dữ liệu điểm danh, tính toán các thống kê
    if (attendanceRecords && attendanceRecords.length > 0) {
      attendanceRecords.forEach(record => {
        if (record.status === 'present') stats.present++;
        else if (record.status === 'absent') stats.absent++;
        else if (record.status === 'late') stats.late++;
      });
    }
    
    return res.json({
      success: true,
      stats,
      attendanceCount: attendanceRecords.length
    });
  } catch (err) {
    console.error('Lỗi khi lấy thống kê điểm danh của học sinh:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server: ' + err.message
    });
  }
};