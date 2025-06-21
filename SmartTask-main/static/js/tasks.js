document.addEventListener('DOMContentLoaded', function() {
    // Setup due date highlight
    highlightDueDates();
    
    // Setup confirmation dialogs
    setupConfirmationDialogs();
    
    // Setup comment handlers
    setupCommentHandlers();
    
    // Setup task status update handlers
    setupTaskStatusHandlers();
});

/**
 * Highlight due dates based on their proximity
 */
function highlightDueDates() {
    const dueDateElements = document.querySelectorAll('.due-date');
    
    dueDateElements.forEach(element => {
        const dueDate = new Date(element.getAttribute('data-date'));
        const today = new Date();
        
        // Check if the due date is in the past
        if (dueDate < today) {
            element.classList.add('text-danger', 'fw-bold');
            element.setAttribute('data-bs-original-title', 'Overdue');
        } 
        // Check if the due date is within the next 2 days
        else if ((dueDate - today) / (1000 * 60 * 60 * 24) < 2) {
            element.classList.add('text-warning', 'fw-bold');
            element.setAttribute('data-bs-original-title', 'Due soon');
        }
    });
}

/**
 * Setup confirmation dialogs for delete operations
 */
function setupConfirmationDialogs() {
    const deleteButtons = document.querySelectorAll('[data-confirm]');
    
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const confirmMessage = this.getAttribute('data-confirm');
            
            if (!confirm(confirmMessage)) {
                e.preventDefault();
                return false;
            }
        });
    });
}

/**
 * Setup comment form handlers
 */
function setupCommentHandlers() {
    const commentForm = document.getElementById('comment-form');
    const commentInput = document.getElementById('comment-input');
    
    if (commentForm && commentInput) {
        commentForm.addEventListener('submit', function(e) {
            if (!commentInput.value.trim()) {
                e.preventDefault();
                alert('Comment cannot be empty');
                return false;
            }
        });
    }
}

/**
 * Setup task status update handlers for AJAX updates
 */
function setupTaskStatusHandlers() {
    const taskStatusForms = document.querySelectorAll('.task-status-form');
    
    taskStatusForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const taskId = this.getAttribute('data-task-id');
            const statusValue = this.querySelector('input[name="status"]').value;
            const submitButton = this.querySelector('button[type="submit"]');
            
            // Add loading state
            submitButton.classList.add('loading', 'task-status-btn');
            submitButton.disabled = true;
            
            // Create form data
            const formData = new FormData();
            formData.append('status', statusValue);
            
            // Send AJAX request
            fetch(`/client/tasks/${taskId}/update-status`, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                // Remove loading state
                submitButton.classList.remove('loading');
                
                if (data.success) {
                    // Add success animation
                    submitButton.classList.add('status-update-success');
                    
                    // Update task status badge
                    updateTaskStatusUI(taskId, statusValue);
                    
                    // Update buttons state
                    updateTaskButtonsState(taskId, statusValue);
                    
                    // Show success message
                    showStatusUpdateMessage(data.message, 'success');
                    
                    // Remove success animation after a delay
                    setTimeout(() => {
                        submitButton.classList.remove('status-update-success');
                    }, 1000);
                } else {
                    // Show error message
                    showStatusUpdateMessage(data.message || 'Failed to update task status', 'danger');
                    submitButton.disabled = false;
                }
            })
            .catch(error => {
                console.error('Error updating task status:', error);
                submitButton.classList.remove('loading');
                submitButton.disabled = false;
                showStatusUpdateMessage('An error occurred while updating task status', 'danger');
            });
        });
    });
}

/**
 * Update task status UI elements
 */
function updateTaskStatusUI(taskId, newStatus) {
    // Update status badge
    const statusBadges = document.querySelectorAll(`.task-status-badge-${taskId}`);
    
    statusBadges.forEach(badge => {
        // Remove existing status classes
        badge.classList.remove('bg-secondary', 'bg-primary', 'bg-success');
        
        // Add appropriate class based on new status
        if (newStatus === 'completed') {
            badge.classList.add('bg-success');
            badge.textContent = 'completed';
        } else if (newStatus === 'in-progress') {
            badge.classList.add('bg-primary');
            badge.textContent = 'in-progress';
        } else {
            badge.classList.add('bg-secondary');
            badge.textContent = 'pending';
        }
    });
}

/**
 * Update task buttons state based on new status
 */
function updateTaskButtonsState(taskId, newStatus) {
    const startButtons = document.querySelectorAll(`.task-start-btn-${taskId}`);
    const completeButtons = document.querySelectorAll(`.task-complete-btn-${taskId}`);
    
    startButtons.forEach(button => {
        if (newStatus === 'in-progress' || newStatus === 'completed') {
            button.disabled = true;
        } else {
            button.disabled = false;
        }
    });
    
    completeButtons.forEach(button => {
        if (newStatus === 'completed') {
            button.disabled = true;
        } else {
            button.disabled = false;
        }
    });
}

/**
 * Show status update message
 */
function showStatusUpdateMessage(message, type) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show status-alert`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Find alert container or create one
    let alertContainer = document.querySelector('.alert-container');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.className = 'alert-container position-fixed top-0 end-0 p-3';
        alertContainer.style.zIndex = '1050';
        document.body.appendChild(alertContainer);
    }
    
    // Add alert to container
    alertContainer.appendChild(alertDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => {
            alertDiv.remove();
        }, 150);
    }, 5000);
}

/**
 * Mark notification as read
 */
function markNotificationRead(notificationId) {
    fetch(`/mark-notification-read/${notificationId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update UI to show notification as read
            const notificationElement = document.getElementById(`notification-${notificationId}`);
            if (notificationElement) {
                notificationElement.classList.remove('unread-notification');
                notificationElement.classList.add('read-notification');
            }
            
            // Update notification counter
            updateNotificationCounter();
        }
    })
    .catch(error => console.error('Error marking notification as read:', error));
}
