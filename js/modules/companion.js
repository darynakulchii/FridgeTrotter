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
            const isMe = currentUser && currentUser.userId == ad.user_id;
            const profileLink = isMe ? 'my_profile.html' : `other_user_profile.html?user_id=${ad.user_id}`;

            const ageDisplay = ad.author_age ? `• ${ad.author_age} років` : '';
            const start = new Date(ad.start_date).toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'});
            const end = new Date(ad.end_date).toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'});

            // Бюджет
            let budgetHtml = '';
            if (ad.budget_min || ad.budget_max) {
                const min = ad.budget_min ? parseInt(ad.budget_min) : 0;
                const max = ad.budget_max ? parseInt(ad.budget_max) : '...';
                budgetHtml = `
                    <div class="flex items-center gap-2 text-sm text-gray-700">
                        <i class="fas fa-wallet text-[#2D4952] w-5 text-center"></i>
                        <span>${min} - ${max} грн</span>
                    </div>`;
            }

            // Фото
            let mainImage = 'https://via.placeholder.com/400x200?text=No+Image';
            if (ad.images && ad.images.length > 0) {
                mainImage = ad.images[0];
            }

            // Аватар
            let avatarContent;
            if (ad.author_avatar) {
                avatarContent = `<img src="${ad.author_avatar}" class="w-full h-full object-cover">`;
            } else {
                avatarContent = (ad.first_name[0] + ad.last_name[0]).toUpperCase();
            }

            const html = `
                <div class="universal-card cursor-pointer group" onclick="openAdDetails(${ad.ad_id})">
                    
                    <div class="card-header-user">
                        <a href="${profileLink}" class="card-avatar" style="background-color: #2D4952;">
                            ${avatarContent}
                        </a>
                        <div class="card-user-info">
                            <div class="flex items-center gap-2">
                                <a href="${profileLink}" class="card-user-name hover:underline">
                                    ${ad.first_name} ${ad.last_name}
                                </a>
                                <span class="text-xs text-gray-500">${ageDisplay}</span>
                            </div>
                            <div class="text-[#48192E] font-semibold text-sm mt-0.5">
                                <i class="fas fa-map-marker-alt mr-1"></i> ${ad.destination_country}
                            </div>
                        </div>
                    </div>

                    <div class="card-image-middle h-56 bg-gray-50 relative overflow-hidden">
                        <img src="${mainImage}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105">
                    </div>

                    <div class="card-body flex flex-col p-4 pb-0">
                        <p class="text-gray-600 text-sm mb-4 line-clamp-3 leading-relaxed">
                            ${ad.description}
                        </p>
                        
                        <div class="space-y-2 mb-2 bg-gray-50 p-3 rounded-lg mt-auto">
                            <div class="flex items-center gap-2 text-sm text-gray-700">
                                <i class="far fa-calendar text-[#2D4952] w-5 text-center"></i>
                                <span>${start} - ${end}</span>
                            </div>
                             <div class="flex items-center gap-2 text-sm text-gray-700">
                                <i class="fas fa-user-friends text-[#2D4952] w-5 text-center"></i>
                                <span>${ad.min_group_size}-${ad.max_group_size} особи</span>
                            </div>
                            ${budgetHtml}
                        </div>
                        
                         <div class="flex flex-wrap gap-2 mt-2">
                            ${(ad.tags || []).slice(0, 3).map(tag => `<span class="tag-pill">${tag}</span>`).join('')}
                        </div>
                    </div>

                    <div class="card-footer gap-2 px-4 py-3 border-t border-gray-100 flex items-center !mt-0">
                        <div class="mr-auto"></div> <button onclick="toggleSaveAd(${ad.ad_id}, event)" class="btn-icon-square" title="Зберегти">
                            <i class="far fa-bookmark" id="ad-bookmark-${ad.ad_id}"></i>
                        </button>
                        <button onclick="openAdDetails(${ad.ad_id})" class="btn-outline px-4 text-sm h-10">
                            Деталі
                        </button>
                        <button onclick="contactUser(${ad.user_id})" class="btn-fill px-4 text-sm h-10">
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

    document.getElementById('modal-ad-country').innerText = 'Завантаження...';
    document.getElementById('modal-ad-main-image').classList.add('hidden');
    document.getElementById('modal-ad-gallery').innerHTML = '';

    try {
        const response = await fetch(`${API_URL}/companion/ads/${adId}`, { headers: getHeaders() });
        const data = await response.json();
        const ad = data.ad;

        document.getElementById('modal-ad-country').innerText = ad.destination_country;
        document.getElementById('modal-ad-desc').innerText = ad.description;

        const start = new Date(ad.start_date).toLocaleDateString('uk-UA');
        const end = new Date(ad.end_date).toLocaleDateString('uk-UA');
        document.getElementById('modal-ad-dates').innerText = `${start} — ${end}`;

        const minB = ad.budget_min ? parseInt(ad.budget_min) : 0;
        const maxB = ad.budget_max ? parseInt(ad.budget_max) : '...';
        document.getElementById('modal-ad-budget').innerText = `${minB} - ${maxB} грн`;

        document.getElementById('modal-ad-group').innerText = `${ad.min_group_size} - ${ad.max_group_size} осіб`;

        const tagsContainer = document.getElementById('modal-ad-tags');
        tagsContainer.innerHTML = (ad.tags || []).map(t => `<span class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">${t}</span>`).join('');

        const isMe = currentUser && currentUser.userId == ad.user_id;
        const profileLink = isMe ? 'my_profile.html' : `other_user_profile.html?user_id=${ad.user_id}`;

        document.getElementById('modal-author-name-link').innerText = `${ad.first_name} ${ad.last_name}`;
        document.getElementById('modal-author-name-link').href = profileLink;

        document.getElementById('modal-author-link').href = profileLink;
        document.getElementById('modal-author-age').innerText = ad.author_age ? `${ad.author_age} років` : 'Вік приховано';

        const avatarEl = document.getElementById('modal-ad-avatar');
        if (ad.author_avatar) {
            avatarEl.innerHTML = `<img src="${ad.author_avatar}" class="w-full h-full object-cover">`;
        } else {
            avatarEl.innerText = (ad.first_name[0] + ad.last_name[0]).toUpperCase();
        }

        const contactBtn = document.getElementById('modal-contact-btn');
        contactBtn.onclick = () => contactUser(ad.user_id);
        if (isMe) contactBtn.style.display = 'none';
        else contactBtn.style.display = 'block';

        const mainImg = document.getElementById('modal-ad-main-image');
        const gallery = document.getElementById('modal-ad-gallery');

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
            icon.parentElement.classList.toggle('text-[#48192E]');
        }
    } catch(e) { console.error(e); }
};