import { API_URL, getHeaders } from '../api-config.js';

// Отримуємо ID агенції з URL (наприклад: other_agency_profile.html?agency_id=5)
const urlParams = new URLSearchParams(window.location.search);
const agencyIdParam = urlParams.get('agency_id');
const userIdParam = urlParams.get('user_id');

let currentAgencyId = null;
const currentUser = JSON.parse(localStorage.getItem('user'));

document.addEventListener('DOMContentLoaded', async () => {
    if (agencyIdParam) {
        currentAgencyId = agencyIdParam;
    } else if (userIdParam) {
        // Якщо передано ID користувача-власника, а не агенції
        currentAgencyId = userIdParam;
    }

    if (!currentAgencyId) {
        alert('Не вказано ID агенції');
        window.location.href = 'main_page_tours.html';
        return;
    }

    loadAgencyData();
    initReviewForm();
});

// Глобальна функція для перемикання табів
window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-pill').forEach(el => el.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Активуємо кнопку
    const buttons = document.querySelectorAll('.nav-pill');
    if (tabName === 'tours') buttons[0].classList.add('active');
    if (tabName === 'posts') buttons[1].classList.add('active');
    if (tabName === 'reviews') buttons[2].classList.add('active');
};

async function loadAgencyData() {
    try {
        const response = await fetch(`${API_URL}/agencies/${currentAgencyId}`, { headers: getHeaders() });

        if (!response.ok) throw new Error('Agency not found');

        const data = await response.json();
        // Додаємо posts до деструктуризації
        const { agency, tours, reviews, posts } = data;

        // Оновлюємо currentAgencyId на правильний
        currentAgencyId = agency.agency_id;

        renderHeader(agency);
        renderTours(tours);
        renderPosts(posts); // Рендеримо пости
        renderReviews(reviews);

        // Логіка відображення форми відгуку
        const formContainer = document.getElementById('review-form-container');
        if (!currentUser) {
            formContainer.innerHTML = '<p class="text-center text-gray-500 py-4"><a href="login.html" class="text-[#48192E] font-bold underline">Увійдіть</a>, щоб залишити відгук.</p>';
        } else if (currentUser.userId === agency.owner_id) {
            formContainer.innerHTML = '<p class="text-center text-gray-500 py-4 bg-yellow-50 rounded-lg border border-yellow-100">Ви переглядаєте сторінку власної агенції.</p>';
        }

    } catch (error) {
        console.error(error);
        document.querySelector('main').innerHTML = '<div class="text-center py-20"><h2 class="text-2xl font-bold text-gray-700">Агенцію не знайдено</h2><a href="main_page_tours.html" class="text-[#48192E] underline mt-4 block">Повернутися до списку</a></div>';
    }
}

function renderHeader(agency) {
    document.getElementById('agency-name').innerText = agency.name;
    document.getElementById('agency-desc').innerText = agency.description || 'Опис відсутній.';
    document.getElementById('agency-rating').innerText = agency.avg_rating || '0.0';
    document.getElementById('agency-reviews-count').innerText = `(${agency.review_count} відгуків)`;

    if (agency.location) {
        document.getElementById('agency-location').innerHTML = `<i class="fas fa-map-marker-alt ml-2"></i> ${agency.location}`;
    } else {
        document.getElementById('agency-location').innerText = '';
    }

    // Логотип
    if (agency.logo_url) {
        const img = document.getElementById('agency-logo');
        img.src = agency.logo_url;
        img.classList.remove('hidden');
        document.getElementById('agency-logo-placeholder').classList.add('hidden');
    }

    // Контакти
    const phoneEl = document.getElementById('agency-phone');
    phoneEl.innerHTML = `<i class="fas fa-phone"></i> <span>${agency.phone}</span>`;
    phoneEl.href = `tel:${agency.phone}`;

    const emailEl = document.getElementById('agency-email');
    emailEl.innerHTML = `<i class="far fa-envelope"></i> <span>${agency.email}</span>`;
    emailEl.href = `mailto:${agency.email}`;

    const siteEl = document.getElementById('agency-website');
    if (agency.website) {
        siteEl.innerHTML = `<i class="fas fa-globe"></i> <span>Сайт</span>`;
        siteEl.href = agency.website;
        siteEl.style.display = 'flex';
    } else {
        siteEl.style.display = 'none';
    }

    // Кнопка повідомлення
    const msgBtn = document.getElementById('write-msg-btn');
    if (currentUser && currentUser.userId !== agency.owner_id) {
        msgBtn.classList.remove('hidden');
        msgBtn.onclick = () => window.location.href = `chat.html?user_id=${agency.owner_id}`;
    }
}

function renderTours(tours) {
    const container = document.getElementById('tours-grid');
    container.innerHTML = '';

    if (!tours || tours.length === 0) {
        container.innerHTML = '<p class="text-gray-500 col-span-3 text-center py-10">Агенція поки не додала турів.</p>';
        return;
    }

    tours.forEach(tour => {
        const image = tour.image_url || 'https://via.placeholder.com/400x300?text=No+Image';
        const html = `
            <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition cursor-pointer group" onclick="window.location.href='main_page_tours.html?tour_id=${tour.tour_id}'">
                <div class="h-48 relative overflow-hidden">
                    <img src="${image}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                    <span class="absolute top-2 right-2 bg-[#48192E] text-white text-xs px-2 py-1 rounded font-medium shadow-sm">${tour.category_name || 'Тур'}</span>
                </div>
                <div class="p-4">
                    <h3 class="font-bold text-[#281822] mb-1 truncate text-lg">${tour.title}</h3>
                    <div class="flex justify-between items-end mt-4">
                        <span class="text-sm text-gray-500 flex items-center gap-1"><i class="far fa-clock"></i> ${tour.duration_days} днів</span>
                        <span class="font-bold text-[#48192E] text-xl">${parseInt(tour.price_uah)} ₴</span>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderPosts(posts) {
    const container = document.getElementById('posts-grid');
    container.innerHTML = '';

    if (!posts || posts.length === 0) {
        container.innerHTML = '<p class="text-gray-500 col-span-2 text-center py-10">Постів поки немає.</p>';
        return;
    }

    posts.forEach(post => {
        let imagesHtml = '';
        if (post.images && post.images.length > 0) {
            const imgUrl = post.images[0];
            imagesHtml = `
                <div class="h-48 mb-4 rounded-lg overflow-hidden relative border border-gray-100">
                    <img src="${imgUrl}" class="w-full h-full object-cover">
                    ${post.images.length > 1 ? `<span class="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">+${post.images.length-1}</span>` : ''}
                </div>
            `;
        }

        const html = `
            <div class="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="font-bold text-lg text-[#281822]">${post.title}</h3>
                        <span class="text-xs text-gray-400">${new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                    <span class="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">${post.category}</span>
                </div>
                
                ${imagesHtml}
                
                <p class="text-gray-600 text-sm mb-4 line-clamp-3 leading-relaxed">${post.content}</p>
                
                <div class="flex items-center gap-4 text-gray-500 text-sm border-t border-gray-100 pt-3">
                    <span><i class="far fa-thumbs-up"></i> ${post.likes_count}</span>
                    <span><i class="far fa-comment-alt"></i> ${post.comments_count}</span>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderReviews(reviews) {
    const container = document.getElementById('reviews-list');
    container.innerHTML = '';

    if (!reviews || reviews.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-6 italic">Відгуків ще немає. Будьте першим!</p>';
        return;
    }

    reviews.forEach(review => {
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

        let avatarHtml;
        if (review.profile_image_url) {
            avatarHtml = `<img src="${review.profile_image_url}" class="w-10 h-10 rounded-full object-cover border border-gray-200">`;
        } else {
            const initials = (review.first_name?.[0] || '') + (review.last_name?.[0] || '');
            avatarHtml = `<div class="w-10 h-10 rounded-full bg-[#2D4952] text-white flex items-center justify-center font-bold text-sm">${initials}</div>`;
        }

        const html = `
            <div class="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-3">
                        ${avatarHtml}
                        <div>
                            <div class="font-bold text-[#281822] text-sm">${review.first_name} ${review.last_name}</div>
                            <div class="text-xs text-gray-400">${new Date(review.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div class="text-[#f59e0b] text-lg leading-none tracking-widest" title="${review.rating}/5">${stars}</div>
                </div>
                <p class="text-gray-700 text-sm leading-relaxed">${review.comment || ''}</p>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function initReviewForm() {
    const form = document.getElementById('review-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const ratingEl = document.querySelector('input[name="rating"]:checked');
        const comment = document.getElementById('review-text').value;
        const btn = form.querySelector('button[type="submit"]');

        if (!ratingEl) {
            alert('Будь ласка, поставте оцінку (зірочки).');
            return;
        }

        const rating = parseInt(ratingEl.value);
        btn.disabled = true;
        btn.innerText = 'Публікація...';

        try {
            const response = await fetch(`${API_URL}/agencies/${currentAgencyId}/reviews`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ rating, comment })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Дякуємо за ваш відгук!');
                form.reset();
                loadAgencyData(); // Перезавантажуємо дані
            } else {
                alert(data.error || 'Помилка');
            }
        } catch (error) {
            console.error(error);
            alert('Помилка з\'єднання з сервером');
        } finally {
            btn.disabled = false;
            btn.innerText = 'Опублікувати відгук';
        }
    });
}