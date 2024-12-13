import * as readline from 'readline';
import ANSI from "./ANSI.mjs";
import KeyBoardManager from "./keyboardManager.mjs";
import "./prototypes.mjs";
import { level1, level2, } from "./levels.mjs";

// Create the readline interface globally
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Constants
const FPS = 250;
const EMPTY_TILE = " ";
const HERO_TILE = "H";
const LOOT_TILE = "$";
const BAD_GUY_TILE = "B";
const DOOR_TILE = "D";
const HEALTH_PICKUP = "❤️";
const HP_MAX = 10;
const MAX_ATTACK = 2;
const UPDATE_INTERVAL = 1000 / 60;
const EVENT_TEXT_DURATION = 3000;
const SPLASH_SCREEN_DURATION = 2000;

// Game data
const THINGS = [LOOT_TILE, EMPTY_TILE, HEALTH_PICKUP];
const BAD_THINGS = [BAD_GUY_TILE];
const POSSIBLE_PICKUPS = [
    { name: "Sword", attribute: "attack", value: 5 },
    { name: "Spear", attribute: "attack", value: 3 },
];
const PALLET = {
    "█": ANSI.COLOR.LIGHT_GRAY,
    "H": ANSI.COLOR.RED,
    "$": ANSI.COLOR.YELLOW,
    "B": ANSI.COLOR.GREEN,
    "❤️": ANSI.COLOR.RED,
};

let rawLevel = level1;
let level = parseLevel(rawLevel);
let playerPos = { row: null, col: null };
let playerStats = { hp: HP_MAX, chash: 0, attack: 1.1 };
let eventText = "";
let eventTextTimer = 0;
let isDirty = true;
let npcs = [];
let lastUpdate = Date.now();
let gl;
let heartsCollected = {}; // Keep track of collected hearts


// Functions
function parseLevel(rawLevel) {
    const rows = rawLevel.split("\n");
    return rows.map((row) => row.split(""));
}

function update() {
    if (playerPos.row === null) {
        initializePlayerPosition();
        initializeNPCs();
    }

    let drow = 0;
    let dcol = 0;

    if (KeyBoardManager.isUpPressed()) drow = -1;
    else if (KeyBoardManager.isDownPressed()) drow = 1;

    if (KeyBoardManager.isLeftPressed()) dcol = -1;
    else if (KeyBoardManager.isRightPressed()) dcol = 1;

    const targetRow = playerPos.row + drow;
    const targetCol = playerPos.col + dcol;

    const targetTile = level[targetRow][targetCol];

    // Collision detection BEFORE movement
    if (targetTile === "█") { // Check for wall collision
        return; // Don't move if it's a wall
    }

    // Handle health pickup before moving
    if (targetTile === HEALTH_PICKUP) {
        const heartKey = `${targetRow}-${targetCol}`;
        if (!heartsCollected[heartKey]) { // Check if heart has already been collected
            handleHealthPickup(targetRow, targetCol);
            heartsCollected[heartKey] = true; // Mark this heart as collected
        }
    } else if (THINGS.includes(targetTile)) {
        handlePickup(targetTile, targetRow, targetCol);
    } else if (BAD_THINGS.includes(targetTile)) {
        handleEnemyEncounter(targetRow, targetCol);
    } else if (targetTile === DOOR_TILE) {
        handleDoor();
        return; //Added to prevent further execution after level change
    }

    if (playerStats.hp <= 0) {
        handlePlayerDeath();
    }

    //Move the player ONLY if there is no collision
    if (drow !== 0 || dcol !== 0) {
        level[playerPos.row][playerPos.col] = EMPTY_TILE;
        level[targetRow][targetCol] = HERO_TILE;
        playerPos.row = targetRow;
        playerPos.col = targetCol;
        isDirty = true;
    }
}

function initializePlayerPosition() {
    for (let row = 0; row < level.length; row++) {
        for (let col = 0; col < level[row].length; col++) {
            if (level[row][col] === HERO_TILE) {
                playerPos.row = row;
                playerPos.col = col;
                return;
            }
        }
    }
}

function initializeNPCs() {
    for (let row = 0; row < level.length; row++) {
        for (let col = 0; col < level[row].length; col++) {
            if (BAD_THINGS.includes(level[row][col])) {
                const hp = Math.round(Math.random() * 6) + 4;
                const attack = 0.7 + Math.random();
                npcs.push({ hp, attack, row, col });
            }
        }
    }
}

function handlePickup(item, targetRow, targetCol) {
    level[playerPos.row][playerPos.col] = EMPTY_TILE;
    level[targetRow][targetCol] = HERO_TILE;
    playerPos.row = targetRow;
    playerPos.col = targetCol;

    if (item === LOOT_TILE) {
        handleLoot();
    }
}

function handleLoot() {
    if (Math.random() < 0.95) {
        const loot = Number.randomBetween(3, 7);
        playerStats.chash += loot;
        eventText = `Player gained ${loot}`;
        eventTextTimer = EVENT_TEXT_DURATION;
    } else {
        const item = POSSIBLE_PICKUPS.random();
        playerStats.attack += item.value;
        eventText = `Player found a ${item.name}, ${item.attribute} is changed by ${item.value}`;
        eventTextTimer = EVENT_TEXT_DURATION;
    }
}

function handleEnemyEncounter(targetRow, targetCol) {
    const enemy = findEnemy(targetRow, targetCol);
    if (!enemy) return;

    const playerAttack = ((Math.random() * MAX_ATTACK) * playerStats.attack).toFixed(2);
    enemy.hp -= playerAttack;
    eventText = `Player dealt ${playerAttack} points of damage`;

    if (enemy.hp <= 0) {
        eventText += " and the bastard died";
        level[targetRow][targetCol] = EMPTY_TILE;
        isDirty = true;
        npcs = npcs.filter((npc) => npc !== enemy);
    } else {
        const enemyAttack = ((Math.random() * MAX_ATTACK) * enemy.attack).toFixed(2);
        playerStats.hp = Math.max(0, playerStats.hp - enemyAttack);
        eventText += `\nBastard deals ${enemyAttack} back`;
        isDirty = true;
    }
    eventTextTimer = EVENT_TEXT_DURATION;
}

function findEnemy(row, col) {
    for (let i = 0; i < npcs.length; i++) {
        if (npcs[i].row === row && npcs[i].col === col) {
            return npcs[i];
        }
    }
    return null;
}

function handleHealthPickup(row, col) {
    level[row][col] = EMPTY_TILE; // Remove the heart
    isDirty = true;
    const healthGain = Number.randomBetween(2, 4);
    playerStats.hp = Math.min(playerStats.hp + healthGain, HP_MAX);
    eventText = `Player healed for ${healthGain}❤️`;
    eventTextTimer = EVENT_TEXT_DURATION;
}


function handleDoor() {
    rawLevel = level2;
    level = parseLevel(rawLevel);
    playerPos = { row: null, col: null }; // Reset player position
    npcs = [];
    playerStats.hp = HP_MAX;
    isDirty = true;
    initializePlayerPosition(); //Re-initialize player position in the new level
    initializeNPCs();
    heartsCollected = {}; // Reset collected hearts for the next level
}

function handlePlayerDeath() {
    clearInterval(gl);
    console.log(ANSI.CLEAR_SCREEN, ANSI.CURSOR_HOME);
    console.log(ANSI.COLOR.RED + "GAME OVER! You died." + ANSI.COLOR_RESET);
    rl.close();
    process.exit();
}

function draw() {
    if (!isDirty) return;
    console.log(ANSI.CLEAR_SCREEN, ANSI.CURSOR_HOME);
    let rendering = renderHUD();
    for (let row = 0; row < level.length; row++) {
        let rowRendering = "";
        for (let col = 0; col < level[row].length; col++) {
            const symbol = level[row][col];
            rowRendering += PALLET[symbol] !== undefined
                ? PALLET[symbol] + symbol + ANSI.COLOR_RESET
                : symbol;
        }
        rendering += rowRendering + "\n";
    }
    console.log(rendering);
    if (eventText !== "" && eventTextTimer > 0) {
        console.log(eventText);
        eventTextTimer -= UPDATE_INTERVAL;
    } else if (eventTextTimer <= 0) {
        eventText = "";
    }
    isDirty = false;
}

function renderHUD() {
    let redHearts = Math.min(playerStats.hp, HP_MAX);
    let blueHearts = HP_MAX - redHearts;

    const hpBar = `[${ANSI.COLOR.RED + pad(redHearts, "❤️") + ANSI.COLOR_RESET}${ANSI.COLOR.BLUE + pad(blueHearts, "❤️") + ANSI.COLOR_RESET}]`;
    const cash = `$:${playerStats.chash}`;
    return `${hpBar} ${cash} \n`;
}

function pad(len, text) {
    let output = "";
    for (let i = 0; i < len; i++) {
        output += text;
    }
    return output;
}

function gameLoop() {
    const now = Date.now();
    if (now - lastUpdate >= UPDATE_INTERVAL) {
        lastUpdate = now;
        update();
        draw();
    }
}

//Splash screen
function showSplashScreen() {
    console.log(ANSI.CLEAR_SCREEN, ANSI.CURSOR_HOME);
    console.log(ANSI.COLOR.YELLOW + "Welcome to the Labyrinth!" + ANSI.COLOR_RESET);
    console.log("Get ready to adventure...");
}

// Menu functions
function startGame() {
    showSplashScreen();
    setTimeout(() => {
        gl = setInterval(gameLoop, 10);
    }, SPLASH_SCREEN_DURATION);
}

function showInstructions() {
    console.log(ANSI.CLEAR_SCREEN, ANSI.CURSOR_HOME);
    console.log(ANSI.COLOR.YELLOW + "Instructions:" + ANSI.COLOR_RESET);
    console.log("Use arrow keys to move.");
    console.log("Collect loot ($).");
    console.log("Fight enemies (B).");
    console.log("Find the door (D) to proceed to the next level.");
    console.log("Press Enter to return to the main menu.");
    rl.once("line", () => {
        showMenu();
    });
}

function exitGame() {
    console.log(ANSI.CLEAR_SCREEN, ANSI.CURSOR_HOME);
    console.log("Exiting game...");
    rl.close();
    process.exit();
}

function showMenu() {
    console.log(ANSI.CLEAR_SCREEN, ANSI.CURSOR_HOME);
    console.log(ANSI.COLOR.YELLOW + "Main Menu" + ANSI.COLOR_RESET);
    console.log("1. Start Game");
    console.log("2. Instructions");
    console.log("3. Exit");
    console.log("Enter your choice (1-3):");

    rl.once("line", (choice) => {
        switch (parseInt(choice)) {
            case 1:
                startGame();
                break;
            case 2:
                showInstructions();
                break;
            case 3:
                exitGame();
                break;
            default:
                console.log("Invalid choice. Please try again.");
                showMenu();
        }
    });
}

showMenu();

Number.randomBetween = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};
