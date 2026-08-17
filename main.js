const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ゲームの状態: "start" / "input" / "result" / "playing" / "over"
let state = "start";
let dead = false;

const TOTAL_TIME = 60;

// =========================
// 画面（DOM）を作る
// =========================

const ui = document.createElement("div");
ui.innerHTML = `
<style>
.screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    color: white;
    font-family: sans-serif;
    background: rgba(0, 0, 0, 0.88);
    text-align: center;
    z-index: 10;
}
.screen h1 { font-size: 52px; margin: 0; }
.screen h2 { font-size: 36px; margin: 0; }
.screen p { font-size: 22px; margin: 0; color: #ccc; }
.screen .gen { font-size: 26px; color: white; }
.screen button {
    font-size: 26px;
    padding: 14px 60px;
    border: none;
    border-radius: 10px;
    background: orange;
    color: black;
    font-weight: bold;
    cursor: pointer;
}
.screen button:hover { background: gold; }
.screen input {
    font-size: 24px;
    padding: 12px 20px;
    border-radius: 10px;
    border: 3px solid orange;
    width: min(400px, 80vw);
    text-align: center;
}
</style>

<div id="startScreen" class="screen">
    <h1>生成AIサバイバルゲーム</h1>
    <p>攻撃名を入力して、AIが決めた攻撃で敵を倒そう！</p>
    <button id="startBtn">START</button>
</div>

<div id="inputScreen" class="screen" style="display:none">
    <h2>攻撃名を入力してください</h2>
    <input id="attackInput" placeholder="例：ファイヤーブレイク" maxlength="20">
    <button id="decideBtn">決定</button>
</div>

<div id="resultScreen" class="screen" style="display:none">
    <h2>AI生成結果</h2>
    <p id="genHeroEmoji" style="font-size:70px; margin:0"></p>
    <p class="gen" id="genHero"></p>
    <p class="gen" id="genAttack"></p>
    <p id="genReason" style="font-size:19px; color:#ffd479; max-width:600px; margin:0 20px"></p>
    <p class="gen" id="genEnemy1"></p>
    <p class="gen" id="genEnemy2"></p>
    <p class="gen" id="genEnemy3"></p>
    <button id="playBtn">ゲーム開始</button>
</div>
`;
document.body.appendChild(ui);

function showScreen(id) {
    for (let s of document.querySelectorAll(".screen")) {
        s.style.display = "none";
    }
    if (id) document.getElementById(id).style.display = "flex";
}

// =========================
// サウンド（Web Audio APIで生成、音声ファイル不要）
// =========================

let audioCtx = null;
let masterGain = null;
let bgmTimer = null;
let bgmStep = 0;
let lastKillSound = 0;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
}

// 音を1つ鳴らす（freqからslideToへ音程が変化）
function tone(freq, dur, type, vol, slideTo, delay) {
    if (!audioCtx) return;
    let t = audioCtx.currentTime + (delay || 0);
    let osc = audioCtx.createOscillator();
    let g = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + dur);
}

// ノイズ音（爆発・風など）
function noise(dur, vol, filterFreq) {
    if (!audioCtx) return;
    let t = audioCtx.currentTime;
    let len = Math.floor(audioCtx.sampleRate * dur);
    let buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    let data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    let src = audioCtx.createBufferSource();
    src.buffer = buf;
    let filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq || 1000;
    let g = audioCtx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    src.start(t);
}

// 効果音
const SFX = {
    "炎": () => noise(0.25, 0.25, 800),
    "雷": () => { noise(0.12, 0.3, 4000); tone(120, 0.2, "sawtooth", 0.2); },
    "氷": () => tone(1200, 0.15, "sine", 0.15, 400),
    "風": () => noise(0.4, 0.15, 500),
    "ビーム": () => tone(900, 0.25, "sawtooth", 0.18, 150),
    kill: () => tone(600, 0.08, "square", 0.12, 1200),
    bossWarn: () => {
        tone(440, 0.3, "square", 0.25);
        tone(330, 0.3, "square", 0.25, null, 0.35);
        tone(440, 0.3, "square", 0.25, null, 0.7);
    },
    gameover: () => {
        tone(400, 0.3, "triangle", 0.3, 200);
        tone(300, 0.5, "triangle", 0.3, 120, 0.3);
    },
    survived: () => {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "triangle", 0.25, null, i * 0.15));
    }
};

// 敵撃破音（鳴りすぎ防止つき）
function playKill() {
    if (!audioCtx) return;
    if (audioCtx.currentTime - lastKillSound < 0.06) return;
    lastKillSound = audioCtx.currentTime;
    SFX.kill();
}

// シンプルなループBGM（プレイ中だけ鳴る）
const BGM_NOTES = [110, 110, 165, 110, 131, 131, 196, 165];
function startBGM() {
    if (bgmTimer) return;
    bgmTimer = setInterval(() => {
        if (state !== "playing" || !audioCtx) return;
        let f = BGM_NOTES[bgmStep % BGM_NOTES.length];
        tone(f, 0.15, "triangle", 0.1);
        if (bgmStep % 2 === 0) tone(f * 2, 0.1, "square", 0.04);
        if (timeLeft <= 10) noise(0.03, 0.08, 6000);   // ラスト10秒は焦る音
        bgmStep++;
    }, 250);
}

// =========================
// AI生成（攻撃名の分類＋名前生成）
// =========================

let attackName = "";
let attackType = "";
let attackReason = "";
let heroName = "";
let enemyNames = { normal: "", fast: "", tank: "", boss: "" };

// 各属性のキーワード（はっきり一致した場合はこちらを優先）
const ELEMENT_KEYWORDS = {
    "炎": ["炎", "火", "ファイヤ", "フレイム", "バーン", "灼", "爆", "熱", "マグマ", "太陽"],
    "雷": ["雷", "サンダ", "電", "ライトニング", "スパーク", "プラズマ", "閃", "轟"],
    "氷": ["氷", "アイス", "雪", "フリーズ", "ブリザ", "凍", "冷", "白", "水", "海"],
    "風": ["風", "トルネード", "嵐", "ウインド", "ゲイル", "疾風", "空", "翼", "斬", "刃"],
    "ビーム": ["ビーム", "レーザー", "光", "星", "銀河", "宇宙", "波動", "オーラ", "神", "極"]
};

// 母音・語感から属性を推測するためのヒント
const VOWEL_ELEMENT = {
    "a": "炎",   // 開いた強い響き → 炎
    "i": "雷",   // 鋭い響き → 雷
    "u": "氷",   // こもった冷たい響き → 氷
    "e": "風",   // 抜ける響き → 風
    "o": "ビーム" // 重く伸びる響き → ビーム
};

// キーワード一致したときの理由文
function keywordReason(name, kw, type) {
    return "入力の中に「" + kw + "」が含まれていたため、" + type + "系と判定しました。";
}

// キーワードが無いときの、それっぽい理由文（属性ごと）
const GUESS_REASONS = {
    "炎": ["語感が力強く熱を感じさせるため", "破壊力の高そうな響きを持つため", "勢いのある攻撃的な名前のため"],
    "雷": ["音が鋭くスピード感があるため", "一瞬で決まりそうな切れ味を感じるため", "電撃のような響きを持つため"],
    "氷": ["どこか静かで冷たい印象を受けるため", "落ち着いた硬質な語感のため", "澄んだ響きを感じさせるため"],
    "風": ["軽やかで流れるような響きのため", "素早さを感じさせる名前のため", "空を切るような印象のため"],
    "ビーム": ["どの属性にも寄らない神秘的な響きのため", "エネルギーを凝縮したような語感のため", "未知の力を感じさせる名前のため"]
};

// 文字列から安定した数値を作る（同じ入力なら毎回同じ結果に）
function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h;
}

function classifyAttack(name) {
    let lower = name.toLowerCase();

    // 1. まずキーワードで判定（はっきり分かるものは正確に）
    for (let type in ELEMENT_KEYWORDS) {
        for (let kw of ELEMENT_KEYWORDS[type]) {
            if (name.includes(kw) || lower.includes(kw.toLowerCase())) {
                attackType = type;
                attackReason = keywordReason(name, kw, type);
                return;
            }
        }
    }

    // 2. キーワードが無い場合：母音の出現をスコア化して一番多い属性を選ぶ
    let scores = { "炎": 0, "雷": 0, "氷": 0, "風": 0, "ビーム": 0 };
    for (let ch of lower) {
        if (VOWEL_ELEMENT[ch]) scores[VOWEL_ELEMENT[ch]]++;
    }
    // 全角カタカナ等で母音が拾えないときのために、ハッシュで微妙な差をつける
    let h = hashString(name);
    let types = Object.keys(scores);
    scores[types[h % 5]] += 0.5;

    let best = "ビーム";
    let bestScore = -1;
    for (let type of types) {
        if (scores[type] > bestScore) {
            bestScore = scores[type];
            best = type;
        }
    }

    attackType = best;
    let reasons = GUESS_REASONS[best];
    attackReason = reasons[h % reasons.length] + "、" + best + "系と判定しました。";
}

const HERO_TITLES = {
    "炎": ["紅蓮の勇者", "灼熱の剣士", "炎帝"],
    "雷": ["迅雷の剣士", "雷鳴の勇者", "紫電の使い手"],
    "氷": ["氷結の魔導士", "白銀の騎士", "絶対零度の支配者"],
    "風": ["疾風の狩人", "嵐を呼ぶ者", "天翔の剣士"],
    "ビーム": ["星光の戦士", "銀河の守護者", "光速の勇者"]
};
const HERO_NAMES = ["レン", "ソラ", "カイ", "ユウキ", "アカリ", "ヒカル", "ミナト", "リク", "ツバサ", "ハヤテ"];

// 属性ごとの主人公の見た目とオーラの色
const HERO_EMOJI = {
    "炎": "🦸",
    "雷": "🥷",
    "氷": "🧙",
    "風": "🧝",
    "ビーム": "👨‍🚀"
};
const ELEMENT_COLORS = {
    "炎": "orange",
    "雷": "yellow",
    "氷": "cyan",
    "風": "lime",
    "ビーム": "magenta"
};
let heroEmoji = "🚀";
const ENEMY_ADJ = ["漆黒の", "混沌の", "深淵の", "暴走", "呪われし", "鋼鉄の", "冥界の", "狂乱の"];
const ENEMY_NOUN = {
    normal: ["インベーダー", "スライム", "ウォッチャー", "クリーパー"],
    fast: ["ファントム", "レイス", "シェイド", "スペクター"],
    tank: ["オーガ", "ゴーレム", "ベヒーモス", "ジャガーノート"],
    boss: ["竜王", "魔竜", "終焉竜", "冥竜"]
};

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateNames() {
    heroName = pick(HERO_TITLES[attackType]) + "・" + pick(HERO_NAMES);
    heroEmoji = HERO_EMOJI[attackType];
    enemyNames.normal = pick(ENEMY_ADJ) + pick(ENEMY_NOUN.normal);
    enemyNames.fast = pick(ENEMY_ADJ) + pick(ENEMY_NOUN.fast);
    enemyNames.tank = pick(ENEMY_ADJ) + pick(ENEMY_NOUN.tank);
    enemyNames.boss = pick(ENEMY_ADJ) + pick(ENEMY_NOUN.boss);
}

function getTitle(s) {
    if (s >= 150) return "伝説のAIマスター";
    if (s >= 100) return "超絶サバイバー";
    if (s >= 60) return "熟練モンスターハンター";
    if (s >= 30) return "見習い勇者";
    return "ひよっこ冒険者";
}

// =========================
// 画面フロー
// =========================

document.getElementById("startBtn").addEventListener("click", () => {
    initAudio();   // 音はユーザー操作の後でないと鳴らせないルールのためここで準備
    state = "input";
    showScreen("inputScreen");
    document.getElementById("attackInput").focus();
});

async function decide() {
    let name = document.getElementById("attackInput").value.trim();

    if (!name) {
        name = "ファイヤーブレイク";
    }

    attackName = name;

    let btn = document.getElementById("decideBtn");
    btn.textContent = "AIが考え中…";
    btn.disabled = true;

    try {
        const response = await fetch("https://open-campus-server.onrender.com/classify", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                attackName: attackName
            })
        });

        if (!response.ok) {
            throw new Error("サーバーエラー");
        }

        const data = await response.json();

        attackType = data.attackType;

        attackType = data.attackType;
        attackReason = data.reason;

        generateNames();

        document.getElementById("genHeroEmoji").textContent =
            heroEmoji;

        document.getElementById("genHero").textContent =
            "主人公名：" + heroName;

        document.getElementById("genAttack").textContent =
            "攻撃タイプ：" +
            attackType +
            "系（" +
            attackName +
            "）";

        document.getElementById("genReason").textContent =
            "🤖 AIの判定理由：" + attackReason;

        document.getElementById("genEnemy1").textContent =
            "敵キャラ名1：👾 " + enemyNames.normal;

        document.getElementById("genEnemy2").textContent =
            "敵キャラ名2：👻 " + enemyNames.fast;

        document.getElementById("genEnemy3").textContent =
            "敵キャラ名3：👹 " + enemyNames.tank;

        state = "result";
        showScreen("resultScreen");

    } catch (error) {

        console.error(error);

        alert(
            "AIとの通信に失敗しました。\n" +
            "server.jsが起動しているか確認してください。"
        );

    } finally {

        btn.textContent = "決定";
        btn.disabled = false;

    }
}

document.getElementById("decideBtn").addEventListener("click", decide);
document.getElementById("attackInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") decide();
});

document.getElementById("playBtn").addEventListener("click", () => {
    showScreen(null);
    if (document.activeElement) document.activeElement.blur();
    initAudio();
    startBGM();
    resetGame();
    state = "playing";
});

// =========================
// ゲームデータ
// =========================

let player = {};
let drones = [];
let enemies = [];
let attacks = [];
let bullets = [];
let popups = [];
let keys = {};

let weaponCooldown = 0;
let score = 0;
let timeLeft = TOTAL_TIME;
let bossSpawned = false;
let bossWarn = 0;

const DRONE_ORBIT = 70;
const DRONE_FIRE_RATE = 30;
const BULLET_DAMAGE = 3;

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
    timeLeft = TOTAL_TIME;
    bossSpawned = false;
    bossWarn = 0;
    dead = false;
}

// =========================
// 入力
// =========================

// e.code（物理キー）で判定するので、日本語入力がONのままでも動く
document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    keys[e.code] = true;
    if (state === "playing") e.preventDefault();   // 変換候補が出るのを防ぐ
});

document.addEventListener("keyup", (e) => {
    if (e.target.tagName === "INPUT") return;
    keys[e.code] = false;
});

canvas.addEventListener("click", () => {
    if (state === "over") {
        state = "start";
        showScreen("startScreen");
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

    let elapsed = TOTAL_TIME - timeLeft;
    let r = Math.random();
    let type;
    if (r < 0.25) {
        type = { emoji: "👻", size: 24, speed: 4.5, hp: 1, dmg: 0.1, point: 1 };
    } else if (r < 0.4 && elapsed >= 5) {
        type = { emoji: "👹", size: 44, speed: 1.3, hp: 10, dmg: 0.4, point: 3 };
    } else {
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
    SFX.bossWarn();
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
        playKill();
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

// ターゲティングAI：群れの中心（周囲120px以内に仲間が一番多い敵）を探す
function densestEnemy() {
    let best = null;
    let bestCount = -1;
    for (let e of enemies) {
        let count = 0;
        for (let o of enemies) {
            let dx = o.x - e.x;
            let dy = o.y - e.y;
            if (dx * dx + dy * dy < 120 * 120) count++;
        }
        if (count > bestCount) {
            bestCount = count;
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

    if (SFX[attackType]) SFX[attackType]();

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

// 炎：敵が密集している方向へ扇状に火の玉（威力3）
function createFireAttack(x, y) {
    let target = densestEnemy();
    let baseAngle;

    if (target) {
        baseAngle = Math.atan2(
            (target.y + target.size / 2) - y,
            (target.x + target.size / 2) - x
        );
    } else {
        baseAngle = Math.random() * Math.PI * 2;
    }

    // 群れの方向を中心に120度の扇で8発
    for (let i = 0; i < 8; i++) {
        let angle = baseAngle + (i - 3.5) / 7 * (Math.PI * 2 / 3);
        attacks.push({
            type: "fire",
            x: x, y: y,
            vx: Math.cos(angle) * 7,
            vy: Math.sin(angle) * 7,
            radius: 10, life: 100
        });
    }
}

// 雷：群れの中心付近の敵5体に落雷（威力4）
function createLightningAttack(x, y) {
    let center = densestEnemy();
    if (!center) return;

    let cx = center.x;
    let cy = center.y;

    let targets = [...enemies]
        .sort((a, b) => {
            let da = Math.hypot(a.x - cx, a.y - cy);
            let db = Math.hypot(b.x - cx, b.y - cy);
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
            damageEnemy(index, 4);
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

// ビーム：敵が密集している方向へ貫通ビーム（威力4）
function createBeamAttack(x, y) {
    let target = densestEnemy();
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

    for (let i = enemies.length - 1; i >= 0; i--) {
        let ex = (enemies[i].x + enemies[i].size / 2) - x;
        let ey = (enemies[i].y + enemies[i].size / 2) - y;
        let forward = ex * ux + ey * uy;
        let side = Math.abs(ex * uy - ey * ux);
        if (forward > 0 && side < 25) {
            damageEnemy(i, 4);
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
            // 1機目は一番近い敵（守り）、2機目は群れの中心（攻め）を狙う
            let target = (d === drones[0])
                ? nearestEnemy(d.x, d.y)
                : (densestEnemy() || nearestEnemy(d.x, d.y));
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

    if (keys["KeyW"] || keys["ArrowUp"]) player.y -= player.speed;
    if (keys["KeyS"] || keys["ArrowDown"]) player.y += player.speed;
    if (keys["KeyA"] || keys["ArrowLeft"]) player.x -= player.speed;
    if (keys["KeyD"] || keys["ArrowRight"]) player.x += player.speed;

    player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));

    for (let enemy of enemies) {
        let sp = enemy.speed;
        if (enemy.slowTime > 0) {
            enemy.slowTime--;
            sp = enemy.speed * 0.4;
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
        SFX.gameover();
    }

    weaponCooldown--;
    if (weaponCooldown <= 0) {
        createAttack();
        weaponCooldown = 42;
    }

    updateDrones();

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
                    damageEnemy(j, a.type === "fire" ? 3 : 2);
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
                    damageEnemy(j, 3);
                }
            }
        }
    }
    attacks = attacks.filter(a => a.life > 0);

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

function drawGame() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

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

    // プレイヤー（属性色のオーラ付き）
    ctx.fillStyle = ELEMENT_COLORS[attackType] || "white";
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(playerCenterX(), playerCenterY(), player.size * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.font = player.size + "px sans-serif";
    ctx.fillText(heroEmoji, playerCenterX(), playerCenterY());

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
        ctx.globalAlpha = e.slowTime > 0 ? 0.6 : 1;
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
    ctx.fillText("主人公: " + heroName, 20, 110);
    ctx.fillText("技名: " + attackName + "（" + attackType + "系）", 20, 145);

    // ボス出現の警告
    if (bossWarn > 0) {
        ctx.textAlign = "center";
        ctx.globalAlpha = (Math.floor(bossWarn / 10) % 2 === 0) ? 1 : 0.3;
        ctx.fillStyle = "red";
        ctx.font = "bold 44px sans-serif";
        ctx.fillText("⚠️ BOSS「" + enemyNames.boss + "」出現 ⚠️", canvas.width / 2, canvas.height / 3);
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
    ctx.fillText(dead ? "GAME OVER" : "SURVIVED!", canvas.width / 2, canvas.height / 2 - 100);

    ctx.font = "36px sans-serif";
    ctx.fillText("SCORE: " + score, canvas.width / 2, canvas.height / 2 - 40);

    ctx.font = "32px sans-serif";
    ctx.fillStyle = "gold";
    ctx.fillText("称号：" + getTitle(score), canvas.width / 2, canvas.height / 2 + 10);

    ctx.fillStyle = "white";
    ctx.font = "26px sans-serif";
    ctx.fillText("主人公：" + heroName + "　使用した技：" + attackName, canvas.width / 2, canvas.height / 2 + 60);
    ctx.fillText("クリックでタイトルへ", canvas.width / 2, canvas.height / 2 + 110);

    ctx.textAlign = "left";
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state === "playing") {
        drawGame();
    } else if (state === "over") {
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
            SFX.survived();
        }
    }
}, 1000);
