import { API_URL } from '../api-config.js';

document.addEventListener('DOMContentLoaded', () => {

    checkAuthStatus(); // Перевіряємо при завантаженні, чи ми вже увійшли

    // === 1. ЛОГІКА ПЕРЕМИКАННЯ ВКЛАДОК (Вхід / Реєстрація) ===

    const initModalLogic = setInterval(() => {
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');
        const formLogin = document.getElementById('modal-form-login');
        const formRegister = document.getElementById('modal-form-register');

        if (tabLogin && tabRegister && formLogin && formRegister) {
            clearInterval(initModalLogic); // Зупиняємо перевірку, елементи знайдено

            // Перемикач на ВХІД
            tabLogin.addEventListener('click', () => {
                formLogin.classList.remove('hidden');
                formRegister.classList.add('hidden');

                // Стилі активної вкладки
                tabLogin.classList.add('text-[#48192E]', 'border-b-2', 'border-[#48192E]', 'font-bold');
                tabLogin.classList.remove('text-gray-500');

                tabRegister.classList.remove('text-[#48192E]', 'border-b-2', 'border-[#48192E]', 'font-bold');
                tabRegister.classList.add('text-gray-500');
            });

            // Перемикач на РЕЄСТРАЦІЮ
            tabRegister.addEventListener('click', () => {
                formRegister.classList.remove('hidden');
                formLogin.classList.add('hidden');

                // Стилі активної вкладки
                tabRegister.classList.add('text-[#48192E]', 'border-b-2', 'border-[#48192E]', 'font-bold');
                tabRegister.classList.remove('text-gray-500');

                tabLogin.classList.remove('text-[#48192E]', 'border-b-2', 'border-[#48192E]', 'font-bold');
                tabLogin.classList.add('text-gray-500');
            });

            // === ОБРОБКА ФОРМИ ВХОДУ (МОДАЛКА) ===
            formLogin.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('modal-login-email').value;
                const password = document.getElementById('modal-login-password').value;
                await performLogin(email, password);
            });

            // === ОБРОБКА ФОРМИ РЕЄСТРАЦІЇ (МОДАЛКА) ===
            formRegister.addEventListener('submit', async (e) => {
                e.preventDefault();
                const firstName = document.getElementById('modal-reg-firstname').value;
                const lastName = document.getElementById('modal-reg-lastname').value;
                const email = document.getElementById('modal-reg-email').value;
                const password = document.getElementById('modal-reg-password').value;

                if (password.length < 6) {
                    alert("Пароль має містити мінімум 6 символів");
                    return;
                }

                await performRegister(firstName, lastName, email, password);
            });
        }
    }, 500); // Перевіряємо кожні 0.5 сек

    // === 2. ФУНКЦІЇ API ===

    async function performLogin(email, password) {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                alert('Вхід успішний!');
                closeAuthModal();
                checkAuthStatus(); // Оновлюємо UI
                window.location.reload(); // Перезавантажуємо сторінку для оновлення даних
            } else {
                alert(data.error || 'Помилка входу');
            }
        } catch (error) {
            console.error(error);
            alert('Помилка з\'єднання');
        }
    }

    async function performRegister(firstName, lastName, email, password) {
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: firstName, last_name: lastName, email, password
                })
            });
            const data = await response.json();

            if (response.ok) {
                alert('Реєстрація успішна! Автоматичний вхід...');
                await performLogin(email, password); // Одразу логінимо користувача
            } else {
                alert(data.error || 'Помилка реєстрації');
            }
        } catch (error) {
            console.error(error);
            alert('Помилка з\'єднання');
        }
    }

    // === 3. ДОПОМІЖНІ ФУНКЦІЇ ===

    function closeAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.classList.remove('active');
    }

    function checkAuthStatus() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));

        // Знаходимо елементи в навігації (чекаємо інтервал, якщо вони ще не завантажились)
        const checkNav = setInterval(() => {
            const authBtn = document.getElementById('auth-btn'); // Кнопка в сайдбарі "Вхід/Реєстрація"
            const profileLink = document.querySelector('a[href="my_profile.html"]');

            // Якщо токен є - ми залогінені
            if (token && user) {
                if(authBtn) {
                    authBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> Вийти (${user.first_name})`;
                    // Змінюємо поведінку кнопки на Logout
                    authBtn.replaceWith(authBtn.cloneNode(true)); // Видаляємо старі лісенери
                    const newBtn = document.getElementById('auth-btn');
                    newBtn.addEventListener('click', () => {
                        if(confirm('Вийти з акаунту?')) {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            window.location.reload();
                        }
                    });
                }
            }

            if(authBtn) clearInterval(checkNav); // Якщо знайшли кнопку - стоп
        }, 500);
    }
});