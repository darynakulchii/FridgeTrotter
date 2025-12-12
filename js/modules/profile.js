import { API_URL, getHeaders } from '../api-config.js';

const currentUser = JSON.parse(localStorage.getItem('user'));
let editingPostId = null;

// Функція затримки (Debounce) для автозбереження
function debounce(func, timeout = 1000) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// Створюємо дебаунс-версію функції збереження (чекає 1 сек після останньої зміни)
const autoSaveFridge = debounce(() => {
    saveFridgeOnlyLayout();
    console.log('Autosaving fridge...');
});

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    // Інжектуємо модалку редагування поста (залишаємо стару логіку)
    injectPostModal();

    initTabs();
    loadUserProfile();
    initFridge();
    initContentTabs();
    initSettingsForms();
});

/* ================== ЛОГІКА ПРОФІЛЮ ТА ДАНИХ ================== */

async function loadUserProfile() {
    try {
        const response = await fetch(`${API_URL}/user/profile`, { headers: getHeaders() });
        if (!response.ok) throw new Error('Failed to load profile');
        const data = await response.json();
        fillProfileData(data);
    } catch (error) { console.error(error); }
}

function fillProfileData(data) {
    // 1. Інформація ("Моя інформація")
    const infoTab = document.getElementById('tab-info');
    if (infoTab) {
        const inputs = infoTab.querySelectorAll('input.form-input');
        const textarea = infoTab.querySelector('textarea.form-input');

        if (inputs[0]) inputs[0].value = `${data.first_name || ''} ${data.last_name || ''}`.trim();
        if (inputs[1]) inputs[1].value = data.email || '';
        if (inputs[2]) inputs[2].value = data.location || '';
        if (inputs[3]) inputs[3].value = data.date_of_birth ? data.date_of_birth.split('T')[0] : '';
        if (inputs[4]) inputs[4].value = data.website || ''; // Виправлено: тепер заповнюється
        if (textarea) textarea.value = data.bio || '';
        if (inputs[5]) inputs[5].value = data.travel_interests || '';

        // Аватар
        const avatarCircle = infoTab.querySelector('.avatar-circle-lg');
        if (avatarCircle && data.profile_image_url) {
            avatarCircle.innerHTML = `<img src="${data.profile_image_url}" class="w-full h-full object-cover rounded-full">`;
        }

        // Статистика (без змін)
        const statNumbers = infoTab.querySelectorAll('.stat-number');
        if (statNumbers.length >= 4) {
            statNumbers[0].innerText = data.countries_visited || 0;
            statNumbers[1].innerText = data.cities_visited || 0;
            statNumbers[2].innerText = 0;
            statNumbers[3].innerText = data.followers_count || 0;
        }
    }

    // 2. Налаштування холодильника
    const fridgeSettingsTab = document.getElementById('tab-fridge-settings');
    if (fridgeSettingsTab) {
        const colorOptions = fridgeSettingsTab.querySelectorAll('.color-option');
        colorOptions.forEach(opt => {
            const preview = opt.querySelector('.color-preview');
            opt.classList.remove('selected');
            if (preview.style.backgroundColor && data.fridge_color && preview.style.backgroundColor.includes(hexToRgb(data.fridge_color))) {
                opt.classList.add('selected');
            }
        });

        const switches = fridgeSettingsTab.querySelectorAll('.toggle-switch');
        if (switches[0]) toggleSwitch(switches[0], data.fridge_is_public);
        if (switches[1]) toggleSwitch(switches[1], data.fridge_allow_comments);
    }

    // Застосування кольору до самого холодильника
    const fridgeDoor = document.getElementById('fridge-door');
    if (fridgeDoor && data.fridge_color) fridgeDoor.style.backgroundColor = data.fridge_color;

    // 3. Загальні налаштування (Settings)
    const settingsTab = document.getElementById('tab-settings');
    if (settingsTab) {
        // Знаходимо всі перемикачі в цьому табі
        const allSwitches = settingsTab.querySelectorAll('.toggle-switch');

        // Порядок перемикачів у HTML (див. my_profile.html):
        // 0: Email Notif, 1: Push, 2: Followers, 3: Comments, 4: Messages
        // 5: Public Profile, 6: Show Email, 7: Show Location, 8: Allow Messages

        if(allSwitches.length >= 9) {
            toggleSwitch(allSwitches[0], data.notify_email);
            toggleSwitch(allSwitches[1], data.notify_push);
            toggleSwitch(allSwitches[2], data.notify_new_followers);
            toggleSwitch(allSwitches[3], data.notify_comments);
            toggleSwitch(allSwitches[4], data.notify_messages);

            toggleSwitch(allSwitches[5], true); // Public Profile (заглушка або реальне поле в майбутньому)
            toggleSwitch(allSwitches[6], data.is_email_public);
            toggleSwitch(allSwitches[7], data.is_location_public);
        }
    }
}

// Helper to collect ALL data for saving
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
        website: inputs[4].value, // Зчитуємо вебсайт
        bio: textarea.value,
        travelInterests: inputs[5].value
    };

    // Fridge Settings
    const fSettingsTab = document.getElementById('tab-fridge-settings');
    const selectedColorEl = fSettingsTab?.querySelector('.color-option.selected .color-preview');
    const fSwitches = fSettingsTab?.querySelectorAll('.toggle-switch');

    // General Settings (Notifications & Privacy)
    const gSettingsTab = document.getElementById('tab-settings');
    const gSwitches = gSettingsTab?.querySelectorAll('.toggle-switch');

    return {
        ...basicInfo,
        fridgeColor: selectedColorEl?.style.backgroundColor || '#f3f4f6',
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
    // Кнопка збереження у вкладці "Інфо"
    const infoSaveBtn = document.querySelector('#tab-info .btn-burgundy-solid');
    if (infoSaveBtn) infoSaveBtn.onclick = saveFullProfile;

    // Кнопка збереження у вкладці "Налаштування холодильника" (тільки налаштування, магніти зберігаються окремо)
    const fridgeSaveBtn = document.querySelector('#tab-fridge-settings .btn-burgundy-solid');
    if (fridgeSaveBtn) fridgeSaveBtn.onclick = async () => {
        await saveFullProfile(); // Зберігаємо налаштування
        // Магніти зберігаються окремо через saveFridgeLayout, можна викликати і тут примусово
    };

    // Перемикачі просто візуально перемикаються, збереження йде при натисканні кнопок або автозбереженні (якщо реалізувати)
    document.querySelectorAll('.toggle-switch').forEach(sw => {
        sw.addEventListener('click', () => sw.classList.toggle('active'));
    });

    // Обробка зміни аватара (без змін)
    const uploadBtn = document.querySelector('#tab-info .btn-burgundy-outline');
    const fileInput = document.querySelector('#tab-info input[type="file"]');
    if (uploadBtn && fileInput) {
        uploadBtn.onclick = () => fileInput.click();
        fileInput.onchange = async () => { /* ... код завантаження ... */ };
    }
}

/* ================== АВТОЗБЕРЕЖЕННЯ ХОЛОДИЛЬНИКА ================== */

// Зберігає ТІЛЬКИ розташування магнітів (щоб не ганяти зайві дані)
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
        // Можна додати маленький індикатор "Збережено" в кутку
    } catch (e) { console.error('Auto-save failed', e); }
}

// Оновлена функція Drop
function initDragAndDrop(fridgeDoor) {
    let draggedItem = null;
    let isNewItem = false;
    let offset = { x: 0, y: 0 };

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
            // Логіка додавання нового
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
            // Логіка переміщення
            draggedItem.style.left = `${x - offset.x}px`;
            draggedItem.style.top = `${y - offset.y}px`;
        }

        checkPlaceholder();
        draggedItem = null;
        isNewItem = false;

        // !!! АВТОЗБЕРЕЖЕННЯ !!!
        autoSaveFridge();
    });

    // Обробка видалення (викидання за межі холодильника)
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

// ... Інші допоміжні функції (initTabs, createMagnetElement, etc.) залишаються без змін ...
// Переконайтеся, що ви скопіювали hexToRgb, toggleSwitch та інші з попередньої версії файлу
function hexToRgb(hex) { return hex.replace('#', ''); }
function toggleSwitch(element, isActive) {
    if (isActive) element.classList.add('active'); else element.classList.remove('active');
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
function createMagnetElement(magnetData, isOnFridge) { /* ... код з попереднього файлу ... */
    const div = document.createElement('div');
    div.className = isOnFridge ? `magnet-on-fridge ${magnetData.color_group || 'burgundy'}` : `magnet-btn ${magnetData.color_group || 'burgundy'}`;
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
        </div>`;
    return div;
}
function createMagnetOnFridgeElement(m) { return createMagnetElement(m, true); }
function injectPostModal() { /* ... код модалки ... */ }
function initFridge() { /* ... код ініціалізації ... */
    const fridgeDoor = document.getElementById('fridge-door');
    const panel = document.querySelector('.magnet-panel-card');
    // Fetch available magnets logic...
    fetch(`${API_URL}/fridge/magnets/available`, { headers: getHeaders() })
        .then(res => res.json())
        .then(data => {
            const title = panel.querySelector('h3');
            const hint = panel.querySelector('p.text-gray-500');
            panel.innerHTML = '';
            if(title) panel.appendChild(title);
            data.magnets.forEach(m => panel.appendChild(createMagnetElement(m, false)));
            if(hint) panel.appendChild(hint);
            initDragAndDrop(fridgeDoor);
        });
    loadUserFridgeLayout();

    // Кольори
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            fridgeDoor.style.backgroundColor = opt.querySelector('.color-preview').style.backgroundColor;
        });
    });
}
async function loadUserFridgeLayout() { /* ... */
    const fridgeDoor = document.getElementById('fridge-door');
    try {
        const response = await fetch(`${API_URL}/fridge/${currentUser.userId}/layout`, { headers: getHeaders() });
        const data = await response.json();
        fridgeDoor.querySelectorAll('.magnet-on-fridge').forEach(m => m.remove());
        data.magnets.forEach(m => {
            const el = createMagnetOnFridgeElement(m);
            el.style.left = `${m.x_position}px`;
            el.style.top = `${m.y_position}px`;
            fridgeDoor.appendChild(el);
        });
        checkPlaceholder();
    } catch (e) {}
}
function initContentTabs() {
    // Глобальна функція для видалення збереженого туру
    window.removeSavedTour = async (id) => {
        if(!confirm('Видалити зі збережених?')) return;
        try {
            // Використовуємо той самий endpoint /save, який працює як перемикач (toggle)
            await fetch(`${API_URL}/tours/save`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ tourId: id })
            });
            // Оновлюємо список після видалення
            loadSavedTours();
        } catch(e) { console.error(e); }
    };

    // Глобальна функція для видалення збереженого поста
    window.removeSavedPost = async (id) => {
        if(!confirm('Видалити зі збережених?')) return;
        try {
            await fetch(`${API_URL}/forum/saved/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            // Оновлюємо список після видалення
            loadSavedPosts();
        } catch(e) { console.error(e); }
    };
}