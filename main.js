const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// =========================
// 基本データ
// =========================

let player = {
    x: canvas.width / 2 - 20,
    y: canvas.height / 2 - 20,
    size: 40,
    speed: 8
};

let enemies = [];
let attacks = [];
let keys = {};

let score = 0;
let timeLeft = 30;
let gameOver = false;

let attackName = "";
let attackType = "";
let attackColor = "yellow";

// =========================
// 攻撃名を分類
// =========================

function setupAttack() {
    attackName = prompt("攻撃名を入力してください");

    if (!attackName) {
        attackName = "ファイヤーブレイク";
    }

    if (
        attackName.includes("炎") ||
        attackName.includes("火") ||
        attackName.includes("ファイヤ") ||
        attackName.includes("フレイム")
    ) {
        attackType = "炎";
        attackColor = "orange";
    } else if (
        attackName.includes("雷") ||
        attackName.includes("サンダ") ||
        attackName.includes("電")
    ) {
        attackType = "雷";
        attackColor = "yellow";
    } else if (
        attackName.includes("氷") ||
        attackName.includes("アイス") ||
        attackName.includes("雪") ||
        attackName.includes("フリーズ")
    ) {
        attackType = "氷";
        attackColor = "cyan";
    } else if (
        attackName.includes("風") ||
        attackName.includes("トルネード") ||
        attackName.includes("嵐") ||
        attackName.includes("ウインド")
    ) {
        attackType = "風";
        attackColor = "lime";
    } else {
        attackType = "ビーム";
        attackColor = "magenta";
    }
}

// =========================
// キー入力
// =========================

document.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

// =========================
// 敵を出す
// =========================

function spawnEnemy() {
    if (gameOver) return;

    let side = Math.floor(Math.random() * 4);
    let x;
    let y;

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

    enemies.push({
        x: x,
        y: y,
        size: 30,
        speed: 3,
        normalSpeed: 3,
        slowTime: 0
    });
}

// =========================
// 自動攻撃
// =========================

function createAttack() {
    if (gameOver) return;

    const centerX = player.x + player.size / 2;
    const centerY = player.y + player.size / 2;

    if (attackType === "炎") {
        createFireAttack(centerX, centerY);
    } else if (attackType === "雷") {
        createLightningAttack(centerX, centerY);
    } else if (attackType === "氷") {
        createIceAttack(centerX, centerY);
    } else if (attackType === "風") {
        createWindAttack(centerX, centerY);
    } else {
        createBeamAttack(centerX, centerY);
    }
}

// 炎：8方向に火の玉
function createFireAttack(x, y) {
    const bulletCount = 8;

    for (let i = 0; i < bulletCount; i++) {
        const angle = (Math.PI * 2 / bulletCount) * i;

        attacks.push({
            type: "fire",
            x: x,
            y: y,
            vx: Math.cos(angle) * 7,
            vy: Math.sin(angle) * 7,
            radius: 10,
            life: 100
        });
    }
}

// 雷：近い敵5体に落雷
function createLightningAttack(x, y) {
    const targets = [...enemies]
        .sort((a, b) => {
            const distanceA =
                Math.hypot(a.x - player.x, a.y - player.y);

            const distanceB =
                Math.hypot(b.x - player.x, b.y - player.y);

            return distanceA - distanceB;
        })
        .slice(0, 5);

    for (let target of targets) {
        attacks.push({
            type: "lightning",
            startX: x,
            startY: y,
            endX: target.x + target.size / 2,
            endY: target.y + target.size / 2,
            life: 12
        });

        const index = enemies.indexOf(target);

        if (index !== -1) {
            enemies.splice(index, 1);
            score++;
        }
    }
}

// 氷：12方向に氷弾、敵を遅くする
function createIceAttack(x, y) {
    const bulletCount = 12;

    for (let i = 0; i < bulletCount; i++) {
        const angle = (Math.PI * 2 / bulletCount) * i;

        attacks.push({
            type: "ice",
            x: x,
            y: y,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5,
            radius: 8,
            life: 120
        });
    }
}

// 風：広がる竜巻
function createWindAttack(x, y) {
    attacks.push({
        type: "wind",
        x: x,
        y: y,
        radius: 20,
        maxRadius: 180,
        life: 45
    });
}

// ビーム：最も近い敵に直線攻撃
function createBeamAttack(x, y) {
    if (enemies.length === 0) return;

    let nearestEnemy = enemies[0];
    let nearestDistance = Infinity;

    for (let enemy of enemies) {
        const distance = Math.hypot(
            enemy.x - player.x,
            enemy.y - player.y
        );

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestEnemy = enemy;
        }
    }

    attacks.push({
        type: "beam",
        startX: x,
        startY: y,
        endX: nearestEnemy.x + nearestEnemy.size / 2,
        endY: nearestEnemy.y + nearestEnemy.size / 2,
        life: 15
    });

    const index = enemies.indexOf(nearestEnemy);

    if (index !== -1) {
        enemies.splice(index, 1);
        score++;
    }
}

// =========================
// ゲーム更新
// =========================

function update() {
    if (gameOver) return;

    // プレイヤー移動
    if (keys["w"]) player.y -= player.speed;
    if (keys["s"]) player.y += player.speed;
    if (keys["a"]) player.x -= player.speed;
    if (keys["d"]) player.x += player.speed;

    // 画面外に出ないようにする
    player.x = Math.max(
        0,
        Math.min(canvas.width - player.size, player.x)
    );

    player.y = Math.max(
        0,
        Math.min(canvas.height - player.size, player.y)
    );

    // 敵の移動
    for (let enemy of enemies) {
        if (enemy.slowTime > 0) {
            enemy.slowTime--;
            enemy.speed = 1.2;
        } else {
            enemy.speed = enemy.normalSpeed;
        }

        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            enemy.x += dx / distance * enemy.speed;
            enemy.y += dy / distance * enemy.speed;
        }
    }

    // 攻撃の更新
    for (let attack of attacks) {
        attack.life--;

        if (attack.type === "fire" || attack.type === "ice") {
            attack.x += attack.vx;
            attack.y += attack.vy;
        }

        if (attack.type === "wind") {
            attack.radius += 4;
        }
    }

    // 炎・氷・風の当たり判定
    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        let defeated = false;

        for (let attack of attacks) {
            if (
                attack.type === "fire" ||
                attack.type === "ice"
            ) {
                const enemyCenterX =
                    enemy.x + enemy.size / 2;

                const enemyCenterY =
                    enemy.y + enemy.size / 2;

                const distance = Math.hypot(
                    enemyCenterX - attack.x,
                    enemyCenterY - attack.y
                );

                if (distance < enemy.size / 2 + attack.radius) {
                    if (attack.type === "ice") {
                        enemy.slowTime = 120;
                    }

                    enemies.splice(i, 1);
                    score++;
                    attack.life = 0;
                    defeated = true;
                    break;
                }
            }

            if (attack.type === "wind") {
                const enemyCenterX =
                    enemy.x + enemy.size / 2;

                const enemyCenterY =
                    enemy.y + enemy.size / 2;

                const distance = Math.hypot(
                    enemyCenterX - attack.x,
                    enemyCenterY - attack.y
                );

                if (
                    distance < attack.radius + 15 &&
                    distance > attack.radius - 20
                ) {
                    enemies.splice(i, 1);
                    score++;
                    defeated = true;
                    break;
                }
            }
        }

        if (defeated) continue;
    }

    // 寿命が切れた攻撃を消す
    attacks = attacks.filter((attack) => {
        if (attack.type === "wind") {
            return (
                attack.life > 0 &&
                attack.radius < attack.maxRadius
            );
        }

        return attack.life > 0;
    });
}

// =========================
// 描画
// =========================

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // プレイヤー
    ctx.fillStyle = "cyan";
    ctx.fillRect(
        player.x,
        player.y,
        player.size,
        player.size
    );

    // 敵
    ctx.fillStyle = "red";

    for (let enemy of enemies) {
        ctx.fillRect(
            enemy.x,
            enemy.y,
            enemy.size,
            enemy.size
        );
    }

    // 攻撃
    for (let attack of attacks) {
        if (attack.type === "fire") {
            ctx.fillStyle = "orange";
            ctx.beginPath();
            ctx.arc(
                attack.x,
                attack.y,
                attack.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        if (attack.type === "ice") {
            ctx.fillStyle = "cyan";
            ctx.beginPath();
            ctx.arc(
                attack.x,
                attack.y,
                attack.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        if (attack.type === "wind") {
            ctx.strokeStyle = "lime";
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.arc(
                attack.x,
                attack.y,
                attack.radius,
                0,
                Math.PI * 2
            );
            ctx.stroke();
        }

        if (attack.type === "lightning") {
            ctx.strokeStyle = "yellow";
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(
                attack.startX,
                attack.startY
            );

            ctx.lineTo(
                attack.endX,
                attack.endY
            );

            ctx.stroke();
        }

        if (attack.type === "beam") {
            ctx.strokeStyle = "magenta";
            ctx.lineWidth = 14;
            ctx.beginPath();
            ctx.moveTo(
                attack.startX,
                attack.startY
            );

            ctx.lineTo(
                attack.endX,
                attack.endY
            );

            ctx.stroke();
        }
    }

    // 情報表示
    ctx.fillStyle = "white";
    ctx.font = "26px sans-serif";
    ctx.textAlign = "left";

    ctx.fillText("TIME: " + timeLeft, 20, 40);
    ctx.fillText("SCORE: " + score, 20, 75);
    ctx.fillText("技名: " + attackName, 20, 110);
    ctx.fillText("属性: " + attackType, 20, 145);

    // ゲーム終了画面
    if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.fillStyle = "white";
        ctx.textAlign = "center";

        ctx.font = "50px sans-serif";
        ctx.fillText(
            "GAME OVER",
            canvas.width / 2,
            canvas.height / 2 - 60
        );

        ctx.font = "36px sans-serif";
        ctx.fillText(
            "SCORE: " + score,
            canvas.width / 2,
            canvas.height / 2
        );

        ctx.font = "28px sans-serif";
        ctx.fillText(
            "30秒で倒した敵の数",
            canvas.width / 2,
            canvas.height / 2 + 50
        );

        ctx.fillText(
            "使用した技：" + attackName,
            canvas.width / 2,
            canvas.height / 2 + 90
        );

        ctx.textAlign = "left";
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

// 最初に攻撃名を入力
setupAttack();

// ゲーム開始
gameLoop();

// 0.5秒ごとに敵を5体出す
setInterval(() => {
    if (!gameOver) {
        for (let i = 0; i < 5; i++) {
            spawnEnemy();
        }
    }
}, 500);

// 属性攻撃を自動発動
setInterval(createAttack, 700);

// タイマー
setInterval(() => {
    if (!gameOver) {
        timeLeft--;

        if (timeLeft <= 0) {
            timeLeft = 0;
            gameOver = true;
        }
    }
}, 1000);
