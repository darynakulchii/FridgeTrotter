let selectedFiles = []; // Масив для зберігання файлів
const MAX_PHOTOS = 8;

export function setupTourPhotoUpload() {
    const photoInput = document.getElementById('tourPhotosInput');
    const previewContainer = document.getElementById('photoPreviewContainer');

    if (!photoInput || !previewContainer) return;

    // Оновлення відображення
    const updatePhotoDisplay = () => {
        previewContainer.innerHTML = ''; // Очистка

        // 1. Показуємо вибрані фото
        selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'photo-upload-placeholder preview';
            div.dataset.index = index;

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

            // FileReader для показу картинки
            const reader = new FileReader();
            reader.onload = (e) => {
                div.style.backgroundImage = `url('${e.target.result}')`;
            };
            reader.readAsDataURL(file);

            previewContainer.appendChild(div);
        });

        // 2. Кнопка "+ Додати" (якщо є місце)
        if (selectedFiles.length < MAX_PHOTOS) {
            const addBtn = document.createElement('div');
            addBtn.className = 'photo-upload-placeholder add-photo-btn';
            addBtn.innerHTML = '<i class="fas fa-plus"></i> Додати фото';
            addBtn.onclick = () => photoInput.click();
            previewContainer.appendChild(addBtn);
        }

        // 3. Пусті квадрати для краси (заповнюють до 8)
        const totalSlots = MAX_PHOTOS;
        const filledSlots = selectedFiles.length + (selectedFiles.length < MAX_PHOTOS ? 1 : 0);
        for (let i = filledSlots; i < totalSlots; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'photo-upload-placeholder';
            previewContainer.appendChild(emptyDiv);
        }
    };

    const removeFile = (index) => {
        selectedFiles.splice(index, 1);
        photoInput.value = ''; // Скидаємо value інпута
        updatePhotoDisplay();
    };

    photoInput.addEventListener('change', (event) => {
        const files = Array.from(event.target.files);
        if (!files.length) return;

        const availableSlots = MAX_PHOTOS - selectedFiles.length;
        if (files.length > availableSlots) {
            alert(`Можна додати ще максимум ${availableSlots} фото.`);
        }

        const filesToAdd = files.slice(0, availableSlots);
        selectedFiles = [...selectedFiles, ...filesToAdd];
        photoInput.value = ''; // Очищаємо, щоб можна було додати ті ж файли
        updatePhotoDisplay();

        // Приховуємо помилку, якщо вона була
        document.getElementById('photoError').style.display = 'none';
    });

    updatePhotoDisplay();
}

// Функція для отримання файлів при сабміті форми
export function getTourPhotos() {
    return selectedFiles;
}