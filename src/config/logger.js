/**
 * Module cung cấp các chức năng ghi log cho ứng dụng
 */

const logger = {
  info: function(message) {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`);
  },
  
  warn: function(message) {
    console.warn(`[WARNING] ${new Date().toISOString()}: ${message}`);
  },
  
  error: function(message) {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`);
  },
  
  debug: function(message) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`);
    }
  }
};

module.exports = logger; 