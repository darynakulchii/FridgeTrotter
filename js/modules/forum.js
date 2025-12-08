import { API_URL, getHeaders } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
    initCreatePostModal();

    // Додаємо слухачі подій для фільтрів
    document.getElementById('forum-search')?.addEventListener('input', debounce(loadPosts, 500));
    document.getElementById('forum-category')?.addEventListener('change', loadPosts);
    document.getElementById('forum-sort')?.addEventListener('change', loadPosts);
});

// Зберігатимемо вибрані файли тут, щоб мати можливість їх видаляти перед відправкою
let selectedFiles = [];

// === ЛОГІКА СТВОРЕННЯ ПОСТА ===
function initCreatePostModal() {
    const createBtn = document.getElementById('create-post-btn');
    const modal = document.getElementById('create-post-modal');
    const closeBtn = document.getElementById('close-post-modal');
    const cancelBtn = document.getElementById('cancel-post-btn');
    const form = document.getElementById('create-post-form');
    const imageInput = document.getElementById('new-post-images');
    const previewContainer = document.getElementById('image-preview-container');

    if (!createBtn || !modal) return;

    // Відкриття
    createBtn.addEventListener('click', () => {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Будь ласка, увійдіть у свій акаунт, щоб створити пост.');
            window.location.href = 'login.html';
            return;
        }
        modal.classList.add('active');
    });

    // Закриття та очищення форми
    const closeModalFunc = () => {
        modal.classList.remove('active');
        form.reset();
        selectedFiles = [];
        previewContainer.innerHTML = ''; // Очистити прев'ю
    };

    if(closeBtn) closeBtn.addEventListener('click', closeModalFunc);
    if(cancelBtn) cancelBtn.addEventListener('click', closeModalFunc);
    window.addEventListener('click', (e) => { if (e.target === modal) closeModalFunc(); });

    // Обробка вибору файлів (Прев'ю)
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);

            // Перевірка на кількість
            if (selectedFiles.length + files.length > 5) {
                alert('Максимальна кількість фото: 5');
                return;
            }

            files.forEach(file => {
                // Перевірка типу (хоча accept в HTML теж є)
                if (!file.type.startsWith('image/')) return;

                selectedFiles.push(file);

                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.createElement('div');
                    preview.className = 'relative w-full h-20 rounded-md overflow-hidden group border border-gray-200';
                    preview.innerHTML = `
                        <img src="${e.target.result}" class="w-full h-full object-cover">
                        <button type="button" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs" data-name="${file.name}">
                            <i class="fas fa-times"></i>
                        </button>
                    `;

                    // Кнопка видалення прев'ю
                    preview.querySelector('button').addEventListener('click', function() {
                        const fileName = this.getAttribute('data-name');
                        selectedFiles = selectedFiles.filter(f => f.name !== fileName);
                        preview.remove();
                    });

                    previewContainer.appendChild(preview);
                };
                reader.readAsDataURL(file);
            });
            // Скидаємо значення інпуту, щоб можна було вибрати той самий файл повторно, якщо його видалили
            imageInput.value = '';
        });
    }


    // Відправка форми (FormData)
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Завантаження...';

            // Використовуємо FormData для multipart/form-data
            const formData = new FormData();
            formData.append('title', document.getElementById('new-post-title').value);
            formData.append('category', document.getElementById('new-post-category').value);
            formData.append('content', document.getElementById('new-post-content').value);

            // Додаємо всі вибрані файли
            selectedFiles.forEach(file => {
                formData.append('images', file); // Ключ 'images' має співпадати з multer на бекенді
            });

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/forum/posts`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                        // Content-Type не вказуємо, браузер сам встановить multipart/form-data з boundary
                    },
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Пост успішно створено!');
                    closeModalFunc();
                    loadPosts();
                } else {
                    alert(data.error || 'Помилка створення поста');
                }
            } catch (error) {
                console.error(error);
                alert('Помилка з\'єднання');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
            }
        });
    }
}

// === ЗАВАНТАЖЕННЯ ПОСТІВ ===
async function loadPosts() {
    const container = document.getElementById('forum-posts-container');
    // ... (код отримання параметрів пошуку без змін) ...
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

        if (posts.length === 0) {
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
                            <div class="relative h-full">
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

            const html = `
                <div class="forum-card flex flex-col h-full">
                    <div class="flex justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <div class="avatar-circle bg-[#281822]">
                                ${post.author_avatar ? `<img src="${post.author_avatar}" class="w-full h-full object-cover rounded-full">` : getInitials(post.first_name, post.last_name)}
                            </div>
                            <div class="flex flex-col">
                                <span class="font-bold text-[#281822] text-sm">${post.first_name} ${post.last_name}</span>
                                <span class="text-gray-400 text-xs">${new Date(post.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <span class="tag-pill">${post.category || 'Загальна'}</span>
                    </div>
                    <div class="flex-grow">
                        <h3 class="font-bold text-lg mb-2 text-[#281822] hover:text-[#48192E] cursor-pointer transition">${post.title}</h3>
                        <p class="text-gray-600 text-sm mb-4 leading-relaxed line-clamp-3">${post.content}</p>
                        <!-- Вставляємо блок із зображеннями -->
                        ${imagesHtml}
                    </div>
                    <div class="flex gap-6 border-t border-gray-100 pt-3 mt-auto">
                        <span class="action-icon cursor-pointer hover:text-[#48192E]" onclick="toggleLike(${post.post_id})"><i class="far fa-thumbs-up"></i> ${post.likes_count}</span>
                        <span class="action-icon"><i class="far fa-comment-alt"></i> ${post.comments_count || 0}</span>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

// ... (решта функцій getInitials, debounce, toggleLike без змін) ...
// Допоміжна функція для ініціалів
function getInitials(first, last) {
    return (first?.[0] || '') + (last?.[0] || '');
}

// Функція затримки пошуку
function debounce(func, timeout = 300){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// Функція лайку (проста реалізація)
window.toggleLike = async (postId) => {
    const token = localStorage.getItem('token');
    if(!token) return alert('Увійдіть, щоб ставити лайки');

    try {
        await fetch(`${API_URL}/forum/posts/${postId}/like`, {
            method: 'POST',
            headers: getHeaders()
        });
        loadPosts(); // Оновлюємо лічильник
    } catch(e) { console.error(e); }
};

// (Опціонально) Функція для відкриття зображення на весь екран
window.openImageModal = (url) => {
    // Можна реалізувати просту модалку для перегляду
    console.log('Open image:', url);
    // window.open(url, '_blank');
};