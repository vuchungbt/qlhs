document.addEventListener('DOMContentLoaded', function() {
    // Đánh dấu menu item hiện tại dựa vào URL
    highlightCurrentPage();
    
    // Thêm hiệu ứng khi hover menu items
    addMenuHoverEffects();
    
    // Thêm chức năng hiển thị tooltip cho menu items
    initializeTooltips();
    
    // Thêm hiệu ứng ripple khi click vào menu items
    addRippleEffect();

    // Thêm chức năng thông báo nhanh khi click vào menu items
    addQuickNotifications();

    // Khởi tạo menu dropdown
    initializeDropdowns();
});

// Đánh dấu menu item hiện tại
function highlightCurrentPage() {
    const currentPath = window.location.pathname;
    const menuLinks = document.querySelectorAll('.sidebar .nav-link');
    
    // Xử lý trường hợp đặc biệt cho attendance/student
    if (currentPath.includes('/attendance/student')) {
        menuLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href === "#") return;
            
            // Chỉ active menu điểm danh, không active menu học sinh
            if (href === '/academic/attendance') {
                link.classList.add('active');
                link.style.borderLeft = '4px solid #3b82f6';
                link.style.paddingLeft = '12px';
                link.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            } else if (href === '/academic/students') {
                // Đảm bảo rằng menu học sinh không được active
                link.classList.remove('active');
                link.style.borderLeft = '';
                link.style.paddingLeft = '';
                link.style.backgroundColor = '';
            }
        });
        return;
    }
    
    menuLinks.forEach(link => {
        // Kiểm tra xem URL hiện tại có khớp với href của link không
        const href = link.getAttribute('href');
        if (!href || href === "#") return; // Bỏ qua nếu href không tồn tại hoặc là #
        
        if (href === currentPath || 
            (currentPath.includes(href) && href !== '/')) {
            link.classList.add('active');
            // Thêm border trái để làm nổi bật menu item đang active
            link.style.borderLeft = '4px solid #3b82f6';
            link.style.paddingLeft = '12px';
            link.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        }
    });
}

// Thêm hiệu ứng hover cho menu
function addMenuHoverEffects() {
    const menuLinks = document.querySelectorAll('.sidebar .nav-link');
    
    menuLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            if (!this.classList.contains('active')) {
                this.style.transform = 'translateX(5px)';
                this.style.transition = 'all 0.3s ease';
            }
        });
        
        link.addEventListener('mouseleave', function() {
            if (!this.classList.contains('active')) {
                this.style.transform = 'translateX(0)';
            }
        });
    });
}

// Khởi tạo tooltips cho menu items
function initializeTooltips() {
    try {
        if (typeof bootstrap !== 'undefined') {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        } else {
            console.warn("Bootstrap không được tìm thấy cho tooltips");
        }
    } catch (e) {
        console.error("Lỗi khi khởi tạo tooltips:", e);
    }
}

// Thêm hiệu ứng ripple khi click vào menu items
function addRippleEffect() {
    const menuLinks = document.querySelectorAll('.sidebar .nav-link');
    
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

// Thêm chức năng thông báo nhanh khi click vào menu
function addQuickNotifications() {
    // Tạo container thông báo nếu chưa tồn tại
    if (!document.getElementById('notificationContainer')) {
        const notifContainer = document.createElement('div');
        notifContainer.id = 'notificationContainer';
        notifContainer.className = 'position-fixed bottom-0 end-0 p-3';
        notifContainer.style.zIndex = '5';
        document.body.appendChild(notifContainer);
    }

    // Thêm sự kiện cho các menu item
    const menuLinks = document.querySelectorAll('.sidebar .nav-link');
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Chỉ hiển thị thông báo nếu menu có badge
            if (this.querySelector('.badge-notify')) {
                // Lấy tên menu
                const menuName = this.querySelector('span')?.innerText || 'menu';
                // Hiển thị thông báo
                showNotification(`Đang chuyển đến ${menuName}...`, 'info');
            }
        });
    });
}

// Hiển thị thông báo
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
    // Tạo toast notification
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'info' ? 'primary' : type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    const toastContent = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toast.innerHTML = toastContent;
    container.appendChild(toast);
    
    // Hiển thị toast 
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const bsToast = new bootstrap.Toast(toast, {
            animation: true,
            autohide: true,
            delay: 2000
        });
        
        bsToast.show();
        
        // Xóa toast sau khi ẩn
        toast.addEventListener('hidden.bs.toast', function() {
            toast.remove();
        });
    } else {
        // Fallback nếu bootstrap không có sẵn
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 2000);
    }
}

// Khởi tạo menu dropdown
function initializeDropdowns() {
    // Kích hoạt tất cả dropdown thủ công
    const dropdownToggleList = document.querySelectorAll('.dropdown-toggle');
    dropdownToggleList.forEach(dropdownToggle => {
        // Đảm bảo sự kiện click được đăng ký đúng
        dropdownToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Lấy dropdown menu liên quan
            const dropdownMenu = this.nextElementSibling;
            
            // Đóng tất cả dropdown menu khác
            const allDropdownMenus = document.querySelectorAll('.dropdown-menu.show');
            allDropdownMenus.forEach(menu => {
                if (menu !== dropdownMenu) {
                    menu.classList.remove('show');
                }
            });
            
            // Toggle dropdown hiện tại
            dropdownMenu.classList.toggle('show');
            
            // Toggle class show cho dropdown container
            this.parentElement.classList.toggle('show');
        });
    });
    
    // Đóng dropdown khi click bên ngoài
    document.addEventListener('click', function(e) {
        // Kiểm tra xem người dùng đã click vào dropdown toggle hay không
        const isDropdownToggle = e.target.classList.contains('dropdown-toggle') || 
                                e.target.closest('.dropdown-toggle');
        
        if (!isDropdownToggle) {
            // Đóng tất cả dropdown nếu click bên ngoài
            const dropdownMenus = document.querySelectorAll('.dropdown-menu.show');
            dropdownMenus.forEach(menu => {
                menu.classList.remove('show');
                
                // Cũng xóa class show trên phần tử cha
                if (menu.parentElement) {
                    menu.parentElement.classList.remove('show');
                }
            });
        }
    });
    
    console.log('Dropdown menu đã được khởi tạo thủ công');
} 