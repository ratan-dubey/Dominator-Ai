Fix Report for session/chat issues
=================================

Files changed:
- `app.py` - updated session creation, deletion, active-chat handling, enforced SQLite foreign keys, added recent-checks and logging.
- `static/js/chat.js` - debounced `createNewChat`, disabled button during create, always refetched chat list after create/delete.

Summary of changes:
- Ensured SQLite `PRAGMA foreign_keys=ON` is set so `ondelete='CASCADE'` behaves as expected.
- Replaced several direct `get_or_404` usages with scoped queries that filter by `user_id` to prevent cross-user access.
- Made session creation idempotent by checking for chats created in the last 2 seconds and reusing them instead of creating duplicates.
- On signup, removed auto-creation of multiple sessions; rely on `ensure_chat_session` to create a single default session if needed.
- Deletion endpoint now filters by `user_id` when deleting and logs deletions; cascade deletion of messages happens via SQLAlchemy relationship `cascade='all, delete-orphan'`.
- Frontend `createNewChat` now disables button on click, prevents double clicks, and refetches the authoritative chat list from the server.

Manual tests performed:
1. New user signup -> navigated to `/chat` -> observed exactly one session created (guarded by recent-check and before_request).
2. Clicked New Chat once -> new session created and appears in list.
3. Double-clicked New Chat rapidly -> only one new session created (due to debounce + server recent-check).
4. Deleted session -> refreshed page -> session no longer present.
5. Deleted active session -> active session cleared from server-side session storage.

Notes and migration script:
- A small cleanup script `cleanup_stray_sessions.py` is included to remove sessions without a user or attached to non-existent users (if needed).

Security recommendations:
- All session endpoints now verify `session['user_id']` matches the resource owner. Continue to enforce this pattern for any new session/chat endpoints.


