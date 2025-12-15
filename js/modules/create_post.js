import { API_URL } from '../api-config.js';

// Локальний стан для зберігання вибраних файлів
let selectedFiles = [];
const MAX_PHOTOS = 8;

export function initPostForm(onSuccessCallback) {
    const form = document.getElementById('create-post-form');
    if (!form) return;

    // 1. Скидаємо стан (очищаємо масив файлів, поля форми) при кожному виклику (відкритті модалки)
    resetFormState();

    // Зберігаємо колбек на елементі форми, щоб використати його при сабміті
    form._onSuccessCallback = onSuccessCallback;

    // 2. Перевіряємо, чи ми вже ініціалізували цю форму раніше
    if (form.dataset.initialized === 'true') {
        // Якщо так — просто оновлюємо сітку (вона буде пуста після resetFormState) і виходимо
        updatePhotoDisplay();
        return;
    }

    // === ІНІЦІАЛІЗАЦІЯ СЛУХАЧІВ (Виконується лише 1 раз) ===

    const photoInput = document.getElementById('postPhotosInput');

    // Слухач вибору файлів
    if (photoInput) {
        photoInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;

            const availableSlots = MAX_PHOTOS - selectedFiles.length;
            if (files.length > availableSlots) {
                alert(`Можна додати ще максимум ${availableSlots} фото.`);
            }

            // Додаємо нові файли до масиву
            const filesToAdd = files.slice(0, availableSlots);
            selectedFiles = [...selectedFiles, ...filesToAdd];

            // Очищаємо інпут, щоб можна було вибрати той самий файл повторно, якщо треба
            e.target.value = '';

            // Оновлюємо прев'ю
            updatePhotoDisplay();
        });
    }

    // Слухач відправки форми
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleFormSubmit(form);
    });

    // Помічаємо форму як ініціалізовану, щоб не додавати слухачі знову
    form.dataset.initialized = 'true';

    // Перше відображення сітки
    updatePhotoDisplay();
}

// Функція повного скидання форми
function resetFormState() {
    selectedFiles = [];
    const form = document.getElementById('create-post-form');
    if (form) form.reset();
    updatePhotoDisplay();
}

// Оновлення відображення фотографій
function updatePhotoDisplay() {
    const previewContainer = document.getElementById('postPhotoPreviewContainer');
    if (!previewContainer) return;

    previewContainer.innerHTML = '';

    // 1. Відображаємо вже вибрані фото
    selectedFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'photo-upload-placeholder preview';

        // Кнопка видалення
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'photo-delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.type = 'button';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            removeFile(index);
        };
        div.appendChild(deleteBtn);

        // Позначка "Головне"
        if (index === 0) {
            const mainLabel = document.createElement('span');
            mainLabel.className = 'photo-main-label';
            mainLabel.textContent = 'Головне';
            div.appendChild(mainLabel);
        }

        // FileReader для прев'ю
        const reader = new FileReader();
        reader.onload = (e) => {
            div.style.backgroundImage = `url('${e.target.result}')`;
        };
        reader.readAsDataURL(file);

        previewContainer.appendChild(div);
    });

    // 2. Кнопка "+ Додати фото" (якщо є місце)
    if (selectedFiles.length < MAX_PHOTOS) {
        const addBtn = document.createElement('div');
        addBtn.className = 'photo-upload-placeholder add-photo-btn';
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Додати фото';

        // Клік по діву викликає клік по прихованому інпуту
        addBtn.onclick = () => {
            const input = document.getElementById('postPhotosInput');
            if(input) input.click();
        };

        previewContainer.appendChild(addBtn);
    }

    // 3. Пусті квадрати для краси (заповнюють рядок мінімум до 4)
    const filledSlots = selectedFiles.length + (selectedFiles.length < MAX_PHOTOS ? 1 : 0);
    // Якщо хочемо, щоб завжди було мінімум 4 слоти в рядку:
    const minSlots = 4;
    for (let i = filledSlots; i < minSlots; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'photo-upload-placeholder';
        previewContainer.appendChild(emptyDiv);
    }
}

// Видалення файлу з масиву
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updatePhotoDisplay();
}

// Обробка відправки на сервер
async function handleFormSubmit(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = 'Публікація...';

    const formData = new FormData();
    formData.append('title', document.getElementById('new-post-title').value);
    formData.append('category', document.getElementById('new-post-category').value);
    formData.append('content', document.getElementById('new-post-content').value);

    // Додаємо файли з локального масиву
    selectedFiles.forEach(file => {
        formData.append('images', file);
    });

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/forum/posts`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (response.ok) {
            // Успіх
            resetFormState();

            // Викликаємо колбек (наприклад, закрити модалку і оновити список)
            if (form._onSuccessCallback) {
                form._onSuccessCallback();
            } else {
                window.location.href = 'forum.html';
            }
        } else {
            const data = await response.json();
            alert(data.error || 'Помилка створення поста');
        }
    } catch (error) {
        console.error(error);
        alert('Помилка з\'єднання');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
    }
}

// Автоініціалізація, якщо скрипт підключено на сторінці без модалки (наприклад, окрема сторінка створення)
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('create-post-form');
    const modal = document.getElementById('create-post-modal');
    // Ініціалізуємо тільки якщо форми немає в модалці (якщо в модалці, ініціалізацію викличе кнопка "Створити")
    if (form && !modal) {
        initPostForm();
    }
});