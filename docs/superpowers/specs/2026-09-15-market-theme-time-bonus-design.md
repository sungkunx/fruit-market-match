# 과일 시장 노점 테마, 시간 보너스, 새 배경음 설계

- 작성일: 2026-09-15
- 대상: Fruit Market (`index.html`, `css_file.css`, `js_file.js`, `scoring.js`)
- 선행 작업: `2026-09-15-swipe-match-design.md` 1단계(밀기 방식) 완료 상태
- 관계: 같은 문서의 2단계(목표 과일·아이템)는 아직 구현 전이며, 나중에 이 문서의 테마 스타일을 따른다.

## 1. 목표

1. 매칭할 때 시간을 조금씩 돌려받게 해서, 잘할수록 오래 버티고 점수를 더 쌓게 한다.
2. 보라·분홍 그라데이션이라 로고와 따로 노는 화면을, 로고(굵은 갈색 테두리, 나무 간판, 야자수)에 맞춘 "과일 시장 노점" 테마로 바꾸고 더 화려하게 만든다.
3. 배경음을 빠르고 비트 있는 곡으로 바꾸고, 소리를 켜고 끄는 버튼을 추가한다.

### 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 시간 보너스 | 터진 묶음마다 3개 +0.5초, 4개 +1초, 5개 이상 +2초. 연쇄 묶음도 적용 |
| 시간 상한 | 남은 시간은 최대 30초 |
| 테마 | 과일 시장 노점: 줄무늬 차양, 햇살 배경, 나무 상자 판, 나무 간판 버튼 |
| 화려함 | 평소엔 은은하게 움직이고, 배수 1.5 / 2.0 / 3.0 단계에서 점점 화려해짐 |
| 구현 방식 | CSS와 코드로 그림. 새 그림 파일 없음 |
| 배경음 | Web Audio로 합성한 125BPM 반복 곡. 콤보 단계마다 악기 추가, 마지막 5초 145BPM |
| 소리 버튼 | 🔊/🔇 토글. 시작 화면 오른쪽 위와 게임 화면 상단. 선택을 브라우저에 저장 |

### 구현 단계

1. **시간 보너스** (3장)
2. **소리** (4장)
3. **테마** (5장)

각 단계가 끝나면 게임이 온전히 동작해야 한다.

### 범위 밖

- `sw.js` 캐시 버그, 앱 아이콘 파일, 랭킹 이름 XSS (여전히 별도 작업)
- 목표 과일·아이템 (선행 설계 문서의 2단계)
- 화면 배치·버튼 위치 변경, 과일 그림·로고 이미지 교체
- 랭킹 등록 기준(5000점) 조정

## 2. 파일 구조

| 파일 | 변경 | 단계 |
|---|---|---|
| `scoring.js` | 시간 보너스 계산 함수 추가 | 1 |
| `tests/scoring.test.js` | 시간 보너스 테스트 추가 | 1 |
| `audio.js` (신규) | 오디오 초기화, 음량 경로, 배경음 스케줄러, 효과음, 음소거. 박자 패턴 계산은 순수 함수 | 2 |
| `tests/audio.test.js` (신규) | 박자 패턴 테스트 | 2 |
| `js_file.js` | 1단계: 0.1초 타이머, 시간 보너스 적용·표시. 2단계: 소리 함수를 `GameAudio` 호출로 교체, 소리 버튼. 3단계: 장식 요소 생성, 화면 상태 클래스 | 1, 2, 3 |
| `index.html` | 2단계: `audio.js` 로드, 소리 버튼. 3단계: 글꼴 링크, 배경 장식 마크업 | 2, 3 |
| `css_file.css` | 1단계: 시간 보너스 문구. 2단계: 소리 버튼 기본 스타일. 3단계: 테마 전체 | 1, 2, 3 |

`audio.js`는 `board.js`, `scoring.js`와 같은 형식으로 만든다. 일반 `<script>`로 `js_file.js`보다 먼저 로드한다. 브라우저에서는 `window.GameAudio`, Node에서는 `module.exports`로 내보낸다. Node에서 불러올 때 `AudioContext`에 접근하지 않아야 한다.

## 3. 시간 보너스 — 1단계

### 3.1 규칙 (`scoring.js`)

**`timeBonusForSize(size)`**: 3개 → 0.5, 4개 → 1, 5개 이상 → 2 (초).

**`stepTimeBonus(step)`**
- `step.kind === 'match'`이면 `step.groups`의 각 묶음에 `timeBonusForSize(group.cells.length)`를 적용해 합산한다.
- 그 외 `kind`(2단계 아이템의 `'item'` 단계)는 0이다.
- 결과는 소수 첫째 자리로 반올림한다.

**예시:** 4개 묶음 + 연쇄 3개 묶음이면 1단계에서 `1`, 2단계에서 `0.5`, 합계 1.5초.

### 3.2 타이머 (`js_file.js`)

- **단위:** `timeLeft`는 소수 초로 둔다.
- **줄이는 방식:** 상수 `TIMER_TICK_MS = 100`마다 `timeLeft`를 0.1 줄이고, 소수 첫째 자리로 반올림한 뒤 0 미만이면 0으로 둔다.
  - 실제 흐른 시각으로 계산하지 않는다. 폰에서 다른 앱에 갔다 오면 게임 시간이 한꺼번에 사라지기 때문이다.
- **타이머 바:** 매 틱 `timeLeft / GAME_DURATION` 비율로 폭을 갱신한다. 기존 `transition: width 0.1s linear`로 부드럽게 줄어든다.
- **마지막 5초:** 매 틱과 `addTime` 직후 `timeLeft <= 5 && timeLeft > 0`인지 확인한다. 참이면 경고 연출(`siren-active`)을 켜고, 거짓이면 끈다. 시간 보너스로 5초 위로 올라가면 경고도 꺼진다. 2단계부터는 빠른 템포 배경음도 같은 조건을 따른다.
- **시간 종료:** `timeLeft <= 0`이 되면 기존과 같다. 인터벌을 멈추고, `isAnimating`이면 `timeUp = true`, 아니면 `endGame()`.

### 3.3 시간 더하기 (`js_file.js`)

**`addTime(seconds)`**
- `gameRunning`이 참이고 `timeUp`이 거짓이며 `timeLeft > 0`일 때만 적용한다.
- 새 값은 `min(GAME_DURATION, round1(timeLeft + seconds))`이다.
- 실제로 늘어난 초(소수 첫째 자리)를 돌려준다. 적용하지 않았으면 0이다.
- 타이머 바를 즉시 갱신한다.
- 시간이 0이 된 뒤 도착한 연쇄 보너스로 게임이 다시 살아나지 않는다.

**`playSteps` 변경**
각 단계에서 점수를 더한 직후:
1. `const added = addTime(Scoring.stepTimeBonus(step));`
2. `added > 0`이면 `showTimeBonus(added)`를 호출한다.

헛밀기는 단계가 없으므로 보너스도 없다.

### 3.4 표시

**`showTimeBonus(seconds)`**
- 타이머 바 컨테이너 오른쪽 끝에 `+{seconds}s` 문구를 띄운다. `seconds`는 불필요한 소수점 없이 쓴다(`1`, `1.5`, `2`).
- 문구: 초록 글씨, 갈색 외곽선, 굵게. 0.8초 동안 위로 떠오르며 사라지고, 끝나면 요소를 제거한다.
- 타이머 바에 0.3초 반짝임 클래스를 준다.

## 4. 소리 — 2단계

### 4.1 음량 경로

```
효과음들 ─→ sfxGain(0.8) ─┐
                          ├─→ masterGain(켜짐 1 / 꺼짐 0) ─→ destination
배경음 악기들 ─→ musicGain(0.35) ─┘
```

- 음소거는 `masterGain.gain`만 0으로 바꾼다.
- `AudioContext`는 기존처럼 첫 사용자 동작(시작 버튼, 시작 화면 과일 클릭, 소리 버튼 클릭) 때 만든다.

### 4.2 `GameAudio` 인터페이스 (`audio.js`)

| 함수 | 동작 |
|---|---|
| `init()` | `AudioContext`와 음량 경로를 한 번만 만든다. 이미 있으면 아무것도 안 한다. 컨텍스트가 `suspended`이고 음소거가 아니면 `resume()` |
| `isMuted()` | 현재 음소거 여부 |
| `setMuted(muted)` | 음소거 상태를 바꾸고 `localStorage`의 `fruitMarketSound`에 `'off'` / `'on'`으로 저장한다. 컨텍스트가 있으면 `masterGain`에 바로 반영한다 |
| `startMusic()` | 스케줄러를 시작한다. 박자 0, 강도 0, 보통 템포에서 시작. 이미 재생 중이면 처음부터 다시 시작한다 |
| `stopMusic()` | 스케줄러를 멈춘다. 이미 예약된 음은 짧게 끝난다 |
| `setIntensity(level)` | 0~3. 다음 박자부터 반영 |
| `setHurry(on)` | 참이면 145BPM, 거짓이면 125BPM. 다음 박자부터 반영 |
| `playPop()` / `playSuccess(chain)` / `playFail()` | 기존 `playPopSound` / `playSuccessSound(chain)` / `playFailSound`와 같은 소리를 `sfxGain`으로 낸다. 컨텍스트가 없으면 아무것도 안 한다 |
| `musicStep(step, intensity)` | 순수 함수. 4.3절 |

- **음소거 초기값:** 페이지 로드 시 `localStorage`에서 읽고, 없거나 읽을 수 없으면 켜짐이다.
- **저장소 오류:** `localStorage` 접근은 `try/catch`로 감싼다.

### 4.3 곡 구성 (`musicStep`)

- **단위:** 16분음표 한 칸이 1 step. 1마디 16 step, 곡 1회 64 step(4마디). 이후 반복한다.
- **코드 진행:** 마디 0 C(C E G), 마디 1 Am(A C E), 마디 2 F(F A C), 마디 3 G(G B D).
- **`musicStep(step, intensity)`**
  - 입력: `step`은 0 이상 정수이며 64로 나눈 나머지를 쓴다. `intensity`는 0~3.
  - 출력: 그 칸에서 울릴 음 목록 `[{ instrument, midi }]`. 타악기는 `midi: null`.

| 악기 (`instrument`) | 강도 | 울리는 칸 (`s = step % 16`) | 음 |
|---|---|---|---|
| `kick` | 0 이상 | `s % 4 === 0` | null |
| `bass` | 0 이상 | `s % 2 === 0` | 마디 코드 근음(2옥타브 대, C2=36 기준). `s % 4 === 2`이면 한 옥타브 위 |
| `melody` | 0 이상 | 64칸 고정 멜로디 배열에서 값이 있는 칸 | 배열 값(MIDI). 코드 톤 중심의 밝은 멜로디 |
| `hat` | 1 이상 | `s % 4 === 2` | null |
| `clap` | 2 이상 | `s === 4 \|\| s === 12` | null |
| `sparkle` | 3 이상 | `s % 2 === 1` | 마디 코드 3음을 차례로(근음→3음→5음 반복), 5옥타브 대 |

고정 멜로디 64칸의 구체적인 음은 구현 계획에서 정한다. 조건: 각 마디 첫 칸에는 반드시 음이 있고, 쓰는 음은 그 마디 코드의 구성음이거나 C 장조 음계 안의 음이다.

### 4.4 합성과 스케줄러

- **스케줄러:** 25ms마다 실행한다. `audioContext.currentTime + 0.1`초 안에 들어오는 칸의 음을 미리 예약한다. 한 칸 길이는 `60 / bpm / 4`초다.
- **악기 합성:** 모두 `musicGain`으로 보낸다.

| 악기 | 합성 |
|---|---|
| kick | 사인파 150Hz → 45Hz, 0.15초 감쇠 |
| bass | 삼각파, 0.18초 감쇠 |
| melody | 사인파 + 4배 주파수 사인파(작은 음량), 0.25초 빠른 감쇠 (마림바 느낌) |
| hat | 흰 소음 → 하이패스 7000Hz, 0.04초 |
| clap | 흰 소음 → 밴드패스 1500Hz, 0.12초 |
| sparkle | 사각파(작은 음량), 0.08초 |

- **소음 버퍼:** `init()`에서 한 번만 만들어 재사용한다.

### 4.5 게임과의 연결 (`js_file.js`)

- **삭제:** 기존 `initAudio`, `createBackgroundMusic`, `playPopSound`, `playSuccessSound`, `playFailSound`와 전역 `audioContext`, `backgroundMusic`.
- **교체:**

| 위치 | 호출 |
|---|---|
| `startGame()` (Start 버튼) | `GameAudio.init()` |
| `actuallyStartGame()` | `GameAudio.setIntensity(0)`, `GameAudio.setHurry(false)`, `GameAudio.startMusic()` |
| `endGame()`, `restartGame()` | `GameAudio.stopMusic()` |
| 타이머 틱, `addTime` 직후 | `GameAudio.setHurry(timeLeft <= 5 && timeLeft > 0)` (경고 연출과 같은 조건) |
| `updateComboEffects()` | 배수에 따라 `GameAudio.setIntensity(0~3)` (1.5 / 2.0 / 3.0 기준) |
| 과일 잡기 / 성공 단계 / 헛밀기 | `GameAudio.playPop()` / `GameAudio.playSuccess(step.chain)` / `GameAudio.playFail()` |
| 시작 화면 과일 클릭 | `GameAudio.init()` 후 `GameAudio.playPop()` |

### 4.6 소리 버튼

- **마크업:** `<button class="sound-btn" aria-label="Toggle sound">`를 두 개 둔다.
  - 시작 화면 오른쪽 위(`.start-screen` 안, 절대 위치)
  - 게임 화면 `.header` 안 🏠 버튼 바로 앞
- **아이콘:** 켜짐 🔊, 꺼짐 🔇. 두 버튼을 항상 같은 상태로 갱신한다.
- **클릭:** `GameAudio.init()` → `GameAudio.setMuted(!GameAudio.isMuted())` → 아이콘 갱신.
- **초기화:** 페이지 로드 시 저장된 상태로 아이콘을 맞춘다.
- **스타일:** 2단계에서는 기존 🏠 버튼과 같은 투명 버튼. 3단계에서 나무 버튼으로 바꾼다.

## 5. 과일 시장 노점 테마 — 3단계

### 5.1 색과 글꼴

`css_file.css` 맨 위 `:root`에 변수로 정의하고 모든 규칙에서 쓴다.

| 변수 | 값 | 용도 |
|---|---|---|
| `--wood-dark` | `#5A3310` | 테두리, 글씨, 외곽선 |
| `--wood` | `#B9772F` | 나무 판·버튼 |
| `--wood-light` | `#E3A857` | 밝은 나무, 버튼 윗면 |
| `--cream` | `#FFF4DC` | 종이 카드, 판 안쪽, 밝은 글씨 |
| `--awning-red` | `#E8413B` | 차양, 리본, 시작 버튼 |
| `--awning-cream` | `#FFF1D6` | 차양 줄무늬 |
| `--sun` | `#FFD36E` | 배경 위쪽 |
| `--sunset` | `#FF9F5A` | 배경 아래쪽 |
| `--leaf` | `#6DB33F` | 시간 보너스 문구, 타이머 초록 |
| `--gold` | `#FFC53D` | 콤보 빛, 전구 |

- **글꼴:** `index.html`에 Google Fonts `Fredoka`(굵기 500, 700) 링크를 추가한다. `body`는 `'Fredoka', 'Arial Rounded MT Bold', Arial, sans-serif`.
- **굵은 테두리 규칙:** 버튼·카드·판의 테두리는 `3px`~`4px solid var(--wood-dark)`로 통일한다.

### 5.2 배경 장식 마크업

`<body>` 맨 앞에 추가한다.

```html
<div class="market-backdrop" aria-hidden="true">
    <div class="sunburst"></div>
    <div class="awning"></div>
    <div class="string-lights"></div>
    <div class="confetti"></div>
    <div class="shelf"></div>
</div>
```

- **위치:** `position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden`. 게임 화면·시작 화면보다 뒤에 둔다.
- **`body` 배경:** `var(--sun)`에서 `var(--sunset)`으로 이어지는 세로 그라데이션.
- **`.sunburst`:** 화면보다 큰 정사각형에 `repeating-conic-gradient`로 옅은 빛줄기를 그린다. 60초에 한 바퀴 돈다.
- **`.awning`:** 맨 위 높이 약 56px. 빨강·크림 세로 줄무늬(`repeating-linear-gradient`)이고, 아래 가장자리는 `radial-gradient` 반복으로 물결 모양.
- **`.string-lights`:** 차양 바로 아래 가로 줄. JS가 전구 `span` 12개를 한 번만 넣는다. `nth-child`로 높이를 조금씩 달리해 늘어진 줄처럼 보이게 한다. 기본은 꺼진 옅은 색이다.
- **`.confetti`:** JS가 색종이 `span` 24개를 한 번만 넣는다. 위치·색·지연·길이를 조금씩 다르게 준다. 기본은 숨김이다.
- **`.shelf`:** 맨 아래 높이 약 40px 나무 선반 띠.
- **장식 생성:** `setupMarketDecorations()`가 페이지 로드 시 한 번 전구와 색종이를 만든다.

### 5.3 화면 상태

- **문제:** 시작 화면 배경을 투명하게 하면 뒤의 게임 판이 비친다.
- **해결:** `body`에 `on-start` 클래스를 두고, 이 클래스가 있을 때 `.game-container`를 `visibility: hidden`으로 숨긴다.
  - 페이지 로드 시와 `restartGame()`에서 추가한다.
  - `startGame()`에서 제거한다.
- **시작 화면 배경:** 투명으로 바꿔 공통 배경 장식이 보이게 한다.

### 5.4 콤보 단계

기존 클래스(`body.combo-bg-1~3`, `.grid.combo-glow-1~3`)를 그대로 쓰고 스타일만 새로 정의한다. 기존 보라·분홍 배경 규칙과 `gradientMove` 애니메이션은 삭제한다.

| 단계 | `body` 클래스 | 배경 | 판(`.grid`) |
|---|---|---|---|
| 기본 | 없음 | 햇살 60초/회전 | 기본 |
| 1 | `combo-bg-1` | 전구 켜짐(`--gold`, 부드러운 빛) | 옅은 금빛 그림자 |
| 2 | `combo-bg-2` | 전구가 순서대로 깜빡임, 햇살 30초/회전, 배경 아래쪽이 분홍빛 노을로 짙어짐 | 금빛이 1.5초 주기로 맥박 |
| 3 | `combo-bg-3` | 2단계 + 색종이가 떨어짐 | 금빛이 0.7초 주기로 맥박 |

- **애니메이션 속성:** `transform`, `opacity`만 쓴다. 빛은 `box-shadow` 고정값을 켜고 끄는 방식으로 표현한다.
- **동작 줄이기:** `@media (prefers-reduced-motion: reduce)`에서 햇살 회전, 전구 깜빡임, 색종이 낙하를 끈다. 단계별 색 변화는 유지한다.

### 5.5 버튼

기존 클래스를 그대로 쓰고 스타일만 바꾼다. HTML 구조는 소리 버튼 추가(4.6절) 외에는 바꾸지 않는다.

**공통**
- 굵은 갈색 테두리, 둥근 모서리, 아래쪽 두꺼운 그림자(`box-shadow: 0 5px 0 var(--wood-dark)`), `Fredoka` 굵은 글씨.
- 누르면 `translateY(4px)`만큼 내려가고 그림자가 줄어든다. 마우스를 올리면 살짝 커진다.

| 클래스 | 모습 |
|---|---|
| `.start-btn` | 가장 큼. `--awning-red` 바탕, 크림 글씨 |
| `.tutorial-btn`, `.ranking-btn` | `--wood-light` 바탕, 갈색 글씨 |
| `.restart-btn` (Play Again), `.submit-score-btn` | `--leaf` 바탕, 크림 글씨 |
| `.skip-submit-btn` | `--wood-light` 바탕, 갈색 글씨 |
| `.restart-btn-game` (🏠), `.sound-btn`, `.close-btn` | 둥근 나무 버튼(`--wood-light`), 지름 약 40px |

### 5.6 화면별 스타일

**시작 화면**
- **점수판(`.score-stats`):** 크림 판, 갈색 굵은 테두리, 모서리에 못 모양 점 두 개(가상 요소). 제목은 갈색, 숫자는 `--awning-red`.
- **나머지:** 로고와 장식 과일 줄은 그대로다.

**게임 화면**
- **`.header`:** `--wood` 나무 간판, 갈색 굵은 테두리. `SCORE` 라벨은 크림, 점수 숫자는 크림 굵은 글씨에 갈색 외곽선. 콤보 카운터와 배수도 같은 계열 색으로 맞춘다.
- **`.timer-container`:** 높이 14px, 갈색 테두리, 크림 바탕.
- **`.timer-bar`:** 초록(`--leaf`) → 노랑(`--gold`) → 빨강(`--awning-red`) 가로 그라데이션.
- **`.grid`:** 나무 상자. `--wood` 테두리 판 안쪽은 `--cream`이고, 칸(`.cell`)마다 아주 옅은 갈색 배경으로 격자가 보인다.
- **콤보 문구(`.combo-text`):** 크림 글씨, 갈색 외곽선(`-webkit-text-stroke` + 그림자).
- **시간 보너스 문구:** 3.4절대로.

**팝업·게임 오버·카운트다운**
- **`.popup-content`, `.game-over-content`:** `--cream` 카드, 갈색 4px 테두리, 둥근 모서리.
- **글씨 색:** 본문은 갈색, 강조 제목(`.rule-title`)은 `--awning-red`.
- **`.popup-header`:** `--awning-red` 리본 띠, 크림 글씨.
- **랭킹 항목(`.rank-item`):** 옅은 나무색 줄. 내 순위는 금빛 테두리.
- **`.name-input`:** 크림 바탕, 갈색 테두리.
- **`.countdown-overlay`:** 반투명 갈색.
- **`.countdown-text`:** `READY`는 `--gold`, `START!`는 `--leaf`. 둘 다 갈색 외곽선.
- **`.siren-active`:** 화면 전체 번쩍임 대신 `box-shadow: inset`으로 가장자리만 붉게 맥박 치듯 빛난다.

## 6. 테스트

### 6.1 Node 테스트

**`tests/scoring.test.js` 추가 (1단계)**
- `timeBonusForSize`: 3, 4, 5, 6개
- `stepTimeBonus`: 묶음 하나, 묶음 여러 개 합산, `kind: 'item'`은 0, 소수 반올림

**`tests/audio.test.js` (2단계)**
- Node에서 `require('../audio.js')`가 오류 없이 되고 `musicStep`이 함수다.
- 강도 0: `kick`은 `s % 4 === 0`에만, `hat`·`clap`·`sparkle`은 없음
- 강도 1: `hat`이 `s % 4 === 2`에 추가
- 강도 2: `clap`이 4, 12칸에 추가
- 강도 3: `sparkle`이 홀수 칸에 추가
- 베이스 근음이 마디별 코드(C, A, F, G)를 따르고, `s % 4 === 2`에서 한 옥타브 위
- 64칸 뒤 같은 패턴이 반복된다(`musicStep(n)`과 `musicStep(n + 64)`가 같음)
- 멜로디: 각 마디 첫 칸에 음이 있고, 모든 음이 C 장조 음계 안에 있다

### 6.2 브라우저 확인

**모든 자동 브라우저 확인은 음소거 상태로 한다.** 게임 시작 전에 `GameAudio.setMuted(true)`를 호출하고, 2단계 이전에는 기존 `audioContext`를 만든 뒤 `suspend()`한다. 확인이 끝나면 탭을 닫는다.

**1단계 (시간 보너스)**
- 매칭 시 남은 시간이 늘고 `+Ns` 문구가 뜬다.
- 30초에서 더 늘지 않고, 그때는 문구가 뜨지 않는다.
- 타이머 바가 부드럽게 줄어든다.
- 마지막 5초 경고, 시간 종료, 연쇄 중 시간 종료 시 게임이 다시 살아나지 않는다.

**2단계 (소리)**
- 소리 버튼이 두 화면에서 같은 상태를 보여준다.
- 새로고침 후에도 상태가 유지된다.
- 음소거 중 게임 시작 시 오류가 없다.
- `GameAudio`의 스케줄러가 게임 종료·홈 이동 시 멈춘다(콘솔에서 확인).
- 배경음이 듣기 좋은지는 사용자가 직접 들어 확인한다.

**3단계 (테마)**
- 모바일 크기(375×812)에서 스크린샷으로 확인해 사용자에게 보여준다.
  - 시작 화면
  - 게임 화면 기본
  - 콤보 1·2·3단계
  - How to Play 팝업
  - Global Ranking 팝업
  - 게임 오버(점수 제출 폼 포함)
  - 카운트다운
- 시작 화면에서 게임 판이 비치지 않는다.
- 동작 줄이기 설정에서 움직임이 멈춘다.
- 콘솔 오류가 없다.
