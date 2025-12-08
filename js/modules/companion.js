import { API_URL } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {
    loadCompanions();
    initCreateAdButton(); // Ініціалізація кнопки

    // Слухачі подій для фільтрів
    document.getElementById('companion-search')?.addEventListener('input', debounce(loadCompanions, 500));
    document.getElementById('companion-type')?.addEventListener('change', loadCompanions);
});

// === НОВА ФУНКЦІЯ: Обробка кліку на кнопку "Створити оголошення" ===
function initCreateAdButton() {
    const createBtn = document.getElementById('create-ad-btn');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Будь ласка, увійдіть у свій акаунт, щоб створити оголошення.');
                window.location.href = 'login.html';
                return;
            }
            // Перенаправлення на сторінку створення
            window.location.href = 'create_ad.html';
        });
    }
}

async function loadCompanions() {
    const container = document.getElementById('companions-container');
    const search = document.getElementById('companion-search')?.value || '';
    const type = document.getElementById('companion-type')?.value || '';

    // Формування URL з параметрами
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (type) params.append('type', type);

    try {
        const response = await fetch(`${API_URL}/companion/ads?${params}`);
        const data = await response.json();

        container.innerHTML = '';

        if (data.ads.length === 0) {
            container.innerHTML = '<p class="text-gray-500 col-span-2 text-center py-8">Оголошень не знайдено.</p>';
            return;
        }

        data.ads.forEach(ad => {
            // Розрахунок віку, якщо він є
            const ageDisplay = ad.author_age ? `${ad.author_age} років` : '';

            // Форматування дат
            const start = new Date(ad.start_date).toLocaleDateString();
            const end = new Date(ad.end_date).toLocaleDateString();

            const html = `
                <div class="companion-card">
                    <div class="flex items-start gap-4 mb-4">
                        <div class="w-12 h-12 rounded-full bg-[#48192E] text-[#D3CBC4] flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
                            ${ad.author_avatar
                ? `<img src="${ad.author_avatar}" class="w-full h-full object-cover">`
                : (ad.first_name[0] + ad.last_name[0]).toUpperCase()}
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-bold text-[#281822] text-lg">${ad.first_name} ${ad.last_name}</h3>
                                <span class="text-gray-500 text-sm">${ageDisplay ? '• ' + ageDisplay : ''}</span>
                            </div>
                            <p class="text-[#48192E] font-semibold mt-0.5"><i class="fas fa-map-marker-alt mr-1"></i> ${ad.destination_country}</p>
                        </div>
                    </div>
                    <p class="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3">${ad.description}</p>
                    <div class="space-y-2 mb-4 bg-gray-50 p-3 rounded-lg">
                        <div class="flex items-center gap-3 text-sm text-gray-700">
                            <i class="far fa-calendar text-[#2D4952] w-5 text-center"></i><span>${start} - ${end}</span>
                        </div>
                         <div class="flex items-center gap-3 text-sm text-gray-700">
                            <i class="fas fa-user-friends text-[#2D4952] w-5 text-center"></i><span>${ad.min_group_size}-${ad.max_group_size} особи</span>
                        </div>
                    </div>
                     <div class="flex flex-wrap gap-2 mb-6">
                        ${(ad.tags || []).map(tag => `<span class="tag-pill">${tag}</span>`).join('')}
                    </div>
                    <div class="flex gap-3 mt-auto">
                        <button class="flex-1 btn-solid py-2.5 text-center">Написати</button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) { console.error(e); }
}

// Функція debounce для пошуку
function debounce(func, timeout = 300){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}