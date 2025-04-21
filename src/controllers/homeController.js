const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const moment = require('moment');
const Tuition = require('../models/Tuition');

// Hiển thị trang chủ Dashboard
exports.getDashboard = async (req, res) => {
  try {
    // Lấy dữ liệu thống kê từ database
    const studentCount = await Student.countDocuments();
    const parentCount = await Parent.countDocuments();
    const teacherCount = await Teacher.countDocuments();
    
    // Tính toán tổng học phí đã thanh toán trong tháng hiện tại
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0);
    
    // Lấy tất cả học phí đã thanh toán trong tháng hiện tại
    const paidTuitions = await Tuition.find({
      status: 'paid',
      paymentDate: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    // Tính tổng số tiền học phí đã thanh toán
    const monthlyPayments = paidTuitions.reduce((total, tuition) => total + tuition.amount, 0);
    
    // Lấy danh sách lớp học từ model Schedule
    let courses = [];
    const schedules = await Schedule.find()
      .populate('teacher', 'name')
      .sort({ createdAt: -1 })
      .limit(4);
    
    if (schedules && schedules.length > 0) {
      schedules.forEach(schedule => {
        // Kiểm tra trường dayOfWeek và xử lý nếu không tồn tại hoặc undefined
        let scheduleDisplay = '';
        if (schedule.days && Array.isArray(schedule.days)) {
          scheduleDisplay = schedule.days.join(' & ');
        } else if (schedule.dayOfWeek && Array.isArray(schedule.dayOfWeek)) {
          scheduleDisplay = schedule.dayOfWeek.join(' & ');
        } else {
          scheduleDisplay = 'Chưa cập nhật';
        }

        // Xử lý trường startTime và endTime
        let timeDisplay = '';
        if (schedule.time && schedule.time.start && schedule.time.end) {
          timeDisplay = `${schedule.time.start} - ${schedule.time.end}`;
        } else if (schedule.startTime && schedule.endTime) {
          timeDisplay = `${schedule.startTime} - ${schedule.endTime}`;
        } else {
          timeDisplay = 'Chưa cập nhật';
        }

        courses.push({
          id: schedule._id,
          name: schedule.name,
          teacher: schedule.teacher ? schedule.teacher.name : 'Chưa phân công',
          schedule: scheduleDisplay,
          time: timeDisplay
        });
      });
    } else {
      // Dữ liệu mẫu nếu chưa có dữ liệu từ model Schedule
      const teachers = await Teacher.find().limit(4);
      
      if (teachers && teachers.length > 0) {
        const classes = ['Lớp 2-4', 'Lớp 3-5', 'Lớp thứ T7-CN'];
        const schedules = ['Monday & Wednesday', 'Tuesday & Thursday', 'Saturday & Sunday'];
        const times = ['5:30 PM - 7:00 PM', '7:15 PM - 8:45 PM'];
        
        teachers.forEach((teacher, index) => {
          courses.push({
            id: index + 1,
            name: classes[index % classes.length],
            teacher: teacher.name,
            schedule: schedules[index % schedules.length],
            time: times[index % times.length]
          });
        });
      }
    }
    
    // Lấy hoạt động gần đây
    const recentActivities = [];
    
    // Lấy dữ liệu từ các model hiện có
    const recentStudents = await Student.find()
      .sort({ createdAt: -1 })
      .limit(2);
      
    if (recentStudents && recentStudents.length > 0) {
      recentStudents.forEach(student => {
        recentActivities.push({
          type: 'student_added',
          message: `Học sinh mới ${student.name} đã được thêm vào lớp ${student.class || 'chưa phân lớp'}`,
          time: moment(student.createdAt).format('HH:mm A'),
          date: moment(student.createdAt).calendar(),
          icon: 'person-plus'
        });
      });
    }
    
    const recentParents = await Parent.find()
      .sort({ createdAt: -1 })
      .limit(1);
      
    if (recentParents && recentParents.length > 0) {
      recentParents.forEach(parent => {
        recentActivities.push({
          type: 'parent_added',
          message: `Phụ huynh mới ${parent.name} đã được thêm vào hệ thống`,
          time: moment(parent.createdAt).format('HH:mm A'),
          date: moment(parent.createdAt).calendar(),
          icon: 'people'
        });
      });
    }

    // Sắp xếp lại các hoạt động theo thời gian
    recentActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Lấy lịch học hôm nay
    const today = moment().locale('vi').format('DD/MM/YYYY');
    const currentDay = moment().format('dddd').toLowerCase();
    
    // Lấy lịch học của ngày hôm nay - xử lý cả trường hợp days và dayOfWeek
    const todaySchedules = await Schedule.find({
      $or: [
        { days: { $regex: new RegExp(currentDay, 'i') } },
        { dayOfWeek: { $regex: new RegExp(currentDay, 'i') } }
      ]
    }).populate('teacher', 'name').limit(5);
    
    // Thêm dữ liệu thông báo mẫu
    const notifications = [
      {
        title: 'Lịch khai giảng lớp mới',
        message: 'Lớp Tiếng Anh cho học sinh tiểu học sẽ khai giảng vào ngày 15/09/2023',
        date: new Date(),
        actionLink: '/academic/schedule/new',
        actionText: 'Xem lịch'
      },
      {
        title: 'Nhắc nhở thanh toán học phí',
        message: 'Học phí tháng 9 cần được thanh toán trước ngày 10/09/2023',
        date: new Date(Date.now() - 86400000), // Hôm qua
        actionLink: '/billing',
        actionText: 'Thanh toán'
      }
    ];

    res.render('dashboard', { 
      title: 'Dashboard',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      courses: courses,
      currentDate: new Date(),
      stats: {
        totalStudents: studentCount,
        activeClasses: courses.length,
        teachers: teacherCount,
        monthlyPayments: monthlyPayments // Dữ liệu thực tế từ database
      },
      recentActivities,
      today,
      todaySchedules,
      notifications
    });
  } catch (err) {
    console.error('Lỗi khi tải dữ liệu dashboard:', err);
    res.status(500).send('Lỗi server');
  }
};

// Chức năng tìm kiếm
exports.search = async (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.render('search', {
      title: 'Tìm Kiếm',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      results: [],
      query: ''
    });
  }
  
  try {
    // Tìm kiếm học sinh
    const students = await Student.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { class: { $regex: query, $options: 'i' } },
        { parentName: { $regex: query, $options: 'i' } }
      ]
    }).limit(10);
    
    // Tìm kiếm phụ huynh
    const parents = await Parent.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).limit(10);
    
    // Tìm kiếm giáo viên
    const teachers = await Teacher.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { subject: { $regex: query, $options: 'i' } }
      ]
    }).limit(10);
    
    res.render('search', {
      title: 'Kết Quả Tìm Kiếm',
      username: req.session.user ? req.session.user.username : 'Người dùng',
      currentDate: new Date(),
      results: {
        students,
        parents,
        teachers
      },
      query
    });
  } catch (err) {
    console.error('Lỗi khi tìm kiếm:', err);
    res.status(500).send('Lỗi server');
  }
}; 