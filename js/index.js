// Чекаємо, поки весь HTML-документ завантажиться
document.addEventListener('DOMContentLoaded', () => {

    // Знаходимо всі потрібні елементи на сторінці за їхніми id
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');

    // Функція для відкриття бокової панелі
    function openSidebar() {
        // Додаємо нові класи, які визначені у вашому main_page.css
        if (sidebar) sidebar.classList.add('is-open');
        if (sidebarOverlay) sidebarOverlay.classList.add('is-visible');

        // Оновлюємо ARIA-атрибути для доступності
        if (menuToggleBtn) menuToggleBtn.setAttribute('aria-expanded', 'true');
    }


    // Функція для закриття бокової панелі
    function closeSidebar() {
        // Видаляємо нові класи
        if (sidebar) sidebar.classList.remove('is-open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('is-visible');

        // Оновлюємо ARIA-атрибути для доступності
        if (menuToggleBtn) menuToggleBtn.setAttribute('aria-expanded', 'false');
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

    // Бонус: Закриття панелі по клавіші "Escape"
    document.addEventListener('keydown', (e) => {
        // Перевіряємо, чи відкрита панель (за наявністю класу is-open)
        const isSidebarOpen = sidebar && sidebar.classList.contains('is-open');

        if (e.key === 'Escape' && isSidebarOpen) {
            closeSidebar();
        }
    });

});