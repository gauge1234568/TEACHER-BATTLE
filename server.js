const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const players = {};
const challenges = {};
const matches = {};
const battles = {};

// =========================
// CHARACTER STATS AND MOVES
// =========================

const characterStats = {

    "Mr. Sannes": {
        hp: 150,
        stamina: 100,

        moves: [
            {
                id: "voicecrack",
                name: "VOICECRACK",
                staminaCost: 0,
                type: "healStamina",
                amount: 10
            },
            {
                id: "3210",
                name: "3210",
                staminaCost: 7,
                type: "damage",
                amount: 15
            },
            {
                id: "4quarters",
                name: "4 QUARTERS",
                staminaCost: 5,
                type: "drainStamina",
                amount: 10
            }
        ],

        special: {
            name: "GOLDEN SANNES",
            type: "damage",
            amount: 1000
        }
    },

    "Mr. Dutlinger": {
        hp: 250,
        stamina: 125,

        moves: [
            {
                id: "marinebootcamp",
                name: "MARINE BOOTCAMP",
                staminaCost: 5,
                type: "drainStamina",
                amount: 20
            },
            {
                id: "hoorah",
                name: "HOO-RAH",
                staminaCost: 0,
                type: "healStamina",
                amount: 10
            },
            {
                id: "mtndewchuck",
                name: "MTN DEW CHUCK",
                staminaCost: 0,
                type: "damage",
                amount: 10
            }
        ],

        special: {
            name: "50 CAL. TURRET",
            type: "turret",
            amount: 40
        }
    },

    "Dr. Savic": {
        hp: 150,
        stamina: 100,

        moves: [
            {
                id: "guitarsmash",
                name: "GUITAR SMASH",
                staminaCost: 10,
                type: "damage",
                amount: 15
            },
            {
                id: "musicnotes",
                name: "MUSIC NOTES",
                staminaCost: 5,
                type: "drainStamina",
                amount: 10
            },
            {
                id: "musichistoryday",
                name: "MUSIC HISTORY DAY",
                staminaCost: 0,
                type: "healStamina",
                amount: 20
            }
        ],

        special: {
            name: "MUSIC LISTENING TEST",
            type: "drainStamina",
            amount: 100
        }
    },

    "Mrs. Smauley": {
        hp: 150,
        stamina: 100,

        moves: [
            {
                id: "rulersmack",
                name: "RULER SMACK",
                staminaCost: 5,
                type: "damage",
                amount: 15
            },
            {
                id: "bookminigun",
                name: "BOOK MINIGUN",
                staminaCost: 0,
                type: "combo",
                healAmount: 15,
                drainAmount: 20
            },
            {
                id: "detention",
                name: "DETENTION",
                staminaCost: 0,
                type: "healStamina",
                amount: 15
            }
        ],

        special: {
            name: "LITERATURE BOOKS",
            type: "bookChoice"
        }
    },

    "Mrs. Aysien": {
        hp: 160,
        stamina: 100,

        moves: [
            {
                id: "burningwhitehouse",
                name: "BURNING OF THE WHITE HOUSE",
                staminaCost: 15,
                type: "drainEnergy",
                amount: 20
            },
            {
                id: "guerillawarfare",
                name: "GUERILLA WARFARE",
                staminaCost: 10,
                type: "damage",
                amount: 15
            },
            {
                id: "washingtonspeech",
                name: "WASHINGTON'S SPEECH",
                staminaCost: 0,
                type: "healStamina",
                amount: 20
            }
        ],

        special: {
            name: "PENCIL STAB",
            type: "selfDamage",
            damage: 75,
            selfDamage: 10
        }
    },

    "Mr. Smauley": {
        hp: 160,
        stamina: 100,

        moves: [
            {
                id: "mapday",
                name: "MAP DAY",
                staminaCost: 0,
                type: "healStamina",
                amount: 10
            },
            {
                id: "augustuscharm",
                name: "AUGUSTUS' CHARM",
                staminaCost: 5,
                type: "drainStamina",
                amount: 15
            },
            {
                id: "backstab",
                name: "BACKSTAB",
                staminaCost: 10,
                type: "damage",
                amount: 20
            }
        ],

        special: {
            name: "BACKUP",
            type: "damage",
            amount: 99
        }
    }
};

// =========================
// BOOKS
// =========================

const literatureBooks = [
    "To Kill a Mockingbird",
    "The Great Gatsby",
    "Romeo and Juliet"
];

// =========================
// HELPER FUNCTIONS
// =========================

function getPlayerName(socketId) {
    return players[socketId]
        ? players[socketId].name
        : null;
}

function sendPlayerList() {
    const playerList = {};

    Object.keys(players).forEach((socketId) => {
        playerList[socketId] = players[socketId].name;
    });

    io.emit("playerList", playerList);
}

function getOpponentName(battle, playerName) {
    return battle.names.find(
        (name) => name !== playerName
    );
}

function getBattlePlayerName(battle, socketId) {
    return battle.names.find(
        (name) => battle.sockets[name] === socketId
    );
}

function sendBattleAction(battle, message) {
    battle.names.forEach((name) => {
        const socketId = battle.sockets[name];

        if (socketId) {
            io.to(socketId).emit(
                "battleAction",
                message
            );
        }
    });
}

function sendBattleUpdate(battle) {
    const data = {
        names: battle.names,
        teams: battle.teams,
        hp: battle.hp,
        maxHP: battle.maxHP,
        stamina: battle.stamina,
        maxStamina: battle.maxStamina,
        energy: battle.energy,
        active: battle.active,
        turn: battle.turn,
        finished: battle.finished,
        lastMove: battle.lastMove,
        pendingBookChoice: battle.pendingBookChoice
    };

    battle.names.forEach((name) => {
        const socketId = battle.sockets[name];

        if (socketId) {
            io.to(socketId).emit(
                "battleUpdate",
                data
            );
        }
    });
}

// =========================
// KEEP STATS IN RANGE
// =========================

function clampStats(battle) {
    battle.names.forEach((name) => {
        for (let i = 0; i < 3; i++) {

            battle.hp[name][i] = Math.max(
                0,
                Math.min(
                    battle.hp[name][i],
                    battle.maxHP[name][i]
                )
            );

            battle.stamina[name][i] = Math.max(
                0,
                Math.min(
                    battle.stamina[name][i],
                    battle.maxStamina[name][i]
                )
            );

            // 0 stamina = defeated
            if (battle.stamina[name][i] === 0) {
                battle.hp[name][i] = 0;
            }

            battle.energy[name][i] = Math.max(
                0,
                Math.min(
                    battle.energy[name][i],
                    100
                )
            );
        }
    });
}

// =========================
// ENERGY
// =========================

function addEnergy(battle, playerName) {
    const index = battle.active[playerName];
    const character = battle.teams[playerName][index];

    const energyGain =
        character === "Mr. Sannes"
            ? 10
            : 20;

    battle.energy[playerName][index] =
        Math.min(
            battle.energy[playerName][index] + energyGain,
            100
        );
}

// =========================
// DEFEAT CHECK
// =========================

function checkDefeat(battle, playerName) {
    const aliveCharacters = [];

    for (let i = 0; i < 3; i++) {

        if (
            battle.hp[playerName][i] > 0 &&
            battle.stamina[playerName][i] > 0
        ) {
            aliveCharacters.push(i);
        } else {
            battle.hp[playerName][i] = 0;
        }
    }

    // All three characters defeated
    if (aliveCharacters.length === 0) {

        battle.finished = true;

        const winner =
            getOpponentName(
                battle,
                playerName
            );

        sendBattleAction(
            battle,
            playerName + " has been defeated!"
        );

        if (battle.sockets[winner]) {
            io.to(
                battle.sockets[winner]
            ).emit("battleWon");
        }

        if (battle.sockets[playerName]) {
            io.to(
                battle.sockets[playerName]
            ).emit("battleLost");
        }

        return true;
    }

    // Automatically switch defeated active character
    const activeIndex =
        battle.active[playerName];

    if (
        battle.hp[playerName][activeIndex] <= 0 ||
        battle.stamina[playerName][activeIndex] <= 0
    ) {

        const newIndex =
            aliveCharacters[0];

        battle.active[playerName] =
            newIndex;

        sendBattleAction(
            battle,
            playerName +
            " was automatically switched to " +
            battle.teams[playerName][newIndex] +
            "!"
        );
    }

    return false;
}

// =========================
// END TURN
// =========================

function endTurn(battle, playerName) {
    const opponent =
        getOpponentName(
            battle,
            playerName
        );

    battle.turn = opponent;

    sendBattleUpdate(battle);
}

// =========================
// CREATE BATTLE
// =========================

function createBattle(matchId) {

    const match = matches[matchId];

    if (!match) {
        return;
    }

    const player1 = match.player1;
    const player2 = match.player2;

    const team1 = match.teams[player1];
    const team2 = match.teams[player2];

    const battleId =
        Date.now().toString() +
        Math.random()
            .toString(36)
            .substring(2, 8);

    battles[battleId] = {

        id: battleId,

        names: [
            player1,
            player2
        ],

        teams: {
            [player1]: team1,
            [player2]: team2
        },

        hp: {
            [player1]: team1.map(
                (character) =>
                    characterStats[character].hp
            ),

            [player2]: team2.map(
                (character) =>
                    characterStats[character].hp
            )
        },

        maxHP: {
            [player1]: team1.map(
                (character) =>
                    characterStats[character].hp
            ),

            [player2]: team2.map(
                (character) =>
                    characterStats[character].hp
            )
        },

        stamina: {
            [player1]: team1.map(
                (character) =>
                    characterStats[character].stamina
            ),

            [player2]: team2.map(
                (character) =>
                    characterStats[character].stamina
            )
        },

        maxStamina: {
            [player1]: team1.map(
                (character) =>
                    characterStats[character].stamina
            ),

            [player2]: team2.map(
                (character) =>
                    characterStats[character].stamina
            )
        },

        energy: {
            [player1]: [0, 0, 0],
            [player2]: [0, 0, 0]
        },

        active: {
            [player1]: 0,
            [player2]: 0
        },

        sockets: {
            [player1]: match.sockets[player1],
            [player2]: match.sockets[player2]
        },

        lastMove: {
            [player1]: "None",
            [player2]: "None"
        },

        pendingBookChoice: {
            [player1]: false,
            [player2]: false
        },

        turn: player1,
        finished: false
    };

    delete matches[matchId];

    io.to(
        battles[battleId].sockets[player1]
    ).emit(
        "startBattle",
        battleId
    );

    io.to(
        battles[battleId].sockets[player2]
    ).emit(
        "startBattle",
        battleId
    );

    sendBattleUpdate(
        battles[battleId]
    );
}

// =========================
// CONNECTION
// =========================

io.on("connection", (socket) => {

    console.log(
        "Player connected:",
        socket.id
    );

    // =====================
    // SET NAME
    // =====================

    socket.on("setName", (name) => {

        if (
            typeof name !== "string"
        ) {
            return;
        }

        name = name.trim();

        if (
            name.length === 0
        ) {
            return;
        }

        players[socket.id] = {
            name: name
        };

        console.log(
            "Player name:",
            name
        );

        sendPlayerList();
    });

    // =====================
    // CHALLENGE PLAYER
    // =====================

    socket.on(
        "challengePlayer",
        (targetId) => {

            if (!players[socket.id]) {
                return;
            }

            if (!players[targetId]) {
                return;
            }

            challenges[targetId] =
                socket.id;

            io.to(targetId).emit(
                "challengeReceived",
                players[socket.id].name
            );
        }
    );

    // =====================
    // CHALLENGE RESPONSE
    // =====================

    socket.on(
        "challengeResponse",
        (response) => {

            const challengerId =
                challenges[socket.id];

            if (!challengerId) {
                return;
            }

            const challengerName =
                getPlayerName(
                    challengerId
                );

            const opponentName =
                getPlayerName(
                    socket.id
                );

            if (
                !challengerName ||
                !opponentName
            ) {
                return;
            }

            if (
                response &&
                response.accepted
            ) {

                const matchId =
                    Date.now().toString() +
                    Math.random()
                        .toString(36)
                        .substring(2, 8);

                matches[matchId] = {

                    player1:
                        challengerName,

                    player2:
                        opponentName,

                    sockets: {

                        [challengerName]:
                            challengerId,

                        [opponentName]:
                            socket.id
                    },

                    teams: {},

                    ready: {

                        [challengerName]:
                            false,

                        [opponentName]:
                            false
                    }
                };

                io.to(
                    challengerId
                ).emit(
                    "startCharacterSelection",
                    matchId
                );

                socket.emit(
                    "startCharacterSelection",
                    matchId
                );

            } else {

                io.to(
                    challengerId
                ).emit(
                    "challengeResult",
                    opponentName +
                    " declined your challenge."
                );
            }

            delete challenges[socket.id];
        }
    );

    // =====================
    // TEAM READY
    // =====================

    socket.on(
        "teamReady",
        (team) => {

            const playerName =
                getPlayerName(
                    socket.id
                );

            if (!playerName) {
                return;
            }

            if (
                !Array.isArray(team) ||
                team.length !== 3
            ) {

                socket.emit(
                    "battleError",
                    "Choose exactly 3 characters."
                );

                return;
            }

            for (
                const character of team
            ) {

                if (
                    !characterStats[character]
                ) {

                    socket.emit(
                        "battleError",
                        "Unknown character: " +
                        character
                    );

                    return;
                }
            }

            let matchId = null;

            Object.keys(matches).forEach(
                (id) => {

                    const match =
                        matches[id];

                    if (
                        match.player1 ===
                            playerName ||
                        match.player2 ===
                            playerName
                    ) {
                        matchId = id;
                    }
                }
            );

            if (!matchId) {

                socket.emit(
                    "battleError",
                    "Match not found."
                );

                return;
            }

            const match =
                matches[matchId];

            match.teams[playerName] =
                team;

            match.ready[playerName] =
                true;

            match.sockets[playerName] =
                socket.id;

            socket.emit(
                "battleError",
                "Team locked in!"
            );

            if (
                match.ready[match.player1] &&
                match.ready[match.player2]
            ) {
                createBattle(matchId);
            }
        }
    );

    // =====================
    // JOIN / REQUEST BATTLE
    // =====================

    function joinBattleHandler(data) {

        if (!data) {
            return;
        }

        const battle =
            battles[data.battleId];

        if (!battle) {

            socket.emit(
                "battleError",
                "Battle not found."
            );

            return;
        }

        const requestedName =
            data.playerName ||
            getPlayerName(socket.id);

        if (
            !requestedName ||
            !battle.names.includes(
                requestedName
            )
        ) {

            socket.emit(
                "battleError",
                "You are not in this battle."
            );

            return;
        }

        battle.sockets[
            requestedName
        ] = socket.id;

        sendBattleUpdate(
            battle
        );
    }

    socket.on(
        "joinBattle",
        joinBattleHandler
    );

    socket.on(
        "requestBattle",
        joinBattleHandler
    );

    // =====================
    // USE CHARACTER MOVE
    // =====================

    function useMoveHandler(data) {

        if (!data) {
            return;
        }

        const battle =
            battles[data.battleId];

        if (
            !battle ||
            battle.finished
        ) {
            return;
        }

        const playerName =
            getBattlePlayerName(
                battle,
                socket.id
            );

        if (!playerName) {
            return;
        }

        if (
            battle.turn !==
            playerName
        ) {

            socket.emit(
                "battleError",
                "It is not your turn!"
            );

            return;
        }

        if (
            battle.pendingBookChoice[playerName]
        ) {

            socket.emit(
                "battleError",
                "Choose a book first!"
            );

            return;
        }

        const opponentName =
            getOpponentName(
                battle,
                playerName
            );

        const myIndex =
            battle.active[playerName];

        const opponentIndex =
            battle.active[opponentName];

        const character =
            battle.teams[playerName][
                myIndex
            ];

        const stats =
            characterStats[character];

        const moveId =
            data.move ||
            data.moveId;

        const move =
            stats.moves.find(
                (item) =>
                    item.id === moveId
            );

        if (!move) {

            socket.emit(
                "battleError",
                "This character cannot use that move."
            );

            return;
        }

        const staminaCost =
            move.staminaCost || 0;

        if (
            battle.stamina[playerName][myIndex] <
            staminaCost
        ) {

            socket.emit(
                "battleError",
                "Not enough stamina!"
            );

            return;
        }

        battle.stamina[playerName][myIndex] -=
            staminaCost;

        if (
            move.type ===
            "damage"
        ) {

            battle.hp[opponentName][opponentIndex] -=
                move.amount;

            sendBattleAction(
                battle,
                character +
                " used " +
                move.name +
                " for " +
                move.amount +
                " damage!"
            );

        } else if (
            move.type ===
            "drainStamina"
        ) {

            battle.stamina[opponentName][opponentIndex] -=
                move.amount;

            sendBattleAction(
                battle,
                character +
                " used " +
                move.name +
                " and drained " +
                move.amount +
                " stamina!"
            );

        } else if (
            move.type ===
            "healStamina"
        ) {

            battle.stamina[playerName][myIndex] +=
                move.amount;

            sendBattleAction(
                battle,
                character +
                " used " +
                move.name +
                " and gained " +
                move.amount +
                " stamina!"
            );

        } else if (
            move.type ===
            "combo"
        ) {

            battle.stamina[playerName][myIndex] +=
                move.healAmount;

            battle.stamina[opponentName][opponentIndex] -=
                move.drainAmount;

            sendBattleAction(
                battle,
                character +
                " used " +
                move.name +
                "! Gained " +
                move.healAmount +
                " stamina and drained " +
                move.drainAmount +
                " stamina!"
            );

        } else if (
            move.type ===
            "drainEnergy"
        ) {

            battle.energy[opponentName][opponentIndex] -=
                move.amount;

            sendBattleAction(
                battle,
                character +
                " used " +
                move.name +
                " and drained " +
                move.amount +
                " energy!"
            );
        }

        addEnergy(
            battle,
            playerName
        );

        battle.lastMove[playerName] =
            move.name;

        clampStats(battle);

        if (
            checkDefeat(
                battle,
                opponentName
            )
        ) {

            sendBattleUpdate(
                battle
            );

            return;
        }

        if (
            checkDefeat(
                battle,
                playerName
            )
        ) {

            sendBattleUpdate(
                battle
            );

            return;
        }

        endTurn(
            battle,
            playerName
        );
    }

    socket.on(
        "battleMove",
        useMoveHandler
    );

    socket.on(
        "useMove",
        useMoveHandler
    );

    // =====================
    // SPECIAL
    // =====================

    function specialHandler(battleId) {

        const battle =
            battles[battleId];

        if (
            !battle ||
            battle.finished
        ) {
            return;
        }

        const playerName =
            getBattlePlayerName(
                battle,
                socket.id
            );

        if (!playerName) {
            return;
        }

        if (
            battle.turn !==
            playerName
        ) {

            socket.emit(
                "battleError",
                "It is not your turn!"
            );

            return;
        }

        if (
            battle.pendingBookChoice[playerName]
        ) {

            socket.emit(
                "battleError",
                "Choose a book first!"
            );

            return;
        }

        const opponentName =
            getOpponentName(
                battle,
                playerName
            );

        const myIndex =
            battle.active[playerName];

        const opponentIndex =
            battle.active[opponentName];

        const character =
            battle.teams[playerName][
                myIndex
            ];

        const special =
            characterStats[character].special;

        if (
            battle.energy[playerName][myIndex] < 100
        ) {

            socket.emit(
                "battleError",
                "You need 100 energy!"
            );

            return;
        }

        battle.energy[playerName][myIndex] = 0;

        // =====================
        // BOOK CHOICE
        // =====================

        if (
            special.type ===
            "bookChoice"
        ) {

            battle.pendingBookChoice[playerName] =
                true;

            sendBattleAction(
                battle,
                character +
                " activated " +
                special.name +
                "!"
            );

            socket.emit(
                "bookChoice",
                {
                    books: literatureBooks
                }
            );

            sendBattleUpdate(
                battle
            );

            return;
        }

        // =====================
        // DAMAGE
        // =====================

        if (
            special.type ===
            "damage"
        ) {

            battle.hp[opponentName][opponentIndex] -=
                special.amount;

            sendBattleAction(
                battle,
                character +
                " used " +
                special.name +
                " for " +
                special.amount +
                " damage!"
            );

        } else if (
            special.type ===
            "turret"
        ) {

            battle.hp[opponentName][opponentIndex] -=
                special.amount;

            sendBattleAction(
                battle,
                character +
                " used " +
                special.name +
                " for " +
                special.amount +
                " damage!"
            );

        } else if (
            special.type ===
            "drainStamina"
        ) {

            battle.stamina[opponentName][opponentIndex] -=
                special.amount;

            sendBattleAction(
                battle,
                character +
                " used " +
                special.name +
                " and drained " +
                special.amount +
                " stamina!"
            );

        } else if (
            special.type ===
            "selfDamage"
        ) {

            battle.hp[opponentName][opponentIndex] -=
                special.damage;

            battle.hp[playerName][myIndex] -=
                special.selfDamage;

            sendBattleAction(
                battle,
                character +
                " used " +
                special.name +
                "!"
            );
        }

        battle.lastMove[playerName] =
            special.name;

        clampStats(battle);

        if (
            checkDefeat(
                battle,
                opponentName
            )
        ) {

            sendBattleUpdate(
                battle
            );

            return;
        }

        if (
            checkDefeat(
                battle,
                playerName
            )
        ) {

            sendBattleUpdate(
                battle
            );

            return;
        }

        endTurn(
            battle,
            playerName
        );
    }

    // IMPORTANT:
    // battle.html sends { battleId: battleId }
    // so specialMove must unwrap the object.

    socket.on(
        "specialMove",
        (data) => {
            if (!data) {
                return;
            }

            specialHandler(
                data.battleId
            );
        }
    );

    // Old compatibility event
    socket.on(
        "special",
        specialHandler
    );

    // =====================
    // BOOK CHOICE
    // =====================

    socket.on(
        "bookChoice",
        (data) => {

            if (
                !data ||
                !data.battleId
            ) {
                return;
            }

            const battle =
                battles[data.battleId];

            if (
                !battle ||
                battle.finished
            ) {
                return;
            }

            const playerName =
                getBattlePlayerName(
                    battle,
                    socket.id
                );

            if (!playerName) {
                return;
            }

            if (
                !battle.pendingBookChoice[playerName]
            ) {

                socket.emit(
                    "battleError",
                    "You are not choosing a book."
                );

                return;
            }

            if (
                battle.turn !==
                playerName
            ) {

                socket.emit(
                    "battleError",
                    "It is not your turn!"
                );

                return;
            }

            const myIndex =
                battle.active[playerName];

            const character =
                battle.teams[playerName][
                    myIndex
                ];

            if (
                character !==
                "Mrs. Smauley"
            ) {
                return;
            }

            if (
                !literatureBooks.includes(
                    data.book
                )
            ) {

                socket.emit(
                    "battleError",
                    "Invalid book choice."
                );

                return;
            }

            const opponentName =
                getOpponentName(
                    battle,
                    playerName
                );

            const opponentIndex =
                battle.active[
                    opponentName
                ];

            battle.pendingBookChoice[playerName] =
                false;

            battle.hp[opponentName][opponentIndex] -=
                50;

            battle.lastMove[playerName] =
                data.book;

            sendBattleAction(
                battle,
                "Mrs. Smauley used " +
                data.book +
                " for 50 damage!"
            );

            clampStats(battle);

            if (
                checkDefeat(
                    battle,
                    opponentName
                )
            ) {

                sendBattleUpdate(
                    battle
                );

                return;
            }

            if (
                checkDefeat(
                    battle,
                    playerName
                )
            ) {

                sendBattleUpdate(
                    battle
                );

                return;
            }

            endTurn(
                battle,
                playerName
            );
        }
    );

    // =====================
    // SWITCH CHARACTER
    // =====================

    socket.on(
        "switchCharacter",
        (data) => {

            if (!data) {
                return;
            }

            const battle =
                battles[data.battleId];

            if (
                !battle ||
                battle.finished
            ) {
                return;
            }

            const playerName =
                getBattlePlayerName(
                    battle,
                    socket.id
                );

            if (!playerName) {
                return;
            }

            const index =
                Number(data.index);

            if (
                index < 0 ||
                index > 2 ||
                !Number.isInteger(index)
            ) {
                return;
            }

            // Switching is allowed regardless
            // of whose turn it is.

            if (
                battle.hp[playerName][index] <= 0 ||
                battle.stamina[playerName][index] <= 0
            ) {

                socket.emit(
                    "battleError",
                    "That character is defeated!"
                );

                return;
            }

            if (
                battle.active[playerName] ===
                index
            ) {

                socket.emit(
                    "battleError",
                    "That character is already active!"
                );

                return;
            }

            if (
                battle.pendingBookChoice[playerName]
            ) {

                socket.emit(
                    "battleError",
                    "Choose a book first!"
                );

                return;
            }

            battle.active[playerName] =
                index;

            sendBattleAction(
                battle,
                playerName +
                " switched to " +
                battle.teams[playerName][index] +
                "!"
            );

            // Switching does NOT end the turn.
            sendBattleUpdate(
                battle
            );
        }
    );

    // =====================
    // DISCONNECT
    // =====================

    socket.on(
        "disconnect",
        () => {

            console.log(
                "Player disconnected:",
                socket.id
            );

            delete players[
                socket.id
            ];

            sendPlayerList();
        }
    );
});

// =========================
// START SERVER
// =========================

const PORT =
    process.env.PORT || 3000;

server.listen(
    PORT,
    () => {

        console.log(
            "TeacherBattle is running!"
        );

        console.log(
            "Running on port " +
            PORT
        );
    }
);
