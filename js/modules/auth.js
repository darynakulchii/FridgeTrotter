import { API_URL } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {

    // === 1. ЛОГІКА ВХОДУ (LOGIN) ===

    // Функція для виконання запиту логіну
    const handleLogin = async (email, password) => {
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
                // Зберігаємо токен і дані користувача
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Перенаправлення
                window.location.href = 'my_profile.html';
            } else {
                alert(data.error || 'Помилка входу');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Помилка з\'єднання з сервером');
        }
    };

    // А. Обробка форми на окремій сторінці (login.html)
    const loginFormPage = document.getElementById('login-form');
    if (loginFormPage) {
        loginFormPage.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email-page').value;
            const password = document.getElementById('login-password-page').value;
            handleLogin(email, password);
        });
    }

    // Б. Обробка кнопки в модальному вікні (navigation.html)
    const loginBtnModal = document.getElementById('login-submit-btn');
    if (loginBtnModal) {
        loginBtnModal.addEventListener('click', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email')?.value;
            const password = document.getElementById('login-password')?.value;
            handleLogin(email, password);
        });
    }


    // === 2. ЛОГІКА РЕЄСТРАЦІЇ (REGISTER) ===

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = document.getElementById('reg-firstname').value;
            const lastName = document.getElementById('reg-lastname').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            if (password.length < 6) {
                alert("Пароль має містити мінімум 6 символів");
                return;
            }

            try {
                const response = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        password: password
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Реєстрація успішна! Зараз ви будете перенаправлені на сторінку входу.');
                    window.location.href = 'login.html';
                } else {
                    alert(data.error || 'Помилка реєстрації');
                }

            } catch (error) {
                console.error('Register error:', error);
                alert('Помилка з\'єднання з сервером');
            }
        });
    }

    // === 3. ЛОГІКА ВИХОДУ (LOGOUT) ===

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if(confirm("Ви дійсно бажаєте вийти?")) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            }
        });
    }
});