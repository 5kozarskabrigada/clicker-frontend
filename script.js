const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = 'https://clicker-backend-chjq.onrender.com';

let userData = null;
let isLoading = false;
let isClicking = false;
let pendingClicks = 0;
let isSyncing = false;
let gameData = { images: [], tasks: [] };
let userProgress = { unlocked_image_ids: [] };
let transactionHistory = [];

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

const TIER_COST_MULTIPLIER = 16;
const INTRA_TIER_COST_MULTIPLIER = 1.215;

const clickBaseCost = 0.000000064;
const autoBaseCost = 0.000000128; 
const offlineBaseCost = 0.000001;


const upgrades = {
    'click_tier_1': { base_cost: clickBaseCost, cost_mult: INTRA_TIER_COST_MULTIPLIER },
    'click_tier_2': { base_cost: clickBaseCost * TIER_COST_MULTIPLIER, cost_mult: INTRA_TIER_COST_MULTIPLIER },
    'click_tier_3': { base_cost: clickBaseCost * Math.pow(TIER_COST_MULTIPLIER, 2), cost_mult: INTRA_TIER_COST_MULTIPLIER },
    'click_tier_4': { base_cost: clickBaseCost * Math.pow(TIER_COST_MULTIPLIER, 3), cost_mult: INTRA_TIER_COST_MULTIPLIER },
    'click_tier_5': { base_cost: clickBaseCost * Math.pow(TIER_COST_MULTIPLIER, 4), cost_mult: INTRA_TIER_COST_MULTIPLIER },

    'auto_tier_1': { base_cost: autoBaseCost, cost_mult: INTRA_TIER_COST_MULTIPLIER },
    'auto_tier_2': { base_cost: autoBaseCost * TIER_COST_MULTIPLIER, cost_mult: INTRA_TIER_COST_MULTIPLIER },
    'auto_tier_3': { base_cost: autoBaseCost * Math.pow(TIER_COST_MULTIPLIER, 2), cost_mult: INTRA_TIER_COST_MULTIPLIER },
    'auto_tier_4': { base_cost: autoBaseCost * Math.pow(TIER_COST_MULTIPLIER, 3), cost_mult: INTRA_TIER_COST_MULTIPLIER },
    'auto_tier_5': { base_cost: autoBaseCost * Math.pow(TIER_COST_MULTIPLIER, 4), cost_mult: INTRA_TIER_COST_MULTIPLIER },

    'offline_tier_1': { base_cost: offlineBaseCost, cost_mult: 1.20 },
    'offline_tier_2': { base_cost: offlineBaseCost * TIER_COST_MULTIPLIER, cost_mult: 1.20 },
    'offline_tier_3': { base_cost: offlineBaseCost * Math.pow(TIER_COST_MULTIPLIER, 2), cost_mult: 1.20 },
    'offline_tier_4': { base_cost: offlineBaseCost * Math.pow(TIER_COST_MULTIPLIER, 3), cost_mult: 1.20 },
    'offline_tier_5': { base_cost: offlineBaseCost * Math.pow(TIER_COST_MULTIPLIER, 4), cost_mult: 1.20 },
};


const pages = {
    main: document.getElementById('main'),
    upgrade: document.getElementById('upgrade'),
    tasks: document.getElementById('tasks'),
    images: document.getElementById('images'),
    top: document.getElementById('top'),
    transfer: document.getElementById('transfer'),
};

const navButtons = {
    main: document.getElementById('nav-main'),
    upgrade: document.getElementById('nav-upgrade'),
    tasks: document.getElementById('nav-tasks'), 
    images: document.getElementById('nav-images'),
    top: document.getElementById('nav-top'),
    transfer: document.getElementById('nav-transfer'),
};

const offlineRateEl = document.getElementById('offlineRate');

function showPage(pageId) {
    if (!pages[pageId] || !navButtons[pageId]) return;

    Object.values(pages).forEach(p => p.classList.remove('active'));
    Object.values(navButtons).forEach(b => b.classList.remove('active'));

    pages[pageId].classList.add('active');
    navButtons[pageId].classList.add('active');

  
    switch (pageId) {
        case 'top': loadTopPlayers(); break;
        case 'images': loadImages(); break;
        case 'tasks': loadAchievements(); break;
        case 'transfer': loadHistory(); break; 
    }
}

Object.keys(navButtons).forEach(key => {
    if (navButtons[key]) navButtons[key].onclick = () => showPage(key);
});

document.addEventListener('DOMContentLoaded', () => {
    for (const id in upgrades) {
        const button = document.querySelector(`#upgrade_${id} .action-button`);
        if (button) button.onclick = () => purchaseUpgrade(id);
    }
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

function formatCoins(amount) {
    if (typeof amount !== 'number') return '0.000000000';
    return amount.toFixed(9);
}


function updateUI() {
    if (!userData) return;

    coinsEl.textContent = formatCoins(userData.coins);
    coinsPerClickEl.textContent = formatCoins(userData.coins_per_click);
    coinsPerSecEl.textContent = formatCoins(userData.coins_per_sec);
    if (offlineRateEl) offlineRateEl.textContent = formatCoins(userData.offline_coins_per_hour) + ' / hr';

    for (const id in upgrades) {
        const level = userData[`${id}_level`] || 0;
        const cost = upgrades[id].base_cost * Math.pow(upgrades[id].cost_mult, level);

        const levelEl = document.getElementById(`${id}_level`);
        const costEl = document.getElementById(`${id}_cost`);
        const button = document.querySelector(`#upgrade_${id} .action-button`);

        if (levelEl) levelEl.textContent = level;
        if (costEl) costEl.textContent = formatCoins(cost);
        if (button) button.disabled = userData.coins < cost;
    }
}

async function purchaseUpgrade(upgradeId) {
    try {
        const updatedUser = await apiRequest('/upgrade', 'POST', { upgradeId });
        userData = updatedUser;
        updateUI();
        showNotification('Upgrade successful!', 'success');
        tg.HapticFeedback.notificationOccurred('success');
    } catch (e) {
        showNotification(e.message, 'error');
        tg.HapticFeedback.notificationOccurred('error');
    }
}

clickImage.onclick = (event) => {
    if (!userData) return;
    tg.HapticFeedback.impactOccurred('light');

    userData.coins += userData.coins_per_click;
    updateUI();
    showFloatingCoin(event.clientX, event.clientY, `+${userData.coins_per_click.toFixed(16)}`);

    pendingClicks++;
    syncClicksToServer();
};

async function syncClicksToServer() {
    if (isSyncing || pendingClicks === 0) return;

    isSyncing = true;
    const clicksToSync = pendingClicks;
    pendingClicks = 0; 

    try {
        const updatedUser = await apiRequest('/click', 'POST', { clicks: clicksToSync });
        if (updatedUser) {
            userData = updatedUser;
            updateUI();
        }
    } 
    
    catch (err) {
        console.error("Failed to sync clicks with server:", err);
        pendingClicks += clicksToSync; 
    } 
    
    finally {
        isSyncing = false;

        if (pendingClicks > 0) {
            setTimeout(syncClicksToServer, 100);
        }
    }
}


// clickImage.onclick = (event) => {
//     if (!userData) return;

//     tg.HapticFeedback.impactOccurred('light');

//     userData.coins += userData.coins_per_click;

//     coinsEl.textContent = parseFloat(userData.coins)
//     .toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 10 });

//     showFloatingCoin(event.clientX, event.clientY, `+${userData.coins_per_click.toFixed(10)}`);
//     apiRequest('/click', 'POST')
//     .then(user => { userData = user; })
//     .catch(err => console.error(err));
// };

// upgradeClickBtn.onclick = async () => {
//     tg.HapticFeedback.notificationOccurred('success');
//     try {

//         const updatedUser = await apiRequest('/upgrade/click', 'POST');
//         userData = updatedUser;
//         updateUI();
//         showNotification('Click power upgraded!', 'success');
//     } catch (e) { }
// };

// upgradeAutoBtn.onclick = async () => {
//     try {
//         const updatedUser = await apiRequest('/upgrade/auto', 'POST');
//         userData = updatedUser;
//         updateUI();
//         showNotification('Auto income upgraded!', 'success');
//     } catch (e) {}
// };

transferBtn.onclick = async () => {
    const toUsername = transferUsernameEl.value.trim().replace(/^@/, '');
    const amount = parseInt(transferAmountEl.value, 16);

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

function openTopTab(evt, sortBy) {
    document.querySelectorAll('.top-tab-link').forEach(link => link.classList.remove('active'));
    evt.currentTarget.classList.add('active');
    loadTopPlayers(sortBy);
}

// async function loadTopPlayers(sortBy = 'coins') {
//     try {
//         const topListEl = document.getElementById('topList');
//         topListEl.innerHTML = '<li>Loading...</li>';
//         const players = await apiRequest(`/top?sortBy=${sortBy}`);

//         const formatValue = (value) => {
//             return parseFloat(value).toFixed(16);
//         };

//         topListEl.innerHTML = '';
//         players.forEach((player, idx) => {
//             const li = document.createElement('li');
//             li.innerHTML = `
//                 <span class="rank">${idx + 1}.</span>
//                 <span class="name">@${player.username || 'anonymous'}</span>
//                 <span class="value">${formatValue(player[sortBy])}</span>
//             `;
//             topListEl.appendChild(li);
//         });
//     } catch (e) {
//         topListEl.innerHTML = '<li class="error">Failed to load top players.</li>';
//     }
// }

// function startPassiveIncome() {
//     setInterval(() => {
//         if (userData && userData.coins_per_sec > 0) {
//             userData.coins += userData.coins_per_sec;
//             coinsEl.textContent = parseFloat(userData.coins)
//             .toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 10 });
//         }
//     }, 1000);
// }


async function loadTopPlayers(sortBy = 'coins') {
    try {
        const topListEl = document.getElementById('topList');
        topListEl.innerHTML = '<li>Loading...</li>';
        const players = await apiRequest(`/top?sortBy=${sortBy}`);

        topListEl.innerHTML = '';
        players.forEach((player, idx) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="rank">${idx + 1}.</span>
                <span class="name">@${player.username || 'anonymous'}</span>
                <span class="value">${formatCoins(player[sortBy])}</span>
            `;
            topListEl.appendChild(li);
        });
    } catch (e) {
        topListEl.innerHTML = '<li class="error">Failed to load top players.</li>';
    }
}


function startPassiveIncome() {
    setInterval(() => {
        if (userData && userData.coins_per_sec > 0) {

            userData.coins += userData.coins_per_sec;
            updateUI();
        }
    }, 1000);
}



async function loadImages() {
    const container = document.getElementById('imagesContainer');
    container.innerHTML = ''; 

    gameData.images.forEach(image => {
        const isUnlocked = userProgress.unlocked_image_ids.includes(image.id);
        const isEquipped = userData.equipped_image_id === image.id;

        const card = document.createElement('div');
        card.className = `image-card ${isEquipped ? 'selected' : ''}`;

        let buttonHtml = '';
        if (isEquipped) {
            buttonHtml = `<button class="action-button" disabled>Equipped</button>`;
        } else if (isUnlocked) {
            buttonHtml = `<button class="action-button" onclick="selectImage(${image.id})">Select</button>`;
        } else if (image.cost > 0) {
            buttonHtml = `<button class="action-button" onclick="buyImage(${image.id}, ${image.cost})" ${userData.coins < image.cost ? 'disabled' : ''}>Buy: ${image.cost}</button>`;
        } else {
            buttonHtml = `<button class="action-button" disabled>Locked by Task</button>`;
        }

        card.innerHTML = `
            <div class="image-preview" style="background-image: url('${image.image_url}')"></div>
            <div class="image-info">
                <h3>${image.name}</h3>
                <p>${image.description || ''}</p>
                ${buttonHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

async function buyImage(imageId, cost) {
    if (userData.coins < cost) return;
    try {
        await apiRequest('/images/buy', 'POST', { imageId });
        userData.coins -= cost; 
        userProgress.unlocked_image_ids.push(imageId);
        loadImages();
        updateUI();
    } catch (e) {}
}

async function selectImage(imageId) {
    try {
        const updatedUser = await apiRequest('/images/select', 'POST', { imageId });
        userData = updatedUser;
        const selectedImageUrl = gameData.images.find(img => img.id === imageId)?.image_url;
        if (selectedImageUrl) {
            document.getElementById('clickImage').style.backgroundImage = `url('${selectedImageUrl}')`;
        }
        loadImages();
    } catch (e) {}
}

// function loadHistory() {
//     const searchInput = document.getElementById('history-search');

//     apiRequest('/transfers').then(data => {
//         transactionHistory = data;
//         renderHistory(); 
//     });

//     searchInput.oninput = () => renderHistory(searchInput.value.toLowerCase());
// }


async function loadHistory() {
    const list = document.getElementById('history-list');
    const searchInput = document.getElementById('history-search');
    list.innerHTML = '<li>Loading...</li>';

    try {
        const data = await apiRequest('/transfers');
        transactionHistory = data;
        renderHistory();
    } catch (e) {
        list.innerHTML = '<li class="error">Failed to load transaction history.</li>';
    }

    searchInput.oninput = () => renderHistory(searchInput.value.toLowerCase());
}

function renderHistory(filter = '') {
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    const filtered = transactionHistory.filter(tx =>
        (tx.from?.username || '').toLowerCase().includes(filter) ||
        (tx.to?.username || '').toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
        list.innerHTML = '<li>No transactions found.</li>';
        return;
    }

    filtered.forEach(tx => {
        const item = document.createElement('li');
        item.className = 'history-item';

        const isSent = tx.from.username === userData.username;
        const direction = isSent ? 'Sent to' : 'Received from';
        const otherUser = isSent ? tx.to.username : tx.from.username;
        const amountClass = isSent ? 'sent' : 'received';
        const sign = isSent ? '-' : '+';

        item.innerHTML = `
            <div class="history-details">
                <p>${direction} <b>@${otherUser || 'anonymous'}</b></p>
                <span class="timestamp">${new Date(tx.created_at).toLocaleString()}</span>
            </div>
            <div class="history-amount ${amountClass}">
                ${sign}${formatCoins(parseFloat(tx.amount))}
            </div>
        `;
        list.appendChild(item);
    });
}


// function loadAchievements() {
//     const tasksContainer = document.getElementById('tasks-content');
//     const achievementsContainer = document.getElementById('achievements-content');
//     tasksContainer.innerHTML = '';
//     achievementsContainer.innerHTML = '';

//     gameData.tasks.forEach(task => {
//         const isCompleted = userProgress.completed_task_ids.includes(task.id);
//         const cardHtml = `
//             <div class="achievement-card ${isCompleted ? 'unlocked' : ''}">
//                 <div class="achievement-icon">🏆</div>
//                 <div class="achievement-content">
//                     <h3>${task.name}</h3>
//                     <p>${task.description}</p>
//                 </div>
//             </div>`;

//         if (isCompleted) {
//             achievementsContainer.innerHTML += cardHtml;
//         } else {
//             tasksContainer.innerHTML += cardHtml;
//         }
//     });

//     if (tasksContainer.innerHTML === '') tasksContainer.innerHTML = '<p>No active tasks remaining!</p>';
//     if (achievementsContainer.innerHTML === '') achievementsContainer.innerHTML = '<p>No achievements unlocked yet.</p>';
// }

function loadAchievements() {
    const tasksContainer = document.getElementById('tasks-content');
    const achievementsContainer = document.getElementById('achievements-content');
    tasksContainer.innerHTML = '';
    achievementsContainer.innerHTML = '';

    if (!gameData.tasks || gameData.tasks.length === 0) {
        tasksContainer.innerHTML = '<p class="empty-state">No tasks available.</p>';
        achievementsContainer.innerHTML = '<p class="empty-state">No achievements unlocked yet.</p>';
        return;
    }

    let activeTasksFound = false;
    let completedAchievementsFound = false;

    gameData.tasks.forEach(task => {
        const isCompleted = userProgress.completed_task_ids && userProgress.completed_task_ids.includes(task.id);

        let progressHtml = '';
        
        if (!isCompleted && task.task_type.startsWith('total_')) {
            const currentProgress = userData[task.task_type] || 0;
            const percentage = Math.min(100, (currentProgress / task.threshold) * 100);
            progressHtml = `<div class="progress-bar-container"><div class="progress-bar" style="width: ${percentage}%"></div></div>`;
        }

        const cardHtml = `
            <div class="achievement-card ${isCompleted ? 'unlocked' : ''}">
                <div class="achievement-icon">
                    ${isCompleted ? '✅' : '🎯'}
                </div>
                <div class="achievement-content">
                    <h3>${task.name}</h3>
                    <p>${task.description}</p>
                    ${progressHtml}
                </div>
            </div>`;

        if (isCompleted) {
            achievementsContainer.innerHTML += cardHtml;
            completedAchievementsFound = true;
        } else {
            tasksContainer.innerHTML += cardHtml;
            activeTasksFound = true;
        }
    });

    if (!activeTasksFound) tasksContainer.innerHTML = '<p class="empty-state">No active tasks remaining!</p>';
    if (!completedAchievementsFound) achievementsContainer.innerHTML = '<p class="empty-state">No achievements unlocked yet.</p>';
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
    const loadingOverlay = document.getElementById('loading-overlay');
    try {
        const [userDataResponse, gameDataResponse, userProgressResponse, userTasksResponse] = await Promise.all([
            apiRequest('/user'),
            apiRequest('/game-data'),
            apiRequest('/user-progress'),
            apiRequest('/user-tasks')
        ]);

        userData = userDataResponse.user;
        gameData = gameDataResponse;
        userProgress = userProgressResponse;
        userProgress.completed_task_ids = userTasksResponse.filter(t => t.is_completed).map(t => t.task_id);

        const earnings = userDataResponse.earnings;
        if (earnings && earnings.earned_passive > 0) {
            showNotification(`Welcome back! You earned ${formatCoins(earnings.earned_passive)} coins.`, 'success');
        }

        updateUI();
        const equippedImage = gameData.images.find(img => img.id === userData.equipped_image_id);
        if (equippedImage) {
            clickImage.style.backgroundImage = `url('${equippedImage.image_url}')`;
        }


        loadingOverlay.classList.remove('active');
        startPassiveIncome();
    } catch (e) {
        document.getElementById('loading-text').innerHTML = `Connection Error<br/><small>Please restart inside Telegram.</small>`;
    }
}



function openModal(modalId) 
{ 
    document.getElementById(modalId).classList.remove('hidden'); 
}


function closeAllModals() { 
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')); 
}

document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeAllModals();
        }
    });
});


function openSubTab(evt, tabId) {

    const parentPage = evt.target.closest('.page');
    parentPage.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
    parentPage.querySelectorAll('.sub-tab-link').forEach(l => l.classList.remove('active'));
    parentPage.querySelector(`#${tabId}`).classList.add('active');
    
    evt.target.classList.add('active');
}

function startPassiveIncome() {
    setInterval(() => {
        if (userData && userData.coins_per_sec > 0) {
            userData.coins += userData.coins_per_sec;
            updateUI();
        }
    }, 1000);
}

tg.ready();
init();
showPage('main');

