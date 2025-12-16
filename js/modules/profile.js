import { API_URL, getHeaders } from '../api-config.js';

const currentUser = JSON.parse(localStorage.getItem('user'));
let editingPostId = null;

// === HELPER: Debounce ===
function debounce(func, timeout = 1000) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

const autoSaveFridge = debounce(() => {
    saveFridgeOnlyLayout();
}, 1000);

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    injectPostModal(); // Модалка редагування (Edit)
    initTabs();
    loadUserProfile();
    initFridge();
    initSettingsForms();

    // Глобальні закриття модалок
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-backdrop');
            if(modal) modal.classList.remove('active');
        });
    });
});

/* =========================================
   1. ЛОГІКА ТАБІВ
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

            const targetTab = document.getElementById(`tab-${tabName}`);
            if (targetTab) targetTab.classList.add('active');

            if (tabName === 'my-posts') loadMyPosts();
            if (tabName === 'saved-tours') loadSavedTours();
            if (tabName === 'saved-posts') loadSavedPosts();
            if (tabName === 'saved-companions') loadSavedCompanions();
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
    } catch (error) { console.error(error); }
}

function fillProfileData(data) {
    // Вкладка "Інфо"
    const infoTab = document.getElementById('tab-info');
    if (infoTab) {
        const inputs = infoTab.querySelectorAll('input.form-input');
        const textarea = infoTab.querySelector('textarea.form-input');

        if (inputs[0]) inputs[0].value = `${data.first_name || ''} ${data.last_name || ''}`.trim();
        if (inputs[1]) inputs[1].value = data.email || '';
        if (inputs[2]) inputs[2].value = data.location || '';
        if (inputs[3]) inputs[3].value = data.date_of_birth ? data.date_of_birth.split('T')[0] : '';
        if (inputs[4]) inputs[4].value = data.website || '';
        if (textarea) textarea.value = data.bio || '';
        if (inputs[5]) inputs[5].value = data.travel_interests || '';

        const avatarCircle = infoTab.querySelector('.avatar-circle-lg');
        if (avatarCircle && data.profile_image_url) {
            avatarCircle.innerHTML = `<img src="${data.profile_image_url}" class="w-full h-full object-cover rounded-full">`;
            avatarCircle.classList.remove('bg-[#48192E]', 'text-[#D3CBC4]');
        }

        const statNumbers = infoTab.querySelectorAll('.stat-number');
        if (statNumbers.length >= 4) {
            statNumbers[0].innerText = data.countries_visited || 0;
            statNumbers[1].innerText = data.cities_visited || 0;
            statNumbers[3].innerText = data.followers_count || 0;
        }
    }

    // Налаштування холодильника
    const settingsTab = document.getElementById('tab-fridge-settings');
    if (settingsTab) {
        const colorOptions = settingsTab.querySelectorAll('.color-option');
        colorOptions.forEach(opt => opt.classList.remove('selected'));
        let colorFound = false;
        colorOptions.forEach(opt => {
            const optColor = opt.getAttribute('data-color');
            if (optColor && data.fridge_color && optColor.toLowerCase() === data.fridge_color.toLowerCase()) {
                opt.classList.add('selected');
                colorFound = true;
            }
        });
        if (!colorFound && colorOptions.length > 0) colorOptions[0].classList.add('selected');

        const switches = settingsTab.querySelectorAll('.toggle-switch');
        if (switches[0]) toggleSwitch(switches[0], data.fridge_is_public);
        if (switches[1]) toggleSwitch(switches[1], data.fridge_allow_comments);
        if (switches[2]) toggleSwitch(switches[2], data.fridge_is_public);
    }

    const fridgeDoor = document.getElementById('fridge-door');
    if (fridgeDoor && data.fridge_color) fridgeDoor.style.backgroundColor = data.fridge_color;

    // Загальні налаштування
    const mainSettingsTab = document.getElementById('tab-settings');
    if (mainSettingsTab) {
        const allSwitches = mainSettingsTab.querySelectorAll('.toggle-switch');
        if(allSwitches.length >= 8) {
            toggleSwitch(allSwitches[0], data.notify_email);
            toggleSwitch(allSwitches[1], data.notify_push);
            toggleSwitch(allSwitches[2], data.notify_new_followers);
            toggleSwitch(allSwitches[3], data.notify_comments);
            toggleSwitch(allSwitches[4], data.notify_messages);
            toggleSwitch(allSwitches[5], data.fridge_is_public);
            toggleSwitch(allSwitches[6], data.is_email_public);
            toggleSwitch(allSwitches[7], data.is_location_public);
        }
    }

    if (data.magnet_size) {
        const sizeBtns = document.querySelectorAll('.magnet-size-btn');
        sizeBtns.forEach(btn => {
            btn.classList.remove('bg-[#281822]', 'text-white', 'border-transparent');
            btn.classList.add('border-gray-300', 'text-gray-700');
            if (btn.getAttribute('data-size') === data.magnet_size) {
                btn.classList.remove('border-gray-300', 'text-gray-700');
                btn.classList.add('bg-[#281822]', 'text-white', 'border-transparent');
            }
        });
    }
}

function toggleSwitch(element, isActive) {
    if (!!isActive) element.classList.add('active');
    else element.classList.remove('active');
}

/* =========================================
   3. ЛОГІКА ХОЛОДИЛЬНИКА
   ========================================= */
async function initFridge() {
    const fridgeDoor = document.getElementById('fridge-door');
    const panel = document.querySelector('.magnet-panel-card');

    if (fridgeDoor) initDragAndDrop(fridgeDoor);

    const saveBtn = document.getElementById('save-fridge-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            await saveFridgeOnlyLayout();
            alert('Зміни успішно збережено!');
            saveBtn.disabled = false;
        });
    }

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
            grid.style.justifyItems = 'center';
            panel.appendChild(grid);
        } else {
            grid.innerHTML = '';
        }

        if (data.magnets && data.magnets.length > 0) {
            data.magnets.forEach(m => {
                const el = createMagnetElement(m, false);
                el.style.boxSizing = 'border-box';
                grid.appendChild(el);
            });
        }

        if (!panel.querySelector('.text-gray-500.border-t')) {
            panel.insertAdjacentHTML('beforeend', '<p class="text-sm text-gray-500 mt-6 pt-4 border-t border-gray-100">Перетягніть магніт на холодильник</p>');
        }
    } catch (e) { console.error('Error loading magnets:', e); }

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
        sw.addEventListener('click', () => sw.classList.toggle('active'));
    });
}

function initDragAndDrop(fridgeDoor) {
    let draggedItem = null;
    let isNewItem = false;
    let offset = { x: 0, y: 0 };

    document.addEventListener('dragstart', (e) => {
        const target = e.target.closest('.magnet-btn');
        if (target) {
            isNewItem = true;
            draggedItem = target;
            e.dataTransfer.setData('text/plain', target.getAttribute('data-id') || '');
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
                color_group: draggedItem.getAttribute('data-color'),
                image_url: draggedItem.getAttribute('data-image'),
                shape: draggedItem.getAttribute('data-shape')
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
        const oldMagnets = fridgeDoor.querySelectorAll('.magnet-on-fridge');
        oldMagnets.forEach(m => m.remove());
        const size = data.settings?.magnet_size || 'medium';

        if(data.magnets) {
            data.magnets.forEach(m => {
                const el = createMagnetOnFridgeElement(m, size);
                el.style.left = `${m.x_position}px`;
                el.style.top = `${m.y_position}px`;
                fridgeDoor.appendChild(el);
            });
        }
        checkPlaceholder();
    } catch (e) { console.error(e); }
}

function createMagnetElement(magnetData, isOnFridge, size = 'medium') {
    const div = document.createElement('div');
    div.setAttribute('draggable', 'true');
    const baseClass = isOnFridge ? 'magnet-on-fridge' : 'magnet-btn';
    const shapeClass = magnetData.shape ? `magnet-shape-${magnetData.shape}` : '';
    const extraClasses = magnetData.image_url ? 'relative overflow-hidden' : '';
    const sizeClass = isOnFridge ? `size-${size}` : '';

    div.className = `${baseClass} ${magnetData.color_group || 'burgundy'} ${shapeClass} ${extraClasses} ${sizeClass}`;
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

function createMagnetOnFridgeElement(magnetData, size = 'medium') {
    return createMagnetElement(magnetData, true, size);
}

function checkPlaceholder() {
    const fridgeDoor = document.getElementById('fridge-door');
    const placeholder = document.getElementById('fridge-placeholder');
    if(!fridgeDoor || !placeholder) return;
    const hasMagnets = fridgeDoor.querySelectorAll('.magnet-on-fridge').length > 0;
    if (hasMagnets) placeholder.classList.add('hidden');
    else placeholder.classList.remove('hidden');
}

async function saveFridgeOnlyLayout() {
    const fridgeDoor = document.getElementById('fridge-door');
    if(!fridgeDoor) return;
    const magnetElements = fridgeDoor.querySelectorAll('.magnet-on-fridge');
    const magnetsData = Array.from(magnetElements).map(el => ({
        magnet_id: parseInt(el.getAttribute('data-id')),
        x_position: parseInt(el.style.left) || 0,
        y_position: parseInt(el.style.top) || 0
    })).filter(m => !isNaN(m.magnet_id));

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
   4. КОНТЕНТ (ОНОВЛЕНО: UNIVERSAL CARDS)
   ========================================= */

// --- A. ПОСТИ (Мої та Збережені) ---

async function loadMyPosts() {
    // Тепер беремо саме грід-контейнер
    const container = document.getElementById('my-posts-grid');
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/forum/posts/my`, { headers: getHeaders() });
        const data = await response.json();

        container.innerHTML = ''; // Очищаємо тільки сітку, заголовок залишається

        if (data.posts.length === 0) {
            // col-span-full розтягує повідомлення на всю ширину сітки
            container.insertAdjacentHTML('beforeend', '<p class="text-gray-500 mt-4 col-span-full text-center">У вас немає публікацій.</p>');
            return;
        }

        data.posts.forEach(post => {
            const html = createUniversalPostCard(post, true);
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) { console.error(e); }
}

async function loadSavedPosts() {
    const container = document.getElementById('saved-posts-grid');
    const clearBtn = document.querySelector('#tab-saved-posts button');

    // Логіка кнопки очищення залишається
    if(clearBtn) {
        // Видаляємо старі слухачі (через клонування або перевірку),
        // але найпростіше залишити як є, якщо функція викликається рідко.
        // Для надійності:
        clearBtn.onclick = async () => {
            if(!confirm('Очистити всі збережені пости?')) return;
            await fetch(`${API_URL}/forum/saved`, { method: 'DELETE', headers: getHeaders() });
            loadSavedPosts();
        };
    }

    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/forum/posts/saved`, { headers: getHeaders() });
        const data = await response.json();

        container.innerHTML = '';

        if (data.posts.length === 0) {
            container.insertAdjacentHTML('beforeend', '<p class="text-gray-500 mt-4 col-span-full text-center">Збережених постів немає.</p>');
            return;
        }

        data.posts.forEach(post => {
            const html = createUniversalPostCard(post, false);
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) { console.error(e); }
}

// Універсальна картка Поста (як на Форумі)
function createUniversalPostCard(post, isMyPost) {
    // Аватар
    let avatarContent = post.author_avatar
        ? `<img src="${post.author_avatar}" class="w-full h-full object-cover">`
        : `<div class="w-full h-full flex items-center justify-center font-bold text-white text-sm">${(post.first_name?.[0]||'') + (post.last_name?.[0]||'')}</div>`;

    // Фото
    let imageSection = '';
    if (post.images && post.images.length > 0) {
        imageSection = `
            <div class="card-image-middle h-48 relative overflow-hidden bg-gray-100">
                <img src="${post.images[0]}" class="w-full h-full object-cover">
                <span class="card-badge">${post.category || 'Загальне'}</span>
            </div>
        `;
    } else {
        imageSection = `
             <div class="card-image-middle h-24 bg-gradient-to-r from-gray-100 to-gray-200 relative overflow-hidden flex items-center justify-center">
                <span class="card-badge relative top-auto right-auto m-0 opacity-80">${post.category || 'Загальне'}</span>
            </div>
        `;
    }

    // Дії (Footer)
    let footerActions = '';
    if (isMyPost) {
        const safeTitle = post.title.replace(/'/g, "\\'");
        const safeContent = post.content.replace(/'/g, "\\'");
        footerActions = `
            <button class="btn-icon-square text-red-500 hover:bg-red-50 hover:border-red-200" onclick="deletePost(${post.post_id})" title="Видалити">
                <i class="far fa-trash-alt"></i>
            </button>
            <button class="btn-action-outline h-10" onclick="openEditPostModal(${post.post_id}, '${safeTitle}', '${safeContent}', '${post.category}')">
                Редагувати
            </button>
            <button class="btn-action-solid h-10" onclick="openPostDetails(${post.post_id})">
                Деталі
            </button>
        `;
    } else {
        footerActions = `
            <button onclick="toggleSavePost(${post.post_id}, this)" class="btn-icon-square active text-[#48192E] border-[#48192E]" title="Видалити зі збережених">
                <i class="fas fa-bookmark"></i>
            </button>
            <button class="btn-action-solid h-10" onclick="openPostDetails(${post.post_id})">
                Читати
            </button>
        `;
    }

    return `
        <div class="universal-card"> 
            <div class="card-header-user">
                <div class="card-avatar" style="background-color: #281822;">${avatarContent}</div>
                <div class="card-user-info">
                    <div class="card-user-name">${post.first_name} ${post.last_name}</div>
                    <div class="card-user-sub">${new Date(post.created_at).toLocaleDateString()}</div>
                </div>
            </div>
            ${imageSection}
            <div class="card-body">
                <h3 class="card-title line-clamp-2">${post.title}</h3>
                <p class="text-gray-600 text-sm line-clamp-3">${post.content}</p>
            </div>
            <div class="card-footer gap-2">
                <div class="flex gap-4 text-gray-500 text-sm mr-auto">
                    <span class="flex items-center gap-1"><i class="far fa-thumbs-up"></i> ${post.likes_count}</span>
                    <span class="flex items-center gap-1"><i class="far fa-comment-alt"></i> ${post.comments_count || 0}</span>
                </div>
                ${footerActions}
            </div>
        </div>
    `;
}

// --- B. ТУРИ (Збережені) ---

async function loadSavedTours() {
    const container = document.querySelector('#tab-saved-tours .grid');
    const clearBtn = document.querySelector('#tab-saved-tours button');

    if(clearBtn) clearBtn.onclick = async () => {
        if(!confirm('Очистити всі тури?')) return;
        await fetch(`${API_URL}/tours/saved`, { method: 'DELETE', headers: getHeaders() });
        loadSavedTours();
    };

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
            const html = createUniversalTourCard(tour);
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) { console.error(e); }
}

function createUniversalTourCard(tour) {
    const image = tour.image_url || 'https://via.placeholder.com/400x300';
    let dateText = `${tour.duration_days} днів`;
    if (tour.available_dates && typeof tour.available_dates === 'object' && tour.available_dates.length > 0) {
        const nextDate = new Date(tour.available_dates[0]).toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'});
        dateText += ` • з ${nextDate}`;
    }

    return `
        <div class="universal-card cursor-pointer group" onclick="openTourDetails(${tour.tour_id})">
            <div class="card-header-user">
                <div class="card-avatar" style="background-color: #281822;"><i class="fas fa-briefcase"></i></div>
                <div class="card-user-info">
                    <div class="card-user-name">${tour.agency_name || 'Агенція'}</div>
                    <div class="card-user-sub text-[#2D4952]"><i class="fas fa-map-marker-alt mr-1"></i> ${tour.location}</div>
                </div>
            </div>
            <div class="card-image-middle h-56 bg-gray-50 relative overflow-hidden">
                <img src="${image}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105">
                <span class="card-badge">${tour.category_name || 'Тур'}</span>
            </div>
            <div class="card-body">
                <h3 class="card-title line-clamp-2">${tour.title}</h3>
                <div class="space-y-1 mb-2 bg-gray-50 p-2 rounded text-sm text-gray-700">
                    <div class="flex items-center gap-2"><i class="far fa-calendar-alt text-[#2D4952]"></i> ${dateText}</div>
                    <div class="flex items-center gap-2"><i class="fas fa-star text-yellow-500"></i> ${tour.rating || 'New'}</div>
                </div>
            </div>
            <div class="card-footer gap-2">
                <div class="font-bold text-xl text-[#281822] mr-auto">${parseInt(tour.price_uah)} ₴</div>
                <button onclick="event.stopPropagation(); removeSavedTour(${tour.tour_id})" class="btn-icon-square active text-[#48192E] border-[#48192E]" title="Видалити"><i class="fas fa-bookmark"></i></button>
                <button onclick="event.stopPropagation(); openTourDetails(${tour.tour_id})" class="btn-action-solid h-10">Деталі</button>
            </div>
        </div>
    `;
}

// --- C. ОГОЛОШЕННЯ (Збережені) ---

async function loadSavedCompanions() {
    const container = document.getElementById('saved-companions-grid');
    const clearBtn = document.querySelector('#tab-saved-companions button');
    if(clearBtn) clearBtn.onclick = window.clearSavedCompanions;

    try {
        const response = await fetch(`${API_URL}/companion/saved`, { headers: getHeaders() });
        const data = await response.json();

        container.innerHTML = '';
        if (!data.ads || data.ads.length === 0) {
            container.innerHTML = '<p class="text-gray-500 col-span-2">Збережених оголошень немає.</p>';
            return;
        }

        data.ads.forEach(ad => {
            const html = createUniversalCompanionCard(ad);
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) { console.error(e); }
}

function createUniversalCompanionCard(ad) {
    const start = new Date(ad.start_date).toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'});
    const end = new Date(ad.end_date).toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'});
    const image = (ad.images && ad.images[0]) ? ad.images[0] : 'https://via.placeholder.com/400x200';

    let avatarContent = ad.author_avatar
        ? `<img src="${ad.author_avatar}" class="w-full h-full object-cover">`
        : (ad.first_name?.[0] || 'U');

    return `
        <div class="universal-card cursor-pointer group" onclick="openAdDetails(${ad.ad_id})">
            <div class="card-header-user">
                <div class="card-avatar" style="background-color: #2D4952;">${avatarContent}</div>
                <div class="card-user-info">
                    <div class="card-user-name">${ad.first_name} ${ad.last_name}</div>
                    <div class="text-[#48192E] font-semibold text-sm"><i class="fas fa-map-marker-alt mr-1"></i> ${ad.destination_country}</div>
                </div>
            </div>
            <div class="card-image-middle h-48 bg-gray-50 relative overflow-hidden">
                <img src="${image}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105">
            </div>
            <div class="card-body">
                <p class="text-gray-600 text-sm mb-3 line-clamp-3">${ad.description}</p>
                <div class="bg-gray-50 p-2 rounded text-sm text-gray-700 space-y-1">
                    <div class="flex items-center gap-2"><i class="far fa-calendar text-[#2D4952]"></i> ${start} - ${end}</div>
                    <div class="flex items-center gap-2"><i class="fas fa-wallet text-[#2D4952]"></i> ${ad.budget_min || 0} - ${ad.budget_max || '...'} грн</div>
                </div>
            </div>
            <div class="card-footer gap-2">
                <div class="mr-auto"></div>
                <button onclick="event.stopPropagation(); removeSavedAd(${ad.ad_id})" class="btn-icon-square active text-[#48192E] border-[#48192E]"><i class="fas fa-bookmark"></i></button>
                <button onclick="event.stopPropagation(); openAdDetails(${ad.ad_id})" class="btn-action-outline h-10">Деталі</button>
                <button onclick="event.stopPropagation(); window.location.href='chat.html?user_id=${ad.user_id}'" class="btn-action-solid h-10">Написати</button>
            </div>
        </div>
    `;
}

/* =========================================
   5. ФУНКЦІОНАЛ ДІЙ (Details, Save, Delete)
   ========================================= */

// --- TOURS ---
window.removeSavedTour = async (id) => {
    if(!confirm('Видалити зі збережених?')) return;
    try {
        await fetch(`${API_URL}/tours/${id}/save`, { method: 'DELETE', headers: getHeaders() });
        loadSavedTours();
    } catch(e) { console.error(e); }
};

window.openTourDetails = async (id) => {
    const modal = document.getElementById('tour-details-modal');
    modal.classList.add('active');

    // Заповнення модалки
    try {
        const res = await fetch(`${API_URL}/tours/${id}`);
        const data = await res.json();
        const tour = data.tour;

        document.getElementById('modal-tour-title').innerText = tour.title;
        document.getElementById('modal-tour-desc').innerText = tour.description;
        document.getElementById('modal-tour-price').innerText = `${parseInt(tour.price_uah)} ₴`;
        document.getElementById('modal-tour-image').src = tour.image_url || 'https://via.placeholder.com/600';
        document.getElementById('modal-tour-loc').innerText = tour.location;
        document.getElementById('modal-tour-duration').innerText = tour.duration_days + ' днів';
        document.getElementById('modal-tour-rating').innerText = tour.rating || '0.0';

        const programEl = document.getElementById('modal-tour-program');
        if (tour.program) {
            programEl.innerText = tour.program;
            programEl.classList.remove('italic', 'text-gray-400');
        } else {
            programEl.innerText = 'Детальна програма уточнюється в організатора.';
            programEl.classList.add('italic', 'text-gray-400');
        }

        const datesEl = document.getElementById('modal-tour-dates');
        if (tour.available_dates && tour.available_dates.length > 0) {
            datesEl.innerHTML = tour.available_dates.map(dateStr => {
                const formatted = new Date(dateStr).toLocaleDateString('uk-UA', {day: 'numeric', month: 'long', year: 'numeric'});
                return `<span class="bg-[#F3F4F6] text-[#281822] border border-gray-200 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2"><i class="far fa-calendar-check text-[#48192E]"></i> ${formatted}</span>`;
            }).join('');
        } else {
            datesEl.innerHTML = '<span class="text-gray-500 text-sm italic">Дати уточнюються менеджером</span>';
        }

        const galleryEl = document.getElementById('modal-tour-gallery');
        galleryEl.innerHTML = '';
        if (tour.images && tour.images.length > 0) {
            tour.images.forEach(imgUrl => {
                const thumb = document.createElement('img');
                thumb.src = imgUrl;
                thumb.className = "w-full h-16 object-cover rounded cursor-pointer hover:opacity-80 transition border border-transparent hover:border-[#48192E]";
                thumb.onclick = () => { document.getElementById('modal-tour-image').src = imgUrl; };
                galleryEl.appendChild(thumb);
            });
        }

        // Завантаження коментарів (без форми для збережених, лише перегляд)
        const list = document.getElementById('tour-comments-list');
        const commRes = await fetch(`${API_URL}/tours/${id}/comments`);
        const commData = await commRes.json();
        list.innerHTML = '';
        if (!commData.comments || commData.comments.length === 0) {
            list.innerHTML = '<p class="text-gray-400 text-sm italic">Поки немає відгуків.</p>';
        } else {
            commData.comments.forEach(c => {
                const avatarHtml = c.author_avatar ? `<img src="${c.author_avatar}" class="w-8 h-8 rounded-full object-cover">` : `<div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">${c.first_name[0]}</div>`;
                const html = `
                    <div class="flex gap-3 items-start border-b border-gray-100 pb-3 last:border-0">
                        ${avatarHtml}
                        <div>
                            <div class="flex items-baseline gap-2"><span class="font-bold text-sm text-[#281822]">${c.first_name} ${c.last_name}</span><span class="text-xs text-gray-400">${new Date(c.created_at).toLocaleDateString()}</span></div>
                            <p class="text-gray-700 text-sm mt-1">${c.content}</p>
                        </div>
                    </div>`;
                list.insertAdjacentHTML('beforeend', html);
            });
        }

    } catch(e) { console.error(e); }
};

// --- COMPANIONS ---
window.removeSavedAd = async (id) => {
    if(!confirm('Видалити?')) return;
    try {
        await fetch(`${API_URL}/companion/ads/${id}/save`, { method: 'DELETE', headers: getHeaders() });
        loadSavedCompanions();
    } catch(e) { console.error(e); }
};

window.clearSavedCompanions = async () => {
    if(!confirm('Очистити всі?')) return;
    try {
        await fetch(`${API_URL}/companion/saved`, { method: 'DELETE', headers: getHeaders() });
        loadSavedCompanions();
    } catch(e) { console.error(e); }
};

window.openAdDetails = async (id) => {
    const modal = document.getElementById('ad-details-modal');
    modal.classList.add('active');
    try {
        const res = await fetch(`${API_URL}/companion/ads/${id}`, { headers: getHeaders() });
        const data = await res.json();
        const ad = data.ad;

        document.getElementById('modal-ad-country').innerText = ad.destination_country;
        document.getElementById('modal-ad-desc').innerText = ad.description;
        document.getElementById('modal-author-name-link').innerText = ad.first_name + ' ' + ad.last_name;
        document.getElementById('modal-author-age').innerText = ad.author_age ? `${ad.author_age} років` : 'Вік приховано';

        const start = new Date(ad.start_date).toLocaleDateString('uk-UA');
        const end = new Date(ad.end_date).toLocaleDateString('uk-UA');
        document.getElementById('modal-ad-dates').innerText = `${start} — ${end}`;
        document.getElementById('modal-ad-budget').innerText = `${ad.budget_min||0} - ${ad.budget_max||'..'} грн`;
        document.getElementById('modal-ad-group').innerText = `${ad.min_group_size}-${ad.max_group_size} осіб`;

        const tagsContainer = document.getElementById('modal-ad-tags');
        tagsContainer.innerHTML = (ad.tags || []).map(t => `<span class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">${t}</span>`).join('');

        const mainImg = document.getElementById('modal-ad-main-image');
        const gallery = document.getElementById('modal-ad-gallery');
        gallery.innerHTML = '';

        if (ad.images && ad.images.length > 0) {
            mainImg.src = ad.images[0];
            mainImg.classList.remove('hidden');
            if (ad.images.length > 1) {
                ad.images.forEach(imgUrl => {
                    const thumb = document.createElement('img');
                    thumb.src = imgUrl;
                    thumb.className = "w-full h-16 object-cover rounded cursor-pointer hover:opacity-80 transition border border-transparent hover:border-[#48192E]";
                    thumb.onclick = () => { mainImg.src = imgUrl; };
                    gallery.appendChild(thumb);
                });
            }
        }

    } catch(e) { console.error(e); }
};

// --- POSTS ---
// Видалити МІЙ пост
window.deletePost = async (id) => {
    if(!confirm('Видалити пост?')) return;
    try {
        await fetch(`${API_URL}/forum/posts/${id}`, { method: 'DELETE', headers: getHeaders() });
        loadMyPosts();
    } catch(e) { console.error(e); }
};

// Видалити ЗБЕРЕЖЕНИЙ пост (toggleSavePost для кнопки в картці)
window.toggleSavePost = async (id, btn) => {
    if(!confirm('Видалити зі збережених?')) return;
    try {
        // Тут ми тільки видаляємо, бо це вкладка збережених
        await fetch(`${API_URL}/forum/saved/${id}`, { method: 'DELETE', headers: getHeaders() });
        loadSavedPosts();
    } catch(e) { console.error(e); }
};

window.openPostDetails = async (id) => {
    const modal = document.getElementById('post-details-modal');
    modal.classList.add('active');
    try {
        const res = await fetch(`${API_URL}/forum/posts/${id}`);
        const data = await res.json();
        const post = data.post;

        document.getElementById('detail-post-title').innerText = post.title;
        document.getElementById('detail-post-content').innerText = post.content;
        document.getElementById('detail-post-author').innerText = post.first_name + ' ' + post.last_name;
        document.getElementById('detail-post-date').innerText = new Date(post.created_at).toLocaleDateString();
        document.getElementById('detail-post-category').innerText = post.category;

        const mainImg = document.getElementById('detail-post-main-image');
        const gallery = document.getElementById('detail-post-gallery');
        gallery.innerHTML = '';

        if (post.images && post.images.length > 0) {
            mainImg.src = post.images[0];
            mainImg.classList.remove('hidden');
            if (post.images.length > 1) {
                post.images.forEach(imgUrl => {
                    const thumb = document.createElement('img');
                    thumb.src = imgUrl;
                    thumb.className = "w-full h-16 object-cover rounded cursor-pointer hover:opacity-80 transition border border-transparent hover:border-[#48192E]";
                    thumb.onclick = () => { mainImg.src = imgUrl; };
                    gallery.appendChild(thumb);
                });
            }
        } else {
            mainImg.classList.add('hidden');
        }

        // Коментарі
        const list = document.getElementById('detail-comments-list');
        const commRes = await fetch(`${API_URL}/forum/posts/${id}/comments`);
        const commData = await commRes.json();
        list.innerHTML = '';
        document.getElementById('detail-comments-count').innerText = commData.comments.length;

        if(commData.comments) {
            commData.comments.forEach(c => {
                const avatarHtml = c.author_avatar ? `<img src="${c.author_avatar}" class="w-8 h-8 rounded-full object-cover">` : `<div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">${c.first_name[0]}</div>`;
                const html = `
                    <div class="flex gap-3 items-start">
                        ${avatarHtml}
                        <div class="bg-white p-3 rounded-lg border border-gray-100 flex-grow shadow-sm">
                            <div class="flex justify-between items-baseline mb-1"><span class="font-bold text-sm text-[#281822]">${c.first_name} ${c.last_name}</span><span class="text-xs text-gray-400">${new Date(c.created_at).toLocaleDateString()}</span></div>
                            <p class="text-gray-700 text-sm leading-relaxed">${c.content}</p>
                        </div>
                    </div>`;
                list.insertAdjacentHTML('beforeend', html);
            });
        }

    } catch(e) { console.error(e); }
};

function injectPostModal() {
    const modalHTML = `
        <div id="post-modal" class="modal-backdrop">
            <div class="modal-content max-w-lg">
                <div class="modal-header">
                    <h3 class="text-xl font-bold" id="post-modal-title">Редагувати</h3>
                    <button class="modal-close-btn" onclick="document.getElementById('post-modal').classList.remove('active')">&times;</button>
                </div>
                <div class="modal-body space-y-4">
                    <input type="text" id="post-title" class="w-full border p-2 rounded">
                    <textarea id="post-content" rows="5" class="w-full border p-2 rounded"></textarea>
                    <select id="post-category" class="w-full border p-2 rounded"><option>Загальна</option><option>Поради</option><option>Маршрути</option></select>
                    <button id="save-post-btn" class="btn-solid w-full">Зберегти</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('save-post-btn').onclick = savePost;
}

window.openEditPostModal = (id, title, content, category) => {
    editingPostId = id;
    document.getElementById('post-modal-title').innerText = 'Редагувати пост';
    document.getElementById('post-title').value = title;
    document.getElementById('post-content').value = content;
    document.getElementById('post-category').value = category || 'Загальна';
    document.getElementById('post-modal').classList.add('active');
};

async function savePost() {
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    const category = document.getElementById('post-category').value;

    await fetch(`${API_URL}/forum/posts/${editingPostId}`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({title, content, category})
    });
    document.getElementById('post-modal').classList.remove('active');
    loadMyPosts();
}

function initSettingsForms() {
    const infoSaveBtn = document.querySelector('#tab-info .btn-burgundy-solid');
    if(infoSaveBtn) infoSaveBtn.onclick = saveFullProfile;

    const fridgeSaveBtn = document.querySelector('#tab-fridge-settings .btn-burgundy-solid');
    if(fridgeSaveBtn) fridgeSaveBtn.onclick = saveFullProfile;

    const settingsTab = document.getElementById('tab-settings');
    if (settingsTab) {
        const saveAllBtn = settingsTab.querySelectorAll('.btn-burgundy-solid')[1];
        if (saveAllBtn) saveAllBtn.onclick = saveFullProfile;
    }
}

async function saveFullProfile() {
    const body = collectAllProfileData();
    try {
        const res = await fetch(`${API_URL}/user/profile`, {
            method: 'PUT', headers: getHeaders(), body: JSON.stringify(body)
        });
        await saveFridgeOnlyLayout();
        if(res.ok) alert('Зміни успішно збережено!');
    } catch(e) { console.error(e); }
}

function collectAllProfileData() {
    const infoTab = document.getElementById('tab-info');
    const inputs = infoTab.querySelectorAll('input.form-input');
    const textarea = infoTab.querySelector('textarea.form-input');
    const fullName = inputs[0].value.split(' ');

    const fSettingsTab = document.getElementById('tab-fridge-settings');
    const selectedOption = fSettingsTab?.querySelector('.color-option.selected');
    const fSwitches = fSettingsTab?.querySelectorAll('.toggle-switch');

    const activeSizeBtn = document.querySelector('.magnet-size-btn.bg-\\[\\#281822\\]');

    const gSettingsTab = document.getElementById('tab-settings');
    const gSwitches = gSettingsTab?.querySelectorAll('.toggle-switch');

    return {
        firstName: fullName[0] || '',
        lastName: fullName.slice(1).join(' ') || '',
        email: inputs[1].value,
        location: inputs[2].value,
        dateOfBirth: inputs[3].value,
        website: inputs[4].value,
        bio: textarea.value,
        travelInterests: inputs[5].value,
        fridgeColor: selectedOption?.getAttribute('data-color') || '#f3f4f6',
        magnetSize: activeSizeBtn ? activeSizeBtn.getAttribute('data-size') : 'medium',
        fridgeIsPublic: fSwitches?.[0]?.classList.contains('active') ?? true,
        fridgeAllowComments: fSwitches?.[1]?.classList.contains('active') ?? true,
        notifyEmail: gSwitches?.[0]?.classList.contains('active') ?? true,
        notifyPush: gSwitches?.[1]?.classList.contains('active') ?? true,
        notifyNewFollowers: gSwitches?.[2]?.classList.contains('active') ?? true,
        notifyComments: gSwitches?.[3]?.classList.contains('active') ?? true,
        notifyMessages: gSwitches?.[4]?.classList.contains('active') ?? true,
        isEmailPublic: gSwitches?.[6]?.classList.contains('active') ?? false,
        isLocationPublic: gSwitches?.[7]?.classList.contains('active') ?? true
    };
}

