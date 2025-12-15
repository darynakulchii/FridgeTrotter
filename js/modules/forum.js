import { API_URL, getHeaders } from '../api-config.js';
import { initPostForm } from './create_post.js';

let currentPostId = null;
const currentUser = JSON.parse(localStorage.getItem('user'));

document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
    initCreatePostModal();

    // Слухачі для фільтрів (з debounce для пошуку)
    document.getElementById('forum-search')?.addEventListener('input', debounce(loadPosts, 500));
    document.getElementById('forum-category')?.addEventListener('change', loadPosts);
    document.getElementById('forum-sort')?.addEventListener('change', loadPosts);

    // Слухач для форми коментарів (якщо вона є в DOM)
    const commentForm = document.getElementById('add-comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', handleCommentSubmit);
    }
});

// === 1. ЛОГІКА СТВОРЕННЯ ПОСТА ===
function initCreatePostModal() {
    const createBtn = document.getElementById('create-post-btn');
    const modal = document.getElementById('create-post-modal');

    if (createBtn && modal) {
        createBtn.addEventListener('click', () => {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Будь ласка, увійдіть у свій акаунт.');
                window.location.href = 'login.html';
                return;
            }
            modal.classList.add('active');

            // Викликаємо функцію з create_post.js для ініціалізації форми
            initPostForm(() => {
                alert('Пост успішно опубліковано!');
                modal.classList.remove('active');
                loadPosts(); // Оновлюємо список
            });
        });
    }

    document.getElementById('cancel-post-btn')?.addEventListener('click', () => {
        if (modal) modal.classList.remove('active');
    });
}

// === 2. ЗАВАНТАЖЕННЯ СПИСКУ ПОСТІВ ===
async function loadPosts() {
    const container = document.getElementById('forum-posts-container');
    const search = document.getElementById('forum-search')?.value || '';
    const category = document.getElementById('forum-category')?.value || '';
    const sort = document.getElementById('forum-sort')?.value || '';

    // Формуємо параметри для API
    const params = new URLSearchParams({
        search,
        category: category === 'Всі теми' ? '' : category,
        sort: sort === 'Останні' ? 'newest' : (sort === 'Популярні' ? 'popular' : 'unanswered')
    });

    try {
        const response = await fetch(`${API_URL}/forum/posts?${params}`);
        const data = await response.json();
        const posts = data.posts;

        container.innerHTML = '';

        if (!posts || posts.length === 0) {
            container.innerHTML = '<p class="text-gray-500 col-span-2 text-center py-8">Постів не знайдено.</p>';
            return;
        }

        posts.forEach(post => {
            // --- ЛОГІКА ПОСИЛАННЯ НА ПРОФІЛЬ ---
            // Якщо це я -> my_profile.html
            // Якщо це інший користувач (або агент) -> other_user_profile.html?user_id=...
            // other_user_profile.js сам розбереться, як відобразити агента
            let profileUrl = `other_user_profile.html?user_id=${post.author_id}`;
            if (currentUser && currentUser.userId === post.author_id) {
                profileUrl = 'my_profile.html';
            }

            // --- АВАТАР ---
            let avatarContent = post.author_avatar
                ? `<img src="${post.author_avatar}" class="w-full h-full object-cover rounded-full">`
                : `<div class="w-full h-full flex items-center justify-center font-bold text-white text-sm">${(post.first_name[0] + post.last_name[0]).toUpperCase()}</div>`;

            // Колір фону аватара (Темніший для агентів)
            const avatarBg = post.is_agent ? '#281822' : '#48192E';

            // --- ЗОБРАЖЕННЯ ТА БЕЙДЖ КАТЕГОРІЇ ---
            let imageSection = '';
            if (post.images && post.images.length > 0) {
                imageSection = `
                    <div class="card-image-middle h-48 relative overflow-hidden bg-gray-100">
                        <img src="${post.images[0]}" alt="${post.title}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105">
                        <span class="card-badge">${post.category}</span>
                    </div>
                `;
            } else {
                // Стильна заглушка з градієнтом, якщо немає фото
                imageSection = `
                    <div class="card-image-middle h-24 bg-gradient-to-r from-gray-100 to-gray-200 relative overflow-hidden flex items-center justify-center">
                        <span class="card-badge relative top-auto right-auto m-0 opacity-80">${post.category}</span>
                    </div>
                `;
            }

            // --- ЗБИРАЄМО HTML ---
            const html = `
                <div class="universal-card cursor-pointer group" onclick="openPostDetails(${post.post_id})">
                    
                    <div class="card-header-user" onclick="event.stopPropagation(); window.location.href='${profileUrl}'">
                        <div class="card-avatar" style="background-color: ${avatarBg};">
                            ${avatarContent}
                        </div>
                        <div class="card-user-info">
                            <div class="card-user-name hover:underline flex items-center gap-1">
                                ${post.first_name} ${post.last_name} 
                                ${post.is_agent ? '<i class="fas fa-check-circle text-blue-500" title="Турагент"></i>' : ''}
                            </div>
                            <div class="card-user-sub">
                                <span>${new Date(post.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    ${imageSection}

                    <div class="card-body flex flex-col p-4">
                        <h3 class="card-title line-clamp-2 hover:text-[#48192E] transition">${post.title}</h3>
                        <p class="text-gray-600 text-sm line-clamp-3 mb-4">${post.content}</p>
                    </div>

                    <div class="card-footer gap-2 px-4 py-3 border-t border-gray-100 flex items-center !mt-0">
                        
                        <button onclick="toggleLike(${post.post_id}, event)" class="btn-icon-square px-3 w-auto flex items-center gap-2 text-sm" title="Подобається">
                            <i class="far fa-thumbs-up"></i> <span>${post.likes_count}</span>
                        </button>

                        <button onclick="openPostDetails(${post.post_id})" class="btn-icon-square px-3 w-auto flex items-center gap-2 text-sm" title="Коментарі">
                            <i class="far fa-comment-alt"></i> <span>${post.comments_count || 0}</span>
                        </button>

                        <button onclick="toggleSavePost(${post.post_id}, event)" class="btn-icon-square" title="Зберегти">
                            <i class="far fa-bookmark" id="post-bookmark-${post.post_id}"></i>
                        </button>
                        
                        <div class="flex-grow"></div>

                        <button class="btn-outline px-4 text-sm h-10" onclick="event.stopPropagation(); openPostDetails(${post.post_id})">
                            Деталі
                        </button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (error) {
        console.error('Error loading posts:', error);
        container.innerHTML = '<p class="text-center text-red-500">Помилка завантаження постів.</p>';
    }
}

// === 3. ДЕТАЛІ ПОСТА ===
window.openPostDetails = async (postId) => {
    currentPostId = postId;
    const modal = document.getElementById('post-details-modal');
    modal.classList.add('active');

    // Очищення попередніх даних
    const els = {
        title: document.getElementById('detail-post-title'),
        content: document.getElementById('detail-post-content'),
        author: document.getElementById('detail-post-author'),
        date: document.getElementById('detail-post-date'),
        category: document.getElementById('detail-post-category'),
        avatar: document.getElementById('detail-post-avatar'),
        mainImg: document.getElementById('detail-post-main-image'),
        gallery: document.getElementById('detail-post-gallery'),
        commentsCount: document.getElementById('detail-comments-count')
    };

    // Стан завантаження
    els.title.innerText = 'Завантаження...';
    els.content.innerText = '';
    els.mainImg.classList.add('hidden');
    els.gallery.innerHTML = '';
    document.getElementById('detail-comments-list').innerHTML = '<p class="text-gray-400 text-sm">Завантаження коментарів...</p>';

    try {
        const res = await fetch(`${API_URL}/forum/posts/${postId}`);
        const data = await res.json();
        const post = data.post;

        els.title.innerText = post.title;
        els.content.innerText = post.content;

        // Посилання на автора в модалці
        let profileUrl = currentUser && currentUser.userId === post.author_id
            ? 'my_profile.html'
            : `other_user_profile.html?user_id=${post.author_id}`;

        let authorNameHtml = `${post.first_name} ${post.last_name}`;
        // Можна додати перевірку на агента тут, якщо API повертає is_agent в /posts/:id

        els.author.innerHTML = `<a href="${profileUrl}" class="hover:underline text-[#281822]">${authorNameHtml}</a>`;
        els.date.innerText = new Date(post.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' });
        els.category.innerText = post.category;

        // Аватар
        if(post.author_avatar) {
            els.avatar.innerHTML = `<img src="${post.author_avatar}" class="w-full h-full object-cover">`;
        } else {
            els.avatar.innerText = (post.first_name[0] + post.last_name[0]);
        }

        // Фотографії
        if (post.images && post.images.length > 0) {
            els.mainImg.src = post.images[0];
            els.mainImg.classList.remove('hidden');

            if (post.images.length > 1) {
                post.images.forEach(imgUrl => {
                    const thumb = document.createElement('img');
                    thumb.src = imgUrl;
                    thumb.className = "w-full h-16 object-cover rounded cursor-pointer hover:opacity-80 transition border border-transparent hover:border-[#48192E]";
                    thumb.onclick = () => { els.mainImg.src = imgUrl; };
                    els.gallery.appendChild(thumb);
                });
            }
        }

        loadComments(postId);

    } catch (e) {
        console.error(e);
        alert('Не вдалося завантажити деталі поста');
        modal.classList.remove('active');
    }
};

// === 4. КОМЕНТАРІ ===
async function loadComments(postId) {
    const list = document.getElementById('detail-comments-list');
    const countEl = document.getElementById('detail-comments-count');

    try {
        const res = await fetch(`${API_URL}/forum/posts/${postId}/comments`);
        const data = await res.json();

        list.innerHTML = '';
        countEl.innerText = data.comments.length;

        if (data.comments.length === 0) {
            list.innerHTML = '<p class="text-gray-400 text-sm italic">Коментарів поки немає. Будьте першим!</p>';
            return;
        }

        data.comments.forEach(c => {
            // Посилання на профіль коментатора
            const commenterProfileUrl = currentUser && currentUser.userId === c.user_id
                ? 'my_profile.html'
                : `other_user_profile.html?user_id=${c.user_id}`;

            const avatarHtml = c.author_avatar
                ? `<img src="${c.author_avatar}" class="w-8 h-8 rounded-full object-cover">`
                : `<div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">${c.first_name[0]}</div>`;

            const html = `
                <div class="flex gap-3 items-start">
                    <a href="${commenterProfileUrl}" class="shrink-0 hover:opacity-80 transition block w-8 h-8">
                        ${avatarHtml}
                    </a>
                    <div class="bg-white p-3 rounded-lg border border-gray-100 flex-grow shadow-sm">
                        <div class="flex justify-between items-baseline mb-1">
                            <a href="${commenterProfileUrl}" class="font-bold text-sm text-[#281822] hover:underline">${c.first_name} ${c.last_name}</a>
                            <span class="text-xs text-gray-400">${new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <p class="text-gray-700 text-sm leading-relaxed">${c.content}</p>
                    </div>
                </div>
            `;
            list.insertAdjacentHTML('beforeend', html);
        });

    } catch (e) { console.error(e); }
}

async function handleCommentSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('comment-input');
    const content = input.value.trim();

    if (!content) return;
    if (!localStorage.getItem('token')) {
        alert('Увійдіть, щоб коментувати.');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/forum/posts/${currentPostId}/comments`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ content })
        });

        if (res.ok) {
            input.value = '';
            loadComments(currentPostId);
        } else {
            alert('Помилка при відправці.');
        }
    } catch (e) { console.error(e); }
}

// === 5. ДОПОМІЖНІ ФУНКЦІЇ ===

function debounce(func, timeout = 300){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// Глобальна функція для лайків (викликається з onclick)
window.toggleLike = async (postId, event) => {
    if(event) event.stopPropagation();
    const token = localStorage.getItem('token');
    if(!token) return alert('Увійдіть, щоб ставити лайки');

    try {
        await fetch(`${API_URL}/forum/posts/${postId}/like`, { method: 'POST', headers: getHeaders() });
        // Оновлюємо список постів, щоб показати новий лічильник
        // (Для кращого UX можна оновлювати лише конкретний елемент DOM, але це простіше)
        loadPosts();
    } catch(e) { console.error(e); }
};

// Глобальна функція для збереження (викликається з onclick)
window.toggleSavePost = async (postId, event) => {
    if(event) event.stopPropagation();
    const token = localStorage.getItem('token');
    if(!token) return alert('Увійдіть, щоб зберігати пости');

    const icon = document.getElementById(`post-bookmark-${postId}`);
    // Визначаємо поточний стан за класом іконки (fas - заповнена/збережена, far - пуста)
    const isSaved = icon.classList.contains('fas');

    const method = isSaved ? 'DELETE' : 'POST';
    const url = isSaved ? `${API_URL}/forum/saved/${postId}` : `${API_URL}/forum/posts/${postId}/save`;

    try {
        const res = await fetch(url, { method: method, headers: getHeaders() });
        if(res.ok) {
            // Перемикаємо іконку
            icon.classList.toggle('fas');
            icon.classList.toggle('far');

            // Оновлюємо стиль кнопки (активна/неактивна)
            const btn = icon.closest('button');
            if (icon.classList.contains('fas')) {
                btn.classList.add('text-[#48192E]', 'border-[#48192E]');
            } else {
                btn.classList.remove('text-[#48192E]', 'border-[#48192E]');
            }
        }
    } catch(e) { console.error(e); }
};