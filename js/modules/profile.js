/**
 * profile.js
 * Основна логіка сторінки профілю:
 * 1. Перемикання табів (вкладок).
 * 2. Інтерактивний холодильник (Drag & Drop).
 * 3. Налаштування (кольори, перемикачі).
 * 4. Взаємодія з постами (лайки, збереження).
 */

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initFridge();
    initSettings();
    initPostInteractions();
});

/* =========================================
   1. ЛОГІКА ТАБІВ (TABS)
   ========================================= */
function initTabs() {
    const navPills = document.querySelectorAll('.nav-pill');
    const tabContents = document.querySelectorAll('.tab-content');

    navPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            // 1. Деактивуємо всі кнопки
            navPills.forEach(btn => btn.classList.remove('active'));
            // 2. Активуємо натиснуту кнопку
            e.currentTarget.classList.add('active');

            // 3. Отримуємо ID цільового таба з атрибуту data-tab
            const tabName = pill.getAttribute('data-tab');

            // 4. Ховаємо всі контент-блоки
            tabContents.forEach(content => content.classList.remove('active'));

            // 5. Показуємо потрібний блок
            if (tabName) {
                const targetTab = document.getElementById(`tab-${tabName}`);
                if (targetTab) {
                    targetTab.classList.add('active');
                }
            }
        });
    });
}

/* =========================================
   2. ЛОГІКА ХОЛОДИЛЬНИКА (DRAG & DROP)
   ========================================= */
function initFridge() {
    const fridgeDoor = document.getElementById('fridge-door');
    const sourceMagnets = document.querySelectorAll('.magnet-btn');
    const placeholder = document.getElementById('fridge-placeholder');

    // Змінні для збереження стану перетягування
    let draggedItem = null;
    let isNewItem = false; // Чи це новий магніт з панелі, чи переміщення існуючого
    let offset = { x: 0, y: 0 }; // Зміщення курсору відносно лівого верхнього кута магніту

    // --- 1. Налаштування джерел (Магніти в панелі) ---
    sourceMagnets.forEach(magnet => {
        magnet.addEventListener('dragstart', (e) => {
            isNewItem = true;
            draggedItem = magnet;
            // Передаємо ID для сумісності, хоча використовуємо змінну draggedItem
            e.dataTransfer.setData('text/plain', magnet.id);
            e.dataTransfer.effectAllowed = 'copy'; // Вказуємо курсору, що це копіювання
        });
    });

    // --- 2. Налаштування цільової зони (Дверцята холодильника) ---
    if (fridgeDoor) {
        // Дозволяємо "кидати" елементи на холодильник
        fridgeDoor.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = isNewItem ? 'copy' : 'move';
        });

        // Обробка падіння (Drop)
        fridgeDoor.addEventListener('drop', (e) => {
            e.preventDefault();

            // Отримуємо координати холодильника для розрахунку відносного позиціювання
            const rect = fridgeDoor.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (isNewItem && draggedItem) {
                // СЦЕНАРІЙ А: Створення нового магніту (копія з панелі)
                createMagnetOnFridge(draggedItem, x, y);
            } else if (!isNewItem && draggedItem) {
                // СЦЕНАРІЙ Б: Переміщення існуючого магніту по холодильнику
                moveMagnet(draggedItem, x, y);
            }

            checkPlaceholder();

            // Скидаємо змінні
            draggedItem = null;
            isNewItem = false;
        });
    }

    // --- Допоміжна функція: Створення магніту на холодильнику ---
    function createMagnetOnFridge(sourceElement, x, y) {
        const newMagnet = document.createElement('div');
        newMagnet.classList.add('magnet-on-fridge');

        // Копіюємо стилі (колір)
        if (sourceElement.classList.contains('burgundy')) newMagnet.classList.add('burgundy');
        if (sourceElement.classList.contains('teal')) newMagnet.classList.add('teal');

        // Отримуємо дані з data-атрибутів
        const iconClass = sourceElement.getAttribute('data-icon');
        const city = sourceElement.getAttribute('data-city');
        const country = sourceElement.getAttribute('data-country');

        // Формуємо HTML нового магніту
        newMagnet.innerHTML = `
            <i class="fas fa-${iconClass}"></i>
            <div class="text-[10px] font-bold mt-1 leading-tight pointer-events-none">${city}</div>
            <div class="text-[8px] opacity-90 pointer-events-none">${country}</div>
        `;

        // Позиціонування (центруємо відносно курсору при створенні, ~35px це половина ширини)
        newMagnet.style.left = `${x - 35}px`;
        newMagnet.style.top = `${y - 35}px`;

        // Робимо новий магніт перетягуваним
        newMagnet.setAttribute('draggable', 'true');
        addDragEventsToMagnet(newMagnet);

        if (fridgeDoor) fridgeDoor.appendChild(newMagnet);
    }

    // --- Допоміжна функція: Оновлення позиції існуючого магніту ---
    function moveMagnet(element, x, y) {
        // Використовуємо збережене зміщення (offset), щоб магніт не "стрибав" під курсор
        element.style.left = `${x - offset.x}px`;
        element.style.top = `${y - offset.y}px`;
    }

    // --- Додавання подій для магнітів, що вже на холодильнику ---
    function addDragEventsToMagnet(magnet) {
        magnet.addEventListener('dragstart', (e) => {
            isNewItem = false; // Це переміщення, а не створення
            draggedItem = magnet;

            // Вираховуємо, в яку саме точку магніту клікнув користувач
            const rect = magnet.getBoundingClientRect();
            offset.x = e.clientX - rect.left;
            offset.y = e.clientY - rect.top;

            e.dataTransfer.effectAllowed = 'move';
            e.stopPropagation(); // Щоб не спрацьовували інші події
        });
    }

    // --- Видалення магніту (Drop за межі холодильника) ---
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault(); // Дозволяємо drop на body
    });

    document.body.addEventListener('drop', (e) => {
        // Перевіряємо, чи drop відбувся НЕ на холодильник
        const isOverFridge = e.target.closest('#fridge-view') || e.target.closest('.fridge-view');

        // Якщо відпустили існуючий магніт поза холодильником - видаляємо
        if (!isOverFridge && !isNewItem && draggedItem) {
            draggedItem.remove();
            checkPlaceholder();
            draggedItem = null;
        }
    });

    // --- Перевірка наявності магнітів (показ/приховання плейсхолдера) ---
    function checkPlaceholder() {
        if (!fridgeDoor || !placeholder) return;
        const magnets = fridgeDoor.querySelectorAll('.magnet-on-fridge');
        if (magnets.length > 0) {
            placeholder.classList.add('hidden');
        } else {
            placeholder.classList.remove('hidden');
        }
    }
}

/* =========================================
   3. НАЛАШТУВАННЯ (КОЛЬОРИ ТА ПЕРЕМИКАЧІ)
   ========================================= */
function initSettings() {
    // --- Зміна кольору холодильника ---
    const colorOptions = document.querySelectorAll('.color-option');
    const fridgeDoor = document.getElementById('fridge-door');

    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Оновлюємо візуальний стан вибраної опції
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // Отримуємо колір з прев'ю та застосовуємо до холодильника
            const previewDiv = option.querySelector('.color-preview');
            const color = previewDiv.style.backgroundColor;

            if (fridgeDoor) {
                fridgeDoor.style.backgroundColor = color;
            }
        });
    });

    // --- Тумблери (Toggle Switches) ---
    const switches = document.querySelectorAll('.toggle-switch');
    switches.forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');

            // Лог для демонстрації
            const row = toggle.closest('.switch-row') || toggle.parentElement;
            const label = row.querySelector('.font-bold')?.innerText || "Опція";
            console.log(`Налаштування "${label}": ${toggle.classList.contains('active') ? 'Увімкнено' : 'Вимкнено'}`);
        });
    });

    // --- Розмір магнітів (Кнопки) ---
    // Знаходимо контейнер з кнопками розміру в налаштуваннях холодильника
    const visualSettingsContainer = document.querySelector('#tab-fridge-settings .settings-card:last-child');
    if(visualSettingsContainer) {
        // Вибираємо кнопки, які не є кнопкою "Зберегти"
        const btns = visualSettingsContainer.querySelectorAll('button:not(.btn-burgundy-solid)');

        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Скидаємо стилі всіх кнопок розміру
                btns.forEach(b => {
                    b.className = 'px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50';
                });
                // Активуємо натиснуту
                btn.className = 'px-4 py-2 bg-[#281822] text-white rounded-md text-sm';

                console.log('Вибрано розмір магнітів:', btn.innerText);
                // Тут можна додати логіку scale() для класу .magnet-on-fridge
            });
        });
    }
}

/* =========================================
   4. ІНТЕРАКЦІЇ ПОСТІВ ТА ФОРМ
   ========================================= */
function initPostInteractions() {
    // --- Кнопки дій (Зберегти, Видалити, тощо) ---
    const actionButtons = document.querySelectorAll('button');

    actionButtons.forEach(btn => {
        // Фільтруємо кнопки, які вже мають свою логіку (таби, магніти, кольори)
        if (btn.classList.contains('nav-pill') ||
            btn.classList.contains('magnet-btn') ||
            btn.closest('.color-grid') ||
            // Ігноруємо кнопки вибору розміру (ми їх обробили вище)
            (btn.parentElement && btn.parentElement.classList.contains('flex') && btn.parentElement.classList.contains('gap-2') && btn.closest('#tab-fridge-settings'))) return;

        btn.addEventListener('click', (e) => {
            const text = btn.innerText.trim().toLowerCase();

            if (text.includes('видалити') || text.includes('delete')) {
                // Імітація видалення без зникнення елементів
                alert('Функція видалення: Елемент буде позначено як видалений (демонстрація).');
            }
            else if (text.includes('зберегти') || text.includes('save') || text.includes('пароль') || text.includes('створити')) {
                // Анімація успішної дії
                const originalText = btn.innerText;
                const originalBg = btn.style.backgroundColor;

                btn.innerText = 'Виконано!';

                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.style.backgroundColor = originalBg;
                }, 2000);
            }
        });
    });

    // --- Лайки, Закладки, Коментарі (Іконки) ---
    // Знаходимо іконки всередині кнопок або карток
    const interactiveIcons = document.querySelectorAll('.fa-thumbs-up, .fa-heart, .fa-bookmark');

    interactiveIcons.forEach(icon => {
        const parent = icon.parentElement; // Зазвичай це <button> або <span>

        // Перевіряємо, чи батьківський елемент клікабельний
        if(parent && (parent.tagName === 'BUTTON' || parent.classList.contains('flex') || parent.classList.contains('absolute'))) {
            parent.style.cursor = 'pointer';

            // Якщо це кнопка видалення/редагування - пропускаємо
            if (parent.tagName === 'BUTTON' && (parent.innerText.includes('Видалити') || parent.innerText.includes('Деталі'))) return;

            parent.addEventListener('click', (e) => {
                e.stopPropagation(); // Щоб не спрацьовували кліки на самій картці

                // Перемикання класу іконки (far -> fas) та кольору
                if (icon.classList.contains('far')) {
                    icon.classList.remove('far'); // Пуста іконка
                    icon.classList.add('fas');    // Заповнена іконка
                    icon.style.color = '#48192E'; // Колір акценту

                    // Проста анімація збільшення
                    icon.style.transform = 'scale(1.2)';
                    setTimeout(() => icon.style.transform = 'scale(1)', 200);

                } else if (icon.classList.contains('fas')) {
                    icon.classList.remove('fas');
                    icon.classList.add('far');
                    icon.style.color = ''; // Скидаємо колір
                }
            });
        }
    });
}