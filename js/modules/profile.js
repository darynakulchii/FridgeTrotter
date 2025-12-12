import { API_URL, getHeaders } from '../api-config.js';

const currentUser = JSON.parse(localStorage.getItem('user'));
let editingPostId = null;

// === HELPER: Debounce для автозбереження ===
function debounce(func, timeout = 1000) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// Автозбереження розташування магнітів (чекає 1 сек після останньої зміни)
const autoSaveFridge = debounce(() => {
    saveFridgeOnlyLayout();
    console.log('Autosaving fridge layout...');
});

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    injectPostModal();
    initTabs();
    loadUserProfile();
    initFridge(); // Тут виправлена логіка ініціалізації
    initContentTabs();
    initSettingsForms();
});

/* =========================================
   0. HELPER: Модалка для постів
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

    const saveBtn = document.getElementById('save-post-btn');
    if (saveBtn) saveBtn.addEventListener('click', savePost);
}

window.openCreatePostModal = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    window.location.href = 'create_post.html';
};

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
            // Перемикання класів кнопок
            navPills.forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');

            // Перемикання контенту
            const tabName = pill.getAttribute('data-tab');
            tabContents.forEach(content => content.classList.remove('active'));

            if (tabName) {
                const targetTab = document.getElementById(`tab-${tabName}`);
                if (targetTab) targetTab.classList.add('active');

                // Лези-лоадінг даних
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
    } catch (error) {
        console.error(error);
    }
}

function fillProfileData(data) {
    // 1. Вкладка "Моя інформація"
    const infoTab = document.getElementById('tab-info');
    if (infoTab) {
        const inputs = infoTab.querySelectorAll('input.form-input');
        const textarea = infoTab.querySelector('textarea.form-input');

        if (inputs[0]) inputs[0].value = `${data.first_name || ''} ${data.last_name || ''}`.trim();
        if (inputs[1]) inputs[1].value = data.email || '';
        if (inputs[2]) inputs[2].value = data.location || '';
        if (inputs[3]) inputs[3].value = data.date_of_birth ? data.date_of_birth.split('T')[0] : '';
        if (inputs[4]) inputs[4].value = data.website || ''; // Веб-сайт
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
            statNumbers[2].innerText = 0; // Активні тури (можна додати в майбутньому)
            statNumbers[3].innerText = data.followers_count || 0;
        }
    }

    // 2. Налаштування холодильника (кольори, перемикачі)
    const settingsTab = document.getElementById('tab-fridge-settings');
    if (settingsTab) {
        const colorOptions = settingsTab.querySelectorAll('.color-option');
        colorOptions.forEach(opt => {
            const preview = opt.querySelector('.color-preview');
            opt.classList.remove('selected');
            // Порівнюємо кольори
            if (preview.style.backgroundColor && data.fridge_color && preview.style.backgroundColor.includes(hexToRgb(data.fridge_color))) {
                opt.classList.add('selected');
            } else if (data.fridge_color === '#f3f4f6' && !preview.style.backgroundColor) {
                // fallback для дефолтного
            }
        });

        if (!settingsTab.querySelector('.color-option.selected') && colorOptions.length > 0) {
            colorOptions[0].classList.add('selected');
        }

        const switches = settingsTab.querySelectorAll('.toggle-switch');
        if (switches[0]) toggleSwitch(switches[0], data.fridge_is_public);
        if (switches[1]) toggleSwitch(switches[1], data.fridge_allow_comments);
    }

    // Застосовуємо колір до самих дверцят
    const fridgeDoor = document.getElementById('fridge-door');
    if (fridgeDoor && data.fridge_color) {
        fridgeDoor.style.backgroundColor = data.fridge_color;
    }

    // 3. Загальні налаштування (Settings Tab)
    const mainSettingsTab = document.getElementById('tab-settings');
    if (mainSettingsTab) {
        const allSwitches = mainSettingsTab.querySelectorAll('.toggle-switch');
        // Очікуваний порядок: Email, Push, Followers, Comments, Messages, PublicProfile, ShowEmail, ShowLoc, AllowMsg
        if(allSwitches.length >= 8) {
            toggleSwitch(allSwitches[0], data.notify_email);
            toggleSwitch(allSwitches[1], data.notify_push);
            toggleSwitch(allSwitches[2], data.notify_new_followers);
            toggleSwitch(allSwitches[3], data.notify_comments);
            toggleSwitch(allSwitches[4], data.notify_messages);

            // Privacy section
            toggleSwitch(allSwitches[5], true); // Public Profile (заглушка)
            toggleSwitch(allSwitches[6], data.is_email_public);
            toggleSwitch(allSwitches[7], data.is_location_public);
        }
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
   3. ЛОГІКА ХОЛОДИЛЬНИКА (INIT & DRAG-DROP)
   ========================================= */
async function initFridge() {
    const fridgeDoor = document.getElementById('fridge-door');
    const panel = document.querySelector('.magnet-panel-card');

    // === ВИПРАВЛЕННЯ: Ініціалізація D&D завжди, навіть якщо fetch впаде ===
    if (fridgeDoor) {
        initDragAndDrop(fridgeDoor);
    }

    // Завантаження доступних магнітів
    try {
        const response = await fetch(`${API_URL}/fridge/magnets/available`, { headers: getHeaders() });
        const data = await response.json();

        const title = panel.querySelector('h3');
        const hint = panel.querySelector('p.text-gray-500');

        // Очищаємо, зберігаючи заголовок
        panel.innerHTML = '';
        if (title) panel.appendChild(title);

        data.magnets.forEach(m => {
            const el = createMagnetElement(m, false);
            panel.appendChild(el);
        });
        if (hint) panel.appendChild(hint);

    } catch (e) {
        console.error('Error loading available magnets:', e);
    }

    // Завантаження розкладки користувача
    loadUserFridgeLayout();

    // Логіка вибору кольору (локальна зміна UI)
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            colorOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            const color = opt.querySelector('.color-preview').style.backgroundColor;
            if(fridgeDoor) fridgeDoor.style.backgroundColor = color;
        });
    });

    // Кліки по перемикачах (UI)
    document.querySelectorAll('.toggle-switch').forEach(sw => {
        sw.addEventListener('click', () => {
            sw.classList.toggle('active');
        });
    });
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

// === Створення DOM елементів магнітів ===
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
        <i class="fas fa-${magnetData.icon_class} ${isOnFridge ? '' : 'text-xl'}"></i>
        <div>
            <div class="${isOnFridge ? 'text-[10px] font-bold mt-1 leading-tight' : 'font-bold text-sm'} pointer-events-none">${magnetData.city || magnetData.country}</div>
            ${!isOnFridge ? `<div class="text-xs opacity-80 pointer-events-none">${magnetData.country}</div>` : `<div class="text-[8px] opacity-90 pointer-events-none">${magnetData.country}</div>`}
        </div>
    `;
    return div;
}

function createMagnetOnFridgeElement(magnetData) {
    return createMagnetElement(magnetData, true);
}

// === DRAG & DROP + AUTOSAVE ===
function initDragAndDrop(fridgeDoor) {
    let draggedItem = null;
    let isNewItem = false;
    let offset = { x: 0, y: 0 };

    // Початок перетягування з панелі (новий магніт)
    const panel = document.querySelector('.magnet-panel-card');
    if (panel) {
        panel.addEventListener('dragstart', (e) => {
            const target = e.target.closest('.magnet-btn');
            if (target) {
                isNewItem = true;
                draggedItem = target;
                e.dataTransfer.setData('text/plain', target.getAttribute('data-id'));
                e.dataTransfer.effectAllowed = 'copy';
            }
        });
    }

    // Початок перетягування на холодильнику (існуючий магніт)
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
            // Створюємо новий елемент
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
            // Переміщуємо існуючий
            draggedItem.style.left = `${x - offset.x}px`;
            draggedItem.style.top = `${y - offset.y}px`;
        }

        checkPlaceholder();
        draggedItem = null;
        isNewItem = false;

        // Викликаємо автозбереження
        autoSaveFridge();
    });

    // Видалення магніту при витягуванні за межі
    document.body.addEventListener('dragover', (e) => e.preventDefault());
    document.body.addEventListener('drop', (e) => {
        const isOverFridge = e.target.closest('#fridge-door');
        if (!isOverFridge && !isNewItem && draggedItem) {
            draggedItem.remove();
            checkPlaceholder();
            draggedItem = null;
            autoSaveFridge(); // Зберігаємо після видалення
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

// Зберігає ТІЛЬКИ розташування магнітів (для автозбереження)
async function saveFridgeOnlyLayout() {
    const fridgeDoor = document.getElementById('fridge-door');
    const magnetElements = fridgeDoor.querySelectorAll('.magnet-on-fridge');

    const magnetsData = Array.from(magnetElements).map(el => ({
        magnet_id: el.getAttribute('data-id'),
        x_position: parseInt(el.style.left) || 0,
        y_position: parseInt(el.style.top) || 0
    }));

    try {
        await fetch(`${API_URL}/fridge/save`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ magnetsData })
        });
    } catch (e) { console.error('Auto-save failed', e); }
}

/* =========================================
   4. ЗБЕРЕЖЕННЯ ПРОФІЛЮ ТА НАЛАШТУВАНЬ
   ========================================= */

// Збирає всі дані з усіх вкладок для повного збереження
function collectAllProfileData() {
    // Info Data
    const infoTab = document.getElementById('tab-info');
    const inputs = infoTab.querySelectorAll('input.form-input');
    const textarea = infoTab.querySelector('textarea.form-input');
    const fullName = inputs[0].value.split(' ');

    const basicInfo = {
        firstName: fullName[0] || '',
        lastName: fullName.slice(1).join(' ') || '',
        email: inputs[1].value,
        location: inputs[2].value,
        dateOfBirth: inputs[3].value,
        website: inputs[4].value,
        bio: textarea.value,
        travelInterests: inputs[5].value
    };

    // Fridge Settings
    const fSettingsTab = document.getElementById('tab-fridge-settings');
    const selectedOption = fSettingsTab?.querySelector('.color-option.selected');
    const fSwitches = fSettingsTab?.querySelectorAll('.toggle-switch');

    // General Settings (Notifications & Privacy)
    const gSettingsTab = document.getElementById('tab-settings');
    const gSwitches = gSettingsTab?.querySelectorAll('.toggle-switch');

    return {
        ...basicInfo,
        fridgeColor: selectedOption?.dataset.color || '#f3f4f6',
        fridgeIsPublic: fSwitches?.[0]?.classList.contains('active') ?? true,
        fridgeAllowComments: fSwitches?.[1]?.classList.contains('active') ?? true,

        // Notifications
        notifyEmail: gSwitches?.[0]?.classList.contains('active') ?? true,
        notifyPush: gSwitches?.[1]?.classList.contains('active') ?? true,
        notifyFollowers: gSwitches?.[2]?.classList.contains('active') ?? true,
        notifyComments: gSwitches?.[3]?.classList.contains('active') ?? true,
        notifyMessages: gSwitches?.[4]?.classList.contains('active') ?? true,

        // Privacy
        isEmailPublic: gSwitches?.[6]?.classList.contains('active') ?? false,
        isLocationPublic: gSwitches?.[7]?.classList.contains('active') ?? true
    };
}

async function saveFullProfile() {
    const body = collectAllProfileData();
    try {
        const res = await fetch(`${API_URL}/user/profile`, {
            method: 'PUT', headers: getHeaders(), body: JSON.stringify(body)
        });
        if(res.ok) alert('Зміни успішно збережено!');
        else alert('Помилка збереження');
    } catch(e) { console.error(e); }
}

function initSettingsForms() {
    // 1. Форма "Моя інформація"
    const infoTab = document.getElementById('tab-info');
    if (infoTab) {
        const saveBtn = infoTab.querySelector('.btn-burgundy-solid');
        if (saveBtn) saveBtn.onclick = saveFullProfile;

        // Завантаження аватара
        const uploadBtn = infoTab.querySelector('.btn-burgundy-outline');
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
        infoTab.appendChild(fileInput);

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

    // 2. Вкладка "Налаштування холодильника"
    const fridgeSaveBtn = document.querySelector('#tab-fridge-settings .btn-burgundy-solid');
    if (fridgeSaveBtn) fridgeSaveBtn.onclick = async () => {
        await saveFullProfile(); // Зберігаємо налаштування (колір, приватність)
        await saveFridgeOnlyLayout(); // Примусово зберігаємо позиції
    };

    // 3. Вкладка "Загальні налаштування"
    const settingsTab = document.getElementById('tab-settings');
    if (settingsTab) {
        // Зміна пароля
        const savePassBtn = settingsTab.querySelectorAll('.btn-burgundy-solid')[0];
        if (savePassBtn) {
            savePassBtn.addEventListener('click', async () => {
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

        // Загальна кнопка збереження налаштувань (в кінці сторінки)
        const saveAllBtn = settingsTab.querySelectorAll('.btn-burgundy-solid')[1];
        if (saveAllBtn) {
            saveAllBtn.addEventListener('click', saveFullProfile);
        }

        // Видалення акаунту
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

/* =========================================
   5. КОНТЕНТ (ПОСТИ, ТУРИ)
   ========================================= */
async function loadMyPosts() {
    const container = document.querySelector('#tab-my-posts');
    const header = container.querySelector('.flex.justify-between');

    // Прив'язка кнопки "Створити новий пост"
    const createBtn = header.querySelector('button');
    if(createBtn) {
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

        if (editingPostId) {
            url = `${API_URL}/forum/posts/${editingPostId}`;
            method = 'PUT';
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