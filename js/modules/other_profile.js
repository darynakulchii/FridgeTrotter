import { API_URL, getHeaders } from '../api-config.js';

// Отримуємо ID з URL
const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('user_id');
const currentUser = JSON.parse(localStorage.getItem('user'));

document.addEventListener('DOMContentLoaded', () => {
    if (!targetUserId) {
        alert('Користувача не знайдено');
        window.location.href = 'main_page_tours.html';
        return;
    }

    // Якщо ми відкрили свій же профіль - редірект на my_profile
    if (currentUser && targetUserId == currentUser.userId) {
        window.location.href = 'my_profile.html';
        return;
    }

    initTabs();
    loadProfileData();
    loadFridge();
    loadUserPosts(); // Тепер ця функція працює!
});

// 1. ТАБИ
function initTabs() {
    const navPills = document.querySelectorAll('.nav-pill');
    const tabContents = document.querySelectorAll('.tab-content');

    navPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            navPills.forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const tabName = pill.getAttribute('data-tab');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });
}

// 2. ДАНІ ПРОФІЛЮ
async function loadProfileData() {
    try {
        const response = await fetch(`${API_URL}/user/${targetUserId}/public-profile`, { headers: getHeaders() });

        if (!response.ok) throw new Error('User not found');

        const user = await response.json();
        renderProfileHeader(user);
    } catch (error) {
        console.error(error);
        document.querySelector('.profile-header-card').innerHTML =
            '<p class="text-center text-red-500 py-8">Користувача не знайдено або профіль приватний.</p>';
    }
}

function renderProfileHeader(user) {
    document.getElementById('profile-loading').classList.add('hidden');
    document.getElementById('profile-content').classList.remove('hidden');

    // Аватар
    const avatarContainer = document.getElementById('user-avatar-container');
    if (user.profile_image_url) {
        avatarContainer.innerHTML = `<img src="${user.profile_image_url}" class="avatar-lg" alt="${user.first_name}">`;
    } else {
        avatarContainer.innerHTML = `<div class="avatar-placeholder">${user.first_name[0]}${user.last_name[0]}</div>`;
    }

    // Текстові дані
    document.getElementById('user-name').innerText = `${user.first_name} ${user.last_name}`;
    document.getElementById('user-location').innerHTML = user.location ? `<i class="fas fa-map-marker-alt mr-1"></i> ${user.location}` : '';
    document.getElementById('user-bio').innerText = user.bio || 'Користувач не додав інформацію про себе.';
    document.getElementById('user-interests').innerText = user.travel_interests || 'Інтереси не вказані.';

    // Статистика
    document.getElementById('stat-countries').innerText = user.countries_visited;
    document.getElementById('stat-cities').innerText = user.cities_visited;
    document.getElementById('stat-followers').innerText = user.followers_count;

    // Кнопки (якщо залогінені)
    if (currentUser) {
        const actionContainer = document.getElementById('action-buttons');

        // Кнопка Підписатися
        const followBtn = document.createElement('button');
        followBtn.className = `btn-action btn-follow ${user.is_following ? 'following' : ''}`;
        followBtn.innerText = user.is_following ? 'Ви підписані' : 'Підписатися';
        followBtn.onclick = () => toggleFollow(followBtn);

        // Кнопка Повідомлення
        const msgBtn = document.createElement('button');
        msgBtn.className = 'btn-action btn-message';
        msgBtn.innerHTML = '<i class="far fa-comment-dots"></i> Написати';
        msgBtn.onclick = () => {
            window.location.href = `chat.html?user_id=${targetUserId}`;
        };

        actionContainer.appendChild(followBtn);
        actionContainer.appendChild(msgBtn);
    }
}

// 3. ХОЛОДИЛЬНИК
async function loadFridge() {
    const fridgeDoor = document.getElementById('fridge-door');
    const placeholder = document.getElementById('fridge-placeholder');

    try {
        const response = await fetch(`${API_URL}/fridge/${targetUserId}/layout`);

        if (response.status === 403) {
            placeholder.querySelector('p').innerText = 'Цей холодильник приватний 🔒';
            return;
        }

        const data = await response.json();

        if (data.magnets && data.magnets.length > 0) {
            placeholder.classList.add('hidden');
            data.magnets.forEach(m => {
                const el = createMagnetElement(m);
                el.style.left = `${m.x_position}px`;
                el.style.top = `${m.y_position}px`;
                fridgeDoor.appendChild(el);
            });
        }
    } catch (e) { console.error(e); }
}

function createMagnetElement(magnetData) {
    const div = document.createElement('div');
    div.className = `magnet-on-fridge ${magnetData.color_group || 'burgundy'}`;
    div.innerHTML = `
        <i class="fas fa-${magnetData.icon_class}"></i>
        <div class="text-[10px] font-bold mt-1 leading-tight pointer-events-none">${magnetData.city}</div>
        <div class="text-[8px] opacity-90 pointer-events-none">${magnetData.country}</div>
    `;
    return div;
}

// 4. ПОСТИ (РЕАЛІЗОВАНО)
async function loadUserPosts() {
    const container = document.getElementById('posts-container');

    // Встановлюємо стан завантаження
    container.innerHTML = '<p class="text-center text-gray-500 py-8"><i class="fas fa-spinner fa-spin"></i> Завантаження постів...</p>';

    try {
        // Використовуємо новий параметр author_id
        const response = await fetch(`${API_URL}/forum/posts?author_id=${targetUserId}`, { headers: getHeaders() });
        const data = await response.json();

        container.innerHTML = '';

        if (!data.posts || data.posts.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Користувач ще не створив жодного поста.</p>';
            return;
        }

        data.posts.forEach(post => {
            // HTML код картки поста (дублюється з forum.js, можна винести в util, але тут спрощено)
            let imagesHtml = '';
            if (post.images && post.images.length > 0) {
                const imgUrl = post.images[0]; // Показуємо тільки перше фото для компактності
                imagesHtml = `
                    <div class="h-48 mb-4 rounded-lg overflow-hidden relative">
                        <img src="${imgUrl}" class="w-full h-full object-cover">
                        ${post.images.length > 1 ? `<span class="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">+${post.images.length-1}</span>` : ''}
                    </div>
                `;
            }

            const html = `
                <div class="post-card mb-6">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h3 class="font-bold text-lg text-[#281822]">${post.title}</h3>
                            <span class="text-xs text-gray-400">${new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                        <span class="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">${post.category}</span>
                    </div>
                    
                    ${imagesHtml}
                    
                    <p class="text-gray-600 text-sm mb-4 line-clamp-3">${post.content}</p>
                    
                    <div class="flex items-center gap-4 text-gray-500 text-sm border-t border-gray-100 pt-3">
                        <span><i class="far fa-thumbs-up"></i> ${post.likes_count}</span>
                        <span><i class="far fa-comment-alt"></i> ${post.comments_count}</span>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (e) {
        console.error('Error loading posts:', e);
        container.innerHTML = '<p class="text-center text-red-500 py-8">Не вдалося завантажити пости.</p>';
    }
}

// 5. ДІЇ (Follow)
async function toggleFollow(btn) {
    const isFollowing = btn.classList.contains('following');
    const method = isFollowing ? 'DELETE' : 'POST';

    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/user/follow/${targetUserId}`, {
            method: method,
            headers: getHeaders()
        });

        if (res.ok) {
            if (isFollowing) {
                btn.classList.remove('following');
                btn.innerText = 'Підписатися';
                updateFollowersCount(-1);
            } else {
                btn.classList.add('following');
                btn.innerText = 'Ви підписані';
                updateFollowersCount(1);
            }
        }
    } catch (e) {
        console.error(e);
        alert('Помилка дії');
    } finally {
        btn.disabled = false;
    }
}

function updateFollowersCount(change) {
    const el = document.getElementById('stat-followers');
    let val = parseInt(el.innerText);
    el.innerText = val + change;
}