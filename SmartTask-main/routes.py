import os
import uuid
from datetime import datetime
from functools import wraps

from flask import render_template, redirect, url_for, flash, request, jsonify, send_from_directory, abort, make_response
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.utils import secure_filename

from app import app, db
from models import User, Task, Comment, Attachment, Notification
from auth import admin_required, client_required
from utils import send_task_notification_email, get_status_badge_class, generate_ai_task_description, analyze_task_priority


@app.route('/')
def index():
    if current_user.is_authenticated:
        if current_user.role == 'admin':
            return redirect(url_for('admin_dashboard'))
        else:
            return redirect(url_for('client_dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
        
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            login_user(user)
            next_page = request.args.get('next')
            flash('Login successful!', 'success')
            
            if next_page:
                return redirect(next_page)
            return redirect(url_for('index'))
        else:
            flash('Login unsuccessful. Please check email and password', 'danger')
    
    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
        
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        role = request.form.get('role', 'client')
        
        # Validate that role is either 'admin' or 'client'
        if role not in ['admin', 'client']:
            role = 'client'
        
        # Check if email already exists
        user_email = User.query.filter_by(email=email).first()
        if user_email:
            flash('Email already exists', 'danger')
            return render_template('register.html')
            
        # Check if username already exists
        user_username = User.query.filter_by(username=username).first()
        if user_username:
            flash('Username already exists', 'danger')
            return render_template('register.html')
            
        # Check if passwords match
        if password != confirm_password:
            flash('Passwords do not match', 'danger')
            return render_template('register.html')
            
        # Create new user
        new_user = User(username=username, email=email, role=role)
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
        
        flash('Your account has been created! You can now log in', 'success')
        return redirect(url_for('login'))
        
    return render_template('register.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('login'))


@app.route('/admin/dashboard')
@login_required
@admin_required
def admin_dashboard():
    # Get counts for dashboard
    total_tasks = Task.query.filter_by(creator_id=current_user.id).count()
    pending_tasks = Task.query.filter_by(creator_id=current_user.id, status='pending').count()
    in_progress_tasks = Task.query.filter_by(creator_id=current_user.id, status='in-progress').count()
    completed_tasks = Task.query.filter_by(creator_id=current_user.id, status='completed').count()
    
    # Get clients for this admin
    clients = User.query.filter_by(role='client').all()
    
    # Get recent tasks
    recent_tasks = Task.query.filter_by(creator_id=current_user.id).order_by(Task.created_at.desc()).limit(5).all()
    
    # Get tasks due soon (in the next 7 days)
    today = datetime.utcnow()
    due_soon = Task.query.filter(
        Task.creator_id == current_user.id,
        Task.status != 'completed',
        Task.deadline > today
    ).order_by(Task.deadline).limit(5).all()
    
    return render_template(
        'admin/dashboard.html',
        total_tasks=total_tasks,
        pending_tasks=pending_tasks,
        in_progress_tasks=in_progress_tasks,
        completed_tasks=completed_tasks,
        clients=clients,
        recent_tasks=recent_tasks,
        due_soon=due_soon
    )


@app.route('/admin/tasks')
@login_required
@admin_required
def admin_tasks():
    # Get filter parameters
    status = request.args.get('status', '')
    priority = request.args.get('priority', '')
    client_id = request.args.get('client_id', '')
    search = request.args.get('search', '')
    
    # Build the query
    query = Task.query.filter_by(creator_id=current_user.id)
    
    if status:
        query = query.filter_by(status=status)
    if priority:
        query = query.filter_by(priority=priority)
    if client_id and client_id.isdigit():
        query = query.filter_by(client_id=int(client_id))
    if search:
        query = query.filter(Task.title.contains(search) | Task.description.contains(search))
    
    # Sort by creation date (newest first)
    tasks = query.order_by(Task.created_at.desc()).all()
    
    # Get all clients for the filter dropdown
    clients = User.query.filter_by(role='client').all()
    
    return render_template('admin/tasks.html', tasks=tasks, clients=clients)


@app.route('/admin/clients')
@login_required
@admin_required
def admin_clients():
    clients = User.query.filter_by(role='client').all()
    
    # Get task counts for each client
    client_data = []
    for client in clients:
        total_tasks = Task.query.filter_by(client_id=client.id, creator_id=current_user.id).count()
        completed_tasks = Task.query.filter_by(client_id=client.id, creator_id=current_user.id, status='completed').count()
        
        # Calculate completion rate
        completion_rate = 0
        if total_tasks > 0:
            completion_rate = (completed_tasks / total_tasks) * 100
            
        client_data.append({
            'client': client,
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'completion_rate': completion_rate
        })
    
    return render_template('admin/clients.html', client_data=client_data)


@app.route('/admin/tasks/new', methods=['GET', 'POST'])
@login_required
@admin_required
def new_task():
    if request.method == 'POST':
        title = request.form.get('title')
        description = request.form.get('description')
        client_id = request.form.get('client_id')
        service_type = request.form.get('service_type')
        priority = request.form.get('priority')
        deadline_str = request.form.get('deadline')
        
        if not title or not client_id:
            flash('Title and client are required!', 'danger')
            clients = User.query.filter_by(role='client').all()
            return render_template('admin/task_form.html', clients=clients)
        
        # Parse the deadline if provided
        deadline = None
        if deadline_str:
            try:
                deadline = datetime.strptime(deadline_str, '%Y-%m-%dT%H:%M')
            except ValueError:
                flash('Invalid deadline format', 'danger')
                clients = User.query.filter_by(role='client').all()
                return render_template('admin/task_form.html', clients=clients)
        
        # Create new task
        new_task = Task(
            title=title,
            description=description,
            service_type=service_type,
            priority=priority,
            deadline=deadline,
            client_id=client_id,
            creator_id=current_user.id,
            status='pending'
        )
        
        db.session.add(new_task)
        db.session.commit()
        
        # Create notification for the client
        notification = Notification(
            title="New Task Assigned",
            message=f"You have been assigned a new task: {title}",
            user_id=client_id,
            task_id=new_task.id
        )
        db.session.add(notification)
        db.session.commit()
        
        # Send email notification
        client = User.query.get(client_id)
        if client:
            send_task_notification_email(client.email, "New Task Assigned", 
                                        f"You have been assigned a new task: {title}")
        
        flash('Task created successfully!', 'success')
        return redirect(url_for('admin_tasks'))
    
    # GET request - show the form
    clients = User.query.filter_by(role='client').all()
    return render_template('admin/task_form.html', clients=clients)


@app.route('/admin/tasks/<int:task_id>/edit', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_task(task_id):
    task = Task.query.get_or_404(task_id)
    
    # Make sure the admin is the creator of this task
    if task.creator_id != current_user.id:
        flash('You are not authorized to edit this task', 'danger')
        return redirect(url_for('admin_tasks'))
    
    if request.method == 'POST':
        task.title = request.form.get('title')
        task.description = request.form.get('description')
        task.client_id = request.form.get('client_id')
        task.service_type = request.form.get('service_type')
        task.priority = request.form.get('priority')
        deadline_str = request.form.get('deadline')
        
        # Parse the deadline if provided
        if deadline_str:
            try:
                task.deadline = datetime.strptime(deadline_str, '%Y-%m-%dT%H:%M')
            except ValueError:
                flash('Invalid deadline format', 'danger')
                clients = User.query.filter_by(role='client').all()
                return render_template('admin/task_form.html', task=task, clients=clients)
        
        db.session.commit()
        
        # Create notification for the client
        notification = Notification(
            title="Task Updated",
            message=f"A task assigned to you has been updated: {task.title}",
            user_id=task.client_id,
            task_id=task.id
        )
        db.session.add(notification)
        db.session.commit()
        
        # Send email notification
        client = User.query.get(task.client_id)
        if client:
            send_task_notification_email(client.email, "Task Updated", 
                                        f"A task assigned to you has been updated: {task.title}")
        
        flash('Task updated successfully!', 'success')
        return redirect(url_for('admin_tasks'))
    
    # GET request - show the form with task data
    clients = User.query.filter_by(role='client').all()
    return render_template('admin/task_form.html', task=task, clients=clients)


@app.route('/admin/tasks/<int:task_id>/delete', methods=['POST'])
@login_required
@admin_required
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    
    # Make sure the admin is the creator of this task
    if task.creator_id != current_user.id:
        flash('You are not authorized to delete this task', 'danger')
        return redirect(url_for('admin_tasks'))
    
    db.session.delete(task)
    db.session.commit()
    
    flash('Task deleted successfully!', 'success')
    return redirect(url_for('admin_tasks'))


@app.route('/client/dashboard')
@login_required
@client_required
def client_dashboard():
    # Get counts for dashboard
    total_tasks = Task.query.filter_by(client_id=current_user.id).count()
    pending_tasks = Task.query.filter_by(client_id=current_user.id, status='pending').count()
    in_progress_tasks = Task.query.filter_by(client_id=current_user.id, status='in-progress').count()
    completed_tasks = Task.query.filter_by(client_id=current_user.id, status='completed').count()
    
    # Get recent tasks
    recent_tasks = Task.query.filter_by(client_id=current_user.id).order_by(Task.created_at.desc()).limit(5).all()
    
    # Get tasks due soon (in the next 7 days)
    today = datetime.utcnow()
    due_soon = Task.query.filter(
        Task.client_id == current_user.id,
        Task.status != 'completed',
        Task.deadline > today
    ).order_by(Task.deadline).limit(5).all()
    
    # Get unread notifications
    notifications = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).order_by(Notification.created_at.desc()).limit(5).all()
    
    return render_template(
        'client/dashboard.html',
        total_tasks=total_tasks,
        pending_tasks=pending_tasks,
        in_progress_tasks=in_progress_tasks,
        completed_tasks=completed_tasks,
        recent_tasks=recent_tasks,
        due_soon=due_soon,
        notifications=notifications
    )


@app.route('/client/tasks')
@login_required
@client_required
def client_tasks():
    # Get filter parameters
    status = request.args.get('status', '')
    priority = request.args.get('priority', '')
    search = request.args.get('search', '')
    
    # Build the query
    query = Task.query.filter_by(client_id=current_user.id)
    
    if status:
        query = query.filter_by(status=status)
    if priority:
        query = query.filter_by(priority=priority)
    if search:
        query = query.filter(Task.title.contains(search) | Task.description.contains(search))
    
    # Sort by creation date (newest first)
    tasks = query.order_by(Task.created_at.desc()).all()
    
    return render_template('client/tasks.html', tasks=tasks)


@app.route('/client/tasks/<int:task_id>')
@login_required
@client_required
def client_task_detail(task_id):
    task = Task.query.get_or_404(task_id)
    
    # Make sure the client is assigned to this task
    if task.client_id != current_user.id:
        flash('You are not authorized to view this task', 'danger')
        return redirect(url_for('client_tasks'))
    
    # Get comments for this task
    comments = Comment.query.filter_by(task_id=task_id).order_by(Comment.created_at).all()
    
    # Get attachments for this task
    attachments = Attachment.query.filter_by(task_id=task_id).order_by(Attachment.uploaded_at.desc()).all()
    
    return render_template('client/task_detail.html', task=task, comments=comments, attachments=attachments, datetime=datetime)


@app.route('/client/tasks/<int:task_id>/update-status', methods=['POST'])
@login_required
@client_required
def update_task_status(task_id):
    task = Task.query.get_or_404(task_id)
    
    # Make sure the client is assigned to this task
    if task.client_id != current_user.id:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'message': 'You are not authorized to update this task'})
        flash('You are not authorized to update this task', 'danger')
        return redirect(url_for('client_tasks'))
    
    new_status = request.form.get('status')
    if new_status in ['pending', 'in-progress', 'completed']:
        # Only update if the status is actually changing
        if task.status != new_status:
            old_status = task.status
            task.status = new_status
            task.updated_at = datetime.utcnow()
            db.session.commit()
            
            # Create notification for the admin
            notification = Notification(
                title="Task Status Updated",
                message=f"Task '{task.title}' status updated from {old_status} to {new_status}",
                user_id=task.creator_id,
                task_id=task.id
            )
            db.session.add(notification)
            db.session.commit()
            
            # Send email notification
            admin = User.query.get(task.creator_id)
            if admin:
                send_task_notification_email(admin.email, "Task Status Updated", 
                                            f"Task '{task.title}' status updated from {old_status} to {new_status}")
        
        # Check if this is an AJAX request or a regular form submission
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({
                'success': True, 
                'message': f'Task status updated to {new_status}',
                'task_id': task_id,
                'new_status': new_status
            })
        
        flash(f'Task status updated to {new_status}', 'success')
        return redirect(url_for('client_task_detail', task_id=task_id))
    else:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'message': 'Invalid status value'})
        
        flash('Invalid status value', 'danger')
        return redirect(url_for('client_task_detail', task_id=task_id))


@app.route('/tasks/<int:task_id>/comments', methods=['POST'])
@login_required
def add_comment(task_id):
    task = Task.query.get_or_404(task_id)
    
    # Check authorization (both client assigned to task and admin creator can comment)
    if current_user.id != task.client_id and current_user.id != task.creator_id:
        flash('You are not authorized to comment on this task', 'danger')
        if current_user.role == 'admin':
            return redirect(url_for('admin_tasks'))
        else:
            return redirect(url_for('client_tasks'))
    
    content = request.form.get('content')
    if not content:
        flash('Comment cannot be empty', 'danger')
    else:
        comment = Comment(
            content=content,
            task_id=task_id,
            user_id=current_user.id
        )
        db.session.add(comment)
        db.session.commit()
        
        # Notify the other party
        recipient_id = task.client_id if current_user.id == task.creator_id else task.creator_id
        notification = Notification(
            title="New Comment",
            message=f"New comment on task '{task.title}'",
            user_id=recipient_id,
            task_id=task.id
        )
        db.session.add(notification)
        db.session.commit()
        
        flash('Comment added successfully', 'success')
    
    # Redirect back to the appropriate page
    if current_user.role == 'admin':
        return redirect(url_for('admin_tasks'))
    else:
        return redirect(url_for('client_task_detail', task_id=task_id))


@app.route('/tasks/<int:task_id>/attachments', methods=['POST'])
@login_required
def upload_attachment(task_id):
    task = Task.query.get_or_404(task_id)
    
    # Check authorization (both client assigned to task and admin creator can upload)
    if current_user.id != task.client_id and current_user.id != task.creator_id:
        flash('You are not authorized to upload attachments to this task', 'danger')
        if current_user.role == 'admin':
            return redirect(url_for('admin_tasks'))
        else:
            return redirect(url_for('client_tasks'))
    
    # Check if the post request has the file part
    if 'file' not in request.files:
        flash('No file part', 'danger')
        if current_user.role == 'admin':
            return redirect(url_for('admin_tasks'))
        else:
            return redirect(url_for('client_task_detail', task_id=task_id))
    
    file = request.files['file']
    
    # If user does not select file, browser submits an empty part without filename
    if file.filename == '':
        flash('No selected file', 'danger')
        if current_user.role == 'admin':
            return redirect(url_for('admin_tasks'))
        else:
            return redirect(url_for('client_task_detail', task_id=task_id))
    
    if file:
        # Create a unique filename to prevent conflicts
        original_filename = secure_filename(file.filename)
        file_ext = os.path.splitext(original_filename)[1]
        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        
        # Save the file
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        # Create DB record
        attachment = Attachment(
            filename=unique_filename,
            original_filename=original_filename,
            file_type=file.content_type,
            task_id=task_id,
            user_id=current_user.id
        )
        db.session.add(attachment)
        db.session.commit()
        
        # Notify the other party
        recipient_id = task.client_id if current_user.id == task.creator_id else task.creator_id
        notification = Notification(
            title="New Attachment",
            message=f"New file attached to task '{task.title}'",
            user_id=recipient_id,
            task_id=task.id
        )
        db.session.add(notification)
        db.session.commit()
        
        flash('File uploaded successfully', 'success')
    
    # Redirect back to the appropriate page
    if current_user.role == 'admin':
        return redirect(url_for('admin_tasks'))
    else:
        return redirect(url_for('client_task_detail', task_id=task_id))


@app.route('/download/<filename>')
@login_required
def download_file(filename):
    attachment = Attachment.query.filter_by(filename=filename).first_or_404()
    task = Task.query.get_or_404(attachment.task_id)
    
    # Check authorization (both client assigned to task and admin creator can download)
    if current_user.id != task.client_id and current_user.id != task.creator_id:
        abort(403)
    
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True, 
                               download_name=attachment.original_filename)


@app.route('/mark-notification-read/<int:notification_id>', methods=['POST'])
@login_required
def mark_notification_read(notification_id):
    notification = Notification.query.get_or_404(notification_id)
    
    # Make sure the notification belongs to the current user
    if notification.user_id != current_user.id:
        abort(403)
    
    notification.is_read = True
    db.session.commit()
    
    return jsonify({'success': True})


@app.route('/toggle-theme', methods=['POST'])
def toggle_theme():
    theme = request.form.get('theme', 'light')
    resp = redirect(request.referrer or url_for('index'))
    resp.set_cookie('theme', theme, max_age=30*24*60*60)  # 30 days
    return resp


@app.route('/api/generate-task-description', methods=['POST'])
@login_required
@admin_required
def generate_task_description_api():
    """API endpoint to generate task descriptions using AI"""
    service_type = request.form.get('service_type', '')
    keywords = request.form.get('keywords', '')
    client_name = request.form.get('client_name', None)
    priority = request.form.get('priority', None)
    
    if not service_type or not keywords:
        return jsonify({
            'success': False,
            'error': 'Service type and keywords are required'
        }), 400
    
    result = generate_ai_task_description(service_type, keywords, client_name, priority)
    
    if result.get('success', False):
        return jsonify({
            'success': True,
            'title': result['title'],
            'description': result['description']
        })
    else:
        return jsonify({
            'success': False,
            'error': result.get('error', 'Failed to generate task description')
        }), 500


@app.route('/api/analyze-priority', methods=['POST'])
@login_required
@admin_required
def analyze_task_priority_api():
    """API endpoint to analyze and suggest task priority based on description"""
    description = request.form.get('description', '')
    deadline_days = request.form.get('deadline_days', None)
    
    if not description:
        return jsonify({
            'success': False,
            'error': 'Task description is required'
        }), 400
    
    if deadline_days and deadline_days.isdigit():
        deadline_days = int(deadline_days)
    else:
        deadline_days = None
    
    priority = analyze_task_priority(description, deadline_days)
    
    return jsonify({
        'success': True,
        'priority': priority
    })


@app.route('/api/voice-task', methods=['POST'])
@login_required
@admin_required
def voice_task_api():
    """API endpoint to process voice commands and create tasks"""
    # Get audio data from request
    if not request.is_json or 'audio' not in request.json:
        return jsonify({'error': 'No audio data provided'}), 400
    
    audio_data = request.json.get('audio')
    
    # Process voice command
    from utils import process_voice_command
    result = process_voice_command(audio_data)
    
    if not result['success']:
        return jsonify({
            'success': False,
            'error': result.get('error', 'Failed to process voice command')
        }), 500
    
    return jsonify({
        'success': True,
        'transcript': result['transcript'],
        'task_info': result['task_info']
    })


@app.context_processor
def utility_processor():
    def get_unread_notification_count():
        if current_user.is_authenticated:
            return Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
        return 0
    
    def get_theme():
        return request.cookies.get('theme', 'light')
    
    return {
        'get_unread_notification_count': get_unread_notification_count,
        'get_theme': get_theme
    }
