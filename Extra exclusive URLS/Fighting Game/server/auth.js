const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./database');

const SALT_ROUNDS = 10;

// Validate username
function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Username is required' };
    }
    if (username.length < 3 || username.length > 20) {
        return { valid: false, error: 'Username must be 3-20 characters' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return { valid: false, error: 'Username must be alphanumeric (letters, numbers, underscore only)' };
    }
    return { valid: true };
}

// Validate password
function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }
    if (password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters' };
    }
    return { valid: true };
}

// Register a new user
async function registerUser(username, password) {
    try {
        // Validate input
        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
            return { success: false, error: usernameValidation.error };
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return { success: false, error: passwordValidation.error };
        }

        // Check if username already exists
        const existingUser = db.getUserByUsername(username);
        if (existingUser) {
            return { success: false, error: 'Username already taken' };
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user
        const result = db.createUser(username, passwordHash);

        // Create session
        const sessionId = crypto.randomBytes(32).toString('hex');
        db.createSession(sessionId, result.lastInsertRowid);

        return {
            success: true,
            sessionToken: sessionId,
            username: username,
            userId: result.lastInsertRowid
        };
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: 'Registration failed' };
    }
}

// Login user
async function loginUser(username, password) {
    try {
        // Validate input
        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
            return { success: false, error: usernameValidation.error };
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return { success: false, error: passwordValidation.error };
        }

        // Get user
        const user = db.getUserByUsername(username);
        if (!user) {
            return { success: false, error: 'Invalid username or password' };
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return { success: false, error: 'Invalid username or password' };
        }

        // Create new session
        const sessionId = crypto.randomBytes(32).toString('hex');
        db.createSession(sessionId, user.id);

        return {
            success: true,
            sessionToken: sessionId,
            username: user.username,
            userId: user.id,
            wins: user.wins,
            losses: user.losses,
            coins: user.coins || 0
        };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Login failed' };
    }
}

// Validate session
function validateSession(sessionToken) {
    try {
        if (!sessionToken) {
            return { valid: false, error: 'Session token required' };
        }

        const session = db.getSessionBySessionId(sessionToken);
        if (!session) {
            return { valid: false, error: 'Invalid session' };
        }

        const user = db.getUserById(session.user_id);
        if (!user) {
            return { valid: false, error: 'User not found' };
        }

        return {
            valid: true,
            userId: user.id,
            username: user.username,
            sessionId: sessionToken,
            wins: user.wins,
            losses: user.losses,
            coins: user.coins || 0
        };
    } catch (error) {
        console.error('Session validation error:', error);
        return { valid: false, error: 'Session validation failed' };
    }
}

// Logout user
function logoutUser(sessionToken) {
    try {
        db.deleteSession(sessionToken);
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: 'Logout failed' };
    }
}

module.exports = {
    registerUser,
    loginUser,
    validateSession,
    logoutUser
};
