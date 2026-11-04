const Database = require('better-sqlite3');
const path = require('path');

// Create database connection
const db = new Database(path.join(__dirname, '..', 'users.db'));

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize database tables
function initializeDatabase() {
    // Create users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            coins INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Migrate existing users table to add coins column if it doesn't exist
    try {
        const columns = db.prepare("PRAGMA table_info(users)").all();
        const hasCoins = columns.some(col => col.name === 'coins');
        const hasMaxCombo = columns.some(col => col.name === 'max_combo');
        const hasTotalCombos = columns.some(col => col.name === 'total_combos');
        const hasElo = columns.some(col => col.name === 'elo');
        const hasRank = columns.some(col => col.name === 'rank');
        const hasTotalMatches = columns.some(col => col.name === 'total_matches');
        const hasPeakElo = columns.some(col => col.name === 'peak_elo');

        if (!hasCoins) {
            db.exec('ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0');
            console.log('Added coins column to users table');
        }
        if (!hasMaxCombo) {
            db.exec('ALTER TABLE users ADD COLUMN max_combo INTEGER DEFAULT 0');
            console.log('Added max_combo column to users table');
        }
        if (!hasTotalCombos) {
            db.exec('ALTER TABLE users ADD COLUMN total_combos INTEGER DEFAULT 0');
            console.log('Added total_combos column to users table');
        }
        if (!hasElo) {
            db.exec('ALTER TABLE users ADD COLUMN elo INTEGER DEFAULT 1000');
            console.log('Added elo column to users table');
        }
        if (!hasRank) {
            db.exec('ALTER TABLE users ADD COLUMN rank TEXT DEFAULT "Unranked"');
            console.log('Added rank column to users table');
        }
        if (!hasTotalMatches) {
            db.exec('ALTER TABLE users ADD COLUMN total_matches INTEGER DEFAULT 0');
            console.log('Added total_matches column to users table');
        }
        if (!hasPeakElo) {
            db.exec('ALTER TABLE users ADD COLUMN peak_elo INTEGER DEFAULT 1000');
            console.log('Added peak_elo column to users table');
        }
    } catch (error) {
        // Table doesn't exist yet or migration already done
        console.log('ELO and combo columns migration check:', error.message);
    }

    // Create active_sessions table
    db.exec(`
        CREATE TABLE IF NOT EXISTS active_sessions (
            session_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            socket_id TEXT,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Create user_skins table
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_skins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            skin_name TEXT NOT NULL,
            purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, skin_name)
        )
    `);

    // Create match_history table for ELO tracking
    db.exec(`
        CREATE TABLE IF NOT EXISTS match_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            winner_id INTEGER NOT NULL,
            loser_id INTEGER NOT NULL,
            winner_elo_change INTEGER DEFAULT 0,
            loser_elo_change INTEGER DEFAULT 0,
            match_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (winner_id) REFERENCES users(id),
            FOREIGN KEY (loser_id) REFERENCES users(id)
        )
    `);

    console.log('Database initialized successfully');
}

// User operations
function createUser(username, passwordHash) {
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    return stmt.run(username, passwordHash);
}

function getUserByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE');
    return stmt.get(username);
}

function getUserById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
}

function updateUserStats(userId, isWinner) {
    const column = isWinner ? 'wins' : 'losses';
    const stmt = db.prepare(`UPDATE users SET ${column} = ${column} + 1 WHERE id = ?`);
    return stmt.run(userId);
}

function updateMaxCombo(userId, comboCount) {
    const stmt = db.prepare(`
        UPDATE users
        SET max_combo = MAX(max_combo, ?),
            total_combos = total_combos + ?
        WHERE id = ?
    `);
    return stmt.run(comboCount, comboCount > 0 ? 1 : 0, userId);
}

// ELO rating functions
function calculateEloChange(winnerElo, loserElo, K = 32) {
    // Standard ELO formula
    const expectedWinnerScore = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const eloChange = Math.round(K * (1 - expectedWinnerScore));
    return eloChange;
}

function getRankFromElo(elo) {
    if (elo < 1000) return 'Unranked';
    if (elo < 1200) return 'Bronze';
    if (elo < 1400) return 'Silver';
    if (elo < 1600) return 'Gold';
    if (elo < 1800) return 'Platinum';
    return 'Diamond';
}

function updateEloAfterMatch(winnerId, loserId, isBotMatch = false) {
    if (isBotMatch) {
        // Bot matches don't affect ELO
        const updateStmt = db.prepare('UPDATE users SET total_matches = total_matches + 1 WHERE id = ?');
        updateStmt.run(winnerId);
        return { success: true, botMatch: true };
    }

    try {
        const transaction = db.transaction(() => {
            // Get current ELOs
            const winner = getUserById(winnerId);
            const loser = getUserById(loserId);

            if (!winner || !loser) {
                throw new Error('Winner or loser not found');
            }

            const winnerElo = winner.elo || 1000;
            const loserElo = loser.elo || 1000;

            // Calculate ELO changes
            const winnerChange = calculateEloChange(winnerElo, loserElo, 32);
            const loserChange = -calculateEloChange(loserElo, winnerElo, 32);

            // Update ELO and stats
            const newWinnerElo = winnerElo + winnerChange;
            const newLoserElo = loserElo + loserChange;

            db.prepare(`
                UPDATE users
                SET elo = ?,
                    peak_elo = MAX(peak_elo, ?),
                    rank = ?,
                    total_matches = total_matches + 1,
                    wins = wins + 1
                WHERE id = ?
            `).run(newWinnerElo, newWinnerElo, getRankFromElo(newWinnerElo), winnerId);

            db.prepare(`
                UPDATE users
                SET elo = ?,
                    rank = ?,
                    total_matches = total_matches + 1,
                    losses = losses + 1
                WHERE id = ?
            `).run(newLoserElo, getRankFromElo(newLoserElo), loserId);

            // Record in match history
            db.prepare(`
                INSERT INTO match_history (winner_id, loser_id, winner_elo_change, loser_elo_change)
                VALUES (?, ?, ?, ?)
            `).run(winnerId, loserId, winnerChange, loserChange);

            return {
                success: true,
                winner: { newElo: newWinnerElo, eloChange: winnerChange, rank: getRankFromElo(newWinnerElo) },
                loser: { newElo: newLoserElo, eloChange: loserChange, rank: getRankFromElo(newLoserElo) }
            };
        });

        return transaction();
    } catch (error) {
        console.error('Error updating ELO:', error);
        return { success: false, error: error.message };
    }
}

function getLeaderboard(limit = 100) {
    const stmt = db.prepare(`
        SELECT id, username, elo, rank, wins, losses, total_matches, peak_elo
        FROM users
        ORDER BY elo DESC
        LIMIT ?
    `);
    return stmt.all(limit);
}

function addCoins(userId, amount) {
    const stmt = db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?');
    const result = stmt.run(amount, userId);
    console.log(`[DB] addCoins: userId=${userId}, amount=${amount}, changes=${result.changes}`);
    return result;
}

function getUserCoins(userId) {
    const stmt = db.prepare('SELECT coins FROM users WHERE id = ?');
    const result = stmt.get(userId);
    const coins = result ? result.coins : 0;
    console.log(`[DB] getUserCoins: userId=${userId}, coins=${coins}`);
    return coins;
}

function deductCoins(userId, amount) {
    const stmt = db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?');
    return stmt.run(amount, userId, amount);
}

// Session operations
function createSession(sessionId, userId, socketId = null) {
    const stmt = db.prepare('INSERT INTO active_sessions (session_id, user_id, socket_id) VALUES (?, ?, ?)');
    return stmt.run(sessionId, userId, socketId);
}

function getSessionBySessionId(sessionId) {
    const stmt = db.prepare('SELECT * FROM active_sessions WHERE session_id = ?');
    return stmt.get(sessionId);
}

function updateSessionSocketId(sessionId, socketId) {
    const stmt = db.prepare('UPDATE active_sessions SET socket_id = ?, last_active = CURRENT_TIMESTAMP WHERE session_id = ?');
    return stmt.run(socketId, sessionId);
}

function deleteSession(sessionId) {
    const stmt = db.prepare('DELETE FROM active_sessions WHERE session_id = ?');
    return stmt.run(sessionId);
}

function deleteSessionBySocketId(socketId) {
    const stmt = db.prepare('DELETE FROM active_sessions WHERE socket_id = ?');
    return stmt.run(socketId);
}

function getSessionBySocketId(socketId) {
    const stmt = db.prepare('SELECT * FROM active_sessions WHERE socket_id = ?');
    return stmt.get(socketId);
}

// Cleanup old sessions (optional, can be called periodically)
function cleanupOldSessions(hoursOld = 24) {
    const stmt = db.prepare(`
        DELETE FROM active_sessions
        WHERE datetime(last_active) < datetime('now', '-${hoursOld} hours')
    `);
    return stmt.run();
}

// Skin operations
function purchaseSkin(userId, skinName, cost) {
    try {
        // Start transaction
        const transaction = db.transaction(() => {
            // Deduct coins
            const deductResult = deductCoins(userId, cost);
            if (deductResult.changes === 0) {
                throw new Error('Insufficient coins');
            }

            // Add skin
            const stmt = db.prepare('INSERT INTO user_skins (user_id, skin_name) VALUES (?, ?)');
            return stmt.run(userId, skinName);
        });

        return { success: true, result: transaction() };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function getUserSkins(userId) {
    const stmt = db.prepare('SELECT skin_name FROM user_skins WHERE user_id = ?');
    return stmt.all(userId).map(row => row.skin_name);
}

function hasSkin(userId, skinName) {
    const stmt = db.prepare('SELECT 1 FROM user_skins WHERE user_id = ? AND skin_name = ?');
    return stmt.get(userId, skinName) !== undefined;
}

module.exports = {
    db,
    initializeDatabase,
    createUser,
    getUserByUsername,
    getUserById,
    updateUserStats,
    updateMaxCombo,
    calculateEloChange,
    getRankFromElo,
    updateEloAfterMatch,
    getLeaderboard,
    addCoins,
    getUserCoins,
    deductCoins,
    createSession,
    getSessionBySessionId,
    updateSessionSocketId,
    deleteSession,
    deleteSessionBySocketId,
    getSessionBySocketId,
    cleanupOldSessions,
    purchaseSkin,
    getUserSkins,
    hasSkin
};
