// js/modules/create_post.js
import { API_URL } from '../api-config.js';

let selectedFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. ПЕРЕВІРКА АВТОРИЗАЦІЇ
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Для створення посту необхідно увійти в акаунт.');
        window.location.href = 'login.html';
        return;
    }

    initFormLogic();
});

function initFormLogic() {
    const form = document.getElementById('create-post-form');
    const imageInput = document.getElementById('new-post-images');
    const previewContainer = document.getElementById('image-preview-container');

    // Логіка вибору файлів (ідентична до тієї, що була в модалці)
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (selectedFiles.length + files.length > 5) {
                alert('Максимальна кількість фото: 5');
                return;
            }
            files.forEach(file => {
                if (!file.type.startsWith('image/')) return;
                selectedFiles.push(file);

                const reader = new FileReader();
                reader.onload = (ev) => {
                    const preview = document.createElement('div');
                    preview.className = 'relative w-full h-20 rounded-md overflow-hidden group border border-gray-200';
                    preview.innerHTML = `
                        <img src="${ev.target.result}" class="w-full h-full object-cover">
                        <button type="button" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    preview.querySelector('button').addEventListener('click', () => {
                        selectedFiles = selectedFiles.filter(f => f !== file);
                        preview.remove();
                    });
                    previewContainer.appendChild(preview);
                };
                reader.readAsDataURL(file);
            });
            imageInput.value = '';
        });
    }

    // Відправка форми
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Публікація...';

            const formData = new FormData();
            formData.append('title', document.getElementById('new-post-title').value);
            formData.append('category', document.getElementById('new-post-category').value);
            formData.append('content', document.getElementById('new-post-content').value);
            selectedFiles.forEach(file => formData.append('images', file));

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/forum/posts`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (response.ok) {
                    // Успіх - перекидаємо на форум або в профіль
                    window.location.href = 'forum.html';
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
    }
}