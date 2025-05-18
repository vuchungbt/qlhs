const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const mongoose = require('mongoose');
const moment = require('moment');
const os = require('os');

// Đường dẫn đến thư mục lưu backup
const BACKUP_DIR = path.join(__dirname, '../../backups');

// Đảm bảo thư mục backup tồn tại
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Kiểm tra xem mongodump có khả dụng không
const checkMongoDumpAvailable = () => {
  return new Promise((resolve, reject) => {
    const command = os.platform() === 'win32' ? 'where mongodump' : 'which mongodump';
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

// Hiển thị trang cấu hình backup
exports.getBackupSettings = async (req, res) => {
  // Đọc cấu hình backup hiện tại nếu có
  let backupConfig = {
    autoBackup: false,
    backupInterval: 7, // mặc định là 7 ngày
    lastBackup: null
  };

  const configPath = path.join(BACKUP_DIR, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      backupConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('Lỗi đọc file cấu hình backup:', error);
    }
  }

  // Kiểm tra xem mongodump có khả dụng không
  const isMongoDumpAvailable = await checkMongoDumpAvailable();

  res.render('admin/backup', {
    title: 'Cấu hình Backup Dữ liệu',
    backupConfig,
    backups: getBackupList(),
    isMongoDumpAvailable: isMongoDumpAvailable,
    platform: os.platform()
  });
};

// Cập nhật cấu hình backup
exports.updateBackupSettings = (req, res) => {
  const { autoBackup, backupInterval } = req.body;
  
  const configPath = path.join(BACKUP_DIR, 'config.json');
  let backupConfig = {
    autoBackup: autoBackup === 'on',
    backupInterval: parseInt(backupInterval) || 7,
    lastBackup: null
  };

  if (fs.existsSync(configPath)) {
    try {
      const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      backupConfig.lastBackup = existingConfig.lastBackup;
    } catch (error) {
      console.error('Lỗi đọc file cấu hình backup:', error);
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(backupConfig, null, 2), 'utf8');
  
  req.flash('success', 'Đã cập nhật cấu hình backup thành công!');
  res.redirect('/admin/backup');
};

// Thực hiện backup ngay lập tức
exports.performBackup = async (req, res) => {
  try {
    // Kiểm tra xem mongodump có khả dụng không
    const isMongoDumpAvailable = await checkMongoDumpAvailable();
    
    if (!isMongoDumpAvailable) {
      req.flash('error', 'Không tìm thấy công cụ mongodump. Vui lòng cài đặt MongoDB Database Tools.');
      return res.redirect('/admin/backup');
    }
    
    await createBackup();
    
    // Cập nhật thời gian backup cuối cùng
    updateLastBackupTime();
    
    req.flash('success', 'Đã tạo bản backup thành công!');
    res.redirect('/admin/backup');
  } catch (error) {
    console.error('Lỗi khi tạo backup:', error);
    req.flash('error', 'Có lỗi xảy ra khi tạo backup: ' + error.message);
    res.redirect('/admin/backup');
  }
};

// Tải về file backup
exports.downloadBackup = (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(BACKUP_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    req.flash('error', 'Không tìm thấy file backup yêu cầu!');
    return res.redirect('/admin/backup');
  }
  
  res.download(filePath);
};

// Xóa file backup
exports.deleteBackup = (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(BACKUP_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    req.flash('error', 'Không tìm thấy file backup yêu cầu!');
    return res.redirect('/admin/backup');
  }
  
  fs.unlinkSync(filePath);
  req.flash('success', 'Đã xóa file backup thành công!');
  res.redirect('/admin/backup');
};

// Phục hồi từ file backup
exports.restoreBackup = async (req, res) => {
  try {
    // Kiểm tra xem mongorestore có khả dụng không
    const isMongoRestoreAvailable = await checkMongoRestoreAvailable();
    
    if (!isMongoRestoreAvailable) {
      req.flash('error', 'Không tìm thấy công cụ mongorestore. Vui lòng cài đặt MongoDB Database Tools.');
      return res.redirect('/admin/backup');
    }
    
    const { filename } = req.params;
    const filePath = path.join(BACKUP_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      req.flash('error', 'Không tìm thấy file backup yêu cầu!');
      return res.redirect('/admin/backup');
    }
    
    // Triển khai logic phục hồi từ file backup
    const dbUri = mongoose.connection.client.s.url;
    const command = `mongorestore --uri="${dbUri}" --gzip --archive="${filePath}" --drop`;
    
    // Thêm maxBuffer để xử lý file backup lớn
    const maxBufferSize = 1024 * 1024 * 100; // 100MB buffer
    
    exec(command, { maxBuffer: maxBufferSize }, (error, stdout, stderr) => {
      if (error) {
        console.error('Lỗi khi phục hồi backup:', error);
        req.flash('error', 'Có lỗi xảy ra khi phục hồi backup: ' + error.message);
        return res.redirect('/admin/backup');
      }
      
      req.flash('success', 'Đã phục hồi dữ liệu thành công! Hệ thống sẽ khởi động lại...');
      res.redirect('/admin/backup');
      
      // Trong thực tế, bạn có thể cần khởi động lại ứng dụng sau khi phục hồi
      // process.exit(0);
    });
  } catch (error) {
    console.error('Lỗi khi phục hồi backup:', error);
    req.flash('error', 'Có lỗi xảy ra khi phục hồi backup: ' + error.message);
    res.redirect('/admin/backup');
  }
};

// Kiểm tra xem mongorestore có khả dụng không
const checkMongoRestoreAvailable = () => {
  return new Promise((resolve, reject) => {
    const command = os.platform() === 'win32' ? 'where mongorestore' : 'which mongorestore';
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

// Hàm tạo backup
async function createBackup() {
  return new Promise((resolve, reject) => {
    try {
      const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
      const dbName = mongoose.connection.db.databaseName;
      
      // Đảm bảo đường dẫn sử dụng dấu / trên Windows để tránh lỗi escaping
      const outputFilePath = path.join(BACKUP_DIR, `backup_${dbName}_${timestamp}.gz`)
        .replace(/\\/g, '/');
      
      const dbUri = mongoose.connection.client.s.url;
      const command = `mongodump --uri="${dbUri}" --gzip --archive="${outputFilePath}"`;
      
      // Thêm maxBuffer để xử lý database lớn
      const maxBufferSize = 1024 * 1024 * 100; // 100MB buffer
      
      exec(command, { maxBuffer: maxBufferSize }, (error, stdout, stderr) => {
        if (error) {
          console.error('Lỗi khi tạo backup:', error);
          return reject(error);
        }
        
        console.log('Đã tạo backup thành công:', outputFilePath);
        resolve(outputFilePath);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Hàm lấy danh sách các file backup
function getBackupList() {
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter(file => 
      file.startsWith('backup_') && file.endsWith('.gz')
    );
    
    return files.map(file => {
      const stats = fs.statSync(path.join(BACKUP_DIR, file));
      return {
        filename: file,
        size: formatFileSize(stats.size),
        createdAt: moment(stats.mtime).format('DD/MM/YYYY HH:mm:ss')
      };
    }).sort((a, b) => {
      // Sắp xếp theo thời gian mới nhất trước
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } catch (error) {
    console.error('Lỗi khi đọc danh sách backup:', error);
    return [];
  }
}

// Hàm cập nhật thời gian backup cuối cùng
function updateLastBackupTime() {
  const configPath = path.join(BACKUP_DIR, 'config.json');
  let backupConfig = {
    autoBackup: false,
    backupInterval: 7,
    lastBackup: moment().toISOString()
  };

  if (fs.existsSync(configPath)) {
    try {
      backupConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      backupConfig.lastBackup = moment().toISOString();
    } catch (error) {
      console.error('Lỗi đọc file cấu hình backup:', error);
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(backupConfig, null, 2), 'utf8');
}

// Hàm định dạng kích thước file
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
}

// Hàm kiểm tra và thực hiện backup tự động
exports.checkAndRunAutoBackup = async () => {
  // Kiểm tra xem mongodump có khả dụng không
  const isMongoDumpAvailable = await checkMongoDumpAvailable();
  if (!isMongoDumpAvailable) {
    console.error('Không tìm thấy công cụ mongodump. Backup tự động không thể thực hiện.');
    return;
  }
  
  const configPath = path.join(BACKUP_DIR, 'config.json');
  if (!fs.existsSync(configPath)) {
    return;
  }
  
  try {
    const backupConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!backupConfig.autoBackup) {
      return;
    }
    
    const lastBackup = backupConfig.lastBackup ? moment(backupConfig.lastBackup) : null;
    const now = moment();
    
    if (!lastBackup || now.diff(lastBackup, 'days') >= backupConfig.backupInterval) {
      console.log('Đang thực hiện backup tự động...');
      await createBackup();
      updateLastBackupTime();
      console.log('Đã hoàn thành backup tự động!');
    }
  } catch (error) {
    console.error('Lỗi khi kiểm tra hoặc thực hiện backup tự động:', error);
  }
}; 