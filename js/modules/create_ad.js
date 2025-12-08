import { API_URL } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. ПЕРЕВІРКА АВТОРИЗАЦІЇ
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Для створення оголошення необхідно увійти в акаунт.');
        window.location.href = 'login.html';
        return;
    }

    initAdForm();
});

function initAdForm() {
    const form = document.getElementById('create-ad-form');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Створення...';

            // Збір даних
            const country = document.getElementById('ad-country').value;
            const startDate = document.getElementById('ad-start-date').value;
            const endDate = document.getElementById('ad-end-date').value;
            const minSize = document.getElementById('ad-min-size').value;
            const maxSize = document.getElementById('ad-max-size').value;
            const description = document.getElementById('ad-description').value;
            const tagsInput = document.getElementById('ad-tags').value;

            // Обробка тегів (рядок -> масив, очистка пробілів)
            const tags = tagsInput
                ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                : [];

            // Формування об'єкту
            const payload = {
                destination_country: country,
                start_date: startDate,
                end_date: endDate,
                min_group_size: parseInt(minSize),
                max_group_size: parseInt(maxSize),
                description: description,
                tags: tags
            };

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/companion/ads`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
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