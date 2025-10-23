// Chat management functions
let creatingChat = false;
let createChatTimeout;

function createNewChat() {
    if (creatingChat) return; // debounce double clicks
    
    clearTimeout(createChatTimeout); // Clear any pending timeout
    creatingChat = true;
    
    const btn = document.querySelector('.new-chat-button');
    if (btn) btn.disabled = true;

    fetch('/set_new_chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(async data => {
            if (data.success) {
                // Always refetch authoritative list from server after change
                chatContainer.innerHTML = '';
                await loadChats();
            } else {
                showError('Failed to create new chat');
            }
        })
        .catch(error => {
            console.error('Error creating new chat:', error);
            showError('Failed to create new chat');
        })
        .finally(() => {
            creatingChat = false;
            if (btn) btn.disabled = false;
        });
}

function loadChats() {
    fetch('/get_chats')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const chatList = document.getElementById('chat-list');
                chatList.innerHTML = '';

                data.chats.forEach(chat => {
                    const chatItem = document.createElement('div');
                    chatItem.className = 'chat-item';
                    chatItem.dataset.chatId = chat.id;

                    const chatName = document.createElement('div');
                    chatName.className = 'chat-name';
                    chatName.textContent = chat.name;

                    const chatDate = document.createElement('div');
                    chatDate.className = 'chat-date';
                    chatDate.textContent = new Date(chat.created_at).toLocaleDateString();

                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'delete-chat';
                    deleteButton.innerHTML = '&times;';
                    deleteButton.onclick = (e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                    };

                    chatItem.appendChild(chatName);
                    chatItem.appendChild(chatDate);
                    chatItem.appendChild(deleteButton);

                    chatItem.onclick = () => setActiveChat(chat.id);

                    if (chat.id === currentChatId) {
                        chatItem.classList.add('active');
                    }

                    chatList.appendChild(chatItem);
                });
            }
        })
        .catch(error => {
            console.error('Error loading chats:', error);
            showError('Failed to load chats');
        });
}

function setActiveChat(chatId) {
    fetch(`/set_active_chat/${chatId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentChatId = chatId;
                chatContainer.innerHTML = '';

                data.messages.forEach(message => {
                    appendMessage(message.content, message.is_user, message.id);
                });

                document.querySelectorAll('.chat-item').forEach(item => {
                    item.classList.toggle('active', item.dataset.chatId === chatId.toString());
                });

                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        })
        .catch(error => {
            console.error('Error setting active chat:', error);
            showError('Failed to switch chat');
        });
}

function deleteChat(chatId) {
    if (!confirm('Are you sure you want to delete this chat?')) {
        return;
    }

    fetch(`/delete_chat/${chatId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (currentChatId === chatId) {
                    chatContainer.innerHTML = '';
                    currentChatId = null;
                    // Clear session storage for this chat
                    sessionStorage.removeItem(`chat_${chatId}`);
                }
                // Force reload chats from server
                loadChats();
                // If this was the last chat, create a new one
                if (!document.querySelector('.chat-item')) {
                    createNewChat();
                }
            } else {
                showError('Failed to delete chat');
            }
        })
        .catch(error => {
            console.error('Error deleting chat:', error);
            showError('Failed to delete chat');
        });
}

// Theme management
let currentTheme = 'modern-theme';

function initializeTheme() {
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        chatContainer.classList.add(currentTheme);
        document.body.classList.add(currentTheme);
    }
}

function ensureThemeConsistency() {
    const chatContainer = document.querySelector('.chat-container');
    const messages = document.querySelectorAll('.message');

    if (chatContainer) {
        chatContainer.classList.add(currentTheme);
    }

    messages.forEach(message => {
        if (message.classList.contains('user-message')) {
            message.classList.add('user-message-modern');
        } else if (message.classList.contains('ai-message')) {
            message.classList.add('ai-message-modern');
        }
    });
}

// Message handling
function appendMessage(content, isUser, messageId = null) {
    console.log('appendMessage called with:', { content, isUser, messageId });
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message user-message-modern' : 'ai-message ai-message-modern'}`;
    messageDiv.dataset.messageId = messageId;
    console.log('Created messageDiv:', messageDiv);
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = marked.parse(content);
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timestamp);
    if (isUser) {
        const editButton = document.createElement('button');
        editButton.className = 'edit-message';
        editButton.innerHTML = '✎';
        editButton.onclick = () => editMessage(messageId, content);
        messageDiv.appendChild(editButton);
    }
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    // Ensure theme consistency after adding new message
    ensureThemeConsistency();
}

function editMessage(messageId, currentContent) {
    const newContent = prompt('Edit your message:', currentContent);
    if (newContent === null || newContent === currentContent) {
        return;
    }

    fetch(`/edit_message/${messageId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newContent })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageDiv) {
                    const contentDiv = messageDiv.querySelector('.message-content');
                    contentDiv.innerHTML = marked.parse(newContent);
                }
            } else {
                showError('Failed to edit message');
            }
        })
        .catch(error => {
            console.error('Error editing message:', error);
            showError('Failed to edit message');
        });
}

// Initialize chat with proper theme handling
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme first
    initializeTheme();

    // Load chats and set up event listeners
    loadChats();
    document.getElementById('new-chat-button').addEventListener('click', createNewChat);

    // Handle message submission with improved error handling
    const messageForm = document.getElementById('message-form');
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        const imageInput = document.getElementById('image-input');

        if (!message && !imageInput.files[0]) {
            return;
        }

        // Disable input while processing
        messageInput.disabled = true;
        imageInput.disabled = true;

        try {
            // Ensure theme consistency before sending message
            ensureThemeConsistency();

            const formData = new FormData();
            formData.append('message', message);
            if (imageInput.files[0]) {
                formData.append('image', imageInput.files[0]);
            }

            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch('/ask', {
                method: 'POST',
                body: formData,
                signal: controller.signal,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                // Ensure theme consistency before appending messages
                ensureThemeConsistency();

                appendMessage(data.user_message.content, true, data.user_message.id);
                appendMessage(data.ai_message.content, false, data.ai_message.id);

                // Clear inputs
                messageInput.value = '';
                imageInput.value = '';
            } else {
                throw new Error(data.error || 'Failed to get response');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            if (error.name === 'AbortError') {
                showError('Request timed out. Please try again.');
            } else {
                showError(error.message || 'Failed to send message');
            }
        } finally {
            // Re-enable input
            messageInput.disabled = false;
            imageInput.disabled = false;
            messageInput.focus();

            // Ensure theme consistency after message handling
            ensureThemeConsistency();
        }
    });

    // Set up MutationObserver to watch for DOM changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                ensureThemeConsistency();
            }
        });
    });

    // Start observing the chat container for changes
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        observer.observe(chatContainer, {
            childList: true,
            subtree: true
        });
    }
}); 