import { API_URL, getHeaders } from '../api-config.js';
import { setupTourPhotoUpload, getTourPhotos } from './create_tour.js';

let datePickerInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Глобальний слухач кліків (делегування)
    document.addEventListener('click', (e) => {
        handleGlobalClicks(e);
    });

    // 2. Глобальний слухач сабміту форм
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
    const restrictedSelectors = [
        '#agent-btn-account',
        '#agent-btn-add-tour',
        '#agent-btn-add-magnet',
        '#agent-btn-add-post'
    ];

    const clickedRestrictedBtn = e.target.closest(restrictedSelectors.join(', '));

    if (clickedRestrictedBtn) {
        const user = JSON.parse(localStorage.getItem('user'));

        if (!user || !user.isAgent) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('agent-mode-modal')?.classList.remove('active');

            if (confirm('Ця функція доступна лише для авторизованих турагентів. Перейти на сторінку входу для бізнесу?')) {
                window.location.href = 'agency_login.html';
            }
            return;
        }
    }

    const btnAddTour = e.target.closest('#agent-btn-add-tour');
    if (btnAddTour) {
        document.getElementById('agent-mode-modal')?.classList.remove('active');
        const modal = document.getElementById('modal-agent-add-tour');
        if (modal) {
            modal.classList.add('active');
            setupTourPhotoUpload();
            initDatePicker();
        }
        return;
    }

    const btnAccount = e.target.closest('#agent-btn-account');
    if (btnAccount) {
        document.getElementById('agent-mode-modal')?.classList.remove('active');
        window.location.href = 'agency_page.html';
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
            resetForms();
            // Очищаємо прив'язку до туру, якщо відкрили через меню, а не після створення туру
            const uploadForm = document.getElementById('form-magnet-upload');
            if(uploadForm) delete uploadForm.dataset.linkedTourId;
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
}

function initDatePicker() {
    const dateInput = document.getElementById('agent-tour-dates');
    if (dateInput && typeof flatpickr !== 'undefined') {
        // Якщо вже був створений - знищуємо старий (щоб очистити)
        if (datePickerInstance) datePickerInstance.destroy();

        datePickerInstance = flatpickr(dateInput, {
            mode: "multiple", // Дозволяє вибір кількох дат
            dateFormat: "Y-m-d",
            minDate: "today",
            locale: "uk", // Українська локалізація
            onChange: function(selectedDates, dateStr, instance) {
                // Можна додати логіку валідації тут
            }
        });
    }
}

// === ЛОГІКА ТУРІВ ===

async function handleTourSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = 'Публікація...';

    const formData = new FormData(form);

    let finalDates = [];
    if (datePickerInstance && datePickerInstance.selectedDates.length > 0) {
        finalDates = datePickerInstance.selectedDates.map(date => date.toISOString().split('T')[0]);
    }

    formData.delete('dates');
    if (finalDates.length > 0) {
        formData.append('dates', JSON.stringify(finalDates));
    }

    formData.delete('images');
    formData.delete('photos');

    const files = getTourPhotos();

    if (files.length > 0) {
        files.forEach(file => {
            formData.append('images', file);
        });
    }

    try {
        const response = await fetch(`${API_URL}/tours`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            alert('Тур успішно створено!');
            form.reset();
            document.getElementById('modal-agent-add-tour').classList.remove('active');

            // === ЛОГІКА ПЕРЕХОДУ ДО МАГНІТІВ ===
            if (confirm('Бажаєте додати унікальний магніт для цього туру, який клієнти отримають після бронювання?')) {
                const magnetModal = document.getElementById('modal-agent-add-magnet');
                if (magnetModal) {
                    magnetModal.classList.add('active');
                    resetForms();

                    // Зберігаємо ID туру в атрибут форми магніту
                    const uploadForm = document.getElementById('form-magnet-upload');
                    if (uploadForm) {
                        uploadForm.dataset.linkedTourId = data.tourId;
                        console.log("Linked Magnet to Tour ID:", data.tourId);
                    }
                }
            } else {
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

    // === ПЕРЕВІРКА ПРИВ'ЯЗКИ ДО ТУРУ ===
    const linkedTourId = form.dataset.linkedTourId;
    if (linkedTourId) {
        formData.append('linked_tour_id', linkedTourId);
    }

    await sendMagnetRequest(formData);
}

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

async function sendMagnetRequest(formData) {
    const modal = document.getElementById('modal-agent-add-magnet');
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

            // Очищення форми та видалення ID прив'язаного туру
            document.getElementById('form-magnet-upload').classList.add('hidden');
            document.getElementById('form-magnet-request').classList.add('hidden');
            document.getElementById('magnet-step-select').classList.remove('hidden');

            const uploadForm = document.getElementById('form-magnet-upload');
            if(uploadForm) delete uploadForm.dataset.linkedTourId;

            resetForms();

            // Оновлюємо сторінку, щоб побачити зміни
            window.location.reload();
        } else {
            alert(data.error || 'Помилка при створенні магніту');
        }
    } catch (error) {
        console.error(error);
        alert('Помилка сервера');
    } finally {
        submitBtns.forEach(b => {
            b.disabled = false;
            if (b.closest('#form-magnet-upload')) b.innerText = 'Створити магніт';
            else b.innerText = 'Надіслати запит';
        });
    }
}