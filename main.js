const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 40,
    speed: 8
};

let enemies = [];
let attacks = [];
let keys = {};

let score = 0;
let timeLeft = 30;
let gameOver = false;

document.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

function spawnEnemy() {
    if (gameOver) return;

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

    enemies.push({
        x: x,
        y: y,
        size: 30,
        speed: 3
    });
}

function createAttack() {
    if (gameOver) return;

    attacks.push({
        x: player.x + player.size / 2,
        y: player.y + player.size / 2,
        size: 80,
        life: 20
    });
}

function update() {
    if (gameOver) return;

    if (keys["w"]) player.y -= player.speed;
    if (keys["s"]) player.y += player.speed;
    if (keys["a"]) player.x -= player.speed;
    if (keys["d"]) player.x += player.speed;

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
    }

    for (let attack of attacks) {
        attack.life--;
    }

    attacks = attacks.filter(a => a.life > 0);

    for (let i = enemies.length - 1; i >= 0; i--) {
        for (let attack of attacks) {
            let dx = (enemies[i].x + enemies[i].size / 2) - attack.x;
            let dy = (enemies[i].y + enemies[i].size / 2) - attack.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < attack.size) {
                enemies.splice(i, 1);
                score++;
                break;
            }
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "cyan";
    ctx.fillRect(player.x, player.y, player.size, player.size);

    ctx.fillStyle = "red";
    for (let enemy of enemies) {
        ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);
    }

    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 5;
    for (let attack of attacks) {
        ctx.beginPath();
        ctx.arc(attack.x, attack.y, attack.size, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.fillStyle = "white";
    ctx.font = "28px sans-serif";
    ctx.fillText("TIME: " + timeLeft, 20, 40);
    ctx.fillText("SCORE: " + score, 20, 80);

    if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "white";
        ctx.font = "50px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 60);

        ctx.font = "36px sans-serif";
        ctx.fillText("SCORE: " + score, canvas.width / 2, canvas.height / 2);

        ctx.font = "28px sans-serif";
        ctx.fillText("30秒で倒した敵の数", canvas.width / 2, canvas.height / 2 + 50);

        ctx.textAlign = "left";
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

setInterval(() => {
    if (!gameOver) {
        for (let i = 0; i < 5; i++) {
            spawnEnemy();
        }
    }
}, 500);
setInterval(createAttack, 700);

setInterval(() => {
    if (!gameOver) {
        timeLeft--;

        if (timeLeft <= 0) {
            timeLeft = 0;
            gameOver = true;
        }
    }
}, 1000);