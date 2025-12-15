/* js/modules/forum.js */
import { API_URL, getHeaders } from '../api-config.js';
import { initPostForm } from './create_post.js';

let currentPostId = null; // Для коментарів

document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
    initCreatePostModal();

    // Слухачі фільтрів
    document.getElementById('forum-search')?.addEventListener('input', debounce(loadPosts, 500));
    document.getElementById('forum-category')?.addEventListener('change', loadPosts);
    document.getElementById('forum-sort')?.addEventListener('change', loadPosts);

    // Слухач форми коментарів
    document.getElementById('add-comment-form')?.addEventListener('submit', handleCommentSubmit);
});

// === Ініціалізація модалки створення ===
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
            initPostForm(() => {
                alert('Пост успішно опубліковано!');
                modal.classList.remove('active');
                loadPosts();
            });
        });
    }

    // Закриття модалки (всередині форми)
    document.getElementById('cancel-post-btn')?.addEventListener('click', () => {
        modal.classList.remove('active');
    });
}

// === ЗАВАНТАЖЕННЯ СПИСКУ ПОСТІВ ===
async function loadPosts() {
    const container = document.getElementById('forum-posts-container');
    const search = document.getElementById('forum-search')?.value || '';
    const category = document.getElementById('forum-category')?.value || '';
    const sort = document.getElementById('forum-sort')?.value || '';

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
            // Визначаємо головне фото (перше в масиві)
            let mainImageHtml = '';
            if (post.images && post.images.length > 0) {
                // Використовуємо перше фото як обкладинку
                mainImageHtml = `
                    <div class="h-48 mb-4 rounded-lg overflow-hidden relative cursor-pointer" onclick="openPostDetails(${post.post_id})">
                        <img src="${post.images[0]}" class="w-full h-full object-cover hover:scale-105 transition duration-500">
                        ${post.images.length > 1 ? `<span class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-bold">+${post.images.length - 1}</span>` : ''}
                    </div>
                `;
            }

            const html = `
                <div class="forum-card flex flex-col h-full">
                    <div class="flex justify-between mb-3">
                        <a href="other_user_profile.html?user_id=${post.author_id}" class="flex items-center gap-3 group text-decoration-none" onclick="event.stopPropagation()">
                            <div class="avatar-circle bg-[#281822] overflow-hidden">
                                ${post.author_avatar
                ? `<img src="${post.author_avatar}" class="w-full h-full object-cover">`
                : (post.first_name[0] + post.last_name[0])}
                            </div>
                            <div class="flex flex-col">
                                <span class="font-bold text-[#281822] text-sm group-hover:underline">
                                    ${post.first_name} ${post.last_name}
                                </span>
                                <span class="text-gray-400 text-xs">${new Date(post.created_at).toLocaleDateString()}</span>
                            </div>
                        </a>
                        <span class="tag-pill h-fit">${post.category}</span>
                    </div>
                    
                    ${mainImageHtml} <div class="flex-grow cursor-pointer" onclick="openPostDetails(${post.post_id})">
                        <h3 class="font-bold text-lg mb-2 text-[#281822] hover:text-[#48192E] transition">${post.title}</h3>
                        <p class="text-gray-600 text-sm mb-4 leading-relaxed line-clamp-3">${post.content}</p>
                    </div>
                    
                    <div class="flex gap-6 border-t border-gray-100 pt-3 mt-auto items-center">
                        <span class="action-icon hover:text-[#48192E]" onclick="toggleLike(${post.post_id}, event)">
                            <i class="far fa-thumbs-up"></i> ${post.likes_count}
                        </span>
                        <span class="action-icon hover:text-[#2D4952]" onclick="openPostDetails(${post.post_id})">
                            <i class="far fa-comment-alt"></i> ${post.comments_count || 0}
                        </span>
                        <button onclick="contactAuthor(${post.author_id}, event)" class="ml-auto text-xs text-[#2D4952] font-bold hover:underline flex items-center gap-1">
                            <i class="far fa-envelope"></i> Написати
                        </button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

// === ДЕТАЛЬНИЙ ПЕРЕГЛЯД ПОСТА (МОДАЛКА) ===
window.openPostDetails = async (postId) => {
    currentPostId = postId;
    const modal = document.getElementById('post-details-modal');
    modal.classList.add('active');

    // Елементи UI
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

    // Очищення перед завантаженням
    els.title.innerText = 'Завантаження...';
    els.mainImg.classList.add('hidden');
    els.gallery.innerHTML = '';
    document.getElementById('detail-comments-list').innerHTML = '<p class="text-gray-400 text-sm">Завантаження коментарів...</p>';

    try {
        // 1. Отримуємо дані поста
        const res = await fetch(`${API_URL}/forum/posts/${postId}`);
        const data = await res.json();
        const post = data.post;

        // Заповнюємо текстом
        els.title.innerText = post.title;
        els.content.innerText = post.content;
        els.author.innerText = `${post.first_name} ${post.last_name}`;
        els.date.innerText = new Date(post.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' });
        els.category.innerText = post.category;

        if(post.author_avatar) {
            els.avatar.innerHTML = `<img src="${post.author_avatar}" class="w-full h-full object-cover">`;
        } else {
            els.avatar.innerText = (post.first_name[0] + post.last_name[0]);
        }

        // 2. Логіка Галереї (Аналогічно турам)
        if (post.images && post.images.length > 0) {
            // Головне фото
            els.mainImg.src = post.images[0];
            els.mainImg.classList.remove('hidden');

            // Мініатюри
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

        // 3. Завантажуємо коментарі
        loadComments(postId);

    } catch (e) {
        console.error(e);
        alert('Не вдалося завантажити пост');
        modal.classList.remove('active');
    }
};

// === ЗАВАНТАЖЕННЯ КОМЕНТАРІВ ===
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
            const avatarHtml = c.author_avatar
                ? `<img src="${c.author_avatar}" class="w-8 h-8 rounded-full object-cover">`
                : `<div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">${c.first_name[0]}</div>`;

            const html = `
                <div class="flex gap-3 items-start">
                    ${avatarHtml}
                    <div class="bg-white p-3 rounded-lg border border-gray-100 flex-grow shadow-sm">
                        <div class="flex justify-between items-baseline mb-1">
                            <span class="font-bold text-sm text-[#281822]">${c.first_name} ${c.last_name}</span>
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

// === ДОДАВАННЯ КОМЕНТАРЯ ===
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
            loadComments(currentPostId); // Оновлюємо список
            loadPosts(); // Оновлюємо лічильник у списку карток
        } else {
            alert('Помилка при відправці.');
        }
    } catch (e) { console.error(e); }
}

// === ДОПОМІЖНІ ФУНКЦІЇ ===
function debounce(func, timeout = 300){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

window.toggleLike = async (postId, event) => {
    if(event) event.stopPropagation();
    const token = localStorage.getItem('token');
    if(!token) return alert('Увійдіть, щоб ставити лайки');

    try {
        await fetch(`${API_URL}/forum/posts/${postId}/like`, { method: 'POST', headers: getHeaders() });
        loadPosts();
    } catch(e) { console.error(e); }
};

window.contactAuthor = (userId, event) => {
    if(event) event.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) {
        if(confirm('Увійдіть, щоб написати автору.')) window.location.href = 'login.html';
        return;
    }
    window.location.href = `chat.html?user_id=${userId}`;
};