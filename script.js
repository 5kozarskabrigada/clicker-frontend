const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = 'https://clicker-backend-chjq.onrender.com';

let userData = null;
let gameData = { images: [], tasks: [] };
let userProgress = { unlocked_image_ids: [], claimed_task_ids: [] };
let transactionHistory = [];
let activeIncomeInterval = null;



let clickBuffer = 0;
let lastClickTime = 0;
let isSyncing = false;
let clickSyncTimeout = null;
const SYNC_INTERVAL = 1000; 
const MAX_CLICKS_PER_SECOND = 25;
const clickTimestamps = [];  

const cpsDisplay = document.getElementById('cps-display');
const coinsEl = document.getElementById('coins');
const coinsPerSecEl = document.getElementById('coinsPerSec');
const coinsPerClickEl = document.getElementById('coinsPerClick');
const clickImage = document.getElementById('clickImage');
const offlineRateEl = document.getElementById('offlineRate');
const notificationContainer = document.getElementById('notificationContainer');
const characterBackgroundEl = document.querySelector('.character-background');

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



function showPage(pageId) {
    if (!pages[pageId]) return;
    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[pageId].classList.add('active');
    Object.values(navButtons).forEach(b => b.classList.remove('active'));
    if (navButtons[pageId]) {
        navButtons[pageId].classList.add('active');
    }

    switch (pageId) {
        case 'top': loadTopPlayers(); break;
        case 'images': loadImages(); break;
        case 'tasks': loadTasks(); break; 
        case 'transfer': loadHistory(); break;
    }
}

async function apiRequest(endpoint, method = 'GET', body = null) {
    try {
        const headers = { 'Content-Type': 'application/json', 'Authorization': Telegram.WebApp.initData || '' };
        const options = { method, headers };
        if (body) { options.body = JSON.stringify(body); }
        const response = await fetch(`${API_URL}/api${endpoint}`, options);
        if (!response.ok) {
            const responseData = await response.json().catch(() => ({ error: 'Invalid JSON response' }));
            throw new Error(responseData.error || `HTTP error! Status: ${response.status}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        console.error(`API request to ${endpoint} failed:`, error);
        showNotification(error.message, 'error');
        throw error;
    }
}

function formatCoins(amount, precision = 9) {
    if (typeof amount !== 'number' || isNaN(amount)) return (0).toFixed(precision);
    return amount.toFixed(precision);
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
            containers[type].innerHTML += `
                <div class="upgrade-item" id="${u.id}">
                    <div class="upgrade-icon">${u.tier}</div>
                    <div class="upgrade-details">
                        <h3>${u.name}</h3>
                        <p>${u.benefit}</p>
                        <p class="level">Level: <span id="${u.id}_level">0</span></p>
                    </div>
                    <div class="upgrade-action">
                        <button class="action-button">
                            <span class="cost">Cost: <span id="${u.id}_cost">0</span></span>
                        </button>
                    </div>
                </div>
            `;
        });
    }
    for (const type in upgrades) {
        upgrades[type].forEach(upgrade => {
            const button = document.querySelector(`#${upgrade.id} .action-button`);
            if (button) button.onclick = () => purchaseUpgrade(upgrade.id);
        });
    }
}

function updateUI() {
    if (!userData) return;
    coinsEl.textContent = formatCoins(userData.coins);
    coinsPerClickEl.textContent = formatCoins(userData.coins_per_click);
    coinsPerSecEl.textContent = formatCoins(userData.coins_per_sec);
    if (offlineRateEl) offlineRateEl.textContent = formatCoins(userData.offline_coins_per_hour);
    for (const type in upgrades) {
        upgrades[type].forEach(upgrade => {
            const levelEl = document.getElementById(`${upgrade.id}_level`);
            if (levelEl) {
                const level = userData[`${upgrade.id}_level`] || 0;
                const cost = upgrade.base_cost * Math.pow(INTRA_TIER_COST_MULTIPLIER, level);
                levelEl.textContent = level;
                document.getElementById(`${upgrade.id}_cost`).textContent = formatCoins(cost);
                document.querySelector(`#${upgrade.id} .action-button`).disabled = userData.coins < cost;
            }
        });
    }
}



function handleUserClick(event) {
    if (!userData || !userData.coins_per_click) return;
    const now = Date.now();

    if (now - lastClickTime < 1000 / MAX_CLICKS_PER_SECOND) return;

    lastClickTime = now;
    clickTimestamps.push(now);

    tg.HapticFeedback.impactOccurred('light');
    userData.coins += userData.coins_per_click;
    clickBuffer++;

    updateUI();

    if (characterBackgroundEl) {
        characterBackgroundEl.style.transform = 'scale(1.02)';
        setTimeout(() => { characterBackgroundEl.style.transform = 'scale(1)'; }, 150);
    }

    const rect = clickImage.getBoundingClientRect();
    const x = event.clientX || (rect.left + rect.width / 2);
    const y = event.clientY || (rect.top + rect.height / 2);
    showFloatingCoin(x, y, `+${formatCoins(userData.coins_per_click)}`);

    clearTimeout(clickSyncTimeout);
    clickSyncTimeout = setTimeout(syncClicks, SYNC_INTERVAL);
}


clickImage.onclick = (event) => {
    if (!userData || !userData.coins_per_click) return;

    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;
    lastClickTime = now;


    if (timeSinceLastClick < 1000 / MAX_CLICKS_PER_SECOND) {

        console.warn("Clicking too fast!");
        return;
    }


    if (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }

    const clickAmount = userData.coins_per_click;
    userData.coins += clickAmount;
    clickBuffer++;
    updateUI();

    if (characterBackgroundEl) {
        characterBackgroundEl.style.transform = 'scale(1.02)';
        setTimeout(() => { characterBackgroundEl.style.transform = 'scale(1)'; }, 150);
    }

    const rect = clickImage.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    showFloatingCoin(x, y, `+${formatCoins(clickAmount)}`);

    if (!isSyncing && Date.now() - lastSyncTime > SYNC_INTERVAL) {
        syncClicks();
    }
};


let unsentClicks = parseInt(localStorage.getItem('unsentClicks') || '0', 10);

function registerClick() {
    unsentClicks++;
    localStorage.setItem('unsentClicks', unsentClicks);
    updateClickDisplay();
}


async function syncClicks() {
    if (unsentClicks <= 0) return;

    try {
        const res = await fetch(`${API_URL}/api/click`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': tg.initData || ''
            },
            body: JSON.stringify({ clicks: unsentClicks })
        });

        if (res.ok) {
            unsentClicks = 0;
            localStorage.setItem('unsentClicks', '0');
        } else {
            console.warn('Click sync failed, will retry later');
        }
    } catch (err) {
        console.error('Network error while syncing clicks', err);
    }
}


setInterval(syncClicks, 2000);

async function purchaseUpgrade(upgradeId) {
    try {
        await syncClicks();

        const updatedUser = await apiRequest('/upgrade', 'POST', { upgradeId });

        userData = updatedUser;
        updateUI();
        startPassiveIncome();
        showNotification('Upgrade successful!', 'success');
        tg.HapticFeedback.notificationOccurred('success');

    } catch (e) {
        showNotification(e.message, 'error');
        tg.HapticFeedback.notificationOccurred('error');

        try {
            const refreshedUserData = await apiRequest('/user');
            userData = refreshedUserData.user;
            updateUI();
        } catch (refreshError) {
            console.error("Failed to re-sync user data after failed upgrade:", refreshError);
        }
    }
}


setInterval(() => {
    if (clickBuffer > 0 && !isSyncing) {
        syncClicks();
    }
}, SYNC_INTERVAL);


window.addEventListener('beforeunload', () => {
    if (clickBuffer > 0) {
        syncClicks();
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const clickImage = document.getElementById('clickImage');

    if (clickImage) {
        clickImage.onclick = (event) => {
            if (!userData || !userData.coins_per_click) return;

            if (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }

            const clickAmount = userData.coins_per_click;
            userData.coins += clickAmount;
            updateUI();

            clickBuffer.push({
                amount: clickAmount,
                timestamp: Date.now()
            });

            clickImage.style.transform = 'scale(0.95)';
            setTimeout(() => { clickImage.style.transform = 'scale(1)'; }, 100);

            if (!isSyncing && Date.now() - lastSyncTime > SYNC_INTERVAL) {
                syncClicks();
            }
        };
    } else {
        console.error('Clickable area element not found');
    }

    setInterval(() => {
        if (clickBuffer.length > 0 && !isSyncing) {
            syncClicks();
        }
    }, SYNC_INTERVAL);
});





async function handleTransfer() {
    await syncClicks(); 
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
        loadHistory();
    } catch (e) {
        transferMessageEl.textContent = e.message;
        transferMessageEl.className = 'transfer-message error';
        tg.HapticFeedback.notificationOccurred('error');
    }
}


async function loadTopPlayers(sortBy = 'coins') {
    const currentSort = document.querySelector('.top-tab-link.active')?.dataset.sort || 'coins';
    try {
        const topListEl = document.getElementById('topList');
        topListEl.innerHTML = '<li class="loading-state">Loading leaderboard...</li>';
        const players = await apiRequest(`/top?sortBy=${sortBy}`);

        if (!players || players.length === 0) {
            topListEl.innerHTML = '<li class="empty-state">No players found</li>';
            return;
        }

        topListEl.innerHTML = '';
        players.forEach((player, idx) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="rank">${idx + 1}</span>
                <span class="name">@${player.username || 'anonymous'}</span>
                <span class="value">${formatCoins(player[sortBy])}</span>
            `;
            if (idx < 3) li.classList.add(`top-${idx + 1}`);
            topListEl.appendChild(li);
        });
    } catch (e) {
        document.getElementById('topList').innerHTML = '<li class="error-state">Failed to load leaderboard</li>';
    }
}

async function loadImages(filter = 'all') {
    const container = document.getElementById('imagesContainer');
    container.innerHTML = '<div class="loading-state">Loading images...</div>';

    try {
        if (gameData.images.length === 0) {
            const gameDataRes = await apiRequest('/game-data');
            gameData.images = gameDataRes.images || [];
        }
        if (!userProgress.unlocked_image_ids) {
            const progressRes = await apiRequest('/user-progress');
            userProgress.unlocked_image_ids = progressRes.unlocked_image_ids || [];
        }

        if (gameData.images.length === 0) {
            container.innerHTML = '<div class="empty-state">No images available</div>';
            return;
        }

        container.innerHTML = '';
        gameData.images.forEach(image => {
            const isUnlocked = userProgress.unlocked_image_ids.includes(image.id);
            const isEquipped = userData.equipped_image_id === image.id;

            if (filter === 'unlocked' && !isUnlocked) return;
            if (filter === 'locked' && isUnlocked) return;

            const card = document.createElement('div');
            card.className = `image-card ${isEquipped ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;

            let buttonHtml = '';
            if (isEquipped) {
                buttonHtml = `<button class="action-button" disabled>Equipped</button>`;
            } else if (isUnlocked) {
                buttonHtml = `<button class="action-button" onclick="selectImage(${image.id})">Select</button>`;
            } else if (image.cost > 0) {
                buttonHtml = `<button class="action-button" onclick="buyImage(${image.id}, ${image.cost})" ${userData.coins < image.cost ? 'disabled' : ''}>
                    Buy: ${formatCoins(image.cost)}
                </button>`;
            } else {
                buttonHtml = `<button class="action-button" disabled>Complete Task</button>`;
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

        if (container.children.length === 0) {
            container.innerHTML = `<div class="empty-state">No ${filter} images found</div>`;
        }
    } catch (e) {
        console.error("Failed to load images:", e);
        container.innerHTML = '<div class="error-state">Failed to load images</div>';
    }
}

function filterSkins(filter) {
    document.querySelectorAll('.skins-filter .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === filter);
    });
    loadImages(filter);
}

async function buyImage(imageId, cost) {
    if (userData.coins < cost) {
        showNotification("Not enough coins!", 'error');
        return;
    }

    try {
        await apiRequest('/images/buy', 'POST', { imageId });
        userData.coins -= cost;
        userProgress.unlocked_image_ids.push(imageId);
        updateUI();
        loadImages();
        showNotification("Image unlocked!", 'success');
    } catch (e) {
        showNotification(e.message || 'Purchase failed', 'error');
    }
}

async function selectImage(imageId) {
    try {
        const updatedUser = await apiRequest('/images/select', 'POST', { imageId });
        userData = updatedUser;
        const selectedImageUrl = gameData.images.find(img => img.id === imageId)?.image_url;
        if (selectedImageUrl) {
            clickImage.style.backgroundImage = `url('${selectedImageUrl}')`;
        }
        loadImages();
        showNotification("Image equipped!", 'success');
    } catch (e) {
        showNotification(e.message || 'Could not select image', 'error');
    }
}

async function loadHistory() {
    const list = document.getElementById('history-list');
    const searchInput = document.getElementById('history-search');
    list.innerHTML = '<li class="loading-state">Loading history...</li>';

    try {
        const data = await apiRequest('/transfers');
        transactionHistory = data;
        renderHistory();
    } catch (e) {
        list.innerHTML = '<li class="error-state">Failed to load history</li>';
    }

    searchInput.oninput = () => renderHistory(searchInput.value.toLowerCase());
}

function renderHistory(filter = '') {
    const list = document.getElementById('history-list');

    if (transactionHistory.length === 0) {
        list.innerHTML = '<li class="empty-state">No transactions yet</li>';
        return;
    }

    const filtered = transactionHistory.filter(tx =>
        (tx.from?.username || '').toLowerCase().includes(filter) ||
        (tx.to?.username || '').toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
        list.innerHTML = '<li class="empty-state">No matching transactions</li>';
        return;
    }

    list.innerHTML = '';
    filtered.forEach(tx => {
        const isSent = tx.from.username === userData.username;
        const direction = isSent ? 'Sent to' : 'Received from';
        const otherUser = isSent ? tx.to.username : tx.from.username;
        const amountClass = isSent ? 'sent' : 'received';
        const sign = isSent ? '-' : '+';

        const item = document.createElement('li');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-details">
                <p>${direction} <b>@${otherUser || 'anonymous'}</b></p>
                <span class="timestamp">${new Date(tx.created_at).toLocaleString()}</span>
            </div>
            <div class="history-amount ${amountClass}">${sign}${formatCoins(parseFloat(tx.amount))}</div>
        `;
        list.appendChild(item);
    });
}


async function claimTaskReward(taskId) {
    try {
        const updatedUser = await apiRequest(`/tasks/${taskId}/claim`, 'POST');
        userData = updatedUser;
        if (!userProgress.claimed_task_ids.includes(taskId)) {
            userProgress.claimed_task_ids.push(taskId);
        }
        updateUI();
        showNotification('Reward claimed!', 'success');
        loadTasks(); 
    } catch (e) {
        showNotification(e.message || 'Failed to claim reward.', 'error');
    }
}

function renderTask(task, userTaskProgress, isClaimed) {
    const isCompleted = userTaskProgress?.is_completed || false;
    const canClaim = isCompleted && !isClaimed;

    let progressHTML = '';
    if (task.type === 'clicks' && !isCompleted) {
        const progress = Math.min((userTaskProgress?.progress || 0) / task.requirement * 100, 100);
        progressHTML = `
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
            <p class="progress-text">${userTaskProgress?.progress || 0} / ${task.requirement} Clicks</p>
        `;
    }

    return `
        <div class="achievement-card ${isCompleted ? 'unlocked' : ''}">
            <div class="achievement-icon">✔️</div>
            <div class="achievement-content">
                <h3>${task.name}</h3>
                <p>${task.description}</p>
                <p>Reward: ${formatCoins(task.reward)} Coins</p>
                ${progressHTML}
            </div>
            ${canClaim ? `<button class="action-button claim-button" onclick="claimTaskReward(${task.id})">Claim</button>` : ''}
            ${isClaimed ? `<button class="action-button" disabled>Claimed</button>` : ''}
        </div>
    `;
}



async function loadTasks() {
    const activeContainer = document.getElementById('active-tasks-list');
    const completedContainer = document.getElementById('completed-tasks-list');
    const allContainer = document.getElementById('all-tasks-list');

    activeContainer.innerHTML = '<div class="loading-state">Loading...</div>';
    completedContainer.innerHTML = '<div class="loading-state">Loading...</div>';
    allContainer.innerHTML = '<div class="loading-state">Loading...</div>';

    try {
        
        const [gameDataRes, userTasksRes] = await Promise.all([
            apiRequest('/game-data'),
            apiRequest('/user-tasks')
        ]);

        const allTasks = gameDataRes.tasks || [];

        activeContainer.innerHTML = '';
        completedContainer.innerHTML = '';
        allContainer.innerHTML = '';

        allTasks.forEach(task => {
            const userProgressForTask = userTasksRes.find(t => t.task_id === task.id);
            const isClaimed = userProgress.claimed_task_ids.includes(task.id);
            const isCompleted = userProgressForTask?.is_completed || false;

            const taskHTML = renderTask(task, userProgressForTask, isClaimed);

            allContainer.innerHTML += taskHTML;
            if (isCompleted) {
                completedContainer.innerHTML += taskHTML;
            } else {
                activeContainer.innerHTML += taskHTML;
            }
        });

        if (activeContainer.innerHTML === '') activeContainer.innerHTML = '<div class="empty-state">No active tasks remaining!</div>';
        if (completedContainer.innerHTML === '') completedContainer.innerHTML = '<div class="empty-state">No achievements unlocked yet.</div>';
        if (allContainer.innerHTML === '') allContainer.innerHTML = '<div class="empty-state">No tasks are available at this time.</div>';

    } catch (e) {
        const errorHTML = '<div class="error-state">Failed to load tasks</div>';
        activeContainer.innerHTML = errorHTML;
        completedContainer.innerHTML = errorHTML;
        allContainer.innerHTML = errorHTML;
    }
}

async function loadAchievements() {
    const tasksContainer = document.querySelector('.tasks-list');
    const achievementsContainer = document.querySelector('.achievements-list');
    tasksContainer.innerHTML = '<div class="loading-state">Loading...</div>';
    achievementsContainer.innerHTML = '<div class="loading-state">Loading...</div>';

    try {
        const [gameDataRes, userTasksRes] = await Promise.all([
            apiRequest('/game-data'),
            apiRequest('/user-tasks')
        ]);
        gameData.tasks = gameDataRes.tasks || [];
        const completedTaskIds = userTasksRes.filter(t => t.is_completed).map(t => t.task_id);


        tasksContainer.innerHTML = '';
        const activeTasks = gameData.tasks.filter(task => !completedTaskIds.includes(task.id));
        if (activeTasks.length === 0) {
            tasksContainer.innerHTML = '<div class="empty-state">All tasks completed!</div>';
        } else {
            activeTasks.forEach(task => {  });
        }

        achievementsContainer.innerHTML = '';
        const completedTasks = gameData.tasks.filter(task => completedTaskIds.includes(task.id));
        if (completedTasks.length === 0) {
            achievementsContainer.innerHTML = '<div class="empty-state">No achievements yet!</div>';
        } else {
            completedTasks.forEach(task => {  });
        }
    } catch (e) {
        tasksContainer.innerHTML = '<div class="error-state">Failed to load tasks</div>';
        achievementsContainer.innerHTML = '<div class="error-state">Failed to load achievements</div>';
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
    }, 4000)
}

function showFloatingCoin(x, y, amount) {
    const coin = document.createElement('div');
    coin.className = 'floating-coin';
    coin.textContent = amount;
    
    coin.style.left = `${x}px`;
    coin.style.top = `${y}px`;
    document.body.appendChild(coin);

    
    setTimeout(() => {
        if (coin) {
            coin.remove();
        }
    }, 1000); 
}
function animationLoop() {
    requestAnimationFrame(animationLoop);
}


async function init() {
    const loadingOverlay = document.getElementById('loading-overlay');
    try {
        loadPendingClicks();

        const [userDataRes, gameDataRes, progressRes, claimedTasksRes] = await Promise.all([
            apiRequest('/user'),
            apiRequest('/game-data'),
            apiRequest('/user-progress'),
            apiRequest('/tasks/claimed')
        ]);
        userData = userDataRes.user;
        gameData = gameDataRes;
        userProgress = progressRes;
        userProgress.claimed_task_ids = claimedTasksRes.map(t => t.task_id);
        updateUI();

        const equippedImage = gameData.images.find(img => img.id === userData.equipped_image_id);
        if (equippedImage) {
            characterBackgroundEl.style.backgroundImage = `url('${equippedImage.image_url}')`;
        }

        startPassiveIncome();
        loadingOverlay.classList.add('hidden');

    } catch (e) {
        console.error("Initialization failed:", e);
        document.getElementById('loading-text').innerHTML = `
            Connection Error<br/>
            <small>${e.message || 'Please try again'}</small>
            <br/>
            <button class="action-button" onclick="location.reload()" style="margin-top:1rem;">
                Retry
            </button>
        `;
    }
}

function savePendingClicks() {
    if (clickBuffer > 0) {
        localStorage.setItem('pendingClicks', clickBuffer.toString());
    }
}


function loadPendingClicks() {
    const pending = localStorage.getItem('pendingClicks');
    if (pending) {
        clickBuffer = parseInt(pending, 10) || 0;
        localStorage.removeItem('pendingClicks'); 
        if (clickBuffer > 0) {
            console.log(`Loaded ${clickBuffer} pending clicks from previous session.`);
            syncClicks();
        }
    }
}
function openUpgradeTab(event, tabName) {
    const page = event.currentTarget.closest('.page');

    page.querySelectorAll('.upgrade-tab-content').forEach(content => content.classList.remove('active'));
    page.querySelectorAll('.upgrade-tab-link').forEach(link => link.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

function openSubTab(event, tabName) {
    const page = event.currentTarget.closest('.page');

    page.querySelectorAll('.sub-tab-content').forEach(content => content.classList.remove('active'));
    page.querySelectorAll('.sub-tab-link').forEach(link => link.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

function openTopTab(event, sortBy) {
    const page = event.currentTarget.closest('.page');

    page.querySelectorAll('.top-tab-link').forEach(link => link.classList.remove('active'));

    event.currentTarget.classList.add('active');
    loadTopPlayers(sortBy);
}

function startPassiveIncome() {
    clearInterval(activeIncomeInterval);

    if (userData && userData.coins_per_sec > 0) {
        activeIncomeInterval = setInterval(() => {
            userData.coins += (userData.coins_per_sec / 10);
            updateUI();
        }, 100);
    }
}

function setupEventListeners() {
    for (const key in navButtons) {
        navButtons[key].onclick = () => showPage(key);
    }

    clickImage.onclick = handleUserClick;

    document.getElementById('transferBtn').onclick = handleTransfer;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            if (clickBuffer > 0) {
                syncClicks(true);
            }
        }
    });


    setInterval(() => {
        const now = Date.now();
        while (clickTimestamps.length > 0 && clickTimestamps[0] < now - 1000) {
            clickTimestamps.shift();
        }
        if (cpsDisplay) {
            cpsDisplay.textContent = `${clickTimestamps.length} Clicks/Sec`;
        }
    }, 1000);
}


document.addEventListener('DOMContentLoaded', () => {
    tg.ready();
    generateUpgradeHTML();
    setupEventListeners(); 
    init();
    showPage('main');
});