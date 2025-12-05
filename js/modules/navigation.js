document.addEventListener("DOMContentLoaded", function() {
    fetch('navigation.html')
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

            // 3. Ініціалізувати події (Сайдбар, Модалки)
            initializeNavigationEvents();
        })
        .catch(error => console.error('Error loading navigation:', error));
});

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

    // --- MODALS HELPER ---
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            closeSidebar(); // Закрити сайдбар, якщо відкриваємо з нього
            modal.classList.add('active');
        }
    }

    function closeModalById(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // Close buttons logic
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-backdrop');
            if (modal) modal.classList.remove('active');
        });
    });

    // Close on click outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            e.target.classList.remove('active');
        }
    });

    // --- SPECIFIC BUTTONS ---
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) authBtn.addEventListener('click', () => openModal('auth-modal'));

    const agentBtn = document.getElementById('agent-mode-btn');
    if (agentBtn) agentBtn.addEventListener('click', () => openModal('agent-mode-modal'));

    const bugBtn = document.getElementById('bug-report-btn');
    if (bugBtn) bugBtn.addEventListener('click', () => openModal('bug-report-modal'));

    const privacyBtn = document.getElementById('privacy-policy-btn');
    if (privacyBtn) privacyBtn.addEventListener('click', () => openModal('privacy-modal'));

    const notifBtn = document.getElementById('notifications-btn');
    if (notifBtn) notifBtn.addEventListener('click', () => openModal('notifications-modal'));

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        alert("Вихід виконано");
        closeSidebar();
    });

    // --- AGENT SUB-MODALS ---
    const agentRegisterBtn = document.getElementById('agent-btn-register');
    if(agentRegisterBtn) {
        agentRegisterBtn.addEventListener('click', () => {
            closeModalById('agent-mode-modal'); // Close main agent menu
            openModal('modal-agent-register'); // Open sub-modal
        });
    }

    const agentAccountBtn = document.getElementById('agent-btn-account');
    if(agentAccountBtn) {
        agentAccountBtn.addEventListener('click', () => {
            closeModalById('agent-mode-modal');
            openModal('modal-agent-account');
        });
    }

    const agentAddTourBtn = document.getElementById('agent-btn-add-tour');
    if(agentAddTourBtn) {
        agentAddTourBtn.addEventListener('click', () => {
            closeModalById('agent-mode-modal');
            openModal('modal-agent-add-tour');
        });
    }

    const agentAddMagnetBtn = document.getElementById('agent-btn-add-magnet');
    if(agentAddMagnetBtn) {
        agentAddMagnetBtn.addEventListener('click', () => {
            closeModalById('agent-mode-modal');
            openModal('modal-agent-add-magnet');
        });
    }

    const agentAddPostBtn = document.getElementById('agent-btn-add-post');
    if(agentAddPostBtn) {
        agentAddPostBtn.addEventListener('click', () => {
            closeModalById('agent-mode-modal');
            openModal('modal-agent-add-post');
        });
    }


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