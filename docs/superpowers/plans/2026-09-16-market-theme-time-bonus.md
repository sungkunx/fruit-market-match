# 노점 테마·시간 보너스·새 배경음 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매칭할 때 시간을 돌려받게 하고, 화면을 "과일 시장 노점" 테마로 바꾸고, 배경음을 비트 있는 곡으로 교체한다.

**Architecture:** 시간 보너스 계산은 `scoring.js`의 순수 함수로, 소리는 새 파일 `audio.js`(합성·스케줄러·음소거, 박자 패턴은 순수 함수)로 분리한다. `js_file.js`는 타이머와 화면 갱신, 소리 호출만 맡는다. 테마는 CSS 변수와 배경 장식 요소로만 그리고 새 그림 파일은 쓰지 않는다.

**Tech Stack:** 빌드 도구 없는 HTML/CSS/JavaScript, Web Audio API, Node 내장 `node:test` (현재 v24.7.0), Google Fonts `Fredoka`

**Spec:** `docs/superpowers/specs/2026-09-15-market-theme-time-bonus-design.md`

## Global Constraints

- npm 패키지·빌드 도구를 추가하지 않는다. `package.json`도 만들지 않는다.
- `audio.js`는 `board.js`, `scoring.js`와 같은 형식이다. 일반 `<script>`로 로드하고, 브라우저에서는 `window.GameAudio`, Node에서는 `module.exports`로 내보낸다. Node에서 `require` 할 때 `AudioContext`에 접근하지 않는다.
- 시간 보너스: 3개 +0.5초, 4개 +1초, 5개 이상 +2초. 연쇄 묶음에도 적용한다.
- 남은 시간은 `GAME_DURATION`(30초)을 넘지 않는다. 시간이 0이 된 뒤에는 보너스로 되살아나지 않는다.
- 헛밀기에는 불이익이 없다. 배수는 게임 중 줄어들지 않는다.
- 게임 화면 문구는 영어로 쓴다.
- `js_file.js`, `audio.js`는 4칸 들여쓰기, 세미콜론을 쓴다. 기존 한국어 주석은 그대로 둔다.
- 테마 색은 `css_file.css` 맨 위 `:root` 변수만 쓴다. 하드코딩한 보라·분홍 색은 남기지 않는다.
- `sw.js`, 앱 아이콘, 랭킹 이름 XSS는 이번에도 건드리지 않는다.
- **브라우저 확인은 항상 음소거로 한다.** 게임을 시작하기 전에 `GameAudio.setMuted(true)`(3번 태스크 이전에는 `audioContext`를 만든 뒤 `suspend()`)를 호출하고, 확인이 끝나면 서버를 멈추고 브라우저 탭을 닫는다.
- 모든 커밋 메시지 끝에 아래 줄을 넣는다.
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

## 파일 구조

| 파일 | 작업 | 태스크 |
|---|---|---|
| `scoring.js` | 시간 보너스 계산 함수 추가 | 1 |
| `tests/scoring.test.js` | 시간 보너스 테스트 추가 | 1 |
| `js_file.js` | 0.1초 타이머·`addTime`·`showTimeBonus` / 소리 호출·소리 버튼 / 배경 장식 생성·화면 상태 클래스 | 2, 4, 5 |
| `css_file.css` | 시간 보너스·소리 버튼 스타일 / 테마 전체 | 2, 4, 5, 6, 7 |
| `audio.js` (신규) | 오디오 초기화, 배경음, 효과음, 음소거 | 3 |
| `tests/audio.test.js` (신규) | 박자 패턴 테스트 | 3 |
| `index.html` | `audio.js` 로드·소리 버튼 / 글꼴 링크·배경 장식 마크업 | 4, 5 |

## 브라우저 확인 방법 (2, 4, 5, 6, 7번 태스크 공통)

프로젝트 폴더에서 서버를 띄운다. 브라우저 캐시 때문에 옛 파일이 보일 수 있으니 이전에 쓰지 않은 포트를 쓴다.

```bash
python3 -m http.server 8791
```

- `http://localhost:8791`을 열고 모바일 크기(375×812)로 맞춘다.
- 게임을 시작하기 전에 콘솔에서 음소거를 건다.
  - 3번 태스크 이후: `GameAudio.setMuted(true); updateSoundButtons();`
  - 그 이전: `initAudio(); audioContext.suspend();`
- 시작 버튼을 누르기 어려우면 콘솔에서 `startGame()`을 호출한다. 카운트다운 2초 뒤 게임이 시작된다. 시간을 늘리려면 `timeLeft = 9999; updateTimerBar();`.
- 브라우저 탭이 숨겨져 있으면 애니메이션이 멈춘다. 그때는 `window.animate = () => wait(300)`으로 대신하고 보고서에 적는다.
- `sw.js`의 `/html_file.html` 404와 서비스 워커 오류는 기존 문제이므로 무시한다.
- 확인이 끝나면 서버를 멈추고 열었던 탭을 닫는다.

---

### Task 1: 시간 보너스 계산

**Files:**
- Modify: `scoring.js`
- Modify: `tests/scoring.test.js` (파일 끝에 추가)

**Interfaces:**
- Consumes: 기존 `Scoring` 모듈 구조, 단계(step) 형식 `{ kind, chain, groups: [{ fruit, cells }] }`
- Produces:
  - `Scoring.timeBonusForSize(size) → 0.5 | 1 | 2`
  - `Scoring.stepTimeBonus(step) → number` (초, 소수 첫째 자리 반올림. `kind`가 `'match'`가 아니면 0)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/scoring.test.js` 끝에 추가한다. 파일 위쪽에 이미 있는 `group`, `step` 헬퍼를 그대로 쓴다.

```js
test('timeBonusForSize gives more seconds for bigger groups', () => {
    assert.equal(Scoring.timeBonusForSize(3), 0.5);
    assert.equal(Scoring.timeBonusForSize(4), 1);
    assert.equal(Scoring.timeBonusForSize(5), 2);
    assert.equal(Scoring.timeBonusForSize(6), 2);
});

test('stepTimeBonus adds up every group in the step', () => {
    assert.equal(Scoring.stepTimeBonus(step(1, [group('apple', 3)])), 0.5);
    assert.equal(Scoring.stepTimeBonus(step(2, [group('apple', 4), group('kiwi', 3)])), 1.5);
    assert.equal(Scoring.stepTimeBonus(step(1, [group('apple', 3), group('kiwi', 3), group('grape', 3)])), 1.5);
});

test('stepTimeBonus gives nothing for an item step', () => {
    assert.equal(Scoring.stepTimeBonus({ kind: 'item', chain: 0, groups: [] }), 0);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/*.test.js`
Expected: FAIL 3개. `Scoring.timeBonusForSize is not a function` 등

- [ ] **Step 3: 구현**

`scoring.js`에서 `const Scoring = { ... };` 줄 바로 위에 추가한다.

```js
    // Seconds added to the clock for a popped group.
    function timeBonusForSize(size) {
        if (size >= 5) return 2;
        if (size === 4) return 1;
        return 0.5;
    }

    // Seconds a single cascade step gives back. Item steps (phase 2) give none.
    function stepTimeBonus(step) {
        if (step.kind !== 'match') return 0;
        const total = step.groups.reduce((sum, group) => sum + timeBonusForSize(group.cells.length), 0);
        return Math.round(total * 10) / 10;
    }

```

내보내기 줄을 아래로 바꾼다.

```js
    const Scoring = { createScoreState, baseScore, matchStepScore, scoreMove, timeBonusForSize, stepTimeBonus };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/*.test.js`
Expected: PASS, `ℹ pass 32`, `ℹ fail 0`

- [ ] **Step 5: 커밋**

```bash
git add scoring.js tests/scoring.test.js
git commit -m "feat: add time bonus rules for matches

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 0.1초 타이머와 시간 보너스 표시

**Files:**
- Modify: `js_file.js` (`startTimer` 주변, `playSteps`, `actuallyStartGame`)
- Modify: `css_file.css` (파일 끝에 추가)

**Interfaces:**
- Consumes: `Scoring.stepTimeBonus` (Task 1), 기존 전역 `timeLeft`, `GAME_DURATION`, `gameRunning`, `timeUp`, `isAnimating`
- Produces:
  - 상수 `TIMER_TICK_MS = 100`, `HURRY_TIME = 5`
  - `round1(value)`, `updateTimerBar()`, `updateHurryState()`
  - `addTime(seconds) → number` (실제로 늘어난 초)
  - `showTimeBonus(seconds)`
  - `.timer-bar`에 `time-mid` / `time-low` / `timer-flash` 클래스, `.time-bonus` 요소

- [ ] **Step 1: 상수 추가**

`js_file.js`에서

```js
const SWIPE_THRESHOLD = 0.3; // fraction of a cell the finger must travel to count as a swipe
```

아래에 두 줄을 더한다.

```js
const TIMER_TICK_MS = 100;
const HURRY_TIME = 5; // seconds left when the warning and the faster music start
```

- [ ] **Step 2: 타이머 교체**

`function startTimer() { ... }` 전체를 아래로 바꾼다.

```js
function round1(value) {
    return Math.round(value * 10) / 10;
}

function updateTimerBar() {
    const ratio = timeLeft / GAME_DURATION;
    const timerBar = document.getElementById('timerBar');
    timerBar.style.width = ratio * 100 + '%';
    timerBar.classList.toggle('time-mid', ratio <= 0.5 && ratio > 0.25);
    timerBar.classList.toggle('time-low', ratio <= 0.25);
}

// The warning follows the clock both ways: time bonuses can push it back above 5s.
function updateHurryState() {
    const hurrying = timeLeft <= HURRY_TIME && timeLeft > 0;
    document.getElementById('sirenWarning').classList.toggle('siren-active', hurrying);
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft = Math.max(0, round1(timeLeft - TIMER_TICK_MS / 1000));
        updateTimerBar();
        updateHurryState();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (isAnimating) {
                // Let the running move and its chain finish, then finishTurn() ends the game
                timeUp = true;
            } else {
                endGame();
            }
        }
    }, TIMER_TICK_MS);
}

// Gives seconds back for a match, never past the starting time.
// Returns how many seconds were actually added.
function addTime(seconds) {
    if (!gameRunning || timeUp || timeLeft <= 0 || seconds <= 0) return 0;
    
    const next = Math.min(GAME_DURATION, round1(timeLeft + seconds));
    const added = round1(next - timeLeft);
    timeLeft = next;
    updateTimerBar();
    updateHurryState();
    return added;
}

function showTimeBonus(seconds) {
    const timerContainer = document.querySelector('.timer-container');
    const label = document.createElement('div');
    label.className = 'time-bonus';
    label.textContent = `+${seconds}s`;
    label.style.top = timerContainer.offsetTop + 'px';
    document.querySelector('.game-container').appendChild(label);
    setTimeout(() => label.remove(), 800);
    
    const timerBar = document.getElementById('timerBar');
    timerBar.classList.remove('timer-flash');
    void timerBar.offsetWidth; // restart the flash animation
    timerBar.classList.add('timer-flash');
}
```

- [ ] **Step 3: 단계마다 시간 보너스 적용**

`playSteps` 안의

```js
        score += stepScores[i];
        updateScoreDisplay();
```

를 아래로 바꾼다.

```js
        score += stepScores[i];
        updateScoreDisplay();
        const secondsAdded = addTime(Scoring.stepTimeBonus(step));
        if (secondsAdded > 0) {
            showTimeBonus(secondsAdded);
        }
```

- [ ] **Step 4: 새 게임에서 타이머 바 초기화**

`actuallyStartGame` 안의

```js
    const timerBar = document.getElementById('timerBar');
    timerBar.style.width = '100%';
```

를 아래로 바꾼다.

```js
    updateTimerBar();
    updateHurryState();
```

- [ ] **Step 5: 스타일 추가**

`css_file.css` 맨 끝에 추가한다. (테마는 6번 태스크에서 다시 정리하므로 지금은 임시 색을 쓴다.)

```css
.timer-bar.time-mid {
    background: #FFC53D;
}

.timer-bar.time-low {
    background: #E8413B;
}

.timer-bar.timer-flash {
    animation: timerFlash 0.3s ease-out;
}

@keyframes timerFlash {
    0%, 100% { filter: brightness(1); }
    40% { filter: brightness(1.8); }
}

.time-bonus {
    position: absolute;
    left: 50%;
    font-size: 20px;
    font-weight: bold;
    color: #6DB33F;
    text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
    pointer-events: none;
    z-index: 50;
    animation: timeBonusFloat 0.8s ease-out forwards;
}

@keyframes timeBonusFloat {
    0% { transform: translate(120px, 0) scale(0.7); opacity: 0; }
    25% { transform: translate(120px, -10px) scale(1.1); opacity: 1; }
    100% { transform: translate(120px, -34px) scale(1); opacity: 0; }
}
```

- [ ] **Step 6: 문법과 단위 테스트 확인**

Run: `node --check js_file.js && node --test tests/*.test.js`
Expected: 오류 없음, `ℹ pass 32`, `ℹ fail 0`

- [ ] **Step 7: 브라우저 확인**

"브라우저 확인 방법"대로 서버를 띄우고 콘솔에서 확인한다.

```js
initAudio(); audioContext.suspend();
startGame();
```

카운트다운이 끝난 뒤:

```js
(async () => {
  timeLeft = 12; updateTimerBar();
  const m = Board.findBestMove(board);
  handleSwap(m.a, m.b);
  await wait(1200);
  console.log({ timeLeft, timerClass: document.getElementById('timerBar').className });
})();
```

Expected: 타이머 바 오른쪽에 `+0.5s`/`+1s` 같은 초록 문구가 잠깐 떴다 사라지고, `timeLeft`가 12보다 커졌다가 다시 줄어든다. `timerClass`에 `time-mid`가 들어 있다.

이어서 상한과 경고를 확인한다.

```js
timeLeft = 29.8; updateTimerBar(); console.log(addTime(2), timeLeft);
timeLeft = 4; updateHurryState(); console.log(document.getElementById('sirenWarning').className);
console.log(addTime(3), timeLeft, document.getElementById('sirenWarning').className);
```

Expected: 첫 줄은 `0.2 30`, 둘째 줄은 `siren-warning siren-active`, 셋째 줄은 `3 7 siren-warning` (경고가 꺼짐).

마지막으로 게임을 끝까지 두고, 30초 게임이 정상으로 끝나며 타이머 바가 부드럽게 줄어드는지 본다.

- [ ] **Step 8: 커밋**

```bash
git add js_file.js css_file.css
git commit -m "feat: give time back for matches with a 0.1s timer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: 배경음·효과음 모듈

**Files:**
- Create: `audio.js`
- Create: `tests/audio.test.js`

**Interfaces:**
- Consumes: 없음 (다른 모듈을 불러오지 않는다)
- Produces: `GameAudio.init()`, `isMuted()`, `setMuted(muted)`, `startMusic()`, `stopMusic()`, `setIntensity(level 0~3)`, `setHurry(on)`, `playPop()`, `playSuccess(chain)`, `playFail()`, `musicStep(step, intensity) → [{ instrument, midi }]`
- 저장소 키: `localStorage`의 `fruitMarketSound` (`'on'` / `'off'`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/audio.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const GameAudio = require('../audio.js');

// Instrument names playing on one sixteenth step.
function names(step, intensity) {
    return GameAudio.musicStep(step, intensity).map(event => event.instrument).sort();
}

function find(step, intensity, instrument) {
    return GameAudio.musicStep(step, intensity).find(event => event.instrument === instrument);
}

// Every step of the 64-step loop, for the given instrument.
function stepsWith(instrument, intensity) {
    const steps = [];
    for (let step = 0; step < 64; step++) {
        if (find(step, intensity, instrument)) steps.push(step);
    }
    return steps;
}

test('at intensity 0 only kick, bass, and melody play', () => {
    for (let step = 0; step < 64; step++) {
        names(step, 0).forEach(instrument => {
            assert.ok(['kick', 'bass', 'melody'].includes(instrument), `${instrument} at step ${step}`);
        });
    }
});

test('the kick lands on every quarter note', () => {
    assert.deepEqual(stepsWith('kick', 0), [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60]);
});

test('the hat is added at intensity 1, on the off eighths', () => {
    assert.deepEqual(stepsWith('hat', 0), []);
    assert.deepEqual(stepsWith('hat', 1), [2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62]);
});

test('the clap is added at intensity 2, on beats 2 and 4', () => {
    assert.deepEqual(stepsWith('clap', 1), []);
    assert.deepEqual(stepsWith('clap', 2), [4, 12, 20, 28, 36, 44, 52, 60]);
});

test('the sparkle is added at intensity 3, on odd steps', () => {
    assert.deepEqual(stepsWith('sparkle', 2), []);
    const sparkleSteps = stepsWith('sparkle', 3);
    assert.equal(sparkleSteps.length, 32);
    sparkleSteps.forEach(step => assert.equal(step % 2, 1));
});

test('the bass follows the chord roots and jumps an octave on the off beat', () => {
    // C2, A1, F1, G1 for the C, Am, F, G bars.
    assert.equal(find(0, 0, 'bass').midi, 36);
    assert.equal(find(16, 0, 'bass').midi, 33);
    assert.equal(find(32, 0, 'bass').midi, 29);
    assert.equal(find(48, 0, 'bass').midi, 31);
    assert.equal(find(2, 0, 'bass').midi, 48);
    assert.equal(find(18, 0, 'bass').midi, 45);
});

test('the melody starts every bar and stays in C major', () => {
    const cMajor = [0, 2, 4, 5, 7, 9, 11];
    [0, 16, 32, 48].forEach(step => {
        assert.ok(find(step, 0, 'melody'), `bar starting at ${step} has no melody note`);
    });
    for (let step = 0; step < 64; step++) {
        const note = find(step, 0, 'melody');
        if (note) assert.ok(cMajor.includes(note.midi % 12), `step ${step} note ${note.midi} is out of key`);
    }
});

test('the loop repeats every 64 steps', () => {
    for (let step = 0; step < 64; step++) {
        assert.deepEqual(GameAudio.musicStep(step + 64, 3), GameAudio.musicStep(step, 3));
        assert.deepEqual(GameAudio.musicStep(step + 640, 1), GameAudio.musicStep(step, 1));
    }
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/audio.test.js`
Expected: FAIL. `Cannot find module '../audio.js'`

- [ ] **Step 3: 구현**

`audio.js`:

```js
// All game sound: the synthesized background track, the effect sounds, and mute.
(function (root) {
    'use strict';

    const STEPS_PER_BAR = 16;
    const LOOP_STEPS = 64;
    const NORMAL_BPM = 125;
    const HURRY_BPM = 145;
    const LOOKAHEAD_MS = 25;
    const SCHEDULE_AHEAD = 0.1; // seconds of music queued in advance
    const MUSIC_VOLUME = 0.35;
    const SFX_VOLUME = 0.8;
    const STORAGE_KEY = 'fruitMarketSound';

    // C, Am, F, G as MIDI notes around middle C.
    const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];

    // One note per sixteenth, null for a rest. Chord tones of the bar plus passing notes.
    const MELODY = [
        72, null, 76, null, 79, null, 76, null, 72, null, null, 74, 76, null, null, null,
        69, null, 72, null, 76, null, 72, null, 69, null, null, 71, 72, null, null, null,
        77, null, 81, null, 84, null, 81, null, 77, null, null, 79, 81, null, null, null,
        79, null, 74, null, 71, null, 74, null, 79, null, 81, null, 83, null, null, null
    ];

    // Which instruments play on a given sixteenth. Pure: no audio, safe to test in Node.
    function musicStep(step, intensity) {
        const index = ((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
        const bar = Math.floor(index / STEPS_PER_BAR);
        const beatStep = index % STEPS_PER_BAR;
        const chord = CHORDS[bar];
        const events = [];

        if (beatStep % 4 === 0) {
            events.push({ instrument: 'kick', midi: null });
        }
        if (beatStep % 2 === 0) {
            events.push({ instrument: 'bass', midi: chord[0] - 24 + (beatStep % 4 === 2 ? 12 : 0) });
        }
        if (MELODY[index] !== null) {
            events.push({ instrument: 'melody', midi: MELODY[index] });
        }
        if (intensity >= 1 && beatStep % 4 === 2) {
            events.push({ instrument: 'hat', midi: null });
        }
        if (intensity >= 2 && (beatStep === 4 || beatStep === 12)) {
            events.push({ instrument: 'clap', midi: null });
        }
        if (intensity >= 3 && beatStep % 2 === 1) {
            events.push({ instrument: 'sparkle', midi: chord[Math.floor(beatStep / 2) % 3] + 24 });
        }

        return events;
    }

    function midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    function readStoredMute() {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'off';
        } catch (error) {
            return false;
        }
    }

    function storeMute(muted) {
        try {
            localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
        } catch (error) {
            // Private mode or blocked storage: keep the choice for this session only.
        }
    }

    let context = null;
    let masterGain = null;
    let musicGain = null;
    let sfxGain = null;
    let noiseBuffer = null;
    let muted = readStoredMute();

    let schedulerId = null;
    let nextStep = 0;
    let nextStepTime = 0;
    let intensity = 0;
    let bpm = NORMAL_BPM;

    function init() {
        if (context) {
            if (!muted && context.state === 'suspended') context.resume();
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        context = new AudioContextClass();
        masterGain = context.createGain();
        masterGain.gain.value = muted ? 0 : 1;
        masterGain.connect(context.destination);

        musicGain = context.createGain();
        musicGain.gain.value = MUSIC_VOLUME;
        musicGain.connect(masterGain);

        sfxGain = context.createGain();
        sfxGain.gain.value = SFX_VOLUME;
        sfxGain.connect(masterGain);

        const frames = Math.floor(context.sampleRate * 0.4);
        noiseBuffer = context.createBuffer(1, frames, context.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < frames; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    function isMuted() {
        return muted;
    }

    function setMuted(nextMuted) {
        muted = nextMuted;
        storeMute(muted);
        if (masterGain) {
            masterGain.gain.setTargetAtTime(muted ? 0 : 1, context.currentTime, 0.01);
        }
        if (context && !muted && context.state === 'suspended') {
            context.resume();
        }
    }

    function envelope(target, time, peak, duration) {
        const gain = context.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(peak, time + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        gain.connect(target);
        return gain;
    }

    function playTone(target, time, { type, freq, endFreq, peak, duration, harmonic }) {
        const gain = envelope(target, time, peak, duration);
        const oscillator = context.createOscillator();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, time);
        if (endFreq) {
            oscillator.frequency.exponentialRampToValueAtTime(endFreq, time + duration);
        }
        oscillator.connect(gain);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.02);

        if (harmonic) {
            const harmonicGain = envelope(target, time, peak * 0.25, duration * 0.6);
            const harmonicOsc = context.createOscillator();
            harmonicOsc.type = 'sine';
            harmonicOsc.frequency.setValueAtTime(freq * 4, time);
            harmonicOsc.connect(harmonicGain);
            harmonicOsc.start(time);
            harmonicOsc.stop(time + duration);
        }
    }

    function playNoise(target, time, { filterType, frequency, peak, duration }) {
        const source = context.createBufferSource();
        source.buffer = noiseBuffer;
        const filter = context.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(frequency, time);
        const gain = envelope(target, time, peak, duration);
        source.connect(filter);
        filter.connect(gain);
        source.start(time);
        source.stop(time + duration + 0.02);
    }

    function playInstrument(event, time) {
        switch (event.instrument) {
            case 'kick':
                playTone(musicGain, time, { type: 'sine', freq: 150, endFreq: 45, peak: 0.9, duration: 0.15 });
                break;
            case 'bass':
                playTone(musicGain, time, { type: 'triangle', freq: midiToFreq(event.midi), peak: 0.5, duration: 0.18 });
                break;
            case 'melody':
                playTone(musicGain, time, { type: 'sine', freq: midiToFreq(event.midi), peak: 0.45, duration: 0.25, harmonic: true });
                break;
            case 'hat':
                playNoise(musicGain, time, { filterType: 'highpass', frequency: 7000, peak: 0.25, duration: 0.04 });
                break;
            case 'clap':
                playNoise(musicGain, time, { filterType: 'bandpass', frequency: 1500, peak: 0.4, duration: 0.12 });
                break;
            case 'sparkle':
                playTone(musicGain, time, { type: 'square', freq: midiToFreq(event.midi), peak: 0.08, duration: 0.08 });
                break;
        }
    }

    function stepDuration() {
        return 60 / bpm / 4;
    }

    function scheduler() {
        while (nextStepTime < context.currentTime + SCHEDULE_AHEAD) {
            musicStep(nextStep, intensity).forEach(event => playInstrument(event, nextStepTime));
            nextStepTime += stepDuration();
            nextStep++;
        }
    }

    function startMusic() {
        init();
        if (!context) return;
        stopMusic();
        nextStep = 0;
        nextStepTime = context.currentTime + 0.05;
        schedulerId = setInterval(scheduler, LOOKAHEAD_MS);
    }

    function stopMusic() {
        if (schedulerId !== null) {
            clearInterval(schedulerId);
            schedulerId = null;
        }
    }

    function setIntensity(level) {
        intensity = Math.max(0, Math.min(3, level));
    }

    function setHurry(on) {
        bpm = on ? HURRY_BPM : NORMAL_BPM;
    }

    function playPop() {
        if (!context) return;
        playTone(sfxGain, context.currentTime, { type: 'square', freq: 800, endFreq: 200, peak: 0.3, duration: 0.1 });
    }

    function playSuccess(chain = 1) {
        if (!context) return;
        const pitch = Math.pow(2, ((chain - 1) * 2) / 12);
        [523.25, 659.25, 783.99].forEach((freq, index) => {
            playTone(sfxGain, context.currentTime + index * 0.1, {
                type: 'sine',
                freq: freq * pitch,
                peak: 0.2,
                duration: 0.3
            });
        });
    }

    function playFail() {
        if (!context) return;
        playTone(sfxGain, context.currentTime, { type: 'sawtooth', freq: 200, endFreq: 100, peak: 0.2, duration: 0.5 });
    }

    const GameAudio = {
        init,
        isMuted,
        setMuted,
        startMusic,
        stopMusic,
        setIntensity,
        setHurry,
        playPop,
        playSuccess,
        playFail,
        musicStep
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = GameAudio;
    } else {
        root.GameAudio = GameAudio;
    }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/*.test.js`
Expected: PASS, `ℹ pass 40`, `ℹ fail 0`

- [ ] **Step 5: 커밋**

```bash
git add audio.js tests/audio.test.js
git commit -m "feat: add synthesized market beat and sound module

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: 게임에 소리 연결과 소리 버튼

**Files:**
- Modify: `js_file.js` (전역, 소리 함수 삭제, 호출 교체, 소리 버튼 함수)
- Modify: `index.html` (스크립트, 버튼 2개)
- Modify: `css_file.css` (파일 끝에 추가)

**Interfaces:**
- Consumes: `GameAudio` 전체 (Task 3), 기존 `updateComboEffects`, `startTimer`의 `updateHurryState` (Task 2)
- Produces: `updateSoundButtons()`, `toggleSound()`, `.sound-btn` 버튼 2개

- [ ] **Step 1: 오디오 전역과 옛 소리 함수 삭제**

`js_file.js`에서 아래 두 줄을 지운다.

```js
let audioContext;
let backgroundMusic;
```

이어서 `// Initialize audio context` 주석부터 `playFailSound` 함수 끝까지(즉 `initAudio`, `createBackgroundMusic`, `playPopSound`, `playSuccessSound`, `playFailSound` 다섯 함수와 그 주석)를 모두 지운다. 바로 다음 함수인 `function fruitSrc(fruit, frame) {`는 그대로 둔다.

- [ ] **Step 2: 소리 버튼 함수 추가**

`function fruitSrc(fruit, frame) {` 바로 위에 추가한다.

```js
function updateSoundButtons() {
    const label = GameAudio.isMuted() ? '🔇' : '🔊';
    document.querySelectorAll('.sound-btn').forEach(button => {
        button.textContent = label;
        button.setAttribute('aria-pressed', GameAudio.isMuted() ? 'true' : 'false');
    });
}

function toggleSound() {
    GameAudio.init();
    GameAudio.setMuted(!GameAudio.isMuted());
    updateSoundButtons();
}

```

- [ ] **Step 3: 소리 호출 교체**

`js_file.js`에서 아래를 각각 바꾼다.

`onGridPointerDown` 안:

```js
    playPopSound();
```
→
```js
    GameAudio.playPop();
```

`handleSwap`의 헛밀기 처리 안:

```js
        playFailSound();
```
→
```js
        GameAudio.playFail();
```

`playSteps` 안:

```js
        playSuccessSound(step.chain);
```
→
```js
        GameAudio.playSuccess(step.chain);
```

`startGame` 안:

```js
    // Initialize audio (after user gesture)
    if (!audioContext) {
        initAudio();
    }
```
→
```js
    // Initialize audio (after user gesture)
    GameAudio.init();
```

`onDecorationFruitClick` 안:

```js
    // 클릭 효과음 재생 (항상 재생)
    if (!audioContext) {
        initAudio();
    }
    if (audioContext) {
        playPopSound();
    }
```
→
```js
    // 클릭 효과음 재생 (항상 재생)
    GameAudio.init();
    GameAudio.playPop();
```

- [ ] **Step 4: 게임 시작·종료와 배경음 연결**

`actuallyStartGame` 안의

```js
    newBoard();
    updateDisplay();
    updateComboDisplay();
```
→
```js
    newBoard();
    updateDisplay();
    updateComboDisplay();
    GameAudio.setIntensity(0);
    GameAudio.setHurry(false);
```

같은 함수 안의

```js
    // Start background music
    backgroundMusic = createBackgroundMusic();
    backgroundMusic.start();
    
    startTimer();
```
→
```js
    GameAudio.startMusic();
    startTimer();
```

`endGame` 끝의

```js
    // Stop background music
    if (backgroundMusic) {
        backgroundMusic.stop();
    }
}
```
→
```js
    GameAudio.stopMusic();
}
```

`restartGame` 안의

```js
    // Stop background music
    if (backgroundMusic) {
        backgroundMusic.stop();
    }
    
    // Reset game state
```
→
```js
    GameAudio.stopMusic();
    
    // Reset game state
```

- [ ] **Step 5: 템포와 강도 연결**

`updateHurryState` 안의

```js
    const hurrying = timeLeft <= HURRY_TIME && timeLeft > 0;
    document.getElementById('sirenWarning').classList.toggle('siren-active', hurrying);
```
→
```js
    const hurrying = timeLeft <= HURRY_TIME && timeLeft > 0;
    document.getElementById('sirenWarning').classList.toggle('siren-active', hurrying);
    GameAudio.setHurry(hurrying);
```

`updateComboEffects` 안의

```js
    // Add combo effects based on multiplier level
    if (multiplier >= 3.0) {
        body.classList.add('combo-bg-3');
        grid.classList.add('combo-glow-3');
    } else if (multiplier >= 2.0) {
        body.classList.add('combo-bg-2');
        grid.classList.add('combo-glow-2');
    } else if (multiplier >= 1.5) {
        body.classList.add('combo-bg-1');
        grid.classList.add('combo-glow-1');
    }
```
→
```js
    // Add combo effects based on multiplier level
    if (multiplier >= 3.0) {
        body.classList.add('combo-bg-3');
        grid.classList.add('combo-glow-3');
        GameAudio.setIntensity(3);
    } else if (multiplier >= 2.0) {
        body.classList.add('combo-bg-2');
        grid.classList.add('combo-glow-2');
        GameAudio.setIntensity(2);
    } else if (multiplier >= 1.5) {
        body.classList.add('combo-bg-1');
        grid.classList.add('combo-glow-1');
        GameAudio.setIntensity(1);
    } else {
        GameAudio.setIntensity(0);
    }
```

- [ ] **Step 6: 초기화에 버튼 상태 반영**

파일 끝의

```js
loadGameData();
buildGrid();
```
→
```js
loadGameData();
updateSoundButtons();
buildGrid();
```

- [ ] **Step 7: HTML 수정**

`index.html`에서

```html
    <script src="board.js"></script>
```
→
```html
    <script src="audio.js"></script>
    <script src="board.js"></script>
```

```html
            <button class="restart-btn-game" onclick="restartGame()">🏠</button>
```
→
```html
            <button class="sound-btn" onclick="toggleSound()" aria-label="Toggle sound" aria-pressed="false">🔊</button>
            <button class="restart-btn-game" onclick="restartGame()">🏠</button>
```

```html
    <div class="start-screen" id="startScreen">
```
→
```html
    <div class="start-screen" id="startScreen">
        <button class="sound-btn start-sound-btn" onclick="toggleSound()" aria-label="Toggle sound" aria-pressed="false">🔊</button>
```

- [ ] **Step 8: 임시 스타일 추가**

`css_file.css` 맨 끝에 추가한다. (6번 태스크에서 나무 버튼으로 바뀐다.)

```css
.sound-btn {
    background: transparent;
    border: none;
    padding: 8px 10px;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
}

.start-sound-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;
}
```

- [ ] **Step 9: 문법과 남은 참조 확인**

Run: `grep -nE "audioContext|backgroundMusic|playPopSound|playSuccessSound|playFailSound|createBackgroundMusic|initAudio" js_file.js; node --check js_file.js && echo syntax-ok && node --test tests/*.test.js`
Expected: grep 결과 없음, `syntax-ok`, `ℹ pass 40`

- [ ] **Step 10: 브라우저 확인 (음소거)**

```js
GameAudio.setMuted(true); updateSoundButtons();
startGame();
```

확인할 것:
1. 콘솔 오류 없이 게임이 시작된다.
2. 소리 버튼이 두 화면 모두 🔇을 보여준다. 한 번 누르면 둘 다 🔊이 되고 `localStorage.getItem('fruitMarketSound')`가 `'on'`이다. 다시 눌러 음소거로 돌린다.
3. 새로고침 후에도 상태가 유지된다.
4. 콘솔에서 아래가 `true`를 출력한다 (게임이 끝나면 스케줄러가 멈추는지).
   ```js
   (async () => { restartGame(); await wait(300); console.log(GameAudio.isMuted()); })();
   ```
5. 소리를 켜고 한 판을 직접 들어 본다. 비트가 들리고, 콤보가 오르면 악기가 더해지고, 마지막 5초에 빨라지는지 확인한다. **이 확인이 끝나면 다시 음소거로 돌려놓는다.**

- [ ] **Step 11: 커밋**

```bash
git add js_file.js index.html css_file.css
git commit -m "feat: play the new beat and add a sound toggle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: 배경 장식과 화면 상태

**Files:**
- Modify: `index.html` (글꼴 링크, 배경 장식 마크업, `body` 클래스)
- Modify: `js_file.js` (장식 생성, 화면 상태 클래스)

**Interfaces:**
- Consumes: 없음 (스타일은 6번 태스크에서 들어온다)
- Produces:
  - `#stringLights` 안의 `.bulb` 12개, `#confetti` 안의 `span` 24개
  - `setupMarketDecorations()`
  - `body`의 `on-start` 클래스 (시작 화면이 떠 있는 동안)

이 태스크만 적용한 상태에서는 장식이 아직 스타일 없이 보인다. 6번 태스크에서 제자리를 찾는다.

- [ ] **Step 1: 글꼴과 배경 장식 마크업**

`index.html`에서

```html
    <link rel="stylesheet" href="css_file.css">
```
→
```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&display=swap">
    <link rel="stylesheet" href="css_file.css">
```

```html
<body>
    <div class="start-screen" id="startScreen">
```
→
```html
<body class="on-start">
    <div class="market-backdrop" aria-hidden="true">
        <div class="sunburst"></div>
        <div class="awning"></div>
        <div class="string-lights" id="stringLights"></div>
        <div class="confetti" id="confetti"></div>
        <div class="shelf"></div>
    </div>

    <div class="start-screen" id="startScreen">
```

- [ ] **Step 2: 장식 생성 함수**

`js_file.js`에서 `function updateSoundButtons() {` 바로 위에 추가한다.

```js
const BULB_COUNT = 12;
const CONFETTI_COUNT = 24;
const CONFETTI_COLORS = ['#E8413B', '#FFC53D', '#6DB33F', '#FF9F5A', '#FFF1D6'];

// Builds the light bulbs and confetti pieces once. CSS decides when they show.
function setupMarketDecorations() {
    const lights = document.getElementById('stringLights');
    for (let i = 0; i < BULB_COUNT; i++) {
        const bulb = document.createElement('span');
        bulb.className = 'bulb';
        bulb.style.marginTop = (i % 3) * 5 + 'px';
        bulb.style.animationDelay = (i * 0.1).toFixed(1) + 's';
        lights.appendChild(bulb);
    }
    
    const confetti = document.getElementById('confetti');
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const piece = document.createElement('span');
        piece.style.left = (i * 4 + Math.random() * 3).toFixed(1) + '%';
        piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        piece.style.animationDuration = (2.6 + Math.random() * 2).toFixed(1) + 's';
        piece.style.animationDelay = (Math.random() * 3).toFixed(1) + 's';
        confetti.appendChild(piece);
    }
}

```

- [ ] **Step 3: 화면 상태 클래스**

`startGame` 안의

```js
    // Hide start screen
    document.getElementById('startScreen').style.display = 'none';
```
→
```js
    // Hide start screen
    document.getElementById('startScreen').style.display = 'none';
    document.body.classList.remove('on-start');
```

`restartGame` 안의

```js
    // Hide game over screen and show start screen
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
```
→
```js
    // Hide game over screen and show start screen
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
    document.body.classList.add('on-start');
```

파일 끝의

```js
loadGameData();
updateSoundButtons();
```
→
```js
loadGameData();
setupMarketDecorations();
updateSoundButtons();
```

- [ ] **Step 4: 확인**

Run: `node --check js_file.js && node --test tests/*.test.js`
Expected: 오류 없음, `ℹ pass 40`

브라우저에서 (음소거 상태로) 콘솔 확인:

```js
({ bulbs: document.querySelectorAll('.bulb').length, confetti: document.querySelectorAll('.confetti span').length, bodyClass: document.body.className })
```

Expected: `{ bulbs: 12, confetti: 24, bodyClass: 'on-start' }`. `startGame()` 후에는 `bodyClass`가 빈 문자열이고, 🏠으로 돌아오면 다시 `on-start`가 된다.

- [ ] **Step 5: 커밋**

```bash
git add index.html js_file.js
git commit -m "feat: add market backdrop elements and start-screen state

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: 노점 테마 스타일

`css_file.css`만 고친다. 규칙은 "이 선택자의 블록 전체를 아래로 바꾼다" 방식이다. 선택자는 파일에서 유일하므로 검색해서 찾는다. 중복이 있는 경우에는 따로 적어 두었다.

**Files:**
- Modify: `css_file.css`

**Interfaces:**
- Consumes: 5번 태스크의 마크업(`.market-backdrop`, `.bulb`, `.confetti span`, `body.on-start`), 2번 태스크의 `.time-bonus`·`.timer-bar` 클래스, 4번 태스크의 `.sound-btn`
- Produces: `:root` 색 변수, 노점 테마 스타일 전체

- [ ] **Step 1: 깨진 줄 고치기**

파일에 아래 한 줄이 통째로 들어 있다 (줄바꿈이 문자 그대로 `\n`으로 들어간 기존 버그).

```
}\n\n.tutorial-btn:active, .ranking-btn:active, .start-btn:active {\n    transform: translateY(0px);\n}
```

이 줄 전체를 아래 한 줄로 바꾼다.

```css
}
```

- [ ] **Step 2: 색 변수 추가**

파일 맨 위(`* {` 규칙보다 앞)에 추가한다.

```css
:root {
    --wood-dark: #5A3310;
    --wood: #B9772F;
    --wood-light: #E3A857;
    --cream: #FFF4DC;
    --awning-red: #E8413B;
    --awning-cream: #FFF1D6;
    --sun: #FFD36E;
    --sunset: #FF9F5A;
    --leaf: #6DB33F;
    --gold: #FFC53D;
    --outline: 2px 2px 0 var(--wood-dark), -2px 2px 0 var(--wood-dark), 2px -2px 0 var(--wood-dark), -2px -2px 0 var(--wood-dark);
}
```

- [ ] **Step 3: 배경과 장식**

`body { ... }` 블록 전체를 아래로 바꾼다.

```css
body {
    font-family: 'Fredoka', 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif;
    font-weight: 500;
    color: var(--wood-dark);
    background: linear-gradient(180deg, var(--sun) 0%, var(--sunset) 100%);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition: background 0.6s ease;
}

.market-backdrop {
    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
}

.sunburst {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 200vmax;
    height: 200vmax;
    margin: -100vmax 0 0 -100vmax;
    opacity: 0.5;
    background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, 0.25) 0deg 7deg, rgba(255, 255, 255, 0) 7deg 20deg);
    animation: sunSpin 60s linear infinite;
}

@keyframes sunSpin {
    to { transform: rotate(360deg); }
}

.awning {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 52px;
    background: repeating-linear-gradient(90deg, var(--awning-red) 0 28px, var(--awning-cream) 28px 56px);
    border-bottom: 4px solid var(--wood-dark);
}

.awning::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 16px;
    background-image: radial-gradient(circle at 14px 0, var(--awning-red) 12px, rgba(0, 0, 0, 0) 13px),
        radial-gradient(circle at 42px 0, var(--awning-cream) 12px, rgba(0, 0, 0, 0) 13px);
    background-size: 56px 16px;
    background-repeat: repeat-x;
}

.string-lights {
    position: absolute;
    top: 74px;
    left: 0;
    right: 0;
    height: 30px;
    display: flex;
    justify-content: space-around;
    align-items: flex-start;
}

.string-lights::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 3px;
    background: rgba(90, 51, 16, 0.45);
}

.bulb {
    width: 12px;
    height: 16px;
    border-radius: 50% 50% 55% 55%;
    background: rgba(255, 255, 255, 0.35);
    border: 2px solid rgba(90, 51, 16, 0.4);
}

body.combo-bg-1 .bulb,
body.combo-bg-2 .bulb,
body.combo-bg-3 .bulb {
    background: var(--gold);
    border-color: var(--wood-dark);
    box-shadow: 0 0 14px var(--gold);
}

body.combo-bg-2 .bulb,
body.combo-bg-3 .bulb {
    animation: bulbBlink 1.2s ease-in-out infinite;
}

@keyframes bulbBlink {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.9); }
}

body.combo-bg-2 .sunburst,
body.combo-bg-3 .sunburst {
    animation-duration: 30s;
    opacity: 0.7;
}

.confetti {
    position: absolute;
    inset: 0;
    display: none;
}

body.combo-bg-3 .confetti {
    display: block;
}

.confetti span {
    position: absolute;
    top: 0;
    width: 10px;
    height: 14px;
    border-radius: 2px;
    animation: confettiFall linear infinite;
}

@keyframes confettiFall {
    0% { transform: translateY(-12vh) rotate(0deg); opacity: 0; }
    12% { opacity: 1; }
    100% { transform: translateY(112vh) rotate(540deg); opacity: 0.9; }
}

.shelf {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 40px;
    background: repeating-linear-gradient(90deg, var(--wood) 0 40px, var(--wood-light) 40px 80px);
    border-top: 4px solid var(--wood-dark);
}

body.on-start .game-container {
    visibility: hidden;
}
```

- [ ] **Step 4: 옛 콤보 배경 삭제**

`body.combo-bg-1 { ... }` 블록 전체를 아래로 바꾼다.

```css
body.combo-bg-2,
body.combo-bg-3 {
    background: linear-gradient(180deg, var(--sun) 0%, var(--sunset) 55%, #FF7EA8 100%);
}
```

이어서 아래 세 블록을 통째로 지운다 (Step 3에서 넣은 새 규칙과 이름이 겹치지 않는 옛 규칙들이다).

- `body.combo-bg-2 { ... }` (보라 그라데이션을 쓰는 옛 규칙)
- `body.combo-bg-3 { ... }` (같은 계열의 옛 규칙)
- `@keyframes gradientMove { ... }`

- [ ] **Step 5: 게임 화면 스타일**

아래 블록들을 각각 통째로 바꾼다.

`.game-container`:

```css
.game-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    position: relative;
    z-index: 1;
    transform: scale(0.95);
    transform-origin: center;
}
```

`.header`:

```css
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    width: 100%;
    max-width: 360px;
    margin-bottom: 14px;
    background: var(--wood);
    border: 4px solid var(--wood-dark);
    border-radius: 16px;
    padding: 8px 12px;
    box-shadow: 0 5px 0 var(--wood-dark);
}
```

`.score-label`:

```css
.score-label {
    font-size: 14px;
    font-weight: 700;
    color: var(--cream);
    letter-spacing: 1px;
}
```

`.score-value`:

```css
.score-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--cream);
    text-shadow: 2px 2px 0 var(--wood-dark);
}
```

`.combo-counter`:

```css
.combo-counter {
    font-size: 14px;
    font-weight: 700;
    color: var(--wood-dark);
    background: var(--cream);
    border: 3px solid var(--wood-dark);
    border-radius: 12px;
    padding: 2px 8px;
    min-width: 34px;
    text-align: center;
    transition: all 0.3s ease;
}
```

`.combo-counter.combo-active`:

```css
.combo-counter.combo-active {
    animation: comboGlow 0.8s ease-out;
    transform: scale(1.2);
    background: var(--gold);
    box-shadow: 0 0 20px var(--gold);
}
```

`@keyframes comboGlow`:

```css
@keyframes comboGlow {
    0% { transform: scale(1); box-shadow: 0 0 6px rgba(255, 197, 61, 0.4); }
    50% { transform: scale(1.35); box-shadow: 0 0 28px var(--gold); }
    100% { transform: scale(1.2); box-shadow: 0 0 20px var(--gold); }
}
```

`.multiplier`:

```css
.multiplier {
    font-size: 18px;
    font-weight: 700;
    color: var(--cream);
    text-shadow: 2px 2px 0 var(--wood-dark);
    transition: all 0.3s ease;
}
```

`.multiplier-boost`:

```css
.multiplier-boost {
    animation: multiplierBoost 0.8s ease-out;
    font-size: 26px !important;
    color: var(--gold) !important;
    text-shadow: 2px 2px 0 var(--wood-dark), 0 0 18px var(--gold) !important;
}
```

`.combo-text`:

```css
.combo-text {
    position: absolute;
    top: 46%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 34px;
    font-weight: 700;
    color: var(--cream);
    text-shadow: var(--outline);
    pointer-events: none;
    z-index: 100;
    opacity: 0;
}
```

`.timer-container`:

```css
.timer-container {
    width: 100%;
    max-width: 360px;
    height: 16px;
    background: var(--cream);
    border: 3px solid var(--wood-dark);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 14px;
}
```

`.timer-bar` (2번 태스크에서 파일 끝에 넣은 `.timer-bar.time-mid`, `.timer-bar.time-low`, `.timer-bar.timer-flash`, `@keyframes timerFlash`, `.time-bonus`, `@keyframes timeBonusFloat`, 4번 태스크의 `.sound-btn`, `.start-sound-btn` 블록은 모두 지우고, 아래 묶음이 그 자리를 대신한다):

```css
.timer-bar {
    height: 100%;
    background: var(--leaf);
    transition: width 0.1s linear, background 0.3s ease;
}

.timer-bar.time-mid {
    background: var(--gold);
}

.timer-bar.time-low {
    background: var(--awning-red);
}

.timer-bar.timer-flash {
    animation: timerFlash 0.3s ease-out;
}

@keyframes timerFlash {
    0%, 100% { filter: brightness(1); }
    40% { filter: brightness(1.8); }
}

.time-bonus {
    position: absolute;
    left: 50%;
    font-size: 20px;
    font-weight: 700;
    color: var(--leaf);
    text-shadow: var(--outline);
    pointer-events: none;
    z-index: 50;
    animation: timeBonusFloat 0.8s ease-out forwards;
}

@keyframes timeBonusFloat {
    0% { transform: translate(120px, 0) scale(0.7); opacity: 0; }
    25% { transform: translate(120px, -10px) scale(1.1); opacity: 1; }
    100% { transform: translate(120px, -34px) scale(1); opacity: 0; }
}

.sound-btn,
.restart-btn-game,
.close-btn {
    width: 40px;
    height: 40px;
    padding: 0;
    font-size: 20px;
    line-height: 1;
    color: var(--wood-dark);
    background: var(--wood-light);
    border: 3px solid var(--wood-dark);
    border-radius: 50%;
    box-shadow: 0 4px 0 var(--wood-dark);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.sound-btn:active,
.restart-btn-game:active,
.close-btn:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--wood-dark);
}

.start-sound-btn {
    position: absolute;
    top: 18px;
    right: 18px;
    z-index: 10;
}
```

이어서 아래 옛 블록들을 지운다.

- `.restart-btn-game { ... }`, `.restart-btn-game:hover { ... }`, `.restart-btn-game:active { ... }`
- `.close-btn { ... }`, `.close-btn:hover { ... }`

`.grid`:

```css
.grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(8, 1fr);
    gap: 4px;
    width: 100%;
    max-width: 360px;
    background: var(--cream);
    padding: 10px;
    border: 6px solid var(--wood);
    border-radius: 18px;
    box-shadow: 0 0 0 4px var(--wood-dark), 0 8px 0 var(--wood-dark);
    transition: box-shadow 0.3s ease;
    overflow: hidden;
    touch-action: none;
}
```

`.grid.combo-glow-1`:

```css
.grid.combo-glow-1 {
    box-shadow: 0 0 0 4px var(--wood-dark), 0 8px 0 var(--wood-dark), 0 0 22px var(--gold);
}
```

`.grid.combo-glow-2`:

```css
.grid.combo-glow-2 {
    animation: comboBoxGlow 1.5s ease-in-out infinite;
}
```

`.grid.combo-glow-3`:

```css
.grid.combo-glow-3 {
    animation: comboBoxGlow 0.7s ease-in-out infinite;
}

@keyframes comboBoxGlow {
    0%, 100% { box-shadow: 0 0 0 4px var(--wood-dark), 0 8px 0 var(--wood-dark), 0 0 20px var(--gold); }
    50% { box-shadow: 0 0 0 4px var(--wood-dark), 0 8px 0 var(--wood-dark), 0 0 46px var(--gold); }
}
```

이어서 `@keyframes pulseGlow1`, `@keyframes pulseGlow2`, `@keyframes pulseGlow3` 세 블록을 지운다.

`.cell`:

```css
.cell {
    background: rgba(90, 51, 16, 0.07);
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    position: relative;
    aspect-ratio: 1/1;
}
```

`.siren-active`:

```css
.siren-active {
    animation: sirenPulse 0.6s ease-in-out infinite;
}
```

`@keyframes sirenFlash` (이름까지 바뀐다):

```css
@keyframes sirenPulse {
    0%, 100% { box-shadow: inset 0 0 0 0 rgba(232, 65, 59, 0); }
    50% { box-shadow: inset 0 0 90px 24px rgba(232, 65, 59, 0.55); }
}
```

- [ ] **Step 6: 시작 화면과 버튼**

`.start-screen`:

```css
.start-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    z-index: 2000;
}
```

`.restart-btn` (버튼 공통 규칙이 여기로 들어간다):

```css
.tutorial-btn,
.ranking-btn,
.start-btn,
.restart-btn,
.submit-score-btn,
.skip-submit-btn {
    font-family: inherit;
    font-weight: 700;
    border: 4px solid var(--wood-dark);
    border-radius: 18px;
    box-shadow: 0 6px 0 var(--wood-dark);
    cursor: pointer;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.tutorial-btn:active,
.ranking-btn:active,
.start-btn:active,
.restart-btn:active,
.submit-score-btn:active,
.skip-submit-btn:active {
    transform: translateY(5px);
    box-shadow: 0 1px 0 var(--wood-dark);
}

.restart-btn {
    background: var(--leaf);
    color: var(--cream);
    padding: 14px 32px;
    font-size: 18px;
    margin-top: 18px;
}
```

이어서 `.restart-btn:hover { ... }` 블록을 지운다.

`.tutorial-btn, .ranking-btn, .start-btn` (세 선택자가 한 줄에 있는 블록):

```css
.tutorial-btn, .ranking-btn, .start-btn {
    padding: 14px 34px;
    font-size: 18px;
    min-width: 210px;
}
```

`.tutorial-btn` (단독 블록):

```css
.tutorial-btn,
.ranking-btn {
    background: var(--wood-light);
    color: var(--wood-dark);
}
```

이어서 `.ranking-btn { ... }` 단독 블록을 지운다.

`.start-btn` (단독 블록):

```css
.start-btn {
    background: var(--awning-red);
    color: var(--cream);
    font-size: 22px;
    padding: 16px 40px;
}
```

이어서 `.tutorial-btn:hover, .ranking-btn:hover, .start-btn:hover { ... }` 블록을 지운다.

`.score-stats`:

```css
.score-stats {
    position: relative;
    display: flex;
    justify-content: space-between;
    width: 100%;
    max-width: 350px;
    margin: 20px;
    background: var(--cream);
    border: 4px solid var(--wood-dark);
    border-radius: 18px;
    padding: 18px 20px;
    box-shadow: 0 6px 0 var(--wood-dark);
    transform: scale(0.9);
}

.score-stats::before,
.score-stats::after {
    content: '';
    position: absolute;
    top: 10px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--wood-dark);
    opacity: 0.55;
}

.score-stats::before { left: 12px; }

.score-stats::after { right: 12px; }
```

`.score-title`:

```css
.score-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--wood-dark);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

`.score-stats .score-value`:

```css
.score-stats .score-value {
    font-size: 28px;
    color: var(--awning-red);
    text-shadow: none;
}
```

- [ ] **Step 7: 팝업·게임 오버·카운트다운**

`.rule-title` — 파일에 **두 군데** 있다(하나는 시작 화면용 옛 규칙, 하나는 팝업용). **두 블록 모두** 아래로 바꾼다.

```css
.rule-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--awning-red);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
}
```

`.rule-text` — 마찬가지로 **두 블록 모두** 아래로 바꾼다.

```css
.rule-text {
    color: var(--wood-dark);
    font-size: 14px;
    line-height: 1.6;
    padding-left: 10px;
    margin-bottom: 15px;
}
```

`.popup-content`:

```css
.popup-content {
    background: var(--cream);
    border: 5px solid var(--wood-dark);
    border-radius: 22px;
    width: 90%;
    max-width: 400px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 10px 0 var(--wood-dark);
    transform: scale(0.8);
    transition: transform 0.3s ease;
}
```

`.popup-header`:

```css
.popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    background: var(--awning-red);
    border-bottom: 4px solid var(--wood-dark);
}
```

`.popup-header h2`:

```css
.popup-header h2 {
    margin: 0;
    color: var(--cream);
    font-size: 20px;
    text-shadow: 2px 2px 0 var(--wood-dark);
}
```

`.rank-item`:

```css
.rank-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: rgba(185, 119, 47, 0.18);
    border-radius: 12px;
    margin-bottom: 8px;
}
```

이어서 `.rank-item:hover { ... }` 블록을 지운다.

`.rank-item.your-rank`:

```css
.rank-item.your-rank {
    background: rgba(255, 197, 61, 0.35);
    border: 3px solid var(--gold);
    font-weight: 700;
}
```

`.rank-number`:

```css
.rank-number {
    font-weight: 700;
    color: var(--awning-red);
    min-width: 30px;
}
```

`.rank-name`:

```css
.rank-name {
    flex: 1;
    color: var(--wood-dark);
    margin-left: 15px;
}
```

`.rank-score`:

```css
.rank-score {
    color: var(--leaf);
    font-weight: 700;
    font-size: 16px;
}
```

`.loading`:

```css
.loading {
    text-align: center;
    color: var(--wood-dark);
    padding: 20px;
}
```

`.user-rank`:

```css
.user-rank {
    border-top: 2px solid rgba(90, 51, 16, 0.25);
    padding-top: 15px;
    margin-top: 15px;
}
```

`.game-over`:

```css
.game-over {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(90, 51, 16, 0.75);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}
```

`.game-over-content`:

```css
.game-over-content {
    background: var(--cream);
    border: 5px solid var(--wood-dark);
    padding: 32px 28px;
    border-radius: 22px;
    text-align: center;
    color: var(--wood-dark);
    box-shadow: 0 10px 0 var(--wood-dark);
}

.game-over-content h2 {
    color: var(--awning-red);
}
```

`.final-score`:

```css
.final-score {
    font-size: 40px;
    font-weight: 700;
    margin: 18px 0;
    color: var(--wood-dark);
}
```

`.new-record-text`:

```css
.new-record-text {
    color: var(--wood-dark);
    margin: 15px 0;
    font-size: 15px;
    font-weight: 700;
    text-align: center;
}
```

`.name-input`:

```css
.name-input {
    padding: 12px 15px;
    border-radius: 14px;
    border: 3px solid var(--wood-dark);
    margin: 15px 0;
    width: 220px;
    font-size: 16px;
    font-family: inherit;
    text-align: center;
    background: var(--cream);
    color: var(--wood-dark);
    outline: none;
}
```

이어서 `.name-input:focus { ... }` 블록을 지운다.

`.submit-score-btn, .skip-submit-btn` (두 선택자가 한 줄에 있는 블록):

```css
.submit-score-btn, .skip-submit-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    font-size: 15px;
    min-width: 130px;
    justify-content: center;
}
```

`.submit-score-btn` (단독 블록):

```css
.submit-score-btn {
    background: var(--leaf);
    color: var(--cream);
}
```

이어서 `.submit-score-btn:hover`, `.submit-score-btn:active`, `.skip-submit-btn:hover`, `.skip-submit-btn:active` 네 블록을 지운다.

`.skip-submit-btn` (단독 블록):

```css
.skip-submit-btn {
    background: var(--wood-light);
    color: var(--wood-dark);
}
```

`.submit-score-btn:disabled`:

```css
.submit-score-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}
```

`.countdown-overlay`:

```css
.countdown-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(90, 51, 16, 0.8);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 4000;
    opacity: 0;
    transition: opacity 0.3s ease;
}
```

`.countdown-text`:

```css
.countdown-text {
    font-size: 76px;
    font-weight: 700;
    color: var(--cream);
    text-shadow: var(--outline);
    text-align: center;
    transform: scale(0.5);
    animation: countdownPulse 1s ease-out;
}
```

`.countdown-text.start`:

```css
.countdown-text.start {
    color: var(--leaf);
}
```

`.countdown-text.ready`:

```css
.countdown-text.ready {
    color: var(--gold);
}
```

- [ ] **Step 8: 동작 줄이기 대응**

파일 맨 끝에 추가한다.

```css
@media (prefers-reduced-motion: reduce) {
    .sunburst,
    .bulb,
    .confetti span,
    .grid.combo-glow-2,
    .grid.combo-glow-3,
    .siren-active {
        animation: none !important;
    }
}
```

- [ ] **Step 9: 남은 옛 색 확인**

Run: `grep -nE "#667eea|#764ba2|f093fb|f5576c|4ECDC4|FF6B6B|gradientMove|pulseGlow|sirenFlash" css_file.css`
Expected: 결과 없음

- [ ] **Step 10: 브라우저 확인과 스크린샷**

음소거 상태로 아래 화면을 순서대로 확인하고 스크린샷을 남긴다 (375×812).

1. **시작 화면:** 줄무늬 차양, 햇살 배경, 나무 선반, 크림 점수판, 빨간 Start Game 버튼, 오른쪽 위 소리 버튼. 게임 판이 비치지 않는다.
2. **게임 화면:** `startGame()` 후 나무 간판 헤더, 크림 타이머 바, 나무 상자 판.
3. **콤보 1·2·3단계:**
   ```js
   timeLeft = 9999; multiplier = 1.6; updateDisplay();   // 전구 켜짐
   multiplier = 2.4; updateDisplay();                     // 전구 깜빡임 + 노을빛 배경
   multiplier = 3.4; updateDisplay();                     // 색종이
   ```
4. **문구:** `showComboEffect('CHAIN x3!')` — 크림 글씨에 갈색 외곽선.
5. **팝업:** `showTutorial()`, `closeTutorial()`, `showRanking()`, `closeRanking()` — 크림 카드에 빨간 리본 헤더.
6. **게임 오버:**
   ```js
   document.getElementById('finalScore').textContent = 8200;
   document.getElementById('scoreSubmit').style.display = 'block';
   document.getElementById('playAgainBtn').style.display = 'none';
   document.getElementById('gameOver').style.display = 'flex';
   ```
7. **카운트다운:** 🏠 → Start Game으로 Ready / START! 글씨 확인.
8. **마지막 5초 경고:** `timeLeft = 4; updateHurryState();` — 화면 가장자리만 붉게 맥박 치고 판은 잘 보인다. 확인 후 `timeLeft = 9999; updateHurryState();`.
9. **동작 줄이기:** 개발자 도구에서 `prefers-reduced-motion: reduce`를 켜고 햇살·전구·색종이가 멈추는지 본다.
10. 콘솔 오류가 없다.

찍은 스크린샷은 보고서에 목록으로 남긴다.

- [ ] **Step 11: 커밋**

```bash
git add css_file.css
git commit -m "feat: restyle the game as a fruit market stall

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: 전체 확인

**Files:**
- 없음 (문제가 발견되면 해당 파일을 고친다)

**Interfaces:**
- Consumes: 1~6번 태스크 전부
- Produces: 없음

- [ ] **Step 1: 단위 테스트**

Run: `node --test tests/*.test.js`
Expected: `ℹ pass 40`, `ℹ fail 0`, 출력에 경고 없음

- [ ] **Step 2: 한 판 직접 플레이 (소리 켜기)**

서버를 띄우고 강력 새로고침한 뒤, 콘솔 조작 없이 한 판을 끝까지 플레이한다.

1. 소리를 켠 상태로 시작해 비트가 들리고, 콤보가 오르면 악기가 늘고, 마지막 5초에 빨라진다.
2. 밀어서 매칭하면 점수와 시간이 함께 오르고 `+Ns` 문구가 뜬다.
3. 연쇄가 나면 `CHAIN x2!` 이상이 뜬다.
4. 헛밀기는 점수·시간·배수를 바꾸지 않는다.
5. 30초 이상 버틸 수 있고, 시간이 30초를 넘지 않는다.
6. 게임 오버 후 Last/Best Score가 갱신되고, 새로고침 후에도 남는다.
7. 소리 버튼으로 끄면 배경음과 효과음이 함께 멈춘다.
8. 콘솔 오류가 없다.

- [ ] **Step 3: 확인 결과 정리**

브라우저에서 확인한 항목과 결과, 남은 문제를 보고서에 적는다. 코드 변경이 없으면 커밋하지 않는다.
