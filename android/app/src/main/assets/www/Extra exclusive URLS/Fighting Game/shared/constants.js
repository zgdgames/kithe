// Game physics constants
const GROUND_LEVEL = 100;
const GRAVITY = 0.8;
const JUMP_STRENGTH = 15;
const MOVE_SPEED = 2.5;

// Attack constants
const PUNCH_DAMAGE = 5;
const PUNCH_DURATION = 200;
const PUNCH_COOLDOWN = 500;
const KICK_DAMAGE = 7;
const KICK_DURATION = 250;
const KICK_COOLDOWN = 600;

// Combo system constants
const COMBO_WINDOW = 2000; // Time in ms to keep combo alive (2 seconds)
const COMBO_DAMAGE_BONUS = 0.20; // 20% bonus per combo hit
const MAX_COMBO_MULTIPLIER = 2.0; // Max 2x damage at high combos

// Block mechanic constants
const BLOCK_DAMAGE_REDUCTION = 0.5; // 50% damage reduction when blocking
const BLOCK_STAMINA_MAX = 100; // Max stamina
const BLOCK_STAMINA_DRAIN = 1.5; // Stamina drained per frame while blocking
const BLOCK_STAMINA_REGEN = 0.8; // Stamina regenerated per frame when not blocking

// Ability system constants
const ABILITY_ENERGY_MAX = 100; // Max energy for abilities
const ABILITY_ENERGY_PER_HIT = 10; // Energy gained per successful hit
const ABILITY_COOLDOWN = 10000; // Cooldown in ms (10 seconds)
const ABILITY_DURATION = 3000; // Duration of ability effect in ms (3 seconds)

// Tier and pricing structure (F-TIER worst to S-TIER best)
const SKIN_TIERS = {
    // F-TIER (Worst)
    'F': { price: 0, characters: ['balanced'] },
    // D-TIER
    'D': { price: 50, characters: ['crimsonDemon', 'speedster'] },
    // C-TIER
    'C': { price: 90, characters: ['agileNinja', 'thunderMonk', 'shadowAssassin'] },
    // B-TIER
    'B': { price: 130, characters: ['flameStriker', 'sakuraWarrior', 'arcticFox'] },
    // A-TIER
    'A': { price: 170, characters: ['iceKnight', 'mysticWarrior'] },
    // S-TIER (Best)
    'S': { price: 200, characters: ['brawler', 'heavyTanker', 'stoneGuardian'] }
};

// Generate skin prices from tier structure
const SKIN_PRICES = {};
Object.keys(SKIN_TIERS).forEach((tier, tierIndex) => {
    const tierData = SKIN_TIERS[tier];
    tierData.characters.forEach((character, charIndex) => {
        // Characters within same tier have incremental prices
        SKIN_PRICES[character] = character === 'balanced' ? 0 : tierData.price + (charIndex * 10);
    });
});

// Character classes (ordered by tier: F, D, C, B, A, S)
const CHARACTER_CLASSES = {
    // F-TIER (Worst)
    balanced: {
        name: 'Normal',
        description: 'Well-rounded fighter',
        tier: 'F',
        health: 100,
        moveSpeed: 2.5,
        jumpStrength: 15,
        punchDamage: 5,
        kickDamage: 7,
        punchCooldown: 500,
        kickCooldown: 600,
        size: 1.0,
        colors: {
            primary: '#9370db',
            secondary: '#ba55d3'
        },
        ability: {
            name: 'Counter Stance',
            type: 'reflect',
            description: 'Reflect 1.5x damage for 3 seconds',
            energyCost: 100,
            cooldown: 10000,
            duration: 3000,
            reflectMultiplier: 1.5
        }
    },
    // D-TIER
    crimsonDemon: {
        name: 'Crimson Demon',
        description: 'Extreme damage, very low health',
        tier: 'D',
        health: 70,
        moveSpeed: 2.4,
        jumpStrength: 14,
        punchDamage: 12,
        kickDamage: 15,
        punchCooldown: 550,
        kickCooldown: 650,
        size: 1.05,
        colors: {
            primary: '#8b0000',
            secondary: '#b22222'
        },
        ability: {
            name: 'Blood Sacrifice',
            type: 'buff',
            description: '-20 HP, 2x damage for 5 seconds',
            energyCost: 100,
            cooldown: 10000,
            duration: 5000,
            healthCost: 20,
            damageMultiplier: 2.0
        }
    },
    speedster: {
        name: 'Speedster',
        description: 'Fast, low damage, fragile',
        tier: 'D',
        health: 80,
        moveSpeed: 3.5,
        jumpStrength: 18,
        punchDamage: 3,
        kickDamage: 5,
        punchCooldown: 350,
        kickCooldown: 400,
        size: 0.9,
        colors: {
            primary: '#1e90ff',
            secondary: '#00bfff'
        },
        ability: {
            name: 'Lightning Dash',
            type: 'mobility',
            description: '200px dash, invulnerable',
            energyCost: 100,
            cooldown: 10000,
            duration: 1000,
            dashDistance: 200
        }
    },
    // C-TIER
    agileNinja: {
        name: 'Agile Ninja',
        description: 'Fast and stealthy, balanced damage',
        tier: 'C',
        health: 90,
        moveSpeed: 3.0,
        jumpStrength: 16,
        punchDamage: 4,
        kickDamage: 6,
        punchCooldown: 400,
        kickCooldown: 500,
        size: 0.95,
        colors: {
            primary: '#000000',
            secondary: '#1a1a1a'
        },
        ability: {
            name: 'Shadow Clone',
            type: 'mobility',
            description: 'Teleport behind opponent',
            energyCost: 100,
            cooldown: 10000,
            duration: 500
        }
    },
    thunderMonk: {
        name: 'Thunder Monk',
        description: 'Electric energy, lightning-fast attacks',
        tier: 'C',
        health: 88,
        moveSpeed: 3.3,
        jumpStrength: 16,
        punchDamage: 4,
        kickDamage: 6,
        punchCooldown: 350,
        kickCooldown: 450,
        size: 0.93,
        colors: {
            primary: 'Yellow',
            secondary: '#fff44f'
        },
        ability: {
            name: 'Thunder Strike',
            type: 'attack',
            description: '35 damage + 1s stun',
            energyCost: 100,
            cooldown: 10000,
            duration: 1000,
            damage: 35,
            stunDuration: 1000
        }
    },
    shadowAssassin: {
        name: 'Shadow Assassin',
        description: 'Mysterious glass cannon with high critical damage',
        tier: 'C',
        health: 75,
        moveSpeed: 3.2,
        jumpStrength: 17,
        punchDamage: 10,
        kickDamage: 13,
        punchCooldown: 420,
        kickCooldown: 520,
        size: 0.95,
        colors: {
            primary: 'Purple',
            secondary: '#6a0dad'
        },
        ability: {
            name: 'Assassinate',
            type: 'attack',
            description: '50 damage critical strike',
            energyCost: 100,
            cooldown: 10000,
            duration: 500,
            damage: 50
        }
    },
    // B-TIER
    flameStriker: {
        name: 'Flame Striker',
        description: 'Fire-based fighter, aggressive but fragile',
        tier: 'B',
        health: 85,
        moveSpeed: 2.8,
        jumpStrength: 15,
        punchDamage: 9,
        kickDamage: 12,
        punchCooldown: 480,
        kickCooldown: 580,
        size: 1.0,
        colors: {
            primary: 'Orange',
            secondary: '#ff9933'
        },
        ability: {
            name: 'Flame Burst',
            type: 'attack',
            description: '30 damage ranged attack',
            energyCost: 100,
            cooldown: 10000,
            duration: 500,
            damage: 30,
            range: 200
        }
    },
    sakuraWarrior: {
        name: 'Sakura Warrior',
        description: 'Elegant, technique-focused fighter',
        tier: 'B',
        health: 95,
        moveSpeed: 2.6,
        jumpStrength: 15,
        punchDamage: 6,
        kickDamage: 8,
        punchCooldown: 450,
        kickCooldown: 550,
        size: 0.98,
        colors: {
            primary: 'Pink',
            secondary: '#ffb6c1'
        },
        ability: {
            name: 'Cherry Blossom Dance',
            type: 'buff',
            description: '50% attack speed for 4 seconds',
            energyCost: 100,
            cooldown: 10000,
            duration: 4000,
            speedMultiplier: 0.5
        }
    },
    arcticFox: {
        name: 'Arctic Fox',
        description: 'Pure, agile fighter with high evasion',
        tier: 'B',
        health: 92,
        moveSpeed: 3.1,
        jumpStrength: 17,
        punchDamage: 5,
        kickDamage: 7,
        punchCooldown: 430,
        kickCooldown: 530,
        size: 0.92,
        colors: {
            primary: 'White',
            secondary: '#e6f2ff'
        },
        ability: {
            name: 'Ice Shield',
            type: 'defense',
            description: 'Block next 2 attacks',
            energyCost: 100,
            cooldown: 10000,
            duration: 10000,
            immuneAttacks: 2
        }
    },
    // A-TIER
    iceKnight: {
        name: 'Ice Knight',
        description: 'Cold, calculated fighter',
        tier: 'A',
        health: 120,
        moveSpeed: 2.0,
        jumpStrength: 14,
        punchDamage: 6,
        kickDamage: 8,
        punchCooldown: 550,
        kickCooldown: 650,
        size: 1.1,
        colors: {
            primary: 'Teal',
            secondary: '#7fffd4'
        },
        ability: {
            name: 'Frost Nova',
            type: 'debuff',
            description: 'Slow opponent 50% for 3 seconds',
            energyCost: 100,
            cooldown: 10000,
            duration: 3000,
            slowAmount: 0.5
        }
    },
    mysticWarrior: {
        name: 'Mystic Warrior',
        description: 'Energetic warrior with mystical power',
        tier: 'A',
        health: 110,
        moveSpeed: 2.7,
        jumpStrength: 16,
        punchDamage: 7,
        kickDamage: 10,
        punchCooldown: 450,
        kickCooldown: 550,
        size: 1.0,
        colors: {
            primary: '#ffd700',
            secondary: '#ffed4e'
        },
        ability: {
            name: 'Mystic Barrier',
            type: 'heal',
            description: 'Restore 30 HP',
            energyCost: 100,
            cooldown: 10000,
            duration: 500,
            healAmount: 30
        }
    },
    // S-TIER (Best)
    brawler: {
        name: 'Brawler',
        description: 'High damage, slow, tanky',
        tier: 'S',
        health: 130,
        moveSpeed: 2.0,
        jumpStrength: 13,
        punchDamage: 8,
        kickDamage: 11,
        punchCooldown: 600,
        kickCooldown: 700,
        size: 1.15,
        colors: {
            primary: '#dc143c',
            secondary: '#ff4500'
        },
        ability: {
            name: 'Berserker Rage',
            type: 'buff',
            description: '2x damage for 3 seconds',
            energyCost: 100,
            cooldown: 10000,
            duration: 3000,
            damageMultiplier: 2.0
        }
    },
    heavyTanker: {
        name: 'Heavy Tanker',
        description: 'Ultra tanky, very slow, devastating damage',
        tier: 'S',
        health: 150,
        moveSpeed: 1.5,
        jumpStrength: 12,
        punchDamage: 10,
        kickDamage: 13,
        punchCooldown: 700,
        kickCooldown: 800,
        size: 1.25,
        colors: {
            primary: '#2ecc71',
            secondary: '#27ae60'
        },
        ability: {
            name: 'Iron Wall',
            type: 'defense',
            description: '80% damage reduction for 4 seconds',
            energyCost: 100,
            cooldown: 10000,
            duration: 4000,
            damageReduction: 0.8
        }
    },
    stoneGuardian: {
        name: 'Stone Guardian',
        description: 'Earth-based defender with highest health',
        tier: 'S',
        health: 160,
        moveSpeed: 1.3,
        jumpStrength: 11,
        punchDamage: 8,
        kickDamage: 11,
        punchCooldown: 750,
        kickCooldown: 850,
        size: 1.3,
        colors: {
            primary: '#696969',
            secondary: '#a9a9a9'
        },
        ability: {
            name: 'Earthquake',
            type: 'attack',
            description: '25 damage + knockback',
            energyCost: 100,
            cooldown: 10000,
            duration: 500,
            damage: 25,
            knockback: 100
        }
    }
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    // Node.js export
    module.exports = {
        GROUND_LEVEL,
        GRAVITY,
        JUMP_STRENGTH,
        MOVE_SPEED,
        PUNCH_DAMAGE,
        PUNCH_DURATION,
        PUNCH_COOLDOWN,
        KICK_DAMAGE,
        KICK_DURATION,
        KICK_COOLDOWN,
        COMBO_WINDOW,
        COMBO_DAMAGE_BONUS,
        MAX_COMBO_MULTIPLIER,
        BLOCK_DAMAGE_REDUCTION,
        BLOCK_STAMINA_MAX,
        BLOCK_STAMINA_DRAIN,
        BLOCK_STAMINA_REGEN,
        ABILITY_ENERGY_MAX,
        ABILITY_ENERGY_PER_HIT,
        ABILITY_COOLDOWN,
        ABILITY_DURATION,
        SKIN_TIERS,
        SKIN_PRICES,
        CHARACTER_CLASSES
    };
} else {
    // Browser export - make constants available globally
    window.GAME_CONSTANTS = {
        GROUND_LEVEL,
        GRAVITY,
        JUMP_STRENGTH,
        MOVE_SPEED,
        PUNCH_DAMAGE,
        PUNCH_DURATION,
        PUNCH_COOLDOWN,
        KICK_DAMAGE,
        KICK_DURATION,
        KICK_COOLDOWN,
        COMBO_WINDOW,
        COMBO_DAMAGE_BONUS,
        MAX_COMBO_MULTIPLIER,
        BLOCK_DAMAGE_REDUCTION,
        BLOCK_STAMINA_MAX,
        BLOCK_STAMINA_REGEN,
        BLOCK_STAMINA_DRAIN,
        ABILITY_ENERGY_MAX,
        ABILITY_ENERGY_PER_HIT,
        ABILITY_COOLDOWN,
        ABILITY_DURATION
    };
    window.CHARACTER_CLASSES = CHARACTER_CLASSES;
    window.SKIN_TIERS = SKIN_TIERS;
    window.SKIN_PRICES = SKIN_PRICES;
}
