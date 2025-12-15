/* js/modules/create_post.js */
import { API_URL } from '../api-config.js';

let selectedFiles = [];
const MAX_PHOTOS = 8;

export function initPostForm(onSuccessCallback) {
    const form = document.getElementById('create-post-form');
    // Отримуємо елементи. Використовуємо let, бо будемо замінювати input
    let imageInput = document.getElementById('new-post-images');
    const previewContainer = document.getElementById('image-preview-container');

    if (!form || !imageInput || !previewContainer) return;

    // 1. Скидаємо масив файлів при ініціалізації (важливо для модалок)
    if (onSuccessCallback) {
        selectedFiles = [];
    }

    // 2. Клонуємо інпут, щоб позбутися старих слухачів подій (важливо при повторному відкритті)
    const newInput = imageInput.cloneNode(true);
    // Очищаємо value, щоб подія change спрацьовувала навіть на той самий файл
    newInput.value = '';
    imageInput.parentNode.replaceChild(newInput, imageInput);
    imageInput = newInput;

    // 3. Функція оновлення відображення
    const updatePhotoDisplay = () => {
        previewContainer.innerHTML = '';

        // Спочатку малюємо вибрані фото
        selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'photo-upload-placeholder preview';

            // Кнопка видалення
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'photo-delete-btn';
            deleteBtn.type = 'button'; // Важливо, щоб не сабмітило форму
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                removeFile(index);
            };
            div.appendChild(deleteBtn);

            // Прев'ю картинки
            const reader = new FileReader();
            reader.onload = (e) => {
                div.style.backgroundImage = `url('${e.target.result}')`;
            };
            reader.readAsDataURL(file);

            previewContainer.appendChild(div);
        });

        // Потім додаємо кнопку "+ Додати", якщо є місце
        if (selectedFiles.length < MAX_PHOTOS) {
            const addBtn = document.createElement('div');
            addBtn.className = 'photo-upload-placeholder add-photo-btn';
            addBtn.innerHTML = '<i class="fas fa-plus"></i> Додати фото';

            // При кліку на div програмно клікаємо на input
            addBtn.onclick = () => imageInput.click();

            previewContainer.appendChild(addBtn);
        }

        // Додаємо пусті квадратики для краси (опціонально, щоб заповнити сітку)
        const totalSlots = selectedFiles.length < MAX_PHOTOS ? selectedFiles.length + 1 : selectedFiles.length;
        // Заповнюємо до 5 або 8 слотів візуально, якщо хочете фіксовану сітку,
        // але тут залишимо динамічну, просто додаємо кнопку.
    };

    const removeFile = (index) => {
        selectedFiles.splice(index, 1);
        imageInput.value = ''; // Скидаємо інпут, щоб можна було вибрати той самий файл знову
        updatePhotoDisplay();
    };

    // 4. Слухач вибору файлів
    imageInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const availableSlots = MAX_PHOTOS - selectedFiles.length;
        if (files.length > availableSlots) {
            alert(`Можна додати ще максимум ${availableSlots} фото.`);
        }

        const filesToAdd = files.slice(0, availableSlots);
        selectedFiles = [...selectedFiles, ...filesToAdd];

        imageInput.value = ''; // Очищаємо, щоб можна було додати ще файли
        updatePhotoDisplay();
    });

    // 5. Обробка відправки форми
    // Клонуємо форму, щоб прибрати старі слухачі submit
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

                if (onSuccessCallback) {
                    onSuccessCallback();
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
    });

    // Перший рендер (порожня сітка з кнопкою)
    updatePhotoDisplay();
}

// === АВТОЗАПУСК ДЛЯ ОКРЕМОЇ СТОРІНКИ ===
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('create-post-form');
    const modal = document.getElementById('create-post-modal');

    // Якщо ми на сторінці create_post.html (є форма, немає модалки)
    if (form && !modal) {
        initPostForm();
    }
});