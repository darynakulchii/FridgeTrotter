import { API_URL, getHeaders } from '../api-config.js';

let socket;
let currentConversationId = null;
const currentUser = JSON.parse(localStorage.getItem('user'));

export function initChat() {
    if (!currentUser) return;

    // 1. Підключення до Socket.IO
    socket = io('http://localhost:3000'); // Адреса вашого бекенду

    socket.on('connect', () => {
        console.log('Connected to socket server:', socket.id);
        socket.emit('join_user_room', currentUser.userId);
    });

    socket.on('receive_message', (message) => {
        appendMessage(message, false);
    });

    // 2. Обробка UI
    const chatInput = document.querySelector('.chat-footer input');
    const sendBtn = document.querySelector('.chat-footer button');

    // Для демо: завантажимо першу доступну розмову або створимо нову
    loadConversations();

    sendBtn.addEventListener('click', () => sendMessage(chatInput));
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage(chatInput);
    });
}

async function loadConversations() {
    try {
        const response = await fetch(`${API_URL}/chat/conversations`, { headers: getHeaders() });
        const data = await response.json();

        if (data.conversations && data.conversations.length > 0) {
            // Відкриваємо останню розмову
            const lastConvo = data.conversations[0];
            currentConversationId = lastConvo.conversation_id;
            socket.emit('join_conversation', currentConversationId);
            loadMessages(currentConversationId);

            // Оновлюємо заголовок чату
            document.querySelector('.chat-header span').innerText =
                `${lastConvo.partner_first_name} ${lastConvo.partner_last_name}`;
        }
    } catch (e) { console.error(e); }
}

async function loadMessages(conversationId) {
    const chatBody = document.getElementById('chat-body');
    chatBody.innerHTML = ''; // Очистка

    try {
        const response = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, { headers: getHeaders() });
        const data = await response.json();

        data.messages.forEach(msg => {
            const isMe = msg.sender_id === currentUser.userId;
            appendMessage(msg, isMe);
        });
        scrollToBottom();
    } catch (e) { console.error(e); }
}

function sendMessage(inputElement) {
    const text = inputElement.value;
    if (!text.trim() || !currentConversationId) return;

    // Відправка через сокет (або API, залежить від реалізації беку. У вас бек слухає socket 'sendMessage')
    // Але для надійності краще використовувати REST API для збереження, а сокет для сповіщення.
    // Використаємо ваш REST API endpoint:

    // Тут треба знати ID отримувача. Для спрощення візьмемо з поточної розмови,
    // але в реальному додатку треба зберігати receiverId.
    // Поки що реалізуємо відправку через сокет, як у вас в chat.js:

    // УВАГА: Ваш socket.on('sendMessage') вимагає receiverId.
    // Нам потрібно отримати його при завантаженні розмови.
    // Це складний момент без повноцінного списку контактів.

    // Тимчасове рішення: просто додаємо візуально (емуляція),
    // поки не зробимо повноцінний вибір співрозмовника.

    const msgObj = {
        content: text,
        sender_id: currentUser.userId,
        sent_at: new Date()
    };

    appendMessage(msgObj, true);
    inputElement.value = '';
    scrollToBottom();

    // Тут мав би бути запит fetch(`${API_URL}/chat/messages`...)
}

function appendMessage(msg, isMe) {
    const chatBody = document.getElementById('chat-body');
    const div = document.createElement('div');
    div.classList.add('message-bubble');
    div.classList.add(isMe ? 'me' : 'other');
    div.innerText = msg.content;
    chatBody.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    const chatBody = document.getElementById('chat-body');
    chatBody.scrollTop = chatBody.scrollHeight;
}

// Ініціалізація при завантаженні
document.addEventListener('DOMContentLoaded', initChat);