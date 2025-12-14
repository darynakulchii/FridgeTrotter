import { API_URL, getHeaders } from '../api-config.js';
import { initPostForm } from './create_post.js'; // Імпортуємо логіку форми з фото

document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
    initCreatePostModal();

    // Додаємо слухачі подій для фільтрів
    document.getElementById('forum-search')?.addEventListener('input', debounce(loadPosts, 500));
    document.getElementById('forum-category')?.addEventListener('change', loadPosts);
    document.getElementById('forum-sort')?.addEventListener('change', loadPosts);
});

// Глобальна функція для написання (якщо не додали її в index.js, можна продублювати або використати спільний модуль)
window.contactAuthor = (userId) => {
    const token = localStorage.getItem('token');
    if (!token) {
        if(confirm('Увійдіть, щоб написати автору.')) window.location.href = 'login.html';
        return;
    }
    window.location.href = `chat.html?user_id=${userId}`;
};

// === ЛОГІКА СТВОРЕННЯ ПОСТА (Оновлена для Модалки) ===
function initCreatePostModal() {
    const createBtn = document.getElementById('create-post-btn');
    const modal = document.getElementById('create-post-modal');

    if (createBtn && modal) {
        createBtn.addEventListener('click', () => {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Будь ласка, увійдіть у свій акаунт, щоб створити пост.');
                window.location.href = 'login.html';
                return;
            }

            // 1. Відкриваємо модалку
            modal.classList.add('active');

            // 2. Ініціалізуємо логіку форми (з create_post.js)
            // Передаємо функцію, що робити після успіху
            initPostForm(() => {
                alert('Пост успішно опубліковано!');
                modal.classList.remove('active'); // Закриваємо модалку
                loadPosts(); // Оновлюємо стрічку постів
            });
        });
    }

    // Логіка закриття модалки (хрестик)
    const closeBtn = document.getElementById('close-post-modal');
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    // Логіка закриття модалки (кнопка Скасувати всередині форми)
    const cancelBtn = document.getElementById('cancel-post-btn');
    if (cancelBtn && modal) {
        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
}

// === ЗАВАНТАЖЕННЯ ПОСТІВ ===
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
            // Генеруємо HTML для блоку зображень, якщо вони є
            let imagesHtml = '';
            if (post.images && post.images.length > 0) {
                // Якщо зображень багато, показуємо перші 3-4 у вигляді сітки
                const displayCount = Math.min(post.images.length, 4);
                const gridCols = displayCount === 1 ? 'grid-cols-1' : (displayCount === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4');

                imagesHtml = `<div class="grid ${gridCols} gap-2 mb-4 h-48 md:h-64 rounded-lg overflow-hidden">`;
                post.images.slice(0, displayCount).forEach((imgUrl, index) => {
                    // Для останнього зображення, якщо їх більше, показуємо лічильник
                    if (index === displayCount - 1 && post.images.length > displayCount) {
                        imagesHtml += `
                            <div class="relative h-full cursor-pointer" onclick="openImageModal('${imgUrl}')">
                                <img src="${imgUrl}" class="w-full h-full object-cover opacity-50">
                                <div class="absolute inset-0 flex items-center justify-center text-white font-bold text-xl">
                                    +${post.images.length - displayCount + 1}
                                </div>
                            </div>`;
                    } else {
                        imagesHtml += `<img src="${imgUrl}" class="w-full h-full object-cover hover:scale-105 transition duration-300 cursor-pointer" onclick="openImageModal('${imgUrl}')">`;
                    }
                });
                imagesHtml += `</div>`;
            }

            // Основна HTML картка поста
            const html = `
                <div class="forum-card flex flex-col h-full">
                    <div class="flex justify-between mb-3">
                        <a href="other_user_profile.html?user_id=${post.author_id}" class="flex items-center gap-3 group text-decoration-none">
                            <div class="avatar-circle bg-[#281822] group-hover:opacity-80 transition flex-shrink-0 overflow-hidden">
                                ${post.author_avatar
                ? `<img src="${post.author_avatar}" class="w-full h-full object-cover">`
                : getInitials(post.first_name, post.last_name)}
                            </div>
                            <div class="flex flex-col">
                                <span class="font-bold text-[#281822] text-sm group-hover:text-[#48192E] group-hover:underline transition">
                                    ${post.first_name} ${post.last_name}
                                </span>
                                <span class="text-gray-400 text-xs">${new Date(post.created_at).toLocaleDateString()}</span>
                            </div>
                        </a>
                        <span class="tag-pill h-fit whitespace-nowrap">${post.category || 'Загальна'}</span>
                    </div>
                    
                    <div class="flex-grow">
                        <h3 class="font-bold text-lg mb-2 text-[#281822] hover:text-[#48192E] cursor-pointer transition">${post.title}</h3>
                        <p class="text-gray-600 text-sm mb-4 leading-relaxed line-clamp-3">${post.content}</p>
                        ${imagesHtml}
                    </div>
                    
                    <div class="flex gap-6 border-t border-gray-100 pt-3 mt-auto items-center">
                        <span class="action-icon cursor-pointer hover:text-[#48192E]" onclick="toggleLike(${post.post_id})"><i class="far fa-thumbs-up"></i> ${post.likes_count}</span>
                        <span class="action-icon"><i class="far fa-comment-alt"></i> ${post.comments_count || 0}</span>
                        
                        <button onclick="contactAuthor(${post.author_id})" class="ml-auto text-xs text-[#2D4952] font-bold hover:underline flex items-center gap-1">
                            <i class="far fa-envelope"></i> Написати
                        </button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (error) {
        console.error('Error loading posts:', error);
        container.innerHTML = '<p class="text-red-500 col-span-2 text-center">Помилка завантаження даних.</p>';
    }
}

// Допоміжна функція для ініціалів
function getInitials(first, last) {
    return (first?.[0] || '') + (last?.[0] || '');
}

// Функція затримки пошуку (debounce)
function debounce(func, timeout = 300){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// Функція лайку
window.toggleLike = async (postId) => {
    const token = localStorage.getItem('token');
    if(!token) return alert('Увійдіть, щоб ставити лайки');

    try {
        await fetch(`${API_URL}/forum/posts/${postId}/like`, {
            method: 'POST',
            headers: getHeaders()
        });
        // Перезавантажуємо пости, щоб оновити лічильник
        loadPosts();
    } catch(e) { console.error(e); }
};

// Функція для відкриття зображення
window.openImageModal = (url) => {
    window.open(url, '_blank');
};