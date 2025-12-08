import { API_URL } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {
    loadCompanions();

    // Слухачі подій (аналогічно форуму)
    document.getElementById('companion-search')?.addEventListener('input', loadCompanions);
    document.getElementById('companion-type')?.addEventListener('change', loadCompanions);
});

async function loadCompanions() {
    const container = document.getElementById('companions-container');
    // Отримання значень фільтрів (додайте логіку зчитування value по ID)

    try {
        const response = await fetch(`${API_URL}/companion/ads`); // Можна додати query params
        const data = await response.json();

        container.innerHTML = '';

        data.ads.forEach(ad => {
            const html = `
                <div class="companion-card">
                    <div class="flex items-start gap-4 mb-4">
                        <div class="w-12 h-12 rounded-full bg-[#48192E] text-[#D3CBC4] flex items-center justify-center font-bold text-lg shrink-0">
                            ${(ad.first_name[0] + ad.last_name[0]).toUpperCase()}
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-bold text-[#281822] text-lg">${ad.first_name} ${ad.last_name}</h3>
                                <span class="text-gray-500 text-sm">• ${ad.author_age || 'N/A'} років</span>
                            </div>
                            <p class="text-[#48192E] font-semibold mt-0.5">${ad.destination_country}</p>
                        </div>
                    </div>
                    <p class="text-gray-600 text-sm leading-relaxed mb-4">${ad.description}</p>
                    <div class="space-y-2 mb-4">
                        <div class="flex items-center gap-3 text-sm text-gray-700">
                            <i class="far fa-calendar text-gray-400 w-5"></i><span>${new Date(ad.start_date).toLocaleDateString()} - ${new Date(ad.end_date).toLocaleDateString()}</span>
                        </div>
                         <div class="flex items-center gap-3 text-sm text-gray-700">
                            <i class="fas fa-user-friends text-gray-400 w-5"></i><span>${ad.min_group_size}-${ad.max_group_size} особи</span>
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