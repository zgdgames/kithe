const constants = require('../shared/constants');

class GameRoom {
    constructor(roomId, player1, player2, io) {
        this.roomId = roomId;
        this.io = io;

        // Get character classes
        const p1Class = constants.CHARACTER_CLASSES[player1.characterClass] || constants.CHARACTER_CLASSES.balanced;
        const p2Class = constants.CHARACTER_CLASSES[player2.characterClass] || constants.CHARACTER_CLASSES.balanced;

        // Player info
        this.players = {
            [player1.sessionId]: {
                sessionId: player1.sessionId,
                username: player1.username,
                socketId: player1.socketId,
                color: 'red',
                characterClass: player1.characterClass || 'balanced',
                inputs: new Set()
            },
            [player2.sessionId]: {
                sessionId: player2.sessionId,
                username: player2.username,
                socketId: player2.socketId,
                color: 'blue',
                characterClass: player2.characterClass || 'balanced',
                inputs: new Set()
            }
        };

        // Game state with character-specific stats
        this.gameState = {
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
                walkCycle: 0,
                punchFrame: 0,
                kickFrame: 0,
                hasHitWithPunch: false,
                hasHitWithKick: false,
                characterClass: player1.characterClass || 'balanced',
                // Combo system
                combo: 0,
                // Block mechanic
                isBlocking: false,
                blockStamina: 100
            },
            blue: {
                x: 780,
                y: 0,
                velocityY: 0,
                health: p2Class.health,
                maxHealth: p2Class.health,
                isJumping: false,
                canPunch: true,
                canKick: true,
                facing: 1,
                action: 'idle',
                walkCycle: 0,
                punchFrame: 0,
                kickFrame: 0,
                hasHitWithPunch: false,
                hasHitWithKick: false,
                characterClass: player2.characterClass || 'balanced',
                // Combo system
                combo: 0,
                // Block mechanic
                isBlocking: false,
                blockStamina: 100
            }
        };

        this.gameLoopInterval = null;
        this.gameOver = false;
        this.winner = null;

        // Cooldown timers
        this.cooldowns = {
            red: { punch: 0, kick: 0 },
            blue: { punch: 0, kick: 0 }
        };

        // Combo tracking
        this.comboTimers = {
            red: null,
            blue: null
        };
        this.maxCombos = {
            red: 0,
            blue: 0
        };
    }

    start() {
        console.log(`Game room ${this.roomId} started`);
        this.gameLoopInterval = setInterval(() => {
            this.update();
        }, 1000 / 60); // 60 FPS
    }

    stop() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        console.log(`Game room ${this.roomId} stopped`);
    }

    handleInput(sessionId, key, action) {
        const player = this.players[sessionId];
        if (!player) return;

        if (action === 'keydown') {
            player.inputs.add(key);
        } else if (action === 'keyup') {
            player.inputs.delete(key);
        }
    }

    update() {
        if (this.gameOver) return;

        // Update cooldowns
        const deltaTime = 1000 / 60;
        for (const color of ['red', 'blue']) {
            if (this.cooldowns[color].punch > 0) {
                this.cooldowns[color].punch -= deltaTime;
                if (this.cooldowns[color].punch <= 0) {
                    this.gameState[color].canPunch = true;
                }
            }
            if (this.cooldowns[color].kick > 0) {
                this.cooldowns[color].kick -= deltaTime;
                if (this.cooldowns[color].kick <= 0) {
                    this.gameState[color].canKick = true;
                }
            }
        }

        // Process each player's inputs
        for (const [sessionId, player] of Object.entries(this.players)) {
            const playerState = this.gameState[player.color];
            const inputs = player.inputs;

            // Movement
            this.handleMovement(playerState, inputs);

            // Attacks
            this.handleAttacks(playerState, inputs, player.color);

            // Blocking
            this.handleBlocking(playerState, inputs);

            // Apply physics
            this.applyGravity(playerState);
        }

        // Check collisions
        this.checkCollisions();

        // Broadcast game state
        this.broadcastState();
    }

    handleMovement(playerState, inputs) {
        let isMoving = false;

        // Get character-specific stats
        const charClass = constants.CHARACTER_CLASSES[playerState.characterClass] || constants.CHARACTER_CLASSES.balanced;

        // Don't allow movement during attacks
        if (playerState.action !== 'punch' && playerState.action !== 'kick') {
            if (inputs.has('arrowleft')) {
                playerState.x -= charClass.moveSpeed;
                playerState.facing = 1;
                if (playerState.x < 0) playerState.x = 0;
                isMoving = true;
            }
            if (inputs.has('arrowright')) {
                playerState.x += charClass.moveSpeed;
                playerState.facing = -1;
                if (playerState.x > 880) playerState.x = 880;
                isMoving = true;
            }
        }

        // Jump
        if (inputs.has('arrowup') && !playerState.isJumping &&
            playerState.action !== 'punch' && playerState.action !== 'kick') {
            playerState.velocityY = charClass.jumpStrength;
            playerState.isJumping = true;
            playerState.action = 'jump';
        }

        // Update animations
        if (isMoving && !playerState.isJumping &&
            playerState.action !== 'punch' && playerState.action !== 'kick') {
            playerState.action = 'walk';
            playerState.walkCycle += 0.15;
        } else if (!isMoving && !playerState.isJumping && playerState.action === 'walk') {
            playerState.action = 'idle';
        }

        // Always update idle animation
        if (playerState.action === 'idle') {
            playerState.walkCycle += 0.03;
        }
    }

    handleAttacks(playerState, inputs, color) {
        // Get character-specific stats
        const charClass = constants.CHARACTER_CLASSES[playerState.characterClass] || constants.CHARACTER_CLASSES.balanced;

        // Punch (space key)
        if (inputs.has(' ') && playerState.canPunch &&
            playerState.action !== 'punch' && playerState.action !== 'kick') {
            playerState.canPunch = false;
            playerState.action = 'punch';
            playerState.punchFrame = 0;
            playerState.hasHitWithPunch = false;
            this.cooldowns[color].punch = charClass.punchCooldown;
        }

        // Kick (shift key)
        if (inputs.has('shift') && playerState.canKick &&
            playerState.action !== 'punch' && playerState.action !== 'kick') {
            playerState.canKick = false;
            playerState.action = 'kick';
            playerState.kickFrame = 0;
            playerState.hasHitWithKick = false;
            this.cooldowns[color].kick = charClass.kickCooldown;
        }

        // Update punch animation
        if (playerState.action === 'punch') {
            playerState.punchFrame++;
            if (playerState.punchFrame >= 12) {
                playerState.action = 'idle';
                playerState.punchFrame = 0;
            }
        }

        // Update kick animation
        if (playerState.action === 'kick') {
            playerState.kickFrame++;
            if (playerState.kickFrame >= 15) {
                playerState.action = 'idle';
                playerState.kickFrame = 0;
            }
        }
    }

    handleBlocking(playerState, inputs) {
        const { BLOCK_STAMINA_MAX, BLOCK_STAMINA_DRAIN, BLOCK_STAMINA_REGEN } = constants;

        // Check if trying to block with 'e' key
        if (inputs.has('e') && playerState.blockStamina > 0) {
            playerState.isBlocking = true;
            // Drain stamina while blocking
            playerState.blockStamina = Math.max(0, playerState.blockStamina - BLOCK_STAMINA_DRAIN);
        } else {
            playerState.isBlocking = false;
            // Regenerate stamina when not blocking
            if (playerState.blockStamina < BLOCK_STAMINA_MAX) {
                playerState.blockStamina = Math.min(BLOCK_STAMINA_MAX, playerState.blockStamina + BLOCK_STAMINA_REGEN);
            }
        }
    }

    applyGravity(playerState) {
        playerState.velocityY -= constants.GRAVITY;
        playerState.y += playerState.velocityY;

        if (playerState.y <= 0) {
            playerState.y = 0;
            playerState.velocityY = 0;
            playerState.isJumping = false;
            if (playerState.action === 'jump') {
                playerState.action = 'idle';
            }
        }
    }

    checkCollisions() {
        const red = this.gameState.red;
        const blue = this.gameState.blue;

        // Get character-specific damage
        const redClass = constants.CHARACTER_CLASSES[red.characterClass] || constants.CHARACTER_CLASSES.balanced;
        const blueClass = constants.CHARACTER_CLASSES[blue.characterClass] || constants.CHARACTER_CLASSES.balanced;

        // Check red's punch hitting blue
        if (red.action === 'punch' && red.punchFrame >= 4 && red.punchFrame <= 8 && !red.hasHitWithPunch) {
            if (this.checkHit(red, blue)) {
                // Calculate combo multiplier
                const comboMultiplier = Math.min(1 + red.combo * constants.COMBO_DAMAGE_BONUS, constants.MAX_COMBO_MULTIPLIER);
                let damage = redClass.punchDamage * comboMultiplier;

                // Apply block damage reduction if opponent is blocking
                if (blue.isBlocking) {
                    damage *= (1 - constants.BLOCK_DAMAGE_REDUCTION);
                }

                blue.health -= damage;
                if (blue.health < 0) blue.health = 0;
                red.hasHitWithPunch = true;

                // Increment combo on hit
                red.combo++;
                if (red.combo > this.maxCombos.red) {
                    this.maxCombos.red = red.combo;
                }

                // Clear opponent's combo
                blue.combo = 0;
                if (this.comboTimers.red) {
                    clearTimeout(this.comboTimers.red);
                }
                // Set combo timeout
                this.comboTimers.red = setTimeout(() => {
                    red.combo = 0;
                }, constants.COMBO_WINDOW);

                if (blue.health <= 0 && !this.gameOver) {
                    this.endGame('red');
                }
            }
        }

        // Check red's kick hitting blue
        if (red.action === 'kick' && red.kickFrame >= 5 && red.kickFrame <= 10 && !red.hasHitWithKick) {
            if (this.checkHit(red, blue)) {
                // Calculate combo multiplier
                const comboMultiplier = Math.min(1 + red.combo * constants.COMBO_DAMAGE_BONUS, constants.MAX_COMBO_MULTIPLIER);
                let damage = redClass.kickDamage * comboMultiplier;

                // Apply block damage reduction if opponent is blocking
                if (blue.isBlocking) {
                    damage *= (1 - constants.BLOCK_DAMAGE_REDUCTION);
                }

                blue.health -= damage;
                if (blue.health < 0) blue.health = 0;
                red.hasHitWithKick = true;

                // Increment combo on hit
                red.combo++;
                if (red.combo > this.maxCombos.red) {
                    this.maxCombos.red = red.combo;
                }

                // Clear opponent's combo
                blue.combo = 0;
                if (this.comboTimers.red) {
                    clearTimeout(this.comboTimers.red);
                }
                // Set combo timeout
                this.comboTimers.red = setTimeout(() => {
                    red.combo = 0;
                }, constants.COMBO_WINDOW);

                if (blue.health <= 0 && !this.gameOver) {
                    this.endGame('red');
                }
            }
        }

        // Check blue's punch hitting red
        if (blue.action === 'punch' && blue.punchFrame >= 4 && blue.punchFrame <= 8 && !blue.hasHitWithPunch) {
            if (this.checkHit(blue, red)) {
                // Calculate combo multiplier
                const comboMultiplier = Math.min(1 + blue.combo * constants.COMBO_DAMAGE_BONUS, constants.MAX_COMBO_MULTIPLIER);
                let damage = blueClass.punchDamage * comboMultiplier;

                // Apply block damage reduction if opponent is blocking
                if (red.isBlocking) {
                    damage *= (1 - constants.BLOCK_DAMAGE_REDUCTION);
                }

                red.health -= damage;
                if (red.health < 0) red.health = 0;
                blue.hasHitWithPunch = true;

                // Increment combo on hit
                blue.combo++;
                if (blue.combo > this.maxCombos.blue) {
                    this.maxCombos.blue = blue.combo;
                }

                // Clear opponent's combo
                red.combo = 0;
                if (this.comboTimers.blue) {
                    clearTimeout(this.comboTimers.blue);
                }
                // Set combo timeout
                this.comboTimers.blue = setTimeout(() => {
                    blue.combo = 0;
                }, constants.COMBO_WINDOW);

                if (red.health <= 0 && !this.gameOver) {
                    this.endGame('blue');
                }
            }
        }

        // Check blue's kick hitting red
        if (blue.action === 'kick' && blue.kickFrame >= 5 && blue.kickFrame <= 10 && !blue.hasHitWithKick) {
            if (this.checkHit(blue, red)) {
                // Calculate combo multiplier
                const comboMultiplier = Math.min(1 + blue.combo * constants.COMBO_DAMAGE_BONUS, constants.MAX_COMBO_MULTIPLIER);
                let damage = blueClass.kickDamage * comboMultiplier;

                // Apply block damage reduction if opponent is blocking
                if (red.isBlocking) {
                    damage *= (1 - constants.BLOCK_DAMAGE_REDUCTION);
                }

                red.health -= damage;
                if (red.health < 0) red.health = 0;
                blue.hasHitWithKick = true;

                // Increment combo on hit
                blue.combo++;
                if (blue.combo > this.maxCombos.blue) {
                    this.maxCombos.blue = blue.combo;
                }

                // Clear opponent's combo
                red.combo = 0;
                if (this.comboTimers.blue) {
                    clearTimeout(this.comboTimers.blue);
                }
                // Set combo timeout
                this.comboTimers.blue = setTimeout(() => {
                    blue.combo = 0;
                }, constants.COMBO_WINDOW);

                if (red.health <= 0 && !this.gameOver) {
                    this.endGame('blue');
                }
            }
        }
    }

    checkHit(attacker, target) {
        // Simple bounding box collision detection
        const attackerRect = {
            left: attacker.x,
            right: attacker.x + 120,
            top: constants.GROUND_LEVEL + attacker.y,
            bottom: constants.GROUND_LEVEL + attacker.y + 180
        };

        const targetRect = {
            left: target.x,
            right: target.x + 120,
            top: constants.GROUND_LEVEL + target.y,
            bottom: constants.GROUND_LEVEL + target.y + 180
        };

        // Check if facing each other and close enough
        const distance = Math.abs(attacker.x - target.x);
        const maxRange = 150; // Attack range

        if (distance > maxRange) return false;

        // Simple collision check
        return !(attackerRect.right < targetRect.left ||
                attackerRect.left > targetRect.right ||
                attackerRect.bottom < targetRect.top ||
                attackerRect.top > targetRect.bottom);
    }

    broadcastState() {
        const state = {
            red: {
                x: this.gameState.red.x,
                y: this.gameState.red.y,
                health: this.gameState.red.health,
                action: this.gameState.red.action,
                facing: this.gameState.red.facing,
                walkCycle: this.gameState.red.walkCycle,
                punchFrame: this.gameState.red.punchFrame,
                kickFrame: this.gameState.red.kickFrame,
                combo: this.gameState.red.combo,
                isBlocking: this.gameState.red.isBlocking,
                blockStamina: this.gameState.red.blockStamina
            },
            blue: {
                x: this.gameState.blue.x,
                y: this.gameState.blue.y,
                health: this.gameState.blue.health,
                action: this.gameState.blue.action,
                facing: this.gameState.blue.facing,
                walkCycle: this.gameState.blue.walkCycle,
                punchFrame: this.gameState.blue.punchFrame,
                kickFrame: this.gameState.blue.kickFrame,
                combo: this.gameState.blue.combo,
                isBlocking: this.gameState.blue.isBlocking,
                blockStamina: this.gameState.blue.blockStamina
            },
            serverTime: Date.now()
        };

        // Send to both players
        for (const player of Object.values(this.players)) {
            this.io.to(player.socketId).emit('game:state', state);
        }
    }

    endGame(winnerColor) {
        this.gameOver = true;
        this.winner = winnerColor;

        // Find winner and loser
        let winnerPlayer = null;
        let loserPlayer = null;

        for (const player of Object.values(this.players)) {
            if (player.color === winnerColor) {
                winnerPlayer = player;
            } else {
                loserPlayer = player;
            }
        }

        // Broadcast game end with combo data
        this.io.to(this.roomId).emit('game:end', {
            winner: winnerPlayer.username,
            winnerColor: winnerColor,
            maxCombos: this.maxCombos
        });

        // Stop game loop
        this.stop();

        console.log(`Game ${this.roomId} ended. Winner: ${winnerPlayer.username}`);
    }

    handlePlayerDisconnect(sessionId) {
        const disconnectedPlayer = this.players[sessionId];
        if (!disconnectedPlayer) return null;

        // Find the other player
        let otherPlayer = null;
        for (const [sid, player] of Object.entries(this.players)) {
            if (sid !== sessionId) {
                otherPlayer = player;
                break;
            }
        }

        if (otherPlayer) {
            // Notify other player
            this.io.to(otherPlayer.socketId).emit('game:opponent_disconnected');

            // Set winner to the remaining player
            this.endGame(otherPlayer.color);

            return {
                winnerId: otherPlayer.sessionId,
                loserId: disconnectedPlayer.sessionId
            };
        }

        this.stop();
        return null;
    }

    getPlayerSessionIds() {
        return Object.keys(this.players);
    }
}

module.exports = GameRoom;
