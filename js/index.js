// Чекаємо, поки весь HTML-документ завантажиться
document.addEventListener('DOMContentLoaded', () => {

    // Знаходимо всі потрібні елементи на сторінці за їхніми id
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');

    // Функція для відкриття бокової панелі
    function openSidebar() {
        sidebar.classList.remove('-translate-x-full'); // Зсуваємо панель
        sidebar.classList.add('translate-x-0');
        sidebarOverlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none'); // Показуємо фон
        sidebarOverlay.classList.add('opacity-100');
    }


    // Функція для закриття бокової панелі
    function closeSidebar() {
        sidebar.classList.add('-translate-x-full'); // Ховаємо панель
        sidebar.classList.remove('translate-x-0');
        sidebarOverlay.classList.add('hidden', 'opacity-0', 'pointer-events-none'); // Ховаємо фон
        sidebarOverlay.classList.remove('opacity-100');
    }

    // Натискання на кнопку "меню" (бургер)
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', openSidebar);
    }

    // Натискання на кнопку "X" всередині панелі
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', closeSidebar);
    }

    // Натискання на темний фон (overlay)
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

});
