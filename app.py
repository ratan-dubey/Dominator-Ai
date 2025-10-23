from flask import Flask, render_template, request, redirect, url_for, flash, session, send_from_directory, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
from datetime import datetime, timedelta
import time
import requests
import base64
from flask_session import Session

app = Flask(__name__)
app.config['SECRET_KEY'] = 'dominator@2025$ai!secure'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)  # Session lasts 7 days
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize Flask-Session
Session(app)

# Initialize SQLAlchemy
db = SQLAlchemy(app)

# Enforce SQLite foreign key constraints for cascade deletes
@app.before_request
def _enable_sqlite_foreign_keys():
    # Only applicable for SQLite - ensure PRAGMA foreign_keys=ON
    try:
        if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite'):
            from sqlalchemy import event
            @event.listens_for(db.engine, "connect")
            def _set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                try:
                    cursor.execute("PRAGMA foreign_keys=ON")
                except Exception:
                    pass
                finally:
                    cursor.close()
    except Exception:
        # If engine not yet available or other error, ignore silently
        pass

# API Configuration
GROQ_API_KEY = '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'  # Direct API key usage
HF_API_KEY = os.getenv('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')
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
HF_API_URL = "https://api-inference.huggingface.co/models/microsoft/kosmos-2-patch14-224"

# Constants
GROQ_MODEL = "llama-3.1-8b-instant"  # Using a confirmed available model
MAX_RETRIES = 3
BASE_DELAY = 1
MAX_DELAY = 16

@app.before_request
def make_session_permanent():
    session.permanent = True  # Make session permanent with lifetime set above

@app.before_request
def load_user():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if not user:
            session.clear()
            return redirect(url_for('login'))

@app.before_request
def ensure_chat_session():
    """Ensure user has an active chat session"""
    if 'user_id' in session:
        # Check if user has any active chat
        active_chat_id = session.get('active_chat_id')
        if not active_chat_id:
            user = User.query.get(session['user_id'])
            if user:
                try:
                    # Use database lock for atomic operation
                    from sqlalchemy import text
                    db.session.execute(text("BEGIN EXCLUSIVE"))
                    
                    # Check for any existing chats in the last 5 seconds
                    threshold = datetime.utcnow() - timedelta(seconds=5)
                    recent = ChatSession.query.filter_by(user_id=user.id)\
                        .filter(ChatSession.created_at >= threshold)\
                        .order_by(ChatSession.created_at.desc())\
                        .first()
                    
                    if recent:
                        session['active_chat_id'] = recent.id
                    else:
                        new_chat = ChatSession(
                            user_id=user.id,
                            title="New Chat"
                        )
                        db.session.add(new_chat)
                        db.session.commit()
                        session['active_chat_id'] = new_chat.id
                        app.logger.info(f"Created new chat session: {session['active_chat_id']} for user {user.id}")
                    
                    db.session.execute(text("COMMIT"))
                except Exception as e:
                    db.session.rollback()
                    app.logger.error(f"Error ensuring chat session: {str(e)}")
                    # Fall back to existing chat if available
                    existing_chat = ChatSession.query.filter_by(user_id=user.id)\
                        .order_by(ChatSession.created_at.desc())\
                        .first()
                    if existing_chat:
                        session['active_chat_id'] = existing_chat.id

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Define models first
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    profile_pic = db.Column(db.String(200))
    chats = db.relationship('ChatSession', back_populates='user', lazy=True, cascade='all, delete-orphan')

class ChatSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    title = db.Column(db.String(100), nullable=False, default="New Chat")
    user = db.relationship('User', back_populates='chats')

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_session.id', ondelete='CASCADE'), nullable=False)
    sender = db.Column(db.String(10), nullable=False)  # 'user' or 'ai'
    message = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    session = db.relationship('ChatSession', backref=db.backref('messages', lazy=True, cascade='all, delete-orphan'))

# Function to recreate database
def recreate_database():
    with app.app_context():
        db.create_all()
        print("Database tables created successfully!")

# Only create tables if database doesn't exist
if not os.path.exists('database.db'):
    recreate_database()

def get_groq_response(prompt):
    """Handle text-only queries using Groq API"""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Groq API compatible request format
    data = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": "You are Dominator AI, a helpful assistant created by Ratan Dubey."},
            {"role": "user", "content": prompt}
        ]
    }

    print(f"Making request to Groq API with data: {data}")  # Debug log

    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(GROQ_API_URL, json=data, headers=headers, timeout=30)
            print(f"Groq API Response Status: {response.status_code}")  # Debug log
            
            if response.status_code == 200:
                result = response.json()
                print(f"Groq API Response: {result}")  # Debug log
                
                if result.get("choices") and len(result["choices"]) > 0:
                    message = result["choices"][0].get("message", {})
                    if message and "content" in message:
                        return {
                            "success": True,
                            "response": message["content"].strip()
                        }
                print(f"Invalid response structure: {result}")
                return {
                    "success": False,
                    "error": "Received invalid response format from API"
                }
            elif response.status_code == 401:
                print(f"Authentication Error: {response.text}")
                return {
                    "success": False,
                    "error": "API authentication failed. Please verify API key format."
                }
            elif response.status_code == 404:
                print(f"API Error: {response.text}")
                return {
                    "success": False,
                    "error": "The requested endpoint or model is not available."
                }
            elif response.status_code == 429:  # Rate limit
                if attempt < MAX_RETRIES - 1:
                    wait_time = min(BASE_DELAY * (2 ** attempt), MAX_DELAY)
                    print(f"Rate limit hit. Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                    continue
                return {
                    "success": False,
                    "error": "We're experiencing high traffic. Please wait 30 seconds before trying again."
                }
            
            error_msg = response.json().get("error", {}).get("message", "Unknown error occurred")
            print(f"Unexpected API Error: Status {response.status_code} - {error_msg}")
            return {
                "success": False,
                "error": f"An error occurred: {error_msg}"
            }

        except requests.exceptions.Timeout:
            if attempt < MAX_RETRIES - 1:
                wait_time = min(BASE_DELAY * (2 ** attempt), MAX_DELAY)
                print(f"Timeout error. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            return {
                "success": False,
                "error": "Request timed out. Please try again."
            }
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait_time = min(BASE_DELAY * (2 ** attempt), MAX_DELAY)
                print(f"Error: {str(e)}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            return {
                "success": False,
                "error": "An error occurred. Please try again in a moment."
            }
    
    return {
        "success": False,
        "error": "Maximum retries reached. Please wait a moment before trying again."
    }

def get_huggingface_response(image_data, prompt=""):
    """Handle image+text queries using Hugging Face API"""
    headers = {
        "Authorization": f"Bearer {HF_API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        # Prepare the image data
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            image_data = base64.b64decode(image_data.split(',')[1])
        
        # Prepare request data
        data = {
            "inputs": {
                "image": base64.b64encode(image_data).decode('utf-8'),
                "text": prompt
            }
        }
        
        response = requests.post(HF_API_URL, json=data, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                return {
                    "success": True,
                    "response": result[0].get("generated_text", "").strip()
                }
        
        return {
            "success": False,
            "error": f"Invalid response from Hugging Face API (Status: {response.status_code})"
        }
            
    except Exception as e:
        print(f"Hugging Face API Error: {str(e)}")
        return {
            "success": False,
            "error": "Failed to process image. Please try again."
        }

def get_ai_response(prompt, image_data=None):
    """Route the request to appropriate API based on input type"""
    if image_data:
        return get_huggingface_response(image_data, prompt)
    else:
        return get_groq_response(prompt)

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('chat'))
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password, password):
            session.clear()  # Clear any existing session
            session['user_id'] = user.id
            session.modified = True  # Ensure session is saved
            return redirect(url_for('chat'))
        flash('Invalid email or password')
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        try:
            username = request.form['username']
            email = request.form['email']
            password = request.form['password']
            confirm_password = request.form['confirm_password']
            
            if password != confirm_password:
                flash('Passwords do not match')
                return redirect(url_for('signup'))
                
            if User.query.filter_by(email=email).first():
                flash('Email already registered')
                return redirect(url_for('signup'))
                
            if User.query.filter_by(username=username).first():
                flash('Username already taken')
                return redirect(url_for('signup'))
                
            profile_pic = None
            if 'profile_pic' in request.files:
                file = request.files['profile_pic']
                if file.filename:
                    filename = secure_filename(file.filename)
                    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                    profile_pic = filename
                    
            hashed_password = generate_password_hash(password)
            new_user = User(
                username=username,
                email=email,
                password=hashed_password,
                profile_pic=profile_pic
            )
            
            db.session.add(new_user)
            db.session.commit()

            # Clear any existing session and create new
            session.clear()
            session['user_id'] = new_user.id
            session.modified = True  # Ensure session is saved

            # Do not auto-create multiple sessions here; let ensure_chat_session handle default creation.
            return redirect(url_for('chat'))
        except Exception as e:
            db.session.rollback()
            print(f"Error during signup: {str(e)}")
            flash('An error occurred during signup. Please try again.')
            return redirect(url_for('signup'))
            
    return render_template('signup.html')

@app.route('/chat', methods=['GET'])
def chat():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        return redirect(url_for('login'))
    
    # Get active chat from session or create new one (guarded by ensure_chat_session)
    active_chat_id = session.get('active_chat_id')
    if not active_chat_id:
        # ensure_chat_session before_request will create or attach a recent chat
        # reload after creation
        user = User.query.get(session['user_id'])
        active_chat_id = session.get('active_chat_id')
    
    # Get all chats for the user
    chats = ChatSession.query.filter_by(user_id=user.id).order_by(ChatSession.created_at.desc()).all()
    
    # Get messages for active chat
    messages = ChatMessage.query.filter_by(session_id=active_chat_id).order_by(ChatMessage.timestamp.asc()).all()
    
    return render_template('chat.html', user=user, chats=chats, messages=messages)

@app.route('/ask', methods=['POST'])
def ask():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({
                'success': False,
                'error': 'Invalid request format'
            }), 400

        message = data['message']
        chat_id = session.get('active_chat_id')  # Get chat_id from session instead of request

        if not chat_id:
            # Create new chat if none exists, but guard against duplicates using recent-check
            user = User.query.get(session['user_id'])
            if not user:
                return jsonify({
                    'success': False,
                    'error': 'User not found'
                }), 404

            threshold = datetime.utcnow() - timedelta(seconds=2)
            recent = ChatSession.query.filter_by(user_id=user.id).filter(ChatSession.created_at >= threshold).order_by(ChatSession.created_at.desc()).first()
            if recent:
                chat_id = recent.id
                session['active_chat_id'] = chat_id
            else:
                new_chat = ChatSession(
                    user_id=user.id
                )
                db.session.add(new_chat)
                db.session.commit()
                chat_id = new_chat.id
                session['active_chat_id'] = chat_id
                app.logger.info(f"Created new chat session via /ask: {chat_id} for user {user.id}")

        # Get AI response
        print(f"Sending message to AI: {message}")  # Debug log
        ai_response = get_ai_response(message)
        print(f"AI Response: {ai_response}")  # Debug log
        
        if not ai_response['success']:
            print(f"AI Response Error: {ai_response['error']}")  # Debug log
            return jsonify({
                'success': False,
                'error': ai_response['error']
            }), 500

        # Save message to database
        try:
            chat = ChatSession.query.get(chat_id)
            if not chat:
                return jsonify({
                    'success': False,
                    'error': 'Chat session not found'
                }), 404

            # Save user message
            user_message = ChatMessage(
                session_id=chat_id,
                sender='user',
                message=message
            )
            db.session.add(user_message)

            # Save AI response
            ai_message = ChatMessage(
                session_id=chat_id,
                sender='ai',
                message=ai_response['response']
            )
            db.session.add(ai_message)
            db.session.commit()

            print(f"Successfully saved messages to database")  # Debug log

            return jsonify({
                'success': True,
                'response': ai_response['response']
            })

        except Exception as db_error:
            db.session.rollback()
            print(f"Database error: {str(db_error)}")  # Debug log
            return jsonify({
                'success': False,
                'error': 'Failed to save message'
            }), 500

    except Exception as e:
        print(f"Error in /ask route: {str(e)}")  # Debug log
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@app.route('/get_response', methods=['POST'])
def get_response():
    data = request.get_json()
    user_input = data.get('user_input', '')
    
    # Get response from OpenAI
    response = get_groq_response(user_input)
    
    return jsonify({'success': True, 'response': response})

@app.route('/edit_message/<int:message_id>', methods=['POST'])
def edit_message(message_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    message = ChatMessage.query.get_or_404(message_id)
    if message.session.user_id != session['user_id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    new_content = data.get('content', '').strip()
    
    if not new_content:
        return jsonify({'error': 'No content provided'}), 400
    
    try:
        message.message = new_content
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': {
                'id': message.id,
                'content': message.message,
                'timestamp': message.timestamp.isoformat()
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# NOTE: Duplicate `delete_chat` route removed. See the remaining implementation
# further below which filters by `user_id` and is the authoritative handler.

@app.route('/account')
def account():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    user = User.query.get(session['user_id'])
    return render_template('account.html', user=user)

@app.route('/update_profile', methods=['POST'])
def update_profile():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])
    app.logger.debug(f"Updating profile for user: {user.username}")
    
    # Update username if changed
    if 'username' in request.form and request.form['username'] != user.username:
        if User.query.filter_by(username=request.form['username']).first():
            flash('Username already taken')
            return redirect(url_for('account'))
        user.username = request.form['username']
        app.logger.debug(f"Updated username to: {user.username}")
    
    # Update email if changed
    if 'email' in request.form and request.form['email'] != user.email:
        if User.query.filter_by(email=request.form['email']).first():
            flash('Email already registered')
            return redirect(url_for('account'))
        user.email = request.form['email']
        app.logger.debug(f"Updated email to: {user.email}")
    
    # Update password if provided
    if 'current_password' in request.form and request.form['current_password']:
        if not check_password_hash(user.password, request.form['current_password']):
            flash('Current password is incorrect')
            return redirect(url_for('account'))
        
        if 'new_password' in request.form and request.form['new_password']:
            if request.form['new_password'] != request.form['confirm_password']:
                flash('New passwords do not match')
                return redirect(url_for('account'))
            user.password = generate_password_hash(request.form['new_password'])
            app.logger.debug("Password updated")
    
    # Update profile picture if provided
    if 'profile_pic' in request.files:
        file = request.files['profile_pic']
        if file.filename:
            # Delete old profile picture if exists
            if user.profile_pic:
                try:
                    old_path = os.path.join(app.config['UPLOAD_FOLDER'], user.profile_pic)
                    if os.path.exists(old_path):
                        os.remove(old_path)
                except Exception as e:
                    app.logger.error(f"Error deleting old profile picture: {e}")
            
            # Save new profile picture
            filename = secure_filename(file.filename)
            unique_filename = f"{user.id}_{int(time.time())}_{filename}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(file_path)
            user.profile_pic = unique_filename
            app.logger.debug(f"Updated profile picture to: {user.profile_pic}")
    
    try:
        db.session.commit()
        flash('Profile updated successfully')
        app.logger.debug("Profile update successful")
    except Exception as e:
        db.session.rollback()
        flash('Error updating profile')
        app.logger.error(f"Error updating profile: {e}")
    
    return redirect(url_for('account'))

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    return redirect(url_for('index'))

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/set_new_chat', methods=['POST'])
def set_new_chat():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Create new chat session with recent-check to prevent duplicates (2 second window)
    threshold = datetime.utcnow() - timedelta(seconds=2)
    recent = ChatSession.query.filter_by(user_id=user.id).filter(ChatSession.created_at >= threshold).order_by(ChatSession.created_at.desc()).first()
    if recent:
        session['active_chat_id'] = recent.id
        return jsonify({'success': True, 'chat_id': recent.id, 'created_at': recent.created_at.isoformat(), 'note': 'reused recent'})

    new_chat = ChatSession(
        user_id=user.id
    )
    db.session.add(new_chat)
    db.session.commit()

    session['active_chat_id'] = new_chat.id

    return jsonify({
        'success': True,
        'chat_id': new_chat.id,
        'created_at': new_chat.created_at.isoformat()
    })

@app.route('/delete_chat/<int:chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    chat = ChatSession.query.filter_by(id=chat_id, user_id=session['user_id']).first()
    if not chat:
        return jsonify({'error': 'Not found or unauthorized'}), 404
    try:
        # Deleting the ChatSession will cascade-delete messages due to relationship/cascade settings
        db.session.delete(chat)
        db.session.commit()

        # If deleted chat was active, clear active chat
        if session.get('active_chat_id') == chat_id:
            session.pop('active_chat_id', None)

        app.logger.info(f"Deleted chat {chat_id} for user {session['user_id']}")
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting chat {chat_id} for user {session['user_id']}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/set_active_chat/<int:chat_id>', methods=['POST'])
def set_active_chat(chat_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    chat = ChatSession.query.filter_by(id=chat_id, user_id=session['user_id']).first()
    if not chat:
        return jsonify({'error': 'Not found or unauthorized'}), 404
    
    session['active_chat_id'] = chat_id
    
    # Get messages for the chat
    messages = ChatMessage.query.filter_by(session_id=chat_id).order_by(ChatMessage.timestamp.asc()).all()
    
    return jsonify({
        'success': True,
        'chat': {
            'id': chat.id,
            'created_at': chat.created_at.isoformat()
        },
        'messages': [{
            'id': msg.id,
            'content': msg.message,
            'sender': msg.sender,
            'timestamp': msg.timestamp.isoformat()
        } for msg in messages]
    })

@app.route('/get_chats')
def get_chats():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    try:
        chats = ChatSession.query.filter_by(user_id=user.id).order_by(ChatSession.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'chats': [{
                'id': chat.id,
                'created_at': chat.created_at.isoformat(),
                'message_count': ChatMessage.query.filter_by(session_id=chat.id).count()
            } for chat in chats]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- API: List chat sessions for current user ---
@app.route('/sessions', methods=['GET'])
def list_sessions():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    sessions = ChatSession.query.filter_by(user_id=session['user_id']).order_by(ChatSession.created_at.desc()).all()
    return jsonify({'success': True, 'sessions': [
        {'id': s.id, 'title': s.title, 'created_at': s.created_at.isoformat()} for s in sessions
    ]})

# --- API: Create new chat session ---
@app.route('/sessions', methods=['POST'])
def create_session():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    
    # Get count of existing sessions for this user
    session_count = ChatSession.query.filter_by(user_id=session['user_id']).count()
    default_title = f"New Chat {session_count + 1}"
    
    new_session = ChatSession(
        user_id=session['user_id'],
        title=default_title
    )
    db.session.add(new_session)
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'session': {
            'id': new_session.id, 
            'title': new_session.title, 
            'created_at': new_session.created_at.isoformat()
        }
    })

@app.route('/sessions/<int:session_id>/title', methods=['PUT'])
def update_session_title(session_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    
    chat_session = ChatSession.query.get_or_404(session_id)
    if chat_session.user_id != session['user_id']:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    new_title = data.get('title', '').strip()
    
    if not new_title:
        return jsonify({'success': False, 'error': 'Title cannot be empty'}), 400
    
    chat_session.title = new_title
    db.session.commit()
    
    return jsonify({
        'success': True,
        'session': {
            'id': chat_session.id,
            'title': chat_session.title
        }
    })

# --- API: List messages for a session ---
@app.route('/sessions/<int:session_id>/messages', methods=['GET'])
def get_session_messages(session_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    chat_session = ChatSession.query.get_or_404(session_id)
    if chat_session.user_id != session['user_id']:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 403
    messages = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp.asc()).all()
    return jsonify({'success': True, 'messages': [
        {'id': m.id, 'sender': m.sender, 'message': m.message, 'timestamp': m.timestamp.isoformat()} for m in messages
    ]})

# --- API: Add message to session and get AI reply ---
@app.route('/sessions/<int:session_id>/messages', methods=['POST'])
def add_message_to_session(session_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    chat_session = ChatSession.query.get_or_404(session_id)
    if chat_session.user_id != session['user_id']:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 403
    data = request.get_json()
    user_message = data.get('message', '').strip()
    if not user_message:
        return jsonify({'success': False, 'error': 'Empty message'}), 400
    # Store user message
    msg = ChatMessage(session_id=session_id, sender='user', message=user_message)
    db.session.add(msg)
    db.session.commit()
    # Get AI reply
    ai_response = get_ai_response(user_message)
    if ai_response['success']:
        ai_msg = ChatMessage(session_id=session_id, sender='ai', message=ai_response['response'])
        db.session.add(ai_msg)
        db.session.commit()
        return jsonify({'success': True, 'reply': ai_response['response']})
    else:
        return jsonify({'success': False, 'error': ai_response.get('error', 'AI error')})

if __name__ == '__main__':
    app.run(debug=True) 