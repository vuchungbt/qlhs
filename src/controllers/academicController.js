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
    })
    .populate('student', 'name')
    .populate('schedule', 'name');

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

// Điểm danh hàng loạt
exports.batchAttendance = async (req, res) => {
  try {
    const { date, classId, attendances } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!date || !attendances || !Array.isArray(attendances)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
    }

    // Chuyển đổi ngày sang đối tượng Date, đảm bảo sử dụng múi giờ local
    const attendanceDate = moment(date, 'YYYY-MM-DD').startOf('day').toDate();

    // Kiểm tra nếu ngày không hợp lệ
    if (!moment(attendanceDate).isValid()) {
      return res.status(400).json({ success: false, message: 'Ngày không hợp lệ' });
    }

    console.log('Đang lưu điểm danh cho ngày:', moment(attendanceDate).format('YYYY-MM-DD'));

    // Xây dựng danh sách các thao tác bulk write
    const bulkOps = attendances.map(item => {
      // Chuẩn bị dữ liệu cập nhật
      const updateData = {
        student: item.studentId,
        date: attendanceDate,
        status: item.status,
        note: item.note || '',
      };

      // Thêm scheduleId nếu có classId được gửi lên
      if (classId) {
        updateData.schedule = classId;
      }

      // Tạo thao tác upsert
      return {
        updateOne: {
          filter: { student: item.studentId, date: {
            $gte: moment(attendanceDate).startOf('day').toDate(),
            $lt: moment(attendanceDate).endOf('day').toDate()
          }},
          update: { $set: updateData },
          upsert: true
        }
      };
    });

    // Thực hiện bulk write
    if (bulkOps.length > 0) {
      const result = await Attendance.bulkWrite(bulkOps);
      console.log('Kết quả bulkWrite điểm danh:', result);
      res.json({ success: true, message: 'Đã lưu điểm danh thành công' });
    } else {
      res.json({ success: true, message: 'Không có dữ liệu điểm danh để lưu' });
    }
  } catch (err) {
    console.error('Lỗi khi lưu điểm danh hàng loạt:', err);
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
      attendanceRecords = await Attendance.find({
        schedule: selectedClassId,
        date: {
          $gte: startDate.toDate(),
          $lte: endDate.toDate()
        }
      })
      .populate('student', 'name')
      .populate('schedule', 'name')
      .sort({ date: -1 });
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
      .populate('students', 'name')
      .populate('teacher', 'name');
    
    if (!schedule) {
      req.flash('error', 'Không tìm thấy lớp học');
      return res.redirect('/academic/attendance/class');
    }
    
    // Lấy các bản ghi điểm danh của lớp vào ngày đã chọn
    const attendanceRecords = await Attendance.find({
      schedule: classId,
      date: {
        $gte: targetDate.toDate(),
        $lt: moment(targetDate).endOf('day').toDate()
      }
    }).populate('student', 'name');
    
    // Tạo map để tra cứu nhanh điểm danh của học sinh
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.student._id.toString()] = record;
    });
    
    res.render('academic/attendance-class-detail', {
      title: 'Chi Tiết Điểm Danh Lớp',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      schedule,
      selectedDate: targetDate.toDate(),
      attendanceRecords,
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
    const { studentId, date, status, note, scheduleId } = req.body;
    const attendanceId = req.params.id;
    
    // Kiểm tra dữ liệu đầu vào
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Dữ liệu không hợp lệ. Vui lòng cung cấp trạng thái điểm danh.' 
      });
    }
    
    // Tìm bản ghi điểm danh
    let attendance;
    if (attendanceId !== 'new') {
      // Cập nhật bản ghi hiện có
      attendance = await Attendance.findById(attendanceId);
      if (!attendance) {
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy bản ghi điểm danh' 
        });
      }
      
      attendance.status = status;
      attendance.note = note || '';
      if (scheduleId) {
        attendance.schedule = scheduleId;
      }
    } else {
      // Kiểm tra điều kiện cần thiết cho bản ghi mới
      if (!studentId || !date) {
        return res.status(400).json({ 
          success: false, 
          message: 'Dữ liệu không hợp lệ. Vui lòng cung cấp đủ thông tin học sinh và ngày.' 
        });
      }
      
      // Tạo bản ghi mới
      const attendanceDate = moment(date).startOf('day').toDate();
      console.log('Đang lưu điểm danh cho ngày:', moment(attendanceDate).format('YYYY-MM-DD'));
      
      // Kiểm tra xem đã có bản ghi cho học sinh và ngày này chưa
      const existingAttendance = await Attendance.findOne({
        student: studentId,
        date: {
          $gte: moment(attendanceDate).startOf('day').toDate(),
          $lt: moment(attendanceDate).endOf('day').toDate()
        }
      });
      
      if (existingAttendance) {
        // Cập nhật bản ghi đã tồn tại
        existingAttendance.status = status;
        existingAttendance.note = note || '';
        if (scheduleId) {
          existingAttendance.schedule = scheduleId;
        }
        attendance = existingAttendance;
      } else {
        // Tạo bản ghi mới
        attendance = new Attendance({
          student: studentId,
          date: attendanceDate,
          status,
          note: note || '',
          schedule: scheduleId || null
        });
      }
    }
    
    await attendance.save();
    
    res.json({
      success: true,
      message: 'Cập nhật điểm danh thành công',
      attendance
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
    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy bản ghi điểm danh' 
      });
    }
    
    await Attendance.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Xóa điểm danh thành công'
    });
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
      
      // Xây dựng query điều kiện
      const query = {
        student: selectedStudentId,
        date: {
          $gte: startDate.toDate(),
          $lte: endDate.toDate()
        }
      };
      
      // Nếu có lớp được chọn, thêm điều kiện lớp
      if (selectedClassId) {
        query.schedule = selectedClassId;
      }
      
      // Lấy lịch sử điểm danh
      attendanceRecords = await Attendance.find(query)
        .populate('schedule', 'name')
        .sort({ date: -1 });
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
    
    // Lấy danh sách học sinh và lớp học
    const students = await Student.find({}).sort({ name: 1 });
    const schedules = await Schedule.find({}).sort({ name: 1 });
    
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
    
    res.render('academic/tuition', {
      tuitions,
      students,
      schedules,
      stats,
      selectedMonth,
      selectedYear,
      user: req.user,
      title: 'Quản lý học phí',
      currentYear: new Date().getFullYear()
    });
  } catch (error) {
    console.error('Lỗi khi tải trang học phí:', error);
    req.flash('error_msg', 'Có lỗi khi tải trang học phí');
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
    const { tuitionId, studentId, scheduleId, name, amount, dueDate, status, paymentDate, paymentMethod, note, academicYear } = req.body;
    
    if (!tuitionId) {
      req.flash('error_msg', 'Không tìm thấy thông tin học phí');
      return res.redirect('/academic/tuition');
    }

    const updateData = {
      student: studentId,
      schedule: scheduleId,
      name,
      amount,
      dueDate,
      note,
      academicYear
    };

    if (status) updateData.status = status;
    
    // Nếu trạng thái là "paid" (đã thanh toán), cập nhật thông tin thanh toán
    if (status === 'paid') {
      updateData.paymentDate = paymentDate || new Date();
      updateData.paymentMethod = paymentMethod;
    }

    await Tuition.findByIdAndUpdate(tuitionId, updateData);
    req.flash('success_msg', 'Đã cập nhật thông tin học phí thành công');
    res.redirect('/academic/tuition');
  } catch (error) {
    console.error('Lỗi khi cập nhật học phí:', error);
    req.flash('error_msg', 'Có lỗi khi cập nhật thông tin học phí');
    res.redirect('/academic/tuition');
  }
};

exports.deleteTuition = async (req, res) => {
  try {
    const { tuitionId } = req.body;
    
    if (!tuitionId) {
      req.flash('error_msg', 'Không tìm thấy thông tin học phí');
      return res.redirect('/academic/tuition');
    }

    await Tuition.findByIdAndDelete(tuitionId);
    req.flash('success_msg', 'Đã xóa thông tin học phí thành công');
    res.redirect('/academic/tuition');
  } catch (error) {
    console.error('Lỗi khi xóa học phí:', error);
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
    const students = await Student.find({}).sort({ name: 1 });
    
    res.render('academic/tuition-by-student', {
      students,
      user: req.user
    });
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
    
    // Tìm thông tin lịch học
    const scheduleInfo = await Schedule.findById(scheduleId);
    
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
      } else if (tuition.status === 'pending') {
        if (new Date(tuition.dueDate) < new Date()) {
          tuitionStats.overdue += tuition.amount;
          tuitionStats.overdueCount++;
        } else {
          tuitionStats.pending += tuition.amount;
          tuitionStats.pendingCount++;
        }
      }
    });
    
    // Danh sách tất cả các lịch học/lớp học
    const schedules = await Schedule.find({}).sort({ name: 1 });
    
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
    
    const tuitionPromises = [];
    let successCount = 0;
    
    for (const enrollment of enrollments) {
      try {
        if (!enrollment.student || !enrollment.student._id) {
          console.error('Học sinh không hợp lệ trong enrollment:', enrollment);
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
      message: `Đã tạo học phí cho ${successCount} học sinh trong lớp ${schedule.name}` 
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
    
    const { scheduleId, month, year, dueDay, amount, name } = req.body;
    
    // Log từng trường dữ liệu sau khi parse
    console.log('generateTuition - Dữ liệu sau khi parse:', {
      scheduleId: scheduleId, 
      month: month,
      year: year,
      dueDay: dueDay,
      amount: amount,
      name: name
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
    
    for (const enrollment of enrollments) {
      try {
        if (!enrollment.student || !enrollment.student._id) {
          console.error('Học sinh không hợp lệ trong enrollment:', enrollment);
          continue;
        }
        
        const tuition = new Tuition({
          student: enrollment.student._id,
          schedule: scheduleId,
          amount: tuitionAmount,
          name: tuitionName,
          month: monthInt,
          year: yearInt,
          dueDate: dueDateObj,
          status: 'pending',
          academicYear: `${yearInt}-${yearInt + 1}`
        });
        
        tuitionPromises.push(tuition.save());
        successCount++;
      } catch (enrollmentError) {
        console.error('Lỗi khi tạo học phí cho học sinh:', enrollment.student?.name || 'Không xác định', enrollmentError);
      }
    }
    
    await Promise.all(tuitionPromises);
    
    return res.status(200).json({ 
      success: true, 
      message: `Đã tạo học phí cho ${successCount} học sinh trong lớp ${scheduleInfo.name}` 
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