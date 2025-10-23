"""Cleanup script to remove stray chat sessions not associated with any user.

Run with: python cleanup_stray_sessions.py
"""
from app import db, User, ChatSession

def cleanup():
    # Find sessions where user does not exist
    sessions = ChatSession.query.all()
    removed = 0
    for s in sessions:
        u = User.query.get(s.user_id)
        if not u:
            print(f"Removing stray session id={s.id} user_id={s.user_id}")
            db.session.delete(s)
            removed += 1
    if removed:
        db.session.commit()
    print(f"Cleanup complete. Removed {removed} sessions.")

if __name__ == '__main__':
    cleanup()


