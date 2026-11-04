// Socket.io connection
let socket = null;
let sessionToken = null;
let currentUsername = null;
let currentRoomId = null;
let currentDuelId = null;
let currentCoins = 0;
let ownedSkins = ['balanced']; // Everyone starts with balanced

// Initialize multiplayer connection
function initMultiplayer() {
    if (socket) return;

    socket = io();

    // Connection events
    socket.on('connect', () => {
        console.log('Connected to server');

        // Try to validate existing session
        const storedToken = localStorage.getItem('sessionToken');
        if (storedToken) {
            validateSession(storedToken);
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    // Auth events
    socket.on('auth:validated', (data) => {
        if (data.success) {
            sessionToken = localStorage.getItem('sessionToken');
            currentUsername = data.username;
            currentCoins = data.coins || 0;
            console.log('Session validated:', currentUsername);
            updateCoinsDisplay();
            loadUserSkins();
        } else {
            // Clear invalid session
            localStorage.removeItem('sessionToken');
            sessionToken = null;
            currentUsername = null;
        }
    });

    // Coin events
    socket.on('coins:awarded', (data) => {
        currentCoins = data.newTotal;
        updateCoinsDisplay();
        showMessage(`You won! +${data.amount} coins (Total: ${data.newTotal})`, 'success');
    });

    // ELO events
    socket.on('elo:updated', (data) => {
        const changeText = data.eloChange >= 0 ? `+${data.eloChange}` : `${data.eloChange}`;
        showMessage(`ELO: ${changeText} (New: ${data.newElo}) | Rank: ${data.rank}`, 'success');
        loadUserRank(); // Refresh user rank display
    });

    // Lobby events
    socket.on('lobby:users', (data) => {
        updateUserList(data.users);
    });

    socket.on('lobby:user_online', (data) => {
        console.log('User joined:', data.username);
        // Refresh user list
        if (isLobbyOpen()) {
            socket.emit('lobby:search', { query: getSearchQuery() });
        }
    });

    socket.on('lobby:user_offline', (data) => {
        console.log('User left:', data.username);
        // Refresh user list
        if (isLobbyOpen()) {
            socket.emit('lobby:search', { query: getSearchQuery() });
        }
    });

    // Duel events
    socket.on('duel:incoming', (data) => {
        showDuelNotification(data.fromUsername, data.duelId);
    });

    socket.on('duel:sent', (data) => {
        showMessage('Duel request sent!', 'success');
    });

    socket.on('duel:declined', (data) => {
        showMessage(`${data.username} declined your duel request`, 'error');
    });

    socket.on('duel:error', (data) => {
        showMessage(data.error, 'error');
    });

    socket.on('lobby:error', (data) => {
        showMessage(data.error, 'error');
    });

    // Game events
    socket.on('game:start', (data) => {
        currentRoomId = data.roomId;
        startMultiplayerGame(data.localPlayer, data.opponentUsername, data.player1Character, data.player2Character);
    });

    socket.on('game:state', (serverState) => {
        if (typeof updateGameStateFromServer === 'function') {
            updateGameStateFromServer(serverState);
        }
    });

    socket.on('game:end', (data) => {
        endGame(data.winner);
    });

    socket.on('game:opponent_disconnected', () => {
        showMessage('Opponent disconnected. You win!', 'success');
        setTimeout(() => {
            returnToLobby();
        }, 2000);
    });
}

// Authentication functions
async function register(username, password) {
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            sessionToken = data.sessionToken;
            currentUsername = data.username;
            currentCoins = data.coins || 0;
            localStorage.setItem('sessionToken', sessionToken);

            // Initialize socket connection
            initMultiplayer();

            // Validate session with socket
            setTimeout(() => {
                socket.emit('auth:validate', { sessionToken });
                loadUserSkins();
            }, 100);

            updateCoinsDisplay();
            return { success: true, username: data.username };
        } else {
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: 'Network error' };
    }
}

async function login(username, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            sessionToken = data.sessionToken;
            currentUsername = data.username;
            currentCoins = data.coins || 0;
            localStorage.setItem('sessionToken', sessionToken);

            // Initialize socket connection
            initMultiplayer();

            // Validate session with socket
            setTimeout(() => {
                socket.emit('auth:validate', { sessionToken });
                loadUserSkins();
            }, 100);

            updateCoinsDisplay();
            return { success: true, username: data.username };
        } else {
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Network error' };
    }
}

function validateSession(token) {
    if (socket && socket.connected) {
        socket.emit('auth:validate', { sessionToken: token });
    }
}

// Bot battle win function
async function awardBotWin() {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
        console.log('No session token for bot win award');
        return { success: false };
    }

    try {
        const response = await fetch('/api/bot/win', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            currentCoins = data.newTotal;
            updateCoinsDisplay();

            // Show coin notification
            showMessage(`You won! +${data.amount} coins (Total: ${data.newTotal})`, 'success');
            console.log(`Bot win: Awarded ${data.amount} coins. New total: ${data.newTotal}`);

            return { success: true, amount: data.amount, newTotal: data.newTotal };
        } else {
            console.error('Bot win award failed:', data.error);
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Bot win award error:', error);
        return { success: false, error: 'Network error' };
    }
}

function logout() {
    localStorage.removeItem('sessionToken');
    sessionToken = null;
    currentUsername = null;

    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// Lobby functions
function joinLobby() {
    if (!socket || !sessionToken) {
        showMessage('Please login first', 'error');
        return;
    }

    socket.emit('lobby:join');
}

function searchUsers(query) {
    if (!socket) return;
    socket.emit('lobby:search', { query });
}

function sendDuelRequest(targetUsername) {
    if (!socket) return;

    // Show character selection before sending request
    showCharacterSelect('multiplayer', (selectedClass) => {
        socket.emit('duel:request', { targetUsername, characterClass: selectedClass });
        showMessage('Duel request sent!', 'success');
    });
}

function acceptDuel(duelId) {
    if (!socket) return;
    hideDuelNotification();

    // Show character selection for multiplayer
    showCharacterSelect('multiplayer', (selectedClass) => {
        // Send duel acceptance with character selection
        socket.emit('duel:accept', { duelId, characterClass: selectedClass });
    });
}

function declineDuel(duelId) {
    if (!socket) return;
    socket.emit('duel:decline', { duelId });
    hideDuelNotification();
}

// Game functions
function sendGameInput(key, action) {
    if (!socket || !currentRoomId) return;
    socket.emit('game:input', { key, action });
}

function notifyGameEnded() {
    if (!socket) return;
    socket.emit('game:ended');
}

function startMultiplayerGame(localPlayer, opponentUsername, player1Character, player2Character) {
    // Hide lobby
    hideLobby();
    hideEscMenu();

    // Set character selections
    characterSelection.player1 = player1Character || 'balanced';
    characterSelection.player2 = player2Character || 'balanced';

    // Set game mode
    const player1Username = localPlayer === 'red' ? currentUsername : opponentUsername;
    const player2Username = localPlayer === 'blue' ? currentUsername : opponentUsername;

    setGameMode('multiplayer', localPlayer, player1Username, player2Username);

    // Reset game state (which will apply character stats)
    resetGame();
}

function returnToLobby() {
    currentRoomId = null;

    // Reset to local mode
    setGameMode('local', null, 'RED', 'BLUE');
    resetGame();

    // Show lobby
    showLobby();
}

// UI Helper functions
function updateUserList(users) {
    const userListDiv = document.getElementById('userList');
    if (!userListDiv) return;

    userListDiv.innerHTML = '';

    if (users.length === 0) {
        userListDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">No users online</div>';
        return;
    }

    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'userItem';

        const userInfo = document.createElement('div');
        const username = document.createElement('span');
        username.className = 'username';
        username.textContent = user.username;

        const status = document.createElement('span');
        status.className = 'status';
        status.textContent = user.status === 'available' ? 'Available' : 'Busy';

        userInfo.appendChild(username);
        userInfo.appendChild(document.createElement('br'));
        userInfo.appendChild(status);

        const challengeBtn = document.createElement('button');
        challengeBtn.textContent = 'Challenge';
        challengeBtn.disabled = user.status !== 'available';
        challengeBtn.onclick = () => sendDuelRequest(user.username);

        userItem.appendChild(userInfo);
        userItem.appendChild(challengeBtn);
        userListDiv.appendChild(userItem);
    });
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('lobbyMessage');
    if (!messageDiv) return;

    messageDiv.textContent = message;
    messageDiv.className = type === 'error' ? 'errorMessage' : 'successMessage';

    // Clear after 3 seconds
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = '';
    }, 3000);
}

function showDuelNotification(fromUsername, duelId) {
    currentDuelId = duelId;

    const notification = document.getElementById('duelNotification');
    const duelFromUser = document.getElementById('duelFromUser');

    duelFromUser.textContent = fromUsername;
    notification.classList.add('active');
}

function hideDuelNotification() {
    const notification = document.getElementById('duelNotification');
    notification.classList.remove('active');
    currentDuelId = null;
}

function isLobbyOpen() {
    const lobbyModal = document.getElementById('lobbyModal');
    return lobbyModal && lobbyModal.classList.contains('active');
}

function getSearchQuery() {
    const searchInput = document.getElementById('searchInput');
    return searchInput ? searchInput.value : '';
}

function showLobby() {
    const lobbyModal = document.getElementById('lobbyModal');
    if (lobbyModal) {
        lobbyModal.classList.add('active');
        joinLobby();
        loadUserRank(); // Load and display user's rank info
    }
}

function hideLobby() {
    const lobbyModal = document.getElementById('lobbyModal');
    if (lobbyModal) {
        lobbyModal.classList.remove('active');
    }
}

function hideEscMenu() {
    const escMenu = document.getElementById('escMenu');
    if (escMenu) {
        escMenu.classList.remove('active');
    }
}

// Coins and Shop functions
function updateCoinsDisplay() {
    const lobbyCoins = document.getElementById('lobbyCoins');
    const shopCoins = document.getElementById('shopCoins');

    if (lobbyCoins) lobbyCoins.textContent = currentCoins;
    if (shopCoins) shopCoins.textContent = currentCoins;
}

async function loadUserSkins() {
    if (!sessionToken) return;

    try {
        const response = await fetch('/api/user/skins', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });

        const data = await response.json();

        if (data.success) {
            ownedSkins = data.skins;
            currentCoins = data.coins;
            updateCoinsDisplay();
        }
    } catch (error) {
        console.error('Failed to load user skins:', error);
    }
}

async function openShop() {
    if (!sessionToken) {
        showMessage('Please login first', 'error');
        return;
    }

    try {
        const response = await fetch('/api/shop/skins', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Cache-Control': 'no-cache'
            },
            cache: 'no-store'
        });

        const data = await response.json();

        if (data.success) {
            console.log(`[Shop Client] Received ${data.userCoins} coins from server`);
            currentCoins = data.userCoins;
            updateCoinsDisplay();
            displayShopItems(data.skins);

            document.getElementById('shopModal').classList.add('active');
        } else {
            showMessage('Failed to load shop', 'error');
        }
    } catch (error) {
        console.error('Failed to load shop:', error);
        showMessage('Failed to load shop', 'error');
    }
}

function displayShopItems(skins) {
    const shopGrid = document.getElementById('shopGrid');
    shopGrid.innerHTML = '';

    console.log(`[Shop Client] Displaying ${skins.length} skins:`, skins.map(s => s.name).join(', '));

    skins.forEach(skin => {
        const card = document.createElement('div');
        card.className = 'characterCard shopCard';
        if (skin.owned) card.classList.add('owned');

        const preview = document.createElement('div');
        preview.className = `characterPreview ${skin.name}`;
        preview.style.background = skin.colors.primary;

        const title = document.createElement('h3');
        title.textContent = skin.displayName.toUpperCase();

        const desc = document.createElement('p');
        desc.className = 'characterDesc';
        desc.textContent = skin.description;

        const priceDiv = document.createElement('div');
        priceDiv.className = 'skinPrice';

        if (skin.owned) {
            priceDiv.textContent = 'OWNED';
            priceDiv.style.color = '#4caf50';
        } else {
            priceDiv.innerHTML = `<span style="color: gold;">${skin.price}</span> coins`;
        }

        const buyBtn = document.createElement('button');
        if (skin.owned) {
            buyBtn.textContent = 'OWNED';
            buyBtn.disabled = true;
            buyBtn.style.background = '#4caf50';
        } else {
            buyBtn.textContent = 'BUY';
            buyBtn.onclick = () => purchaseSkin(skin.name, skin.price);

            if (currentCoins < skin.price) {
                buyBtn.disabled = true;
                buyBtn.style.opacity = '0.5';
            }
        }

        card.appendChild(preview);
        card.appendChild(title);
        card.appendChild(desc);
        card.appendChild(priceDiv);
        card.appendChild(buyBtn);
        shopGrid.appendChild(card);
    });
}

async function purchaseSkin(skinName, price) {
    if (!sessionToken) return;

    if (currentCoins < price) {
        showShopMessage('Not enough coins!', 'error');
        return;
    }

    try {
        const response = await fetch('/api/shop/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ skinName })
        });

        const data = await response.json();

        if (data.success) {
            currentCoins = data.newCoins;
            ownedSkins.push(skinName);
            updateCoinsDisplay();
            showShopMessage('Skin purchased successfully!', 'success');

            // Reload shop to update display
            setTimeout(() => openShop(), 1000);
        } else {
            showShopMessage(data.error || 'Purchase failed', 'error');
        }
    } catch (error) {
        console.error('Purchase failed:', error);
        showShopMessage('Purchase failed', 'error');
    }
}

function closeShop() {
    document.getElementById('shopModal').classList.remove('active');
}

function showShopMessage(message, type) {
    const messageDiv = document.getElementById('shopMessage');
    if (!messageDiv) return;

    messageDiv.textContent = message;
    messageDiv.className = type === 'error' ? 'errorMessage' : 'successMessage';

    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = '';
    }, 3000);
}

// Load and display user rank
async function loadUserRank() {
    if (!sessionToken) return;

    try {
        const response = await fetch('/api/user/rank', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        const data = await response.json();

        if (data.success) {
            const rankInfo = data.rank;
            document.getElementById('lobbyRank').textContent = rankInfo.rank;
            document.getElementById('lobbyElo').textContent = rankInfo.elo;
        }
    } catch (error) {
        console.error('Error loading user rank:', error);
    }
}

// Load and display leaderboard
async function loadLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard?limit=50');
        const data = await response.json();

        if (data.success) {
            displayLeaderboard(data.leaderboard);
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

// Display leaderboard in modal
function displayLeaderboard(leaderboard) {
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '';

    leaderboard.forEach((player, index) => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #555';
        row.style.backgroundColor = index % 2 === 0 ? '#222' : '#2a2a2a';

        const wl = `${player.wins}/${player.losses}`;
        const rankColor = getRankColor(player.rank);

        row.innerHTML = `
            <td style="padding: 10px; border: 1px solid #555;">${index + 1}</td>
            <td style="padding: 10px; border: 1px solid #555;">${player.username}</td>
            <td style="padding: 10px; border: 1px solid #555;">${player.elo}</td>
            <td style="padding: 10px; border: 1px solid #555; color: ${rankColor};">${player.rank}</td>
            <td style="padding: 10px; border: 1px solid #555;">${wl}</td>
            <td style="padding: 10px; border: 1px solid #555;">${player.peak_elo}</td>
        `;
        tbody.appendChild(row);
    });
}

// Get color for rank display
function getRankColor(rank) {
    const colors = {
        'Diamond': '#00ffff',
        'Platinum': '#e6e600',
        'Gold': '#ffa500',
        'Silver': '#c0c0c0',
        'Bronze': '#cd7f32',
        'Unranked': '#888888'
    };
    return colors[rank] || '#ffffff';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initMultiplayer();

    // Set up leaderboard button
    const leaderboardBtn = document.getElementById('leaderboardBtn');
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', () => {
            document.getElementById('lobbyModal').style.display = 'none';
            document.getElementById('leaderboardModal').style.display = 'flex';
            loadLeaderboard();
        });
    }

    // Set up close leaderboard button
    const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
    if (closeLeaderboardBtn) {
        closeLeaderboardBtn.addEventListener('click', () => {
            document.getElementById('leaderboardModal').style.display = 'none';
            document.getElementById('lobbyModal').style.display = 'flex';
        });
    }
});
