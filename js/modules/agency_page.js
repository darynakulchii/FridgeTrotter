import { API_URL, getHeaders } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {
    initAgencyTabs();
    loadAgencyInfo(); // Завантажує локальні/статичні дані (або можна переробити на fetch)
    initLogoUpload();
    initAwards();
    initSaveInfoButton();
    initSaveSettingsButton();
});

// ---- Перемикання вкладок ----
function initAgencyTabs() {
    const pills = document.querySelectorAll('.nav-pill');
    const tabs = document.querySelectorAll('.tab-content');

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            // Знімаємо активний клас з усіх кнопок і вкладок
            pills.forEach(p => p.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));

            // Активуємо натиснуту кнопку
            pill.classList.add('active');

            // Знаходимо і активуємо відповідну вкладку
            const tabId = `tab-${pill.dataset.tab}`;
            const targetTab = document.getElementById(tabId);
            if (targetTab) {
                targetTab.classList.add('active');
            }

            // === ЛОГІКА ЗАВАНТАЖЕННЯ ДАНИХ ДЛЯ ВКЛАДОК ===
            if (pill.dataset.tab === 'agency-bookings') {
                loadAgencyBookings();
            }
        });
    });
}

// =========================================================
// ЛОГІКА БРОНЮВАНЬ (НОВА)
// =========================================================

async function loadAgencyBookings() {
    const container = document.getElementById('bookings-list');
    if (!container) return;

    container.innerHTML = '<p class="text-center text-gray-500 py-8"><i class="fas fa-spinner fa-spin"></i> Завантаження заявок...</p>';

    try {
        const response = await fetch(`${API_URL}/agencies/bookings`, { headers: getHeaders() });

        if (!response.ok) {
            throw new Error('Failed to fetch bookings');
        }

        const data = await response.json();

        container.innerHTML = '';

        if (!data.bookings || data.bookings.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Активних заявок на бронювання немає.</p>';
            return;
        }

        data.bookings.forEach(booking => {
            const dateDisplay = booking.selected_date
                ? new Date(booking.selected_date).toLocaleDateString('uk-UA')
                : 'Дата не обрана';

            const isPending = booking.status === 'pending';

            const statusBadge = isPending
                ? '<span class="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded">Очікує</span>'
                : '<span class="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">Підтверджено</span>';

            const actionBtn = isPending
                ? `<button onclick="confirmBooking(${booking.booking_id})" class="btn-burgundy-solid text-sm py-1 px-3">Підтвердити</button>`
                : `<button disabled class="text-gray-400 border border-gray-200 rounded px-3 py-1 text-sm cursor-not-allowed">Оброблено</button>`;

            const html = `
                <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <h4 class="font-bold text-[#281822] text-lg">${booking.tour_title}</h4>
                                ${statusBadge}
                            </div>
                            <p class="text-sm text-gray-600 mb-1"><i class="far fa-user w-5 text-center"></i> ${booking.first_name} ${booking.last_name} (${booking.email})</p>
                            <p class="text-sm text-gray-600 mb-1"><i class="fas fa-phone w-5 text-center"></i> ${booking.contact_phone}</p>
                            <p class="text-sm text-gray-600"><i class="far fa-calendar-alt w-5 text-center"></i> ${dateDisplay} • ${booking.participants_count} осіб</p>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <span class="text-xs text-gray-400">${new Date(booking.booking_date).toLocaleDateString()}</span>
                            ${actionBtn}
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="text-center text-red-500 py-8">Не вдалося завантажити заявки.</p>';
    }
}

// Глобальна функція для виклику з onclick в HTML
window.confirmBooking = async (bookingId) => {
    if (!confirm('Підтвердити це бронювання? Клієнт отримає сповіщення та магніт.')) return;

    try {
        const response = await fetch(`${API_URL}/agencies/bookings/${bookingId}/confirm`, {
            method: 'POST',
            headers: getHeaders()
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            loadAgencyBookings(); // Перезавантажити список
        } else {
            alert(data.error || 'Помилка підтвердження');
        }
    } catch (error) {
        console.error(error);
        alert('Помилка з\'єднання з сервером');
    }
};

// =========================================================
// ІСНУЮЧА ЛОГІКА (Агенція, Лого, Нагороди)
// =========================================================

// ---- Дані агенції (Можна замінити на fetch /api/agencies/me) ----
let agencyData = {
    name: 'Travel Pro',
    description: 'Ми організовуємо авторські тури по Європі.',
    phone: '',
    email: '',
    website: '',
    logo: '',
    awards: [],
    bgColor: '#D3CBC4'
};

// ---- Завантаження початкових даних ----
function loadAgencyInfo() {
    document.getElementById('agency-name').innerText = agencyData.name;
    const descEl = document.getElementById('agency-description');
    if (descEl.tagName === 'TEXTAREA' || descEl.tagName === 'INPUT') {
        descEl.value = agencyData.description;
    } else {
        descEl.innerText = agencyData.description;
    }
    document.getElementById('agency-phone').innerText = agencyData.phone || '—';
    document.getElementById('agency-email').innerText = agencyData.email || '—';
    document.getElementById('agency-website').innerText = agencyData.website || '—';
    if (agencyData.logo) {
        document.getElementById('agency-logo').src = agencyData.logo;
    }
    document.body.style.backgroundColor = agencyData.bgColor;
}

// ---- Логотип агенції ----
function initLogoUpload() {
    const logoBtn = document.getElementById('edit-logo-btn');
    const logoInput = document.getElementById('logo-input');
    const logoImg = document.getElementById('agency-logo');

    if (logoBtn && logoInput && logoImg) {
        logoBtn.addEventListener('click', () => {
            logoInput.click();
        });

        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                logoImg.src = event.target.result;
                agencyData.logo = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
}

// ---- Нагороди (сертифікати) ----
function initAwards() {
    const addAwardBtn = document.getElementById('add-award-btn');
    const addAwardInput = document.getElementById('add-award-input');
    const awardsList = document.getElementById('awards-list');

    if (!addAwardBtn || !addAwardInput || !awardsList) return;

    addAwardBtn.addEventListener('click', () => addAwardInput.click());

    addAwardInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'award-item relative inline-block m-2';

            const img = document.createElement('img');
            img.src = event.target.result;
            img.alt = 'Сертифікат';
            img.className = 'w-24 h-24 object-cover rounded-md border';

            const removeBtn = document.createElement('button');
            removeBtn.innerText = '✖';
            removeBtn.className = 'absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center cursor-pointer';
            removeBtn.addEventListener('click', () => {
                awardsList.removeChild(imgContainer);
                agencyData.awards = agencyData.awards.filter(a => a !== img.src);
            });

            imgContainer.appendChild(img);
            imgContainer.appendChild(removeBtn);
            awardsList.appendChild(imgContainer);

            agencyData.awards.push(img.src);
        }
        reader.readAsDataURL(file);
    });
}

// ---- Збереження опису агенції ----
function initSaveInfoButton() {
    const saveBtn = document.getElementById('save-agency-info');
    const descriptionInput = document.getElementById('agency-description');
    if (!saveBtn || !descriptionInput) return;

    saveBtn.disabled = false;
    saveBtn.addEventListener('click', () => {
        agencyData.description = descriptionInput.value;
        loadAgencyInfo();
        alert('Опис агенції збережено!');
    });
}

// ---- Збереження налаштувань ----
function initSaveSettingsButton() {
    const saveBtn = document.getElementById('save-agency-settings');
    if(!saveBtn) return;

    saveBtn.disabled = false;
    saveBtn.addEventListener('click', () => {
        agencyData.phone = document.getElementById('edit-agency-phone').value;
        agencyData.email = document.getElementById('edit-agency-email').value;
        agencyData.website = document.getElementById('edit-agency-website').value;

        const bgSelect = document.getElementById('page-bg-select');
        agencyData.bgColor = bgSelect.value;
        document.body.style.backgroundColor = agencyData.bgColor;

        loadAgencyInfo();
        alert('Налаштування збережено!');
    });
}