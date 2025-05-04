# School Dashboard

Hệ thống quản lý trường học với các tính năng quản lý học sinh, phụ huynh, giáo viên và điểm danh.

## Cài đặt

```bash
# Clone dự án
git clone <repository-url>

# Di chuyển vào thư mục dự án
cd school-dashboard

# Cài đặt các gói phụ thuộc
npm install
>>cài đặt database mongodb và MongoDB Database Tools version 100 - mongodb dump dùng để thực hiện chức năng backup database
```

## Cấu hình

Tạo file `.env` database local với nội dung sau:
Hãy nhớ thay đổi secret và đường dẫn database nếu dùng mongodb cloud

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/school_dashboard
SESSION_SECRET=school_dashboard_secret
```

## Tạo dữ liệu mẫu

```bash
# Chạy script tạo dữ liệu mẫu
npm run seed
```

Dữ liệu mẫu bao gồm:
- Tài khoản admin: admin / admin123
- Tài khoản giáo viên: teacher / teacher123
- Tài khoản phụ huynh: parent / parent123

## Chạy ứng dụng

```bash
# Chạy ứng dụng ở chế độ development
npm run dev

# Hoặc chạy ứng dụng ở chế độ production
npm start
```

Truy cập ứng dụng tại [http://localhost:3000](http://localhost:3000)

## Tính năng

- Quản lý thông tin học sinh
- Quản lý thông tin phụ huynh
- Quản lý thông tin giáo viên
- Điểm danh học sinh
- Xem lịch học
- Quản lý người dùng và phân quyền
- Tìm kiếm thông tin
- Cài đặt tài khoản và thông báo 