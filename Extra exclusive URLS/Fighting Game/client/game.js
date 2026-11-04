// Game mode state
const gameMode = {
    type: 'local', // 'local' | 'multiplayer' | 'bot'
    localPlayer: null, // 'red' | 'blue' in multiplayer
    player1Username: 'RED',
    player2Username: 'BLUE',
    isPaused: false
};

// Color name mapping based on character class
const COLOR_NAMES = {
    '#dc143c': 'RED',      // Brawler primary
    '#ff4500': 'RED',      // Brawler secondary
    '#1e90ff': 'BLUE',     // Speedster primary
    '#00bfff': 'BLUE',     // Speedster secondary
    '#9370db': 'PURPLE',   // Balanced primary
    '#ba55d3': 'PURPLE',   // Balanced secondary
    '#2ecc71': 'GREEN',    // Heavy Tanker primary
    '#27ae60': 'GREEN',    // Heavy Tanker secondary
    '#000000': 'BLACK',    // Agile Ninja primary
    '#1a1a1a': 'BLACK',    // Agile Ninja secondary
    '#ffd700': 'GOLD',     // Mystic Warrior primary
    '#ffed4e': 'GOLD',     // Mystic Warrior secondary
    '#696969': 'GREY',     // Stone Guardian primary
    '#a9a9a9': 'GREY',     // Stone Guardian secondary
    '#8b0000': 'CRIMSON',  // Crimson Demon primary
    '#b22222': 'CRIMSON'   // Crimson Demon secondary
};

function getColorName(hexColor) {
    return COLOR_NAMES[hexColor.toLowerCase()] || hexColor.toUpperCase();
}

// Character selection state
let characterSelection = {
    player1: null, // 'brawler', 'speedster', 'balanced'
    player2: null,
    awaitingSelection: false,
    selectingFor: null, // 'local' | 'multiplayer'
    multiplayerCallback: null
};

// DOM elements
const gameContainer = document.getElementById('gameContainer');
const redFighter = document.getElementById('redFighter');
const blueFighter = document.getElementById('blueFighter');
const redHealthFill = document.getElementById('redHealthFill');
const blueHealthFill = document.getElementById('blueHealthFill');
const redHealthText = document.getElementById('redHealthText');
const blueHealthText = document.getElementById('blueHealthText');
const gameOverDiv = document.getElementById('gameOver');
const winnerText = document.getElementById('winnerText');

const redCanvas = document.getElementById('redCanvas');
const blueCanvas = document.getElementById('blueCanvas');
const redCtx = redCanvas.getContext('2d');
const blueCtx = blueCanvas.getContext('2d');

// Note: Game constants are loaded from shared/constants.js
// GROUND_LEVEL, GRAVITY, JUMP_STRENGTH, MOVE_SPEED, etc.

let gameState = {
    red: {
        x: 100,
        y: 0,
        velocityY: 0,
        health: 100,
        maxHealth: 100,
        isJumping: false,
        canPunch: true,
        canKick: true,
        facing: -1,
        action: 'idle',
        actionTimer: 0,
        walkCycle: 0,
        punchFrame: 0,
        kickFrame: 0,
        limbPositions: {},
        characterClass: 'balanced',
        size: 1.0,
        color: '#dc143c',
        // Combo system
        combo: 0,
        comboTimer: null,
        lastHitTime: 0,
        // Block mechanic
        isBlocking: false,
        blockStamina: 100,
        blockStaminaTimer: null,
        canBlock: true
    },
    blue: {
        x: 820,
        y: 0,
        velocityY: 0,
        health: 100,
        maxHealth: 100,
        isJumping: false,
        canPunch: true,
        canKick: true,
        facing: 1,
        action: 'idle',
        actionTimer: 0,
        walkCycle: 0,
        punchFrame: 0,
        kickFrame: 0,
        limbPositions: {},
        characterClass: 'balanced',
        size: 1.0,
        color: '#1e90ff',
        // Combo system
        combo: 0,
        comboTimer: null,
        lastHitTime: 0,
        // Block mechanic
        isBlocking: false,
        blockStamina: 100,
        blockStaminaTimer: null,
        canBlock: true
    },
    keys: {},
    gameOver: false,
    animationFrame: 0
};

// Stick figure drawing function
function drawStickFigure(ctx, color, action, walkCycle, facing, player) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();

    // Apply character size scaling
    const scale = player.size || 1.0;
    ctx.translate(120, 360);
    ctx.scale(scale, scale);
    ctx.translate(-120, -360);

    // Center point (scaled up by 2x)
    const centerX = 120;
    const baseY = 340;

    // Apply facing direction
    if (facing === -1) {
        ctx.translate(240, 0);
        ctx.scale(-1, 1);
    }

    // Set drawing style (thicker lines)
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Animation parameters (scaled up by 2x)
    let headY = baseY - 160;
    let bodyTop = baseY - 145;
    let bodyBottom = baseY - 80;
    let leftArmAngle = 0;
    let rightArmAngle = 0;
    let leftLegAngle = 0;
    let rightLegAngle = 0;
    let leftArmBend = -20;
    let rightArmBend = -20;
    let leftKneeAngle = 10;
    let rightKneeAngle = 10;

    // Calculate angles based on action
    if (action === 'idle') {
        // Gentle breathing animation
        const breathe = Math.sin(walkCycle * 0.6) * 2.5;
        headY += breathe;
        bodyTop += breathe * 0.5;

        // Symmetric arm position with slight breathing
        rightArmAngle = 8;
        leftArmAngle = -8;
        rightArmBend = -25 + breathe * 4;
        leftArmBend = -25 - breathe * 4;

        // Relaxed stance with slight sway
        rightKneeAngle = 10 + breathe * 0.3;
        leftKneeAngle = 10 - breathe * 0.3;
    } else if (action === 'walk') {
        const wave = Math.sin(walkCycle);
        leftLegAngle = wave * 30;
        rightLegAngle = -wave * 30;
        leftArmAngle = -wave * 25 + 5;
        rightArmAngle = wave * 25 - 5;

        // More natural knee bending during walk
        leftKneeAngle = Math.max(10, 10 + wave * 30);
        rightKneeAngle = Math.max(10, 10 - wave * 30);

        // Natural arm swing with elbow bend
        leftArmBend = -30 + Math.abs(wave) * 10;
        rightArmBend = -30 + Math.abs(wave) * 10;
        headY += Math.abs(wave) * 3;
    } else if (action === 'jump') {
        leftLegAngle = -45;
        rightLegAngle = -45;
        leftArmAngle = -120;
        rightArmAngle = -120;
        leftKneeAngle = 60;
        rightKneeAngle = 60;
        leftArmBend = -40;
        rightArmBend = -40;
        headY -= 8;
    } else if (action === 'punch') {
        // Dynamic punch forward (always use right arm, canvas flip handles direction)
        const t = player.punchFrame / 12;
        const extension = Math.sin(t * Math.PI);

        // Punching arm extends forward
        rightArmAngle = -10;
        rightArmBend = -extension * 170;

        // Other arm guards
        leftArmAngle = -60;
        leftArmBend = -80;

        // Slight lean forward
        bodyTop += extension * 5;
        bodyBottom += extension * 5;

        // Stable stance
        leftKneeAngle = 15;
        rightKneeAngle = 15;
    } else if (action === 'kick') {
        // Dynamic kick forward (always use right leg, canvas flip handles direction)
        const t = player.kickFrame / 15;
        const extension = Math.sin(t * Math.PI);

        // Kicking leg extends forward - increased angle for more forward extension
        rightLegAngle = -extension * 60;
        rightKneeAngle = extension * 20;

        // Supporting leg stays planted
        leftLegAngle = -5;
        leftKneeAngle = 20;

        // Arms out for balance
        leftArmAngle = -80 + extension * 20;
        rightArmAngle = 80 - extension * 20;
        leftArmBend = -40;
        rightArmBend = -40;

        // Lean forward into the kick
        bodyTop += extension * 10;
        headY += extension * 5;
    }

    // Draw legs (store positions for collision)
    const leftLeg = drawLimb(ctx, centerX, bodyBottom, 60, leftLegAngle, leftKneeAngle, 'leg');
    const rightLeg = drawLimb(ctx, centerX, bodyBottom, 60, rightLegAngle, rightKneeAngle, 'leg');

    // Draw body
    ctx.beginPath();
    ctx.moveTo(centerX, bodyTop);
    ctx.lineTo(centerX, bodyBottom);
    ctx.stroke();

    // Draw arms (store positions for collision)
    const leftArm = drawLimb(ctx, centerX, bodyTop + 10, 50, leftArmAngle, leftArmBend, 'arm');
    const rightArm = drawLimb(ctx, centerX, bodyTop + 10, 50, rightArmAngle, rightArmBend, 'arm');

    // Draw head
    ctx.beginPath();
    ctx.arc(centerX, headY, 20, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();

    // Store limb positions for collision detection
    player.limbPositions = {
        leftArm: leftArm,
        rightArm: rightArm,
        leftLeg: leftLeg,
        rightLeg: rightLeg,
        facing: facing
    };

    ctx.restore();
}

function drawLimb(ctx, startX, startY, length, angle1, angle2, type) {
    const limbLength = type === 'arm' ? 44 : 56;

    // Convert angles to radians
    const rad1 = (angle1 * Math.PI) / 180;
    const rad2 = (angle2 * Math.PI) / 180;

    // First segment
    const midX = startX + Math.sin(rad1) * limbLength;
    const midY = startY + Math.cos(rad1) * limbLength;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(midX, midY);
    ctx.stroke();

    // Second segment (forearm/shin)
    const endX = midX + Math.sin(rad1 + rad2) * limbLength;
    const endY = midY + Math.cos(rad1 + rad2) * limbLength;

    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Return limb positions for collision detection
    return {
        start: { x: startX, y: startY },
        mid: { x: midX, y: midY },
        end: { x: endX, y: endY }
    };
}

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    if (gameMode.type === 'local') {
        // Local mode: Red=WASD+LShift+E, Blue=Arrows+RShift+E
        gameState.keys[key] = true;
        // Distinguish between left and right shift
        if (e.code === 'ShiftLeft') {
            gameState.keys['shiftleft'] = true;
        } else if (e.code === 'ShiftRight') {
            gameState.keys['shiftright'] = true;
        }
    } else if (gameMode.type === 'bot') {
        // Bot mode: Player uses WASD or arrow keys + Space or LShift, bot is AI-controlled
        gameState.keys[key] = true;

        // Mirror arrow keys to WASD
        if (key === 'arrowleft') gameState.keys['a'] = true;
        if (key === 'arrowright') gameState.keys['d'] = true;
        if (key === 'arrowup') gameState.keys['w'] = true;
        if (key === 'arrowdown') gameState.keys['s'] = true;

        // Accept both LShift and Space for kick
        if (e.code === 'ShiftLeft') {
            gameState.keys['shiftleft'] = true;
        }
        if (e.code === 'Space') {
            gameState.keys['shiftleft'] = true; // Mirror Space to shiftleft
        }
    } else if (gameMode.type === 'multiplayer') {
        // Multiplayer: Arrow keys + Space + Shift + E + R for local player
        if (['arrowup', 'arrowleft', 'arrowright', 'arrowdown', ' ', 'shift', 'e', 'r'].includes(key) ||
            e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            gameState.keys[key] = true;

            // Send input to server
            if (typeof sendGameInput === 'function') {
                sendGameInput(key, 'keydown');
            }
        }
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();

    if (gameMode.type === 'local') {
        gameState.keys[key] = false;
        // Clear specific shift key
        if (e.code === 'ShiftLeft') {
            gameState.keys['shiftleft'] = false;
        } else if (e.code === 'ShiftRight') {
            gameState.keys['shiftright'] = false;
        }
    } else if (gameMode.type === 'bot') {
        // Bot mode: Player uses WASD or arrow keys + Space or LShift
        gameState.keys[key] = false;

        // Mirror arrow keys to WASD
        if (key === 'arrowleft') gameState.keys['a'] = false;
        if (key === 'arrowright') gameState.keys['d'] = false;
        if (key === 'arrowup') gameState.keys['w'] = false;
        if (key === 'arrowdown') gameState.keys['s'] = false;

        // Clear kick keys
        if (e.code === 'ShiftLeft') {
            gameState.keys['shiftleft'] = false;
        }
        if (e.code === 'Space') {
            gameState.keys['shiftleft'] = false; // Clear mirrored Space
        }
    } else if (gameMode.type === 'multiplayer') {
        if (['arrowup', 'arrowleft', 'arrowright', 'arrowdown', ' ', 'shift', 'e', 'r'].includes(key) ||
            e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            gameState.keys[key] = false;

            // Send input to server
            if (typeof sendGameInput === 'function') {
                sendGameInput(key, 'keyup');
            }
        }
    }
});

function handleMovement(player, leftKey, rightKey, jumpKey) {
    let isMoving = false;

    // Get character-specific stats
    const charClass = CHARACTER_CLASSES[player.characterClass] || CHARACTER_CLASSES.balanced;

    // Don't allow movement during attacks
    if (player.action !== 'punch' && player.action !== 'kick') {
        if (gameState.keys[leftKey]) {
            player.x -= charClass.moveSpeed;
            player.facing = 1;
            if (player.x < 0) player.x = 0;
            isMoving = true;
        }
        if (gameState.keys[rightKey]) {
            player.x += charClass.moveSpeed;
            player.facing = -1;
            if (player.x > 880) player.x = 880;
            isMoving = true;
        }
    }

    if (gameState.keys[jumpKey] && !player.isJumping && player.action !== 'punch' && player.action !== 'kick') {
        player.velocityY = charClass.jumpStrength;
        player.isJumping = true;
        player.action = 'jump';
    }

    // Update animations
    if (isMoving && !player.isJumping && player.action !== 'punch' && player.action !== 'kick') {
        player.action = 'walk';
        player.walkCycle += 0.09;
    } else if (!isMoving && !player.isJumping && player.action === 'walk') {
        player.action = 'idle';
    }

    // Always update idle animation
    if (player.action === 'idle') {
        player.walkCycle += 0.03;
    }
}

function applyGravity(player) {
    player.velocityY -= GRAVITY;
    player.y += player.velocityY;

    if (player.y <= 0) {
        player.y = 0;
        player.velocityY = 0;
        player.isJumping = false;
        if (player.action === 'jump') {
            player.action = 'idle';
        }
    }
}

function checkLimbCollision(attacker, target, limbType) {
    if (!attacker.limbPositions || !target) return false;

    // Get the attacking limb position (always right side, canvas flip handles direction)
    let attackLimb;
    if (limbType === 'punch') {
        attackLimb = attacker.limbPositions.rightArm;
    } else if (limbType === 'kick') {
        attackLimb = attacker.limbPositions.rightLeg;
    }

    if (!attackLimb) return false;

    // Convert canvas coordinates (240x360) to world coordinates
    // The canvas is 2x the div size (120x180)
    let limbDivX, limbDivY;

    if (attacker.limbPositions.facing === 1) {
        // Facing right - canvas drawn normally
        limbDivX = attackLimb.end.x / 2;
    } else {
        // Facing left - canvas is flipped
        limbDivX = (240 - attackLimb.end.x) / 2;
    }

    // Y coordinate - flip and scale
    limbDivY = (360 - attackLimb.end.y) / 2;

    // Convert to world coordinates
    const limbWorldX = attacker.x + limbDivX;
    const limbWorldY = GROUND_LEVEL + attacker.y + limbDivY;

    // Check collision with target body
    const targetRect = {
        left: target.x,
        right: target.x + 120,
        top: GROUND_LEVEL + target.y,
        bottom: GROUND_LEVEL + target.y + 180
    };

    const hitboxRadius = 35;
    if (limbWorldX + hitboxRadius > targetRect.left &&
        limbWorldX - hitboxRadius < targetRect.right &&
        limbWorldY + hitboxRadius > targetRect.top &&
        limbWorldY - hitboxRadius < targetRect.bottom) {
        return true;
    }
    return false;
}

function handlePunch(player, opponent, punchKey, color) {
    const charClass = CHARACTER_CLASSES[player.characterClass] || CHARACTER_CLASSES.balanced;

    if (gameState.keys[punchKey] && player.canPunch && player.action !== 'punch' && player.action !== 'kick') {
        player.canPunch = false;
        player.action = 'punch';
        player.punchFrame = 0;
        player.hasHitWithPunch = false;

        setTimeout(() => {
            player.canPunch = true;
        }, charClass.punchCooldown);
    }

    // Update punch animation
    if (player.action === 'punch') {
        player.punchFrame++;

        // Check collision during extension (frames 4-8)
        if (player.punchFrame >= 4 && player.punchFrame <= 8 && !player.hasHitWithPunch) {
            if (checkLimbCollision(player, opponent, 'punch')) {
                // Calculate combo multiplier
                const comboMultiplier = Math.min(1 + player.combo * window.GAME_CONSTANTS.COMBO_DAMAGE_BONUS, window.GAME_CONSTANTS.MAX_COMBO_MULTIPLIER);
                let damage = charClass.punchDamage * comboMultiplier;

                // Apply block damage reduction if opponent is blocking
                if (opponent.isBlocking) {
                    damage *= (1 - window.GAME_CONSTANTS.BLOCK_DAMAGE_REDUCTION);
                }

                opponent.health -= damage;
                if (opponent.health < 0) opponent.health = 0;
                updateHealth(color === 'red' ? 'blue' : 'red');
                player.hasHitWithPunch = true;

                // Increment combo on hit
                player.combo++;
                player.lastHitTime = Date.now();

                // Clear opponent's combo
                opponent.combo = 0;
                if (opponent.comboTimer) {
                    clearTimeout(opponent.comboTimer);
                }

                // Set combo timeout (reset after COMBO_WINDOW ms)
                if (player.comboTimer) {
                    clearTimeout(player.comboTimer);
                }
                player.comboTimer = setTimeout(() => {
                    player.combo = 0;
                }, window.GAME_CONSTANTS.COMBO_WINDOW);

                if (opponent.health <= 0 && !gameState.gameOver) {
                    endGame(color === 'red' ? gameMode.player1Username : gameMode.player2Username);
                }
            }
        }

        // End punch animation
        if (player.punchFrame >= 12) {
            player.action = 'idle';
            player.punchFrame = 0;
        }
    }
}

function handleKick(player, opponent, kickKey, color) {
    const charClass = CHARACTER_CLASSES[player.characterClass] || CHARACTER_CLASSES.balanced;

    if (gameState.keys[kickKey] && player.canKick && player.action !== 'punch' && player.action !== 'kick') {
        player.canKick = false;
        player.action = 'kick';
        player.kickFrame = 0;
        player.hasHitWithKick = false;

        setTimeout(() => {
            player.canKick = true;
        }, charClass.kickCooldown);
    }

    // Update kick animation
    if (player.action === 'kick') {
        player.kickFrame++;

        // Check collision during extension (frames 5-10)
        if (player.kickFrame >= 5 && player.kickFrame <= 10 && !player.hasHitWithKick) {
            if (checkLimbCollision(player, opponent, 'kick')) {
                // Calculate combo multiplier
                const comboMultiplier = Math.min(1 + player.combo * window.GAME_CONSTANTS.COMBO_DAMAGE_BONUS, window.GAME_CONSTANTS.MAX_COMBO_MULTIPLIER);
                let damage = charClass.kickDamage * comboMultiplier;

                // Apply block damage reduction if opponent is blocking
                if (opponent.isBlocking) {
                    damage *= (1 - window.GAME_CONSTANTS.BLOCK_DAMAGE_REDUCTION);
                }

                opponent.health -= damage;
                if (opponent.health < 0) opponent.health = 0;
                updateHealth(color === 'red' ? 'blue' : 'red');
                player.hasHitWithKick = true;

                // Increment combo on hit
                player.combo++;
                player.lastHitTime = Date.now();

                // Clear opponent's combo
                opponent.combo = 0;
                if (opponent.comboTimer) {
                    clearTimeout(opponent.comboTimer);
                }

                // Set combo timeout (reset after COMBO_WINDOW ms)
                if (player.comboTimer) {
                    clearTimeout(player.comboTimer);
                }
                player.comboTimer = setTimeout(() => {
                    player.combo = 0;
                }, window.GAME_CONSTANTS.COMBO_WINDOW);

                if (opponent.health <= 0 && !gameState.gameOver) {
                    endGame(color === 'red' ? gameMode.player1Username : gameMode.player2Username);
                }
            }
        }

        // End kick animation
        if (player.kickFrame >= 15) {
            player.action = 'idle';
            player.kickFrame = 0;
        }
    }
}

function handleBlock(player, blockKey) {
    // Check if trying to block
    if (gameState.keys[blockKey] && player.blockStamina > 0) {
        player.isBlocking = true;
        // Drain stamina while blocking
        player.blockStamina = Math.max(0, player.blockStamina - window.GAME_CONSTANTS.BLOCK_STAMINA_DRAIN);
    } else {
        player.isBlocking = false;
        // Regenerate stamina when not blocking
        if (player.blockStamina < window.GAME_CONSTANTS.BLOCK_STAMINA_MAX) {
            player.blockStamina = Math.min(window.GAME_CONSTANTS.BLOCK_STAMINA_MAX, player.blockStamina + window.GAME_CONSTANTS.BLOCK_STAMINA_REGEN);
        }
    }
}

function updateHealth(color) {
    if (color === 'red') {
        const percentage = (gameState.red.health / gameState.red.maxHealth) * 100;
        redHealthFill.style.width = percentage + '%';
        redHealthFill.style.background = gameState.red.color;
        let displayName;
        if (gameMode.type === 'local') {
            const colorName = getColorName(gameState.red.color);
            const charClass = CHARACTER_CLASSES[gameState.red.characterClass];
            displayName = charClass ? `${colorName} (${charClass.name.toUpperCase()})` : colorName;
        } else {
            // Multiplayer/Bot mode - show username with skin name
            const characterClass = gameState.red.characterClass || 'balanced';
            const charClass = CHARACTER_CLASSES[characterClass];
            const skinName = charClass ? charClass.name : characterClass;
            displayName = `${gameMode.player1Username}: ${skinName}`;
            // displayName already includes username and skin, so format differently
            redHealthText.textContent = `${displayName} - ${Math.round(gameState.red.health)}`;
            return;
        }
        redHealthText.textContent = `${displayName}: ${Math.round(gameState.red.health)}`;
    } else {
        const percentage = (gameState.blue.health / gameState.blue.maxHealth) * 100;
        blueHealthFill.style.width = percentage + '%';
        blueHealthFill.style.background = gameState.blue.color;
        let displayName;
        if (gameMode.type === 'local') {
            const colorName = getColorName(gameState.blue.color);
            const charClass = CHARACTER_CLASSES[gameState.blue.characterClass];
            displayName = charClass ? `${colorName} (${charClass.name.toUpperCase()})` : colorName;
        } else {
            // Multiplayer/Bot mode - show username with skin name
            const characterClass = gameState.blue.characterClass || 'balanced';
            const charClass = CHARACTER_CLASSES[characterClass];
            const skinName = charClass ? charClass.name : characterClass;
            displayName = `${gameMode.player2Username}: ${skinName}`;
            // displayName already includes username and skin, so format differently
            blueHealthText.textContent = `${displayName} - ${Math.round(gameState.blue.health)}`;
            return;
        }
        blueHealthText.textContent = `${displayName}: ${Math.round(gameState.blue.health)}`;
    }
}

function updateComboDisplay(color, combo) {
    // Get or create combo counter element
    const elementId = color === 'red' ? 'redCombo' : 'blueCombo';
    let comboElement = document.getElementById(elementId);

    if (!comboElement) {
        comboElement = document.createElement('div');
        comboElement.id = elementId;
        comboElement.className = 'comboCounter ' + color;
        gameContainer.appendChild(comboElement);
    }

    if (combo > 0) {
        comboElement.textContent = `${combo}x COMBO`;
        comboElement.style.display = 'block';
        // Add pop-in animation effect
        comboElement.style.animation = 'none';
        setTimeout(() => {
            comboElement.style.animation = 'popIn 0.3s ease-out';
        }, 10);
    } else {
        comboElement.style.display = 'none';
    }
}

function updateBlockStamina(color, stamina) {
    // Get or create stamina bar element
    const elementId = color === 'red' ? 'redStamina' : 'blueStamina';
    let staminaBar = document.getElementById(elementId);

    if (!staminaBar) {
        staminaBar = document.createElement('div');
        staminaBar.id = elementId;
        staminaBar.className = 'staminaBar ' + color;
        const staminaFill = document.createElement('div');
        staminaFill.className = 'staminaFill';
        staminaFill.id = elementId + 'Fill';
        staminaBar.appendChild(staminaFill);
        gameContainer.appendChild(staminaBar);
    }

    const staminaFill = document.getElementById(elementId + 'Fill');
    const percentage = (stamina / window.GAME_CONSTANTS.BLOCK_STAMINA_MAX) * 100;
    staminaFill.style.width = percentage + '%';

    // Change color based on stamina level
    if (stamina < 30) {
        staminaFill.style.background = '#ff4444'; // Red when low
    } else if (stamina < 60) {
        staminaFill.style.background = '#ffaa00'; // Orange when medium
    } else {
        staminaFill.style.background = '#00cc00'; // Green when full
    }
}

async function endGame(winner) {
    gameState.gameOver = true;
    // In local mode, show color name for winner
    let displayWinner = winner;
    if (gameMode.type === 'local') {
        // Determine which player won and get their color
        if (winner === gameMode.player1Username) {
            displayWinner = getColorName(gameState.red.color);
        } else if (winner === gameMode.player2Username) {
            displayWinner = getColorName(gameState.blue.color);
        }
    }
    // Fix grammar for "YOU" - use "WIN" instead of "WINS"
    const winVerb = displayWinner === 'YOU' ? 'WIN' : 'WINS';
    winnerText.textContent = `${displayWinner} ${winVerb}!`;

    // Show coins earned in bot mode when player wins
    const coinsEarnedDiv = document.getElementById('coinsEarned');
    if (gameMode.type === 'bot' && winner === gameMode.player1Username) {
        coinsEarnedDiv.textContent = '+30 Coins';
        coinsEarnedDiv.style.display = 'block';
    } else {
        coinsEarnedDiv.style.display = 'none';
    }

    gameOverDiv.style.display = 'block';

    // Notify server if multiplayer
    if (gameMode.type === 'multiplayer' && typeof notifyGameEnded === 'function') {
        notifyGameEnded();
    }

    // Award coins if bot mode and player won
    if (gameMode.type === 'bot' && winner === gameMode.player1Username && typeof awardBotWin === 'function') {
        await awardBotWin();
    }
}

function playAgain() {
    // Hide game over screen
    gameOverDiv.style.display = 'none';

    // Show character selection based on current game mode
    if (gameMode.type === 'local') {
        showCharacterSelect('local');
    } else if (gameMode.type === 'bot') {
        showCharacterSelect('bot');
    } else if (gameMode.type === 'multiplayer') {
        // Return to lobby for multiplayer
        if (typeof returnToLobby === 'function') {
            returnToLobby();
        }
    }
}

// Character selection functions
function showCharacterSelect(mode, callback) {
    characterSelection.awaitingSelection = true;
    characterSelection.selectingFor = mode;
    characterSelection.multiplayerCallback = callback || null;

    if (mode === 'local') {
        characterSelection.player1 = null;
        characterSelection.player2 = null;
        document.getElementById('characterSelectionMessage').textContent = 'Left Select';
    } else if (mode === 'bot') {
        characterSelection.player1 = null;
        characterSelection.player2 = null;
        document.getElementById('characterSelectionMessage').textContent = 'Select your fighter';
    } else if (mode === 'multiplayer') {
        characterSelection.player1 = null;
        document.getElementById('characterSelectionMessage').textContent = 'Select your fighter';
    }

    // Update character cards for multiplayer mode
    updateCharacterCardAvailability(mode);

    document.getElementById('characterSelectModal').classList.add('active');
}

function updateCharacterCardAvailability(mode) {
    const cards = document.querySelectorAll('.characterCard');

    cards.forEach(card => {
        const characterClass = card.getAttribute('data-class');

        // Remove previous locked state
        card.classList.remove('locked');
        const lockOverlay = card.querySelector('.lockOverlay');
        if (lockOverlay) lockOverlay.remove();

        if (mode === 'multiplayer' || mode === 'bot') {
            // Check if user owns this skin
            const owned = typeof ownedSkins !== 'undefined' && ownedSkins.includes(characterClass);

            if (!owned) {
                card.classList.add('locked');

                // Add lock overlay
                const overlay = document.createElement('div');
                overlay.className = 'lockOverlay';
                overlay.innerHTML = '🔒 LOCKED';
                card.appendChild(overlay);
            }
        }
    });
}

function hideCharacterSelect() {
    document.getElementById('characterSelectModal').classList.remove('active');
    characterSelection.awaitingSelection = false;

    // Clear all selections and locked states visually
    document.querySelectorAll('.characterCard').forEach(card => {
        card.classList.remove('selected');
        card.classList.remove('locked');
        const lockOverlay = card.querySelector('.lockOverlay');
        if (lockOverlay) lockOverlay.remove();
    });
}

function selectCharacter(characterClass) {
    if (!characterSelection.awaitingSelection) return;

    // In multiplayer or bot mode, check if user owns the skin
    if (characterSelection.selectingFor === 'multiplayer' || characterSelection.selectingFor === 'bot') {
        const owned = typeof ownedSkins !== 'undefined' && ownedSkins.includes(characterClass);
        if (!owned) {
            // Show message that skin is locked
            const msg = document.getElementById('characterSelectionMessage');
            msg.textContent = 'This skin is locked! Visit the shop to purchase.';
            msg.style.color = '#ff4444';
            setTimeout(() => {
                msg.textContent = 'Select your fighter';
                msg.style.color = '';
            }, 2000);
            return;
        }
    }

    if (characterSelection.selectingFor === 'local') {
        if (!characterSelection.player1) {
            characterSelection.player1 = characterClass;
            document.getElementById('characterSelectionMessage').textContent = 'Right Select';

            // Mark player 1's character as taken
            document.querySelectorAll('.characterCard').forEach(card => {
                card.classList.remove('selected');
                card.classList.remove('locked');
                const lockOverlay = card.querySelector('.lockOverlay');
                if (lockOverlay) lockOverlay.remove();

                // Lock the selected character for player 2
                if (card.getAttribute('data-class') === characterClass) {
                    card.classList.add('locked');
                    const overlay = document.createElement('div');
                    overlay.className = 'lockOverlay';
                    overlay.innerHTML = '⛔ TAKEN';
                    card.appendChild(overlay);
                }
            });
        } else if (!characterSelection.player2) {
            // Prevent selecting the same character as player 1
            if (characterClass === characterSelection.player1) {
                const msg = document.getElementById('characterSelectionMessage');
                msg.textContent = 'Character already taken! Choose a different fighter.';
                msg.style.color = '#ff4444';
                setTimeout(() => {
                    msg.textContent = 'Right Select';
                    msg.style.color = '';
                }, 2000);
                return;
            }

            characterSelection.player2 = characterClass;
            hideCharacterSelect();

            // Start local game with selected characters
            applyCharacterStats();
            setGameMode('local', null, 'RED', 'BLUE');
            resetGame();
            setPaused(false);
        }
    } else if (characterSelection.selectingFor === 'bot') {
        // Player selected their character, now pick a random different character for the bot
        characterSelection.player1 = characterClass;

        // Get all available characters from CHARACTER_CLASSES, excluding the one player selected
        const allCharacters = Object.keys(CHARACTER_CLASSES);
        const availableForBot = allCharacters.filter(c => c !== characterClass);

        // Randomly select one for the bot
        const randomIndex = Math.floor(Math.random() * availableForBot.length);
        characterSelection.player2 = availableForBot[randomIndex];

        hideCharacterSelect();

        // Start bot game with selected characters
        applyCharacterStats();
        setGameMode('bot', null, 'YOU', 'BOT');
        resetGame();
        setPaused(false);
    } else if (characterSelection.selectingFor === 'multiplayer') {
        characterSelection.player1 = characterClass;
        hideCharacterSelect();

        // Call multiplayer callback with selected character
        if (characterSelection.multiplayerCallback) {
            characterSelection.multiplayerCallback(characterClass);
        }
    }
}

function applyCharacterStats() {
    const p1Class = CHARACTER_CLASSES[characterSelection.player1] || CHARACTER_CLASSES.balanced;
    const p2Class = CHARACTER_CLASSES[characterSelection.player2] || CHARACTER_CLASSES.balanced;

    // Apply stats to game state
    gameState.red.health = p1Class.health;
    gameState.red.maxHealth = p1Class.health;
    gameState.red.characterClass = characterSelection.player1;
    gameState.red.size = p1Class.size;
    gameState.red.color = p1Class.colors.primary;

    gameState.blue.health = p2Class.health;
    gameState.blue.maxHealth = p2Class.health;
    gameState.blue.characterClass = characterSelection.player2;
    gameState.blue.size = p2Class.size;
    gameState.blue.color = p2Class.colors.primary;
}

function resetGame() {
    // Get character stats
    const p1Class = CHARACTER_CLASSES[characterSelection.player1] || CHARACTER_CLASSES.balanced;
    const p2Class = CHARACTER_CLASSES[characterSelection.player2] || CHARACTER_CLASSES.balanced;

    gameState = {
        red: {
            x: 100,
            y: 0,
            velocityY: 0,
            health: p1Class.health,
            maxHealth: p1Class.health,
            isJumping: false,
            canPunch: true,
            canKick: true,
            facing: -1,
            action: 'idle',
            actionTimer: 0,
            walkCycle: 0,
            punchFrame: 0,
            kickFrame: 0,
            limbPositions: {},
            characterClass: characterSelection.player1 || 'balanced',
            size: p1Class.size,
            color: p1Class.colors.primary
        },
        blue: {
            x: 820,
            y: 0,
            velocityY: 0,
            health: p2Class.health,
            maxHealth: p2Class.health,
            isJumping: false,
            canPunch: true,
            canKick: true,
            facing: 1,
            action: 'idle',
            actionTimer: 0,
            walkCycle: 0,
            punchFrame: 0,
            kickFrame: 0,
            limbPositions: {},
            characterClass: characterSelection.player2 || 'balanced',
            size: p2Class.size,
            color: p2Class.colors.primary
        },
        keys: {},
        gameOver: false,
        animationFrame: 0
    };

    // Reset usernames
    gameMode.player1Username = gameMode.type === 'local' ? 'RED' : gameMode.player1Username;
    gameMode.player2Username = gameMode.type === 'local' ? 'BLUE' : gameMode.player2Username;

    // Reset bot AI if in bot mode
    if (gameMode.type === 'bot') {
        botAI.decisionTimer = 0;
        botAI.currentAction = 'idle';
        botAI.attackCooldown = 0;
        botAI.jumpCooldown = 0;
        botAI.moveDirection = 0;
    }

    updateHealth('red');
    updateHealth('blue');
    gameOverDiv.style.display = 'none';

    // If multiplayer, return to lobby
    if (gameMode.type === 'multiplayer' && typeof returnToLobby === 'function') {
        returnToLobby();
    }
}

function updatePositions() {
    redFighter.style.left = gameState.red.x + 'px';
    redFighter.style.bottom = (GROUND_LEVEL + gameState.red.y) + 'px';

    blueFighter.style.left = gameState.blue.x + 'px';
    blueFighter.style.bottom = (GROUND_LEVEL + gameState.blue.y) + 'px';
}

// Bot AI system
let botAI = {
    decisionTimer: 0,
    decisionInterval: 30, // Make decision every 30 frames (~0.5 seconds)
    currentAction: 'idle',
    attackCooldown: 0,
    jumpCooldown: 0,
    moveDirection: 0 // -1 = left, 0 = idle, 1 = right
};

function updateBotAI() {
    const bot = gameState.blue;
    const player = gameState.red;

    // Don't make decisions during attacks
    if (bot.action === 'punch' || bot.action === 'kick') {
        return;
    }

    // Calculate distance to player
    const distance = Math.abs(player.x - bot.x);
    const playerDirection = player.x < bot.x ? -1 : 1;

    // Update decision timer
    botAI.decisionTimer++;
    if (botAI.attackCooldown > 0) botAI.attackCooldown--;
    if (botAI.jumpCooldown > 0) botAI.jumpCooldown--;

    // Make new decision periodically
    if (botAI.decisionTimer >= botAI.decisionInterval) {
        botAI.decisionTimer = 0;

        // Attack if in range (within 150 pixels)
        if (distance < 150 && botAI.attackCooldown === 0) {
            const attackChoice = Math.random();
            if (attackChoice < 0.4 && bot.canPunch) {
                // Punch
                gameState.keys['arrowdown'] = true;
                botAI.attackCooldown = 20;
                setTimeout(() => {
                    gameState.keys['arrowdown'] = false;
                }, 100);
            } else if (attackChoice < 0.7 && bot.canKick) {
                // Kick
                gameState.keys['shiftright'] = true;
                botAI.attackCooldown = 25;
                setTimeout(() => {
                    gameState.keys['shiftright'] = false;
                }, 100);
            }
        }

        // Movement decision
        if (distance > 200) {
            // Too far - move toward player
            botAI.moveDirection = playerDirection;
        } else if (distance < 100) {
            // Too close - move away
            botAI.moveDirection = -playerDirection;
        } else {
            // Medium range - random movement
            const moveChoice = Math.random();
            if (moveChoice < 0.4) {
                botAI.moveDirection = playerDirection; // Move toward
            } else if (moveChoice < 0.6) {
                botAI.moveDirection = -playerDirection; // Move away
            } else {
                botAI.moveDirection = 0; // Stay still
            }
        }

        // Jump decision (25% chance when on ground)
        if (!bot.isJumping && botAI.jumpCooldown === 0 && Math.random() < 0.25) {
            gameState.keys['arrowup'] = true;
            botAI.jumpCooldown = 60;
            setTimeout(() => {
                gameState.keys['arrowup'] = false;
            }, 100);
        }
    }

    // Execute movement
    gameState.keys['arrowleft'] = botAI.moveDirection === -1;
    gameState.keys['arrowright'] = botAI.moveDirection === 1;
}

function gameLoop() {
    if (gameMode.isPaused) {
        // Still draw but don't update
        drawStickFigure(redCtx, '#dc143c', gameState.red.action, gameState.red.walkCycle, gameState.red.facing, gameState.red);
        drawStickFigure(blueCtx, '#1e90ff', gameState.blue.action, gameState.blue.walkCycle, gameState.blue.facing, gameState.blue);
        requestAnimationFrame(gameLoop);
        return;
    }

    if (!gameState.gameOver) {
        if (gameMode.type === 'local') {
            // Local mode: update both players
            handleMovement(gameState.red, 'a', 'd', 'w');
            handleMovement(gameState.blue, 'arrowleft', 'arrowright', 'arrowup');

            applyGravity(gameState.red);
            applyGravity(gameState.blue);

            handleBlock(gameState.red, 'e');
            handleBlock(gameState.blue, 'e');

            handlePunch(gameState.red, gameState.blue, 's', 'red');
            handlePunch(gameState.blue, gameState.red, 'arrowdown', 'blue');

            handleKick(gameState.red, gameState.blue, 'shiftleft', 'red');
            handleKick(gameState.blue, gameState.red, 'shiftright', 'blue');

            updatePositions();
        } else if (gameMode.type === 'bot') {
            // Bot mode: player controls red, AI controls blue
            updateBotAI();

            handleMovement(gameState.red, 'a', 'd', 'w');
            handleMovement(gameState.blue, 'arrowleft', 'arrowright', 'arrowup');

            applyGravity(gameState.red);
            applyGravity(gameState.blue);

            handleBlock(gameState.red, 'e');
            handleBlock(gameState.blue, 'e');

            handlePunch(gameState.red, gameState.blue, 's', 'red');
            handlePunch(gameState.blue, gameState.red, 'arrowdown', 'blue');

            handleKick(gameState.red, gameState.blue, 'shiftleft', 'red');
            handleKick(gameState.blue, gameState.red, 'shiftright', 'blue');

            updatePositions();
        } else if (gameMode.type === 'multiplayer') {
            // Multiplayer mode: state is updated from server
            // Only update positions (server sends state)
            updatePositions();
        }
    }

    // Draw stick figures
    drawStickFigure(redCtx, gameState.red.color, gameState.red.action, gameState.red.walkCycle, gameState.red.facing, gameState.red);
    drawStickFigure(blueCtx, gameState.blue.color, gameState.blue.action, gameState.blue.walkCycle, gameState.blue.facing, gameState.blue);

    // Update UI displays (combo and stamina)
    updateComboDisplay('red', gameState.red.combo);
    updateComboDisplay('blue', gameState.blue.combo);
    updateBlockStamina('red', gameState.red.blockStamina);
    updateBlockStamina('blue', gameState.blue.blockStamina);

    gameState.animationFrame++;
    requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();

// Function to set game mode (called from multiplayer.js)
function setGameMode(mode, localPlayer, player1Username, player2Username) {
    gameMode.type = mode;
    gameMode.localPlayer = localPlayer;
    gameMode.player1Username = player1Username || 'RED';
    gameMode.player2Username = player2Username || 'BLUE';

    // Update health bar text
    updateHealth('red');
    updateHealth('blue');

    // Update control displays
    const redControls = document.getElementById('redControls');
    const blueControls = document.getElementById('blueControls');

    if (mode === 'local') {
        redControls.textContent = 'RED: A/D=Move | W=Jump | S=Punch | L-Shift=Kick | E=Block | R=Ability';
        blueControls.textContent = 'BLUE: ←/→=Move | ↑=Jump | ↓=Punch | R-Shift=Kick | E=Block | R=Ability';
    } else if (mode === 'bot') {
        redControls.textContent = 'YOU: W/A/S/D or ↑/←/↓/→=Move & Jump | S or ↓=Punch | Space=Kick | E=Block | R=Ability';
        blueControls.textContent = 'BOT (AI)';
    } else {
        redControls.textContent = player1Username;
        blueControls.textContent = player2Username;
    }
}

// Function to update game state from server (called from multiplayer.js)
function updateGameStateFromServer(serverState) {
    // Update both players from server state
    gameState.red.x = serverState.red.x;
    gameState.red.y = serverState.red.y;
    gameState.red.health = serverState.red.health;
    gameState.red.action = serverState.red.action;
    gameState.red.facing = serverState.red.facing;
    gameState.red.walkCycle = serverState.red.walkCycle;
    gameState.red.punchFrame = serverState.red.punchFrame;
    gameState.red.kickFrame = serverState.red.kickFrame;
    gameState.red.combo = serverState.red.combo;
    gameState.red.isBlocking = serverState.red.isBlocking;
    gameState.red.blockStamina = serverState.red.blockStamina;

    gameState.blue.x = serverState.blue.x;
    gameState.blue.y = serverState.blue.y;
    gameState.blue.health = serverState.blue.health;
    gameState.blue.action = serverState.blue.action;
    gameState.blue.facing = serverState.blue.facing;
    gameState.blue.walkCycle = serverState.blue.walkCycle;
    gameState.blue.punchFrame = serverState.blue.punchFrame;
    gameState.blue.kickFrame = serverState.blue.kickFrame;
    gameState.blue.combo = serverState.blue.combo;
    gameState.blue.isBlocking = serverState.blue.isBlocking;
    gameState.blue.blockStamina = serverState.blue.blockStamina;

    // Update health displays
    updateHealth('red');
    updateHealth('blue');
}

// Function to pause/resume game
function setPaused(paused) {
    gameMode.isPaused = paused;
}

// Start the game loop
gameLoop();
