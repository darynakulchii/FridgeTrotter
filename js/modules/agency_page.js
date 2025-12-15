document.addEventListener('DOMContentLoaded', () => {
    initAgencyTabs();
    loadAgencyInfo();
    initLogoUpload();
    initAwards();
    initSaveInfoButton();
    initSaveSettingsButton();
});

// ---- Перемикання вкладок ----
function initAgencyTabs() {
    const pills = document.querySelectorAll('.nav-pill');
    const tabs = document.querySelectorAll('.tab-content');

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));

            pill.classList.add('active');
            document
                .getElementById(`tab-${pill.dataset.tab}`)
                ?.classList.add('active');
        });
    });
}

// ---- Дані агенції ----
let agencyData = {
    name: 'Travel Pro',
    description: 'Ми організовуємо авторські тури по Європі.',
    phone: '',
    email: '',
    website: '',
    logo: '',
    awards: [],
    bgColor: '#D3CBC4'
};

// ---- Завантаження початкових даних ----
function loadAgencyInfo() {
    document.getElementById('agency-name').innerText = agencyData.name;
    const descEl = document.getElementById('agency-description');
    if (descEl.tagName === 'TEXTAREA' || descEl.tagName === 'INPUT') {
        descEl.value = agencyData.description;
    } else {
        descEl.innerText = agencyData.description;
    }
    document.getElementById('agency-phone').innerText = agencyData.phone || '—';
    document.getElementById('agency-email').innerText = agencyData.email || '—';
    document.getElementById('agency-website').innerText = agencyData.website || '—';
    if (agencyData.logo) {
        document.getElementById('agency-logo').src = agencyData.logo;
    }
    document.body.style.backgroundColor = agencyData.bgColor;
}

// ---- Логотип агенції ----
function initLogoUpload() {
    const logoBtn = document.getElementById('edit-logo-btn');
    const logoInput = document.getElementById('logo-input');
    const logoImg = document.getElementById('agency-logo');

    if (logoBtn && logoInput && logoImg) {
        logoBtn.addEventListener('click', () => {
            logoInput.click(); // відкриває файловий діалог
        });

        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                logoImg.src = event.target.result; // показуємо вибране
                agencyData.logo = event.target.result; // зберігаємо у даних
            };
            reader.readAsDataURL(file);
        });
    }
}

// ---- Нагороди (сертифікати) ----
function initAwards() {
    const addAwardBtn = document.getElementById('add-award-btn');
    const addAwardInput = document.getElementById('add-award-input');
    const awardsList = document.getElementById('awards-list');

    if (!addAwardBtn || !addAwardInput || !awardsList) return;

    addAwardBtn.addEventListener('click', () => addAwardInput.click());

    addAwardInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'award-item relative inline-block m-2';

            const img = document.createElement('img');
            img.src = event.target.result;
            img.alt = 'Сертифікат';
            img.className = 'w-24 h-24 object-cover rounded-md border';

            const removeBtn = document.createElement('button');
            removeBtn.innerText = '✖';
            removeBtn.className = 'absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center cursor-pointer';
            removeBtn.addEventListener('click', () => {
                awardsList.removeChild(imgContainer);
                agencyData.awards = agencyData.awards.filter(a => a !== img.src);
            });

            imgContainer.appendChild(img);
            imgContainer.appendChild(removeBtn);
            awardsList.appendChild(imgContainer);

            agencyData.awards.push(img.src);
        }
        reader.readAsDataURL(file);
    });
}

// ---- Збереження опису агенції ----
function initSaveInfoButton() {
    const saveBtn = document.getElementById('save-agency-info');
    const descriptionInput = document.getElementById('agency-description');
    if (!saveBtn || !descriptionInput) return;

    saveBtn.disabled = false;
    saveBtn.addEventListener('click', () => {
        agencyData.description = descriptionInput.value;
        loadAgencyInfo();
        alert('Опис агенції збережено!');
    });
}

// ---- Збереження налаштувань ----
function initSaveSettingsButton() {
    const saveBtn = document.getElementById('save-agency-settings');
    if(!saveBtn) return;

    saveBtn.disabled = false;
    saveBtn.addEventListener('click', () => {
        agencyData.phone = document.getElementById('edit-agency-phone').value;
        agencyData.email = document.getElementById('edit-agency-email').value;
        agencyData.website = document.getElementById('edit-agency-website').value;

        const bgSelect = document.getElementById('page-bg-select');
        agencyData.bgColor = bgSelect.value;
        document.body.style.backgroundColor = agencyData.bgColor;

        loadAgencyInfo();
        alert('Налаштування збережено!');
    });
}
