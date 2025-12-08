import { API_URL } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-submit-btn');

    if (loginBtn) {
        loginBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            if (!email || !password) {
                alert('Будь ласка, заповніть всі поля');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    // Зберігаємо токен
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    alert('Вхід успішний!');
                    window.location.reload(); // Оновлюємо сторінку, щоб змінився хедер
                } else {
                    alert(data.error || 'Помилка входу');
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('Помилка з\'єднання з сервером');
            }
        });
    }

    // Логіка виходу (Logout)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html'; // Або на головну
        });
    }
});