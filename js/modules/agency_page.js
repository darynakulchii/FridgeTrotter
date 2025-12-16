import { API_URL, getHeaders } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {
    initAgencyTabs();
    loadAgencyInfo();     // Завантаження профілю
    initLogoUpload();     // Логіка завантаження лого
    initSaveSettingsButton(); // Логіка збереження текстових даних
});

// ---- Перемикання вкладок ----
function initAgencyTabs() {
    const pills = document.querySelectorAll('.nav-pill');
    const tabs = document.querySelectorAll('.tab-content');

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));

            pill.classList.add('active');
            const tabId = `tab-${pill.dataset.tab}`;
            const targetTab = document.getElementById(tabId);
            if (targetTab) {
                targetTab.classList.add('active');
            }

            if (pill.dataset.tab === 'agency-bookings') loadAgencyBookings();
            if (pill.dataset.tab === 'agency-tours') loadAgencyTours();
            if (pill.dataset.tab === 'agency-posts') loadAgencyPosts();
        });
    });
}

// =========================================================
// 1. ЗАВАНТАЖЕННЯ ДАНИХ АГЕНЦІЇ
// =========================================================
async function loadAgencyInfo() {
    try {
        const response = await fetch(`${API_URL}/agencies/me`, {
            headers: getHeaders()
        });

        if (!response.ok) throw new Error('Не вдалося завантажити профіль');

        const agency = await response.json();
        const currentUser = JSON.parse(localStorage.getItem('user'));

        // 1. Заповнюємо шапку профілю
        document.getElementById('agency-name-display').innerText = agency.name;
        document.getElementById('agency-description-display').innerText = agency.description || 'Опис ще не додано. Перейдіть у налаштування, щоб додати інформацію.';

        // Контакти
        document.getElementById('text-phone').innerText = agency.phone || '—';
        document.getElementById('link-phone').href = `tel:${agency.phone}`;

        document.getElementById('text-email').innerText = agency.email || '—';
        document.getElementById('link-email').href = `mailto:${agency.email}`;

        document.getElementById('text-website').innerText = agency.website || '—';
        document.getElementById('link-website').href = agency.website || '#';

        // Статистика (оновлені ID)
        document.getElementById('stat-tours').innerText = agency.total_tours_count || 0;
        document.getElementById('stat-rating').innerText = agency.avg_rating || '0.0';

        // Логотип
        const logoImg = document.getElementById('agency-logo');
        const logoPlaceholder = document.getElementById('agency-logo-placeholder');

        if (agency.logo_url) {
            logoImg.src = agency.logo_url;
            logoImg.classList.remove('hidden');
            logoPlaceholder.classList.add('hidden');
        } else {
            logoImg.classList.add('hidden');
            logoPlaceholder.classList.remove('hidden');
        }

        // 2. Заповнюємо поля редагування
        const editName = document.getElementById('edit-name');
        const editPhone = document.getElementById('edit-phone');
        const editEmail = document.getElementById('edit-email');
        const editWebsite = document.getElementById('edit-website');
        const editDesc = document.getElementById('edit-description');

        if(editName) editName.value = agency.name || '';
        if(editPhone) editPhone.value = agency.phone || '';
        if(editEmail) editEmail.value = agency.email || '';
        if(editWebsite) editWebsite.value = agency.website || '';
        if(editDesc) editDesc.value = agency.description || '';

        checkOwnerAccess(currentUser);

        // Завантажуємо контент
        loadAgencyTours();
        loadAgencyPosts();

    } catch (e) {
        console.error("Помилка завантаження даних агенції", e);
    }
}

function checkOwnerAccess(user) {
    if (!user || !user.isAgent) return;
    const ownerElements = document.querySelectorAll('.owner-only');
    ownerElements.forEach(el => {
        el.classList.remove('owner-only');
        if(el.tagName === 'BUTTON') el.style.display = 'flex'; // Для кнопок у флексі
    });
}

// =========================================================
// 2. ЗАВАНТАЖЕННЯ ЛОГОТИПУ
// =========================================================
function initLogoUpload() {
    const logoInput = document.getElementById('logo-input');
    const logoImg = document.getElementById('agency-logo');
    const logoPlaceholder = document.getElementById('agency-logo-placeholder');

    if (!logoInput) return;

    logoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            logoImg.src = event.target.result;
            logoImg.classList.remove('hidden');
            logoPlaceholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const response = await fetch(`${API_URL}/user/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (!response.ok) throw new Error('Помилка завантаження');
            console.log('Логотип збережено');
        } catch (error) {
            console.error(error);
            alert('Не вдалося зберегти логотип.');
        }
    });
}

// =========================================================
// 3. ЗБЕРЕЖЕННЯ НАЛАШТУВАНЬ
// =========================================================
function initSaveSettingsButton() {
    const form = document.getElementById('agency-settings-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-settings-btn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'Збереження...';

        const data = {
            name: document.getElementById('edit-name').value,
            phone: document.getElementById('edit-phone').value,
            email: document.getElementById('edit-email').value,
            website: document.getElementById('edit-website').value,
            description: document.getElementById('edit-description').value
        };

        try {
            const response = await fetch(`${API_URL}/agencies/me`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Помилка збереження');
            }

            alert('Профіль успішно оновлено!');
            loadAgencyInfo();

        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });
}

// =========================================================
// 4. ТУРИ (ПОВНИЙ ВИГЛЯД)
// =========================================================
async function loadAgencyTours() {
    const container = document.getElementById('agency-tours-grid');
    if(!container) return;

    try {
        const res = await fetch(`${API_URL}/agencies/me/tours`, { headers: getHeaders() });
        const data = await res.json();

        container.innerHTML = '';
        if(!data.tours || data.tours.length === 0) {
            container.innerHTML = '<p class="text-gray-500 py-4 col-span-2 text-center">Ви ще не додали турів.</p>';
            return;
        }

        data.tours.forEach(tour => {
            const html = createFullTourCard(tour);
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch(e) { console.error(e); }
}

// Функція для створення повної картки туру (ідентична до tours.js, але кнопки адаптовані)
function createFullTourCard(tour) {
    const image = tour.image_url || 'https://via.placeholder.com/400x300?text=No+Image';
    let dateText = `${tour.duration_days} днів`;

    if (tour.available_dates && typeof tour.available_dates === 'object' && tour.available_dates.length > 0) {
        // Якщо це масив (Postgres array)
        const nextDate = new Date(tour.available_dates[0]).toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'});
        dateText += ` • з ${nextDate}`;
    }

    return `
        <div class="universal-card cursor-pointer group flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            
            <div class="card-image-middle h-56 bg-gray-50 relative overflow-hidden">
                <img src="${image}" alt="${tour.title}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105">
                <span class="card-badge absolute top-3 right-3 bg-[#281822] text-[#D3CBC4] px-2 py-1 rounded text-xs font-bold uppercase">${tour.category_name || 'Тур'}</span>
            </div>

            <div class="card-body flex flex-col p-5 flex-grow">
                <h3 class="card-title text-lg font-bold text-[#281822] mb-2 line-clamp-2 hover:text-[#48192E] transition">${tour.title}</h3>
                
                <div class="text-sm text-[#2D4952] font-medium mb-3 flex items-center gap-2">
                    <i class="fas fa-map-marker-alt"></i> ${tour.location}
                </div>

                <div class="space-y-2 mb-4 bg-gray-50 p-3 rounded-lg mt-auto">
                    <div class="flex items-center gap-3 text-sm text-gray-700">
                        <i class="far fa-calendar-alt text-[#2D4952] w-5 text-center"></i>
                        <span>${dateText}</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm text-gray-700">
                        <i class="fas fa-star text-yellow-500 w-5 text-center"></i>
                        <span class="font-bold">${tour.rating || 'New'}</span>
                    </div>
                </div>
            </div>

            <div class="card-footer px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-white mt-0">
                <div class="font-bold text-xl text-[#281822]">
                    ${parseInt(tour.price_uah).toLocaleString()} ₴
                </div>
                
                <div class="flex gap-2">
                    <button class="btn-outline px-4 text-sm h-10 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition" onclick="alert('Редагування туру буде доступне скоро')">
                        <i class="far fa-edit"></i>
                    </button>
                    <button class="btn-fill px-4 text-sm h-10 bg-[#48192E] text-white rounded-lg hover:bg-[#281822] transition flex items-center gap-2" onclick="openTourDetails(${tour.tour_id})">
                        Перегляд
                    </button>
                </div>
            </div>
        </div>
    `;
}

// =========================================================
// 5. ПОСТИ (ПОВНИЙ ВИГЛЯД)
// =========================================================
async function loadAgencyPosts() {
    const container = document.getElementById('agency-posts-list');
    if(!container) return;

    try {
        const res = await fetch(`${API_URL}/forum/posts/my`, { headers: getHeaders() });
        const data = await res.json();

        container.innerHTML = '';
        if(!data.posts || data.posts.length === 0) {
            container.innerHTML = '<p class="text-gray-500 py-4 col-span-2 text-center">Немає постів.</p>';
            return;
        }

        data.posts.forEach(post => {
            const html = createFullPostCard(post);
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch(e) { console.error(e); }
}

function createFullPostCard(post) {
    let imageSection = '';
    if (post.images && post.images.length > 0) {
        imageSection = `
            <div class="h-48 relative overflow-hidden bg-gray-100 border-b border-gray-100">
                <img src="${post.images[0]}" alt="${post.title}" class="w-full h-full object-cover">
                <span class="absolute top-3 right-3 bg-white/90 backdrop-blur text-xs px-2 py-1 rounded text-gray-700 font-medium">${post.category || 'Блог'}</span>
            </div>
        `;
    }

    return `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
            ${imageSection}
            
            <div class="p-5 flex flex-col flex-grow">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-lg text-[#281822] line-clamp-2">${post.title}</h3>
                </div>
                
                <p class="text-gray-600 text-sm line-clamp-3 mb-4 flex-grow">${post.content}</p>
                
                <div class="flex items-center justify-between text-gray-500 text-sm border-t border-gray-100 pt-3 mt-auto">
                    <span class="text-xs text-gray-400">${new Date(post.created_at).toLocaleDateString()}</span>
                    <div class="flex gap-4">
                        <span class="flex items-center gap-1"><i class="far fa-thumbs-up"></i> ${post.likes_count}</span>
                        <span class="flex items-center gap-1"><i class="far fa-comment-alt"></i> ${post.comments_count || 0}</span>
                    </div>
                </div>
                
                <div class="flex gap-2 mt-4 pt-2">
                     <button class="flex-1 py-2 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition" onclick="deletePost(${post.post_id})">Видалити</button>
                     <button class="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition" onclick="openEditPostModal(${post.post_id}, '${post.title.replace(/'/g, "\\'")}', '${post.content.replace(/'/g, "\\'")}', '${post.category}')">Редагувати</button>
                </div>
            </div>
        </div>
    `;
}

// =========================================================
// 6. БРОНЮВАННЯ (Збережено попередню логіку)
// =========================================================
async function loadAgencyBookings() {
    const container = document.getElementById('bookings-list');
    if (!container) return;

    container.innerHTML = '<p class="text-center text-gray-500 py-8"><i class="fas fa-spinner fa-spin"></i> Завантаження заявок...</p>';

    try {
        const response = await fetch(`${API_URL}/agencies/bookings`, { headers: getHeaders() });
        const data = await response.json();

        container.innerHTML = '';

        if (!data.bookings || data.bookings.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Активних заявок немає.</p>';
            return;
        }

        data.bookings.forEach(booking => {
            const dateDisplay = booking.selected_date
                ? new Date(booking.selected_date).toLocaleDateString('uk-UA')
                : 'Дата не обрана';

            let selectClass = "appearance-none font-bold text-xs py-1.5 px-3 pr-8 rounded-lg border-2 cursor-pointer transition-all outline-none focus:ring-2 focus:ring-offset-1";
            let arrowColor = "";

            if (booking.status === 'confirmed') {
                selectClass += " bg-[#2D4952]/10 text-[#2D4952] border-[#2D4952] focus:ring-[#2D4952]";
                arrowColor = "text-[#2D4952]";
            } else if (booking.status === 'rejected') {
                selectClass += " bg-red-50 text-red-600 border-red-200 focus:ring-red-500";
                arrowColor = "text-red-600";
            } else {
                selectClass += " bg-yellow-50 text-yellow-700 border-yellow-300 focus:ring-yellow-400";
                arrowColor = "text-yellow-700";
            }

            const html = `
                <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-200">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div class="flex-grow">
                            <div class="flex items-center gap-2 mb-1">
                                <h4 class="font-bold text-[#281822] text-lg hover:text-[#48192E] transition">${booking.tour_title}</h4>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
                                <p><i class="far fa-user w-5 text-center text-[#2D4952]"></i> ${booking.first_name} ${booking.last_name}</p>
                                <p><i class="fas fa-phone w-5 text-center text-[#2D4952]"></i> <a href="tel:${booking.contact_phone}" class="hover:underline">${booking.contact_phone}</a></p>
                                <p><i class="far fa-envelope w-5 text-center text-[#2D4952]"></i> ${booking.email}</p>
                                <p><i class="far fa-calendar-alt w-5 text-center text-[#2D4952]"></i> <strong>${dateDisplay}</strong> (${booking.participants_count} осіб)</p>
                            </div>
                        </div>
                        <div class="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-4 md:gap-2 border-t md:border-t-0 border-gray-100 pt-3 md:pt-0 mt-2 md:mt-0">
                            <span class="text-xs text-gray-400 font-medium"><i class="far fa-clock mr-1"></i>${new Date(booking.booking_date).toLocaleDateString()}</span>
                            <div class="relative inline-block">
                                <select onchange="changeBookingStatus(${booking.booking_id}, this.value)" class="${selectClass}">
                                    <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>⏳ Очікує</option>
                                    <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>✅ Підтверджено</option>
                                    <option value="rejected" ${booking.status === 'rejected' ? 'selected' : ''}>❌ Відхилено</option>
                                </select>
                                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 ${arrowColor}"><i class="fas fa-chevron-down text-[10px]"></i></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="text-center text-red-500 py-4">Помилка завантаження.</p>';
    }
}

window.changeBookingStatus = async (bookingId, newStatus) => {
    if (!confirm(`Змінити статус на "${newStatus}"?`)) {
        loadAgencyBookings();
        return;
    }
    try {
        const response = await fetch(`${API_URL}/agencies/bookings/${bookingId}/status`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status: newStatus })
        });
        if (response.ok) loadAgencyBookings();
        else alert('Помилка зміни статусу');
    } catch (error) { console.error(error); }
};