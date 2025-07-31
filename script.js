const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = 'https://clicker-backend-chjq.onrender.com';

let userData = null;
let gameData = { images: [], tasks: [] };
let userProgress = { unlocked_image_ids: [] };
let transactionHistory = [];
let clickEffects = [];
let lastClickTime = 0;


const coinsEl = document.getElementById('coins');
const coinsPerSecEl = document.getElementById('coinsPerSec');
const coinsPerClickEl = document.getElementById('coinsPerClick');
const clickImage = document.getElementById('clickImage');
const offlineRateEl = document.getElementById('offlineRate');
const notificationContainer = document.getElementById('notificationContainer');



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
        case 'tasks': loadAchievements(); break;
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
        return await response.json();
    } catch (error) {
        console.error(`API request to ${endpoint} failed:`, error);
        showNotification(error.message, 'error');
        throw error;
    }
}

function formatCoins(amount) {
    if (typeof amount !== 'number') return '0.000000000';
    return amount.toFixed(9);
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
    if (offlineRateEl) offlineRateEl.textContent = formatCoins(userData.offline_coins_per_hour) + ' / hr';
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


clickImage.onclick = (event) => {
    if (!userData) return;

    const now = Date.now();
    if (now - lastClickTime < 100) return; 
    lastClickTime = now;

    tg.HapticFeedback.impactOccurred('light');
    userData.coins += userData.coins_per_click;
    updateUI();


    const clickX = event.clientX;
    const clickY = event.clientY;

    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const offsetX = (Math.random() * 40) - 20;
            const offsetY = (Math.random() * 40) - 20;
            showFloatingCoin(clickX + offsetX, clickY + offsetY, `+${formatCoins(userData.coins_per_click / 3)}`);
        }, i * 100);
    }


    clickImage.style.transform = 'scale(0.95)';
    setTimeout(() => {
        clickImage.style.transform = 'scale(1)';
    }, 100);

    clearTimeout(window.clickDebounce);
    window.clickDebounce = setTimeout(() => {
        apiRequest('/click', 'POST').catch(err => console.error("Click sync failed:", err));
    }, 500);
};

async function purchaseUpgrade(upgradeId) {
    try {
        const updatedUser = await apiRequest('/upgrade', 'POST', { upgradeId });
        userData = updatedUser;
        updateUI();
        showNotification('Upgrade successful!', 'success');
        tg.HapticFeedback.notificationOccurred('success');


        const upgradeEl = document.getElementById(upgradeId);
        if (upgradeEl) {
            upgradeEl.style.transform = 'translateY(-5px)';
            upgradeEl.style.boxShadow = '0 10px 20px rgba(138, 99, 242, 0.3)';
            setTimeout(() => {
                upgradeEl.style.transform = '';
                upgradeEl.style.boxShadow = '';
            }, 300);
        }
    } catch (e) {
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

        loadHistory();

        const transferBtn = document.getElementById('transferBtn');
        transferBtn.style.transform = 'translateY(-3px)';
        transferBtn.style.boxShadow = '0 5px 15px rgba(138, 99, 242, 0.4)';
        setTimeout(() => {
            transferBtn.style.transform = '';
            transferBtn.style.boxShadow = '';
        }, 300);
    } catch (e) {
        transferMessageEl.textContent = e.message;
        transferMessageEl.className = 'transfer-message error';
        tg.HapticFeedback.notificationOccurred('error');
    }
}


async function loadTopPlayers(sortBy = 'coins') {
    try {
        const topListEl = document.getElementById('topList');
        topListEl.innerHTML = '<li class="loading-state">Loading leaderboard...</li>';
        const players = await apiRequest(`/top?sortBy=${sortBy}`);

        if (players.length === 0) {
            topListEl.innerHTML = '<li class="empty-state">No players found</li>';
            return;
        }

        topListEl.innerHTML = '';
        players.forEach((player, idx) => {
            const medal = idx < 3 ? ['🥇', '🥈', '🥉'][idx] : '';
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="rank">${idx + 1}${medal}</span>
                <span class="name">@${player.username || 'anonymous'}</span>
                <span class="value">${formatCoins(player[sortBy])}</span>
            `;
            if (idx < 3) li.classList.add(`top-${idx + 1}`);
            topListEl.appendChild(li);
        });
    } catch (e) {
        topListEl.innerHTML = '<li class="error-state">Failed to load leaderboard</li>';
    }
}

async function loadImages(filter = 'all') {
    const container = document.getElementById('imagesContainer');
    container.innerHTML = '<div class="loading-state">Loading images...</div>';

    try {
        const { data: images } = await supabase.from('images').select('*');
        gameData.images = images || [];

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

async function loadAchievements() {
    const tasksContainer = document.querySelector('.tasks-list');
    const achievementsContainer = document.querySelector('.achievements-list');

    tasksContainer.innerHTML = '<div class="loading-state">Loading tasks...</div>';
    achievementsContainer.innerHTML = '<div class="loading-state">Loading achievements...</div>';

    try {
        const [tasksRes, userTasksRes] = await Promise.all([
            apiRequest('/game-data'),
            apiRequest('/user-tasks')
        ]);

        gameData.tasks = tasksRes.tasks || [];
        userProgress.completed_task_ids = userTasksRes.filter(t => t.is_completed).map(t => t.task_id);


        tasksContainer.innerHTML = '';
        const activeTasks = gameData.tasks.filter(task => !userProgress.completed_task_ids.includes(task.id));

        if (activeTasks.length === 0) {
            tasksContainer.innerHTML = '<div class="empty-state">No active tasks!</div>';
        } else {
            activeTasks.forEach(task => {
                const card = document.createElement('div');
                card.className = 'achievement-card';
                card.innerHTML = `
                    <div class="achievement-icon">🎯</div>
                    <div class="achievement-content">
                        <h3>${task.name}</h3>
                        <p>${task.description}</p>
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${task.progress || 0}%"></div>
                        </div>
                    </div>
                `;
                tasksContainer.appendChild(card);
            });
        }


        achievementsContainer.innerHTML = '';
        const completedTasks = gameData.tasks.filter(task => userProgress.completed_task_ids.includes(task.id));

        if (completedTasks.length === 0) {
            achievementsContainer.innerHTML = '<div class="empty-state">No achievements yet!</div>';
        } else {
            completedTasks.forEach(task => {
                const card = document.createElement('div');
                card.className = 'achievement-card unlocked';
                card.innerHTML = `
                    <div class="achievement-icon">🏆</div>
                    <div class="achievement-content">
                        <h3>${task.name}</h3>
                        <p>${task.description}</p>
                        <p class="completed-text">Completed!</p>
                    </div>
                `;
                achievementsContainer.appendChild(card);
            });
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
    }, 3000);
}

function showFloatingCoin(x, y, amount) {
    const coin = document.createElement('div');
    coin.className = 'floating-coin';
    coin.textContent = amount;
    coin.style.left = `${x}px`;
    coin.style.top = `${y}px`;


    const animationDuration = 1000 + Math.random() * 500;
    const endX = (Math.random() * 100) - 50;
    const endY = -50 - (Math.random() * 50);

    coin.style.setProperty('--end-x', `${endX}px`);
    coin.style.setProperty('--end-y', `${endY}px`);
    coin.style.setProperty('--duration', `${animationDuration}ms`);

    document.body.appendChild(coin);

    setTimeout(() => {
        coin.style.opacity = '1';
        coin.style.transform = `translate(var(--end-x), var(--end-y))`;
    }, 10);

    setTimeout(() => coin.remove(), animationDuration);
}


function animationLoop() {
    requestAnimationFrame(animationLoop);
}


async function init() {
    const loadingOverlay = document.getElementById('loading-overlay');
    generateUpgradeHTML();

    try {
        const [userDataResponse, gameDataResponse, userProgressResponse] = await Promise.all([
            apiRequest('/user'),
            apiRequest('/game-data'),
            apiRequest('/user-progress')
        ]);

        userData = userDataResponse.user;
        gameData = gameDataResponse;
        userProgress = userProgressResponse;

        const earnings = userDataResponse.earnings;
        if (earnings && earnings.earned_passive > 0) {
            showNotification(`Welcome back! You earned ${formatCoins(earnings.earned_passive)} while offline.`, 'success');
        }

        updateUI();

        const equippedImage = gameData.images.find(img => img.id === userData.equipped_image_id);
        if (equippedImage) {
            clickImage.style.backgroundImage = `url('${equippedImage.image_url}')`;
        }

        startPassiveIncome();

        animationLoop();

        setTimeout(() => {
            loadingOverlay.classList.remove('active');
        }, 500);

    } catch (e) {
        document.getElementById('loading-text').innerHTML = `
            Connection Error<br/>
            <small>Please try again later</small>
        `;
        console.error("Initialization failed:", e);
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
    setInterval(() => {
        if (userData && userData.coins_per_sec > 0) {
            userData.coins += userData.coins_per_sec;
            updateUI();
        }
    }, 1000);
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