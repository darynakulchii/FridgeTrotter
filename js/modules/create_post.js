import { API_URL } from '../api-config.js';

let selectedFiles = []; // Масив для зберігання файлів
const MAX_PHOTOS = 8;   // Ліміт для постів

export function initPostForm(onSuccessCallback) {
    const form = document.getElementById('create-post-form');
    const imageInput = document.getElementById('new-post-images');
    const previewContainer = document.getElementById('image-preview-container');

    if (!form || !imageInput || !previewContainer) return;

    // --- Функція оновлення сітки (відображення) ---
    const updatePhotoDisplay = () => {
        previewContainer.innerHTML = ''; // Очищаємо контейнер

        // 1. Рендеримо вибрані фото
        selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'photo-upload-placeholder preview';

            // Кнопка видалення (хрестик)
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'photo-delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.type = 'button';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                removeFile(index);
            };
            div.appendChild(deleteBtn);

            // Читаємо файл і ставимо як фон
            const reader = new FileReader();
            reader.onload = (e) => {
                div.style.backgroundImage = `url('${e.target.result}')`;
            };
            reader.readAsDataURL(file);

            previewContainer.appendChild(div);
        });

        // 2. Кнопка "+ Додати" (якщо ліміт не досягнуто)
        if (selectedFiles.length < MAX_PHOTOS) {
            const addBtn = document.createElement('div');
            addBtn.className = 'photo-upload-placeholder add-photo-btn';
            addBtn.innerHTML = '<i class="fas fa-plus"></i> Додати';
            addBtn.onclick = () => imageInput.click();
            previewContainer.appendChild(addBtn);
        }

        // 3. Заповнюємо решту місць пустими квадратами
        // Рахуємо скільки слотів зайнято (фото + кнопка додавання)
        const filledSlots = selectedFiles.length + (selectedFiles.length < MAX_PHOTOS ? 1 : 0);
        for (let i = filledSlots; i < MAX_PHOTOS; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'photo-upload-placeholder';
            previewContainer.appendChild(emptyDiv);
        }
    };

    // Видалення файлу з масиву
    const removeFile = (index) => {
        selectedFiles.splice(index, 1);
        imageInput.value = ''; // Скидаємо інпут
        updatePhotoDisplay();
    };

    // --- Слухач вибору файлів ---
    // Клонуємо інпут, щоб очистити старі слухачі (важливо для модалок)
    const newInput = imageInput.cloneNode(true);
    imageInput.parentNode.replaceChild(newInput, imageInput);

    // Отримуємо посилання на новий інпут
    const currentInput = document.getElementById('new-post-images');

    currentInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const availableSlots = MAX_PHOTOS - selectedFiles.length;
        if (files.length > availableSlots) {
            alert(`Можна додати ще максимум ${availableSlots} фото.`);
        }

        // Додаємо тільки ті, що влазять у ліміт
        const filesToAdd = files.slice(0, availableSlots);
        selectedFiles = [...selectedFiles, ...filesToAdd];

        currentInput.value = ''; // Очищаємо value, щоб можна було додати ті ж файли знову
        updatePhotoDisplay();
    });

    // --- Відправка форми ---
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = newForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = 'Публікація...';

        const formData = new FormData();
        formData.append('title', document.getElementById('new-post-title').value);
        formData.append('category', document.getElementById('new-post-category').value);
        formData.append('content', document.getElementById('new-post-content').value);

        // Додаємо файли з нашого масиву у FormData
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
                newForm.reset();
                selectedFiles = []; // Очищаємо масив
                updatePhotoDisplay(); // Скидаємо вигляд сітки

                if (onSuccessCallback) onSuccessCallback();
                else window.location.href = 'forum.html';
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
    });

    // Ініціалізація при відкритті (скидаємо стан, якщо це нове відкриття)
    if (onSuccessCallback) {
        selectedFiles = [];
    }
    updatePhotoDisplay();
}