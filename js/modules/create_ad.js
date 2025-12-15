import { API_URL } from '../api-config.js';

let selectedFiles = []; // Масив для фото
const MAX_PHOTOS = 8;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Для створення оголошення необхідно увійти в акаунт.');
        window.location.href = 'login.html';
        return;
    }

    initAdForm();
    initPhotoGrid(); // Ініціалізуємо сітку
});

// === Логіка сітки фото (як у create_post.js) ===
function initPhotoGrid() {
    const photoInput = document.getElementById('adPhotosInput');
    const previewContainer = document.getElementById('adPhotoPreviewContainer');

    if (!photoInput || !previewContainer) return;

    // Слухач вибору файлів
    photoInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const availableSlots = MAX_PHOTOS - selectedFiles.length;
        if (files.length > availableSlots) {
            alert(`Можна додати ще максимум ${availableSlots} фото.`);
        }

        const filesToAdd = files.slice(0, availableSlots);
        selectedFiles = [...selectedFiles, ...filesToAdd];

        e.target.value = ''; // Скидаємо, щоб можна було вибрати ті ж файли
        updatePhotoDisplay();
    });

    updatePhotoDisplay();
}

function updatePhotoDisplay() {
    const previewContainer = document.getElementById('adPhotoPreviewContainer');
    if(!previewContainer) return;

    previewContainer.innerHTML = '';

    // 1. Вже вибрані фото
    selectedFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'photo-upload-placeholder preview';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'photo-delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.type = 'button';
        deleteBtn.onclick = (e) => { e.stopPropagation(); removeFile(index); };
        div.appendChild(deleteBtn);

        if (index === 0) {
            const mainLabel = document.createElement('span');
            mainLabel.className = 'photo-main-label';
            mainLabel.textContent = 'Головне';
            div.appendChild(mainLabel);
        }

        const reader = new FileReader();
        reader.onload = (e) => { div.style.backgroundImage = `url('${e.target.result}')`; };
        reader.readAsDataURL(file);

        previewContainer.appendChild(div);
    });

    // 2. Кнопка "Додати"
    if (selectedFiles.length < MAX_PHOTOS) {
        const addBtn = document.createElement('div');
        addBtn.className = 'photo-upload-placeholder add-photo-btn';
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Додати фото';
        addBtn.onclick = () => document.getElementById('adPhotosInput').click();
        previewContainer.appendChild(addBtn);
    }

    // 3. Пусті слоти (для краси)
    const filledSlots = selectedFiles.length + (selectedFiles.length < MAX_PHOTOS ? 1 : 0);
    for (let i = filledSlots; i < 4; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'photo-upload-placeholder';
        previewContainer.appendChild(emptyDiv);
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updatePhotoDisplay();
}

// === Логіка відправки форми ===
function initAdForm() {
    const form = document.getElementById('create-ad-form');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Створення...';

            const formData = new FormData();
            formData.append('destination_country', document.getElementById('ad-country').value);
            formData.append('start_date', document.getElementById('ad-start-date').value);
            formData.append('end_date', document.getElementById('ad-end-date').value);
            formData.append('min_group_size', document.getElementById('ad-min-size').value);
            formData.append('max_group_size', document.getElementById('ad-max-size').value);
            formData.append('description', document.getElementById('ad-description').value);
            formData.append('budget_min', document.getElementById('ad-budget-min').value || '');
            formData.append('budget_max', document.getElementById('ad-budget-max').value || '');

            // Теги
            const tagsInput = document.getElementById('ad-tags').value;
            if(tagsInput) {
                const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                tags.forEach(tag => formData.append('tags[]', tag)); // Передаємо як масив
            }

            // Фотографії (додаємо всі файли з масиву)
            selectedFiles.forEach(file => {
                formData.append('images', file);
            });

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/companion/ads`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData // Браузер сам встановить multipart/form-data
                });

                if (response.ok) {
                    alert('Оголошення успішно створено!');
                    window.location.href = 'companions.html';
                } else {
                    const data = await response.json();
                    alert(data.error || 'Помилка створення оголошення');
                }
            } catch (error) {
                console.error(error);
                alert('Помилка з\'єднання з сервером');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
            }
        });
    }
}