const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = 'https://clicker-backend-chjq.onrender.com';

let userData = null;
let isLoading = false;
let isClicking = false;

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

const upgrades = {
    'click_tier_1': { base_cost: 10, cost_mult: 1.15 },
    'click_tier_2': { base_cost: 500, cost_mult: 1.15 },
    'click_tier_3': { base_cost: 10000, cost_mult: 1.15 },
    'click_tier_4': { base_cost: 250000, cost_mult: 1.15 },
    'click_tier_5': { base_cost: 5000000, cost_mult: 1.15 },
    'auto_tier_1': { base_cost: 100, cost_mult: 1.15 },
    'auto_tier_2': { base_cost: 2500, cost_mult: 1.15 },
    'auto_tier_3': { base_cost: 50000, cost_mult: 1.15 },
    'auto_tier_4': { base_cost: 1000000, cost_mult: 1.15 },
    'auto_tier_5': { base_cost: 20000000, cost_mult: 1.15 },
};

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
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': Telegram.WebApp.initData || ''
        };

        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_URL}/api${endpoint}`, options);

        if (!response.ok) {
            const responseData = await response.json().catch(() => ({ error: 'Invalid JSON response' }));
            throw new Error(responseData.error || `HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API request to ${endpoint} failed:`, error);
        showNotification(error.message, 'error');
        throw error;
    }
}

function openUpgradeTab(evt, tabName) {
    document.querySelectorAll('.upgrade-tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.upgrade-tab-link').forEach(link => link.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}


// function updateUI() {
//     if (!userData) return;
//     coinsEl.textContent = Math.floor(userData.coins).toLocaleString();
//     coinsPerSecEl.textContent = userData.coins_per_sec.toLocaleString();
//     coinsPerClickEl.textContent = userData.coins_per_click.toLocaleString();
//     upgradeClickLevelEl.textContent = userData.click_upgrade_level;
//     upgradeClickCostEl.textContent = userData.click_upgrade_cost.toLocaleString();
//     upgradeAutoLevelEl.textContent = userData.auto_upgrade_level;
//     upgradeAutoCostEl.textContent = userData.auto_upgrade_cost.toLocaleString();
//     clickImage.className = `click-image ${userData.current_image || 'default'}`;

//     upgradeClickBtn.disabled = userData.coins < userData.click_upgrade_cost;
//     upgradeAutoBtn.disabled = userData.coins < userData.auto_upgrade_cost;
// }

function calculateCost(base, multiplier, level) {
    return Math.floor(base * Math.pow(multiplier, level));
}


function updateUI() {
    if (!userData) return;

    coinsEl.textContent = parseFloat(userData.coins).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    coinsPerClickEl.textContent = userData.coins_per_click.toFixed(10);
    coinsPerSecEl.textContent = userData.coins_per_sec.toFixed(10);

    for (const id in upgrades) {
        const level = userData[`${id}_level`] || 0;
        const cost = calculateCost(upgrades[id].base_cost, upgrades[id].cost_mult, level);

        document.getElementById(`${id}_level`).textContent = level;
        document.getElementById(`${id}_cost`).textContent = cost.toLocaleString();

        const button = document.querySelector(`#upgrade_${id} .action-button`);
        if (button) {
            button.disabled = userData.coins < cost;
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    for (const id in upgrades) {
        const button = document.querySelector(`#upgrade_${id} .action-button`);
        if (button) {
            button.onclick = () => purchaseUpgrade(id);
        }
    }
});

async function purchaseUpgrade(upgradeId) {
    tg.HapticFeedback.notificationOccurred('success');
    try {
        const updatedUser = await apiRequest('/upgrade', 'POST', { upgradeId });
        userData = updatedUser;
        updateUI();
        showNotification('Upgrade successful!', 'success');
    } catch (e) {
        showNotification(e.message, 'error');
    }
}

clickImage.onclick = (event) => {
    tg.HapticFeedback.impactOccurred('light');

    if (userData) {
        userData.coins += userData.coins_per_click;
        updateUI(); 
    }

    showFloatingCoin(event.clientX, event.clientY, `+${userData.coins_per_click}`);

    apiRequest('/click', 'POST')
        .then(updatedUserFromServer => {

            userData = updatedUserFromServer;
        })
        .catch(error => {
            console.error("Click could not be saved to server:", error);
          
        });
};

upgradeClickBtn.onclick = async () => {
    tg.HapticFeedback.notificationOccurred('success');
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
            imagePreview.className = `image-preview image-${image.id}`;

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
       
        const initialUserData = await apiRequest('/user');
        userData = initialUserData;
        updateUI();

        let lastServerCoins = userData.coins;
        let lastSyncTime = Date.now();
        let visualCoinUpdater;

        const startVisualUpdates = () => {
            if (visualCoinUpdater) clearInterval(visualCoinUpdater);

            visualCoinUpdater = setInterval(() => {
                if (userData && userData.coins_per_sec > 0) {
                    const currentDisplayCoins = parseFloat(coinsEl.textContent.replace(/,/g, '')) || 0;
                    const newDisplayCoins = currentDisplayCoins + userData.coins_per_sec;
                    coinsEl.textContent = Math.floor(newDisplayCoins).toLocaleString();
                }
            }, 1000);
        };

        const syncWithServer = async () => {
            if (isLoading) return;

            try {
                const latestUserData = await apiRequest('/user');
                userData = latestUserData; 


                const timeSinceLastSync = (Date.now() - lastSyncTime) / 1000;
                const expectedVisualGain = timeSinceLastSync * (userData.coins_per_sec || 0);
                const expectedDisplayTotal = lastServerCoins + expectedVisualGain;
                const currentDisplayTotal = parseFloat(coinsEl.textContent.replace(/,/g, '')) || 0;


                if (Math.abs(currentDisplayTotal - expectedDisplayTotal) > (userData.coins_per_sec * 2)) {
                    coinsEl.textContent = Math.floor(userData.coins).toLocaleString();
                }


                updateUI();


                lastServerCoins = userData.coins;
                lastSyncTime = Date.now();

            } catch (error) {
                console.warn("Periodic sync failed:", error.message);
            }
        };

        startVisualUpdates();
        setInterval(syncWithServer, 15000);

    } catch (e) {
        document.body.innerHTML = `<div class="error-container"><h1>Connection Error</h1><p>${e.message}</p><p>Please try restarting the app via Telegram.</p></div>`;
    }
}

tg.ready();
init();
showPage('main');

