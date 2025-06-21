/**
 * AI-powered task management functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // AI Task Generation
    setupAITaskGenerator();
    
    // Task Status AJAX updates
    setupTaskStatusUpdates();
});

/**
 * Setup AI task generation functionality
 */
function setupAITaskGenerator() {
    const generateBtn = document.getElementById('generate-task-btn');
    const analyzePriorityBtn = document.getElementById('analyze-priority-btn');
    
    if (generateBtn) {
        generateBtn.addEventListener('click', function() {
            generateTaskDescription();
        });
    }
    
    if (analyzePriorityBtn) {
        analyzePriorityBtn.addEventListener('click', function() {
            analyzeTaskPriority();
        });
    }
}

/**
 * Generate task description using AI
 */
function generateTaskDescription() {
    const serviceType = document.getElementById('ai_service_type').value;
    const keywords = document.getElementById('ai_keywords').value;
    const statusDiv = document.getElementById('ai-generation-status');
    
    if (!serviceType || !keywords) {
        statusDiv.innerHTML = '<div class="alert alert-warning">Please select a service type and enter keywords</div>';
        return;
    }
    
    // Show loading indicator
    statusDiv.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div> Generating task description...';
    
    // Get client name if available
    const clientSelect = document.getElementById('client_id');
    let clientName = null;
    if (clientSelect && clientSelect.selectedIndex > 0) {
        clientName = clientSelect.options[clientSelect.selectedIndex].text.split(' (')[0];
    }
    
    // Get current priority
    const prioritySelect = document.getElementById('priority');
    let priority = null;
    if (prioritySelect && prioritySelect.value) {
        priority = prioritySelect.value;
    }
    
    // Prepare form data
    const formData = new FormData();
    formData.append('service_type', serviceType);
    formData.append('keywords', keywords);
    if (clientName) formData.append('client_name', clientName);
    if (priority) formData.append('priority', priority);
    
    // Send request to generate task description
    fetch('/api/generate-task-description', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update form fields with generated content
            document.getElementById('title').value = data.title;
            document.getElementById('description').value = data.description;
            document.getElementById('service_type').value = serviceType;
            
            // Show success message
            statusDiv.innerHTML = '<div class="alert alert-success">Task description generated successfully!</div>';
        } else {
            // Show error message
            statusDiv.innerHTML = `<div class="alert alert-danger">Error: ${data.error || 'Failed to generate task description'}</div>`;
        }
    })
    .catch(error => {
        console.error('Error generating task description:', error);
        statusDiv.innerHTML = '<div class="alert alert-danger">An error occurred while generating the task description</div>';
    });
}

/**
 * Analyze task description to suggest priority
 */
function analyzeTaskPriority() {
    const description = document.getElementById('description').value;
    const statusDiv = document.getElementById('ai-generation-status');
    
    if (!description) {
        statusDiv.innerHTML = '<div class="alert alert-warning">Please enter a task description first</div>';
        return;
    }
    
    // Show loading indicator
    statusDiv.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div> Analyzing task priority...';
    
    // Get deadline if available
    const deadlineInput = document.getElementById('deadline');
    let deadlineDays = null;
    
    if (deadlineInput && deadlineInput.value) {
        const deadlineDate = new Date(deadlineInput.value);
        const today = new Date();
        const diffTime = deadlineDate - today;
        deadlineDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // Prepare form data
    const formData = new FormData();
    formData.append('description', description);
    if (deadlineDays !== null) formData.append('deadline_days', deadlineDays);
    
    // Send request to analyze priority
    fetch('/api/analyze-priority', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update priority field
            document.getElementById('priority').value = data.priority;
            
            // Show success message with explanation
            let priorityDisplay = data.priority.charAt(0).toUpperCase() + data.priority.slice(1);
            statusDiv.innerHTML = `<div class="alert alert-success">AI suggests <strong>${priorityDisplay}</strong> priority for this task based on its content${deadlineDays ? ' and deadline' : ''}.</div>`;
        } else {
            // Show error message
            statusDiv.innerHTML = `<div class="alert alert-danger">Error: ${data.error || 'Failed to analyze task priority'}</div>`;
        }
    })
    .catch(error => {
        console.error('Error analyzing task priority:', error);
        statusDiv.innerHTML = '<div class="alert alert-danger">An error occurred while analyzing the task priority</div>';
    });
}

/**
 * Setup task status update functionality using AJAX
 */
function setupTaskStatusUpdates() {
    const statusForms = document.querySelectorAll('.task-status-form');
    
    statusForms.forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const taskId = this.dataset.taskId;
            const formData = new FormData(this);
            const newStatus = formData.get('status');
            
            // Show loading state
            const submitButton = this.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
            
            // Send AJAX request
            fetch(this.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update UI elements
                    updateTaskStatusUI(taskId, newStatus, data.statusBadgeClass);
                    
                    // Show success message
                    showStatusUpdateMessage(data.message, 'success');
                } else {
                    // Show error message
                    showStatusUpdateMessage(data.message || 'Failed to update task status', 'danger');
                    
                    // Reset button state
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonText;
                }
            })
            .catch(error => {
                console.error('Error updating task status:', error);
                showStatusUpdateMessage('An error occurred while updating the task status', 'danger');
                
                // Reset button state
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            });
        });
    });
}

/**
 * Update task status UI elements
 */
function updateTaskStatusUI(taskId, newStatus, statusBadgeClass) {
    // Update status badge
    const statusBadge = document.querySelector(`.task-status-badge-${taskId}`);
    if (statusBadge) {
        statusBadge.textContent = newStatus;
        
        // Update badge class
        if (statusBadgeClass) {
            statusBadge.className = `badge ${statusBadgeClass} task-status-badge-${taskId}`;
        } else {
            // Default classes if not provided by server
            if (newStatus === 'completed') {
                statusBadge.className = `badge bg-success task-status-badge-${taskId}`;
            } else if (newStatus === 'in-progress') {
                statusBadge.className = `badge bg-primary task-status-badge-${taskId}`;
            } else {
                statusBadge.className = `badge bg-secondary task-status-badge-${taskId}`;
            }
        }
    }
    
    // Update buttons state
    const startButton = document.querySelector(`.task-start-btn-${taskId}`);
    const completeButton = document.querySelector(`.task-complete-btn-${taskId}`);
    
    if (startButton && completeButton) {
        if (newStatus === 'in-progress' || newStatus === 'completed') {
            startButton.disabled = true;
        } else {
            startButton.disabled = false;
        }
        
        if (newStatus === 'completed') {
            completeButton.disabled = true;
        } else {
            completeButton.disabled = false;
        }
    }
}

/**
 * Show status update message
 */
function showStatusUpdateMessage(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    alertDiv.role = 'alert';
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Find the appropriate container to add the message
    const container = document.querySelector('.task-detail-header') || 
                      document.querySelector('.task-detail-container') ||
                      document.querySelector('.container');
    
    if (container) {
        container.prepend(alertDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
}