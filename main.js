const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ゲームの状態: "title"（技名入力） / "playing" / "over"
let state = "title";
let dead = false;

// =========================
// 技名をAIが分類
// =========================

let attackName = "";
let attackType = "";
let attackColor = "yellow";

function classifyAttack(name) {
    if (
        name.includes("炎") ||
        name.includes("火") ||
        name.includes("ファイヤ") ||
        name.includes("フレイム")
    ) {
        attackType = "炎";
        attackColor = "orange";
    } else if (
        name.includes("雷") ||
        name.includes("サンダ") ||
        name.includes("電")
    ) {
        attackType = "雷";
        attackColor = "yellow";
    } else if (
        name.includes("氷") ||
        name.includes("アイス") ||
        name.includes("雪") ||
        name.includes("フリーズ")
    ) {
        attackType = "氷";
        attackColor = "cyan";
    } else if (
        name.includes("風") ||
        name.includes("トルネード") ||
        name.includes("嵐") ||
        name.includes("ウインド")
    ) {
        attackType = "風";
        attackColor = "lime";
    } else {
        attackType = "ビーム";
        attackColor = "magenta";
    }
}

// =========================
// ゲームデータ
// =========================

let player = {};
let drones = [];
let enemies = [];
let attacks = [];   // 属性攻撃
let bullets = [];   // ドローンの弾
let popups = [];    // ダメージ数字
let keys = {};

let weaponCooldown = 0;
let score = 0;
let timeLeft = 30;
let bossSpawned = false;
let bossWarn = 0;

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
    popups = [];
    weaponCooldown = 0;
    score = 0;
    timeLeft = 30;
    bossSpawned = false;
    bossWarn = 0;
    dead = false;
}

function startGame() {
    let name = prompt("攻撃名を入力してください（例：ファイヤーブレイク）");
    if (!name) name = "ファイヤーブレイク";
    attackName = name;
    classifyAttack(name);
    resetGame();
    state = "playing";
}

// =========================
// 入力
// =========================

document.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;

    if (state === "title" && (e.key === "Enter" || e.key === " ")) {
        startGame();
    }
});

document.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("click", () => {
    if (state === "title") {
        startGame();
    } else if (state === "over") {
        state = "title";
    }
});

// =========================
// 敵
// =========================

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
        emoji: type.emoji, boss: false,
        hitCooldown: 0, slowTime: 0
    });
}

function spawnBoss() {
    bossWarn = 90;
    enemies.push({
        x: canvas.width / 2 - 40, y: -100,
        size: 80, speed: 1.8,
        hp: 60, maxHp: 60,
        dmg: 1.0, point: 20,
        emoji: "🐲", boss: true,
        hitCooldown: 0, slowTime: 0
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

// =========================
// 属性攻撃（技名で決まる）
// =========================

function createAttack() {
    let cx = playerCenterX();
    let cy = playerCenterY();

    if (attackType === "炎") {
        createFireAttack(cx, cy);
    } else if (attackType === "雷") {
        createLightningAttack(cx, cy);
    } else if (attackType === "氷") {
        createIceAttack(cx, cy);
    } else if (attackType === "風") {
        createWindAttack(cx, cy);
    } else {
        createBeamAttack(cx, cy);
    }
}

// 炎：8方向に火の玉（威力2）
function createFireAttack(x, y) {
    for (let i = 0; i < 8; i++) {
        let angle = (Math.PI * 2 / 8) * i;
        attacks.push({
            type: "fire",
            x: x, y: y,
            vx: Math.cos(angle) * 7,
            vy: Math.sin(angle) * 7,
            radius: 10, life: 100
        });
    }
}

// 雷：近い敵5体に落雷（威力3）
function createLightningAttack(x, y) {
    let targets = [...enemies]
        .sort((a, b) => {
            let da = Math.hypot(a.x - player.x, a.y - player.y);
            let db = Math.hypot(b.x - player.x, b.y - player.y);
            return da - db;
        })
        .slice(0, 5);

    for (let target of targets) {
        attacks.push({
            type: "lightning",
            startX: x, startY: y,
            endX: target.x + target.size / 2,
            endY: target.y + target.size / 2,
            life: 12
        });

        let index = enemies.indexOf(target);
        if (index !== -1) {
            damageEnemy(index, 3);
        }
    }
}

// 氷：12方向に氷弾（威力1＋敵を遅くする）
function createIceAttack(x, y) {
    for (let i = 0; i < 12; i++) {
        let angle = (Math.PI * 2 / 12) * i;
        attacks.push({
            type: "ice",
            x: x, y: y,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5,
            radius: 8, life: 120
        });
    }
}

// 風：広がる竜巻（威力2）
function createWindAttack(x, y) {
    attacks.push({
        type: "wind",
        x: x, y: y,
        radius: 20, maxRadius: 180, life: 45
    });
}

// ビーム：一番近い敵の方向へ貫通ビーム（威力3）
function createBeamAttack(x, y) {
    let target = nearestEnemy(x, y);
    if (!target) return;

    let dx = (target.x + target.size / 2) - x;
    let dy = (target.y + target.size / 2) - y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    let ux = dx / dist;
    let uy = dy / dist;

    attacks.push({
        type: "beam",
        startX: x, startY: y,
        endX: x + ux * 2000, endY: y + uy * 2000,
        life: 15
    });

    // 直線上の敵をまとめてダメージ（貫通）
    for (let i = enemies.length - 1; i >= 0; i--) {
        let ex = (enemies[i].x + enemies[i].size / 2) - x;
        let ey = (enemies[i].y + enemies[i].size / 2) - y;
        let forward = ex * ux + ey * uy;
        let side = Math.abs(ex * uy - ey * ux);
        if (forward > 0 && side < 25) {
            damageEnemy(i, 3);
        }
    }
}

// =========================
// AIドローン
// =========================

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

// =========================
// 更新
// =========================

function update() {
    if (state !== "playing") return;

    if (keys["w"] || keys["arrowup"]) player.y -= player.speed;
    if (keys["s"] || keys["arrowdown"]) player.y += player.speed;
    if (keys["a"] || keys["arrowleft"]) player.x -= player.speed;
    if (keys["d"] || keys["arrowright"]) player.x += player.speed;

    player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));

    // 敵の移動＋接触ダメージ
    for (let enemy of enemies) {
        let sp = enemy.speed;
        if (enemy.slowTime > 0) {
            enemy.slowTime--;
            sp = enemy.speed * 0.4;   // 氷で凍って遅い
        }

        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            enemy.x += dx / distance * sp;
            enemy.y += dy / distance * sp;
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

    // 属性攻撃を一定間隔で発動
    weaponCooldown--;
    if (weaponCooldown <= 0) {
        createAttack();
        weaponCooldown = 42;   // 約0.7秒
    }

    updateDrones();

    // 属性攻撃の移動と当たり判定
    for (let a of attacks) {
        a.life--;

        if (a.type === "fire" || a.type === "ice") {
            a.x += a.vx;
            a.y += a.vy;

            for (let j = enemies.length - 1; j >= 0; j--) {
                let ex = (enemies[j].x + enemies[j].size / 2) - a.x;
                let ey = (enemies[j].y + enemies[j].size / 2) - a.y;
                if (Math.hypot(ex, ey) < enemies[j].size / 2 + a.radius) {
                    if (a.type === "ice") enemies[j].slowTime = 120;
                    damageEnemy(j, a.type === "fire" ? 2 : 1);
                    a.life = 0;
                    break;
                }
            }
        }

        if (a.type === "wind") {
            a.radius += 4;
            if (a.radius > a.maxRadius) a.life = 0;

            for (let j = enemies.length - 1; j >= 0; j--) {
                let e = enemies[j];
                if (e.hitCooldown > 0) continue;
                let d = Math.hypot(
                    (e.x + e.size / 2) - a.x,
                    (e.y + e.size / 2) - a.y
                );
                if (d < a.radius + 15 && d > a.radius - 20) {
                    e.hitCooldown = 20;
                    damageEnemy(j, 2);
                }
            }
        }
    }
    attacks = attacks.filter(a => a.life > 0);

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

    for (let p of popups) { p.y -= 1; p.life--; }
    popups = popups.filter(p => p.life > 0);

    if (bossWarn > 0) bossWarn--;
}

// =========================
// 描画
// =========================

function drawTitle() {
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "bold 60px sans-serif";
    ctx.fillText("AI SURVIVAL GAME", canvas.width / 2, canvas.height / 3);

    ctx.font = "30px sans-serif";
    ctx.fillText("画面をクリックして 技名 を入力するとスタート！", canvas.width / 2, canvas.height / 2);

    ctx.font = "24px sans-serif";
    ctx.fillStyle = "#aaa";
    ctx.fillText("技名からAIが属性を判定するよ", canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText("🔥炎  ⚡雷  ❄️氷  🌪️風  ✨ビーム", canvas.width / 2, canvas.height / 2 + 90);

    ctx.textAlign = "left";
}

function drawGame() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 属性攻撃
    for (let a of attacks) {
        if (a.type === "fire") {
            ctx.fillStyle = "orange";
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        if (a.type === "ice") {
            ctx.fillStyle = "cyan";
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        if (a.type === "wind") {
            ctx.strokeStyle = "lime";
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (a.type === "lightning") {
            ctx.strokeStyle = "yellow";
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(a.startX, a.startY);
            ctx.lineTo(a.endX, a.endY);
            ctx.stroke();
        }
        if (a.type === "beam") {
            ctx.globalAlpha = a.life / 15;
            ctx.strokeStyle = "magenta";
            ctx.lineWidth = 14;
            ctx.beginPath();
            ctx.moveTo(a.startX, a.startY);
            ctx.lineTo(a.endX, a.endY);
            ctx.stroke();
            ctx.globalAlpha = 1;
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
        ctx.globalAlpha = e.slowTime > 0 ? 0.6 : 1;   // 凍ってる敵は半透明
        ctx.fillText(e.emoji, e.x + e.size / 2, e.y + e.size / 2);
        ctx.globalAlpha = 1;

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

    // 情報表示
    ctx.fillStyle = "white";
    ctx.font = "26px sans-serif";
    ctx.fillText("TIME: " + timeLeft, 20, 40);
    ctx.fillText("SCORE: " + score, 20, 75);
    ctx.fillText("技名: " + attackName, 20, 110);
    ctx.fillText("属性: " + attackType, 20, 145);

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

    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.textAlign = "center";

    ctx.font = "50px sans-serif";
    ctx.fillText(dead ? "GAME OVER" : "SURVIVED!", canvas.width / 2, canvas.height / 2 - 60);

    ctx.font = "36px sans-serif";
    ctx.fillText("SCORE: " + score, canvas.width / 2, canvas.height / 2);

    ctx.font = "28px sans-serif";
    ctx.fillText(dead ? "敵に食べられた…" : "30秒生き残った！", canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText("使用した技：" + attackName, canvas.width / 2, canvas.height / 2 + 90);
    ctx.fillText("クリックでタイトルへ", canvas.width / 2, canvas.height / 2 + 140);

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

// =========================
// メインループ
// =========================

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
