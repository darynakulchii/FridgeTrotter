import { API_URL, getHeaders } from '../api-config.js';

let socket;
let currentConversationId = null;
let currentReceiverId = null;
const currentUser = JSON.parse(localStorage.getItem('user'));

document.addEventListener('DOMContentLoaded', () => {
    // Перевіряємо, чи ми на сторінці чату, щоб не запускати логіку даремно
    if (document.querySelector('.chat-page-main')) {
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }
        initChatPage();
    }
});

function initChatPage() {
    setupSocketIO();
    loadConversations();
    setupMessageForm();
    checkUrlParams(); // Перевірка, чи треба відкрити чат з конкретним юзером
}

// === SOCKET.IO ===
function setupSocketIO() {
    if (typeof io === 'undefined') return;

    socket = io('http://localhost:3000'); // Адреса вашого сервера

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        socket.emit('join_user_room', currentUser.userId);
    });

    socket.on('receive_message', (message) => {
        console.log('New message received:', message);

        // Якщо відкрита ця розмова, додаємо повідомлення
        if (currentConversationId && message.conversation_id == currentConversationId) {
            // Перевіряємо, чи це не моє повідомлення (мої додаються миттєво)
            if (message.sender_id !== currentUser.userId) {
                appendMessage(message, false);
                scrollToBottom();
            }
        } else {
            // Якщо повідомлення в іншій розмові - оновлюємо список розмов
            loadConversations();
            // Тут можна додати візуальне сповіщення (червону крапку)
        }
    });
}

// === API ЗАПИТИ ===

// Завантаження списку розмов
async function loadConversations() {
    const listContainer = document.getElementById('conversations-list');

    try {
        // Використовуємо правильний шлях для FridgeTrotter API
        const response = await fetch(`${API_URL}/chat/conversations`, { headers: getHeaders() });
        const data = await response.json();

        listContainer.innerHTML = ''; // Очищення

        if (!data.conversations || data.conversations.length === 0) {
            listContainer.innerHTML = '<p class="text-center text-gray-500 py-4">У вас ще немає розмов.</p>';
            return;
        }

        data.conversations.forEach(conv => {
            const isActive = currentConversationId == conv.conversation_id ? 'active' : '';
            const lastMsg = conv.last_message || 'Немає повідомлень';
            const name = `${conv.partner_first_name} ${conv.partner_last_name}`;

            // Аватарка або ініціали
            let avatarHtml;
            if (conv.partner_avatar_url) {
                avatarHtml = `<img src="${conv.partner_avatar_url}" class="user-avatar-img" alt="${name}">`;
            } else {
                const initials = (conv.partner_first_name[0] || '') + (conv.partner_last_name[0] || '');
                avatarHtml = `<div class="user-avatar-placeholder">${initials}</div>`;
            }

            const html = `
                <div class="conversation-item ${isActive}" onclick="openConversation(${conv.conversation_id}, ${conv.partner_id}, '${name}', '${conv.partner_avatar_url || ''}')">
                    ${avatarHtml}
                    <div class="conversation-info">
                        <h4>${name}</h4>
                        <p>${lastMsg}</p>
                    </div>
                </div>
            `;
            listContainer.insertAdjacentHTML('beforeend', html);
        });

    } catch (error) {
        console.error('Error loading conversations:', error);
        listContainer.innerHTML = '<p class="text-center text-red-500 py-4">Помилка завантаження.</p>';
    }
}

// Відкриття конкретної розмови
window.openConversation = async (conversationId, partnerId, partnerName, partnerAvatar) => {
    currentConversationId = conversationId;
    currentReceiverId = partnerId;

    // Оновлення UI
    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    // Знаходимо елемент, на який клікнули (приблизний пошук, бо onclick вішається на рядок)
    // В ідеалі краще через dataset, але поки так:
    loadConversations(); // Перезавантажимо, щоб оновити клас active коректно

    // Оновлення хедера чату
    const header = document.getElementById('chat-header');
    let avatarHtml = partnerAvatar
        ? `<img src="${partnerAvatar}" class="w-10 h-10 rounded-full object-cover">`
        : `<div class="w-10 h-10 rounded-full bg-[#2D4952] flex items-center justify-center text-white font-bold">${partnerName[0]}</div>`;

    header.innerHTML = `
        <div class="flex items-center gap-3">
            ${avatarHtml}
            <h3 class="font-bold text-[#281822] text-lg">${partnerName}</h3>
        </div>
    `;

    // Показуємо форму вводу
    document.getElementById('message-form').style.display = 'flex';

    // Завантаження повідомлень
    await loadMessages(conversationId);

    // Приєднання до кімнати сокета
    if(socket) socket.emit('join_conversation', conversationId);
};

// Завантаження повідомлень для розмови
async function loadMessages(conversationId) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '<p class="text-center text-gray-400 mt-4"><i class="fas fa-spinner fa-spin"></i> Завантаження...</p>';

    try {
        const response = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, { headers: getHeaders() });
        const data = await response.json();

        container.innerHTML = ''; // Очищення спінера

        if (data.messages.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-400 mt-10">Повідомлень ще немає. Напишіть першим!</p>';
            return;
        }

        data.messages.forEach(msg => {
            const isMe = msg.sender_id === currentUser.userId;
            appendMessage(msg, isMe);
        });

        scrollToBottom();

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="text-center text-red-500">Не вдалося завантажити повідомлення.</p>';
    }
}

// Додавання повідомлення в DOM
function appendMessage(msg, isMe) {
    const container = document.getElementById('messages-container');

    // Видаляємо повідомлення "порожньо", якщо воно є
    if (container.querySelector('.text-center')) container.innerHTML = '';

    const time = new Date(msg.sent_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const html = `
        <div class="message-bubble ${isMe ? 'me' : 'other'}">
            ${msg.content || msg.message_body}
            <span class="message-time">${time}</span>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

// Налаштування форми відправки
function setupMessageForm() {
    const form = document.getElementById('message-form');
    const input = document.getElementById('message-input');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || !currentReceiverId) return;

        // Оптимістичне додавання в UI
        const tempMsg = {
            content: text,
            sender_id: currentUser.userId,
            sent_at: new Date()
        };
        appendMessage(tempMsg, true);
        scrollToBottom();
        input.value = '';

        try {
            const response = await fetch(`${API_URL}/chat/messages`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    receiver_id: currentReceiverId,
                    content: text // Зверніть увагу: бекенд FridgeTrotter очікує 'content', а не 'message_body' в create endpoint?
                    // Перевірив ваш код бекенду: там `const { receiver_id, content } = req.body;`
                    // Тому поле має називатись 'content'
                })
            });

            if (!response.ok) throw new Error('Failed to send');

            // Якщо це було перше повідомлення в новій розмові - оновити список
            // (можна перевірити, чи є currentConversationId)
            loadConversations();

        } catch (error) {
            console.error(error);
            alert('Помилка відправки повідомлення');
        }
    });
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

// Перевірка URL параметрів (якщо перейшли з профілю користувача)
async function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const userIdToChat = urlParams.get('user_id');

    if (userIdToChat && userIdToChat != currentUser.userId) {
        // Спробуємо знайти існуючу розмову в списку (після його завантаження)
        // Але оскільки loadConversations асинхронний, краще зробити прямий запит або імітацію

        console.log("Opening chat with user:", userIdToChat);

        // Отримуємо інфо про юзера, щоб красиво відобразити хедер, навіть якщо розмови ще немає
        try {
            const res = await fetch(`${API_URL}/user/${userIdToChat}/public-profile`); // Перевірте, чи є такий роут у вашому user.js (у StudentHousing він був)
            // Якщо немає роуту user/:id, використайте public-profile логіку
            // У вашому коді бекенду `user.js` є `/api/users/:id/public-profile`

            // Виправлення URL
            const publicProfileRes = await fetch(`${API_URL.replace('/api', '')}/api/users/${userIdToChat}/public-profile`);

            if (publicProfileRes.ok) {
                const user = await publicProfileRes.json();
                const name = `${user.first_name} ${user.last_name}`;

                // Встановлюємо ID отримувача
                currentReceiverId = userIdToChat;

                // Оновлюємо хедер
                const header = document.getElementById('chat-header');
                header.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-[#2D4952] flex items-center justify-center text-white font-bold">${user.first_name[0]}</div>
                        <h3 class="font-bold text-[#281822] text-lg">${name}</h3>
                    </div>
                `;

                document.getElementById('message-form').style.display = 'flex';
                document.getElementById('messages-container').innerHTML = '<p class="text-center text-gray-400 mt-10">Це початок вашої історії повідомлень.</p>';

                // Важливо: currentConversationId тут може бути null, якщо розмови ще немає.
                // Бекенд створить її при першому повідомленні.
            }
        } catch (e) { console.error(e); }
    }
}