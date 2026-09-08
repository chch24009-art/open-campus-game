const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
 
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
 
// ゲームの状態: "start" / "input" / "result" / "playing" / "over"
let state = "start";
let dead = false;
 
// =========================
// 難易度設定（3パターン）
// =========================
 
const DIFFICULTY = {
    easy: {
        label: "かんたん",
        totalTime: 75,
        playerHp: 450,
        playerSpeed: 9,
        spawnCount: 3,
        spawnInterval: 600,
        enemySpeedMult: 0.75,
        enemyHpMult: 0.8,
        weaponCooldown: 36,
        bossHp: 40,
        bossTime: 10,
    },
    normal: {
        label: "ふつう",
        totalTime: 60,
        playerHp: 300,
        playerSpeed: 8,
        spawnCount: 5,
        spawnInterval: 500,
        enemySpeedMult: 1.0,
        enemyHpMult: 1.0,
        weaponCooldown: 42,
        bossHp: 60,
        bossTime: 10,
    },
    hard: {
        label: "むずかしい",
        totalTime: 45,
        playerHp: 200,
        playerSpeed: 8,
        spawnCount: 7,
        spawnInterval: 400,
        enemySpeedMult: 1.3,
        enemyHpMult: 1.3,
        weaponCooldown: 48,
        bossHp: 90,
        bossTime: 12,
    }
};
 
let currentDifficulty = "normal";
let diff = DIFFICULTY.normal;
 
// =========================
// 背景パーティクル（星空）
// =========================
 
const bgStars = [];
const bgParticles = [];
 
for (let i = 0; i < 120; i++) {
    bgStars.push({
        x: Math.random() * 2000,
        y: Math.random() * 2000,
        size: Math.random() * 2.5 + 0.5,
        speed: Math.random() * 0.3 + 0.05,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.03 + 0.01
    });
}
 
const BG_PARTICLE_COLORS = {
    "炎": ["#ff4500", "#ff6b35", "#ffa500", "#ff8c00"],
    "雷": ["#ffd700", "#ffff00", "#ffe44d", "#f0e68c"],
    "氷": ["#00e5ff", "#00bcd4", "#80deea", "#b2ebf2"],
    "風": ["#76ff03", "#69f0ae", "#b9f6ca", "#00e676"],
    "ビーム": ["#e040fb", "#ea80fc", "#ce93d8", "#f48fb1"]
};
 
function spawnBgParticle() {
    if (state !== "playing" || bgParticles.length > 40) return;
    let colors = BG_PARTICLE_COLORS[attackType] || ["#ffffff"];
    bgParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: 200 + Math.random() * 200,
        maxLife: 200 + Math.random() * 200,
        color: colors[Math.floor(Math.random() * colors.length)]
    });
}
 
function drawBackground() {
    let baseColor1 = "#0a0a1a";
    let baseColor2 = "#0d1025";
 
    if (state === "playing" || state === "over") {
        const gradColors = {
            "炎": ["#1a0800", "#0d0500"],
            "雷": ["#1a1500", "#0d0a00"],
            "氷": ["#001a1a", "#000d10"],
            "風": ["#0a1a00", "#050d00"],
            "ビーム": ["#14001a", "#0a000d"]
        };
        let gc = gradColors[attackType] || [baseColor1, baseColor2];
        baseColor1 = gc[0];
        baseColor2 = gc[1];
    }
 
    let grd = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2,
        Math.max(canvas.width, canvas.height) * 0.7
    );
 
    grd.addColorStop(0, baseColor1);
    grd.addColorStop(1, baseColor2);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
 
    for (let s of bgStars) {
        s.twinkle += s.twinkleSpeed;
        let alpha = 0.3 + Math.sin(s.twinkle) * 0.3;
        ctx.fillStyle = "rgba(200, 210, 255, " + alpha + ")";
        ctx.beginPath();
        ctx.arc(
            s.x % canvas.width,
            s.y % canvas.height,
            s.size,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
 
    for (let i = bgParticles.length - 1; i >= 0; i--) {
        let p = bgParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
 
        if (p.life <= 0) {
            bgParticles.splice(i, 1);
            continue;
        }
 
        let alpha = Math.min(1, p.life / p.maxLife) * 0.4;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
 
    ctx.globalAlpha = 1;
}
 
// =========================
// 画面（DOM）
// =========================
 
const ui = document.createElement("div");
ui.innerHTML = '\
<div id="startScreen" class="screen">\
    <h1>生成AIサバイバルゲーム</h1>\
    <p>攻撃名を入力して、AIが決めた攻撃で敵を倒そう！</p>\
    <p class="subtitle">WASDキーまたは矢印キーで移動 ─ 攻撃は自動</p>\
    <p style="font-size:18px; color:#ccd; margin-top:12px;">難易度を選んでください</p>\
    <div class="difficulty-select">\
        <button class="diff-btn diff-easy" data-diff="easy">\
            <span class="diff-icon">🌱</span>\
            <span class="diff-label">かんたん</span>\
            <span class="diff-desc">HP多め・敵少なめ<br>75秒サバイバル</span>\
        </button>\
        <button class="diff-btn diff-normal selected" data-diff="normal">\
            <span class="diff-icon">⚔️</span>\
            <span class="diff-label">ふつう</span>\
            <span class="diff-desc">バランス型<br>60秒サバイバル</span>\
        </button>\
        <button class="diff-btn diff-hard" data-diff="hard">\
            <span class="diff-icon">💀</span>\
            <span class="diff-label">むずかしい</span>\
            <span class="diff-desc">HP少なめ・敵多め<br>45秒サバイバル</span>\
        </button>\
    </div>\
    <button id="startBtn" style="margin-top:10px;">START</button>\
</div>\
\
<div id="inputScreen" class="screen" style="display:none">\
    <h2>攻撃名を入力してください</h2>\
    <input id="attackInput" placeholder="例：ファイヤーブレイク" maxlength="20">\
    <button id="decideBtn">決定</button>\
</div>\
\
<div id="resultScreen" class="screen" style="display:none">\
    <h2>AI生成結果</h2>\
    <p id="genHeroEmoji" style="font-size:70px; margin:0"></p>\
    <p class="gen" id="genHero"></p>\
    <p class="gen" id="genAttack"></p>\
    <p id="genReason" style="font-size:17px; color:#ffd479; max-width:600px; margin:0 20px"></p>\
    <p class="gen" id="genEnemy1"></p>\
    <p class="gen" id="genEnemy2"></p>\
    <p class="gen" id="genEnemy3"></p>\
    <p id="genDiff" style="font-size:16px; color:#aab; margin-top:4px;"></p>\
    <button id="playBtn">ゲーム開始</button>\
</div>\
\
<div id="rankingScreen" class="screen" style="display:none">\
    <h2>🏆 ランキング TOP10</h2>\
    <p id="rankingFinalScore" style="font-size:30px; margin:5px;"></p>\
    <p id="rankingFinalTitle" style="font-size:22px; color:gold; margin:5px;"></p>\
    <p id="rankingFinalAttack" style="font-size:18px; color:#ccd; margin:5px;"></p>\
    <div id="rankingInputArea" style="margin-top:10px;">\
        <input id="playerNameInput" placeholder="ニックネーム" maxlength="12">\
        <button id="registerRankingBtn">ランキング登録</button>\
    </div>\
    <p id="rankingMessage" style="color:#ffd479; min-height:24px;"></p>\
    <div id="rankingList" style="font-size:20px; line-height:1.7; min-width:560px; text-align:left;"></div>\
    <button id="backTitleBtn" style="margin-top:15px;">タイトルへ</button>\
</div>\
';
 
document.body.appendChild(ui);
 
document.querySelectorAll(".diff-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
        document.querySelectorAll(".diff-btn").forEach(function(b) {
            b.classList.remove("selected");
        });
 
        btn.classList.add("selected");
        currentDifficulty = btn.dataset.diff;
        diff = DIFFICULTY[currentDifficulty];
    });
});
 
function showScreen(id) {
    var screens = document.querySelectorAll(".screen");
 
    for (var i = 0; i < screens.length; i++) {
        screens[i].style.display = "none";
    }
 
    if (id) {
        document.getElementById(id).style.display = "flex";
    }
}
 
// =========================
// 共通ランキング
// =========================
 
let rankingSubmitted = false;
 
function elementIcon(type) {
    if (type === "炎") return "🔥";
    if (type === "雷") return "⚡";
    if (type === "氷") return "❄️";
    if (type === "風") return "🌪️";
    if (type === "ビーム") return "✨";
    return "";
}
 
async function loadRanking() {
    const list = document.getElementById("rankingList");
    list.textContent = "ランキング読み込み中…";
 
    try {
        const response = await fetch(
            "https://open-campus-server.onrender.com/ranking"
        );
 
        if (!response.ok) {
            throw new Error("ランキング取得失敗");
        }
 
        const ranking = await response.json();
        list.innerHTML = "";
 
        if (!Array.isArray(ranking) || ranking.length === 0) {
            list.textContent = "まだランキング登録がありません";
            return;
        }
 
        ranking.forEach(function(row, index) {
            const line = document.createElement("div");
 
            let rankText = (index + 1) + "位";
 
            if (index === 0) rankText = "🥇 1位";
            if (index === 1) rankText = "🥈 2位";
            if (index === 2) rankText = "🥉 3位";
 
            line.textContent =
                rankText +
                "　" +
                row.player_name +
                "　" +
                row.score +
                "点　" +
                elementIcon(row.attack_type) +
                row.attack_type +
                "「" +
                row.attack_name +
                "」";
 
            list.appendChild(line);
        });
 
    } catch (error) {
        console.error("ランキング取得エラー:", error);
        list.textContent = "ランキングを取得できませんでした";
    }
}
 
function openRankingScreen() {
    rankingSubmitted = false;
 
    document.getElementById("rankingFinalScore").textContent =
        "SCORE: " + score;
 
    document.getElementById("rankingFinalTitle").textContent =
        "称号：" + getTitle(score);
 
    document.getElementById("rankingFinalAttack").textContent =
        "技：" + attackName + "（" + attackType + "系）";
 
    document.getElementById("rankingMessage").textContent = "";
 
    const btn = document.getElementById("registerRankingBtn");
    btn.disabled = false;
    btn.textContent = "ランキング登録";
 
    showScreen("rankingScreen");
    loadRanking();
}
 
async function registerRanking() {
    if (rankingSubmitted) return;
 
    const input = document.getElementById("playerNameInput");
    const playerName = input.value.trim();
 
    if (!playerName) {
        document.getElementById("rankingMessage").textContent =
            "ニックネームを入力してください";
        input.focus();
        return;
    }
 
    const btn = document.getElementById("registerRankingBtn");
    btn.disabled = true;
    btn.textContent = "登録中…";
 
    try {
        const response = await fetch(
            "https://open-campus-server.onrender.com/ranking",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    playerName: playerName,
                    score: score,
                    attackName: attackName,
                    attackType: attackType
                })
            }
        );
 
        if (!response.ok) {
            throw new Error("ランキング登録失敗");
        }
 
        rankingSubmitted = true;
 
        document.getElementById("rankingMessage").textContent =
            "✅ ランキングに登録しました！";
 
        btn.textContent = "登録済み";
 
        await loadRanking();
 
    } catch (error) {
        console.error("ランキング登録エラー:", error);
 
        document.getElementById("rankingMessage").textContent =
            "ランキング登録に失敗しました";
 
        btn.disabled = false;
        btn.textContent = "ランキング登録";
    }
}
 
document.getElementById("registerRankingBtn")
    .addEventListener("click", registerRanking);
 
document.getElementById("playerNameInput")
    .addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            registerRanking();
        }
    });
 
document.getElementById("backTitleBtn")
    .addEventListener("click", function() {
        document.getElementById("attackInput").value = "";
        document.getElementById("playerNameInput").value = "";
 
        attackName = "";
        attackType = "";
        attackReason = "";
 
        state = "start";
        showScreen("startScreen");
    });

// =========================
// サウンド（Web Audio API）
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

    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
}

function tone(freq, dur, type, vol, slideTo, delay) {
    if (!audioCtx) return;

    let t = audioCtx.currentTime + (delay || 0);
    let osc = audioCtx.createOscillator();
    let g = audioCtx.createGain();

    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t);

    if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(
            slideTo,
            t + dur
        );
    }

    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(g);
    g.connect(masterGain);

    osc.start(t);
    osc.stop(t + dur);
}

function noise(dur, vol, filterFreq) {
    if (!audioCtx) return;

    let t = audioCtx.currentTime;
    let len = Math.floor(audioCtx.sampleRate * dur);

    let buf = audioCtx.createBuffer(
        1,
        len,
        audioCtx.sampleRate
    );

    let data = buf.getChannelData(0);

    for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    let src = audioCtx.createBufferSource();
    src.buffer = buf;

    let filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq || 1000;

    let g = audioCtx.createGain();

    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(
        0.001,
        t + dur
    );

    src.connect(filter);
    filter.connect(g);
    g.connect(masterGain);

    src.start(t);
}

const SFX = {
    "炎": function() {
        noise(0.25, 0.25, 800);
    },

    "雷": function() {
        noise(0.12, 0.3, 4000);
        tone(120, 0.2, "sawtooth", 0.2);
    },

    "氷": function() {
        tone(1200, 0.15, "sine", 0.15, 400);
    },

    "風": function() {
        noise(0.4, 0.15, 500);
    },

    "ビーム": function() {
        tone(900, 0.25, "sawtooth", 0.18, 150);
    },

    kill: function() {
        tone(600, 0.08, "square", 0.12, 1200);
    },

    bossWarn: function() {
        tone(440, 0.3, "square", 0.25);
        tone(330, 0.3, "square", 0.25, null, 0.35);
        tone(440, 0.3, "square", 0.25, null, 0.7);
    },

    gameover: function() {
        tone(400, 0.3, "triangle", 0.3, 200);
        tone(300, 0.5, "triangle", 0.3, 120, 0.3);
    },

    survived: function() {
        [523, 659, 784, 1047].forEach(function(f, i) {
            tone(
                f,
                0.18,
                "triangle",
                0.25,
                null,
                i * 0.15
            );
        });
    }
};

function playKill() {
    if (!audioCtx) return;

    if (
        audioCtx.currentTime - lastKillSound <
        0.06
    ) {
        return;
    }

    lastKillSound = audioCtx.currentTime;
    SFX.kill();
}

const BGM_NOTES = [
    110,
    110,
    165,
    110,
    131,
    131,
    196,
    165
];

function startBGM() {
    if (bgmTimer) return;

    bgmTimer = setInterval(function() {
        if (
            state !== "playing" ||
            !audioCtx
        ) {
            return;
        }

        let f =
            BGM_NOTES[
                bgmStep %
                BGM_NOTES.length
            ];

        tone(
            f,
            0.15,
            "triangle",
            0.1
        );

        if (bgmStep % 2 === 0) {
            tone(
                f * 2,
                0.1,
                "square",
                0.04
            );
        }

        if (timeLeft <= 10) {
            noise(
                0.03,
                0.08,
                6000
            );
        }

        bgmStep++;
    }, 250);
}

// =========================
// AI生成（攻撃名分類＋名前生成）
// =========================

let attackName = "";
let attackType = "";
let attackReason = "";
let heroName = "";

let enemyNames = {
    normal: "",
    fast: "",
    tank: "",
    boss: ""
};

const ELEMENT_KEYWORDS = {
    "炎": [
        "炎",
        "火",
        "ファイヤ",
        "フレイム",
        "バーン",
        "灼",
        "爆",
        "熱",
        "マグマ",
        "太陽"
    ],

    "雷": [
        "雷",
        "サンダ",
        "電",
        "ライトニング",
        "スパーク",
        "プラズマ",
        "閃",
        "轟"
    ],

    "氷": [
        "氷",
        "アイス",
        "雪",
        "フリーズ",
        "ブリザ",
        "凍",
        "冷",
        "白",
        "水",
        "海"
    ],

    "風": [
        "風",
        "トルネード",
        "嵐",
        "ウインド",
        "ゲイル",
        "疾風",
        "空",
        "翼",
        "斬",
        "刃"
    ],

    "ビーム": [
        "ビーム",
        "レーザー",
        "光",
        "星",
        "銀河",
        "宇宙",
        "波動",
        "オーラ",
        "神",
        "極"
    ]
};

const VOWEL_ELEMENT = {
    "a": "炎",
    "i": "雷",
    "u": "氷",
    "e": "風",
    "o": "ビーム"
};

function keywordReason(
    name,
    kw,
    type
) {
    return (
        "入力の中に「" +
        kw +
        "」が含まれていたため、" +
        type +
        "系と判定しました。"
    );
}

const GUESS_REASONS = {
    "炎": [
        "語感が力強く熱を感じさせるため",
        "破壊力の高そうな響きを持つため",
        "勢いのある攻撃的な名前のため"
    ],

    "雷": [
        "音が鋭くスピード感があるため",
        "一瞬で決まりそうな切れ味を感じるため",
        "電撃のような響きを持つため"
    ],

    "氷": [
        "どこか静かで冷たい印象を受けるため",
        "落ち着いた硬質な語感のため",
        "澄んだ響きを感じさせるため"
    ],

    "風": [
        "軽やかで流れるような響きのため",
        "素早さを感じさせる名前のため",
        "空を切るような印象のため"
    ],

    "ビーム": [
        "どの属性にも寄らない神秘的な響きのため",
        "エネルギーを凝縮したような語感のため",
        "未知の力を感じさせる名前のため"
    ]
};

function hashString(s) {
    let h = 0;

    for (let i = 0; i < s.length; i++) {
        h =
            (
                h * 31 +
                s.charCodeAt(i)
            ) >>> 0;
    }

    return h;
}

function classifyAttack(name) {
    let lower =
        name.toLowerCase();

    for (
        let type in ELEMENT_KEYWORDS
    ) {
        for (
            let kw of
            ELEMENT_KEYWORDS[type]
        ) {
            if (
                name.includes(kw) ||
                lower.includes(
                    kw.toLowerCase()
                )
            ) {
                attackType = type;

                attackReason =
                    keywordReason(
                        name,
                        kw,
                        type
                    );

                return;
            }
        }
    }

    let scores = {
        "炎": 0,
        "雷": 0,
        "氷": 0,
        "風": 0,
        "ビーム": 0
    };

    for (let ch of lower) {
        if (VOWEL_ELEMENT[ch]) {
            scores[
                VOWEL_ELEMENT[ch]
            ]++;
        }
    }

    let h = hashString(name);
    let types =
        Object.keys(scores);

    scores[
        types[h % 5]
    ] += 0.5;

    let best = "ビーム";
    let bestScore = -1;

    for (let type of types) {
        if (
            scores[type] >
            bestScore
        ) {
            bestScore =
                scores[type];
            best = type;
        }
    }

    attackType = best;

    let reasons =
        GUESS_REASONS[best];

    attackReason =
        reasons[
            h %
            reasons.length
        ] +
        "、" +
        best +
        "系と判定しました。";
}

const HERO_TITLES = {
    "炎": [
        "紅蓮の勇者",
        "灼熱の剣士",
        "炎帝"
    ],

    "雷": [
        "迅雷の剣士",
        "雷鳴の勇者",
        "紫電の使い手"
    ],

    "氷": [
        "氷結の魔導士",
        "白銀の騎士",
        "絶対零度の支配者"
    ],

    "風": [
        "疾風の狩人",
        "嵐を呼ぶ者",
        "天翔の剣士"
    ],

    "ビーム": [
        "星光の戦士",
        "銀河の守護者",
        "光速の勇者"
    ]
};

const HERO_NAMES = [
    "レン",
    "ソラ",
    "カイ",
    "ユウキ",
    "アカリ",
    "ヒカル",
    "ミナト",
    "リク",
    "ツバサ",
    "ハヤテ"
];

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

const ENEMY_ADJ = [
    "漆黒の",
    "混沌の",
    "深淵の",
    "暴走",
    "呪われし",
    "鋼鉄の",
    "冥界の",
    "狂乱の"
];

const ENEMY_NOUN = {
    normal: [
        "インベーダー",
        "スライム",
        "ウォッチャー",
        "クリーパー"
    ],

    fast: [
        "ファントム",
        "レイス",
        "シェイド",
        "スペクター"
    ],

    tank: [
        "オーガ",
        "ゴーレム",
        "ベヒーモス",
        "ジャガーノート"
    ],

    boss: [
        "竜王",
        "魔竜",
        "終焉竜",
        "冥竜"
    ]
};

function pick(arr) {
    return arr[
        Math.floor(
            Math.random() *
            arr.length
        )
    ];
}

function generateNames() {
    heroName =
        pick(
            HERO_TITLES[
                attackType
            ]
        ) +
        "・" +
        pick(HERO_NAMES);

    heroEmoji =
        HERO_EMOJI[
            attackType
        ];

    enemyNames.normal =
        pick(ENEMY_ADJ) +
        pick(
            ENEMY_NOUN.normal
        );

    enemyNames.fast =
        pick(ENEMY_ADJ) +
        pick(
            ENEMY_NOUN.fast
        );

    enemyNames.tank =
        pick(ENEMY_ADJ) +
        pick(
            ENEMY_NOUN.tank
        );

    enemyNames.boss =
        pick(ENEMY_ADJ) +
        pick(
            ENEMY_NOUN.boss
        );
}

function getTitle(s) {
    if (s >= 750) {
        return "👑 AI界の神";
    }

    if (s >= 725) {
        return "🌌 伝説を超えし者";
    }

    if (s >= 700) {
        return "🔥 無双のサバイバー";
    }

    if (s >= 675) {
        return "⚡ 超越者";
    }

    if (s >= 650) {
        return "💎 伝説のAIマスター";
    }

    if (s >= 625) {
        return "🏆 最強モンスターハンター";
    }

    if (s >= 600) {
        return "⚔️ 歴戦の勇者";
    }

    if (s >= 575) {
        return "🗡️ 熟練ハンター";
    }

    if (s >= 550) {
        return "✨ 一人前の勇者";
    }

    if (s >= 525) {
        return "🌱 見習い勇者";
    }

    if (s >= 500) {
        return "🐣 ひよっこ冒険者";
    }

    return "💀 まだまだ修行中";
}

// =========================
// 画面フロー
// =========================

document
    .getElementById("startBtn")
    .addEventListener(
        "click",
        function() {
            initAudio();

            diff =
                DIFFICULTY[
                    currentDifficulty
                ];

            state = "input";

            showScreen(
                "inputScreen"
            );

            document
                .getElementById(
                    "attackInput"
                )
                .focus();
        }
    );

async function decide() {
    let name =
        document
            .getElementById(
                "attackInput"
            )
            .value
            .trim();

    if (!name) {
        name =
            "ファイヤーブレイク";
    }

    attackName = name;

    let btn =
        document.getElementById(
            "decideBtn"
        );

    btn.textContent =
        "AIが考え中…";

    btn.disabled = true;

    try {
        const response =
            await fetch(
                "https://open-campus-server.onrender.com/classify",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify(
                        {
                            attackName:
                                attackName
                        }
                    )
                }
            );

        if (!response.ok) {
            throw new Error(
                "サーバーエラー"
            );
        }

        const data =
            await response.json();

        attackType =
            data.attackType;

        attackReason =
            data.reason;

    } catch (error) {
        console.warn(
            "サーバー接続失敗、ローカル分類を使用:",
            error
        );

        classifyAttack(
            attackName
        );
    }

    generateNames();

    document
        .getElementById(
            "genHeroEmoji"
        )
        .textContent =
        heroEmoji;

    document
        .getElementById(
            "genHero"
        )
        .textContent =
        "主人公名：" +
        heroName;

    document
        .getElementById(
            "genAttack"
        )
        .textContent =
        "攻撃タイプ：" +
        attackType +
        "系（" +
        attackName +
        "）";

    document
        .getElementById(
            "genReason"
        )
        .textContent =
        "🤖 AIの判定理由：" +
        attackReason;

    document
        .getElementById(
            "genEnemy1"
        )
        .textContent =
        "敵キャラ名1：👾 " +
        enemyNames.normal;

    document
        .getElementById(
            "genEnemy2"
        )
        .textContent =
        "敵キャラ名2：👻 " +
        enemyNames.fast;

    document
        .getElementById(
            "genEnemy3"
        )
        .textContent =
        "敵キャラ名3：👹 " +
        enemyNames.tank;

    document
        .getElementById(
            "genDiff"
        )
        .textContent =
        "難易度：" +
        diff.label +
        "（" +
        diff.totalTime +
        "秒）";

    state = "result";

    showScreen(
        "resultScreen"
    );

    btn.textContent = "決定";
    btn.disabled = false;
}

document
    .getElementById(
        "decideBtn"
    )
    .addEventListener(
        "click",
        decide
    );

document
    .getElementById(
        "attackInput"
    )
    .addEventListener(
        "keydown",
        function(e) {
            if (
                e.key ===
                "Enter"
            ) {
                decide();
            }
        }
    );

document
    .getElementById(
        "playBtn"
    )
    .addEventListener(
        "click",
        function() {
            showScreen(null);

            if (
                document.activeElement
            ) {
                document
                    .activeElement
                    .blur();
            }

            initAudio();
            startBGM();
            resetGame();

            state = "playing";

            startSpawnTimer();
        }
    );

// =========================
// ゲームデータ
// =========================

let player = {};
let drones = [];
let enemies = [];
let attacks = [];
let bullets = [];
let popups = [];
let items = [];
let keys = {};

let weaponCooldown = 0;
let score = 0;
let timeLeft = 60;
let bossSpawned = false;
let bossWarn = 0;

const DRONE_ORBIT = 70;
const DRONE_FIRE_RATE = 30;
const BULLET_DAMAGE = 3;

function resetGame() {
    player = {
        x:
            canvas.width /
            2,

        y:
            canvas.height /
            2,

        size: 40,
        speed:
            diff.playerSpeed,

        hp:
            diff.playerHp,

        maxHp:
            diff.playerHp
    };

    drones = [
        {
            angle: 0,
            size: 30,
            cooldown: 0,
            x: 0,
            y: 0
        },

        {
            angle: Math.PI,
            size: 30,
            cooldown: 15,
            x: 0,
            y: 0
        }
    ];

    enemies = [];
    attacks = [];
    bullets = [];
    popups = [];
    items = [];

    bgParticles.length = 0;

    weaponCooldown = 0;
    score = 0;

    timeLeft =
        diff.totalTime;

    bossSpawned = false;
    bossWarn = 0;
    dead = false;
}

// =========================
// 入力
// =========================

document.addEventListener("keydown", function(e) {
    if (e.target.tagName === "INPUT") return;

    keys[e.code] = true;

    if (state === "playing") {
        e.preventDefault();
    }
});

document.addEventListener("keyup", function(e) {
    if (e.target.tagName === "INPUT") return;

    keys[e.code] = false;
});

// =========================
// 敵
// =========================

function spawnEnemy() {
    if (enemies.length > 60) return;

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

    let elapsed =
        diff.totalTime -
        timeLeft;

    let r = Math.random();
    let type;

    if (r < 0.25) {
        type = {
            emoji: "👻",
            size: 24,
            speed:
                4.5 *
                diff.enemySpeedMult,
            hp:
                1 *
                diff.enemyHpMult,
            dmg: 0.1,
            point: 1
        };

    } else if (
        r < 0.4 &&
        elapsed >= 5
    ) {
        type = {
            emoji: "👹",
            size: 44,
            speed:
                1.3 *
                diff.enemySpeedMult,
            hp:
                10 *
                diff.enemyHpMult,
            dmg: 0.4,
            point: 3
        };

    } else {
        type = {
            emoji: "👾",
            size: 30,
            speed:
                2.5 *
                diff.enemySpeedMult,
            hp:
                3 *
                diff.enemyHpMult,
            dmg: 0.15,
            point: 1
        };
    }

    enemies.push({
        x: x,
        y: y,
        size: type.size,
        speed: type.speed,
        hp: type.hp,
        maxHp: type.hp,
        dmg: type.dmg,
        point: type.point,
        emoji: type.emoji,
        boss: false,
        hitCooldown: 0,
        slowTime: 0
    });
}

function spawnBoss() {
    bossWarn = 90;

    SFX.bossWarn();

    enemies.push({
        x:
            canvas.width / 2 -
            40,

        y: -100,

        size: 80,

        speed:
            1.8 *
            diff.enemySpeedMult,

        hp:
            diff.bossHp,

        maxHp:
            diff.bossHp,

        dmg: 1.0,
        point: 20,
        emoji: "🐲",
        boss: true,
        hitCooldown: 0,
        slowTime: 0
    });
}

function addPopup(
    x,
    y,
    text
) {
    popups.push({
        x: x,
        y: y,
        text: text,
        life: 40
    });
}

function damageEnemy(
    index,
    dmg
) {
    let e =
        enemies[index];

    if (!e) return;

    e.hp -= dmg;

    addPopup(
        e.x +
            e.size / 2,
        e.y,
        dmg
    );

    if (e.hp <= 0) {
        let dropX =
            e.x +
            e.size / 2;

        let dropY =
            e.y +
            e.size / 2;

        // 通常敵5%、ボス100%
        if (
            e.boss ||
            Math.random() <
                0.05
        ) {
            items.push({
                x: dropX,
                y: dropY,
                size: 30,
                heal: 50,
                life: 600
            });
        }

        enemies.splice(
            index,
            1
        );

        score +=
            e.point || 1;

        playKill();
    }
}

function playerCenterX() {
    return (
        player.x +
        player.size / 2
    );
}

function playerCenterY() {
    return (
        player.y +
        player.size / 2
    );
}

function nearestEnemy(
    x,
    y
) {
    let best = null;
    let bestDist =
        Infinity;

    for (let e of enemies) {
        let dx =
            e.x +
            e.size / 2 -
            x;

        let dy =
            e.y +
            e.size / 2 -
            y;

        let d =
            dx * dx +
            dy * dy;

        if (
            d <
            bestDist
        ) {
            bestDist = d;
            best = e;
        }
    }

    return best;
}

// =========================
// ターゲティングAI
// =========================

let cachedDensest = null;
let cachedDensestFrame = -1;
let frameCount = 0;

function densestEnemy() {
    if (
        cachedDensestFrame ===
        frameCount
    ) {
        return cachedDensest;
    }

    cachedDensestFrame =
        frameCount;

    let sample = enemies;

    if (
        enemies.length >
        30
    ) {
        sample = [];

        for (
            let i = 0;
            i < enemies.length;
            i += 3
        ) {
            sample.push(
                enemies[i]
            );
        }
    }

    let best = null;
    let bestCount = -1;

    for (let e of sample) {
        let count = 0;

        for (let o of enemies) {
            let dx =
                o.x -
                e.x;

            let dy =
                o.y -
                e.y;

            if (
                dx * dx +
                dy * dy <
                120 * 120
            ) {
                count++;
            }
        }

        if (
            count >
            bestCount
        ) {
            bestCount = count;
            best = e;
        }
    }

    cachedDensest = best;

    return best;
}

// =========================
// 属性攻撃
// =========================

function createAttack() {
    let cx =
        playerCenterX();

    let cy =
        playerCenterY();

    if (
        SFX[
            attackType
        ]
    ) {
        SFX[
            attackType
        ]();
    }

    if (
        attackType ===
        "炎"
    ) {
        createFireAttack(
            cx,
            cy
        );

    } else if (
        attackType ===
        "雷"
    ) {
        createLightningAttack(
            cx,
            cy
        );

    } else if (
        attackType ===
        "氷"
    ) {
        createIceAttack(
            cx,
            cy
        );

    } else if (
        attackType ===
        "風"
    ) {
        createWindAttack(
            cx,
            cy
        );

    } else {
        createBeamAttack(
            cx,
            cy
        );
    }
}

function createFireAttack(
    x,
    y
) {
    let target =
        densestEnemy();

    let baseAngle;

    if (target) {
        baseAngle =
            Math.atan2(
                target.y +
                    target.size / 2 -
                    y,

                target.x +
                    target.size / 2 -
                    x
            );
    } else {
        baseAngle =
            Math.random() *
            Math.PI *
            2;
    }

    for (
        let i = 0;
        i < 8;
        i++
    ) {
        let angle =
            baseAngle +
            (i - 3.5) /
                7 *
                (
                    Math.PI *
                    2 /
                    3
                );

        attacks.push({
            type: "fire",
            x: x,
            y: y,
            vx:
                Math.cos(
                    angle
                ) *
                7,

            vy:
                Math.sin(
                    angle
                ) *
                7,

            radius: 10,
            life: 100
        });
    }
}

function createLightningAttack(
    x,
    y
) {
    let center =
        densestEnemy();

    if (!center) return;

    let cx =
        center.x;

    let cy =
        center.y;

    let targets =
        [...enemies]
            .sort(
                function(
                    a,
                    b
                ) {
                    let da =
                        Math.hypot(
                            a.x -
                                cx,
                            a.y -
                                cy
                        );

                    let db =
                        Math.hypot(
                            b.x -
                                cx,
                            b.y -
                                cy
                        );

                    return da - db;
                }
            )
            .slice(
                0,
                5
            );

    for (
        let target of
        targets
    ) {
        attacks.push({
            type:
                "lightning",

            startX: x,
            startY: y,

            endX:
                target.x +
                target.size / 2,

            endY:
                target.y +
                target.size / 2,

            life: 12
        });

        let index =
            enemies.indexOf(
                target
            );

        if (
            index !== -1
        ) {
            damageEnemy(
                index,
                4
            );
        }
    }
}

function createIceAttack(
    x,
    y
) {
    for (
        let i = 0;
        i < 12;
        i++
    ) {
        let angle =
            (
                Math.PI *
                2 /
                12
            ) *
            i;

        attacks.push({
            type: "ice",
            x: x,
            y: y,

            vx:
                Math.cos(
                    angle
                ) *
                5,

            vy:
                Math.sin(
                    angle
                ) *
                5,

            radius: 8,
            life: 120
        });
    }
}

function createWindAttack(
    x,
    y
) {
    attacks.push({
        type: "wind",
        x: x,
        y: y,
        radius: 20,
        maxRadius: 180,
        life: 45
    });
}

function createBeamAttack(
    x,
    y
) {
    let target =
        densestEnemy();

    if (!target) return;

    let dx =
        target.x +
        target.size / 2 -
        x;

    let dy =
        target.y +
        target.size / 2 -
        y;

    let dist =
        Math.sqrt(
            dx * dx +
            dy * dy
        );

    if (dist === 0) {
        return;
    }

    let ux =
        dx /
        dist;

    let uy =
        dy /
        dist;

    attacks.push({
        type: "beam",
        startX: x,
        startY: y,

        endX:
            x +
            ux *
            2000,

        endY:
            y +
            uy *
            2000,

        life: 15
    });

    for (
        let i =
            enemies.length -
            1;
        i >= 0;
        i--
    ) {
        let ex =
            enemies[i].x +
            enemies[i].size / 2 -
            x;

        let ey =
            enemies[i].y +
            enemies[i].size / 2 -
            y;

        let forward =
            ex * ux +
            ey * uy;

        let side =
            Math.abs(
                ex * uy -
                ey * ux
            );

        if (
            forward > 0 &&
            side < 25
        ) {
            damageEnemy(
                i,
                4
            );
        }
    }
}

// =========================
// AIドローン
// =========================

function updateDrones() {
    for (
        let d of drones
    ) {
        d.angle += 0.05;

        d.x =
            playerCenterX() +
            Math.cos(
                d.angle
            ) *
            DRONE_ORBIT;

        d.y =
            playerCenterY() +
            Math.sin(
                d.angle
            ) *
            DRONE_ORBIT;

        d.cooldown--;

        if (
            d.cooldown <= 0
        ) {
            let target =
                d ===
                drones[0]
                    ? nearestEnemy(
                          d.x,
                          d.y
                      )
                    : (
                          densestEnemy() ||
                          nearestEnemy(
                              d.x,
                              d.y
                          )
                      );

            if (target) {
                let dx =
                    target.x +
                    target.size / 2 -
                    d.x;

                let dy =
                    target.y +
                    target.size / 2 -
                    d.y;

                let dist =
                    Math.sqrt(
                        dx * dx +
                        dy * dy
                    );

                if (
                    dist > 0
                ) {
                    bullets.push({
                        x: d.x,
                        y: d.y,

                        vx:
                            dx /
                            dist *
                            12,

                        vy:
                            dy /
                            dist *
                            12,

                        size: 5,
                        life: 60
                    });

                    d.cooldown =
                        DRONE_FIRE_RATE;
                }
            }
        }
    }
}

// =========================
// 更新
// =========================

function update() {
    if (
        state !==
        "playing"
    ) {
        return;
    }

    frameCount++;

    let margin = 400;

    for (
        let i =
            enemies.length -
            1;
        i >= 0;
        i--
    ) {
        let e =
            enemies[i];

        if (
            e.x <
                -margin ||
            e.x >
                canvas.width +
                    margin ||
            e.y <
                -margin ||
            e.y >
                canvas.height +
                    margin
        ) {
            enemies.splice(
                i,
                1
            );
        }
    }

    if (
        Math.random() <
        0.15
    ) {
        spawnBgParticle();
    }

    if (
        keys["KeyW"] ||
        keys["ArrowUp"]
    ) {
        player.y -=
            player.speed;
    }

    if (
        keys["KeyS"] ||
        keys["ArrowDown"]
    ) {
        player.y +=
            player.speed;
    }

    if (
        keys["KeyA"] ||
        keys["ArrowLeft"]
    ) {
        player.x -=
            player.speed;
    }

    if (
        keys["KeyD"] ||
        keys["ArrowRight"]
    ) {
        player.x +=
            player.speed;
    }

    player.x =
        Math.max(
            0,
            Math.min(
                canvas.width -
                    player.size,
                player.x
            )
        );

    player.y =
        Math.max(
            0,
            Math.min(
                canvas.height -
                    player.size,
                player.y
            )
        );

    for (
        let enemy of
        enemies
    ) {
        let sp =
            enemy.speed;

        if (
            enemy.slowTime >
            0
        ) {
            enemy.slowTime--;

            sp =
                enemy.speed *
                0.4;
        }

        let dx =
            player.x -
            enemy.x;

        let dy =
            player.y -
            enemy.y;

        let distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        if (
            distance > 0
        ) {
            enemy.x +=
                dx /
                distance *
                sp;

            enemy.y +=
                dy /
                distance *
                sp;
        }

        if (
            distance <
            (
                player.size +
                enemy.size
            ) /
                2
        ) {
            player.hp -=
                enemy.dmg;
        }

        if (
            enemy.hitCooldown >
            0
        ) {
            enemy.hitCooldown--;
        }
    }

    if (
        player.hp <= 0
    ) {
        player.hp = 0;
        dead = true;
        state = "over";

        SFX.gameover();

        if (spawnTimer) {
            clearInterval(
                spawnTimer
            );

            spawnTimer = null;
        }

        openRankingScreen();

        return;
    }

    weaponCooldown--;

    if (
        weaponCooldown <= 0
    ) {
        createAttack();

        weaponCooldown =
            diff.weaponCooldown;
    }

    updateDrones();

    for (
        let a of attacks
    ) {
        a.life--;

        if (
            a.type === "fire" ||
            a.type === "ice"
        ) {
            a.x += a.vx;
            a.y += a.vy;

            for (
                let j =
                    enemies.length -
                    1;
                j >= 0;
                j--
            ) {
                let ex =
                    enemies[j].x +
                    enemies[j].size / 2 -
                    a.x;

                let ey =
                    enemies[j].y +
                    enemies[j].size / 2 -
                    a.y;

                if (
                    Math.hypot(
                        ex,
                        ey
                    ) <
                    enemies[j].size /
                        2 +
                        a.radius
                ) {
                    if (
                        a.type ===
                        "ice"
                    ) {
                        enemies[
                            j
                        ].slowTime =
                            120;
                    }

                    damageEnemy(
                        j,
                        a.type ===
                            "fire"
                            ? 3
                            : 2
                    );

                    a.life = 0;
                    break;
                }
            }
        }

        if (
            a.type ===
            "wind"
        ) {
            a.radius += 4;

            if (
                a.radius >
                a.maxRadius
            ) {
                a.life = 0;
            }

            for (
                let j =
                    enemies.length -
                    1;
                j >= 0;
                j--
            ) {
                let e =
                    enemies[j];

                if (
                    e.hitCooldown >
                    0
                ) {
                    continue;
                }

                let d =
                    Math.hypot(
                        e.x +
                            e.size /
                                2 -
                            a.x,

                        e.y +
                            e.size /
                                2 -
                            a.y
                    );

                if (
                    d <
                        a.radius +
                            15 &&
                    d >
                        a.radius -
                            20
                ) {
                    e.hitCooldown =
                        20;

                    damageEnemy(
                        j,
                        3
                    );
                }
            }
        }
    }

    attacks =
        attacks.filter(
            function(a) {
                return (
                    a.life >
                    0
                );
            }
        );

    for (
        let i =
            bullets.length -
            1;
        i >= 0;
        i--
    ) {
        let b =
            bullets[i];

        b.x += b.vx;
        b.y += b.vy;
        b.life--;

        let hit = false;

        for (
            let j =
                enemies.length -
                1;
            j >= 0;
            j--
        ) {
            let dx =
                enemies[j].x +
                enemies[j].size /
                    2 -
                b.x;

            let dy =
                enemies[j].y +
                enemies[j].size /
                    2 -
                b.y;

            if (
                Math.sqrt(
                    dx * dx +
                    dy * dy
                ) <
                enemies[j].size /
                    2 +
                    b.size
            ) {
                damageEnemy(
                    j,
                    BULLET_DAMAGE
                );

                hit = true;

                break;
            }
        }

        if (
            hit ||
            b.life <= 0
        ) {
            bullets.splice(
                i,
                1
            );
        }
    }

    // =========================
    // 回復アイテム
    // =========================

    for (
        let i =
            items.length -
            1;
        i >= 0;
        i--
    ) {
        let item =
            items[i];

        item.life--;

        let dx =
            playerCenterX() -
            item.x;

        let dy =
            playerCenterY() -
            item.y;

        let distance =
            Math.hypot(
                dx,
                dy
            );

        if (
            distance <
            player.size / 2 +
                item.size / 2
        ) {
            let oldHp =
                player.hp;

            player.hp =
                Math.min(
                    player.maxHp,
                    player.hp +
                        item.heal
                );

            let healed =
                Math.round(
                    player.hp -
                        oldHp
                );

            if (
                healed > 0
            ) {
                addPopup(
                    playerCenterX(),
                    player.y -
                        10,
                    "❤️ +" +
                        healed
                );
            }

            items.splice(
                i,
                1
            );

            continue;
        }

        if (
            item.life <= 0
        ) {
            items.splice(
                i,
                1
            );
        }
    }

    for (
        let p of popups
    ) {
        p.y -= 1;
        p.life--;
    }

    popups =
        popups.filter(
            function(p) {
                return (
                    p.life >
                    0
                );
            }
        );

    if (
        bossWarn > 0
    ) {
        bossWarn--;
    }
}

// =========================
// 描画
// =========================

function drawPlayer() {
    ctx.font = player.size + "px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
        heroEmoji,
        player.x + player.size / 2,
        player.y + player.size / 2
    );

    // HPバー
    let barWidth = 60;
    let barHeight = 7;
    let hpRate = player.hp / player.maxHp;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(
        playerCenterX() - barWidth / 2,
        player.y - 14,
        barWidth,
        barHeight
    );

    if (hpRate > 0.5) {
        ctx.fillStyle = "#39ff6a";
    } else if (hpRate > 0.25) {
        ctx.fillStyle = "#ffd93d";
    } else {
        ctx.fillStyle = "#ff4d4d";
    }

    ctx.fillRect(
        playerCenterX() - barWidth / 2,
        player.y - 14,
        barWidth * Math.max(0, hpRate),
        barHeight
    );
}

function drawDrones() {
    for (let d of drones) {
        ctx.save();

        ctx.translate(d.x, d.y);

        ctx.shadowBlur = 15;
        ctx.shadowColor = ELEMENT_COLORS[attackType] || "white";

        ctx.fillStyle = ELEMENT_COLORS[attackType] || "white";

        ctx.beginPath();
        ctx.arc(
            0,
            0,
            d.size / 2,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.restore();
    }
}

function drawEnemies() {
    for (let e of enemies) {
        ctx.font = e.size + "px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (e.boss) {
            ctx.save();

            ctx.shadowBlur = 25;
            ctx.shadowColor = "red";

            ctx.fillText(
                e.emoji,
                e.x + e.size / 2,
                e.y + e.size / 2
            );

            ctx.restore();

            let bossBarWidth = 100;
            let bossRate = e.hp / e.maxHp;

            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(
                e.x + e.size / 2 - bossBarWidth / 2,
                e.y - 18,
                bossBarWidth,
                8
            );

            ctx.fillStyle = "#ff3333";
            ctx.fillRect(
                e.x + e.size / 2 - bossBarWidth / 2,
                e.y - 18,
                bossBarWidth * Math.max(0, bossRate),
                8
            );

        } else {
            ctx.fillText(
                e.emoji,
                e.x + e.size / 2,
                e.y + e.size / 2
            );
        }

        if (e.slowTime > 0) {
            ctx.strokeStyle = "cyan";
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.arc(
                e.x + e.size / 2,
                e.y + e.size / 2,
                e.size / 2 + 5,
                0,
                Math.PI * 2
            );
            ctx.stroke();
        }
    }
}

function drawAttacks() {
    for (let a of attacks) {

        if (a.type === "fire") {
            ctx.save();

            ctx.shadowBlur = 18;
            ctx.shadowColor = "orange";

            ctx.fillStyle = "orange";

            ctx.beginPath();
            ctx.arc(
                a.x,
                a.y,
                a.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();

            ctx.fillStyle = "yellow";

            ctx.beginPath();
            ctx.arc(
                a.x,
                a.y,
                a.radius * 0.5,
                0,
                Math.PI * 2
            );
            ctx.fill();

            ctx.restore();
        }

        if (a.type === "lightning") {
            ctx.save();

            ctx.strokeStyle = "yellow";
            ctx.lineWidth = 5;
            ctx.shadowBlur = 18;
            ctx.shadowColor = "yellow";

            ctx.beginPath();
            ctx.moveTo(
                a.startX,
                a.startY
            );

            let segments = 7;

            for (let i = 1; i < segments; i++) {
                let t = i / segments;

                let x =
                    a.startX +
                    (a.endX - a.startX) * t +
                    (Math.random() - 0.5) * 25;

                let y =
                    a.startY +
                    (a.endY - a.startY) * t +
                    (Math.random() - 0.5) * 25;

                ctx.lineTo(x, y);
            }

            ctx.lineTo(
                a.endX,
                a.endY
            );

            ctx.stroke();

            ctx.restore();
        }

        if (a.type === "ice") {
            ctx.save();

            ctx.translate(
                a.x,
                a.y
            );

            ctx.rotate(
                Math.atan2(
                    a.vy,
                    a.vx
                )
            );

            ctx.fillStyle = "cyan";
            ctx.shadowBlur = 12;
            ctx.shadowColor = "cyan";

            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(-8, -6);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-8, 6);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        if (a.type === "wind") {
            ctx.save();

            ctx.strokeStyle = "lime";
            ctx.lineWidth = 6;
            ctx.globalAlpha =
                Math.max(
                    0,
                    a.life / 45
                );

            ctx.shadowBlur = 15;
            ctx.shadowColor = "lime";

            ctx.beginPath();
            ctx.arc(
                a.x,
                a.y,
                a.radius,
                0,
                Math.PI * 2
            );
            ctx.stroke();

            ctx.restore();
        }

        if (a.type === "beam") {
            ctx.save();

            ctx.strokeStyle = "magenta";
            ctx.lineWidth = 18;
            ctx.globalAlpha =
                Math.max(
                    0.2,
                    a.life / 15
                );

            ctx.shadowBlur = 25;
            ctx.shadowColor = "magenta";

            ctx.beginPath();
            ctx.moveTo(
                a.startX,
                a.startY
            );

            ctx.lineTo(
                a.endX,
                a.endY
            );

            ctx.stroke();

            ctx.strokeStyle = "white";
            ctx.lineWidth = 5;

            ctx.beginPath();
            ctx.moveTo(
                a.startX,
                a.startY
            );

            ctx.lineTo(
                a.endX,
                a.endY
            );

            ctx.stroke();

            ctx.restore();
        }
    }
}

function drawBullets() {
    for (let b of bullets) {
        ctx.save();

        ctx.fillStyle =
            ELEMENT_COLORS[attackType] ||
            "white";

        ctx.shadowBlur = 12;
        ctx.shadowColor =
            ELEMENT_COLORS[attackType] ||
            "white";

        ctx.beginPath();

        ctx.arc(
            b.x,
            b.y,
            b.size,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}

function drawItems() {
    for (let item of items) {
        ctx.save();

        let pulse =
            1 +
            Math.sin(
                item.life * 0.1
            ) * 0.1;

        ctx.translate(
            item.x,
            item.y
        );

        ctx.scale(
            pulse,
            pulse
        );

        ctx.font =
            item.size +
            "px Arial";

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ff4d6d";

        ctx.fillText(
            "❤️",
            0,
            0
        );

        ctx.restore();
    }
}

function drawPopups() {
    for (let p of popups) {
        ctx.save();

        ctx.globalAlpha =
            Math.min(
                1,
                p.life / 15
            );

        ctx.font =
            "bold 18px Arial";

        ctx.textAlign = "center";

        if (
            String(p.text).includes(
                "❤️"
            )
        ) {
            ctx.fillStyle =
                "#65ff8a";
        } else {
            ctx.fillStyle =
                "white";
        }

        ctx.fillText(
            p.text,
            p.x,
            p.y
        );

        ctx.restore();
    }
}

function drawHUD() {
    ctx.save();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.font =
        "bold 24px Arial";

    ctx.fillStyle = "white";

    ctx.shadowBlur = 5;
    ctx.shadowColor = "black";

    ctx.fillText(
        "SCORE: " + score,
        20,
        20
    );

    ctx.fillText(
        "TIME: " + timeLeft,
        20,
        52
    );

    ctx.font = "18px Arial";

    ctx.fillText(
        "HP: " +
        Math.ceil(player.hp) +
        " / " +
        player.maxHp,
        20,
        86
    );

    ctx.fillText(
        "難易度: " +
        diff.label,
        20,
        114
    );

    ctx.fillText(
        "技: " +
        attackName,
        20,
        142
    );

    ctx.fillStyle =
        ELEMENT_COLORS[
            attackType
        ] ||
        "white";

    ctx.fillText(
        "属性: " +
        attackType,
        20,
        170
    );

    ctx.restore();
}

function drawBossWarning() {
    if (bossWarn <= 0) return;

    ctx.save();

    let alpha =
        0.5 +
        Math.sin(
            bossWarn * 0.4
        ) * 0.4;

    ctx.globalAlpha =
        Math.max(
            0.2,
            alpha
        );

    ctx.fillStyle =
        "rgba(180,0,0,0.25)";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.globalAlpha = 1;

    ctx.fillStyle =
        "#ff3333";

    ctx.font =
        "bold 52px Arial";

    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "middle";

    ctx.shadowBlur = 20;
    ctx.shadowColor =
        "red";

    ctx.fillText(
        "⚠ BOSS WARNING ⚠",
        canvas.width / 2,
        canvas.height / 2
    );

    ctx.restore();
}

function drawOver() {
    ctx.save();

    ctx.fillStyle =
        "rgba(0,0,0,0.65)";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "middle";

    ctx.shadowBlur = 15;
    ctx.shadowColor =
        dead
            ? "red"
            : "cyan";

    ctx.fillStyle =
        dead
            ? "#ff5555"
            : "#65f7ff";

    ctx.font =
        "bold 70px Arial";

    ctx.fillText(
        dead
            ? "GAME OVER"
            : "SURVIVED!",
        canvas.width / 2,
        canvas.height / 2 - 100
    );

    ctx.shadowBlur = 0;

    ctx.fillStyle =
        "white";

    ctx.font =
        "bold 34px Arial";

    ctx.fillText(
        "SCORE: " +
        score,
        canvas.width / 2,
        canvas.height / 2 - 25
    );

    ctx.fillStyle =
        "gold";

    ctx.font =
        "bold 28px Arial";

    ctx.fillText(
        getTitle(score),
        canvas.width / 2,
        canvas.height / 2 + 25
    );

    ctx.fillStyle =
        "#ddd";

    ctx.font =
        "20px Arial";

    ctx.fillText(
        heroName +
        " / " +
        attackName +
        "（" +
        attackType +
        "系）",
        canvas.width / 2,
        canvas.height / 2 + 70
    );

    ctx.fillText(
        "難易度：" +
        diff.label,
        canvas.width / 2,
        canvas.height / 2 + 105
    );

    ctx.restore();
}

function draw() {
    drawBackground();

    if (
        state === "playing" ||
        state === "over"
    ) {
        drawItems();
        drawEnemies();
        drawAttacks();
        drawBullets();
        drawDrones();
        drawPlayer();
        drawPopups();
        drawHUD();
        drawBossWarning();
    }

    if (state === "over") {
        drawOver();
    }
}

// =========================
// 敵スポーン
// =========================

let spawnTimer = null;

function startSpawnTimer() {
    if (spawnTimer) {
        clearInterval(
            spawnTimer
        );
    }

    spawnTimer =
        setInterval(
            function() {
                if (
                    state !==
                    "playing"
                ) {
                    return;
                }

                for (
                    let i = 0;
                    i <
                    diff.spawnCount;
                    i++
                ) {
                    spawnEnemy();
                }
            },
            diff.spawnInterval
        );
}

// =========================
// タイマー
// =========================

setInterval(
    function() {
        if (
            state !==
            "playing"
        ) {
            return;
        }

        timeLeft--;

        if (
            !bossSpawned &&
            timeLeft <=
                diff.bossTime
        ) {
            bossSpawned = true;
            spawnBoss();
        }

        if (
            timeLeft <= 0
        ) {
            timeLeft = 0;

            dead = false;
            state = "over";

            SFX.survived();

            if (spawnTimer) {
                clearInterval(
                    spawnTimer
                );

                spawnTimer = null;
            }

            openRankingScreen();
        }
    },
    1000
);

// =========================
// ランキング全削除・裏コマンド
// タイトル画面で rankreset と入力
// =========================

let secretCommand = "";

document.addEventListener(
    "keydown",
    async function(e) {
        if (
            state !==
            "start"
        ) {
            return;
        }

        if (
            e.target &&
            e.target.tagName ===
                "INPUT"
        ) {
            return;
        }

        if (
            e.key.length !== 1
        ) {
            return;
        }

        secretCommand +=
            e.key.toLowerCase();

        if (
            secretCommand.length >
            20
        ) {
            secretCommand =
                secretCommand.slice(
                    -20
                );
        }

        if (
            !secretCommand.endsWith(
                "rankreset"
            )
        ) {
            return;
        }

        secretCommand = "";

        const adminKey =
            prompt(
                "ランキング管理者キーを入力してください"
            );

        if (!adminKey) {
            return;
        }

        const confirmed =
            confirm(
                "ランキングをすべて削除します。\n本当に実行しますか？"
            );

        if (!confirmed) {
            return;
        }

        try {
            const response =
                await fetch(
                    "https://open-campus-server.onrender.com/ranking",
                    {
                        method:
                            "DELETE",

                        headers: {
                            "x-admin-key":
                                adminKey
                        }
                    }
                );

            let data = {};

            try {
                data =
                    await response.json();
            } catch (jsonError) {
                console.warn(
                    "レスポンスJSON取得失敗:",
                    jsonError
                );
            }

            if (!response.ok) {
                alert(
                    data.error ||
                    "ランキング削除に失敗しました"
                );

                return;
            }

            alert(
                "ランキングをすべて削除しました！"
            );

        } catch (error) {
            console.error(
                "ランキング削除エラー:",
                error
            );

            alert(
                "サーバーに接続できませんでした"
            );
        }
    }
);

// =========================
// ゲームループ
// =========================

function gameLoop() {
    update();
    draw();

    requestAnimationFrame(
        gameLoop
    );
}

gameLoop();
