document.addEventListener("DOMContentLoaded", function() {
    fetch('/FridgeTrotter/html/navigation.html')
        .then(response => response.text())
        .then(data => {
            // 1. Вставити HTML навігації на початок body
            document.body.insertAdjacentHTML('afterbegin', data);

            // 2. Визначити активну сторінку та підсвітити вкладку
            const currentPath = window.location.pathname;
            const navTabs = document.querySelectorAll('.nav-tab');

            navTabs.forEach(tab => {
                const page = tab.getAttribute('href');
                if (currentPath.includes(page)) {
                    tab.classList.add('active');
                }

            });

            // 3. Ініціалізувати події (Сайдбар, Модалки, Кнопки)
            initializeNavigationEvents();

            // 4. Оновити стан кнопки входу (якщо користувач вже залогінений)
            updateAuthButtonState();

            protectNavigationLinks();

            initBugReportUpload();
            initBugReportSubmit();
        })
        .catch(error => console.error('Error loading navigation:', error));
});

function initBugReportUpload() {
    const fileInput = document.getElementById('bug-image-input');
    const previewImg = document.getElementById('bug-image-preview');
    const placeholder = document.getElementById('bug-image-placeholder');

    if (!fileInput) return; // модалка ще не існує

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        previewImg.src = URL.createObjectURL(file);
        previewImg.classList.remove('hidden');
        placeholder.classList.add('hidden');
    });
}



function initializeNavigationEvents() {
    // --- SIDEBAR ---
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');

    function openSidebar() {
        sidebar.classList.add('is-open');
        sidebarOverlay.classList.add('is-visible');
    }

    function closeSidebar() {
        sidebar.classList.remove('is-open');
        sidebarOverlay.classList.remove('is-visible');
    }

    if (menuToggleBtn) menuToggleBtn.addEventListener('click', openSidebar);
    if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    // --- КНОПКИ САЙДБАРУ ---

    // Кнопка Входу/Реєстрації (веде на окрему сторінку)
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
        authBtn.addEventListener('click', () => {
            // Перевіряємо, чи ми вже залогінені
            const token = localStorage.getItem('token');
            if (token) {
                // Якщо залогінені - це кнопка виходу
                if(confirm('Вийти з акаунту?')) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = 'main_page_tours.html';
                }
            } else {
                // Якщо не залогінені - йдемо на сторінку входу
                window.location.href = 'login.html';
            }
        });
    }

    // Інші кнопки (Модалки)
    const modalButtons = [
        { btnId: 'agent-mode-btn', modalId: 'agent-mode-modal' },
        { btnId: 'bug-report-btn', modalId: 'bug-report-modal' },
        { btnId: 'privacy-policy-btn', modalId: 'privacy-modal' },
        { btnId: 'notifications-btn', modalId: 'notifications-modal' }
    ];

    modalButtons.forEach(({ btnId, modalId }) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', () => {
                closeSidebar();
                openModal(modalId);
            });
        }
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    // Закриття модалок
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-backdrop');
            if (modal) modal.classList.remove('active');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            e.target.classList.remove('active');
        }
    });

    // --- CHAT ---
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatWindow = document.getElementById('chat-window');
    const chatCloseBtn = document.getElementById('chat-close-btn');

    if (chatToggleBtn && chatWindow) {
        chatToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            chatWindow.classList.toggle('active');
        });
    }
    if (chatCloseBtn) {
        chatCloseBtn.addEventListener('click', () => chatWindow.classList.remove('active'));
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

// Функція оновлення вигляду кнопки входу
function updateAuthButtonState() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const authBtn = document.getElementById('auth-btn');

    if (authBtn && token && user) {
        authBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> Вийти (${user.first_name})`;
    }
}

function protectNavigationLinks() {
    const restrictedPages = ['my_profile.html', 'chat.html', 'agency_register.html'];

    const allLinks = document.querySelectorAll('a.nav-tab, a.sidebar-link, a.header-btn');

    allLinks.forEach(link => {
        const href = link.getAttribute('href');

        if (href && restrictedPages.some(page => href.includes(page))) {
            link.addEventListener('click', (e) => {
                const token = localStorage.getItem('token');
                if (!token) {
                    e.preventDefault(); // Зупиняємо перехід
                    if(confirm('Ця функція доступна лише авторизованим користувачам. Увійти?')) {
                        window.location.href = 'login.html';
                    }
                }
            });
        }
    });

}

function initBugReportSubmit() {
    const modal = document.getElementById('bug-report-modal');
    if (!modal) return;

    const submitBtn = modal.querySelector('button.btn-solid');
    const textarea = modal.querySelector('textarea');

    submitBtn.addEventListener('click', () => {
        if (!textarea.value.trim()) {
            alert('Будь ласка, опишіть проблему.');
            return;
        }

        alert('Дякуємо! Повідомлення про помилку надіслано!');

        // очищаємо форму
        textarea.value = '';

        const previewImg = document.getElementById('bug-image-preview');
        const placeholder = document.getElementById('bug-image-placeholder');
        const fileInput = document.getElementById('bug-image-input');

        if (previewImg) previewImg.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
        if (fileInput) fileInput.value = '';

        // закриваємо модалку
        modal.classList.remove('active');
    });
}
