import './modules/auth.js';

document.addEventListener('DOMContentLoaded', () => {

    // === SIDEBAR LOGIC ===
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');

    function openSidebar() {
        if (sidebar) sidebar.classList.add('is-open');
        if (sidebarOverlay) sidebarOverlay.classList.add('is-visible');
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('is-open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('is-visible');
    }

    if (menuToggleBtn) menuToggleBtn.addEventListener('click', openSidebar);
    if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);


    // === VIEW TOGGLE LOGIC (Tours vs Agencies) ===
    const btnViewAgencies = document.getElementById('btn-view-agencies');
    const btnViewTours = document.getElementById('btn-view-tours');
    const agenciesView = document.getElementById('agencies-view');
    const toursView = document.getElementById('tours-view');
    const pageTitle = document.getElementById('page-title');

    if (btnViewAgencies && btnViewTours) {
        btnViewAgencies.addEventListener('click', () => {
            agenciesView.classList.remove('hidden');
            agenciesView.classList.add('flex');
            toursView.classList.add('hidden');
            toursView.classList.remove('grid');

            btnViewAgencies.classList.add('active');
            btnViewAgencies.classList.remove('btn-rating');
            btnViewAgencies.classList.add('btn-solid');

            btnViewTours.classList.add('inactive');
            btnViewTours.classList.remove('btn-solid');
            btnViewTours.classList.add('btn-rating');

            if(pageTitle) pageTitle.innerText = "Рейтинг тур агенцій";
        });

        btnViewTours.addEventListener('click', () => {
            toursView.classList.remove('hidden');
            toursView.classList.add('grid');
            agenciesView.classList.add('hidden');
            agenciesView.classList.remove('flex');

            btnViewTours.classList.remove('inactive');
            btnViewTours.classList.add('btn-solid');
            btnViewTours.classList.remove('btn-rating');

            btnViewAgencies.classList.remove('active');
            btnViewAgencies.classList.remove('btn-solid');
            btnViewAgencies.classList.add('btn-rating');

            if(pageTitle) pageTitle.innerText = "Популярні тури";
        });
    }


    // === MODAL UTILS ===
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
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

    // === SPECIFIC MODALS & BUTTONS ===

    // Notifications
    const notifBtn = document.getElementById('notifications-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => openModal('notifications-modal'));
    }

    // Bug Report
    const bugBtn = document.getElementById('bug-report-btn');
    if (bugBtn) {
        bugBtn.addEventListener('click', () => {
            closeSidebar();
            openModal('bug-report-modal');
        });
    }

    // Auth (Login/Register)
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
        authBtn.addEventListener('click', () => {
            closeSidebar();
            openModal('auth-modal');
        });
    }

    // Agent Mode
    const agentBtn = document.getElementById('agent-mode-btn');
    if (agentBtn) {
        agentBtn.addEventListener('click', () => {
            closeSidebar();
            openModal('agent-mode-modal');
        });
    }

    // Privacy Policy
    const privacyBtn = document.getElementById('privacy-policy-btn');
    if (privacyBtn) {
        privacyBtn.addEventListener('click', () => {
            closeSidebar();
            openModal('privacy-modal');
        });
    }

    // Logout (Simulation)
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            alert("Ви вийшли з акаунту");
            closeSidebar();
        });
    }

    // Chat Window
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatWindow = document.getElementById('chat-window');
    const chatCloseBtn = document.getElementById('chat-close-btn');

    if (chatToggleBtn && chatWindow) {
        chatToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            chatWindow.classList.toggle('active');
        });
    }

    if (chatCloseBtn && chatWindow) {
        chatCloseBtn.addEventListener('click', () => {
            chatWindow.classList.remove('active');
        });
    }

    // Tour Details Modal Logic
    const tourTriggers = document.querySelectorAll('.tour-card-trigger');
    const tourModal = document.getElementById('tour-details-modal');

    const toursData = {
        '1': {
            title: 'Тропічний рай на Мальдівах',
            image: 'https://images.unsplash.com/photo-1514282401047-d77a7149ba6a?auto=format&fit=crop&w=1200&q=80',
            desc: 'Незабутній відпочинок на білосніжних пляжах з кришталево чистою водою. Ідеально для медового місяця або релаксу.',
            loc: 'Мальдіви',
            price: '45 000 ₴',
            duration: '7 днів'
        },
        '2': {
            title: 'Гірські пригоди в Карпатах',
            image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
            desc: 'Піші походи, захоплюючі краєвиди та свіже гірське повітря. Відвідайте Говерлу та озеро Синевир.',
            loc: 'Карпати, Україна',
            price: '12 000 ₴',
            duration: '5 днів'
        }
    };

    if (tourModal) {
        tourTriggers.forEach(card => {
            card.addEventListener('click', (e) => {
                const id = card.getAttribute('data-tour-id');
                const data = toursData[id];

                if (data) {
                    document.getElementById('modal-tour-title').innerText = data.title;
                    document.getElementById('modal-tour-image').src = data.image;
                    document.getElementById('modal-tour-desc').innerText = data.desc;
                    document.getElementById('modal-tour-loc').innerText = data.loc;
                    document.getElementById('modal-tour-price').innerText = data.price;
                    document.getElementById('modal-tour-duration').innerText = data.duration;

                    openModal('tour-details-modal');
                }
            });
        });
    }

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSidebar();
            document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
            if(chatWindow) chatWindow.classList.remove('active');
        }
    });

});