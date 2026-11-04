const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const db = require('./database');
const auth = require('./auth');
const matchmaking = require('./matchmaking');
const GameRoom = require('./gameRoom');

// Initialize database
db.initializeDatabase();

// Create Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// REST API endpoints
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    const result = await auth.registerUser(username, password);

    if (result.success) {
        res.json({
            success: true,
            sessionToken: result.sessionToken,
            username: result.username,
            coins: 0,
            wins: 0,
            losses: 0
        });
    } else {
        res.status(400).json({ success: false, error: result.error });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const result = await auth.loginUser(username, password);

    if (result.success) {
        res.json({
            success: true,
            sessionToken: result.sessionToken,
            username: result.username,
            wins: result.wins,
            losses: result.losses,
            coins: result.coins
        });
    } else {
        res.status(400).json({ success: false, error: result.error });
    }
});

// Skin shop endpoints
app.get('/api/shop/skins', (req, res) => {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const validation = auth.validateSession(sessionToken);
    if (!validation.valid) {
        return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const constants = require('../shared/constants');
    const userSkins = db.getUserSkins(validation.userId);
    const userCoins = db.getUserCoins(validation.userId);
    console.log(`[Shop] User ${validation.username} opened shop with ${userCoins} coins`);

    // Use centralized skin prices from constants
    const skins = Object.keys(constants.CHARACTER_CLASSES).map(skinName => ({
        name: skinName,
        displayName: constants.CHARACTER_CLASSES[skinName].name,
        description: constants.CHARACTER_CLASSES[skinName].description,
        tier: constants.CHARACTER_CLASSES[skinName].tier,
        price: constants.SKIN_PRICES[skinName],
        owned: skinName === 'balanced' || userSkins.includes(skinName),
        colors: constants.CHARACTER_CLASSES[skinName].colors
    })); // Already in tier order from constants

    console.log(`[Shop] Sending ${skins.length} skins:`, skins.map(s => s.name).join(', '));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({
        success: true,
        skins,
        userCoins
    });
});

app.post('/api/shop/purchase', (req, res) => {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    const { skinName } = req.body;

    if (!sessionToken) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const validation = auth.validateSession(sessionToken);
    if (!validation.valid) {
        return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const constants = require('../shared/constants');

    if (!constants.CHARACTER_CLASSES[skinName]) {
        return res.status(400).json({ success: false, error: 'Invalid skin' });
    }

    if (skinName === 'balanced') {
        return res.status(400).json({ success: false, error: 'This skin is already unlocked' });
    }

    // Use centralized skin prices from constants
    const price = constants.SKIN_PRICES[skinName];
    const result = db.purchaseSkin(validation.userId, skinName, price);

    if (result.success) {
        const newCoins = db.getUserCoins(validation.userId);
        res.json({
            success: true,
            newCoins,
            skinName
        });
    } else {
        res.status(400).json({ success: false, error: result.error });
    }
});

app.get('/api/user/skins', (req, res) => {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const validation = auth.validateSession(sessionToken);
    if (!validation.valid) {
        return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const skins = db.getUserSkins(validation.userId);
    const coins = db.getUserCoins(validation.userId);

    // Always include 'balanced' as it's free for everyone
    if (!skins.includes('balanced')) {
        skins.push('balanced');
    }

    res.json({
        success: true,
        skins,
        coins
    });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const leaderboard = db.getLeaderboard(limit);
    res.json({ success: true, leaderboard });
});

// Get user's rank info
app.get('/api/user/rank', (req, res) => {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const validation = auth.validateSession(sessionToken);
    if (!validation.valid) {
        return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const user = db.getUserById(validation.userId);
    if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
        success: true,
        rank: {
            username: user.username,
            elo: user.elo || 1000,
            rank: user.rank || 'Unranked',
            wins: user.wins || 0,
            losses: user.losses || 0,
            total_matches: user.total_matches || 0,
            peak_elo: user.peak_elo || 1000
        }
    });
});

// Bot battle win endpoint
app.post('/api/bot/win', (req, res) => {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const validation = auth.validateSession(sessionToken);
    if (!validation.valid) {
        return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    // Award 30 coins for bot battle win
    const beforeCoins = db.getUserCoins(validation.userId);
    db.addCoins(validation.userId, 30);
    db.updateUserStats(validation.userId, true); // Record as a win

    const newTotal = db.getUserCoins(validation.userId);
    console.log(`[Bot Win] User ${validation.username}: ${beforeCoins} -> ${newTotal} coins (+30)`);

    res.json({
        success: true,
        amount: 30,
        newTotal
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    let currentSessionId = null;
    let currentUsername = null;
    let currentRoomId = null;

    // Authentication
    socket.on('auth:validate', (data) => {
        const { sessionToken } = data;
        const validation = auth.validateSession(sessionToken);

        if (validation.valid) {
            currentSessionId = validation.sessionId;
            currentUsername = validation.username;

            // Update socket ID in database
            db.updateSessionSocketId(sessionToken, socket.id);

            socket.emit('auth:validated', {
                success: true,
                username: validation.username,
                wins: validation.wins,
                losses: validation.losses,
                coins: validation.coins
            });
        } else {
            socket.emit('auth:validated', {
                success: false,
                error: validation.error
            });
        }
    });

    // Lobby operations
    socket.on('lobby:join', () => {
        if (!currentSessionId || !currentUsername) {
            socket.emit('lobby:error', { error: 'Not authenticated' });
            return;
        }

        matchmaking.userJoinLobby(currentSessionId, currentUsername, socket.id);

        // Send list of online users
        const users = matchmaking.getOnlineUsers(currentSessionId);
        socket.emit('lobby:users', { users });

        // Broadcast to other users that someone joined
        socket.broadcast.emit('lobby:user_online', { username: currentUsername });
    });

    socket.on('lobby:search', (data) => {
        if (!currentSessionId) {
            socket.emit('lobby:error', { error: 'Not authenticated' });
            return;
        }

        const { query } = data;
        const users = matchmaking.searchUsers(query, currentSessionId);
        socket.emit('lobby:users', { users });
    });

    // Duel requests
    socket.on('duel:request', (data) => {
        if (!currentSessionId) {
            socket.emit('duel:error', { error: 'Not authenticated' });
            return;
        }

        const { targetUsername, characterClass } = data;
        const result = matchmaking.createDuelRequest(currentSessionId, targetUsername, characterClass);

        if (result.success) {
            // Notify the target user
            io.to(result.toSocketId).emit('duel:incoming', {
                fromUsername: result.fromUsername,
                duelId: result.duelId
            });

            socket.emit('duel:sent', { success: true });
        } else {
            socket.emit('duel:error', { error: result.error });
        }
    });

    socket.on('duel:accept', (data) => {
        if (!currentSessionId) {
            socket.emit('duel:error', { error: 'Not authenticated' });
            return;
        }

        const { duelId, characterClass } = data;
        const result = matchmaking.acceptDuelRequest(duelId, currentSessionId, characterClass);

        if (result.success) {
            const { roomId, player1, player2 } = result;
            currentRoomId = roomId;

            // Create game room
            const gameRoom = new GameRoom(roomId, player1, player2, io);
            matchmaking.addActiveRoom(roomId, gameRoom);

            // Notify both players with character selections
            io.to(player1.socketId).emit('game:start', {
                roomId,
                localPlayer: 'red',
                opponentUsername: player2.username,
                player1Character: player1.characterClass,
                player2Character: player2.characterClass
            });

            io.to(player2.socketId).emit('game:start', {
                roomId,
                localPlayer: 'blue',
                opponentUsername: player1.username,
                player1Character: player1.characterClass,
                player2Character: player2.characterClass
            });

            // Update room ID for player 1's socket
            const player1Socket = io.sockets.sockets.get(player1.socketId);
            if (player1Socket) {
                player1Socket.data.roomId = roomId;
            }

            // Start the game
            gameRoom.start();
        } else {
            socket.emit('duel:error', { error: result.error });
        }
    });

    socket.on('duel:decline', (data) => {
        if (!currentSessionId) {
            socket.emit('duel:error', { error: 'Not authenticated' });
            return;
        }

        const { duelId } = data;
        const result = matchmaking.declineDuelRequest(duelId, currentSessionId);

        if (result.success) {
            // Notify the requester
            if (result.requesterSocketId) {
                io.to(result.requesterSocketId).emit('duel:declined', {
                    username: result.declinerUsername
                });
            }

            socket.emit('duel:decline_confirmed', { success: true });
        } else {
            socket.emit('duel:error', { error: result.error });
        }
    });

    // Game input
    socket.on('game:input', (data) => {
        if (!currentSessionId || !currentRoomId) return;

        const { key, action } = data;
        const gameRoom = matchmaking.getActiveRoom(currentRoomId);

        if (gameRoom) {
            gameRoom.handleInput(currentSessionId, key, action);
        }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);

        // Remove from lobby
        if (currentSessionId) {
            matchmaking.userLeaveLobby(currentSessionId);

            // Broadcast to other users
            socket.broadcast.emit('lobby:user_offline', { username: currentUsername });
        }

        // Handle game disconnect
        if (currentRoomId) {
            const gameRoom = matchmaking.getActiveRoom(currentRoomId);
            if (gameRoom) {
                const result = gameRoom.handlePlayerDisconnect(currentSessionId);

                if (result) {
                    // Update stats in database
                    const session = db.getSessionBySessionId(currentSessionId);
                    if (session) {
                        const winnerSession = db.getSessionBySessionId(result.winnerId);
                        const loserSession = db.getSessionBySessionId(result.loserId);

                        if (winnerSession) {
                            db.updateUserStats(winnerSession.user_id, true);
                        }
                        if (loserSession) {
                            db.updateUserStats(loserSession.user_id, false);
                        }
                    }
                }

                matchmaking.removeActiveRoom(currentRoomId);
            }
        }

        // Clean up session
        if (currentSessionId) {
            db.deleteSessionBySocketId(socket.id);
        }
    });

    // Game end handling
    socket.on('game:ended', () => {
        if (currentRoomId) {
            const gameRoom = matchmaking.getActiveRoom(currentRoomId);
            if (gameRoom) {
                // Update user stats and award coins
                const playerSessionIds = gameRoom.getPlayerSessionIds();
                const winnerColor = gameRoom.winner;

                // Check if this is a PvP match (2 players) or bot match (1 player)
                const isPvPMatch = playerSessionIds.length === 2;

                for (const sessionId of playerSessionIds) {
                    const session = db.getSessionBySessionId(sessionId);
                    if (session) {
                        const player = gameRoom.players[sessionId];
                        const isWinner = player.color === winnerColor;

                        // Award 30 coins to winner
                        if (isWinner) {
                            db.addCoins(session.user_id, 30);

                            // Notify winner of coin reward
                            io.to(player.socketId).emit('coins:awarded', {
                                amount: 30,
                                newTotal: db.getUserCoins(session.user_id)
                            });
                        }
                    }
                }

                // Update ELO for PvP matches
                if (isPvPMatch && playerSessionIds.length === 2) {
                    let winnerId = null;
                    let loserId = null;

                    for (const sessionId of playerSessionIds) {
                        const session = db.getSessionBySessionId(sessionId);
                        const player = gameRoom.players[sessionId];
                        if (session) {
                            if (player.color === winnerColor) {
                                winnerId = session.user_id;
                            } else {
                                loserId = session.user_id;
                            }
                        }
                    }

                    if (winnerId && loserId) {
                        const eloResult = db.updateEloAfterMatch(winnerId, loserId, false);

                        // Notify players of ELO changes
                        for (const sessionId of playerSessionIds) {
                            const session = db.getSessionBySessionId(sessionId);
                            const player = gameRoom.players[sessionId];
                            if (session) {
                                if (eloResult.success && eloResult.winner && eloResult.loser) {
                                    const playerInfo = player.color === winnerColor ? eloResult.winner : eloResult.loser;
                                    io.to(player.socketId).emit('elo:updated', {
                                        newElo: playerInfo.newElo,
                                        eloChange: playerInfo.eloChange,
                                        rank: playerInfo.rank
                                    });
                                }
                            }
                        }
                    }
                }

                // Track max combo for both players
                for (const sessionId of playerSessionIds) {
                    const session = db.getSessionBySessionId(sessionId);
                    if (session && gameRoom.maxCombos) {
                        const maxCombo = gameRoom.players[sessionId].color === 'red'
                            ? gameRoom.maxCombos.red
                            : gameRoom.maxCombos.blue;
                        db.updateMaxCombo(session.user_id, maxCombo);
                    }
                }
            }

            matchmaking.removeActiveRoom(currentRoomId);
            currentRoomId = null;

            // Update user status back to available
            if (currentSessionId) {
                matchmaking.updateUserStatus(currentSessionId, 'available');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Multiplayer fighting game server started`);
});
