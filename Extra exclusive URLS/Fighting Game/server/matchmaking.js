const crypto = require('crypto');

// Online users: Map<sessionId, {username, socketId, status}>
const onlineUsers = new Map();

// Pending duels: Map<duelId, {fromSessionId, fromUsername, toSessionId, toUsername}>
const pendingDuels = new Map();

// Active game rooms: Map<roomId, GameRoom>
const activeRooms = new Map();

// Add user to lobby
function userJoinLobby(sessionId, username, socketId) {
    onlineUsers.set(sessionId, {
        username,
        socketId,
        status: 'available' // 'available', 'in_duel_request', 'in_game'
    });
    console.log(`User ${username} joined lobby`);
}

// Remove user from lobby
function userLeaveLobby(sessionId) {
    const user = onlineUsers.get(sessionId);
    if (user) {
        console.log(`User ${user.username} left lobby`);
        onlineUsers.delete(sessionId);
    }
}

// Get online users (excluding the requester)
function getOnlineUsers(excludeSessionId) {
    const users = [];
    for (const [sessionId, userData] of onlineUsers.entries()) {
        if (sessionId !== excludeSessionId) {
            users.push({
                username: userData.username,
                status: userData.status
            });
        }
    }
    return users;
}

// Search users by query
function searchUsers(query, excludeSessionId) {
    const allUsers = getOnlineUsers(excludeSessionId);
    if (!query || query.trim() === '') {
        return allUsers;
    }

    const lowerQuery = query.toLowerCase();
    return allUsers.filter(user =>
        user.username.toLowerCase().includes(lowerQuery)
    );
}

// Get user by username
function getUserByUsername(username) {
    for (const [sessionId, userData] of onlineUsers.entries()) {
        if (userData.username.toLowerCase() === username.toLowerCase()) {
            return { sessionId, ...userData };
        }
    }
    return null;
}

// Get user by session ID
function getUserBySessionId(sessionId) {
    return onlineUsers.get(sessionId);
}

// Create duel request
function createDuelRequest(fromSessionId, toUsername, characterClass) {
    const fromUser = onlineUsers.get(fromSessionId);
    if (!fromUser) {
        return { success: false, error: 'You are not online' };
    }

    const toUser = getUserByUsername(toUsername);
    if (!toUser) {
        return { success: false, error: 'User not found or offline' };
    }

    if (toUser.status !== 'available') {
        return { success: false, error: 'User is busy' };
    }

    // Check if there's already a pending duel between these users
    for (const [duelId, duel] of pendingDuels.entries()) {
        if ((duel.fromSessionId === fromSessionId && duel.toSessionId === toUser.sessionId) ||
            (duel.fromSessionId === toUser.sessionId && duel.toSessionId === fromSessionId)) {
            return { success: false, error: 'Duel request already pending' };
        }
    }

    const duelId = crypto.randomBytes(16).toString('hex');
    pendingDuels.set(duelId, {
        fromSessionId,
        fromUsername: fromUser.username,
        fromCharacter: characterClass || 'balanced',
        toSessionId: toUser.sessionId,
        toUsername: toUser.username,
        toCharacter: null
    });

    // Update statuses
    fromUser.status = 'in_duel_request';
    toUser.status = 'in_duel_request';

    return {
        success: true,
        duelId,
        toSocketId: toUser.socketId,
        fromUsername: fromUser.username
    };
}

// Accept duel request
function acceptDuelRequest(duelId, acceptingSessionId, characterClass) {
    const duel = pendingDuels.get(duelId);
    if (!duel) {
        return { success: false, error: 'Duel request not found' };
    }

    if (duel.toSessionId !== acceptingSessionId) {
        return { success: false, error: 'This duel request is not for you' };
    }

    const fromUser = onlineUsers.get(duel.fromSessionId);
    const toUser = onlineUsers.get(duel.toSessionId);

    if (!fromUser || !toUser) {
        pendingDuels.delete(duelId);
        return { success: false, error: 'One or both users are no longer online' };
    }

    // Update the accepting player's character choice
    duel.toCharacter = characterClass || 'balanced';

    // Delete the duel request
    pendingDuels.delete(duelId);

    // Create room ID
    const roomId = crypto.randomBytes(16).toString('hex');

    // Update user statuses
    fromUser.status = 'in_game';
    toUser.status = 'in_game';

    return {
        success: true,
        roomId,
        player1: {
            sessionId: duel.fromSessionId,
            username: duel.fromUsername,
            socketId: fromUser.socketId,
            characterClass: duel.fromCharacter
        },
        player2: {
            sessionId: duel.toSessionId,
            username: duel.toUsername,
            socketId: toUser.socketId,
            characterClass: duel.toCharacter
        }
    };
}

// Decline duel request
function declineDuelRequest(duelId, decliningSessionId) {
    const duel = pendingDuels.get(duelId);
    if (!duel) {
        return { success: false, error: 'Duel request not found' };
    }

    if (duel.toSessionId !== decliningSessionId) {
        return { success: false, error: 'This duel request is not for you' };
    }

    const fromUser = onlineUsers.get(duel.fromSessionId);
    const toUser = onlineUsers.get(duel.toSessionId);

    // Reset statuses
    if (fromUser) fromUser.status = 'available';
    if (toUser) toUser.status = 'available';

    // Delete the duel request
    pendingDuels.delete(duelId);

    return {
        success: true,
        requesterSocketId: fromUser ? fromUser.socketId : null,
        declinerUsername: duel.toUsername
    };
}

// Cancel duel request (by requester)
function cancelDuelRequest(sessionId) {
    for (const [duelId, duel] of pendingDuels.entries()) {
        if (duel.fromSessionId === sessionId) {
            const toUser = onlineUsers.get(duel.toSessionId);
            if (toUser) toUser.status = 'available';

            const fromUser = onlineUsers.get(duel.fromSessionId);
            if (fromUser) fromUser.status = 'available';

            pendingDuels.delete(duelId);
            return { success: true };
        }
    }
    return { success: false, error: 'No pending duel request found' };
}

// Get user's pending duel requests
function getUserPendingDuels(sessionId) {
    const incoming = [];
    const outgoing = [];

    for (const [duelId, duel] of pendingDuels.entries()) {
        if (duel.toSessionId === sessionId) {
            incoming.push({
                duelId,
                fromUsername: duel.fromUsername
            });
        } else if (duel.fromSessionId === sessionId) {
            outgoing.push({
                duelId,
                toUsername: duel.toUsername
            });
        }
    }

    return { incoming, outgoing };
}

// Store active game room
function addActiveRoom(roomId, gameRoom) {
    activeRooms.set(roomId, gameRoom);
}

// Get active game room
function getActiveRoom(roomId) {
    return activeRooms.get(roomId);
}

// Remove active game room
function removeActiveRoom(roomId) {
    activeRooms.delete(roomId);
}

// Update user status
function updateUserStatus(sessionId, status) {
    const user = onlineUsers.get(sessionId);
    if (user) {
        user.status = status;
    }
}

module.exports = {
    userJoinLobby,
    userLeaveLobby,
    getOnlineUsers,
    searchUsers,
    getUserByUsername,
    getUserBySessionId,
    createDuelRequest,
    acceptDuelRequest,
    declineDuelRequest,
    cancelDuelRequest,
    getUserPendingDuels,
    addActiveRoom,
    getActiveRoom,
    removeActiveRoom,
    updateUserStatus
};
