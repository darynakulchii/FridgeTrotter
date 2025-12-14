import { API_URL, getHeaders } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Глобальний слухач кліків (делегування)
    // Дозволяє обробляти кліки по елементах, які з'являються динамічно (наприклад, з navigation.html)
    document.addEventListener('click', (e) => {
        handleGlobalClicks(e);
    });

    // 2. Глобальний слухач сабміту форм
    // Перехоплює відправку будь-якої форми на сторінці і перевіряє її ID
    document.addEventListener('submit', async (e) => {
        if (e.target.id === 'form-add-tour') {
            await handleTourSubmit(e);
        } else if (e.target.id === 'form-magnet-upload') {
            e.preventDefault();
            await handleUploadSubmit(e.target);
        } else if (e.target.id === 'form-magnet-request') {
            e.preventDefault();
            await handleRequestSubmit(e.target);
        }
    });

    // 3. Слухач зміни input type="file" для прев'ю
    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'magnet-file-input') {
            handleFileSelect(e.target);
        }
    });
});

function handleGlobalClicks(e) {
    // --- ВІДКРИТТЯ МОДАЛКИ ДОДАВАННЯ ТУРУ ---
    // Шукаємо кнопку через closest, бо клік може бути по іконці всередині кнопки
    const btnAddTour = e.target.closest('#agent-btn-add-tour');
    if (btnAddTour) {
        // Закриваємо меню агента
        document.getElementById('agent-mode-modal')?.classList.remove('active');
        // Відкриваємо модалку туру
        const modal = document.getElementById('modal-agent-add-tour');
        if (modal) modal.classList.add('active');
        return;
    }

    // --- ЛОГІКА МАГНІТІВ ---

    // 1. Відкриття модального вікна "Додати магніт"
    const btnAddMagnet = e.target.closest('#agent-btn-add-magnet');
    if (btnAddMagnet) {
        document.getElementById('agent-mode-modal')?.classList.remove('active');
        const modal = document.getElementById('modal-agent-add-magnet');
        if (modal) {
            modal.classList.add('active');
            resetForms(); // Скидаємо форми при відкритті
        }
        return;
    }

    // 2. Кнопка "Завантажити свій дизайн" (всередині модалки магнітів)
    const btnUpload = e.target.closest('#btn-choice-upload');
    if (btnUpload) {
        document.getElementById('magnet-step-select').classList.add('hidden');
        document.getElementById('form-magnet-upload').classList.remove('hidden');
        return;
    }

    // 3. Кнопка "Замовити дизайн" (всередині модалки магнітів)
    const btnRequest = e.target.closest('#btn-choice-request');
    if (btnRequest) {
        document.getElementById('magnet-step-select').classList.add('hidden');
        document.getElementById('form-magnet-request').classList.remove('hidden');
        return;
    }

    // 4. Кнопки "Назад" у формах магнітів
    const btnBack = e.target.closest('.btn-back-step');
    if (btnBack) {
        document.getElementById('form-magnet-upload').classList.add('hidden');
        document.getElementById('form-magnet-request').classList.add('hidden');
        document.getElementById('magnet-step-select').classList.remove('hidden');
        resetForms();
        return;
    }
}

// === ЛОГІКА ТУРІВ ===

// Функція обробки створення туру
async function handleTourSubmit(e) {
    e.preventDefault(); // Зупиняємо стандартну відправку форми
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    // Блокуємо кнопку, щоб уникнути подвійних кліків
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = 'Публікація...';

    const formData = new FormData(form);

    try {
        const response = await fetch(`${API_URL}/tours`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData // FormData автоматично встановлює правильний Content-Type
        });

        const data = await response.json();

        if (response.ok) {
            alert('Тур успішно створено!');
            form.reset(); // Очищаємо форму

            // Скидаємо текст інпуту файлу
            const fileNameLabel = document.getElementById('tour-file-name');
            if(fileNameLabel) fileNameLabel.innerText = 'Натисніть щоб завантажити фото';

            // Закриваємо модалку
            document.getElementById('modal-agent-add-tour').classList.remove('active');

            // Якщо ми на сторінці турів або профілю, перезавантажуємо, щоб побачити зміни
            if (window.location.pathname.includes('main_page_tours') || window.location.pathname.includes('my_profile')) {
                window.location.reload();
            }
        } else {
            alert(data.error || 'Помилка при створенні туру');
        }
    } catch (error) {
        console.error('Error creating tour:', error);
        alert('Помилка з\'єднання з сервером');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
    }
}

// === ЛОГІКА МАГНІТІВ ===

// Логіка прев'ю файлу для магнітів
function handleFileSelect(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImg = document.getElementById('magnet-preview-img');
            const previewArea = document.getElementById('magnet-preview-area');
            if (previewImg && previewArea) {
                previewImg.src = e.target.result;
                previewImg.classList.remove('hidden');
                previewArea.classList.add('hidden');
            }
        };
        reader.readAsDataURL(file);
    }
}

function resetForms() {
    const fileInput = document.getElementById('magnet-file-input');
    const previewImg = document.getElementById('magnet-preview-img');
    const previewArea = document.getElementById('magnet-preview-area');
    const requestText = document.getElementById('magnet-request-text');
    const countryInput = document.getElementById('magnet-country');
    const cityInput = document.getElementById('magnet-city');

    if (fileInput) fileInput.value = '';
    if (previewImg) previewImg.classList.add('hidden');
    if (previewArea) previewArea.classList.remove('hidden');
    if (requestText) requestText.value = '';
    if (countryInput) countryInput.value = '';
    if (cityInput) cityInput.value = '';
}

// Обробка відправки форми Upload Magnet
async function handleUploadSubmit(form) {
    const fileInput = document.getElementById('magnet-file-input');
    const file = fileInput.files[0];
    const shapeInput = form.querySelector('input[name="magnet_shape"]:checked');
    const shape = shapeInput ? shapeInput.value : 'square';
    const country = document.getElementById('magnet-country').value;
    const city = document.getElementById('magnet-city').value;

    if (!file) {
        alert('Будь ласка, оберіть зображення.');
        return;
    }

    if (!country || !city) {
        alert('Будь ласка, вкажіть країну та місто.');
        return;
    }

    const formData = new FormData();
    formData.append('type', 'upload');
    formData.append('image', file);
    formData.append('shape', shape);
    formData.append('country', country);
    formData.append('city', city);

    await sendMagnetRequest(formData);
}

// Обробка відправки форми Request Magnet
async function handleRequestSubmit(form) {
    const comment = document.getElementById('magnet-request-text').value;

    if (!comment.trim()) {
        alert('Будь ласка, напишіть ваші побажання.');
        return;
    }

    const formData = new FormData();
    formData.append('type', 'request');
    formData.append('comment', comment);

    await sendMagnetRequest(formData);
}

// Спільна функція відправки магнітів на сервер
async function sendMagnetRequest(formData) {
    const modal = document.getElementById('modal-agent-add-magnet');

    // Блокуємо кнопки
    const submitBtns = modal.querySelectorAll('button[type="submit"]');
    submitBtns.forEach(b => { b.disabled = true; b.innerText = 'Відправка...'; });

    try {
        const response = await fetch(`${API_URL}/agencies/magnets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            modal.classList.remove('active');
            // Скидання стану
            document.getElementById('form-magnet-upload').classList.add('hidden');
            document.getElementById('form-magnet-request').classList.add('hidden');
            document.getElementById('magnet-step-select').classList.remove('hidden');
            resetForms();
        } else {
            alert(data.error || 'Помилка при створенні замовлення');
        }
    } catch (error) {
        console.error(error);
        alert('Помилка сервера');
    } finally {
        submitBtns.forEach(b => {
            b.disabled = false;
            // Відновлюємо текст кнопки
            if (b.closest('#form-magnet-upload')) b.innerText = 'Створити магніт';
            else b.innerText = 'Надіслати запит';
        });
    }
}