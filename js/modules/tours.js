import { API_URL, getHeaders } from '../api-config.js';

let bookingPicker = null;
let currentTourId = null; // Для збереження контексту модалки

document.addEventListener("DOMContentLoaded", function() {
    loadTours();
    setupViewToggles(); // Налаштування перемикача "Тури / Рейтинг"

    // Обробка форми коментарів
    const commentForm = document.getElementById('tour-comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', handleCommentSubmit);
    }
});

// === 1. ЛОГІКА РЕЙТИНГУ АГЕНЦІЙ ===

function setupViewToggles() {
    const btnViewAgencies = document.getElementById('btn-view-agencies');
    const btnViewTours = document.getElementById('btn-view-tours');
    const agenciesView = document.getElementById('agencies-view');
    const toursView = document.getElementById('tours-view');
    const pageTitle = document.getElementById('page-title');

    if (btnViewAgencies && btnViewTours) {
        btnViewAgencies.addEventListener('click', () => {
            agenciesView.classList.remove('hidden');
            agenciesView.classList.add('flex');
            toursView.classList.add('hidden');
            toursView.classList.remove('grid');

            btnViewAgencies.classList.add('active', 'btn-solid');
            btnViewAgencies.classList.remove('btn-rating');

            btnViewTours.classList.add('inactive', 'btn-rating');
            btnViewTours.classList.remove('btn-solid');

            if(pageTitle) pageTitle.innerText = "Рейтинг тур агенцій";

            // Завантажуємо агенції при кліку
            loadAgencies();
        });

        btnViewTours.addEventListener('click', () => {
            toursView.classList.remove('hidden');
            toursView.classList.add('grid');
            agenciesView.classList.add('hidden');
            agenciesView.classList.remove('flex');

            btnViewTours.classList.remove('inactive', 'btn-rating');
            btnViewTours.classList.add('btn-solid');

            btnViewAgencies.classList.remove('active', 'btn-solid');
            btnViewAgencies.classList.add('btn-rating');

            if(pageTitle) pageTitle.innerText = "Популярні тури";
        });
    }
}

async function loadAgencies() {
    const container = document.getElementById('agencies-view');
    container.innerHTML = '<p class="text-center text-gray-500 py-4">Завантаження рейтингу...</p>';

    try {
        const response = await fetch(`${API_URL}/tours/agencies`);
        const data = await response.json();

        container.innerHTML = '';

        if (!data.agencies || data.agencies.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500">Агенцій ще немає.</p>';
            return;
        }

        data.agencies.forEach((agency, index) => {
            // Визначаємо іконку місця
            let rankIcon = `<div class="text-2xl font-bold text-gray-400">#${index + 1}</div>`;
            if (index === 0) rankIcon = `<div class="text-4xl mb-2">🏆</div><div class="text-2xl font-bold text-[#48192E]">#1</div>`;
            if (index === 1) rankIcon = `<div class="text-4xl mb-2">🥈</div><div class="text-2xl font-bold text-[#2D4952]">#2</div>`;
            if (index === 2) rankIcon = `<div class="text-4xl mb-2">🥉</div><div class="text-2xl font-bold text-[#A8B5B2]">#3</div>`;

            const html = `
                <div class="bg-white rounded-xl p-6 shadow-sm border border-[#2D4952]/20 hover:shadow-lg transition flex items-start gap-6">
                    <div class="flex flex-col items-center min-w-[60px]">
                        ${rankIcon}
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <h3 class="text-xl font-bold text-[#281822]">${agency.name}</h3>
                                <p class="text-sm text-[#2D4952]">${agency.description || 'Опис відсутній'}</p>
                            </div>
                            ${index === 0 ? '<span class="bg-[#48192E] text-[#D3CBC4] px-3 py-1 rounded-full text-xs font-bold"><i class="fas fa-award mr-1"></i> Лідер ринку</span>' : ''}
                        </div>
                        <div class="flex items-center gap-6 mt-4">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-star text-[#48192E]"></i>
                                <span class="text-lg font-bold text-[#281822]">${agency.avg_rating}</span>
                                <span class="text-sm text-gray-500">(${agency.review_count} відгуків)</span>
                            </div>
                            <div class="flex items-center gap-2 text-[#2D4952]">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${agency.total_tours_count} турів</span>
                            </div>
                        </div>
                        <div class="flex gap-2 mt-4">
                            <button class="btn-solid btn-view-agency-tours text-sm py-2">Всі тури агенції</button>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-red-500 text-center">Помилка завантаження рейтингу.</p>';
    }
}

// === 2. ЗАВАНТАЖЕННЯ ТУРІВ ===

async function loadTours() {
    const toursContainer = document.getElementById('tours-view');
    if (!toursContainer) return;

    try {
        const response = await fetch(`${API_URL}/tours`);
        if (!response.ok) throw new Error('Failed to fetch tours');

        const data = await response.json();
        const tours = data.tours;

        toursContainer.innerHTML = '';

        if (!tours || tours.length === 0) {
            toursContainer.innerHTML = '<p class="text-center text-gray-500 w-full col-span-2">Турів поки немає.</p>';
            return;
        }

        tours.forEach(tour => {
            const cardHTML = createTourCard(tour);
            toursContainer.insertAdjacentHTML('beforeend', cardHTML);
        });

    } catch (error) {
        console.error('Error loading tours:', error);
        toursContainer.innerHTML = '<p class="text-red-500 col-span-2 text-center">Не вдалося завантажити тури.</p>';
    }
}

function createTourCard(tour) {
    const image = tour.image_url || 'https://via.placeholder.com/400x300?text=No+Image';

    // Формування дати
    let dateText = `${tour.duration_days} днів`;
    if (tour.available_dates && tour.available_dates.length > 0) {
        const nextDate = new Date(tour.available_dates[0]).toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'});
        dateText += ` • з ${nextDate}`;
    }

    return `
        <div class="universal-card cursor-pointer" onclick="openTourDetails(${tour.tour_id})">
            <div class="card-header-user">
                <div class="card-avatar" style="background-color: #281822;">
                    <i class="fas fa-briefcase"></i>
                </div>
                <div class="card-user-info">
                    <div class="card-user-name">${tour.agency_name || 'Агенція'}</div>
                    <div class="card-user-sub">
                        <span>Офіційний тур</span>
                    </div>
                </div>
            </div>

            <div class="card-image-middle">
                <img src="${image}" alt="${tour.title}">
                <span class="card-badge">${tour.category_name || 'Тур'}</span>
            </div>

            <div class="card-body flex flex-col h-full">
                <h3 class="card-title line-clamp-2 mb-3">${tour.title}</h3>
                
                <div class="space-y-2 mb-4 bg-gray-50 p-3 rounded-lg">
                    <div class="flex items-center gap-3 text-sm text-gray-700">
                        <i class="far fa-calendar-alt text-[#2D4952] w-5 text-center"></i>
                        <span>${dateText}</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm text-gray-700">
                        <i class="fas fa-map-marker-alt text-[#2D4952] w-5 text-center"></i>
                        <span class="line-clamp-1">${tour.location}</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm text-gray-700">
                        <i class="fas fa-star text-yellow-500 w-5 text-center"></i>
                        <span class="font-bold">${tour.rating || 'New'}</span> 
                        <span class="text-xs text-gray-400 font-normal">(Рейтинг туру)</span>
                    </div>
                </div>
            </div>

            <div class="card-footer gap-2 px-4 py-3 border-t border-gray-100 flex items-center">
                <div class="font-bold text-xl text-[#281822] whitespace-nowrap mr-auto">
                    ${parseInt(tour.price_uah).toLocaleString()} ₴
                </div>

                <button onclick="event.stopPropagation(); toggleSaveTour(${tour.tour_id}, this)" class="btn-icon-square" title="В обране">
                    <i class="far fa-bookmark"></i>
                </button>
                
                <button class="btn-outline px-4 text-sm h-10" onclick="event.stopPropagation(); openTourDetails(${tour.tour_id})">
                    Деталі
                </button>
                
                <button class="btn-fill px-4 text-sm h-10" onclick="event.stopPropagation(); openBookingModal({tour_id: ${tour.tour_id}, title: '${tour.title.replace(/'/g, "\\'")}'})">
                    Забронювати
                </button>
            </div>
        </div>
    `;
}

// === 3. ДЕТАЛІ ТУРУ, ЗБЕРЕЖЕННЯ ТА КОМЕНТАРІ ===

window.openTourDetails = async (id) => {
    currentTourId = id;
    const modal = document.getElementById('tour-details-modal');
    if (!modal) return;

    modal.classList.add('active');

    // 1. Отримуємо посилання на елементи (додали нові: programEl та datesEl)
    const titleEl = document.getElementById('modal-tour-title');
    const descEl = document.getElementById('modal-tour-desc');
    const programEl = document.getElementById('modal-tour-program'); // НОВЕ
    const datesEl = document.getElementById('modal-tour-dates');     // НОВЕ
    const imgEl = document.getElementById('modal-tour-image');
    const galleryEl = document.getElementById('modal-tour-gallery');
    const locEl = document.getElementById('modal-tour-loc');
    const durEl = document.getElementById('modal-tour-duration');
    const priceEl = document.getElementById('modal-tour-price');
    const ratingEl = document.getElementById('modal-tour-rating');
    const saveBtn = document.getElementById('modal-save-btn');
    const bookBtn = document.getElementById('modal-book-btn');

    // 2. Очищення перед завантаженням (щоб не показувати старі дані)
    titleEl.innerText = 'Завантаження...';
    descEl.innerText = '';
    programEl.innerText = 'Завантаження...'; // НОВЕ
    datesEl.innerHTML = '';                  // НОВЕ
    galleryEl.innerHTML = '';
    imgEl.src = '';
    document.getElementById('tour-comments-list').innerHTML = '<p class="text-gray-400 text-sm">Завантаження відгуків...</p>';

    try {
        const response = await fetch(`${API_URL}/tours/${id}`);
        if (!response.ok) throw new Error('Not found');

        const data = await response.json();
        const tour = data.tour;

        // 3. Заповнення стандартними даними
        titleEl.innerText = tour.title;
        descEl.innerText = tour.description;
        locEl.innerText = tour.location;
        durEl.innerText = `${tour.duration_days} днів`;
        priceEl.innerText = `${tour.price_uah} ₴`;
        ratingEl.innerText = tour.rating || '0.0';

        // === 4. НОВЕ: Заповнення програми ===
        if (tour.program) {
            programEl.innerText = tour.program;
            // Прибираємо стиль "курсив", якщо текст є
            programEl.classList.remove('italic', 'text-gray-400');
        } else {
            programEl.innerText = 'Детальна програма уточнюється в організатора.';
            // Додаємо стиль, щоб виглядало як заглушка
            programEl.classList.add('italic', 'text-gray-400');
        }

        // === 5. НОВЕ: Заповнення дат ===
        if (tour.available_dates && tour.available_dates.length > 0) {
            // Якщо дати прийшли як рядки, відсортуємо їх
            const sortedDates = tour.available_dates.sort();

            // Створюємо гарні плашки для кожної дати
            datesEl.innerHTML = sortedDates.map(dateStr => {
                const dateObj = new Date(dateStr);
                // Форматуємо: 01 січня 2025
                const formatted = dateObj.toLocaleDateString('uk-UA', {
                    day: 'numeric', month: 'long', year: 'numeric'
                });

                return `<span class="bg-[#F3F4F6] text-[#281822] border border-gray-200 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2">
                            <i class="far fa-calendar-check text-[#48192E]"></i> ${formatted}
                        </span>`;
            }).join('');
        } else {
            datesEl.innerHTML = '<span class="text-gray-500 text-sm italic">Дати уточнюються менеджером</span>';
        }

        const mainImage = tour.image_url || (tour.images && tour.images[0]) || 'https://via.placeholder.com/600x400';
        imgEl.src = mainImage;

        if (tour.images && tour.images.length > 0) {
            tour.images.forEach(imgUrl => {
                const thumb = document.createElement('img');
                thumb.src = imgUrl;
                thumb.className = "w-full h-16 object-cover rounded cursor-pointer hover:opacity-80 transition border border-transparent hover:border-[#48192E]";
                thumb.onclick = () => { imgEl.src = imgUrl; };
                galleryEl.appendChild(thumb);
            });
        }

        bookBtn.onclick = () => openBookingModal(tour);
        checkIfSaved(id, saveBtn);
        saveBtn.onclick = () => toggleSaveTour(id, saveBtn);
        loadTourComments(id);

    } catch (error) {
        console.error(error);
        titleEl.innerText = 'Помилка завантаження';
    }
};

// Перевірка чи збережено
async function checkIfSaved(id, btn) {
    if (!localStorage.getItem('token')) {
        updateSaveBtnUI(btn, false);
        return;
    }
    try {
        const res = await fetch(`${API_URL}/tours/${id}/is-saved`, { headers: getHeaders() });
        const data = await res.json();
        updateSaveBtnUI(btn, data.saved);
    } catch (e) { console.error(e); }
}

async function toggleSaveTour(id, btn) {
    if (!localStorage.getItem('token')) {
        alert('Увійдіть, щоб зберігати тури.');
        return;
    }

    const isSaved = btn.classList.contains('saved');
    const method = isSaved ? 'DELETE' : 'POST';

    try {
        const res = await fetch(`${API_URL}/tours/${id}/save`, {
            method: method,
            headers: getHeaders()
        });

        const data = await res.json();

        if (res.ok) {
            updateSaveBtnUI(btn, !isSaved);
        } else {
            alert(data.error || 'Помилка збереження');
        }
    } catch (e) {
        console.error(e);
        alert('Помилка з\'єднання');
    }
}

function updateSaveBtnUI(btn, isSaved) {
    const icon = btn.querySelector('i');
    const text = btn.querySelector('span');

    if (isSaved) {
        btn.classList.add('saved', 'text-[#48192E]');
        btn.classList.remove('text-gray-400');
        icon.classList.remove('far');
        icon.classList.add('fas'); // Solid icon
        text.innerText = 'В обраному';
    } else {
        btn.classList.remove('saved', 'text-[#48192E]');
        btn.classList.add('text-gray-400');
        icon.classList.remove('fas');
        icon.classList.add('far'); // Outline icon
        text.innerText = 'В обране';
    }
}

// === КОМЕНТАРІ ===

async function loadTourComments(tourId) {
    const list = document.getElementById('tour-comments-list');
    try {
        const res = await fetch(`${API_URL}/tours/${tourId}/comments`);
        const data = await res.json();

        list.innerHTML = '';

        if (!data.comments || data.comments.length === 0) {
            list.innerHTML = '<p class="text-gray-400 text-sm italic">Поки немає відгуків. Будьте першим!</p>';
            return;
        }

        data.comments.forEach(c => {
            const avatarHtml = c.author_avatar
                ? `<img src="${c.author_avatar}" class="w-8 h-8 rounded-full object-cover">`
                : `<div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">${c.first_name[0]}</div>`;

            const html = `
                <div class="flex gap-3 items-start border-b border-gray-100 pb-3 last:border-0">
                    ${avatarHtml}
                    <div>
                        <div class="flex items-baseline gap-2">
                            <span class="font-bold text-sm text-[#281822]">${c.first_name} ${c.last_name}</span>
                            <span class="text-xs text-gray-400">${new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <p class="text-gray-700 text-sm mt-1">${c.content}</p>
                    </div>
                </div>
            `;
            list.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) { console.error(e); }
}

async function handleCommentSubmit(e) {
    e.preventDefault();
    if (!currentTourId) return;

    if (!localStorage.getItem('token')) {
        alert('Увійдіть, щоб залишити відгук.');
        return;
    }

    const input = document.getElementById('tour-comment-input');
    const content = input.value.trim();
    if (!content) return;

    try {
        const res = await fetch(`${API_URL}/tours/${currentTourId}/comments`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ content })
        });

        if (res.ok) {
            input.value = '';
            loadTourComments(currentTourId);
        } else {
            alert('Помилка при відправці.');
        }
    } catch (e) { console.error(e); }
}

// === БРОНЮВАННЯ (З ПОПЕРЕДНЬОГО КОДУ) ===
function openBookingModal(tour) {
    const modal = document.getElementById('tour-booking-modal');
    modal.classList.add('active');
    document.getElementById('booking-tour-id').value = tour.tour_id;
    document.getElementById('booking-tour-info').innerText = tour.title;

    const dateInput = document.getElementById('booking-date-picker');
    if (bookingPicker) bookingPicker.destroy();

    if (typeof flatpickr !== 'undefined') {
        const config = {
            locale: "uk",
            dateFormat: "Y-m-d",
            minDate: "today",
            disableMobile: "true"
        };
        if (tour.available_dates && tour.available_dates.length > 0) {
            config.enable = tour.available_dates;
        }
        bookingPicker = flatpickr(dateInput, config);
    }
}

document.getElementById('booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tourId = document.getElementById('booking-tour-id').value;
    const phone = document.getElementById('booking-phone').value;
    const participants = document.getElementById('booking-participants').value;
    const date = document.getElementById('booking-date-picker').value;

    if (!date) { alert("Оберіть дату"); return; }

    try {
        const res = await fetch(`${API_URL}/tours/${tourId}/book`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ phone, date, participants })
        });

        const data = await res.json();

        if(res.ok) {
            alert(data.message);
            document.getElementById('tour-booking-modal').classList.remove('active');
        } else {
            alert(data.error || 'Помилка бронювання');
        }
    } catch(e) { console.error(e); }
});