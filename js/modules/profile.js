import { API_URL, getHeaders } from '../api-config.js';

/**
 * profile.js
 * Повна реалізація логіки профілю з інтеграцією бекенду.
 * Виправлено: Створення поста перенаправляє на окрему сторінку.
 */

// Отримуємо поточного користувача з LocalStorage
const currentUser = JSON.parse(localStorage.getItem('user'));

// Змінна для збереження стану модалки (використовується лише для РЕДАГУВАННЯ)
let editingPostId = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Інжектуємо HTML для модалки (залишаємо для редагування постів)
    injectPostModal();

    initTabs();
    loadUserProfile();
    initFridge();
    initContentTabs();
    initSettingsForms();
});

/* =========================================
   0. HELPER: Модалка для постів (Тільки редагування)
   ========================================= */
function injectPostModal() {
    const modalHTML = `
        <div id="post-modal" class="modal-backdrop">
            <div class="modal-content max-w-lg">
                <div class="modal-header">
                    <h3 class="text-xl font-bold text-[#281822]" id="post-modal-title">Редагувати пост</h3>
                    <button class="modal-close-btn" onclick="closePostModal()">&times;</button>
                </div>
                <div class="modal-body space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1 text-[#281822]">Заголовок</label>
                        <input type="text" id="post-title" class="w-full border p-2 rounded-md focus:border-[#48192E] outline-none">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1 text-[#281822]">Категорія</label>
                        <select id="post-category" class="w-full border p-2 rounded-md bg-white focus:border-[#48192E] outline-none">
                            <option value="Поради">Поради</option>
                            <option value="Маршрути">Маршрути</option>
                            <option value="Спорядження">Спорядження</option>
                            <option value="Інше">Інше</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1 text-[#281822]">Текст</label>
                        <textarea id="post-content" rows="5" class="w-full border p-2 rounded-md focus:border-[#48192E] outline-none"></textarea>
                    </div>
                    <button id="save-post-btn" class="btn-burgundy-solid w-full">Зберегти зміни</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Прив'язка події
    const saveBtn = document.getElementById('save-post-btn');
    if (saveBtn) saveBtn.addEventListener('click', savePost);
}

// === ЗМІНЕНО: Відкриття сторінки створення поста ===
window.openCreatePostModal = () => {
    const token = localStorage.getItem('token');

    // Перевірка авторизації
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Перенаправлення на нову сторінку
    window.location.href = 'create_post.html';
};

// Редагування залишаємо в модальному вікні
window.openEditPostModal = (id, title, content, category) => {
    editingPostId = id;
    document.getElementById('post-modal-title').innerText = 'Редагувати пост';
    document.getElementById('post-title').value = title;
    document.getElementById('post-content').value = content;
    document.getElementById('post-category').value = category || 'Інше';
    document.getElementById('post-modal').classList.add('active');
};

window.closePostModal = () => {
    document.getElementById('post-modal').classList.remove('active');
};

/* =========================================
   1. ЛОГІКА ТАБІВ (TABS)
   ========================================= */
function initTabs() {
    const navPills = document.querySelectorAll('.nav-pill');
    const tabContents = document.querySelectorAll('.tab-content');

    navPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            navPills.forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const tabName = pill.getAttribute('data-tab');
            tabContents.forEach(content => content.classList.remove('active'));

            if (tabName) {
                const targetTab = document.getElementById(`tab-${tabName}`);
                if (targetTab) targetTab.classList.add('active');

                // Якщо відкрили таб контенту, оновлюємо дані
                if (tabName === 'my-posts') loadMyPosts();
                if (tabName === 'saved-tours') loadSavedTours();
                if (tabName === 'saved-posts') loadSavedPosts();
            }
        });
    });
}

/* =========================================
   2. ЗАВАНТАЖЕННЯ ДАНИХ ПРОФІЛЮ
   ========================================= */
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_URL}/user/profile`, { headers: getHeaders() });
        if (!response.ok) throw new Error('Failed to load profile');

        const data = await response.json();
        fillProfileData(data);
        fillSettingsData(data);
    } catch (error) {
        console.error(error);
    }
}

function fillProfileData(data) {
    const infoTab = document.getElementById('tab-info');
    if (infoTab) {
        const inputs = infoTab.querySelectorAll('input.form-input');
        const textarea = infoTab.querySelector('textarea.form-input');

        // Інфо
        if (inputs[0]) inputs[0].value = `${data.first_name || ''} ${data.last_name || ''}`.trim();
        if (inputs[1]) inputs[1].value = data.email || '';
        if (inputs[2]) inputs[2].value = data.location || '';
        if (inputs[3]) inputs[3].value = data.date_of_birth ? data.date_of_birth.split('T')[0] : '';
        // inputs[4] - сайт
        if (textarea) textarea.value = data.bio || '';
        if (inputs[5]) inputs[5].value = data.travel_interests || '';

        // Аватар
        const avatarCircle = infoTab.querySelector('.avatar-circle-lg');
        if (avatarCircle && data.profile_image_url) {
            avatarCircle.innerHTML = `<img src="${data.profile_image_url}" class="w-full h-full object-cover rounded-full">`;
            avatarCircle.classList.remove('bg-[#48192E]', 'text-[#D3CBC4]');
        } else if (avatarCircle) {
            avatarCircle.innerText = (data.first_name?.[0] || '') + (data.last_name?.[0] || '');
        }

        // Статистика
        const statNumbers = infoTab.querySelectorAll('.stat-number');
        if (statNumbers.length >= 4) {
            statNumbers[0].innerText = data.countries_visited || 0;
            statNumbers[1].innerText = data.cities_visited || 0;
            statNumbers[2].innerText = 0;
            statNumbers[3].innerText = data.followers_count || 0;
        }
    }

    // Холодильник
    const settingsTab = document.getElementById('tab-fridge-settings');
    if (settingsTab) {
        const colorOptions = settingsTab.querySelectorAll('.color-option');
        colorOptions.forEach(opt => {
            const preview = opt.querySelector('.color-preview');
            opt.classList.remove('selected');
            if (preview.style.backgroundColor && data.fridge_color && preview.style.backgroundColor.includes(hexToRgb(data.fridge_color))) {
                opt.classList.add('selected');
            } else if (data.fridge_color === '#f3f4f6' && !preview.style.backgroundColor) {
                // default
            }
        });

        if(!settingsTab.querySelector('.color-option.selected')) {
            colorOptions[0].classList.add('selected');
        }

        const switches = settingsTab.querySelectorAll('.toggle-switch');
        if (switches[0]) toggleSwitch(switches[0], data.fridge_is_public);
        if (switches[1]) toggleSwitch(switches[1], data.fridge_allow_comments);
    }

    const fridgeDoor = document.getElementById('fridge-door');
    if (fridgeDoor && data.fridge_color) {
        fridgeDoor.style.backgroundColor = data.fridge_color;
    }
}

function fillSettingsData(data) {
    const mainSettingsTab = document.getElementById('tab-settings');
    if (!mainSettingsTab) return;

    const cards = mainSettingsTab.querySelectorAll('.settings-card');
    if(cards.length >= 3) {
        const privacyCard = cards[2];
        const switches = privacyCard.querySelectorAll('.toggle-switch');

        if(switches[1]) toggleSwitch(switches[1], data.is_email_public);
        if(switches[2]) toggleSwitch(switches[2], data.is_location_public);
    }
}

function hexToRgb(hex) {
    return hex.replace('#', '');
}

function toggleSwitch(element, isActive) {
    if (isActive) element.classList.add('active');
    else element.classList.remove('active');
}

/* =========================================
   3. ЛОГІКА ХОЛОДИЛЬНИКА
   ========================================= */
async function initFridge() {
    const fridgeDoor = document.getElementById('fridge-door');
    const panel = document.querySelector('.magnet-panel-card');

    try {
        const response = await fetch(`${API_URL}/fridge/magnets/available`, { headers: getHeaders() });
        const data = await response.json();

        const title = panel.querySelector('h3');
        const hint = panel.querySelector('p.text-gray-500');
        panel.innerHTML = '';
        if (title) panel.appendChild(title);

        data.magnets.forEach(m => {
            const el = createMagnetElement(m, false);
            panel.appendChild(el);
        });
        if (hint) panel.appendChild(hint);

        initDragAndDrop(fridgeDoor);
    } catch (e) { console.error('Error loading available magnets:', e); }

    loadUserFridgeLayout();

    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            colorOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            const color = opt.querySelector('.color-preview').style.backgroundColor;
            fridgeDoor.style.backgroundColor = color;
        });
    });

    document.querySelectorAll('.toggle-switch').forEach(sw => {
        sw.addEventListener('click', () => {
            sw.classList.toggle('active');
        });
    });

    const saveSettingsBtn = document.querySelector('#tab-fridge-settings .btn-burgundy-solid');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveFridgeSettingsAndLayout);
    }
}

async function loadUserFridgeLayout() {
    const fridgeDoor = document.getElementById('fridge-door');
    try {
        const response = await fetch(`${API_URL}/fridge/${currentUser.userId}/layout`, { headers: getHeaders() });
        const data = await response.json();

        const magnets = fridgeDoor.querySelectorAll('.magnet-on-fridge');
        magnets.forEach(m => m.remove());

        data.magnets.forEach(m => {
            const el = createMagnetOnFridgeElement(m);
            el.style.left = `${m.x_position}px`;
            el.style.top = `${m.y_position}px`;
            fridgeDoor.appendChild(el);
        });

        checkPlaceholder();
    } catch (e) { console.error(e); }
}

function createMagnetElement(magnetData, isOnFridge) {
    const div = document.createElement('div');
    if (!isOnFridge) {
        div.className = `magnet-btn ${magnetData.color_group || 'burgundy'}`;
    } else {
        div.className = `magnet-on-fridge ${magnetData.color_group || 'burgundy'}`;
    }

    div.setAttribute('draggable', 'true');
    div.setAttribute('data-id', magnetData.magnet_id);
    div.setAttribute('data-country', magnetData.country);
    div.setAttribute('data-city', magnetData.city);
    div.setAttribute('data-icon', magnetData.icon_class);
    div.setAttribute('data-color', magnetData.color_group);

    div.innerHTML = `
        <i class="fas fa-${magnetData.icon_class} text-xl"></i>
        <div>
            <div class="font-bold text-sm pointer-events-none">${magnetData.city || magnetData.country}</div>
            ${!isOnFridge ? `<div class="text-xs opacity-80 pointer-events-none">${magnetData.country}</div>` : ''}
        </div>
    `;
    return div;
}

function createMagnetOnFridgeElement(magnetData) {
    const el = createMagnetElement(magnetData, true);
    el.innerHTML = `
        <i class="fas fa-${magnetData.icon_class}"></i>
        <div class="text-[10px] font-bold mt-1 leading-tight pointer-events-none">${magnetData.city}</div>
        <div class="text-[8px] opacity-90 pointer-events-none">${magnetData.country}</div>
    `;
    return el;
}

/* --- Drag & Drop --- */
let draggedItem = null;
let isNewItem = false;
let offset = { x: 0, y: 0 };

function initDragAndDrop(fridgeDoor) {
    document.querySelector('.magnet-panel-card').addEventListener('dragstart', (e) => {
        const target = e.target.closest('.magnet-btn');
        if (target) {
            isNewItem = true;
            draggedItem = target;
            e.dataTransfer.setData('text/plain', target.getAttribute('data-id'));
            e.dataTransfer.effectAllowed = 'copy';
        }
    });

    fridgeDoor.addEventListener('dragstart', (e) => {
        const target = e.target.closest('.magnet-on-fridge');
        if (target) {
            isNewItem = false;
            draggedItem = target;
            const rect = target.getBoundingClientRect();
            offset.x = e.clientX - rect.left;
            offset.y = e.clientY - rect.top;
            e.dataTransfer.effectAllowed = 'move';
            e.stopPropagation();
        }
    });

    fridgeDoor.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = isNewItem ? 'copy' : 'move';
    });

    fridgeDoor.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedItem) return;

        const rect = fridgeDoor.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (isNewItem) {
            const data = {
                magnet_id: draggedItem.getAttribute('data-id'),
                country: draggedItem.getAttribute('data-country'),
                city: draggedItem.getAttribute('data-city'),
                icon_class: draggedItem.getAttribute('data-icon'),
                color_group: draggedItem.getAttribute('data-color')
            };
            const newEl = createMagnetOnFridgeElement(data);
            newEl.style.left = `${x - 35}px`;
            newEl.style.top = `${y - 35}px`;
            fridgeDoor.appendChild(newEl);
        } else {
            draggedItem.style.left = `${x - offset.x}px`;
            draggedItem.style.top = `${y - offset.y}px`;
        }
        checkPlaceholder();
        draggedItem = null;
        isNewItem = false;
    });

    document.body.addEventListener('dragover', (e) => e.preventDefault());
    document.body.addEventListener('drop', (e) => {
        const isOverFridge = e.target.closest('#fridge-door');
        if (!isOverFridge && !isNewItem && draggedItem) {
            draggedItem.remove();
            checkPlaceholder();
            draggedItem = null;
        }
    });
}

function checkPlaceholder() {
    const fridgeDoor = document.getElementById('fridge-door');
    const placeholder = document.getElementById('fridge-placeholder');
    const hasMagnets = fridgeDoor.querySelectorAll('.magnet-on-fridge').length > 0;
    if (placeholder) {
        if (hasMagnets) placeholder.classList.add('hidden');
        else placeholder.classList.remove('hidden');
    }
}

async function saveFridgeSettingsAndLayout() {
    const fridgeDoor = document.getElementById('fridge-door');
    const settingsTab = document.getElementById('tab-fridge-settings');

    const magnetElements = fridgeDoor.querySelectorAll('.magnet-on-fridge');
    const magnetsData = Array.from(magnetElements).map(el => ({
        magnet_id: el.getAttribute('data-id'),
        x_position: parseInt(el.style.left) || 0,
        y_position: parseInt(el.style.top) || 0
    }));

    const selectedColorEl = settingsTab.querySelector('.color-option.selected .color-preview');
    const fridgeColor = selectedColorEl ? selectedColorEl.style.backgroundColor : '#f3f4f6';

    const switches = settingsTab.querySelectorAll('.toggle-switch');
    const isPublic = switches[0] ? switches[0].classList.contains('active') : true;
    const allowComments = switches[1] ? switches[1].classList.contains('active') : true;

    try {
        const saveLayoutPromise = fetch(`${API_URL}/fridge/save`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ magnetsData })
        });

        const infoData = getProfileFormData();
        const saveProfilePromise = fetch(`${API_URL}/user/profile`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({
                ...infoData,
                fridgeColor,
                fridgeIsPublic: isPublic,
                fridgeAllowComments: allowComments
            })
        });

        await Promise.all([saveLayoutPromise, saveProfilePromise]);
        alert('Холодильник та налаштування збережено!');
    } catch (e) {
        console.error(e);
        alert('Помилка збереження.');
    }
}

/* =========================================
   4. КОНТЕНТ (ПОСТИ, ТУРИ)
   ========================================= */
async function loadMyPosts() {
    const container = document.querySelector('#tab-my-posts');
    const header = container.querySelector('.flex.justify-between');

    // Прив'язка кнопки "Створити новий пост"
    const createBtn = header.querySelector('button');
    if(createBtn) {
        // === ВИПРАВЛЕНО: Правильний виклик функції перенаправлення ===
        createBtn.onclick = () => window.openCreatePostModal();
    }

    try {
        const response = await fetch(`${API_URL}/forum/posts/my`, { headers: getHeaders() });
        const data = await response.json();

        container.innerHTML = '';
        if (header) container.appendChild(header);

        if (data.posts.length === 0) {
            container.insertAdjacentHTML('beforeend', '<p class="text-gray-500 mt-4">У вас немає публікацій.</p>');
            return;
        }

        data.posts.forEach(post => {
            const html = createPostCardHTML(post, true);
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) { console.error(e); }
}

async function savePost() {
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    const category = document.getElementById('post-category').value;

    if(!title || !content) return alert('Заповніть всі поля');

    try {
        let url = `${API_URL}/forum/posts`;
        let method = 'POST';

        // Тут логіка тільки для редагування, бо створення тепер на окремій сторінці
        if (editingPostId) {
            url = `${API_URL}/forum/posts/${editingPostId}`;
            method = 'PUT';
        } else {
            // Теоретично цей блок тепер не має викликатись з модалки, але про всяк випадок
        }

        const res = await fetch(url, {
            method: method,
            headers: getHeaders(),
            body: JSON.stringify({ title, content, category })
        });

        if (res.ok) {
            closePostModal();
            loadMyPosts();
        } else {
            alert('Помилка збереження');
        }
    } catch (e) { console.error(e); }
}

window.deletePost = async (id) => {
    if(!confirm('Видалити пост?')) return;
    try {
        await fetch(`${API_URL}/forum/posts/${id}`, { method: 'DELETE', headers: getHeaders() });
        loadMyPosts();
    } catch(e) { console.error(e); }
};

async function loadSavedTours() {
    const container = document.querySelector('#tab-saved-tours .grid');
    const clearBtn = document.querySelector('#tab-saved-tours button');

    if(clearBtn) {
        clearBtn.onclick = async () => {
            if(!confirm('Очистити всі збережені тури?')) return;
            await fetch(`${API_URL}/tours/saved`, { method: 'DELETE', headers: getHeaders() });
            loadSavedTours();
        };
    }

    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/tours/saved`, { headers: getHeaders() });
        const data = await response.json();

        container.innerHTML = '';
        if (data.tours.length === 0) {
            container.innerHTML = '<p class="text-gray-500 col-span-2">Збережених турів немає.</p>';
            return;
        }

        data.tours.forEach(tour => {
            const html = `
                <div class="tour-card-saved shadow-md flex flex-col h-full overflow-hidden p-0 bg-white rounded-xl">
                    <div class="relative h-48">
                        <img src="${tour.image_url || 'https://via.placeholder.com/400'}" class="w-full h-full object-cover m-0">
                        <span class="absolute top-3 right-3 bg-[#48192E] text-white text-xs px-2 py-1 rounded font-medium">${tour.category_name || 'Тур'}</span>
                    </div>
                    <div class="p-5 flex flex-col flex-grow">
                        <h3 class="text-lg font-bold text-[#281822] mb-1">${tour.title}</h3>
                        <p class="text-sm text-gray-500 mb-4 line-clamp-2">${tour.description}</p>
                        <div class="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
                            <span class="text-xl font-bold text-[#48192E]">${tour.price_uah} ₴</span>
                            <button class="border border-[#48192E] text-[#48192E] px-4 py-1.5 rounded-md text-sm font-medium hover:bg-red-50" onclick="removeSavedTour(${tour.tour_id})">Видалити</button>
                        </div>
                    </div>
                </div>
             `;
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) { console.error(e); }
}

async function loadSavedPosts() {
    const container = document.querySelector('#tab-saved-posts');
    const header = container.querySelector('.flex.justify-between');
    const clearBtn = header.querySelector('button');

    if(clearBtn) {
        clearBtn.onclick = async () => {
            if(!confirm('Очистити всі збережені пости?')) return;
            await fetch(`${API_URL}/forum/saved`, { method: 'DELETE', headers: getHeaders() });
            loadSavedPosts();
        };
    }

    try {
        const response = await fetch(`${API_URL}/forum/posts/saved`, { headers: getHeaders() });
        const data = await response.json();

        container.innerHTML = '';
        if(header) container.appendChild(header);

        if (data.posts.length === 0) {
            container.insertAdjacentHTML('beforeend', '<p class="text-gray-500 mt-4">Збережених постів немає.</p>');
            return;
        }

        data.posts.forEach(post => {
            const html = createPostCardHTML(post, false);
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) { console.error(e); }
}

function initContentTabs() {
    window.removeSavedTour = async (id) => {
        if(!confirm('Видалити зі збережених?')) return;
        try {
            await fetch(`${API_URL}/tours/save`, {
                method: 'POST', headers: getHeaders(), body: JSON.stringify({ tourId: id })
            });
            loadSavedTours();
        } catch(e) { console.error(e); }
    };

    window.removeSavedPost = async (id) => {
        if(!confirm('Видалити зі збережених?')) return;
        try {
            await fetch(`${API_URL}/forum/saved/${id}`, { method: 'DELETE', headers: getHeaders() });
            loadSavedPosts();
        } catch(e) { console.error(e); }
    };
}

function createPostCardHTML(post, isMyPost) {
    const safeTitle = post.title.replace(/"/g, '&quot;');
    const safeContent = post.content.replace(/"/g, '&quot;');

    return `
        <div class="post-card shadow-sm bg-white p-6 rounded-xl mb-6">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-[#2D4952] flex items-center justify-center text-white font-bold">
                        ${post.author_avatar ? `<img src="${post.author_avatar}" class="w-full h-full rounded-full object-cover">` : 'A'}
                    </div>
                    <div>
                        <div class="font-bold text-[#281822] text-sm">${isMyPost ? 'Ви' : (post.first_name + ' ' + post.last_name)}</div>
                        <div class="text-sm text-[#281822] font-medium mt-0.5">${post.title}</div>
                    </div>
                </div>
                <span class="text-xs bg-gray-200 px-3 py-1 rounded-full text-gray-600 font-medium">${post.category || 'Загальне'}</span>
            </div>
            <p class="text-gray-600 text-sm mb-4 leading-relaxed pl-[52px] line-clamp-3">${post.content}</p>
            <div class="flex justify-between items-center border-t border-gray-100 pt-3 pl-[52px]">
                <div class="flex gap-4 text-gray-500 text-sm">
                    <span class="flex items-center gap-1"><i class="far fa-thumbs-up"></i> ${post.likes_count}</span>
                    <span class="flex items-center gap-1"><i class="far fa-comment-alt"></i> ${post.comments_count || 0}</span>
                </div>
                ${isMyPost ? `
                <div class="flex gap-4 text-sm">
                    <button class="text-[#2D4952] hover:text-[#48192E] flex items-center gap-1" onclick="openEditPostModal(${post.post_id}, '${safeTitle}', '${safeContent}', '${post.category}')"><i class="far fa-edit"></i> Редагувати</button>
                    <button class="text-[#48192E] hover:text-red-600 flex items-center gap-1" onclick="deletePost(${post.post_id})"><i class="far fa-trash-alt"></i> Видалити</button>
                </div>` : `
                <div class="flex gap-3 text-sm items-center">
                    <button class="border border-[#48192E] text-[#48192E] px-4 py-1 rounded-md text-sm font-medium hover:bg-red-50" onclick="removeSavedPost(${post.post_id})">Видалити</button>
                </div>
                `}
            </div>
        </div>
    `;
}

/* =========================================
   5. ФОРМИ ТА НАЛАШТУВАННЯ
   ========================================= */
function initSettingsForms() {
    // 1. Форма "Моя інформація"
    const infoTab = document.getElementById('tab-info');
    if (infoTab) {
        const saveBtn = infoTab.querySelector('.btn-burgundy-solid');
        const uploadBtn = infoTab.querySelector('.btn-burgundy-outline');
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
        infoTab.appendChild(fileInput);

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const data = getProfileFormData();
                const settingsTab = document.getElementById('tab-fridge-settings');
                const selectedColorEl = settingsTab?.querySelector('.color-option.selected .color-preview');
                const switches = settingsTab?.querySelectorAll('.toggle-switch');

                const privacySwitches = document.getElementById('tab-settings')?.querySelectorAll('.toggle-switch');

                const body = {
                    ...data,
                    fridgeColor: selectedColorEl?.style.backgroundColor || '#f3f4f6',
                    fridgeIsPublic: switches?.[0]?.classList.contains('active') ?? true,
                    fridgeAllowComments: switches?.[1]?.classList.contains('active') ?? true,
                    isEmailPublic: privacySwitches?.[1]?.classList.contains('active') ?? false,
                    isLocationPublic: privacySwitches?.[2]?.classList.contains('active') ?? true
                };

                try {
                    const res = await fetch(`${API_URL}/user/profile`, {
                        method: 'PUT', headers: getHeaders(), body: JSON.stringify(body)
                    });
                    if(res.ok) alert('Профіль оновлено!');
                    else alert('Помилка оновлення');
                } catch(e) { console.error(e); }
            });
        }

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', async () => {
                if (fileInput.files.length > 0) {
                    const formData = new FormData();
                    formData.append('avatar', fileInput.files[0]);
                    try {
                        const res = await fetch(`${API_URL}/user/avatar`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                            body: formData
                        });
                        const data = await res.json();
                        if (res.ok) {
                            const avatarCircle = infoTab.querySelector('.avatar-circle-lg');
                            if (avatarCircle) avatarCircle.innerHTML = `<img src="${data.url}" class="w-full h-full object-cover rounded-full">`;
                        }
                    } catch (e) { console.error(e); }
                }
            });
        }
    }

    // 2. Вкладка "Налаштування"
    const settingsTab = document.getElementById('tab-settings');
    if (settingsTab) {
        const saveBtns = settingsTab.querySelectorAll('.btn-burgundy-solid');

        if (saveBtns[0]) {
            saveBtns[0].addEventListener('click', async () => {
                const inputs = settingsTab.querySelectorAll('input[type="password"]');
                const currentPassword = inputs[0].value;
                const newPassword = inputs[1].value;
                const confirmPassword = inputs[2].value;

                if (newPassword !== confirmPassword) {
                    alert('Нові паролі не співпадають');
                    return;
                }
                try {
                    const res = await fetch(`${API_URL}/user/password`, {
                        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ currentPassword, newPassword })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(data.message);
                        inputs.forEach(i => i.value = '');
                    } else {
                        alert(data.error);
                    }
                } catch (e) { console.error(e); }
            });
        }

        if (saveBtns[1]) {
            saveBtns[1].addEventListener('click', async () => {
                const infoTabSaveBtn = document.querySelector('#tab-info .btn-burgundy-solid');
                if(infoTabSaveBtn) infoTabSaveBtn.click();
            });
        }

        const deleteBtn = settingsTab.querySelector('.bg-red-50 button');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if(confirm('Ви впевнені? Цю дію не можна відмінити!')) {
                    try {
                        const res = await fetch(`${API_URL}/user/account`, { method: 'DELETE', headers: getHeaders() });
                        if (res.ok) {
                            localStorage.clear();
                            window.location.href = 'register.html';
                        }
                    } catch(e) { console.error(e); }
                }
            });
        }
    }
}

function getProfileFormData() {
    const infoTab = document.getElementById('tab-info');
    const inputs = infoTab.querySelectorAll('input.form-input');
    const textarea = infoTab.querySelector('textarea.form-input');

    const fullName = inputs[0].value.split(' ');

    return {
        firstName: fullName[0] || '',
        lastName: fullName.slice(1).join(' ') || '',
        email: inputs[1].value,
        location: inputs[2].value,
        dateOfBirth: inputs[3].value,
        bio: textarea.value,
        travelInterests: inputs[5].value
    };
}