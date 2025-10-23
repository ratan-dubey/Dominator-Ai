Dominator AI Chatbot
===================

A modern, responsive AI chatbot website built with Flask and SQLite.

Features
--------
- User authentication (login/signup)
- Profile management with picture upload
- ChatGPT-like chat interface
- Chat history with editable names
- Modern glassmorphism design
- Mobile-responsive layout
- Local storage for chat persistence

Project Structure
----------------
dominator_ai/
├── app.py                 # Flask application
├── static/
│   ├── css/style.css      # Global styles
│   ├── js/main.js         # Frontend JavaScript
│   ├── uploads/           # User profile pictures
├── templates/
│   ├── index.html         # Landing page
│   ├── login.html         # Login page
│   ├── signup.html        # Signup page
│   ├── chat.html          # Chat interface
│   ├── account.html       # Account management
├── database.db            # SQLite database
├── requirements.txt       # Python dependencies

Setup Instructions
----------------
1. Create a virtual environment:
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate

2. Install dependencies:
   pip install -r requirements.txt

3. Run the application:
   python app.py

4. Access the website at:
   http://localhost:5000

Deployment on Render.com
-----------------------
1. Push your code to GitHub

2. Go to render.com and create a new Web Service

3. Connect your GitHub repository

4. Configure the service:
   - Build Command: pip install -r requirements.txt
   - Start Command: gunicorn app:app

5. Add environment variables:
   - SECRET_KEY: Your secret key for Flask session
   - FLASK_ENV: production

6. Deploy the service

Frontend-Backend Integration
---------------------------
The frontend communicates with the backend through:
- Flask routes for authentication and profile management
- AJAX requests for chat functionality
- Session management for user authentication
- File upload handling for profile pictures

Chat Storage
-----------
- Chat history is stored in SQLite database
- Messages are temporarily cached in localStorage
- Chat names are editable and persisted in the database

Security Features
---------------
- Password hashing with Werkzeug
- Secure file upload handling
- Session-based authentication
- CSRF protection
- Input validation

Mobile Responsiveness
-------------------
The website is fully responsive and works on:
- Desktop
- Tablet
- Mobile devices

Design Features
--------------
- Modern glassmorphism design
- Gradient backgrounds
- Neon text effects
- Smooth animations
- Hover effects
- Loading states

Troubleshooting
--------------
1. Database issues:
   - Delete database.db and restart the app
   - Check SQLite connection

2. File upload issues:
   - Ensure uploads directory exists
   - Check file permissions
   - Verify file size limits

3. Authentication issues:
   - Clear browser cookies
   - Check session configuration
   - Verify password hashing

4. Deployment issues:
   - Check build logs
   - Verify environment variables
   - Ensure all dependencies are in requirements.txt

Support
-------
For any issues or questions, please contact:
- Email: support@dominatorai.com
- GitHub: github.com/yourusername/dominator-ai 