/**
 * Voice-based task creation functionality
 */

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

document.addEventListener('DOMContentLoaded', function() {
    setupVoiceTaskFeature();
});

/**
 * Setup voice recording for task creation
 */
function setupVoiceTaskFeature() {
    const voiceButton = document.getElementById('voice-task-button');
    if (!voiceButton) return;

    const voiceTaskModal = new bootstrap.Modal(document.getElementById('voice-task-modal'));
    
    // Voice recording button click handler
    voiceButton.addEventListener('click', function() {
        voiceTaskModal.show();
        
        // Reset the UI
        document.getElementById('voice-record-button').classList.remove('btn-danger');
        document.getElementById('voice-record-button').classList.add('btn-primary');
        document.getElementById('voice-record-button').innerHTML = '<i class="fas fa-microphone"></i> Start Recording';
        document.getElementById('voice-task-feedback').innerHTML = '';
        document.getElementById('voice-task-form').classList.add('d-none');
        document.getElementById('voice-task-transcript').textContent = '';
        isRecording = false;
    });
    
    // Initialize recording functionality
    const recordButton = document.getElementById('voice-record-button');
    if (recordButton) {
        recordButton.addEventListener('click', toggleRecording);
    }
    
    // Initialize form submission
    const taskForm = document.getElementById('voice-task-form');
    if (taskForm) {
        taskForm.addEventListener('submit', createTaskFromVoice);
    }
}

/**
 * Toggle voice recording on/off
 */
async function toggleRecording() {
    const recordButton = document.getElementById('voice-record-button');
    const feedbackElement = document.getElementById('voice-task-feedback');
    
    if (!isRecording) {
        // Start recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            feedbackElement.innerHTML = '<div class="alert alert-info">Recording... Speak now</div>';
            
            // Configure and start MediaRecorder
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });
            
            mediaRecorder.addEventListener('stop', processRecording);
            
            mediaRecorder.start();
            isRecording = true;
            
            // Update button
            recordButton.classList.remove('btn-primary');
            recordButton.classList.add('btn-danger');
            recordButton.classList.add('recording-pulse');
            recordButton.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            feedbackElement.innerHTML = `<div class="alert alert-danger">Error accessing microphone: ${error.message}</div>`;
        }
    } else {
        // Stop recording
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            isRecording = false;
            
            // Update button
            recordButton.classList.remove('btn-danger');
            recordButton.classList.remove('recording-pulse');
            recordButton.classList.add('btn-primary');
            recordButton.innerHTML = '<i class="fas fa-microphone"></i> Start New Recording';
            
            // Update feedback
            feedbackElement.innerHTML = '<div class="alert alert-info">Processing your voice command...</div>';
        }
    }
}

/**
 * Process the recorded audio
 */
function processRecording() {
    const feedbackElement = document.getElementById('voice-task-feedback');
    
    // Create audio blob from chunks
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    
    // Convert blob to base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    
    reader.onloadend = function() {
        const base64Audio = reader.result;
        
        // Send to backend for processing
        fetch('/api/voice-task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ audio: base64Audio })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Display transcript
                document.getElementById('voice-task-transcript').textContent = data.transcript;
                
                // Populate form with extracted information
                populateTaskForm(data.task_info);
                
                // Show the form
                document.getElementById('voice-task-form').classList.remove('d-none');
                
                // Update feedback
                feedbackElement.innerHTML = '<div class="alert alert-success">Voice command processed successfully! Review and submit the task.</div>';
            } else {
                feedbackElement.innerHTML = `<div class="alert alert-danger">Error: ${data.error}</div>`;
            }
        })
        .catch(error => {
            console.error('Error processing voice command:', error);
            feedbackElement.innerHTML = '<div class="alert alert-danger">Error processing voice command. Please try again.</div>';
        });
    };
}

/**
 * Populate the task form with extracted information
 */
function populateTaskForm(taskInfo) {
    // Populate form fields
    document.getElementById('voice-task-title').value = taskInfo.title || '';
    document.getElementById('voice-task-description').value = taskInfo.description || '';
    document.getElementById('voice-task-service-type').value = taskInfo.service_type || '';
    
    // Set priority if provided
    if (taskInfo.priority && ['low', 'medium', 'high'].includes(taskInfo.priority.toLowerCase())) {
        document.getElementById('voice-task-priority').value = taskInfo.priority.toLowerCase();
    }
    
    // If client name is provided, try to find matching client in dropdown
    if (taskInfo.client_name) {
        const clientSelect = document.getElementById('voice-task-client');
        const clientName = taskInfo.client_name.toLowerCase();
        
        // Try to find matching client - first look for exact matches
        let found = false;
        for (let i = 0; i < clientSelect.options.length; i++) {
            const option = clientSelect.options[i];
            const optionText = option.text.toLowerCase();
            
            // Check if the option text is an exact match or contains the client name
            if (optionText === clientName || optionText.includes(clientName)) {
                clientSelect.value = option.value;
                found = true;
                break;
            }
        }
        
        // If not found, try looking for partial matches
        if (!found) {
            for (let i = 0; i < clientSelect.options.length; i++) {
                const option = clientSelect.options[i];
                const words = taskInfo.client_name.toLowerCase().split(/\s+/);
                
                // Check if any word in the client name matches the option text
                for (const word of words) {
                    if (word.length > 2 && option.text.toLowerCase().includes(word)) {
                        clientSelect.value = option.value;
                        found = true;
                        break;
                    }
                }
                
                if (found) break;
            }
        }
    }
    
    // Set deadline if provided (in days from now)
    if (taskInfo.deadline && !isNaN(taskInfo.deadline)) {
        const daysToAdd = parseInt(taskInfo.deadline);
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + daysToAdd);
        
        // Format the date for datetime-local input (YYYY-MM-DDThh:mm)
        const year = deadlineDate.getFullYear();
        const month = String(deadlineDate.getMonth() + 1).padStart(2, '0');
        const day = String(deadlineDate.getDate()).padStart(2, '0');
        const hours = String(deadlineDate.getHours()).padStart(2, '0');
        const minutes = String(deadlineDate.getMinutes()).padStart(2, '0');
        
        const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}`;
        document.getElementById('voice-task-deadline').value = formattedDate;
    }
    
    // Highlight the populated fields
    highlightPopulatedFields();
}

/**
 * Highlight the fields that were populated from voice command
 */
function highlightPopulatedFields() {
    const fields = [
        'voice-task-title',
        'voice-task-description',
        'voice-task-service-type',
        'voice-task-priority',
        'voice-task-client',
        'voice-task-deadline'
    ];
    
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && field.value) {
            field.classList.add('is-valid');
            
            // Add animation effect
            field.style.animation = 'highlight-field 1.5s ease';
            setTimeout(() => {
                field.style.animation = '';
            }, 1500);
        }
    });
}

/**
 * Create a task from voice input
 */
function createTaskFromVoice(event) {
    event.preventDefault();
    
    const feedbackElement = document.getElementById('voice-task-feedback');
    feedbackElement.innerHTML = '<div class="alert alert-info">Creating task...</div>';
    
    // Get form data
    const formData = new FormData(event.target);
    
    // Send to backend
    fetch('/new-task', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;
        } else {
            return response.text();
        }
    })
    .then(html => {
        if (html) {
            feedbackElement.innerHTML = '<div class="alert alert-danger">Error creating task. Please try again.</div>';
        }
    })
    .catch(error => {
        console.error('Error creating task:', error);
        feedbackElement.innerHTML = '<div class="alert alert-danger">Error creating task. Please try again.</div>';
    });
}