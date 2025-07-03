const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = 'https://clicker-backend-cy7w.onrender.com';

let userData = null;
let isLoading = false;

const coinsEl = document.getElementById('coins');
const coinsPerSecEl = document.getElementById('coinsPerSec');
const coinsPerClickEl = document.getElementById('coinsPerClick');
const clickImage = document.getElementById('clickImage');
const upgradeClickLevelEl = document.getElementById('upgradeClickLevel');
const upgradeClickCostEl = document.getElementById('upgradeClickCost');
const upgradeClickBtn = document.getElementById('upgradeClickBtn');
const upgradeAutoLevelEl = document.getElementById('upgradeAutoLevel');
const upgradeAutoCostEl = document.getElementById('upgradeAutoCost');
const upgradeAutoBtn = document.getElementById('upgradeAutoBtn');
const transferUsernameEl = document.getElementById('transferUsername');
const transferAmountEl = document.getElementById('transferAmount');
const transferBtn = document.getElementById('transferBtn');
const transferMessageEl = document.getElementById('transferMessage');
const topListEl = document.getElementById('topList');
const imagesContainer = document.getElementById('imagesContainer');
const achievementsContainer = document.getElementById('achievementsContainer');
const notificationContainer = document.getElementById('notificationContainer');

const pages = {
    main: document.getElementById('main'),
    top: document.getElementById('top'),
    upgrade: document.getElementById('upgrade'),
    images: document.getElementById('images'),
    achievements: document.getElementById('achievements'),
    transfer: document.getElementById('transfer'),
};
const navButtons = {
    main: document.getElementById('nav-main'),
    top: document.getElementById('nav-top'),
    upgrade: document.getElementById('nav-upgrade'),
    images: document.getElementById('nav-images'),
    achievements: document.getElementById('nav-achievements'),
    transfer: document.getElementById('nav-transfer'), 
};

function showPage(pageId) {
    if (!pages[pageId] || !navButtons[pageId]) return;

    Object.values(pages).forEach(p => p && p.classList.remove('active'));
    Object.values(navButtons).forEach(b => b && b.classList.remove('active'));

    pages[pageId].classList.add('active');
    navButtons[pageId].classList.add('active');

    switch (pageId) {
        case 'top': loadTopPlayers(); break;
        case 'images': loadImages(); break;
        case 'achievements': loadAchievements(); break;
    }
}

Object.keys(navButtons).forEach(key => {
    if (navButtons[key]) navButtons[key].onclick = () => showPage(key);
});


async function apiRequest(endpoint, method = 'GET', body = null) {
    if (isLoading && method !== 'GET') {
        return Promise.reject(new Error('Another request is already in progress.'));
    }
    isLoading = true;

    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': Telegram.WebApp.initData || ''
        };
        console.log("Headers sent to API:", headers);
        
          

        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_URL}/api${endpoint}`, options);
        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error || `HTTP error! Status: ${response.status}`);
        }
        return responseData;
    } catch (error) {
        console.error(`API request to ${endpoint} failed:`, error);
        showNotification(error.message, 'error');
        throw error;
    } finally {
        isLoading = false;
    }
}


function updateUI() {
    if (!userData) return;
    coinsEl.textContent = Math.floor(userData.coins).toLocaleString();
    coinsPerSecEl.textContent = userData.coins_per_sec.toLocaleString();
    coinsPerClickEl.textContent = userData.coins_per_click.toLocaleString();
    upgradeClickLevelEl.textContent = userData.click_upgrade_level;
    upgradeClickCostEl.textContent = userData.click_upgrade_cost.toLocaleString();
    upgradeAutoLevelEl.textContent = userData.auto_upgrade_level;
    upgradeAutoCostEl.textContent = userData.auto_upgrade_cost.toLocaleString();
    clickImage.className = `click-image ${userData.current_image || 'default'}`;

    upgradeClickBtn.disabled = userData.coins < userData.click_upgrade_cost;
    upgradeAutoBtn.disabled = userData.coins < userData.auto_upgrade_cost;
}

clickImage.onclick = async (event) => {
    try {
        const updatedUser = await apiRequest('/click', 'POST');
        userData = updatedUser;
        updateUI();
        showFloatingCoin(event.clientX, event.clientY, `+${userData.coins_per_click}`);
    } catch (e) {  }
};

upgradeClickBtn.onclick = async () => {
    try {
        const updatedUser = await apiRequest('/upgrade/click', 'POST');
        userData = updatedUser;
        updateUI();
        showNotification('Click power upgraded!', 'success');
    } catch (e) { }
};

upgradeAutoBtn.onclick = async () => {
    try {
        const updatedUser = await apiRequest('/upgrade/auto', 'POST');
        userData = updatedUser;
        updateUI();
        showNotification('Auto income upgraded!', 'success');
    } catch (e) {}
};

transferBtn.onclick = async () => {
    const toUsername = transferUsernameEl.value.trim().replace(/^@/, '');
    const amount = parseInt(transferAmountEl.value, 10);

    if (!toUsername || !amount || amount <= 0) {
        transferMessageEl.textContent = 'Please enter a valid username and amount.';
        transferMessageEl.className = 'transfer-message error';
        return;
    }

    try {
        const result = await apiRequest('/transfer', 'POST', { toUsername, amount });
        userData = result.updatedSender;
        updateUI();
        transferMessageEl.textContent = result.message;
        transferMessageEl.className = 'transfer-message success';
        transferUsernameEl.value = '';
        transferAmountEl.value = '';
    } catch (e) {
        transferMessageEl.textContent = e.message;
        transferMessageEl.className = 'transfer-message error';
    }
};

async function loadTopPlayers() {
    try {
        const players = await apiRequest('/top');
        topListEl.innerHTML = ''; 
        players.forEach((player, idx) => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="rank">${idx + 1}.</span> <span class="name">@${player.username || 'anonymous'}</span> <span class="coins">${player.coins.toLocaleString()} 🪙</span>`;
            topListEl.appendChild(li);
        });
    } catch (e) {
        topListEl.innerHTML = '<li class="error">Failed to load top players.</li>';
    }
}

async function loadImages() {
    try {
        const { allImages, userImages, currentImageId } = await apiRequest('/images');
        imagesContainer.innerHTML = '';
        allImages.forEach(image => {
            const isUnlocked = userImages.some(ui => ui.image_id === image.id);
            const isSelected = currentImageId === image.id;

            const imageCard = document.createElement('div');
            imageCard.className = `image-card ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'selected' : ''}`;

            const imagePreview = document.createElement('div');
            imagePreview.className = `image-preview image-${image.id}`; // Use a class for CSS background-image

            const imageInfo = document.createElement('div');
            imageInfo.className = 'image-info';

            const imageName = document.createElement('h3');
            imageName.textContent = image.name;

            const imageBonus = document.createElement('p');
            imageBonus.className = 'bonus';
            imageBonus.textContent = `+${image.coins_per_click_bonus || 0} coins/click`;

            const imageStatus = document.createElement('div');
            imageStatus.className = 'status';

            if (isUnlocked) {
                if (isSelected) {
                    imageStatus.textContent = 'Selected';
                } else {
                    const selectBtn = document.createElement('button');
                    selectBtn.className = 'select-btn';
                    selectBtn.textContent = 'Select';
                    selectBtn.onclick = () => selectImage(image.id);
                    imageStatus.appendChild(selectBtn);
                }
            } else {
                const cost = document.createElement('p');
                cost.className = 'cost';
                cost.textContent = `${image.cost.toLocaleString()} 🪙`;

                const buyBtn = document.createElement('button');
                buyBtn.className = 'buy-btn';
                buyBtn.textContent = 'Buy';
                buyBtn.onclick = () => buyImage(image.id, image.cost);
                buyBtn.disabled = userData.coins < image.cost; 

                imageStatus.appendChild(cost);
                imageStatus.appendChild(buyBtn);
            }

            imageInfo.append(imageName, imageBonus, imageStatus);
            imageCard.append(imagePreview, imageInfo);
            imagesContainer.appendChild(imageCard);
        });
    } catch (e) {
        imagesContainer.innerHTML = '<div class="error">Failed to load images.</div>';
    }
}

async function buyImage(imageId, cost) {
    if (userData.coins < cost) {
        showNotification("You don't have enough coins!", 'error');
        return;
    }
    try {
        const updatedUser = await apiRequest('/images/buy', 'POST', { imageId });
        userData = updatedUser;
        updateUI();
        loadImages(); 
        showNotification('Image unlocked!', 'success');
    } catch (e) { }
}

async function selectImage(imageId) {
    try {
        const updatedUser = await apiRequest('/images/select', 'POST', { imageId });
        userData = updatedUser;
        updateUI();
        loadImages(); 
        showNotification('Image selected!', 'success');
    } catch (e) { }
}

async function loadAchievements() {
    try {
        const { allAchievements, userAchievements } = await apiRequest('/achievements');
        achievementsContainer.innerHTML = '';
        allAchievements.forEach(ach => {
            const userAch = userAchievements.find(ua => ua.achievement_id === ach.id);

            const achCard = document.createElement('div');
            achCard.className = `achievement-card ${userAch ? 'unlocked' : 'locked'}`;
            const achIcon = document.createElement('div');
            achIcon.className = 'achievement-icon';
            achIcon.textContent = userAch ? '🏆' : '🔒';
            const achContent = document.createElement('div');
            achContent.className = 'achievement-content';
            const achTitle = document.createElement('h3');
            achTitle.textContent = ach.name;
            const achDesc = document.createElement('p');
            achDesc.className = 'description';
            achDesc.textContent = ach.description;
            achContent.append(achTitle, achDesc);

            if (userAch) {
                const achDate = document.createElement('p');
                achDate.className = 'date';
                achDate.textContent = `Unlocked: ${new Date(userAch.unlocked_at).toLocaleDateString()}`;
                achContent.appendChild(achDate);
            }

            achCard.append(achIcon, achContent);
            achievementsContainer.appendChild(achCard);
        });
    } catch (e) {
        achievementsContainer.innerHTML = '<div class="error">Failed to load achievements.</div>';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationContainer.appendChild(notification);

    setTimeout(() => { notification.classList.add('show'); }, 10);
    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => notification.remove());
    }, 3000);
}

function showFloatingCoin(x, y, amount) {
    const coin = document.createElement('div');
    coin.className = 'floating-coin';
    coin.textContent = amount;
    coin.style.left = `${x - 15}px`; 
    coin.style.top = `${y - 30}px`;
    document.body.appendChild(coin);

    setTimeout(() => {
        coin.style.transform = 'translateY(-50px)';
        coin.style.opacity = '0';
    }, 10);
    setTimeout(() => coin.remove(), 1000);
}

async function init() {
    try {
        const response = await apiRequest('/user');
        userData = response;

        if (response.newly_unlocked_achievements?.length > 0) {
            response.newly_unlocked_achievements.forEach(ach => {
                showNotification(`Achievement Unlocked: ${ach.name}!`, 'success');
            });
        }

        updateUI();

        setInterval(() => {
            if (userData && userData.coins_per_sec > 0) {
                userData.coins += userData.coins_per_sec;
                coinsEl.textContent = Math.floor(userData.coins).toLocaleString();

                upgradeClickBtn.disabled = userData.coins < userData.click_upgrade_cost;
                upgradeAutoBtn.disabled = userData.coins < userData.auto_upgrade_cost;
            }
        }, 1000);

    } catch (e) {
        document.body.innerHTML = `<div class="error-container"><h1>Connection Error</h1><p>${e.message}</p><p>Please try restarting the app via Telegram.</p></div>`;
    }
}

tg.ready();
init();
showPage('main');