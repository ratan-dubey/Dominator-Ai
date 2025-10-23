let isProcessingMessage = false;
let messageQueue = [];
let lastMessageTime = 0;
const MESSAGE_COOLDOWN = 3000; // 3 seconds cooldown between messages
const RATE_LIMIT_COOLDOWN = 30000; // 30 seconds cooldown after rate limit error
let isRateLimited = false;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all features
    initializeChat();
    initializeThemeToggle();
    initializeVoiceInput();
    initializeImageUpload();
    initializeSidebarToggle();
    initializeThemeObserver(); // Add theme observer

    // Add animation classes to elements
    const animatedElements = document.querySelectorAll('.fade-in');
    animatedElements.forEach((element, index) => {
        element.style.animationDelay = `${index * 0.2}s`;
    });
    
    // Initial theme application
    applyCustomTheme();
});

// Theme Toggle
function initializeThemeToggle() {
    const themeToggleBtn = document.querySelector('.theme-toggle-btn');
    const body = document.body;
    
    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'dark';
    body.classList.toggle('light-theme', savedTheme === 'light');
    updateThemeIcon(themeToggleBtn, savedTheme);
    
    // Apply theme to existing messages
    applyCustomTheme();

    themeToggleBtn.addEventListener('click', () => {
        body.classList.toggle('light-theme');
        const currentTheme = body.classList.contains('light-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        updateThemeIcon(themeToggleBtn, currentTheme);
        applyCustomTheme(); // Re-apply theme after toggle
    });
}

function updateThemeIcon(button, theme) {
    const icon = button.querySelector('i');
    icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// Sidebar Toggle
function initializeSidebarToggle() {
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const chatArea = document.querySelector('.chat-area');
    
    if (sidebarToggle && sidebar && chatArea) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            chatArea.classList.toggle('expanded');
            
            // Update toggle button icon
            const icon = sidebarToggle.querySelector('i');
            if (sidebar.classList.contains('collapsed')) {
                icon.className = 'fas fa-bars';
            } else {
                icon.className = 'fas fa-times';
            }
        });
    }
}

// Voice Input
function initializeVoiceInput() {
    const voiceBtn = document.querySelector('#voiceInputBtn');
    const messageInput = document.querySelector('.message-input');
    
    if (!voiceBtn || !messageInput) return;
    
    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window)) {
        voiceBtn.style.display = 'none';
        return;
    }
    
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    voiceBtn.addEventListener('click', () => {
        if (voiceBtn.classList.contains('recording')) {
            recognition.stop();
            voiceBtn.classList.remove('recording');
            return;
        }
        
        recognition.start();
        voiceBtn.classList.add('recording');
    });
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        messageInput.value = transcript;
        messageInput.focus();
        voiceBtn.classList.remove('recording');
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        voiceBtn.classList.remove('recording');
    };
    
    recognition.onend = () => {
        voiceBtn.classList.remove('recording');
    };
}

// Image Upload
function initializeImageUpload() {
    const inputContainer = document.querySelector('.input-controls');
    if (!inputContainer) return;

    // Add image upload button if not exists
    if (!document.getElementById('imageUploadBtn')) {
        const imageBtn = document.createElement('button');
        imageBtn.id = 'imageUploadBtn';
        imageBtn.className = 'icon-btn';
        imageBtn.title = 'Upload Image';
        imageBtn.innerHTML = '<i class="fas fa-image"></i>';
        
        // Insert before send button
        const sendButton = document.getElementById('sendButton');
        if (sendButton) {
            inputContainer.insertBefore(imageBtn, sendButton);
        } else {
            inputContainer.appendChild(imageBtn);
        }
    }

    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Handle image upload
    const imageUploadBtn = document.getElementById('imageUploadBtn');
    if (imageUploadBtn) {
        imageUploadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleImageUpload(file);
            }
        });
    }
}

async function handleImageUpload(file) {
    const messageInput = document.querySelector('.message-input');
    if (!messageInput) return;

    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/upload_image', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.success) {
            // Add image URL to message input
            messageInput.value += ` [Image: ${data.url}] `;
            messageInput.focus();
        } else {
            throw new Error(data.error || 'Failed to upload image');
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image. Please try again.');
    }
}

// Chat Management
function initializeChat() {
    const messageInput = document.querySelector('.message-input');
    const sendButton = document.getElementById('sendButton');
    const messageContainer = document.querySelector('.message-container');
    const newChatButton = document.querySelector('.new-chat-button');
    const chatList = document.querySelector('.chat-list');
    
    if (!messageInput || !sendButton || !messageContainer) {
        console.error('Required chat elements not found!');
        return;
    }

    // Debounced send handler
    let sendTimeout;
    const debouncedSend = (message) => {
        clearTimeout(sendTimeout);
        sendTimeout = setTimeout(() => {
            handleMessageSend(message);
        }, 300); // 300ms debounce
    };

    // Handle send button click
    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (message) {
            debouncedSend(message);
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
    });

    // Handle Enter key with debounce
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const message = messageInput.value.trim();
            if (message) {
                debouncedSend(message);
                messageInput.value = '';
                messageInput.style.height = 'auto';
            }
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Load existing chats from localStorage
    let chats = JSON.parse(localStorage.getItem('chats')) || [];
    let currentChatId = localStorage.getItem('currentChatId');
    
    // Initialize new chat if none exists
    if (!currentChatId) {
        createNewChat();
    } else {
        loadChat(currentChatId);
    }

    // Display existing chats
    async function displayChats() {
        const chatList = document.querySelector('.chat-list');
        if (!chatList) return;

        try {
            const response = await fetch('/get_chats');
            const data = await response.json();

            if (data.success) {
                chatList.innerHTML = '';
                
                data.chats.forEach(chat => {
                    const chatItem = document.createElement('div');
                    chatItem.className = 'chat-item glass-card';
                    chatItem.dataset.chatId = chat.id;
                    
                    // Add active class if this is the current chat
                    if (chat.id === parseInt(localStorage.getItem('currentChatId'))) {
                        chatItem.classList.add('active');
                    }

                    chatItem.innerHTML = `
                        <div class="chat-item-content">
                            <span class="chat-name">${chat.name}</span>
                            <span class="message-count">${chat.message_count} messages</span>
                        </div>
                        <div class="chat-item-actions">
                            <button class="action-btn edit-btn" title="Edit Chat Name">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete-btn" title="Delete Chat">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;

                    // Add click handler for chat selection
                    chatItem.addEventListener('click', (e) => {
                        // Don't trigger if clicking on action buttons
                        if (e.target.closest('.chat-item-actions')) {
                            return;
                        }
                        
                        // Remove active class from all chats
                        document.querySelectorAll('.chat-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        
                        // Add active class to clicked chat
                        chatItem.classList.add('active');
                        
                        // Load the selected chat
                        loadChat(chat.id);
                    });

                    // Add edit handler
                    const editBtn = chatItem.querySelector('.edit-btn');
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        editChatName(chatItem, chat);
                    });

                    // Add delete handler
                    const deleteBtn = chatItem.querySelector('.delete-btn');
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteChat(chat.id, chatItem);
                    });

                    chatList.appendChild(chatItem);
                });
            }
        } catch (error) {
            console.error('Error loading chats:', error);
            chatList.innerHTML = '<div class="error-message">Failed to load chats</div>';
        }
    }

    // Create new chat
    function createNewChat() {
        const newChat = {
            id: Date.now().toString(),
            name: `New Chat ${chats.length + 1}`,
            messages: []
        };
        
        // Show loading animation
        newChatButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        newChatButton.disabled = true;
        
        // Add to chats array
        chats.push(newChat);
        localStorage.setItem('chats', JSON.stringify(chats));
        
        // Set as current chat
        currentChatId = newChat.id;
        localStorage.setItem('currentChatId', currentChatId);
        
        // Clear messages
        messageContainer.innerHTML = '';
        
        // Set session flag for welcome message
        fetch('/set_new_chat', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    addWelcomeMessage();
                    // Save welcome message to chat
                    const currentChat = chats.find(c => c.id === currentChatId);
                    if (currentChat) {
                        currentChat.messages.push({ 
                            content: "I am Dominator AI made by Ratan Dubey. How can I assist you today?", 
                            isUser: false 
                        });
                        localStorage.setItem('chats', JSON.stringify(chats));
                    }
                }
            })
            .finally(() => {
                // Reset button state
                newChatButton.innerHTML = '<i class="fas fa-plus"></i> New Chat';
                newChatButton.disabled = false;
                
                // Update chat list
                displayChats();
                
                // Add visual feedback
                const chatItem = document.querySelector(`[data-chat-id="${newChat.id}"]`);
                if (chatItem) {
                    chatItem.classList.add('active');
                    chatItem.style.animation = 'highlight 1s ease';
                }
            });
    }

    // Load chat
    async function loadChat(chatId) {
        try {
            const response = await fetch(`/set_active_chat/${chatId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load chat');
            }

            const data = await response.json();
            
            if (data.success) {
                // Clear existing messages
                const messageContainer = document.querySelector('.message-container');
                messageContainer.innerHTML = '';
                
                // Update active chat in UI
                const chatItems = document.querySelectorAll('.chat-item');
                chatItems.forEach(item => {
                    item.classList.remove('active');
                    if (item.dataset.chatId === chatId.toString()) {
                        item.classList.add('active');
                    }
                });

                // Add messages to the container
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(message => {
                        appendMessage(message.content, message.is_user, false, message.id, message.edit_count);
                    });
                } else {
                    // Add welcome message if no messages
                    addWelcomeMessage();
                }

                // Scroll to bottom
                scrollToBottom();
            } else {
                throw new Error(data.error || 'Failed to load chat');
            }
        } catch (error) {
            console.error('Error loading chat:', error);
            appendErrorMessage('Failed to load chat. Please try again.');
        }
    }

    // Edit chat name
    function editChatName(chatItem, chat) {
        const chatName = chatItem.querySelector('.chat-name');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = chat.name;
        input.className = 'chat-name-input';
        
        chatName.replaceWith(input);
        input.focus();
        
        input.addEventListener('blur', () => {
            const newName = input.value.trim() || 'New Chat';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'chat-name';
            nameSpan.textContent = newName;
            input.replaceWith(nameSpan);
            
            // Update chat name in chats array
            chat.name = newName;
            localStorage.setItem('chats', JSON.stringify(chats));
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
    }

    // Message handling functions
    function addAIMessage(text) {
        const messageContainer = document.querySelector('.message-container');
        if (!messageContainer) {
            console.error('Message container not found');
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message glass-card';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        const avatarImg = document.createElement('img');
        avatarImg.src = '/static/websiteimages/dominatorai.jpg';
        avatarImg.alt = 'DominAI';
        avatar.appendChild(avatarImg);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = text;
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        
        messageContainer.appendChild(messageDiv);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    async function handleMessageSend(message) {
        if (isProcessingMessage || isRateLimited) {
            messageQueue.push(message);
            return;
        }

        try {
            isProcessingMessage = true;
            showTypingIndicator();

            // Append user message immediately
            appendMessage(message, true);

            console.log('Sending message to backend:', message); // Debug log

            // Send message to backend
            const response = await fetch('/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message
                })
            });

            console.log('Response status:', response.status); // Debug log

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get response from server');
            }

            const data = await response.json();
            console.log('Response data:', data); // Debug log
            
            if (data.success && data.response) {
                // Append AI response immediately
                appendMessage(data.response, false);
            } else {
                throw new Error(data.error || 'Failed to get AI response');
            }

        } catch (error) {
            console.error('Error sending message:', error);
            appendErrorMessage(error.message);
        } finally {
            isProcessingMessage = false;
            hideTypingIndicator();
            
            // Process next message in queue if any
            if (messageQueue.length > 0) {
                const nextMessage = messageQueue.shift();
                handleMessageSend(nextMessage);
            }
        }
    }

    function appendMessage(content, isUser, isQueued = false, messageId = null, editCount = null) {
        const messageContainer = document.querySelector('.message-container');
        if (!messageContainer) return;

        // Create message wrapper
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `message-wrapper ${isUser ? 'user-wrapper' : 'ai-wrapper'}`;
        
        // Create message element
        const message = document.createElement('div');
        message.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        
        // Create avatar
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        const avatarImg = document.createElement('img');
        avatarImg.src = isUser 
            ? document.querySelector('.user-profile-pic').src 
            : '/static/websiteimages/dominatorai.jpg';
        avatarImg.alt = isUser ? 'User' : 'DominAI';
        avatar.appendChild(avatarImg);
        
        // Create content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = content;
        contentDiv.appendChild(textDiv);
        
        // Assemble message
        if (isUser) {
            message.appendChild(contentDiv);
            message.appendChild(avatar);
        } else {
            message.appendChild(avatar);
            message.appendChild(contentDiv);
        }
        
        messageWrapper.appendChild(message);
        
        // Add to container with animation
        messageWrapper.style.opacity = '0';
        messageContainer.appendChild(messageWrapper);
        
        // Trigger animation
        requestAnimationFrame(() => {
            messageWrapper.style.opacity = '1';
            messageWrapper.style.transform = 'translateY(0)';
        });
        
        // Scroll to bottom
        scrollToBottom();
    }

    function appendErrorMessage(error) {
        const messageContainer = document.querySelector('.message-container');
        if (!messageContainer) return;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'message error-message fade-in';
        errorDiv.innerHTML = `
            <div class="message-content">
                <i class="fas fa-exclamation-circle"></i> ${error}
            </div>
        `;
        
        messageContainer.appendChild(errorDiv);
        scrollToBottom();

        // Remove error message after 5 seconds
        setTimeout(() => {
            errorDiv.classList.add('fade-out');
            setTimeout(() => {
                if (errorDiv.parentNode === messageContainer) {
                    messageContainer.removeChild(errorDiv);
                }
            }, 500);
        }, 5000);
    }

    function showTypingIndicator() {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.style.display = 'flex';
            const messageContainer = document.querySelector('.message-container');
            if (messageContainer) {
                messageContainer.scrollTop = messageContainer.scrollHeight;
            }
        }
    }

    function hideTypingIndicator() {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
    }

    // Delete chat with confirmation
    function deleteChat(chatId, chatItem) {
        const modal = document.getElementById('deleteConfirmModal');
        const confirmBtn = document.getElementById('confirmDelete');
        const cancelBtn = document.getElementById('cancelDelete');

        // Show modal
        modal.classList.add('show');

        // Handle confirm button click
        const confirmHandler = () => {
            // Remove chat from array
            chats = chats.filter(chat => chat.id !== chatId);
            localStorage.setItem('chats', JSON.stringify(chats));

            // Remove chat item from DOM with animation
            chatItem.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                chatItem.remove();
            }, 300);

            // If deleted chat was current chat, create new chat
            if (currentChatId === chatId) {
                messageContainer.innerHTML = '';
                if (chats.length === 0) {
                    createNewChat();
                } else {
                    loadChat(chats[0].id);
                }
            }
            // Check if no sessions exist after deletion and create a new one if needed
            if (chats.length === 0) {
                createNewChat();
            }

            // Hide modal
            modal.classList.remove('show');

            // Remove event listeners
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
        };

        // Handle cancel button click
        const cancelHandler = () => {
            modal.classList.remove('show');
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
        };

        // Add event listeners
        confirmBtn.addEventListener('click', confirmHandler);
        cancelBtn.addEventListener('click', cancelHandler);

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cancelHandler();
            }
        });
    }

    // Event Listeners
    newChatButton.addEventListener('click', createNewChat);

    // Initialize display
    displayChats();
}

function addWelcomeMessage() {
    const welcomeMessage = "I am Dominator AI made by Ratan Dubey. How can I assist you today?";
    appendMessage(welcomeMessage, false);
}

function addErrorMessage(error) {
    const messageContainer = document.querySelector('.message-container');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message error-message';
    errorDiv.innerHTML = `
        <div class="message-content">
            <i class="fas fa-exclamation-circle"></i> ${error}
        </div>
    `;
    messageContainer.appendChild(errorDiv);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

function scrollToBottom() {
    const messageContainer = document.querySelector('.message-container');
    if (messageContainer) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
}

// Profile picture preview
const profilePicInput = document.querySelector('#profile-pic');
if (profilePicInput) {
    profilePicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.querySelector('.profile-pic-preview');
                if (preview) {
                    preview.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

// Live Profile Picture Preview (for account page)
document.addEventListener('DOMContentLoaded', () => {
    const profileInput = document.getElementById('profileImageInput');
    const profilePreview = document.getElementById('profilePreview');
    if (profileInput && profilePreview) {
        profileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                profilePreview.src = URL.createObjectURL(file);
            }
        });
    }
});

// Message editing functionality
function editMessage(messageId) {
    const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
    const messageContent = messageElement.querySelector('.message-content');
    const originalText = messageContent.textContent;

    // Create edit interface
    const editInterface = document.createElement('div');
    editInterface.className = 'edit-interface';
    editInterface.innerHTML = `
        <textarea class="edit-textarea">${originalText}</textarea>
        <div class="edit-buttons">
            <button class="edit-save-btn">✔️ Save</button>
            <button class="edit-cancel-btn">❌ Cancel</button>
        </div>
    `;

    // Replace content with edit interface
    messageContent.style.display = 'none';
    messageElement.insertBefore(editInterface, messageContent.nextSibling);

    const textarea = editInterface.querySelector('.edit-textarea');
    textarea.focus();

    // Save button handler
    editInterface.querySelector('.edit-save-btn').addEventListener('click', async () => {
        const newText = textarea.value.trim();
        if (newText && newText !== originalText) {
            try {
                const response = await fetch(`/edit_message/${messageId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content: newText })
                });

                if (response.ok) {
                    const data = await response.json();
                    messageContent.textContent = newText;
                    
                    // Update edit count if provided
                    if (data.edit_count) {
                        let editNote = messageElement.querySelector('.edit-note');
                        if (!editNote) {
                            editNote = document.createElement('div');
                            editNote.className = 'edit-note';
                            messageElement.appendChild(editNote);
                        }
                        editNote.textContent = `Edited • ${data.edit_count} times`;
                    }
                } else {
                    throw new Error('Failed to update message');
                }
            } catch (error) {
                console.error('Error updating message:', error);
                alert('Failed to update message. Please try again.');
            }
        }
        
        // Cleanup edit interface
        messageContent.style.display = '';
        editInterface.remove();
    });

    // Cancel button handler
    editInterface.querySelector('.edit-cancel-btn').addEventListener('click', () => {
        messageContent.style.display = '';
        editInterface.remove();
    });
}

// Add CSS for edit interface
const style = document.createElement('style');
style.textContent = `
    .edit-interface {
        margin: 10px 0;
        width: 100%;
    }
    .edit-textarea {
        width: 100%;
        min-height: 100px;
        padding: 10px;
        border: 2px solid var(--accent-color);
        border-radius: 8px;
        background: var(--bg-color);
        color: var(--text-color);
        font-family: inherit;
        margin-bottom: 10px;
        resize: vertical;
    }
    .edit-buttons {
        display: flex;
        gap: 10px;
    }
    .edit-save-btn,
    .edit-cancel-btn {
        padding: 5px 15px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s ease;
    }
    .edit-save-btn {
        background: var(--accent-color);
        color: white;
    }
    .edit-cancel-btn {
        background: var(--error-color);
        color: white;
    }
    .edit-note {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 5px;
        font-style: italic;
    }
`;
document.head.appendChild(style);

// Add CSS for messages and animations
const messageStyles = document.createElement('style');
messageStyles.textContent = `
    .fade-in {
        opacity: 0;
        transform: translateY(10px);
        animation: fadeIn 0.3s ease forwards;
    }

    @keyframes fadeIn {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .message {
        margin: 16px 0;
        padding: 0 20px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        position: relative;
        max-width: 85%;
        transition: all 0.3s ease;
        animation: messageSlide 0.3s ease-out;
    }

    @keyframes messageSlide {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @media (max-width: 768px) {
        .message {
            padding: 0 16px;
            max-width: 90%;
            gap: 8px;
            margin: 12px 0;
        }
    }

    .user-message {
        margin-right: auto;
        flex-direction: row;
    }

    .ai-message {
        margin-left: auto;
        flex-direction: row-reverse;
    }

    .message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        border: 2px solid var(--accent-color);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
        background: var(--bg-color);
        position: relative;
    }

    .message-avatar::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 50%;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    @media (max-width: 768px) {
        .message-avatar {
            width: 28px;
            height: 28px;
        }
    }

    .message-avatar:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .message-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .message-content {
        padding: 12px 16px;
        border-radius: 16px;
        background: var(--message-bg);
        color: var(--text-color);
        word-break: break-word;
        font-size: 15px;
        line-height: 1.5;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        transition: all 0.2s ease;
        position: relative;
        display: inline-block;
        max-width: calc(100% - 44px);
        animation: bubblePop 0.3s ease-out;
    }

    @keyframes bubblePop {
        0% {
            transform: scale(0.95);
            opacity: 0;
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }

    @media (max-width: 768px) {
        .message-content {
            padding: 10px 14px;
            font-size: 14px;
            max-width: calc(100% - 36px);
        }
    }

    .user-message .message-content {
        background: var(--accent-color);
        color: white;
        border-bottom-left-radius: 4px;
        margin-left: 4px;
    }

    .ai-message .message-content {
        background: var(--bg-color);
        color: var(--text-color);
        border-bottom-right-radius: 4px;
        margin-right: 4px;
        border: 1px solid rgba(0, 0, 0, 0.08);
    }

    .light-theme .ai-message .message-content {
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
    }

    .dark-theme .ai-message .message-content {
        background: #2a2a2a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
    }

    .message-content:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        transform: translateY(-1px);
    }

    .error-message {
        color: var(--error-color);
        font-style: italic;
        text-align: center;
        margin: 12px auto;
        max-width: 100%;
        padding: 10px 16px;
        background: rgba(255, 0, 0, 0.05);
        border-radius: 12px;
        border: 1px solid rgba(255, 0, 0, 0.1);
        animation: shake 0.5s ease-in-out;
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }

    .message-actions {
        position: absolute;
        right: 10px;
        top: 5px;
        display: none;
        gap: 5px;
        opacity: 0;
        transition: all 0.2s ease;
    }

    .user-message:hover .message-actions {
        display: flex;
        opacity: 1;
    }

    .typing-indicator {
        display: none;
        align-items: center;
        margin: 12px auto;
        padding: 12px 16px;
        max-width: 85%;
        background: var(--bg-color);
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
    }

    .message-container {
        padding: 24px 0;
        display: flex;
        flex-direction: column;
        background: var(--bg-color);
        min-height: calc(100vh - 200px);
        overflow-y: auto;
        scroll-behavior: smooth;
    }

    /* Custom scrollbar for message container */
    .message-container::-webkit-scrollbar {
        width: 6px;
    }

    .message-container::-webkit-scrollbar-track {
        background: transparent;
    }

    .message-container::-webkit-scrollbar-thumb {
        background: var(--accent-color);
        border-radius: 3px;
    }

    .message-container::-webkit-scrollbar-thumb:hover {
        background: var(--accent-hover);
    }

    /* Message timestamp */
    .message-timestamp {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
        opacity: 0.7;
    }

    .user-message .message-timestamp {
        text-align: right;
    }

    .ai-message .message-timestamp {
        text-align: left;
    }

    /* Code block styling */
    .message-content pre {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 8px;
        padding: 12px;
        margin: 8px 0;
        overflow-x: auto;
        font-family: 'Fira Code', monospace;
        font-size: 14px;
        line-height: 1.4;
    }

    .dark-theme .message-content pre {
        background: rgba(255, 255, 255, 0.05);
    }

    /* Link styling */
    .message-content a {
        color: var(--accent-color);
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: all 0.2s ease;
        position: relative;
    }

    .message-content a:hover {
        border-bottom-color: var(--accent-color);
        color: var(--accent-hover);
    }

    /* List styling */
    .message-content ul,
    .message-content ol {
        margin: 8px 0;
        padding-left: 20px;
    }

    .message-content li {
        margin: 4px 0;
        position: relative;
    }

    .message-content li::marker {
        color: var(--accent-color);
    }

    /* Quote styling */
    .message-content blockquote {
        margin: 8px 0;
        padding: 8px 12px;
        border-left: 3px solid var(--accent-color);
        background: rgba(0, 0, 0, 0.03);
        border-radius: 4px;
    }

    .dark-theme .message-content blockquote {
        background: rgba(255, 255, 255, 0.03);
    }

    /* Message group styling */
    .message-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .message-group .message {
        margin: 0;
    }

    .message-group .message:not(:last-child) .message-content {
        border-bottom-left-radius: 16px;
        border-bottom-right-radius: 16px;
    }

    .message-group .message:not(:first-child) .message-content {
        border-top-left-radius: 16px;
        border-top-right-radius: 16px;
    }

    /* Message reactions */
    .message-reactions {
        display: flex;
        gap: 4px;
        margin-top: 4px;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.03);
        border-radius: 12px;
        font-size: 12px;
    }

    .dark-theme .message-reactions {
        background: rgba(255, 255, 255, 0.03);
    }

    /* Message status indicators */
    .message-status {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 2px;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .message-status i {
        font-size: 10px;
    }

    /* Message highlight effect */
    .message.highlight {
        animation: highlight 2s ease-out;
    }

    @keyframes highlight {
        0% { background: rgba(var(--accent-rgb), 0.1); }
        100% { background: transparent; }
    }
`;
document.head.appendChild(messageStyles);

// Add styles for messages and animations
const chatStyles = document.createElement('style');
chatStyles.textContent = `
    .input-controls {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .icon-btn {
        background: none;
        border: none;
        color: var(--text-color);
        cursor: pointer;
        padding: 5px;
        border-radius: 5px;
        transition: all 0.3s ease;
    }

    .icon-btn:hover {
        background: var(--hover-bg);
    }

    .send-button {
        background: var(--accent-color);
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .send-button:hover {
        background: var(--accent-hover);
    }

    .message {
        display: flex;
        margin: 10px;
        padding: 10px;
        border-radius: 8px;
        align-items: flex-start;
        gap: 10px;
        position: relative;
        opacity: 0;
        transform: translateY(10px);
        animation: fadeIn 0.3s ease forwards;
    }

    @keyframes fadeIn {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(chatStyles);

// Theme Management
function applyCustomTheme() {
    const body = document.body;
    const savedTheme = localStorage.getItem('theme') || 'dark';
    body.classList.toggle('light-theme', savedTheme === 'light');
    
    // Apply theme to all message bubbles
    const userMessages = document.querySelectorAll('.message.user-message');
    const aiMessages = document.querySelectorAll('.message.ai-message');
    
    userMessages.forEach(message => {
        message.classList.add('glass-card');
        const avatar = message.querySelector('.message-avatar img');
        if (avatar) {
            avatar.src = document.querySelector('.user-profile-pic').src;
        }
    });
    
    aiMessages.forEach(message => {
        message.classList.add('glass-card');
        const avatar = message.querySelector('.message-avatar img');
        if (avatar) {
            avatar.src = '/static/websiteimages/dominatorai.jpg';
        }
    });
    
    // Update theme icon
    const themeToggleBtn = document.querySelector('.theme-toggle-btn');
    if (themeToggleBtn) {
        updateThemeIcon(themeToggleBtn, savedTheme);
    }
}

// Add MutationObserver to watch for new messages
function initializeThemeObserver() {
    const messageContainer = document.querySelector('.message-container');
    if (!messageContainer) return;
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                applyCustomTheme();
            }
        });
    });
    
    observer.observe(messageContainer, {
        childList: true,
        subtree: true
    });
}

// --- Replace chat session and message logic with new API calls ---
// --- Sidebar: fetch and display sessions ---
async function displaySessions() {
    const chatList = document.querySelector('.chat-list');
    if (!chatList) return;
    try {
        const response = await fetch('/sessions');
        const data = await response.json();
        if (data.success) {
            chatList.innerHTML = '';
            data.sessions.forEach(session => {
                const chatItem = document.createElement('div');
                chatItem.className = 'chat-item glass-card';
                chatItem.dataset.sessionId = session.id;
                
                const titleSpan = document.createElement('span');
                titleSpan.className = 'chat-title';
                titleSpan.textContent = session.title || 'New Chat';
                titleSpan.contentEditable = true;
                titleSpan.addEventListener('blur', () => updateSessionTitle(session.id, titleSpan.textContent));
                titleSpan.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        titleSpan.blur();
                    }
                });
                
                chatItem.appendChild(titleSpan);
                chatItem.addEventListener('click', (e) => {
                    if (e.target !== titleSpan) {
                        setActiveSession(session.id);
                    }
                });
                
                chatList.appendChild(chatItem);
            });
        }
    } catch (error) {
        console.error('Failed to load sessions:', error);
        chatList.innerHTML = '<div class="error-message">Failed to load sessions</div>';
    }
}

async function updateSessionTitle(sessionId, newTitle) {
    try {
        const response = await fetch(`/sessions/${sessionId}/title`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: newTitle })
        });
        
        const data = await response.json();
        if (!data.success) {
            console.error('Failed to update title:', data.error);
            // Revert the title in the UI
            const titleSpan = document.querySelector(`[data-session-id="${sessionId}"] .chat-title`);
            if (titleSpan) {
                titleSpan.textContent = data.session.title;
            }
        }
    } catch (error) {
        console.error('Error updating title:', error);
    }
}

// --- New Chat: create new session ---
async function createNewSession() {
    const btn = document.querySelector('.new-chat-button');
    if (btn.disabled) return; // Prevent multiple clicks
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    
    try {
        const response = await fetch('/sessions', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        if (data.success) {
            await displaySessions();
            setActiveSession(data.session.id);
        } else {
            console.error('Failed to create session:', data.error);
        }
    } catch (error) {
        console.error('Error creating session:', error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus"></i> New Chat';
    }
}

// --- Set active session and load its messages ---
async function setActiveSession(sessionId) {
    try {
        const response = await fetch(`/sessions/${sessionId}/messages`);
        const data = await response.json();
        const messageContainer = document.querySelector('.message-container');
        messageContainer.innerHTML = '';
        if (data.success && data.messages.length > 0) {
            data.messages.forEach(msg => {
                appendMessage(msg.message, msg.sender === 'user');
            });
        } else {
            addWelcomeMessage();
        }
        // Highlight active session
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.sessionId == sessionId) item.classList.add('active');
        });
        // Store active session in sessionStorage
        sessionStorage.setItem('activeSessionId', sessionId);
    } catch (error) {
        appendErrorMessage('Failed to load messages.');
    }
}

// --- Send message in active session ---
async function handleMessageSend(message) {
    const sessionId = sessionStorage.getItem('activeSessionId');
    if (!sessionId) return appendErrorMessage('No session selected.');
    try {
        isProcessingMessage = true;
        showTypingIndicator();
        appendMessage(message, true);
        const response = await fetch(`/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const data = await response.json();
        if (data.success && data.reply) {
            appendMessage(data.reply, false);
        } else {
            appendErrorMessage(data.error || 'No reply.');
        }
    } catch (error) {
        appendErrorMessage('Failed to send message.');
    } finally {
        isProcessingMessage = false;
        hideTypingIndicator();
    }
}

// --- Bind new chat button ---
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.new-chat-button').onclick = createNewSession;
    displaySessions();
    // Load last active session if any
    const lastSession = sessionStorage.getItem('activeSessionId');
    if (lastSession) setActiveSession(lastSession);
}); 