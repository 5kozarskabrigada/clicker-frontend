const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = 'https://clicker-backend-chjq.onrender.com/api';

let userData = null;
let gameData = { images: [], tasks: [] };
let userProgress = { unlocked_image_ids: [], completed_task_ids: [] };
let transactionHistory = [];
let pendingClicks = 0;
let isSyncing = false;

const coinsEl = document.getElementById('coins');
const coinsPerSecEl = document.getElementById('coinsPerSec');
const coinsPerClickEl = document.getElementById('coinsPerClick');
const clickImage = document.getElementById('clickImage');
const offlineRateEl = document.getElementById('offlineRate');
const notificationContainer = document.getElementById('notificationContainer');


const pages = {
    main: document.getElementById('main'),
    upgrade: document.getElementById('upgrade'),
    images: document.getElementById('images'),
    tasks: document.getElementById('tasks'),
    top: document.getElementById('top'),
    transfer: document.getElementById('transfer'),
};

const navButtons = {
    main: document.getElementById('nav-main'),
    upgrade: document.getElementById('nav-upgrade'),
    images: document.getElementById('nav-images'),
    tasks: document.getElementById('nav-tasks'),
    top: document.getElementById('nav-top'),
    transfer: document.getElementById('nav-transfer'),
};


const INTRA_TIER_COST_MULTIPLIER = 1.215;
const upgrades = {
    click: [
        { id: 'click_tier_1', name: 'A Cups', benefit: '+0.000000001 per click', base_cost: 0.000000064, tier: 1 },
        { id: 'click_tier_2', name: 'B Cups', benefit: '+0.000000008 per click', base_cost: 0.000001024, tier: 2 },
        { id: 'click_tier_3', name: 'C Cups', benefit: '+0.000000064 per click', base_cost: 0.000016384, tier: 3 },
        { id: 'click_tier_4', name: 'D Cups', benefit: '+0.000000512 per click', base_cost: 0.000262144, tier: 4 },
        { id: 'click_tier_5', name: 'DD Cups', benefit: '+0.000004096 per click', base_cost: 0.004194304, tier: 5 },
    ],
    auto: [
        { id: 'auto_tier_1', name: 'Basic Lotion', benefit: '+0.000000001 per sec', base_cost: 0.000000064, tier: 1 },
        { id: 'auto_tier_2', name: 'Enhanced Serum', benefit: '+0.000000008 per sec', base_cost: 0.000001024, tier: 2 },
        { id: 'auto_tier_3', name: 'Collagen Cream', benefit: '+0.000000064 per sec', base_cost: 0.000016384, tier: 3 },
        { id: 'auto_tier_4', name: 'Firming Gel', benefit: '+0.000000512 per sec', base_cost: 0.000262144, tier: 4 },
        { id: 'auto_tier_5', name: 'Miracle Elixir', benefit: '+0.000004096 per sec', base_cost: 0.004194304, tier: 5 },
    ],
    offline: [
        { id: 'offline_tier_1', name: 'Simple Bralette', benefit: '+0.000000001 per hour', base_cost: 0.000000064, tier: 1 },
        { id: 'offline_tier_2', name: 'Sports Bra', benefit: '+0.000000008 per hour', base_cost: 0.000001024, tier: 2 },
        { id: 'offline_tier_3', name: 'Padded Bra', benefit: '+0.000000064 per hour', base_cost: 0.000016384, tier: 3 },
        { id: 'offline_tier_4', name: 'Push-Up Bra', benefit: '+0.000000512 per hour', base_cost: 0.000262144, tier: 4 },
        { id: 'offline_tier_5', name: 'Designer Corset', benefit: '+0.000004096 per hour', base_cost: 0.004194304, tier: 5 },
    ]
};


async function apiRequest(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': window.Telegram.WebApp.initData || ''
            }
        };

        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${API_URL}${endpoint}`, options);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        showNotification('Connection error. Please try again.', 'error');
        throw error;
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

clickImage.onclick = (event) => {
    if (!userData) return;

    tg.HapticFeedback.impactOccurred('light');
    userData.coins += userData.coins_per_click;

    updateUI();
    showFloatingCoin(event.clientX, event.clientY, `+${formatCoins(userData.coins_per_click)}`);

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
        console.error("Failed to sync clicks:", err);
        pendingClicks += clicksToSync;
    } 

    finally {
        isSyncing = false;
        
        if (pendingClicks > 0) {
            setTimeout(syncClicksToServer, 100);
        }
    }
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

    for (const type in upgrades) {

        upgrades[type].forEach(upgrade => {
            const level = userData[`${upgrade.id}_level`] || 0;
            const cost = upgrade.base_cost * Math.pow(INTRA_TIER_COST_MULTIPLIER, level);

            document.getElementById(`${upgrade.id}_level`).textContent = level;
            document.getElementById(`${upgrade.id}_cost`).textContent = formatCoins(cost);
            document.querySelector(`#${upgrade.id} .action-button`).disabled = userData.coins < cost;
        });
    }
}

function generateUpgradeHTML() {

    const containers = {
        click: document.getElementById('clickUpgrades'),
        auto: document.getElementById('autoUpgrades'),
        offline: document.getElementById('offlineUpgrades'),
    };
    for (const type in containers) {
        if (!containers[type]) continue;

        containers[type].innerHTML = '';

        upgrades[type].forEach(u => {
            containers[type].innerHTML += `<div class="upgrade-item" id="${u.id}"><div class="upgrade-icon">${u.tier}</div><div class="upgrade-details"><h3>${u.name}</h3><p>${u.benefit}</p><p>Level: <span id="${u.id}_level">0</span></p></div><div class="upgrade-action"><button class="action-button"><span class="cost">Cost: <span id="${u.id}_cost">0</span></span></button></div></div>`;
        });
    }
}


async function purchaseUpgrade(upgradeId) {
    try {
        const updatedUser = await apiRequest('/upgrade', 'POST', { upgradeId });
        userData = updatedUser;

        updateUI();
        showNotification('Upgrade successful!', 'success');
        tg.HapticFeedback.notificationOccurred('success');
    } 
    
    catch (e) {
        showNotification(e.message, 'error');
        tg.HapticFeedback.notificationOccurred('error');
    }
}

async function handleTransfer() {
    const transferUsernameEl = document.getElementById('transferUsername');
    const transferAmountEl = document.getElementById('transferAmount');
    const transferMessageEl = document.getElementById('transferMessage');
    const toUsername = transferUsernameEl.value.trim().replace(/^@/, '');

    const amount = parseFloat(transferAmountEl.value);

    if (!toUsername || !amount || isNaN(amount) || amount <= 0) {

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
    } 
    
    catch (e) {
        transferMessageEl.textContent = e.message;
        transferMessageEl.className = 'transfer-message error';
    }
}


function showPage(pageId) {
    if (!pages[pageId]) return;

    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[pageId].classList.add('active');

    Object.values(navButtons).forEach(b => b.classList.remove('active'));
    if (navButtons[pageId]) navButtons[pageId].classList.add('active');

    switch (pageId) {
        case 'top': loadTopPlayers(); break;
        case 'images': loadImages(); break;
        case 'tasks': loadAchievements(); break;
        case 'transfer': loadHistory(); break;
    }
}

async function loadTopPlayers(sortBy = 'coins') {

    const topListEl = document.getElementById('topList');
    
    try {
        topListEl.innerHTML = '<li>Loading...</li>';
        const players = await apiRequest(`/top?sortBy=${sortBy}`);

        topListEl.innerHTML = '';

        players.forEach((player, idx) => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="rank">${idx + 1}.</span><span class="name">@${player.username || 'anonymous'}</span><span class="value">${formatCoins(player[sortBy])}</span>`;
            topListEl.appendChild(li);
        });

    } 
    
    catch (e) {
        topListEl.innerHTML = '<li class="error">Failed to load top players.</li>';
    }
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
        } 
        
        else if (isUnlocked) {
            buttonHtml = `<button class="action-button" onclick="selectImage(${image.id})">Select</button>`;
        } 
        
        else if (image.cost > 0) {
            buttonHtml = `<button class="action-button" onclick="buyImage(${image.id}, ${image.cost})" ${userData.coins < image.cost ? 'disabled' : ''}>Buy: ${image.cost}</button>`;
        } 
        
        else {
            buttonHtml = `<button class="action-button" disabled>Locked by Task</button>`;
        }

        card.innerHTML = `<div class="image-preview" style="background-image: url('${image.image_url}')"></div><div class="image-info"><h3>${image.name}</h3><p>${image.description || ''}</p>${buttonHtml}</div>`;
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
    } 
    
    catch (e) { }
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
    } 
    catch (e) { }
}

async function loadHistory() {
    const list = document.getElementById('history-list');
    const searchInput = document.getElementById('history-search');
    
    try {
        list.innerHTML = '<li>Loading...</li>';
        const data = await apiRequest('/transfers');

        transactionHistory = data;
        renderHistory();
    } 
    
    catch (e) {
        list.innerHTML = '<li class="error">Failed to load transaction history.</li>';
    }

    searchInput.oninput = () => renderHistory(searchInput.value.toLowerCase());
}

function renderHistory(filter = '') {

    const list = document.getElementById('history-list');
    list.innerHTML = '';

    const filtered = transactionHistory.filter(tx => (tx.from?.username || '').toLowerCase().includes(filter) || (tx.to?.username || '').toLowerCase().includes(filter));
    
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

        item.innerHTML = `<div class="history-details"><p>${direction} <b>@${otherUser || 'anonymous'}</b></p><span class="timestamp">${new Date(tx.created_at).toLocaleString()}</span></div><div class="history-amount ${amountClass}">${sign}${formatCoins(parseFloat(tx.amount))}</div>`;
        list.appendChild(item);
    });
}

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
        const cardHtml = `<div class="achievement-card ${isCompleted ? 'unlocked' : ''}"><div class="achievement-icon">${isCompleted ? '✅' : '🎯'}</div><div class="achievement-content"><h3>${task.name}</h3><p>${task.description}</p></div></div>`;
        
        if (isCompleted) {
            achievementsContainer.innerHTML += cardHtml;
            completedAchievementsFound = true;
        } 
        
        else {
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

function openUpgradeTab(evt, tabName) {
    const parent = evt.target.closest('.page');

    parent.querySelectorAll('.upgrade-tab-content').forEach(c => c.classList.remove('active'));
    parent.querySelectorAll('.upgrade-tab-link').forEach(l => l.classList.remove('active'));
    parent.querySelector(`#${tabName}`).classList.add('active');

    evt.target.classList.add('active');
}

function openTopTab(evt, sortBy) {
    const parent = evt.target.closest('.page');

    parent.querySelectorAll('.top-tab-link').forEach(l => l.classList.remove('active'));
    evt.target.classList.add('active');

    loadTopPlayers(sortBy);
}

function openSubTab(evt, tabId) {
    const parent = evt.target.closest('.page');

    parent.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
    parent.querySelectorAll('.sub-tab-link').forEach(l => l.classList.remove('active'));
    parent.querySelector(`#${tabId}`).classList.add('active');

    evt.target.classList.add('active');
}

async function init() {
    const loadingOverlay = document.getElementById('loading-overlay');
    generateUpgradeHTML();
    try {
        const [userDataResponse, gameDataResponse, userProgressResponse, userTasksResponse] = await Promise.all([
            apiRequest('/user'),
            apiRequest('/game-data'),
            apiRequest('/user-progress'),
            apiRequest('/user-tasks')
        ]);

        if (!userDataResponse || !userDataResponse.user) throw new Error("Invalid user data from server.");

        userData = userDataResponse.user;
        const earnings = userDataResponse.earnings;

        gameData = gameDataResponse;
        userProgress = userProgressResponse;
        userProgress.completed_task_ids = userTasksResponse.filter(t => t.is_completed).map(t => t.task_id);

        if (earnings && earnings.earned_passive > 0) {
            showNotification(`Welcome back! You earned ${formatCoins(earnings.earned_passive)} coins while away.`, 'success');
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


function setupEventListeners() {
    for (const key in navButtons) {
        
        if (navButtons[key]) {
            navButtons[key].onclick = () => showPage(key);
        }
    }

    document.getElementById('goto-images-btn').onclick = () => showPage('images');
    document.getElementById('transferBtn').onclick = handleTransfer;
}

tg.ready();
setupEventListeners();
init();
showPage('main');