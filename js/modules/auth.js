import { API_URL } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. ОБРОБКА ФОРМИ ВХОДУ (login.html) ---
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Збираємо дані (використовуємо IDs з login.html)
            const email = document.getElementById('login-email-page').value;
            const password = document.getElementById('login-password-page').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            if(!email || !password) {
                alert('Будь ласка, заповніть всі поля');
                return;
            }

            // Блокуємо кнопку на час запиту
            const originalBtnText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Вхід...';

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

                    // Перенаправляємо на профіль
                    window.location.href = 'my_profile.html';
                } else {
                    alert(data.error || 'Помилка входу');
                }
            } catch (error) {
                console.error(error);
                alert('Помилка з\'єднання з сервером');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            }
        });
    }

    // --- 2. ОБРОБКА ФОРМИ РЕЄСТРАЦІЇ (register.html) ---
    const registerForm = document.getElementById('register-form');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Збираємо дані (використовуємо IDs з register.html)
            const firstName = document.getElementById('reg-firstname').value;
            const lastName = document.getElementById('reg-lastname').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const submitBtn = registerForm.querySelector('button[type="submit"]');

            if (password.length < 6) {
                alert("Пароль має містити мінімум 6 символів");
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerText = 'Реєстрація...';

            try {
                // 1. Реєструємо
                const regResponse = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password })
                });

                const regData = await regResponse.json();

                if (!regResponse.ok) {
                    throw new Error(regData.error || 'Помилка реєстрації');
                }

                // 2. Якщо успішно - одразу логінимо
                const loginResponse = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const loginData = await loginResponse.json();

                if (loginResponse.ok) {
                    localStorage.setItem('token', loginData.token);
                    localStorage.setItem('user', JSON.stringify(loginData.user));
                    alert('Реєстрація успішна! Ласкаво просимо.');
                    window.location.href = 'my_profile.html';
                } else {
                    // Якщо реєстрація пройшла, а авто-логін ні (рідкісний випадок)
                    alert('Реєстрація успішна. Будь ласка, увійдіть.');
                    window.location.href = 'login.html';
                }

            } catch (error) {
                console.error(error);
                alert(error.message || 'Помилка з\'єднання');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Зареєструватися';
            }
        });
    }
});