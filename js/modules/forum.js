import { API_URL } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {
    loadPosts();

    // Додаємо слухачі подій для фільтрів
    document.getElementById('forum-search')?.addEventListener('input', debounce(loadPosts, 500));
    document.getElementById('forum-category')?.addEventListener('change', loadPosts);
    document.getElementById('forum-sort')?.addEventListener('change', loadPosts);
});

async function loadPosts() {
    const container = document.getElementById('forum-posts-container');
    const search = document.getElementById('forum-search')?.value || '';
    const category = document.getElementById('forum-category')?.value || '';
    const sort = document.getElementById('forum-sort')?.value || '';

    // Формуємо URL з параметрами
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

        if (posts.length === 0) {
            container.innerHTML = '<p class="text-gray-500">Постів не знайдено.</p>';
            return;
        }

        posts.forEach(post => {
            const html = `
                <div class="forum-card flex flex-col h-full">
                    <div class="flex justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <div class="avatar-circle bg-[#281822]">${getInitials(post.first_name, post.last_name)}</div>
                            <div class="flex flex-col">
                                <span class="font-bold text-[#281822] text-sm">${post.first_name} ${post.last_name}</span>
                                <span class="text-gray-400 text-xs">${new Date(post.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <span class="tag-pill">${post.category}</span>
                    </div>
                    <div class="flex-grow">
                        <h3 class="font-bold text-lg mb-2 text-[#281822] hover:text-[#48192E] cursor-pointer transition">${post.title}</h3>
                        <p class="text-gray-600 text-sm mb-4 leading-relaxed line-clamp-3">${post.content}</p>
                    </div>
                    <div class="flex gap-6 border-t border-gray-100 pt-3 mt-auto">
                        <span class="action-icon"><i class="far fa-thumbs-up"></i> ${post.likes_count}</span>
                        <span class="action-icon"><i class="far fa-comment-alt"></i> ${post.comments_count}</span>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

// Допоміжна функція для ініціалів
function getInitials(first, last) {
    return (first?.[0] || '') + (last?.[0] || '');
}

// Функція затримки пошуку (щоб не робити запит на кожну букву)
function debounce(func, timeout = 300){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}