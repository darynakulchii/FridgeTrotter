import { API_URL } from '../api-config.js';

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
        const tours = data.tours; // Ваш API повертає об'єкт { tours: [...] }

        // Очищаємо контейнер
        toursContainer.innerHTML = '';

        if (tours.length === 0) {
            toursContainer.innerHTML = '<p class="text-center text-gray-500 w-full">Турів поки немає.</p>';
            return;
        }

        // Генеруємо HTML для кожного туру
        tours.forEach(tour => {
            const cardHTML = createTourCard(tour);
            toursContainer.insertAdjacentHTML('beforeend', cardHTML);
        });

    } catch (error) {
        console.error('Error loading tours:', error);
        toursContainer.innerHTML = '<p class="text-red-500">Не вдалося завантажити тури.</p>';
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
                    <button class="btn-solid" onclick="openTourDetails(${tour.tour_id})">Детальніше</button>
                </div>
            </div>
        </div>
    `;
}

// Функція для відкриття модалки (можна додати в глобальну область видимості або обробити через event delegation)
window.openTourDetails = (id) => {
    console.log("Open details for tour:", id);
    // Тут логіка fetch детального туру: fetch(`${API_URL}/tours/${id}`) ...
};