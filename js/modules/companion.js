import { API_URL, getHeaders } from '../api-config.js';

const currentUser = JSON.parse(localStorage.getItem('user'));

document.addEventListener('DOMContentLoaded', () => {
    loadCompanions();
    initCreateAdButton();

    document.getElementById('companion-search')?.addEventListener('input', debounce(loadCompanions, 500));
    document.getElementById('companion-type')?.addEventListener('change', loadCompanions);
});

window.closeAdModal = () => {
    document.getElementById('ad-details-modal').classList.remove('active');
};

window.contactUser = (userId) => {
    const token = localStorage.getItem('token');
    if (!token) {
        if(confirm('Щоб написати повідомлення, потрібно увійти. Перейти на сторінку входу?')) {
            window.location.href = 'login.html';
        }
        return;
    }
    if (currentUser && currentUser.userId == userId) {
        alert("Це ваше оголошення :)");
        return;
    }
    window.location.href = `chat.html?user_id=${userId}`;
};

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

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (type) params.append('type', type);

    try {
        const response = await fetch(`${API_URL}/companion/ads?${params}`, { headers: getHeaders() });
        const data = await response.json();

        container.innerHTML = '';

        if (!data.ads || data.ads.length === 0) {
            container.innerHTML = '<p class="text-gray-500 col-span-2 text-center py-8">Оголошень не знайдено.</p>';
            return;
        }

        data.ads.forEach(ad => {
            // === ЛОГІКА ПОСИЛАННЯ НА ПРОФІЛЬ ===
            // Якщо я автор -> my_profile.html, інакше -> other_user_profile.html
            const isMe = currentUser && currentUser.userId == ad.user_id;
            const profileLink = isMe ? 'my_profile.html' : `other_user_profile.html?user_id=${ad.user_id}`;

            const ageDisplay = ad.author_age ? `${ad.author_age} років` : '';
            const start = new Date(ad.start_date).toLocaleDateString('uk-UA');
            const end = new Date(ad.end_date).toLocaleDateString('uk-UA');

            // Бюджет
            let budgetHtml = '';
            if (ad.budget_min || ad.budget_max) {
                const min = ad.budget_min ? parseInt(ad.budget_min) : 0;
                const max = ad.budget_max ? parseInt(ad.budget_max) : '...';
                budgetHtml = `<div class="flex items-center gap-2 text-sm text-[#48192E] font-semibold mt-1">
                                <i class="fas fa-wallet w-5 text-center"></i> ${min} - ${max} грн
                              </div>`;
            }

            // Фото (обкладинка)
            let adImageHtml = '';
            if (ad.images && ad.images.length > 0) {
                const imgUrl = ad.images[0];
                // Додаємо onclick для відкриття деталей
                adImageHtml = `
                    <div class="w-full h-40 mb-4 rounded-lg overflow-hidden cursor-pointer group relative" onclick="openAdDetails(${ad.ad_id})">
                        <img src="${imgUrl}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105">
                        ${ad.images.length > 1 ? `<span class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-bold">+${ad.images.length - 1}</span>` : ''}
                    </div>
                `;
            }

            // Аватар (Виправлено стилі)
            let avatarContent;
            if (ad.author_avatar) {
                avatarContent = `<img src="${ad.author_avatar}" class="w-full h-full object-cover">`;
            } else {
                avatarContent = (ad.first_name[0] + ad.last_name[0]).toUpperCase();
            }

            const html = `
                <div class="companion-card flex flex-col h-full">
                    <div class="flex items-start gap-4 mb-3">
                         <a href="${profileLink}" class="w-12 h-12 rounded-full bg-[#48192E] text-[#D3CBC4] flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden hover:opacity-80 transition cursor-pointer">
                            ${avatarContent}
                        </a>
                        
                        <div>
                            <div class="flex items-center gap-2">
                                <a href="${profileLink}" class="font-bold text-[#281822] text-lg hover:underline hover:text-[#48192E] transition">
                                    ${ad.first_name} ${ad.last_name}
                                </a>
                                <span class="text-gray-500 text-sm">${ageDisplay ? '• ' + ageDisplay : ''}</span>
                            </div>
                            <p class="text-[#48192E] font-semibold mt-0.5 cursor-pointer hover:underline" onclick="openAdDetails(${ad.ad_id})">
                                <i class="fas fa-map-marker-alt mr-1"></i> ${ad.destination_country}
                            </p>
                        </div>
                    </div>
                    
                    ${adImageHtml}
                    
                    <p class="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3 cursor-pointer hover:text-gray-800" onclick="openAdDetails(${ad.ad_id})">
                        ${ad.description}
                    </p>
                    
                    <div class="space-y-2 mb-4 bg-gray-50 p-3 rounded-lg mt-auto">
                        <div class="flex items-center gap-3 text-sm text-gray-700">
                            <i class="far fa-calendar text-[#2D4952] w-5 text-center"></i><span>${start} - ${end}</span>
                        </div>
                         <div class="flex items-center gap-3 text-sm text-gray-700">
                            <i class="fas fa-user-friends text-[#2D4952] w-5 text-center"></i><span>${ad.min_group_size}-${ad.max_group_size} особи</span>
                        </div>
                        ${budgetHtml}
                    </div>
                    
                     <div class="flex flex-wrap gap-2 mb-6">
                        ${(ad.tags || []).map(tag => `<span class="tag-pill">${tag}</span>`).join('')}
                    </div>
                    
                    <div class="flex gap-3">
                        <button onclick="toggleSaveAd(${ad.ad_id}, event)" class="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500">
                            <i class="far fa-bookmark" id="ad-bookmark-${ad.ad_id}"></i>
                        </button>
                        <button onclick="openAdDetails(${ad.ad_id})" class="flex-1 border border-[#2D4952] text-[#2D4952] py-2 rounded-lg font-medium hover:bg-gray-50 transition">
                            Деталі
                        </button>
                        <button onclick="contactUser(${ad.user_id})" class="flex-1 btn-solid py-2 text-center transition hover:opacity-90">
                            Написати
                        </button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-red-500 col-span-2 text-center py-8">Помилка завантаження даних.</p>';
    }
}

window.openAdDetails = async (adId) => {
    const modal = document.getElementById('ad-details-modal');
    modal.classList.add('active');

    // Очищення полів перед завантаженням
    document.getElementById('modal-ad-country').innerText = 'Завантаження...';
    document.getElementById('modal-ad-main-image').classList.add('hidden');
    document.getElementById('modal-ad-gallery').innerHTML = '';

    try {
        const response = await fetch(`${API_URL}/companion/ads/${adId}`, { headers: getHeaders() });
        const data = await response.json();
        const ad = data.ad;

        // 1. Заповнення текстових полів
        document.getElementById('modal-ad-country').innerText = ad.destination_country;
        document.getElementById('modal-ad-desc').innerText = ad.description;

        const start = new Date(ad.start_date).toLocaleDateString('uk-UA');
        const end = new Date(ad.end_date).toLocaleDateString('uk-UA');
        document.getElementById('modal-ad-dates').innerText = `${start} — ${end}`;

        const minB = ad.budget_min ? parseInt(ad.budget_min) : 0;
        const maxB = ad.budget_max ? parseInt(ad.budget_max) : '...';
        document.getElementById('modal-ad-budget').innerText = `${minB} - ${maxB} грн`;

        document.getElementById('modal-ad-group').innerText = `${ad.min_group_size} - ${ad.max_group_size} осіб`;

        // Теги
        const tagsContainer = document.getElementById('modal-ad-tags');
        tagsContainer.innerHTML = (ad.tags || []).map(t => `<span class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">${t}</span>`).join('');

        // 2. Автор і посилання
        const isMe = currentUser && currentUser.userId == ad.user_id;
        const profileLink = isMe ? 'my_profile.html' : `other_user_profile.html?user_id=${ad.user_id}`;

        document.getElementById('modal-author-name-link').innerText = `${ad.first_name} ${ad.last_name}`;
        document.getElementById('modal-author-name-link').href = profileLink;

        document.getElementById('modal-author-link').href = profileLink;
        document.getElementById('modal-author-age').innerText = ad.author_age ? `${ad.author_age} років` : 'Вік приховано';

        // Аватар автора
        const avatarEl = document.getElementById('modal-ad-avatar');
        if (ad.author_avatar) {
            avatarEl.innerHTML = `<img src="${ad.author_avatar}" class="w-full h-full object-cover">`;
        } else {
            avatarEl.innerText = (ad.first_name[0] + ad.last_name[0]).toUpperCase();
        }

        // Кнопка написати
        const contactBtn = document.getElementById('modal-contact-btn');
        contactBtn.onclick = () => contactUser(ad.user_id);
        if (isMe) contactBtn.style.display = 'none';
        else contactBtn.style.display = 'block';

        // 3. Галерея зображень
        const mainImg = document.getElementById('modal-ad-main-image');
        const gallery = document.getElementById('modal-ad-gallery');

        if (ad.images && ad.images.length > 0) {
            // Показуємо головне фото
            mainImg.src = ad.images[0];
            mainImg.classList.remove('hidden');

            // Якщо фото більше одного, будуємо галерею
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

    } catch (e) {
        console.error(e);
        document.getElementById('modal-ad-country').innerText = 'Помилка';
    }
};

function debounce(func, timeout = 300){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

window.toggleSaveAd = async (adId, event) => {
    if(event) event.stopPropagation();
    const token = localStorage.getItem('token');
    if(!token) return alert('Увійдіть, щоб зберігати оголошення');

    const icon = document.getElementById(`ad-bookmark-${adId}`);
    const isSaved = icon.classList.contains('fas');
    const method = isSaved ? 'DELETE' : 'POST';

    try {
        const res = await fetch(`${API_URL}/companion/ads/${adId}/save`, { method: method, headers: getHeaders() });
        if(res.ok) {
            icon.classList.toggle('fas');
            icon.classList.toggle('far');
            icon.parentElement.classList.toggle('text-[#48192E]'); // Змінити колір кнопки
        }
    } catch(e) { console.error(e); }
};