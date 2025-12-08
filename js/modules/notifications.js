import { API_URL, getHeaders } from '../api-config.js';

let socket;
const currentUser = JSON.parse(localStorage.getItem('user'));

export function initNotifications() {
    if (!currentUser) return;

    setupSocket();
    loadNotificationsCount(); // Завантажуємо кількість при старті

    // ВИПРАВЛЕННЯ: Використовуємо делегування подій замість прямого пошуку елемента.
    // Це дозволяє обробити клік навіть якщо кнопка завантажилася динамічно через fetch.
    document.addEventListener('click', (e) => {
        // Шукаємо найближчий елемент з ID notifications-btn (бо клік може бути по іконці всередині кнопки)
        const btn = e.target.closest('#notifications-btn');

        if (btn) {
            // Якщо клікнули саме по цій кнопці - вантажимо список
            loadNotificationsList();
            markAsRead();
        }
    });

    // Те саме для кнопки "Позначити все як прочитане" (вона теж динамічна)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#mark-all-read-btn')) {
            markAsRead();
        }
    });
}

function setupSocket() {
    if (typeof io === 'undefined') return;

    // Підключення до сокета
    socket = io('http://localhost:3000');

    socket.on('connect', () => {
        socket.emit('join_user_room', currentUser.userId);
    });

    socket.on('new_notification', (notification) => {
        console.log('New notification:', notification);
        updateBadgeCount(1, true);

        // Якщо модалка відкрита, додаємо повідомлення в реальному часі
        const list = document.getElementById('notifications-list');
        const modal = document.getElementById('notifications-modal');

        // Перевіряємо, чи модалка активна
        if (modal && modal.classList.contains('active') && list) {
            // Прибираємо повідомлення "Немає нових сповіщень", якщо воно було
            const emptyMsg = list.querySelector('.text-gray-400');
            if (emptyMsg) emptyMsg.remove();

            const html = createNotificationHTML(notification);
            list.insertAdjacentHTML('afterbegin', html);
        }
    });
}

// Завантаження списку
async function loadNotificationsList() {
    const list = document.getElementById('notifications-list');
    // Якщо список ще не відмалювався навігацією (малоймовірно при кліку, але можливо) - виходимо
    if (!list) return;

    // Встановлюємо спінер програмно перед запитом
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

        // Оновлюємо бейдж (скидаємо або ставимо актуальне)
        updateBadgeCount(data.unreadCount, false);

    } catch (error) {
        console.error(error);
        list.innerHTML = '<div class="p-4 text-center text-red-500">Помилка завантаження даних</div>';
    }
}

// Решта функцій без змін...
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
        // Оновлюємо бейдж на 0
        updateBadgeCount(0);

        // Візуально прибираємо стиль непрочитаних
        const list = document.getElementById('notifications-list');
        if (list) {
            list.querySelectorAll('.notification-item.unread').forEach(el => {
                el.classList.remove('unread');
                const iconBox = el.querySelector('.notification-icon-box');
                if(iconBox) {
                    iconBox.style.backgroundColor = '#e5e7eb';
                    iconBox.style.color = '#4b5563';
                }
            });
        }
    } catch (e) { console.error(e); }
}

function updateBadgeCount(count, isIncrement = false) {
    // Оскільки навігація динамічна, шукаємо бейдж кожного разу
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

    let icon = 'fa-bell';
    if (notif.message.includes('повідомлення')) icon = 'fa-comment-alt';
    if (notif.message.includes('лайк')) icon = 'fa-heart';
    if (notif.message.includes('тур')) icon = 'fa-plane';

    const tag = notif.link_url ? 'a' : 'div';
    const href = notif.link_url ? `href="${notif.link_url}"` : '';

    return `
        <${tag} ${href} class="notification-item ${isUnread}">
            <div class="notification-icon-box" style="${!notif.is_read ? 'background-color: #2D4952; color: #fff;' : ''}">
                <i class="fas ${icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-text">${notif.message}</div>
                <div class="notification-time">${time}</div>
            </div>
        </${tag}>
    `;
}