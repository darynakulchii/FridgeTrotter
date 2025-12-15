/* js/modules/create_post.js */
import { API_URL } from '../api-config.js';

// Локальний стан для зберігання вибраних файлів
let selectedFiles = [];
const MAX_PHOTOS = 8;

export function initPostForm(onSuccessCallback) {
    const form = document.getElementById('create-post-form');
    // Знаходимо елементи за новими ID, які ми додали в HTML
    let photoInput = document.getElementById('postPhotosInput');
    const previewContainer = document.getElementById('postPhotoPreviewContainer');

    if (!form || !photoInput || !previewContainer) return;

    // Скидання стану при відкритті модалки (якщо передано колбек)
    if (onSuccessCallback) {
        selectedFiles = [];
        photoInput.value = '';
    }

    // === Функція оновлення відображення сітки фото ===
    const updatePhotoDisplay = () => {
        previewContainer.innerHTML = ''; // Очищаємо контейнер

        // 1. Відображаємо вже вибрані фото
        selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'photo-upload-placeholder preview';

            // Кнопка видалення фото
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'photo-delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.type = 'button';
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Зупиняємо спливання події
                removeFile(index);
            };
            div.appendChild(deleteBtn);

            // Позначка "Головне" для першого фото в списку
            if (index === 0) {
                const mainLabel = document.createElement('span');
                mainLabel.className = 'photo-main-label';
                mainLabel.textContent = 'Головне';
                div.appendChild(mainLabel);
            }

            // Використовуємо FileReader для створення прев'ю
            const reader = new FileReader();
            reader.onload = (e) => {
                div.style.backgroundImage = `url('${e.target.result}')`;
            };
            reader.readAsDataURL(file);

            previewContainer.appendChild(div);
        });

        // 2. Додаємо кнопку "+ Додати фото", якщо не досягнуто ліміту
        if (selectedFiles.length < MAX_PHOTOS) {
            const addBtn = document.createElement('div');
            addBtn.className = 'photo-upload-placeholder add-photo-btn';
            addBtn.innerHTML = '<i class="fas fa-plus"></i> Додати фото';

            // Важливо: завжди шукаємо актуальний input за ID
            addBtn.onclick = () => {
                const activeInput = document.getElementById('postPhotosInput');
                if (activeInput) activeInput.click();
            };

            previewContainer.appendChild(addBtn);
        }

        // 3. Додаємо пусті плейсхолдери для збереження структури сітки (мінімум 4 елементи)
        const filledSlots = selectedFiles.length + (selectedFiles.length < MAX_PHOTOS ? 1 : 0);
        for (let i = filledSlots; i < 4; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'photo-upload-placeholder';
            previewContainer.appendChild(emptyDiv);
        }
    };

    // === Функція видалення файлу з масиву ===
    const removeFile = (index) => {
        selectedFiles.splice(index, 1); // Видаляємо файл за індексом

        // Очищаємо значення інпуту, щоб можна було вибрати той самий файл повторно
        const activeInput = document.getElementById('postPhotosInput');
        if (activeInput) activeInput.value = '';

        updatePhotoDisplay(); // Оновлюємо вигляд
    };

    // === Обробка вибору файлів ===
    // Клонуємо інпут, щоб позбутися старих слухачів подій при повторній ініціалізації
    const newInput = photoInput.cloneNode(true);
    newInput.value = '';
    photoInput.parentNode.replaceChild(newInput, photoInput);
    photoInput = newInput; // Оновлюємо посилання

    photoInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const availableSlots = MAX_PHOTOS - selectedFiles.length;
        if (files.length > availableSlots) {
            alert(`Можна додати ще максимум ${availableSlots} фото.`);
        }

        // Додаємо лише ту кількість файлів, яка вміщується в ліміт
        const filesToAdd = files.slice(0, availableSlots);
        selectedFiles = [...selectedFiles, ...filesToAdd];

        photoInput.value = ''; // Очищаємо інпут після вибору
        updatePhotoDisplay();
    });

    // === Обробка відправки форми ===
    // Клонуємо форму для очищення старих слухачів submit
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

        // ВАЖЛИВО: Додаємо всі файли з нашого локального масиву selectedFiles
        selectedFiles.forEach(file => {
            formData.append('images', file);
        });

        try {
            const token = localStorage.getItem('token');
            // Припускаємо, що бекенд вже налаштований на прийом декількох файлів у полі 'images'
            const response = await fetch(`${API_URL}/forum/posts`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (response.ok) {
                newForm.reset();
                selectedFiles = []; // Очищаємо масив після успішної відправки
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

    // Перший виклик для відображення початкового стану (пуста сітка з кнопкою "Додати")
    updatePhotoDisplay();
}

// Автоініціалізація, якщо скрипт підключено на сторінці, де форма є не в модалці (на майбутнє)
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('create-post-form');
    const modal = document.getElementById('create-post-modal');
    // Якщо форма є, але немає модалки (значить це окрема сторінка створення), ініціалізуємо одразу
    if (form && !modal) {
        initPostForm();
    }
});