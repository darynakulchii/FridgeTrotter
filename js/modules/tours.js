import { API_URL, getHeaders } from '../api-config.js';

document.addEventListener("DOMContentLoaded", function() {
    loadTours();
});

async function loadTours() {
    const toursContainer = document.getElementById('tours-view');
    if (!toursContainer) return; // Якщо ми не на сторінці турів

    try {
        // Робимо запит до нашого Backend API
        const response = await fetch(`${API_URL}/tours`);
        if (!response.ok) throw new Error('Failed to fetch tours');

        const data = await response.json();
        const tours = data.tours;

        // Очищаємо контейнер
        toursContainer.innerHTML = '';

        if (!tours || tours.length === 0) {
            toursContainer.innerHTML = '<p class="text-center text-gray-500 w-full col-span-2">Турів поки немає.</p>';
            return;
        }

        // Генеруємо HTML для кожного туру
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
    // Дефолтне фото, якщо немає image_url
    const image = tour.image_url || 'https://via.placeholder.com/400x300?text=No+Image';

    return `
        <div class="tour-card tour-card-trigger cursor-pointer" data-tour-id="${tour.tour_id}">
            <div class="tour-image-container">
                <img src="${image}" alt="${tour.title}">
                <span class="absolute top-4 right-4 bg-[#281822] text-[#D3CBC4] px-3 py-1 rounded-md text-xs font-bold uppercase">
                    ${tour.category_name || 'Тур'}
                </span>
            </div>
            <div class="p-6 flex flex-col flex-grow">
                <h3 class="text-xl font-bold text-[#281822] mb-1">${tour.title}</h3>
                <p class="text-gray-500 mb-4 text-sm line-clamp-2">${tour.description || ''}</p>

                <div class="space-y-2 mb-6">
                    <div class="flex items-center gap-2 text-sm text-[#2D4952]">
                        <i class="fas fa-map-marker-alt w-4 text-center"></i> <span>${tour.location}</span>
                    </div>
                    <div class="flex items-center gap-2 text-sm text-[#2D4952]">
                        <i class="far fa-calendar w-4 text-center"></i> <span>${tour.duration_days} днів</span>
                    </div>
                    <div class="flex items-center gap-2 text-sm mt-1">
                        <i class="fas fa-star text-[#48192E] w-4 text-center"></i>
                        <span class="font-bold text-[#281822]">${tour.rating || '0.0'}</span>
                        <span class="text-xs text-gray-500">• ${tour.agency_name || 'Агенція'}</span>
                    </div>
                </div>

                <div class="mt-auto flex justify-between items-center border-t border-gray-100 pt-4">
                    <span class="text-2xl font-bold text-[#48192E]">${tour.price_uah} ₴</span>
                    <button class="btn-solid" onclick="event.stopPropagation(); openTourDetails(${tour.tour_id})">Детальніше</button>
                </div>
            </div>
        </div>
    `;
}

// === РЕАЛІЗОВАНА ЛОГІКА ВІДКРИТТЯ ДЕТАЛЕЙ ТУРУ ===
window.openTourDetails = async (id) => {
    const modal = document.getElementById('tour-details-modal');
    if (!modal) return;

    modal.classList.add('active');

    // Елементи
    const titleEl = document.getElementById('modal-tour-title');
    const descEl = document.getElementById('modal-tour-desc');
    const imgEl = document.getElementById('modal-tour-image');
    const galleryEl = document.getElementById('modal-tour-gallery');
    const locEl = document.getElementById('modal-tour-loc');
    const durEl = document.getElementById('modal-tour-duration');
    const priceEl = document.getElementById('modal-tour-price');

    // Очищення
    titleEl.innerText = 'Завантаження...';
    galleryEl.innerHTML = ''; // Очищаємо галерею
    imgEl.src = '';

    try {
        const response = await fetch(`${API_URL}/tours/${id}`);
        if (!response.ok) throw new Error('Not found');

        const data = await response.json();
        const tour = data.tour;

        // Заповнення текстом
        titleEl.innerText = tour.title;
        descEl.innerText = tour.description;
        locEl.innerText = tour.location;
        durEl.innerText = `${tour.duration_days} днів`;
        priceEl.innerText = `${tour.price_uah} ₴`;

        // Логіка галереї
        // Встановлюємо головне фото (або перше з масиву, або заглушку)
        const mainImage = tour.image_url || (tour.images && tour.images[0]) || 'https://via.placeholder.com/600x400';
        imgEl.src = mainImage;

        // Якщо є більше фото, показуємо їх у галереї
        if (tour.images && tour.images.length > 0) {
            tour.images.forEach(imgUrl => {
                const thumb = document.createElement('img');
                thumb.src = imgUrl;
                thumb.className = "w-full h-16 object-cover rounded cursor-pointer hover:opacity-80 transition border border-transparent hover:border-[#48192E]";
                // При кліку міняємо головне фото
                thumb.onclick = () => { imgEl.src = imgUrl; };
                galleryEl.appendChild(thumb);
            });
        }

        // 1. Відображення програми
        const programHtml = tour.program
            ? `<div class="mt-6 border-t pt-4"><h4 class="font-bold mb-2">Програма туру</h4><p class="whitespace-pre-wrap text-sm text-gray-700">${tour.program}</p></div>`
            : '';
        document.getElementById('modal-tour-desc').insertAdjacentHTML('afterend', programHtml);

        // 2. Налаштування кнопки "Забронювати"
        const bookBtn = document.querySelector('#tour-details-modal .btn-solid'); // Знайти кнопку в модалці
        bookBtn.innerText = 'Забронювати';
        bookBtn.onclick = () => openBookingModal(tour);

        // 3. Завантаження коментарів
        loadTourComments(id);

    } catch (error) {
        console.error(error);
        titleEl.innerText = 'Помилка';
        descEl.innerText = 'Не вдалося завантажити інформацію про тур.';
    }
};

function openBookingModal(tour) {
    const modal = document.getElementById('tour-booking-modal');
    modal.classList.add('active');

    document.getElementById('booking-tour-id').value = tour.tour_id;
    document.getElementById('booking-tour-info').innerText = tour.title;

    // Логіка дат
    const dateSelect = document.getElementById('booking-date-select');
    const dateInput = document.getElementById('booking-date-input');

    if (tour.available_dates && tour.available_dates.length > 0) {
        dateInput.classList.add('hidden');
        dateSelect.classList.remove('hidden');
        dateSelect.innerHTML = tour.available_dates.map(d => `<option value="${d}">${d}</option>`).join('');
    } else {
        dateSelect.classList.add('hidden');
        dateInput.classList.remove('hidden');
    }
}

// Обробка форми бронювання
document.getElementById('booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tourId = document.getElementById('booking-tour-id').value;
    const phone = document.getElementById('booking-phone').value;
    const participants = document.getElementById('booking-participants').value;

    const dateSelect = document.getElementById('booking-date-select');
    const dateInput = document.getElementById('booking-date-input');
    const date = !dateSelect.classList.contains('hidden') ? dateSelect.value : dateInput.value;

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
            document.getElementById('tour-details-modal').classList.remove('active');
        } else {
            alert(data.error);
        }
    } catch(e) { console.error(e); }
});