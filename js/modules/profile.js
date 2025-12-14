import { API_URL, getHeaders } from '../api-config.js';

const currentUser = JSON.parse(localStorage.getItem('user'));
let editingPostId = null;

// === HELPER: Debounce для автозбереження ===
// Запобігає надто частим запитам до сервера при перетягуванні
function debounce(func, timeout = 1000) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// Автозбереження розташування магнітів
const autoSaveFridge = debounce(() => {
    saveFridgeOnlyLayout();
}, 1000);

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    injectPostModal();
    initTabs();
    loadUserProfile(); // Завантажує дані, кольори та налаштування перемикачів
    initFridge();      // Ініціалізує холодильник та Drag-n-Drop
    initContentTabs(); // Ініціалізує вкладки збереженого контенту
    initSettingsForms(); // Ініціалізує форми налаштувань
});

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

            const targetTab = document.getElementById(`tab-${tabName}`);
            if (targetTab) targetTab.classList.add('active');

            // "Ліниве" завантаження даних для відповідних вкладок
            if (tabName === 'my-posts') loadMyPosts();
            if (tabName === 'saved-tours') loadSavedTours();
            if (tabName === 'saved-posts') loadSavedPosts();
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
    // --- 1. Вкладка "Моя інформація" ---
    const infoTab = document.getElementById('tab-info');
    if (infoTab) {
        const inputs = infoTab.querySelectorAll('input.form-input');
        const textarea = infoTab.querySelector('textarea.form-input');

        // Заповнюємо поля, перевіряючи наявність даних
        if (inputs[0]) inputs[0].value = `${data.first_name || ''} ${data.last_name || ''}`.trim();
        if (inputs[1]) inputs[1].value = data.email || '';
        if (inputs[2]) inputs[2].value = data.location || '';
        if (inputs[3]) inputs[3].value = data.date_of_birth ? data.date_of_birth.split('T')[0] : '';
        if (inputs[4]) inputs[4].value = data.website || '';
        if (textarea) textarea.value = data.bio || '';
        if (inputs[5]) inputs[5].value = data.travel_interests || '';

        // Аватар
        const avatarCircle = infoTab.querySelector('.avatar-circle-lg');
        if (avatarCircle && data.profile_image_url) {
            avatarCircle.innerHTML = `<img src="${data.profile_image_url}" class="w-full h-full object-cover rounded-full">`;
            // Видаляємо стандартні класи стилізації тексту, якщо є картинка
            avatarCircle.classList.remove('bg-[#48192E]', 'text-[#D3CBC4]');
        } else if (avatarCircle) {
            avatarCircle.innerText = (data.first_name?.[0] || '') + (data.last_name?.[0] || '');
        }

        // Статистика
        const statNumbers = infoTab.querySelectorAll('.stat-number');
        if (statNumbers.length >= 4) {
            statNumbers[0].innerText = data.countries_visited || 0;
            statNumbers[1].innerText = data.cities_visited || 0;
            // statNumbers[2] зазвичай для активних турів (поки 0)
            statNumbers[3].innerText = data.followers_count || 0;
        }
    }

    // --- 2. Налаштування холодильника (ВИПРАВЛЕНО ВИБІР КОЛЬОРУ) ---
    const settingsTab = document.getElementById('tab-fridge-settings');
    if (settingsTab) {
        const colorOptions = settingsTab.querySelectorAll('.color-option');

        // Скидаємо всі вибрані
        colorOptions.forEach(opt => opt.classList.remove('selected'));

        // Шукаємо потрібний колір по атрибуту data-color
        let colorFound = false;
        colorOptions.forEach(opt => {
            const optColor = opt.getAttribute('data-color');
            // Порівнюємо рядки (ігноруючи регістр)
            if (optColor && data.fridge_color && optColor.toLowerCase() === data.fridge_color.toLowerCase()) {
                opt.classList.add('selected');
                colorFound = true;
            }
        });

        // Якщо колір не знайдено, вибираємо перший (дефолтний) як fallback
        if (!colorFound && colorOptions.length > 0) {
            colorOptions[0].classList.add('selected');
        }

        const switches = settingsTab.querySelectorAll('.toggle-switch');
        if (switches[0]) toggleSwitch(switches[0], data.fridge_is_public);
        if (switches[1]) toggleSwitch(switches[1], data.fridge_allow_comments);
        // Третій перемикач (відображення в профілі) можна прив'язати до fridge_is_public або окремого поля
        if (switches[2]) toggleSwitch(switches[2], data.fridge_is_public);
    }

    // Фарбуємо сам холодильник при завантаженні
    const fridgeDoor = document.getElementById('fridge-door');
    if (fridgeDoor && data.fridge_color) {
        fridgeDoor.style.backgroundColor = data.fridge_color;
    }

    // --- 3. Загальні налаштування (ВИПРАВЛЕНО ПЕРЕМИКАЧІ) ---
    const mainSettingsTab = document.getElementById('tab-settings');
    if (mainSettingsTab) {
        const allSwitches = mainSettingsTab.querySelectorAll('.toggle-switch');

        // Переконуємось, що індекси відповідають HTML структурі my_profile.html
        if(allSwitches.length >= 8) {
            toggleSwitch(allSwitches[0], data.notify_email);
            toggleSwitch(allSwitches[1], data.notify_push);
            // 2 - нові підписники
            toggleSwitch(allSwitches[2], data.notify_new_followers);
            // 3 - нові коментарі
            toggleSwitch(allSwitches[3], data.notify_comments);
            // 4 - нові повідомлення
            toggleSwitch(allSwitches[4], data.notify_messages);

            // Конфіденційність
            // Прибираємо заглушку "true". Прив'язуємо до fridge_is_public (або іншого поля, якщо є)
            toggleSwitch(allSwitches[5], data.fridge_is_public);

            toggleSwitch(allSwitches[6], data.is_email_public);
            toggleSwitch(allSwitches[7], data.is_location_public);
        }
    }
}

// Допоміжна функція для перемикання класу active
function toggleSwitch(element, isActive) {
    // Перетворюємо в boolean, щоб уникнути null/undefined помилок
    const active = !!isActive;
    if (active) element.classList.add('active');
    else element.classList.remove('active');
}

/* =========================================
   3. ЛОГІКА ХОЛОДИЛЬНИКА
   ========================================= */
/* =========================================
   3. ЛОГІКА ХОЛОДИЛЬНИКА
   ========================================= */
async function initFridge() {
    const fridgeDoor = document.getElementById('fridge-door');
    const panel = document.querySelector('.magnet-panel-card');

    if (fridgeDoor) {
        initDragAndDrop(fridgeDoor);
    }

    // === ОНОВЛЕНО: Проста логіка кнопки "Зберегти" ===
    const saveBtn = document.getElementById('save-fridge-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            // Блокуємо кнопку на час збереження
            const originalText = saveBtn.innerHTML;
            saveBtn.disabled = true;
            await saveFridgeOnlyLayout();
            alert('Зміни успішно збережено!');
        });
    }
    // ==================================================

    // 1. Завантажуємо доступні магніти (Ваш існуючий код для Grid)
    try {
        const response = await fetch(`${API_URL}/fridge/magnets/available`, { headers: getHeaders() });
        const data = await response.json();

        let grid = panel.querySelector('#magnet-grid');

        if (!grid) {
            const title = panel.querySelector('h3');
            panel.innerHTML = '';
            if (title) panel.appendChild(title);

            grid = document.createElement('div');
            grid.id = 'magnet-grid';
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
            grid.style.gap = '1rem';
            grid.style.width = '100%';
            panel.appendChild(grid);
        } else {
            grid.innerHTML = '';
        }

        if (data.magnets && data.magnets.length > 0) {
            data.magnets.forEach(m => {
                const el = createMagnetElement(m, false);
                el.style.width = '100%';
                el.style.boxSizing = 'border-box';
                grid.appendChild(el);
            });
        }

        const hintExists = panel.querySelector('.text-gray-500.border-t');
        if (!hintExists) {
            panel.insertAdjacentHTML('beforeend', '<p class="text-sm text-gray-500 mt-6 pt-4 border-t border-gray-100">Перетягніть магніт на холодильник</p>');
        }

    } catch (e) {
        console.error('Error loading available magnets:', e);
    }

    loadUserFridgeLayout();

    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            colorOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            const color = opt.getAttribute('data-color') || opt.querySelector('.color-preview')?.style.backgroundColor;
            if(fridgeDoor && color) fridgeDoor.style.backgroundColor = color;
        });
    });

    document.querySelectorAll('.toggle-switch').forEach(sw => {
        sw.addEventListener('click', () => {
            sw.classList.toggle('active');
        });
    });
}

function initDragAndDrop(fridgeDoor) {
    let draggedItem = null;
    let isNewItem = false;
    let offset = { x: 0, y: 0 };

    // Подія для панелі (нові магніти)
    document.addEventListener('dragstart', (e) => {
        const target = e.target.closest('.magnet-btn');
        if (target) {
            isNewItem = true;
            draggedItem = target;
            // Безпечно отримуємо ID або пустий рядок
            e.dataTransfer.setData('text/plain', target.getAttribute('data-id') || '');
            e.dataTransfer.effectAllowed = 'copy';
        }
    });

    // Подія для існуючих магнітів на холодильнику
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
        autoSaveFridge();
    });

    // Видалення
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
        const isOverFridge = e.target.closest('#fridge-door');
        if (!isOverFridge && !isNewItem && draggedItem && draggedItem.classList.contains('magnet-on-fridge')) {
            draggedItem.remove();
            checkPlaceholder();
            draggedItem = null;
            autoSaveFridge();
        }
    });
}

async function loadUserFridgeLayout() {
    const fridgeDoor = document.getElementById('fridge-door');
    try {
        const response = await fetch(`${API_URL}/fridge/${currentUser.userId}/layout`, { headers: getHeaders() });
        const data = await response.json();

        // Видаляємо старі магніти перед рендерингом
        const oldMagnets = fridgeDoor.querySelectorAll('.magnet-on-fridge');
        oldMagnets.forEach(m => m.remove());

        if(data.magnets) {
            data.magnets.forEach(m => {
                const el = createMagnetOnFridgeElement(m);
                el.style.left = `${m.x_position}px`;
                el.style.top = `${m.y_position}px`;
                fridgeDoor.appendChild(el);
            });
        }
        checkPlaceholder();
    } catch (e) { console.error(e); }
}

function createMagnetElement(magnetData, isOnFridge) {
    const div = document.createElement('div');
    div.setAttribute('draggable', 'true')
    const baseClass = isOnFridge ? 'magnet-on-fridge' : 'magnet-btn';
    const shapeClass = magnetData.shape ? `magnet-shape-${magnetData.shape}` : '';
    const extraClasses = magnetData.image_url ? 'relative overflow-hidden' : '';

    div.className = `${baseClass} ${magnetData.color_group || 'burgundy'} ${shapeClass} ${extraClasses}`;

    div.setAttribute('data-id', magnetData.magnet_id);
    div.setAttribute('data-country', magnetData.country);
    div.setAttribute('data-city', magnetData.city || '');
    div.setAttribute('data-icon', magnetData.icon_class || 'star');
    div.setAttribute('data-color', magnetData.color_group || 'burgundy');

    if (magnetData.image_url) div.setAttribute('data-image', magnetData.image_url);
    if (magnetData.shape) div.setAttribute('data-shape', magnetData.shape);

    if (magnetData.image_url) {
        div.innerHTML = `
            <img src="${magnetData.image_url}" class="absolute inset-0 w-full h-full object-cover pointer-events-none z-0">
            <div class="absolute inset-0 bg-black/30 z-10 flex items-center justify-center p-1">
                <span class="text-white font-bold text-center leading-tight ${isOnFridge ? 'text-[10px]' : 'text-xs'} drop-shadow-md pointer-events-none">
                    ${magnetData.city || magnetData.country}
                </span>
            </div>
        `;
    } else {
        const countryText = magnetData.country;
        const cityText = magnetData.city || magnetData.country;

        div.innerHTML = `
            <i class="fas fa-${magnetData.icon_class} ${isOnFridge ? '' : 'text-xl'} z-10 relative"></i>
            <div class="z-10 relative">
                <div class="${isOnFridge ? 'text-[10px] font-bold mt-1 leading-tight' : 'font-bold text-sm'} pointer-events-none">${cityText}</div>
                ${!isOnFridge ? `<div class="text-xs opacity-80 pointer-events-none">${countryText}</div>` : `<div class="text-[8px] opacity-90 pointer-events-none">${countryText}</div>`}
            </div>
        `;
    }

    return div;
}

function createMagnetOnFridgeElement(magnetData) {
    return createMagnetElement(magnetData, true);
}


function checkPlaceholder() {
    const fridgeDoor = document.getElementById('fridge-door');
    const placeholder = document.getElementById('fridge-placeholder');
    if(!fridgeDoor || !placeholder) return;

    const hasMagnets = fridgeDoor.querySelectorAll('.magnet-on-fridge').length > 0;
    if (hasMagnets) placeholder.classList.add('hidden');
    else placeholder.classList.remove('hidden');
}

// Функція збереження магнітів (викликається автоматично або примусово)
async function saveFridgeOnlyLayout() {
    const fridgeDoor = document.getElementById('fridge-door');
    if(!fridgeDoor) return;

    const magnetElements = fridgeDoor.querySelectorAll('.magnet-on-fridge');

    const magnetsData = Array.from(magnetElements).map(el => ({
        magnet_id: parseInt(el.getAttribute('data-id')), // Впевнюємось, що це число
        x_position: parseInt(el.style.left) || 0,
        y_position: parseInt(el.style.top) || 0
    })).filter(m => !isNaN(m.magnet_id)); // Відфільтровуємо поламані ID

    try {
        await fetch(`${API_URL}/fridge/save`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ magnetsData })
        });
        console.log('Layout saved successfully');
    } catch (e) { console.error('Auto-save failed', e); }
}

/* =========================================
   4. ЗБЕРЕЖЕННЯ ПРОФІЛЮ (КНОПКИ)
   ========================================= */

function collectAllProfileData() {
    // Info Tab Data
    const infoTab = document.getElementById('tab-info');
    const inputs = infoTab.querySelectorAll('input.form-input');
    const textarea = infoTab.querySelector('textarea.form-input');
    const fullName = inputs[0].value.split(' ');

    // Fridge Settings Data
    const fSettingsTab = document.getElementById('tab-fridge-settings');
    const selectedOption = fSettingsTab?.querySelector('.color-option.selected');
    const fSwitches = fSettingsTab?.querySelectorAll('.toggle-switch');

    // General Settings Data
    const gSettingsTab = document.getElementById('tab-settings');
    const gSwitches = gSettingsTab?.querySelectorAll('.toggle-switch');

    return {
        // Профіль
        firstName: fullName[0] || '',
        lastName: fullName.slice(1).join(' ') || '',
        email: inputs[1].value,
        location: inputs[2].value,
        dateOfBirth: inputs[3].value,
        website: inputs[4].value,
        bio: textarea.value,
        travelInterests: inputs[5].value,

        // Холодильник (колір беремо з атрибуту data-color)
        fridgeColor: selectedOption?.getAttribute('data-color') || '#f3f4f6',

        fridgeIsPublic: fSwitches?.[0]?.classList.contains('active') ?? true,
        fridgeAllowComments: fSwitches?.[1]?.classList.contains('active') ?? true,

        // Сповіщення
        notifyEmail: gSwitches?.[0]?.classList.contains('active') ?? true,
        notifyPush: gSwitches?.[1]?.classList.contains('active') ?? true,
        notifyNewFollowers: gSwitches?.[2]?.classList.contains('active') ?? true,
        notifyComments: gSwitches?.[3]?.classList.contains('active') ?? true,
        notifyMessages: gSwitches?.[4]?.classList.contains('active') ?? true,

        // Приватність
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

        // Також примусово зберігаємо магніти при ручному збереженні (синхронізація)
        await saveFridgeOnlyLayout();

        if(res.ok) alert('Зміни успішно збережено!');
        else alert('Помилка збереження');
    } catch(e) { console.error(e); }
}

function initSettingsForms() {
    // 1. Кнопка "Зберегти зміни" на вкладці "Інфо"
    const infoSaveBtn = document.querySelector('#tab-info .btn-burgundy-solid');
    if(infoSaveBtn) infoSaveBtn.onclick = saveFullProfile;

    // 2. Кнопка "Зберегти налаштування" на вкладці "Холодильник"
    const fridgeSaveBtn = document.querySelector('#tab-fridge-settings .btn-burgundy-solid');
    if (fridgeSaveBtn) fridgeSaveBtn.onclick = saveFullProfile;

    // 3. Кнопки на вкладці "Загальні налаштування"
    const settingsTab = document.getElementById('tab-settings');
    if (settingsTab) {
        // Зміна пароля (перша кнопка)
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

        // Загальне збереження (друга кнопка внизу)
        const saveAllBtn = settingsTab.querySelectorAll('.btn-burgundy-solid')[1];
        if (saveAllBtn) saveAllBtn.onclick = saveFullProfile;

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

    // 4. Логіка завантаження аватара
    const infoTab = document.getElementById('tab-info');
    if(infoTab) {
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
                            if (avatarCircle) {
                                avatarCircle.innerHTML = `<img src="${data.url}" class="w-full h-full object-cover rounded-full">`;
                                avatarCircle.classList.remove('bg-[#48192E]', 'text-[#D3CBC4]');
                            }
                        }
                    } catch (e) { console.error(e); }
                }
            });
        }
    }
}

/* =========================================
   5. ФУНКЦІОНАЛ КОНТЕНТУ (ПОСТИ, ТУРИ)
   ========================================= */

// HELPER: Модалка для постів
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

// Глобальні методи для виклику з onclick
window.openCreatePostModal = () => {
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
                    <div class="w-10 h-10 rounded-full bg-[#2D4952] flex items-center justify-center text-white font-bold overflow-hidden">
                        ${post.author_avatar ? `<img src="${post.author_avatar}" class="w-full h-full object-cover">` : 'A'}
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