import { API_URL, getHeaders } from '../api-config.js';

/**
 * profile.js
 * Повна реалізація логіки профілю з інтеграцією бекенду.
 */

// Отримуємо поточного користувача з LocalStorage
const currentUser = JSON.parse(localStorage.getItem('user'));

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    initTabs();
    loadUserProfile();
    initFridge();
    initContentTabs();
    initSettingsForms();
});

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
    } catch (error) {
        console.error(error);
        // alert('Не вдалося завантажити профіль');
    }
}

function fillProfileData(data) {
    // 1. Заповнення статистики та інфо в хедері (якщо є елементи)
    // Тут можна додати логіку оновлення глобального хедера, якщо потрібно

    // 2. Вкладка "Моя інформація" (Inputs)
    // Оскільки в HTML немає ID, вибираємо за порядком або класами в межах таба
    const infoTab = document.getElementById('tab-info');
    if (infoTab) {
        const inputs = infoTab.querySelectorAll('input.form-input');
        const textarea = infoTab.querySelector('textarea.form-input');

        // Припускаємо порядок inputs згідно HTML: Name, Email, Location, DOB, Website, Interests
        if (inputs[0]) inputs[0].value = `${data.first_name || ''} ${data.last_name || ''}`.trim(); // Name (read-only logic logic needed specifically for split)
        // Для редагування краще розділити, але поки заповнимо як є
        // Щоб коректно працювало збереження, нам треба знати де ім'я, а де прізвище.
        // Модифікуємо це при збереженні.

        if (inputs[1]) inputs[1].value = data.email || '';
        if (inputs[2]) inputs[2].value = data.location || '';
        if (inputs[3]) inputs[3].value = data.date_of_birth ? data.date_of_birth.split('T')[0] : '';
        if (inputs[4]) inputs[4].value = ""; // Website (немає в БД, можна додати поле або ігнорувати)
        if (textarea) textarea.value = data.bio || '';
        if (inputs[5]) inputs[5].value = data.travel_interests || '';

        // Аватар
        const avatarCircle = infoTab.querySelector('.avatar-circle-lg');
        if (avatarCircle && data.profile_image_url) {
            avatarCircle.innerHTML = `<img src="${data.profile_image_url}" class="w-full h-full object-cover rounded-full">`;
            avatarCircle.classList.remove('bg-[#48192E]', 'text-[#D3CBC4]'); // Прибрати дефолтні стилі
        } else if (avatarCircle) {
            avatarCircle.innerText = (data.first_name?.[0] || '') + (data.last_name?.[0] || '');
        }

        // Статистика
        const statNumbers = infoTab.querySelectorAll('.stat-number');
        if (statNumbers.length >= 4) {
            statNumbers[0].innerText = data.countries_visited || 0;
            statNumbers[1].innerText = data.cities_visited || 0;
            statNumbers[2].innerText = 0; // Активні тури (поки немає в БД)
            statNumbers[3].innerText = data.followers_count || 0;
        }
    }

    // 3. Вкладка "Налаштування холодильника" (Inputs)
    const settingsTab = document.getElementById('tab-fridge-settings');
    if (settingsTab) {
        // Кольори
        const colorOptions = settingsTab.querySelectorAll('.color-option');
        colorOptions.forEach(opt => {
            const preview = opt.querySelector('.color-preview');
            // Порівнюємо колір (конвертуємо rgb в hex якщо треба, або просто перевіряємо стиль)
            // Для спрощення просто вибираємо перший або той, що співпадає
            opt.classList.remove('selected');
            if (preview.style.backgroundColor === data.fridge_color) { // Це перевірка може бути неточною через формати кольорів
                opt.classList.add('selected');
            }
        });
        // Якщо точного співпадіння немає, можна вибрати дефолтний, але не будемо чіпати

        // Тумблери (Switches)
        const switches = settingsTab.querySelectorAll('.toggle-switch');
        if (switches[0]) toggleSwitch(switches[0], data.fridge_is_public);
        if (switches[1]) toggleSwitch(switches[1], data.fridge_allow_comments);
        // Третій тумблер "Показувати в профілі" - немає поля в БД, ігноруємо
    }

    // Оновлення самого холодильника (колір)
    const fridgeDoor = document.getElementById('fridge-door');
    if (fridgeDoor && data.fridge_color) {
        fridgeDoor.style.backgroundColor = data.fridge_color;
    }
}

function toggleSwitch(element, isActive) {
    if (isActive) element.classList.add('active');
    else element.classList.remove('active');
}

/* =========================================
   3. ЛОГІКА ХОЛОДИЛЬНИКА (DRAG & DROP + API)
   ========================================= */
async function initFridge() {
    const fridgeDoor = document.getElementById('fridge-door');
    const panel = document.querySelector('.magnet-panel-card');

    // 1. Завантаження доступних магнітів (Ліва панель)
    try {
        const response = await fetch(`${API_URL}/fridge/magnets/available`, { headers: getHeaders() });
        const data = await response.json();

        // Очищаємо панель (зберігаючи заголовок)
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

    // 2. Завантаження магнітів користувача (Холодильник)
    loadUserFridgeLayout();

    // 3. Кнопка збереження (в табі налаштувань)
    // Шукаємо кнопку в табі налаштувань, бо в дизайні вона там
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

        // Очищаємо холодильник від старих магнітів (зберігаємо ручку і плейсхолдер)
        const magnets = fridgeDoor.querySelectorAll('.magnet-on-fridge');
        magnets.forEach(m => m.remove());

        data.magnets.forEach(m => {
            const el = createMagnetOnFridgeElement(m);
            // Позиціонування
            el.style.left = `${m.x_position}px`;
            el.style.top = `${m.y_position}px`;
            fridgeDoor.appendChild(el);
        });

        checkPlaceholder();
    } catch (e) { console.error(e); }
}

function createMagnetElement(magnetData, isOnFridge) {
    const div = document.createElement('div');
    // Класи
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
    // Створюємо елемент, готовий для холодильника
    const el = createMagnetElement(magnetData, true);
    // Додаємо специфічні стилі для холодильника
    el.innerHTML = `
        <i class="fas fa-${magnetData.icon_class}"></i>
        <div class="text-[10px] font-bold mt-1 leading-tight pointer-events-none">${magnetData.city}</div>
        <div class="text-[8px] opacity-90 pointer-events-none">${magnetData.country}</div>
    `;
    return el;
}

/* --- Drag & Drop Logic (Адаптовано) --- */
let draggedItem = null;
let isNewItem = false;
let offset = { x: 0, y: 0 };

function initDragAndDrop(fridgeDoor) {
    // Делегування подій для source (панель)
    document.querySelector('.magnet-panel-card').addEventListener('dragstart', (e) => {
        const target = e.target.closest('.magnet-btn');
        if (target) {
            isNewItem = true;
            draggedItem = target;
            e.dataTransfer.setData('text/plain', target.getAttribute('data-id'));
            e.dataTransfer.effectAllowed = 'copy';
        }
    });

    // Делегування для fridge items (переміщення)
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
            // Створюємо копію на холодильнику
            const data = {
                magnet_id: draggedItem.getAttribute('data-id'),
                country: draggedItem.getAttribute('data-country'),
                city: draggedItem.getAttribute('data-city'),
                icon_class: draggedItem.getAttribute('data-icon'),
                color_group: draggedItem.getAttribute('data-color')
            };
            const newEl = createMagnetOnFridgeElement(data);
            newEl.style.left = `${x - 35}px`; // Центруємо
            newEl.style.top = `${y - 35}px`;
            fridgeDoor.appendChild(newEl);
        } else {
            // Переміщуємо
            draggedItem.style.left = `${x - offset.x}px`;
            draggedItem.style.top = `${y - offset.y}px`;
        }

        checkPlaceholder();
        draggedItem = null;
        isNewItem = false;
    });

    // Видалення (Drop поза холодильником)
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

    // 1. Збираємо дані layout
    const magnetElements = fridgeDoor.querySelectorAll('.magnet-on-fridge');
    const magnetsData = Array.from(magnetElements).map(el => ({
        magnet_id: el.getAttribute('data-id'),
        x_position: parseInt(el.style.left) || 0,
        y_position: parseInt(el.style.top) || 0
    }));

    // 2. Збираємо налаштування
    const selectedColorEl = settingsTab.querySelector('.color-option.selected .color-preview');
    const fridgeColor = selectedColorEl ? selectedColorEl.style.backgroundColor : '#f3f4f6';

    const switches = settingsTab.querySelectorAll('.toggle-switch');
    const isPublic = switches[0] ? switches[0].classList.contains('active') : true;
    const allowComments = switches[1] ? switches[1].classList.contains('active') : true;

    // 3. Відправляємо запити (паралельно)
    try {
        // Збереження магнітів
        const saveLayoutPromise = fetch(`${API_URL}/fridge/save`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ magnetsData })
        });

        // Оновлення налаштувань профілю (включаючи налаштування холодильника)
        // Нам потрібно зібрати й інші дані профілю, щоб не затерти їх,
        // АЛЕ наш ендпоінт PUT /profile оновлює все зразу.
        // Тому краще спочатку зчитати дані з форми Info, або (для спрощення тут)
        // ми відправимо тільки те, що стосується холодильника, а бекенд треба було б адаптувати під PATCH.
        // Оскільки бекенд PUT вимагає всі поля, ми зхитруємо:
        // Ми припускаємо, що користувач не змінював інфо в іншому табі,
        // тому ми можемо зібрати дані з інпутів Info tab зараз.

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

        // Оновлюємо колір візуально
        fridgeDoor.style.backgroundColor = fridgeColor;

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
    // Зберігаємо заголовок та кнопку створення
    const header = container.querySelector('.flex.justify-between');

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
            const html = createPostCardHTML(post, true); // true = my post (editable)
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) { console.error(e); }
}

async function loadSavedTours() {
    const container = document.querySelector('#tab-saved-tours .grid'); // Grid контейнер
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
            // Спрощена картка
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
            const html = createPostCardHTML(post, false); // false = not my post (cant edit)
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) { console.error(e); }
}

function initContentTabs() {
    // Делегування подій для кнопок видалення (оскільки елементи динамічні)
    // Реалізуємо глобально або через onclick в HTML
    window.removeSavedTour = async (id) => {
        if(!confirm('Видалити зі збережених?')) return;
        try {
            await fetch(`${API_URL}/tours/save`, {
                method: 'POST', headers: getHeaders(), body: JSON.stringify({ tourId: id })
            });
            loadSavedTours(); // Перезавантажити
        } catch(e) { console.error(e); }
    };
}

function createPostCardHTML(post, isMyPost) {
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
                    <button class="text-[#2D4952] hover:text-[#48192E] flex items-center gap-1"><i class="far fa-edit"></i> Редагувати</button>
                    <button class="text-[#48192E] hover:text-red-600 flex items-center gap-1"><i class="far fa-trash-alt"></i> Видалити</button>
                </div>` : ''}
            </div>
        </div>
    `;
}


/* =========================================
   5. ФОРМИ ТА НАЛАШТУВАННЯ
   ========================================= */
function initSettingsForms() {
    // 1. Форма "Моя інформація" - Кнопка збереження
    const infoTab = document.getElementById('tab-info');
    if (infoTab) {
        const saveBtn = infoTab.querySelector('.btn-burgundy-solid');
        const uploadBtn = infoTab.querySelector('.btn-burgundy-outline');
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        infoTab.appendChild(fileInput);

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const data = getProfileFormData();
                // Для збереження Info нам не обов'язково слати налаштування холодильника,
                // але ендпоінт вимагає все. Зберемо дефолтні або поточні значення.
                // Спрощення: беремо значення зі змінних (треба було б зберігати стан глобально)

                // Швидке рішення: Збираємо з DOM холодильника
                const settingsTab = document.getElementById('tab-fridge-settings');
                const selectedColorEl = settingsTab?.querySelector('.color-option.selected .color-preview');

                const body = {
                    ...data,
                    fridgeColor: selectedColorEl?.style.backgroundColor || '#f3f4f6',
                    fridgeIsPublic: true, // Спрощено
                    fridgeAllowComments: true // Спрощено
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

        // Завантаження аватара
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', async () => {
                if (fileInput.files.length > 0) {
                    const formData = new FormData();
                    formData.append('avatar', fileInput.files[0]);

                    try {
                        const res = await fetch(`${API_URL}/user/avatar`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, // без Content-Type для FormData
                            body: formData
                        });
                        const data = await res.json();
                        if (res.ok) {
                            // Оновити UI
                            const avatarCircle = infoTab.querySelector('.avatar-circle-lg');
                            if (avatarCircle) avatarCircle.innerHTML = `<img src="${data.url}" class="w-full h-full object-cover rounded-full">`;
                        }
                    } catch (e) { console.error(e); }
                }
            });
        }
    }

    // 2. Зміна пароля
    const settingsTab = document.getElementById('tab-settings');
    if (settingsTab) {
        const saveBtn = settingsTab.querySelector('.btn-burgundy-solid');
        const inputs = settingsTab.querySelectorAll('input[type="password"]'); // Current, New, Confirm

        if (saveBtn && inputs.length === 3) {
            saveBtn.addEventListener('click', async () => {
                const currentPassword = inputs[0].value;
                const newPassword = inputs[1].value;
                const confirmPassword = inputs[2].value;

                if (newPassword !== confirmPassword) {
                    alert('Нові паролі не співпадають');
                    return;
                }

                try {
                    const res = await fetch(`${API_URL}/user/password`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({ currentPassword, newPassword })
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

        // 3. Видалення акаунту
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

// Допоміжна функція збору даних з форми "Інфо"
function getProfileFormData() {
    const infoTab = document.getElementById('tab-info');
    const inputs = infoTab.querySelectorAll('input.form-input');
    const textarea = infoTab.querySelector('textarea.form-input');

    const fullName = inputs[0].value.split(' ');

    return {
        firstName: fullName[0] || '',
        lastName: fullName.slice(1).join(' ') || '',
        email: inputs[1].value, // Зазвичай email не міняють тут, але для прикладу
        location: inputs[2].value,
        dateOfBirth: inputs[3].value,
        bio: textarea.value,
        travelInterests: inputs[5].value,
        isEmailPublic: true,
        isLocationPublic: true
    };
}