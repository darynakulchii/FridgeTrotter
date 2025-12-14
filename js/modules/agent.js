import { API_URL, getHeaders } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Слухач подій для всього документа (делегування)
    document.addEventListener('click', (e) => {
        handleGlobalClicks(e);
    });

    // Ініціалізація логіки завантаження файлів (вона потребує прив'язки до input, коли він з'явиться)
    // Оскільки input теж динамічний, краще також використати делегування для 'change'
    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'magnet-file-input') {
            handleFileSelect(e.target);
        }
    });
});

function handleGlobalClicks(e) {
    // 1. Відкриття модального вікна "Додати магніт"
    const openBtn = e.target.closest('#agent-btn-add-magnet');
    if (openBtn) {
        // Закриваємо меню агента
        document.getElementById('agent-mode-modal')?.classList.remove('active');
        // Відкриваємо модалку магніту
        const modal = document.getElementById('modal-agent-add-magnet');
        if (modal) {
            modal.classList.add('active');
            resetForms(); // Скидаємо форми при відкритті
        }
        return;
    }

    // 2. Кнопка "Завантажити свій дизайн"
    const btnUpload = e.target.closest('#btn-choice-upload');
    if (btnUpload) {
        document.getElementById('magnet-step-select').classList.add('hidden');
        document.getElementById('form-magnet-upload').classList.remove('hidden');
        return;
    }

    // 3. Кнопка "Замовити дизайн"
    const btnRequest = e.target.closest('#btn-choice-request');
    if (btnRequest) {
        document.getElementById('magnet-step-select').classList.add('hidden');
        document.getElementById('form-magnet-request').classList.remove('hidden');
        return;
    }

    // 4. Кнопки "Назад"
    const btnBack = e.target.closest('.btn-back-step');
    if (btnBack) {
        document.getElementById('form-magnet-upload').classList.add('hidden');
        document.getElementById('form-magnet-request').classList.add('hidden');
        document.getElementById('magnet-step-select').classList.remove('hidden');
        resetForms();
        return;
    }

    // 5. Сабміт форм (кнопки всередині форм)
    // Оскільки button type="submit", краще слухати подію 'submit' на документі, див. нижче
}

// Обробка відправки форм через делегування 'submit'
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'form-magnet-upload') {
        e.preventDefault();
        await handleUploadSubmit(e.target);
    } else if (e.target.id === 'form-magnet-request') {
        e.preventDefault();
        await handleRequestSubmit(e.target);
    }
});

// Логіка прев'ю файлу
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

// Обробка відправки форми Upload
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

// Обробка відправки форми Request
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

// Спільна функція відправки на сервер
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