const tg = window.Telegram.WebApp;
tg.expand();


const supabaseUrl = 'https://nwqtmkimhwscopczrjtq.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cXRta2ltaHdzY29wY3pyanRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTEzNjgsImV4cCI6MjA2NzEyNzM2OH0.o5lvZYZ6vfn7bhgSZw4z29pFG5Y7uphLP1trW2sG2KM'; // Replace with your anon/public key
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

const coinsEl = document.getElementById('coins');
const coinsPerSecEl = document.getElementById('coinsPerSec');
const coinsPerClickEl = document.getElementById('coinsPerClick');
const clickBtn = document.getElementById('clickBtn');
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


const navMainBtn = document.getElementById('nav-main');
const navTopBtn = document.getElementById('nav-top');
const navUpgradeBtn = document.getElementById('nav-upgrade');
const navImagesBtn = document.getElementById('nav-images');
const navAchievementsBtn = document.getElementById('nav-achievements');


const mainPage = document.getElementById('main');
const topPage = document.getElementById('top');
const upgradePage = document.getElementById('upgrade');
const imagesPage = document.getElementById('images');
const achievementsPage = document.getElementById('achievements');
const transferPage = document.getElementById('transfer');


const topListEl = document.getElementById('topList');
const imagesContainer = document.getElementById('imagesContainer');
const achievementsContainer = document.getElementById('achievementsContainer');
const notificationContainer = document.getElementById('notificationContainer');

let userData = null;
let updateInterval = null;


function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationContainer.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}


function showPage(pageId) {
    const pages = [mainPage, topPage, upgradePage, imagesPage, achievementsPage, transferPage];
    const navButtons = [navMainBtn, navTopBtn, navUpgradeBtn, navImagesBtn, navAchievementsBtn];

    pages.forEach(p => p.classList.remove('active'));
    navButtons.forEach(b => b.classList.remove('active'));

    switch (pageId) {
        case 'main':
            mainPage.classList.add('active');
            navMainBtn.classList.add('active');
            break;
        case 'top':
            topPage.classList.add('active');
            navTopBtn.classList.add('active');
            loadTopPlayers();
            break;
        case 'upgrade':
            upgradePage.classList.add('active');
            navUpgradeBtn.classList.add('active');
            break;
        case 'images':
            imagesPage.classList.add('active');
            navImagesBtn.classList.add('active');
            loadImages();
            break;
        case 'achievements':
            achievementsPage.classList.add('active');
            navAchievementsBtn.classList.add('active');
            loadAchievements();
            break;
        case 'transfer':
            transferPage.classList.add('active');
            break;
    }
}


navMainBtn.onclick = () => showPage('main');
navTopBtn.onclick = () => showPage('top');
navUpgradeBtn.onclick = () => showPage('upgrade');
navImagesBtn.onclick = () => showPage('images');
navAchievementsBtn.onclick = () => showPage('achievements');

async function loadUserData() {
    try {
        const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'telegram',
            token: tg.initData,
            access_token: tg.initData
        });

        if (error) throw error;

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', data.user.id)
            .single();

        if (userError) throw userError;

        userData = user;
        updateUI();

        checkAchievements();

    } catch (e) {
        console.error('Failed to load user data:', e);
        showNotification('Failed to load data. Please try again.', 'error');
    }
}


function updateUI() {
    if (!userData) return;

    coinsEl.textContent = userData.coins.toLocaleString();
    coinsPerSecEl.textContent = userData.coins_per_sec.toLocaleString();
    coinsPerClickEl.textContent = userData.coins_per_click.toLocaleString();

    upgradeClickLevelEl.textContent = userData.click_upgrade_level;
    upgradeClickCostEl.textContent = userData.click_upgrade_cost.toLocaleString();
    upgradeAutoLevelEl.textContent = userData.auto_upgrade_level;
    upgradeAutoCostEl.textContent = userData.auto_upgrade_cost.toLocaleString();


    clickImage.className = `click-image ${userData.current_image}`;
}


clickImage.onclick = async () => {
    try {
       
        const clickEffect = document.querySelector('.click-effect');
        clickEffect.style.display = 'block';
        clickEffect.style.left = `${event.clientX - clickImage.getBoundingClientRect().left - 25}px`;
        clickEffect.style.top = `${event.clientY - clickImage.getBoundingClientRect().top - 25}px`;

        setTimeout(() => {
            clickEffect.style.display = 'none';
        }, 500);

        const { data, error } = await supabase
            .rpc('increment_coins', {
                user_id: userData.id,
                amount: userData.coins_per_click
            });

        if (error) throw error;

        userData = data;
        updateUI();

        showFloatingCoin(event.clientX, event.clientY, `+${userData.coins_per_click}`);

    } catch (e) {
        console.error('Click failed:', e);
        showNotification('Click failed. Try again.', 'error');
    }
};

function showFloatingCoin(x, y, amount) {
    const coin = document.createElement('div');
    coin.className = 'floating-coin';
    coin.textContent = amount;
    coin.style.left = `${x - 20}px`;
    coin.style.top = `${y - 20}px`;
    document.body.appendChild(coin);

    setTimeout(() => {
        coin.style.transform = 'translateY(-30px)';
        coin.style.opacity = '0';
    }, 10);

    setTimeout(() => {
        coin.remove();
    }, 1000);
}


upgradeClickBtn.onclick = async () => {
    try {
        const { data, error } = await supabase
            .rpc('upgrade_click', { user_id: userData.id });

        if (error) throw error;

        userData = data;
        updateUI();
        showNotification('Click power upgraded!', 'success');
    } catch (e) {
        console.error('Upgrade click failed:', e);
        showNotification(e.message || 'Upgrade failed. Try again.', 'error');
    }
};

upgradeAutoBtn.onclick = async () => {
    try {
        const { data, error } = await supabase
            .rpc('upgrade_auto', { user_id: userData.id });

        if (error) throw error;

        userData = data;
        updateUI();
        showNotification('Auto income upgraded!', 'success');
    } catch (e) {
        console.error('Upgrade auto failed:', e);
        showNotification(e.message || 'Upgrade failed. Try again.', 'error');
    }
};


transferBtn.onclick = async () => {
    const toUser = transferUsernameEl.value.trim().replace(/^@/, '');
    const amount = parseInt(transferAmountEl.value);

    if (!toUser || !amount || amount <= 0) {
        transferMessageEl.className = 'transfer-message error';
        transferMessageEl.textContent = 'Enter valid username and amount.';
        return;
    }

    try {
        const { data, error } = await supabase
            .rpc('transfer_coins', {
                from_user_id: userData.id,
                to_username: toUser,
                amount: amount
            });

        if (error) throw error;

        transferMessageEl.className = 'transfer-message success';
        transferMessageEl.textContent = `Sent ${amount} coins to @${toUser}`;
        userData.coins = data.coins;
        updateUI();
    } catch (e) {
        transferMessageEl.className = 'transfer-message error';
        transferMessageEl.textContent = e.message || 'Transfer failed. Try again later.';
        console.error('Transfer failed:', e);
    }
};

async function loadTopPlayers() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('username, coins')
            .order('coins', { ascending: false })
            .limit(10);

        if (error) throw error;

        topListEl.innerHTML = '';
        data.forEach((player, idx) => {
            const li = document.createElement('li');

            const rank = document.createElement('span');
            rank.className = 'rank';
            rank.textContent = `${idx + 1}.`;

            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = `@${player.username || 'anonymous'}`;

            const coins = document.createElement('span');
            coins.className = 'coins';
            coins.textContent = `${player.coins.toLocaleString()}`;

            li.appendChild(rank);
            li.appendChild(name);
            li.appendChild(coins);
            topListEl.appendChild(li);
        });
    } catch (e) {
        topListEl.innerHTML = '<li class="error">Failed to load top players</li>';
        console.error('Load top players failed:', e);
    }
}

async function loadImages() {
    try {
        const { data: images, error: imagesError } = await supabase
            .from('image_upgrades')
            .select('*');

        if (imagesError) throw imagesError;

        const { data: userImages, error: userError } = await supabase
            .from('user_images')
            .select('image_id')
            .eq('user_id', userData.id);

        if (userError) throw userError;

        imagesContainer.innerHTML = '';

        images.forEach(image => {
            const isUnlocked = userImages.some(ui => ui.image_id === image.id);
            const isSelected = userData.current_image === image.id;

            const imageCard = document.createElement('div');
            imageCard.className = `image-card ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'selected' : ''}`;

            const imagePreview = document.createElement('div');
            imagePreview.className = `image-preview ${image.id}`;

            const imageInfo = document.createElement('div');
            imageInfo.className = 'image-info';

            const imageName = document.createElement('h3');
            imageName.textContent = image.name;

            const imageBonus = document.createElement('p');
            imageBonus.className = 'bonus';
            imageBonus.textContent = `+${image.coins_per_click_bonus} coins/click`;

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
                cost.textContent = `${image.cost.toLocaleString()}`;

                const buyBtn = document.createElement('button');
                buyBtn.className = 'buy-btn';
                buyBtn.textContent = 'Buy';
                buyBtn.onclick = () => buyImage(image.id);

                imageStatus.appendChild(cost);
                imageStatus.appendChild(buyBtn);
            }

            imageInfo.appendChild(imageName);
            imageInfo.appendChild(imageBonus);
            imageInfo.appendChild(imageStatus);

            imageCard.appendChild(imagePreview);
            imageCard.appendChild(imageInfo);
            imagesContainer.appendChild(imageCard);
        });
    } catch (e) {
        console.error('Load images failed:', e);
        imagesContainer.innerHTML = '<div class="error">Failed to load images</div>';
    }
}


async function buyImage(imageId) {
    try {
        const { data, error } = await supabase
            .rpc('buy_image', {
                user_id: userData.id,
                image_id: imageId
            });

        if (error) throw error;

        userData = data;
        updateUI();
        loadImages();

        showNotification(`Image ${data.unlocked ? 'unlocked' : 'selected'}!`, 'success');
    } catch (e) {
        console.error('Buy image failed:', e);
        showNotification(e.message || 'Failed to buy image. Try again.', 'error');
    }
}


async function selectImage(imageId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .update({ current_image: imageId })
            .eq('id', userData.id)
            .select()
            .single();

        if (error) throw error;

        userData = data;
        updateUI();
        loadImages();
        showNotification('Image selected!', 'success');
    } catch (e) {
        console.error('Select image failed:', e);
        showNotification('Failed to select image. Try again.', 'error');
    }
}


async function loadAchievements() {
    try {
        const { data: achievements, error: achError } = await supabase
            .from('achievements')
            .select('*');

        if (achError) throw achError;

        const { data: userAchievements, error: userError } = await supabase
            .from('user_achievements')
            .select('achievement_id, unlocked_at')
            .eq('user_id', userData.id);

        if (userError) throw userError;

        achievementsContainer.innerHTML = '';

        achievements.forEach(ach => {
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

            if (userAch) {
                const achDate = document.createElement('p');
                achDate.className = 'date';
                achDate.textContent = new Date(userAch.unlocked_at).toLocaleDateString();
                achContent.appendChild(achDate);
            }

            achContent.appendChild(achTitle);
            achContent.appendChild(achDesc);
            achCard.appendChild(achIcon);
            achCard.appendChild(achContent);
            achievementsContainer.appendChild(achCard);
        });
    } catch (e) {
        console.error('Load achievements failed:', e);
        achievementsContainer.innerHTML = '<div class="error">Failed to load achievements</div>';
    }
}


async function checkAchievements() {
    try {
        const { data, error } = await supabase
            .rpc('check_achievements', { user_id: userData.id });

        if (error) throw error;

        if (data && data.length > 0) {
            data.forEach(ach => {
                showNotification(`Achievement Unlocked: ${ach.name}\n${ach.description}`, 'success');
            });
        }
    } catch (e) {
        console.error('Check achievements failed:', e);
    }
}


function startAutoIncome() {
    if (updateInterval) clearInterval(updateInterval);

    updateInterval = setInterval(async () => {
        try {
            const { data, error } = await supabase
                .rpc('auto_income', { user_id: userData.id });

            if (error) throw error;

            if (data && data.coins > userData.coins) {
                userData = data;
                updateUI();
            }
        } catch (e) {
            console.error('Auto income update failed:', e);
        }
    }, 1000);
}


async function init() {
    await loadUserData();
    startAutoIncome();
    showPage('main');
}

init();