const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ゲームの状態: "title"（武器選択） / "playing" / "over"
let state = "title";
let dead = false;

// 武器リスト
const WEAPONS = [
    { id: "aura",    emoji: "⭕", name: "オーラ",   desc: "周囲の敵にダメージ" },
    { id: "missile", emoji: "🧨", name: "ミサイル", desc: "敵を追尾して爆撃" },
    { id: "blade",   emoji: "🗡️", name: "ブレード", desc: "回転する刃で斬る" },
    { id: "laser",   emoji: "⚡", name: "レーザー", desc: "直線上の敵を貫通" }
];
let weapon = null;      // 選ばれた武器のid
let cardRects = [];     // タイトル画面のカードのクリック判定用

let player = {};
let drones = [];
let enemies = [];
let attacks = [];   // オーラの見た目
let bullets = [];   // ドローンの弾
let missiles = [];  // ホーミングミサイル
let lasers = [];    // レーザーの見た目
let popups = [];    // ダメージ数字
let keys = {};

let bladeAngle = 0;
let weaponCooldown = 0;

let score = 0;
let timeLeft = 30;
let bossSpawned = false;
let bossWarn = 0;   // 「BOSS出現」表示の残り時間

const DRONE_ORBIT = 70;
const DRONE_FIRE_RATE = 30;
const BULLET_DAMAGE = 2;

function resetGame() {
    player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        size: 40,
        speed: 8,
        hp: 300,
        maxHp: 300
    };
    drones = [
        { angle: 0, size: 30, cooldown: 0, x: 0, y: 0 },
        { angle: Math.PI, size: 30, cooldown: 15, x: 0, y: 0 }
    ];
    enemies = [];
    attacks = [];
    bullets = [];
    missiles = [];
    lasers = [];
    popups = [];
    bladeAngle = 0;
    weaponCooldown = 0;
    score = 0;
    timeLeft = 30;
    bossSpawned = false;
    bossWarn = 0;
    dead = false;
}

document.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;

    // タイトル画面では1〜4キーでも武器を選べる
    if (state === "title") {
        let n = parseInt(e.key);
        if (n >= 1 && n <= 4) {
            startGame(WEAPONS[n - 1].id);
        }
    }
});

document.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("click", (e) => {
    if (state === "title") {
        for (let i = 0; i < cardRects.length; i++) {
            let r = cardRects[i];
            if (e.clientX >= r.x && e.clientX <= r.x + r.w &&
                e.clientY >= r.y && e.clientY <= r.y + r.h) {
                startGame(WEAPONS[i].id);
            }
        }
    } else if (state === "over") {
        state = "title";
    }
});

function startGame(weaponId) {
    weapon = weaponId;
    resetGame();
    state = "playing";
}

function spawnEnemy() {
    if (enemies.length > 150) return;

    let side = Math.floor(Math.random() * 4);
    let x, y;

    if (side === 0) {
        x = Math.random() * canvas.width;
        y = -30;
    } else if (side === 1) {
        x = Math.random() * canvas.width;
        y = canvas.height + 30;
    } else if (side === 2) {
        x = -30;
        y = Math.random() * canvas.height;
    } else {
        x = canvas.width + 30;
        y = Math.random() * canvas.height;
    }

    // 敵の種類を確率で決める
    let r = Math.random();
    let type;
    if (r < 0.25) {
        // 速いけど弱い
        type = { emoji: "👻", size: 24, speed: 4.5, hp: 1, dmg: 0.1, point: 1 };
    } else if (r < 0.4 && timeLeft <= 25) {
        // 遅いけど硬い（開始5秒後から出る）
        type = { emoji: "👹", size: 44, speed: 1.3, hp: 10, dmg: 0.4, point: 3 };
    } else {
        // ふつう
        type = { emoji: "👾", size: 30, speed: 2.5, hp: 3, dmg: 0.15, point: 1 };
    }

    enemies.push({
        x: x, y: y,
        size: type.size, speed: type.speed,
        hp: type.hp, maxHp: type.hp,
        dmg: type.dmg, point: type.point,
        emoji: type.emoji, boss: false, hitCooldown: 0
    });
}

function spawnBoss() {
    bossWarn = 90;
    enemies.push({
        x: canvas.width / 2 - 40, y: -100,
        size: 80, speed: 1.8,
        hp: 60, maxHp: 60,
        dmg: 1.0, point: 20,
        emoji: "🐲", boss: true, hitCooldown: 0
    });
}

function addPopup(x, y, text) {
    popups.push({ x: x, y: y, text: text, life: 40 });
}

function damageEnemy(index, dmg) {
    let e = enemies[index];
    e.hp -= dmg;
    addPopup(e.x + e.size / 2, e.y, dmg);

    if (e.hp <= 0) {
        enemies.splice(index, 1);
        score += e.point || 1;
    }
}

function playerCenterX() { return player.x + player.size / 2; }
function playerCenterY() { return player.y + player.size / 2; }

function nearestEnemy(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (let e of enemies) {
        let dx = (e.x + e.size / 2) - x;
        let dy = (e.y + e.size / 2) - y;
        let d = dx * dx + dy * dy;
        if (d < bestDist) {
            bestDist = d;
            best = e;
        }
    }
    return best;
}

// ---- 各武器の攻撃 ----

function fireAura() {
    let cx = playerCenterX();
    let cy = playerCenterY();
    attacks.push({ x: cx, y: cy, size: 80, life: 20 });

    for (let i = enemies.length - 1; i >= 0; i--) {
        let dx = (enemies[i].x + enemies[i].size / 2) - cx;
        let dy = (enemies[i].y + enemies[i].size / 2) - cy;
        if (Math.sqrt(dx * dx + dy * dy) < 80) {
            damageEnemy(i, 1);
        }
    }
}

function fireMissiles() {
    for (let i = 0; i < 2; i++) {
        let angle = Math.random() * Math.PI * 2;
        missiles.push({
            x: playerCenterX(),
            y: playerCenterY(),
            vx: Math.cos(angle) * 6,
            vy: Math.sin(angle) * 6,
            life: 120
        });
    }
}

function fireLaser() {
    let target = nearestEnemy(playerCenterX(), playerCenterY());
    if (!target) return;

    let cx = playerCenterX();
    let cy = playerCenterY();
    let dx = (target.x + target.size / 2) - cx;
    let dy = (target.y + target.size / 2) - cy;
    let dist = Math.sqrt(dx * dx + dy * dy);
    let ux = dx / dist;
    let uy = dy / dist;

    lasers.push({ x1: cx, y1: cy, x2: cx + ux * 2000, y2: cy + uy * 2000, life: 15 });

    // 直線の近くにいる敵を全部ダメージ（貫通）
    for (let i = enemies.length - 1; i >= 0; i--) {
        let ex = (enemies[i].x + enemies[i].size / 2) - cx;
        let ey = (enemies[i].y + enemies[i].size / 2) - cy;
        let forward = ex * ux + ey * uy;          // レーザーの進行方向か
        let side = Math.abs(ex * uy - ey * ux);   // 直線からの距離
        if (forward > 0 && side < 25) {
            damageEnemy(i, 2);
        }
    }
}

function updateBlades() {
    bladeAngle += 0.12;
    for (let b = 0; b < 3; b++) {
        let angle = bladeAngle + b * (Math.PI * 2 / 3);
        let bx = playerCenterX() + Math.cos(angle) * 90;
        let by = playerCenterY() + Math.sin(angle) * 90;

        for (let i = enemies.length - 1; i >= 0; i--) {
            if (enemies[i].hitCooldown > 0) continue;
            let dx = (enemies[i].x + enemies[i].size / 2) - bx;
            let dy = (enemies[i].y + enemies[i].size / 2) - by;
            if (Math.sqrt(dx * dx + dy * dy) < 30) {
                enemies[i].hitCooldown = 15;
                damageEnemy(i, 1);
            }
        }
    }
}

function updateWeapon() {
    weaponCooldown--;

    if (weapon === "aura" && weaponCooldown <= 0) {
        fireAura();
        weaponCooldown = 42;
    } else if (weapon === "missile" && weaponCooldown <= 0) {
        fireMissiles();
        weaponCooldown = 36;
    } else if (weapon === "laser" && weaponCooldown <= 0) {
        fireLaser();
        weaponCooldown = 48;
    } else if (weapon === "blade") {
        updateBlades();
    }
}

// ---- AIドローン ----

function updateDrones() {
    for (let d of drones) {
        d.angle += 0.05;
        d.x = playerCenterX() + Math.cos(d.angle) * DRONE_ORBIT;
        d.y = playerCenterY() + Math.sin(d.angle) * DRONE_ORBIT;

        d.cooldown--;
        if (d.cooldown <= 0) {
            let target = nearestEnemy(d.x, d.y);
            if (target) {
                let dx = (target.x + target.size / 2) - d.x;
                let dy = (target.y + target.size / 2) - d.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                bullets.push({
                    x: d.x, y: d.y,
                    vx: dx / dist * 12, vy: dy / dist * 12,
                    size: 5, life: 60
                });
                d.cooldown = DRONE_FIRE_RATE;
            }
        }
    }
}

// ---- メイン更新 ----

function update() {
    if (state !== "playing") return;

    if (keys["w"] || keys["arrowup"]) player.y -= player.speed;
    if (keys["s"] || keys["arrowdown"]) player.y += player.speed;
    if (keys["a"] || keys["arrowleft"]) player.x -= player.speed;
    if (keys["d"] || keys["arrowright"]) player.x += player.speed;

    player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));

    for (let enemy of enemies) {
        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            enemy.x += dx / distance * enemy.speed;
            enemy.y += dy / distance * enemy.speed;
        }

        if (distance < (player.size + enemy.size) / 2) {
            player.hp -= enemy.dmg;
        }

        if (enemy.hitCooldown > 0) enemy.hitCooldown--;
    }

    if (player.hp <= 0) {
        player.hp = 0;
        dead = true;
        state = "over";
    }

    updateWeapon();
    updateDrones();

    // ドローンの弾
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        b.life--;

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            let dx = (enemies[j].x + enemies[j].size / 2) - b.x;
            let dy = (enemies[j].y + enemies[j].size / 2) - b.y;
            if (Math.sqrt(dx * dx + dy * dy) < enemies[j].size / 2 + b.size) {
                damageEnemy(j, BULLET_DAMAGE);
                hit = true;
                break;
            }
        }
        if (hit || b.life <= 0) bullets.splice(i, 1);
    }

    // ホーミングミサイル
    for (let i = missiles.length - 1; i >= 0; i--) {
        let m = missiles[i];
        let target = nearestEnemy(m.x, m.y);
        if (target) {
            let dx = (target.x + target.size / 2) - m.x;
            let dy = (target.y + target.size / 2) - m.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            m.vx += dx / dist * 0.8;
            m.vy += dy / dist * 0.8;
            let speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
            if (speed > 9) {
                m.vx = m.vx / speed * 9;
                m.vy = m.vy / speed * 9;
            }
        }
        m.x += m.vx;
        m.y += m.vy;
        m.life--;

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            let dx = (enemies[j].x + enemies[j].size / 2) - m.x;
            let dy = (enemies[j].y + enemies[j].size / 2) - m.y;
            if (Math.sqrt(dx * dx + dy * dy) < enemies[j].size / 2 + 10) {
                damageEnemy(j, 3);
                hit = true;
                break;
            }
        }
        if (hit || m.life <= 0) missiles.splice(i, 1);
    }

    for (let a of attacks) a.life--;
    attacks = attacks.filter(a => a.life > 0);

    for (let l of lasers) l.life--;
    lasers = lasers.filter(l => l.life > 0);

    for (let p of popups) { p.y -= 1; p.life--; }
    popups = popups.filter(p => p.life > 0);

    if (bossWarn > 0) bossWarn--;
}

// ---- 描画 ----

function drawTitle() {
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "bold 60px sans-serif";
    ctx.fillText("AI SURVIVAL GAME", canvas.width / 2, canvas.height / 4);
    ctx.font = "26px sans-serif";
    ctx.fillText("武器を選んでスタート（クリック or 1〜4キー）", canvas.width / 2, canvas.height / 4 + 50);

    // 武器カードを2x2で並べる
    cardRects = [];
    let cardW = 280, cardH = 130, gap = 30;
    let startX = canvas.width / 2 - cardW - gap / 2;
    let startY = canvas.height / 2 - cardH - gap / 2 + 40;

    for (let i = 0; i < WEAPONS.length; i++) {
        let col = i % 2;
        let row = Math.floor(i / 2);
        let x = startX + col * (cardW + gap);
        let y = startY + row * (cardH + gap);
        cardRects.push({ x: x, y: y, w: cardW, h: cardH });

        ctx.fillStyle = "#222";
        ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeStyle = "orange";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, cardW, cardH);

        ctx.font = "40px sans-serif";
        ctx.fillText(WEAPONS[i].emoji, x + 45, y + 75);

        ctx.fillStyle = "white";
        ctx.font = "bold 26px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText((i + 1) + ". " + WEAPONS[i].name, x + 85, y + 55);
        ctx.font = "18px sans-serif";
        ctx.fillStyle = "#aaa";
        ctx.fillText(WEAPONS[i].desc, x + 85, y + 90);
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
    }

    ctx.textAlign = "left";
}

function drawGame() {
    // オーラ
    ctx.strokeStyle = "orange";
    ctx.lineWidth = 5;
    for (let a of attacks) {
        ctx.globalAlpha = a.life / 20;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // レーザー
    ctx.strokeStyle = "cyan";
    for (let l of lasers) {
        ctx.globalAlpha = l.life / 15;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 回転ブレード
    if (weapon === "blade") {
        ctx.font = "34px sans-serif";
        for (let b = 0; b < 3; b++) {
            let angle = bladeAngle + b * (Math.PI * 2 / 3);
            let bx = playerCenterX() + Math.cos(angle) * 90;
            let by = playerCenterY() + Math.sin(angle) * 90;
            ctx.fillText("🗡️", bx, by);
        }
    }

    // プレイヤー
    ctx.font = player.size + "px sans-serif";
    ctx.fillText("🚀", playerCenterX(), playerCenterY());

    // HPバー
    let barW = 60;
    let bx = playerCenterX() - barW / 2;
    let by = player.y + player.size + 10;
    ctx.fillStyle = "black";
    ctx.fillRect(bx - 2, by - 2, barW + 4, 12);
    ctx.fillStyle = "orange";
    ctx.fillRect(bx, by, barW * (player.hp / player.maxHp), 8);

    // 敵
    for (let e of enemies) {
        ctx.font = e.size + "px sans-serif";
        ctx.fillText(e.emoji, e.x + e.size / 2, e.y + e.size / 2);

        // ボスのHPバー
        if (e.boss) {
            let bw = 100;
            ctx.fillStyle = "black";
            ctx.fillRect(e.x + e.size / 2 - bw / 2 - 2, e.y - 22, bw + 4, 12);
            ctx.fillStyle = "red";
            ctx.fillRect(e.x + e.size / 2 - bw / 2, e.y - 20, bw * (e.hp / e.maxHp), 8);
        }
    }

    // ドローン
    ctx.font = "30px sans-serif";
    for (let d of drones) {
        ctx.fillText("🤖", d.x, d.y);
    }

    // ミサイル
    ctx.font = "24px sans-serif";
    for (let m of missiles) {
        ctx.fillText("🧨", m.x, m.y);
    }

    // ドローンの弾
    ctx.fillStyle = "yellow";
    for (let b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // ダメージ数字
    ctx.font = "bold 22px sans-serif";
    for (let p of popups) {
        ctx.globalAlpha = p.life / 40;
        ctx.fillStyle = "gold";
        ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "white";
    ctx.font = "28px sans-serif";
    ctx.fillText("TIME: " + timeLeft, 20, 40);
    ctx.fillText("SCORE: " + score, 20, 80);

    let w = WEAPONS.find(w => w.id === weapon);
    if (w) ctx.fillText(w.emoji + " " + w.name, 20, 120);

    // ボス出現の警告
    if (bossWarn > 0) {
        ctx.textAlign = "center";
        ctx.globalAlpha = (Math.floor(bossWarn / 10) % 2 === 0) ? 1 : 0.3;
        ctx.fillStyle = "red";
        ctx.font = "bold 60px sans-serif";
        ctx.fillText("⚠️ BOSS出現 ⚠️", canvas.width / 2, canvas.height / 3);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
    }
}

function drawOver() {
    drawGame();

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "50px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(dead ? "GAME OVER" : "SURVIVED!", canvas.width / 2, canvas.height / 2 - 60);

    ctx.font = "36px sans-serif";
    ctx.fillText("SCORE: " + score, canvas.width / 2, canvas.height / 2);

    ctx.font = "28px sans-serif";
    ctx.fillText(dead ? "敵に食べられた…" : "30秒で倒した敵の数", canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText("クリックでタイトルへ", canvas.width / 2, canvas.height / 2 + 100);

    ctx.textAlign = "left";
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state === "title") {
        drawTitle();
    } else if (state === "playing") {
        drawGame();
    } else {
        drawOver();
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

setInterval(() => {
    if (state === "playing") {
        for (let i = 0; i < 5; i++) {
            spawnEnemy();
        }
    }
}, 500);

setInterval(() => {
    if (state === "playing") {
        timeLeft--;

        // 残り10秒でボス出現
        if (timeLeft === 10 && !bossSpawned) {
            bossSpawned = true;
            spawnBoss();
        }

        if (timeLeft <= 0) {
            timeLeft = 0;
            state = "over";
        }
    }
}, 1000);
