import { API_URL, getHeaders } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {
    initMagnetModal();

    // === ДОДАНО: Обробка відкриття модалки через делегування ===
    document.addEventListener('click', (e) => {
        // Шукаємо кнопку (враховуючи, що клік може бути по іконці всередині кнопки)
        const btn = e.target.closest('#agent-btn-add-magnet');

        if (btn) {
            // Закриваємо попереднє меню агента
            const agentMenu = document.getElementById('agent-mode-modal');
            if (agentMenu) agentMenu.classList.remove('active');

            // Відкриваємо модалку додавання магніту
            const magnetModal = document.getElementById('modal-agent-add-magnet');
            if (magnetModal) magnetModal.classList.add('active');
        }
    });
});

function initMagnetModal() {
    const modal = document.getElementById('modal-agent-add-magnet');
    if (!modal) return;

    const stepSelect = document.getElementById('magnet-step-select');
    const formUpload = document.getElementById('form-magnet-upload');
    const formRequest = document.getElementById('form-magnet-request');

    // Кнопки вибору режиму
    document.getElementById('btn-choice-upload').addEventListener('click', () => {
        stepSelect.classList.add('hidden');
        formUpload.classList.remove('hidden');
    });

    document.getElementById('btn-choice-request').addEventListener('click', () => {
        stepSelect.classList.add('hidden');
        formRequest.classList.remove('hidden');
    });

    // Кнопки "Назад"
    document.querySelectorAll('.btn-back-step').forEach(btn => {
        btn.addEventListener('click', () => {
            formUpload.classList.add('hidden');
            formRequest.classList.add('hidden');
            stepSelect.classList.remove('hidden');
            resetForms();
        });
    });

    // --- Логіка завантаження файлу (Preview) ---
    const fileInput = document.getElementById('magnet-file-input');
    const previewImg = document.getElementById('magnet-preview-img');
    const previewArea = document.getElementById('magnet-preview-area');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                previewImg.classList.remove('hidden');
                previewArea.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    // --- Обробка форми Upload ---
    formUpload.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = fileInput.files[0];
        // Отримуємо вибрану радіокнопку
        const shape = document.querySelector('input[name="magnet_shape"]:checked').value;

        if (!file) {
            alert('Будь ласка, оберіть зображення.');
            return;
        }

        const formData = new FormData();
        formData.append('type', 'upload');
        formData.append('image', file);
        formData.append('shape', shape);

        await sendMagnetRequest(formData, modal);
    });

    // --- Обробка форми Request ---
    formRequest.addEventListener('submit', async (e) => {
        e.preventDefault();
        const comment = document.getElementById('magnet-request-text').value;

        if (!comment.trim()) {
            alert('Будь ласка, напишіть ваші побажання.');
            return;
        }

        const formData = new FormData(); // Використовуємо FormData для уніфікації
        formData.append('type', 'request');
        formData.append('comment', comment);

        await sendMagnetRequest(formData, modal);
    });
}

function resetForms() {
    document.getElementById('magnet-file-input').value = '';
    document.getElementById('magnet-preview-img').classList.add('hidden');
    document.getElementById('magnet-preview-area').classList.remove('hidden');
    document.getElementById('magnet-request-text').value = '';
}

async function sendMagnetRequest(formData, modal) {
    const submitBtns = modal.querySelectorAll('button[type="submit"]');
    submitBtns.forEach(b => { b.disabled = true; b.innerText = 'Відправка...'; });

    try {
        const response = await fetch(`${API_URL}/agencies/magnets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
                // Content-Type не встановлюємо вручну при FormData, браузер сам поставить multipart/form-data
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            modal.classList.remove('active');
            // Скидання стану модалки до початкового
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
            // Повертаємо текст кнопки (спрощено)
            if(b.closest('#form-magnet-upload')) b.innerText = 'Створити магніт';
            else b.innerText = 'Надіслати запит';
        });
    }
}