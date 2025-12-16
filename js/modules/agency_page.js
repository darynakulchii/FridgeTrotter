import { API_URL, getHeaders } from '../api-config.js';

let agencyOwnerId = null;

document.addEventListener('DOMContentLoaded', () => {
    initAgencyTabs();
    loadAgencyInfo();
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
        const response = await fetch(`${API_URL}/agencies/bookings`, { headers: getHeaders() }); //

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

            // === СТИЛІЗАЦІЯ ВИПАДАЮЧОГО СПИСКУ ===
            // Використовуємо класи Tailwind для створення вигляду "кнопки-бейджа"
            // appearance-none прибирає стандартну стрілку браузера (ми додамо свою іконку або залишимо мінімалістично)

            let selectClass = "appearance-none font-bold text-xs py-1.5 px-3 pr-8 rounded-lg border-2 cursor-pointer transition-all outline-none focus:ring-2 focus:ring-offset-1";
            let containerClass = "relative inline-block"; // Для позиціонування стрілочки
            let arrowColor = "";

            // Налаштування кольорів під статус
            if (booking.status === 'confirmed') {
                selectClass += " bg-[#2D4952]/10 text-[#2D4952] border-[#2D4952] focus:ring-[#2D4952]";
                arrowColor = "text-[#2D4952]";
            } else if (booking.status === 'rejected') {
                selectClass += " bg-red-50 text-red-600 border-red-200 focus:ring-red-500";
                arrowColor = "text-red-600";
            } else {
                // Pending (Очікує)
                selectClass += " bg-yellow-50 text-yellow-700 border-yellow-300 focus:ring-yellow-400";
                arrowColor = "text-yellow-700";
            }

            // HTML для селекта з кастомною стрілочкою
            const selectHTML = `
                <div class="${containerClass}">
                    <select onchange="changeBookingStatus(${booking.booking_id}, this.value)" class="${selectClass}">
                        <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>⏳ Очікує</option>
                        <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>✅ Підтверджено</option>
                        <option value="rejected" ${booking.status === 'rejected' ? 'selected' : ''}>❌ Відхилено</option>
                    </select>
                    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 ${arrowColor}">
                        <i class="fas fa-chevron-down text-[10px]"></i>
                    </div>
                </div>
            `;

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
                            <span class="text-xs text-gray-400 font-medium" title="Дата створення заявки">
                                <i class="far fa-clock mr-1"></i>${new Date(booking.booking_date).toLocaleDateString()}
                            </span>
                            
                            <div class="flex flex-col items-end">
                                ${selectHTML}
                            </div>
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

// Додаємо нову глобальну функцію для обробки зміни в селекті
window.changeBookingStatus = async (bookingId, newStatus) => {
    // Невеликий confirmation для критичних дій
    let confirmText = `Змінити статус на "${newStatus}"?`;
    if (newStatus === 'confirmed') confirmText += ' Клієнт отримає магніт.';
    if (newStatus !== 'confirmed') confirmText += ' Якщо клієнт мав магніт за цей тур, його буде вилучено.';

    if (!confirm(confirmText)) {
        // Якщо скасували - перезавантажуємо список, щоб повернути старе значення в селекті
        loadAgencyBookings();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/agencies/bookings/${bookingId}/status`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();

        if (response.ok) {
            // alert(data.message); // Можна розкоментувати, якщо потрібне явне підтвердження
            loadAgencyBookings(); // Оновлюємо список (кольри та стилі)
        } else {
            alert(data.error || 'Помилка зміни статусу');
            loadAgencyBookings();
        }
    } catch (error) {
        console.error(error);
        alert('Помилка з\'єднання з сервером');
    }
};

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
async function loadAgencyInfo() {
    try {
        const response = await fetch(`${API_URL}/agencies/me`, {
            headers: getHeaders()
        });

        const currentUser = JSON.parse(localStorage.getItem('user'));

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

        checkOwnerAccess(currentUser);
    } catch (e) {
        console.error("Помилка завантаження даних агенції", e);
    }
}

// === ВИПРАВЛЕНА ФУНКЦІЯ ===
function checkOwnerAccess(user) {
    if (!user) return;

    if (user.isAgent) {
        const ownerElements = document.querySelectorAll('.owner-only');
        ownerElements.forEach(el => {
            // МИ НЕ СТАВИМО display: block, бо це ламає таби
            // Ми просто видаляємо клас, який їх приховує
            el.classList.remove('owner-only');
        });
    }
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