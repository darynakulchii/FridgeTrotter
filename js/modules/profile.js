import { API_URL, getHeaders } from '../api-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Перевірка чи залогінений
    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
        return;
    }

    await loadUserProfile();
    await loadFridge();
    await loadSavedTours();
});

// 1. Завантаження інфо профілю
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_URL}/user/profile`, {
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();

        // Заповнюємо поля (додайте перевірки на null)
        const nameInput = document.getElementById('profile-name');
        if(nameInput) nameInput.value = `${data.first_name || ''} ${data.last_name || ''}`;

        document.getElementById('profile-email').value = data.email || '';
        document.getElementById('profile-location').value = data.location || '';
        document.getElementById('profile-bio').value = data.bio || '';
        document.getElementById('profile-interests').value = data.travel_interests || '';

        // Статистика
        document.querySelector('.stat-number:nth-child(1)').innerText = data.countries_visited || 0; // Це грубий спосіб, краще додати ID до блоків статистики

    } catch (error) {
        console.error('Error loading profile', error);
    }
}

// 2. Завантаження Холодильника
async function loadFridge() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    try {
        const response = await fetch(`${API_URL}/fridge/${user.userId}/layout`, { headers: getHeaders() });
        const data = await response.json();

        const fridgeDoor = document.getElementById('fridge-door');
        const placeholder = document.getElementById('fridge-placeholder');

        // Очистити старі магніти (окрім ручки та плейсхолдера)
        // Найпростіше: видалити елементи з класом .magnet-on-fridge
        fridgeDoor.querySelectorAll('.magnet-on-fridge').forEach(el => el.remove());

        if (data.magnets && data.magnets.length > 0) {
            placeholder.classList.add('hidden');

            data.magnets.forEach(mag => {
                const el = document.createElement('div');
                el.classList.add('magnet-on-fridge');
                // Додаємо класи кольору залежно від групи (або рандомно, якщо в БД немає)
                el.classList.add(mag.color_group === 'teal' ? 'teal' : 'burgundy');

                el.style.left = mag.x_position + 'px';
                el.style.top = mag.y_position + 'px';
                el.innerHTML = `<i class="fas fa-${mag.icon_class}"></i><div>${mag.city}</div>`;

                fridgeDoor.appendChild(el);
            });
        }
    } catch (e) { console.error(e); }
}

// 3. Завантаження збережених турів
async function loadSavedTours() {
    const container = document.getElementById('tab-saved-tours'); // Переконайтесь, що це контейнер, або знайдіть грід всередині
    const grid = container.querySelector('.grid'); // Шукаємо грід всередині таба
    if(!grid) return;

    try {
        const response = await fetch(`${API_URL}/tours/saved`, { headers: getHeaders() });
        const data = await response.json();

        grid.innerHTML = ''; // Очистка

        if (data.tours.length === 0) {
            grid.innerHTML = '<p>Немає збережених турів</p>';
            return;
        }

        data.tours.forEach(tour => {
            // Використовуйте той самий шаблон картки, що і в tours.js, але з кнопкою "Видалити"
            const html = `
                <div class="tour-card-saved shadow-md flex flex-col h-full overflow-hidden p-0">
                    <div class="relative h-48">
                         <img src="${tour.image_url || 'https://via.placeholder.com/400'}" class="w-full h-full object-cover">
                    </div>
                    <div class="p-5">
                        <h3 class="font-bold">${tour.title}</h3>
                        <div class="font-bold text-[#48192E] mt-2">${tour.price_uah} ₴</div>
                    </div>
                </div>
             `;
            grid.insertAdjacentHTML('beforeend', html);
        });

    } catch (e) { console.error(e); }
}