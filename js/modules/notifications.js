import { API_URL, getHeaders } from '../api-config.js';

let socket;
const currentUser = JSON.parse(localStorage.getItem('user'));

export function initNotifications() {
    if (!currentUser) return;

    setupSocket();
    loadNotificationsCount(); // Завантажуємо кількість при старті

    // Прив'язка кнопки відкриття (вона в навігації)
    // Оскільки навігація може завантажуватись динамічно, використовуємо делегування або таймер,
    // але в вашому коді navigation.js вже обробляє клік на 'notifications-btn'.
    // Ми підпишемось на подію відкриття модалки, щоб завантажити список.

    const notifBtn = document.getElementById('notifications-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            loadNotificationsList();
            markAsRead();
        });
    }

    // Кнопка "Позначити всі як прочитані" в модалці
    const markReadBtn = document.getElementById('mark-all-read-btn');
    if (markReadBtn) {
        markReadBtn.addEventListener('click', markAsRead);
    }
}

function setupSocket() {
    if (typeof io === 'undefined') return;

    // Використовуємо той самий сокет, якщо він вже ініціалізований в chat.js,
    // або створюємо новий, якщо це глобальний скрипт.
    // Для надійності тут окреме підключення, але socket.io менеджер зазвичай це оптимізує.
    socket = io('http://localhost:3000');

    socket.on('connect', () => {
        socket.emit('join_user_room', currentUser.userId);
    });

    socket.on('new_notification', (notification) => {
        console.log('New notification:', notification);
        // Оновлюємо бейдж
        updateBadgeCount(1, true); // true означає "додати до поточного"

        // Якщо модалка відкрита, додаємо в список
        const list = document.getElementById('notifications-list');
        const modal = document.getElementById('notifications-modal');
        if (modal && modal.classList.contains('active') && list) {
            const html = createNotificationHTML(notification);
            list.insertAdjacentHTML('afterbegin', html);
        }
    });
}

// Завантаження списку
async function loadNotificationsList() {
    const list = document.getElementById('notifications-list');
    if (!list) return;

    list.innerHTML = '<div class="p-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin"></i> Завантаження...</div>';

    try {
        const response = await fetch(`${API_URL}/notifications`, { headers: getHeaders() });
        const data = await response.json();

        list.innerHTML = '';

        if (!data.notifications || data.notifications.length === 0) {
            list.innerHTML = '<div class="p-8 text-center text-gray-400">Немає нових сповіщень</div>';
            updateBadgeCount(0);
            return;
        }

        data.notifications.forEach(notif => {
            list.insertAdjacentHTML('beforeend', createNotificationHTML(notif));
        });

        // Оновлюємо бейдж (хоча ми їх щойно відкрили, тому логічно буде 0 після закриття або виклику markAsRead)
        // Але тут ми просто показуємо точну кількість з сервера
        updateBadgeCount(data.unreadCount, false);

    } catch (error) {
        console.error(error);
        list.innerHTML = '<div class="p-4 text-center text-red-500">Помилка завантаження</div>';
    }
}

// Завантаження тільки кількості (для бейджа при старті)
async function loadNotificationsCount() {
    try {
        const response = await fetch(`${API_URL}/notifications`, { headers: getHeaders() });
        const data = await response.json();
        updateBadgeCount(data.unreadCount, false);
    } catch (e) { console.error(e); }
}

async function markAsRead() {
    try {
        await fetch(`${API_URL}/notifications/read`, {
            method: 'PATCH',
            headers: getHeaders()
        });
        updateBadgeCount(0);

        // Візуально прибираємо клас unread
        document.querySelectorAll('.notification-item.unread').forEach(el => {
            el.classList.remove('unread');
            const iconBox = el.querySelector('.notification-icon-box');
            if(iconBox) {
                iconBox.style.backgroundColor = '#e5e7eb';
                iconBox.style.color = '#4b5563';
            }
        });
    } catch (e) { console.error(e); }
}

function updateBadgeCount(count, isIncrement = false) {
    const badge = document.querySelector('.badge-dot');
    if (!badge) return;

    let current = parseInt(badge.innerText) || 0;
    let finalCount = isIncrement ? current + count : count;

    if (finalCount > 0) {
        badge.style.display = 'flex';
        badge.innerText = finalCount > 9 ? '9+' : finalCount;
    } else {
        badge.style.display = 'none';
        badge.innerText = '0';
    }
}

function createNotificationHTML(notif) {
    const time = new Date(notif.created_at).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const isUnread = !notif.is_read ? 'unread' : '';

    // Вибір іконки залежно від тексту
    let icon = 'fa-bell';
    if (notif.message.includes('повідомлення')) icon = 'fa-comment-alt';
    if (notif.message.includes('лайк')) icon = 'fa-heart';
    if (notif.message.includes('тур')) icon = 'fa-plane';

    // Якщо є посилання, робимо тег <a>, інакше <div>
    const tag = notif.link_url ? 'a' : 'div';
    const href = notif.link_url ? `href="${notif.link_url}"` : '';

    return `
        <${tag} ${href} class="notification-item ${isUnread}">
            <div class="notification-icon-box">
                <i class="fas ${icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-text">${notif.message}</div>
                <div class="notification-time">${time}</div>
            </div>
        </${tag}>
    `;
}