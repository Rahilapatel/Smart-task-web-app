document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });

    // Initialize popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl)
    });

    // Handle notification read status
    setupNotificationHandlers();

    // Add copy functionality for task IDs
    setupCopyToClipboard();

    // Setup file upload previews
    setupFileUploadPreview();
    
    // Setup mobile sidebar toggle functionality
    setupMobileSidebar();
});

/**
 * Setup handlers for marking notifications as read
 */
function setupNotificationHandlers() {
    const notificationLinks = document.querySelectorAll('.notification-link');
    
    notificationLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const notificationId = this.getAttribute('data-notification-id');
            
            if (notificationId) {
                // Mark notification as read when clicked
                fetch(`/mark-notification-read/${notificationId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Update UI to show notification as read
                        this.classList.remove('unread');
                        // Update notification counter if it exists
                        updateNotificationCounter();
                    }
                })
                .catch(error => console.error('Error marking notification as read:', error));
            }
        });
    });
}

/**
 * Update the notification counter in the navbar
 */
function updateNotificationCounter() {
    const counter = document.getElementById('notification-counter');
    if (counter) {
        let count = parseInt(counter.textContent);
        if (count > 0) {
            counter.textContent = count - 1;
            if (count - 1 === 0) {
                counter.style.display = 'none';
            }
        }
    }
}

/**
 * Setup copy to clipboard functionality
 */
function setupCopyToClipboard() {
    const copyButtons = document.querySelectorAll('.copy-btn');
    
    copyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const textToCopy = this.getAttribute('data-clipboard-text');
            
            navigator.clipboard.writeText(textToCopy).then(() => {
                // Show success tooltip
                const tooltip = bootstrap.Tooltip.getInstance(this);
                const originalTitle = this.getAttribute('data-bs-original-title');
                
                this.setAttribute('data-bs-original-title', 'Copied!');
                tooltip.show();
                
                // Reset tooltip after 1 second
                setTimeout(() => {
                    this.setAttribute('data-bs-original-title', originalTitle);
                    tooltip.hide();
                }, 1000);
            }).catch(err => {
                console.error('Could not copy text: ', err);
            });
        });
    });
}

/**
 * Setup file upload preview
 */
function setupFileUploadPreview() {
    const fileInput = document.getElementById('file-upload');
    const filePreview = document.getElementById('file-preview');
    
    if (fileInput && filePreview) {
        fileInput.addEventListener('change', function() {
            filePreview.innerHTML = '';
            
            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                const fileName = document.createElement('div');
                fileName.classList.add('selected-file');
                fileName.innerHTML = `
                    <i class="fas fa-file me-2"></i>
                    <span>${file.name}</span>
                    <small class="text-muted ms-2">(${formatFileSize(file.size)})</small>
                `;
                filePreview.appendChild(fileName);
            }
        });
    }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Filter tasks in the task list
 */
function filterTasks() {
    const searchInput = document.getElementById('search-input');
    const filterStatus = document.getElementById('filter-status');
    const filterPriority = document.getElementById('filter-priority');
    const filterClient = document.getElementById('filter-client');
    
    let url = window.location.pathname + '?';
    
    if (searchInput && searchInput.value) {
        url += `search=${encodeURIComponent(searchInput.value)}&`;
    }
    
    if (filterStatus && filterStatus.value) {
        url += `status=${encodeURIComponent(filterStatus.value)}&`;
    }
    
    if (filterPriority && filterPriority.value) {
        url += `priority=${encodeURIComponent(filterPriority.value)}&`;
    }
    
    if (filterClient && filterClient.value) {
        url += `client_id=${encodeURIComponent(filterClient.value)}&`;
    }
    
    // Remove trailing '&' or '?'
    url = url.replace(/[?&]$/, '');
    
    window.location.href = url;
}

/**
 * Reset all filters
 */
function resetFilters() {
    window.location.href = window.location.pathname;
}

/**
 * Setup mobile sidebar toggle functionality
 */
function setupMobileSidebar() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const contentWrapper = document.getElementById('contentWrapper');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebarToggle && sidebar && overlay) {
        // Toggle sidebar visibility when button is clicked
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            if (contentWrapper) {
                contentWrapper.classList.toggle('sidebar-active');
            }
        });
        
        // Close sidebar when clicking overlay
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            if (contentWrapper) {
                contentWrapper.classList.remove('sidebar-active');
            }
        });
        
        // Close sidebar when clicking on a navigation link (for mobile)
        const sidebarLinks = sidebar.querySelectorAll('a.nav-link');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth < 768) {
                    sidebar.classList.remove('active');
                    overlay.classList.remove('active');
                    if (contentWrapper) {
                        contentWrapper.classList.remove('sidebar-active');
                    }
                }
            });
        });
    }
}
