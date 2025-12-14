/* js/modules/create_post.js */
import { API_URL } from '../api-config.js';

let selectedFiles = [];
const MAX_PHOTOS = 8;

export function initPostForm(onSuccessCallback) {
    const form = document.getElementById('create-post-form');
    // Отримуємо початкове посилання, але воно застаріє після клонування
    let imageInput = document.getElementById('new-post-images');
    const previewContainer = document.getElementById('image-preview-container');

    if (!form || !imageInput || !previewContainer) return;

    // --- КЛОНУВАННЯ ІНПУТА (Це робиться на початку) ---
    const newInput = imageInput.cloneNode(true);
    imageInput.parentNode.replaceChild(newInput, imageInput);

    // ВАЖЛИВО: Оновлюємо змінну imageInput, щоб вона вказувала на НОВИЙ елемент
    imageInput = newInput;

    // --- Функція оновлення сітки (відображення) ---
    const updatePhotoDisplay = () => {
        previewContainer.innerHTML = '';

        // 1. Рендеримо вибрані фото
        selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'photo-upload-placeholder preview';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'photo-delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.type = 'button';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                removeFile(index);
            };
            div.appendChild(deleteBtn);

            const reader = new FileReader();
            reader.onload = (e) => {
                div.style.backgroundImage = `url('${e.target.result}')`;
            };
            reader.readAsDataURL(file);

            previewContainer.appendChild(div);
        });

        // 2. Кнопка "+ Додати"
        if (selectedFiles.length < MAX_PHOTOS) {
            const addBtn = document.createElement('div');
            addBtn.className = 'photo-upload-placeholder add-photo-btn';
            addBtn.innerHTML = '<i class="fas fa-plus"></i> Додати';

            // ТУТ БУЛА ПОМИЛКА: раніше тут викликався клік по старому елементу
            // Тепер imageInput вказує на актуальний елемент завдяки рядку 19
            addBtn.onclick = () => imageInput.click();

            previewContainer.appendChild(addBtn);
        }

        // 3. Заповнюємо решту місць
        const filledSlots = selectedFiles.length + (selectedFiles.length < MAX_PHOTOS ? 1 : 0);
        for (let i = filledSlots; i < MAX_PHOTOS; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'photo-upload-placeholder';
            previewContainer.appendChild(emptyDiv);
        }
    };

    const removeFile = (index) => {
        selectedFiles.splice(index, 1);
        imageInput.value = '';
        updatePhotoDisplay();
    };

    // --- Слухач вибору файлів (на НОВОМУ інпуті) ---
    imageInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const availableSlots = MAX_PHOTOS - selectedFiles.length;
        if (files.length > availableSlots) {
            alert(`Можна додати ще максимум ${availableSlots} фото.`);
        }

        const filesToAdd = files.slice(0, availableSlots);
        selectedFiles = [...selectedFiles, ...filesToAdd];

        imageInput.value = '';
        updatePhotoDisplay();
    });

    // ... (код обробки submit залишається без змін, тільки використовуйте selectedFiles)

    // --- Відправка форми ---
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        // ... Ваш існуючий код сабміту ...
        // (Весь код всередині такий самий, як у вас був)
        e.preventDefault();
        const submitBtn = newForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = 'Публікація...';

        const formData = new FormData();
        formData.append('title', document.getElementById('new-post-title').value);
        formData.append('category', document.getElementById('new-post-category').value);
        formData.append('content', document.getElementById('new-post-content').value);

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
                selectedFiles = [];
                updatePhotoDisplay();
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

    // Ініціалізація
    if (onSuccessCallback) {
        selectedFiles = [];
    }
    updatePhotoDisplay();
}