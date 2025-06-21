import os
import json
from datetime import timedelta, timezone
from flask import current_app
from flask_mail import Message
from app import mail
from openai import OpenAI

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


def send_task_notification_email(to, subject, body):
    """
    Send task-related email notifications to users
    
    Args:
        to (str): Recipient email address
        subject (str): Email subject
        body (str): Email body content
    """
    if not to:
        current_app.logger.error("No recipient email provided")
        return False
    
    try:
        msg = Message(
            subject=subject,
            recipients=[to],
            body=body,
            sender=current_app.config.get('MAIL_DEFAULT_SENDER')
        )
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send email: {str(e)}")
        return False


def format_datetime(dt):
    """
    Format datetime for display in IST timezone
    
    Args:
        dt: Datetime object
        
    Returns:
        str: Formatted datetime string in IST
    """
    if not dt:
        return "N/A"
    
    # Convert to IST timezone (UTC+5:30)
    ist_offset = timedelta(hours=5, minutes=30)
    if dt.tzinfo is None:  # If datetime is naive
        dt_ist = dt + ist_offset
    else:
        dt_ist = dt.astimezone(timezone(ist_offset))
        
    return dt_ist.strftime("%d %b, %Y - %H:%M IST")


def get_priority_badge_class(priority):
    """
    Get Bootstrap badge class based on priority
    
    Args:
        priority (str): Task priority (low, medium, high)
        
    Returns:
        str: CSS class for the badge
    """
    if priority == "high":
        return "bg-danger"
    elif priority == "medium":
        return "bg-warning"
    else:
        return "bg-info"


def get_status_badge_class(status):
    """
    Get Bootstrap badge class based on status
    
    Args:
        status (str): Task status (pending, in-progress, completed)
        
    Returns:
        str: CSS class for the badge
    """
    if status == "completed":
        return "bg-success"
    elif status == "in-progress":
        return "bg-primary"
    else:
        return "bg-secondary"


def generate_ai_task_description(service_type, keywords, client_name=None, priority=None):
    """
    Generate a task description using AI based on input parameters
    
    Args:
        service_type (str): Type of service (Legal, Consulting, IT, etc.)
        keywords (str): Keywords or brief description of the task
        client_name (str, optional): Name of the client
        priority (str, optional): Priority level (low, medium, high)
        
    Returns:
        dict: Generated task title and description
    """
    try:
        # Build the prompt with available information
        prompt = f"Generate a professional {service_type} task"
        if client_name:
            prompt += f" for client {client_name}"
        if priority:
            prompt += f" with {priority} priority"
        prompt += f". Task keywords: {keywords}"
        prompt += "\nFormat the response as JSON with 'title' (max 10 words) and 'description' (2-3 paragraphs) fields."
        
        # the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
        # do not change this unless explicitly requested by the user
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": f"You are a professional {service_type} task description generator. Create clear, concise task descriptions that follow industry standards."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=500
        )
        
        # Parse the response
        content = response.choices[0].message.content
        if content is not None:
            result = json.loads(content)
            
            # Ensure we have the required fields
            if 'title' not in result or 'description' not in result:
                raise ValueError("AI response missing required fields")
        else:
            raise ValueError("No content received from AI")
            
        return {
            'title': result['title'],
            'description': result['description'],
            'success': True
        }
    except Exception as e:
        current_app.logger.error(f"Error generating AI task description: {str(e)}")
        return {
            'title': '',
            'description': '',
            'success': False,
            'error': str(e)
        }


def analyze_task_priority(task_description, deadline_days=None):
    """
    Analyze task description to suggest appropriate priority
    
    Args:
        task_description (str): Task description 
        deadline_days (int, optional): Days until deadline
        
    Returns:
        str: Suggested priority (low, medium, high)
    """
    try:
        # Build the prompt with available information
        prompt = f"Analyze this task description and recommend a priority level (low, medium, or high):\n\n{task_description}"
        if deadline_days is not None:
            prompt += f"\n\nThe deadline for this task is {deadline_days} days from now."
            
        # the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
        # do not change this unless explicitly requested by the user
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a task priority analyzer. Respond with only 'low', 'medium', or 'high' based on task urgency and importance."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=50
        )
        
        # Get the suggested priority
        content = response.choices[0].message.content
        if content is not None:
            suggested_priority = content.strip().lower()
            
            # Validate and return the priority
            if suggested_priority in ['low', 'medium', 'high']:
                return suggested_priority
            
        # Default to medium if response is invalid or empty
        return 'medium'
            
    except Exception as e:
        current_app.logger.error(f"Error analyzing task priority: {str(e)}")
        # Default to medium on error
        return 'medium'


def process_voice_command(audio_base64):
    """
    Process voice command to create a task
    
    Args:
        audio_base64 (str): Base64 encoded audio data
        
    Returns:
        dict: Processed task details
    """
    try:
        import base64
        import tempfile
        
        # Decode base64 audio
        audio_data = base64.b64decode(audio_base64.split(',')[1] if ',' in audio_base64 else audio_base64)
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_audio:
            temp_path = temp_audio.name
            temp_audio.write(audio_data)
        
        # Transcribe audio using OpenAI Whisper
        with open(temp_path, "rb") as audio_file:
            transcript = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        
        # Delete temporary file
        os.remove(temp_path)
        
        # Process the transcript to extract task information
        prompt = (
            f"Extract task information from this voice command: '{transcript.text}'\n"
            "Parse it into JSON format with the following fields:\n"
            "1. title: The task title (create a concise, professional title based on the context)\n"
            "2. description: Detailed task description (expand on what was mentioned to create a comprehensive task description)\n"
            "3. service_type: Type of service (e.g., Legal, IT, Consulting, Design, etc.)\n"
            "4. priority: Task priority (low, medium, high - infer based on urgency words or task importance)\n"
            "5. client_name: Name of the client (exact name as mentioned)\n"
            "6. deadline: Suggested deadline in days from now (if mentioned or can be reasonably inferred)\n"
            "Always extract as much detail as possible from the voice command. If specific information isn't provided, make a reasonable inference based on the context of the task."
        )
        
        # the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
        # do not change this unless explicitly requested by the user
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system", 
                    "content": "You are an assistant that extracts task information from voice commands."
                },
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=500
        )
        
        # Parse the response
        content = response.choices[0].message.content
        if content is not None:
            result = json.loads(content)
            return {
                'transcript': transcript.text,
                'task_info': result,
                'success': True
            }
        else:
            raise ValueError("No content received from AI")
            
    except Exception as e:
        current_app.logger.error(f"Error processing voice command: {str(e)}")
        return {
            'transcript': '',
            'task_info': {},
            'success': False,
            'error': str(e)
        }
