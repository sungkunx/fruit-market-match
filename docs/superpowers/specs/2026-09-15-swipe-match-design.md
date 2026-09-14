# 밀기 방식 3매칭 전환과 아이템 설계

- 작성일: 2026-09-15
- 대상: Fruit Market (`index.html`, `js_file.js`, `css_file.css`)

## 1. 목표

현재의 "같은 과일 3개를 터치해서 선택" 방식을, 과일을 옆 칸과 자리 바꿔 가로·세로 3개 이상을 줄 세우는 밀기 방식(애니팡/캔디크러시 계열)으로 바꾼다. 점수 체계도 밀기 방식에 맞게 바꾸고, 목표 과일을 모으면 아이템을 얻는 시스템을 추가한다.

### 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 조작 | 과일을 상하좌우로 밀어 옆 칸과 자리 바꾸기 |
| 판 | 7열 × 8행, 매 판 7종류 중 6종류를 무작위로 사용 |
| 연쇄 | 터진 자리로 위 과일이 떨어지고 새 과일이 채워지며, 새로 생긴 매칭은 자동으로 터짐 |
| 헛밀기 | 원래 자리로 되돌리기만 함. 점수·배수·콤보·시간 모두 불이익 없음 |
| 불이익 원칙 | 게임 중 배수는 절대 줄어들지 않음. 점수를 최대한 높이 쌓는 방향 |
| 점수 | 기본 점수(매칭 크기) × 연쇄 단계 × 배수 |
| 목표 과일 | 화면 위에 목표 과일 1개 표시. 그 과일 묶음을 5번 터뜨리면 아이템 지급 |
| 아이템 | 폭탄(3×3), 과일 지우기(같은 종류 전부), 힌트. 무작위 지급, 슬롯 3칸 |
| 특수 과일 | 이번 범위에서 제외 |
| 제한 시간 | 30초 유지 |
| 구조 | 판 규칙(`board.js`), 점수(`scoring.js`), 아이템 규칙(`items.js`), 화면(`js_file.js`) 분리 |

### 구현 단계

1. **1단계 — 밀기 방식:** 3~5장. 이 단계만으로 게임이 완성된 상태로 동작해야 한다.
2. **2단계 — 목표 과일과 아이템:** 6장. 1단계 위에 추가한다.

설계 문서는 하나로 두고, 구현 계획은 단계별로 나눈다.

### 범위 밖

- 특수 과일(4·5개 매칭 시 생기는 줄 지우기 과일 등)
- 탭 두 번으로 자리 바꾸기
- 아이템 전용 그림 파일 (이모지로 시작)
- 서비스 워커 캐시 버그, 앱 아이콘 파일, 랭킹 이름 XSS 수정. 이 작업 후 별도로 처리한다. 새 파일(`board.js`, `scoring.js`, `items.js`)의 서비스 워커 캐시 등록도 그때 함께 한다.
  - 기존 점수 중복 버그는 입력 잠금 구조(4.3절)로 이번 작업에서 자연히 사라진다.

## 2. 파일 구조

| 파일 | 역할 | 의존 | 단계 |
|---|---|---|---|
| `board.js` (신규) | 판 생성, 매칭 판정, 자리 바꾸기, 떨어뜨리기·채우기, 연쇄 계산, 둘 수 있는 수 검사, 섞기, 아이템 대상 칸 계산 | 없음 | 1, 2 |
| `scoring.js` (신규) | 밀기·아이템 사용의 점수와 배수·콤보 변화 계산 | 없음 | 1, 2 |
| `items.js` (신규) | 목표 과일 진행, 아이템 지급, 슬롯 관리 | 없음 | 2 |
| `js_file.js` (수정) | 입력, 애니메이션, 효과음, 화면 표시, 게임 진행 | `window.Board`, `window.Scoring`, `window.Items` | 1, 2 |
| `css_file.css` (수정) | 7×8 그리드, `touch-action`, 아이템 줄, 불필요한 선택 스타일 제거 | - | 1, 2 |
| `index.html` (수정) | 새 스크립트 로드, 아이템 줄 마크업, How to Play 문구 | - | 1, 2 |
| `tests/board.test.js`, `tests/scoring.test.js`, `tests/items.test.js` (신규) | Node 내장 `node:test` 테스트 | - | 1, 2 |

`board.js`, `scoring.js`, `items.js`는 빌드 도구 없이 동작해야 한다. 파일 끝에서 `module.exports`가 있으면 그쪽으로 내보내고, 없으면 `window.Board` / `window.Scoring` / `window.Items`에 할당한다. `index.html`에서는 `js_file.js`보다 먼저 일반 `<script>`로 불러온다.

모든 무작위 동작은 인자로 받은 `rng`(`() => [0, 1)`)를 쓴다. 게임에서는 `Math.random`, 테스트에서는 시드 고정 함수를 쓴다.

## 3. 판 규칙 (`board.js`) — 1단계

### 3.1 데이터 표현

- 판: `board[row][col]`에 과일 이름 문자열이 들어간 8행 × 7열 2차원 배열. `row` 0이 맨 위.
- 칸 좌표: `{ row, col }`
- 모든 함수는 인자로 받은 판을 변경하지 않고 새 배열을 돌려준다.
- 상수: `ROWS = 8`, `COLS = 7`

### 3.2 연쇄 단계(step) 형식

판에서 칸이 사라지고 채워지는 한 번의 과정을 단계라고 한다.

```js
{
  kind,      // 'match' (매칭으로 터짐) 또는 'item' (아이템 효과로 사라짐)
  chain,     // 'match'일 때 연쇄 단계. 밀기 직후 매칭은 1, 이후 2, 3, ...
             // 'item'일 때 0
  groups,    // 'match'일 때 findMatches 결과, 'item'일 때 []
  cleared,   // 이 단계에서 사라진 칸 목록 (중복 없음)
  falls:  [{ from: {row, col}, to: {row, col}, fruit }], // 기존 과일 이동
  spawns: [{ to: {row, col}, fromRow, fruit }],        // 새 과일, fromRow는 음수(판 위)
  board      // 이 단계가 끝난 판
}
```

### 3.3 함수

**`pickFruits(rng, allFruits, count)`**
7종류 중 `count`(6)개를 무작위로 골라 배열로 돌려준다.

**`createBoard(rng, fruits)`**
- 칸마다 무작위 과일을 넣되, 왼쪽 2칸이나 위쪽 2칸과 같아서 3개가 이어지는 과일은 고르지 않는다.
- 완성된 판에 `hasPossibleMove`가 거짓이면 처음부터 다시 만든다.
- 결과: 매칭이 없고 둘 수 있는 수가 최소 1개 있는 판.

**`isAdjacent(a, b)`**
두 칸이 상하좌우로 정확히 한 칸 떨어져 있으면 참.

**`findMatches(board)`**
- 가로·세로로 같은 과일이 3개 이상 이어진 줄을 모두 찾는다.
- 같은 과일 줄끼리 칸을 공유하면(L자, T자, 십자) 하나의 묶음으로 합친다.
- 결과: `[{ fruit, cells: [{row, col}, ...] }]`. `cells`는 중복 없는 칸 목록이고, 묶음 크기는 `cells.length`다.

**`clearAndCollapse(board, cells, rng, fruits)`** (내부용, 테스트 대상)
1. `cells`를 비운다.
2. 열마다 남은 과일을 아래로 떨어뜨린다.
3. 빈칸을 `fruits` 중 무작위 과일로 채운다. 새 과일은 해당 열 위쪽 판 밖에서 떨어지는 것으로 기록한다.
- 결과: `{ falls, spawns, board }`

**`cascade(board, rng, fruits, startChain)`** (내부용, 테스트 대상)
`findMatches` 결과가 없을 때까지 아래를 반복하며 `kind: 'match'` 단계를 쌓는다. 첫 단계의 `chain`은 `startChain`이고 이후 1씩 증가한다.
1. 매칭 묶음을 찾는다.
2. 묶음 칸 전체를 `clearAndCollapse`로 처리한다.

**`resolveMove(board, a, b, rng, fruits)`**
- `a`는 사용자가 잡아서 민 칸, `b`는 밀려난 칸이다.
- 인접하지 않으면 `{ valid: false }`를 돌려준다.
- 두 칸을 바꾼 판에서 `findMatches` 결과가 없으면 `{ valid: false }`를 돌려준다.
- 매칭이 있으면 바꾼 판에서 `cascade(swappedBoard, rng, fruits, 1)`을 실행한다.
- 결과: `{ valid: true, swappedBoard, steps, finalBoard }`

**`hasPossibleMove(board)`**
`findBestMove(board)`가 `null`이 아니면 참.

**`shuffle(board, rng)`**
판에 있는 과일들을 무작위로 재배치한다. 매칭이 없고 `hasPossibleMove`가 참인 배치가 나올 때까지 반복한다. 100번 시도해도 실패하면 판에 쓰인 과일 종류로 `createBoard`를 호출해 새 판을 만든다.

**`findBestMove(board)`**
- 모든 칸에서 오른쪽·아래쪽 칸과 바꿔 보고, 바꾼 직후 `findMatches`로 터지는 칸 수의 합이 가장 큰 수를 찾는다. 같으면 먼저 찾은 수(위→아래, 왼쪽→오른쪽)를 고른다.
- 결과: `{ a, b, size }` 또는 둘 수 있는 수가 없으면 `null`
- 1단계에서는 `hasPossibleMove`에 쓰이고, 2단계에서 힌트 아이템에 쓰인다.

## 4. 점수와 게임 흐름 — 1단계

### 4.1 점수 계산 (`scoring.js`)

**`baseScore(size)`**: 3개 → 100, 4개 → 200, 5개 이상 → 400.

**`matchStepScore(step, multiplier)`**
`Σ floor(baseScore(group.cells.length) × step.chain × multiplier)` (묶음마다 계산해 합산)

**`scoreMove(result, state, movedFruit, displacedFruit)`**
- `state`: `{ multiplier, comboCount, lastMatchedFruit }` (이번 수를 두기 전 상태)
- `result.valid`가 거짓이면 점수 0, 상태는 그대로 돌려준다. 헛밀기에는 불이익이 없다.
- 매칭이 있으면:
  - 단계별 점수: `stepScores[i] = matchStepScore(steps[i], state.multiplier)`
  - 총점: `stepScores`의 합
  - 기준 과일: 1단계 묶음 중 밀어서 옮긴 과일(`movedFruit`)이 있으면 그 과일, 없으면 밀려난 과일(`displacedFruit`)
  - 기준 과일이 `state.lastMatchedFruit`와 같으면 `multiplier + 0.5`, `comboCount + 1`, `isCombo: true`
  - 다르면 `multiplier + 0.1`, `comboCount = 1`, `isCombo: false`
    - 콤보 카운트는 "같은 과일 연속 횟수"라서 다시 1부터 세지만, 배수는 줄지 않고 계속 오른다.
  - `lastMatchedFruit`는 기준 과일
- 배수는 게임 중 줄어드는 경우가 없다. 새 게임을 시작할 때만 ×1.0으로 돌아간다.
- 배수는 부동소수 오차를 막기 위해 소수 첫째 자리로 반올림해 저장한다.
- 결과: `{ total, stepScores, isCombo, state: 새 상태 }`

**예시:** 배수 ×1.5에서 사과를 밀어 4개가 터지고, 연쇄로 3개가 더 터지면
`floor(200×1×1.5) + floor(100×2×1.5) = 300 + 300 = 600`점.

**랭킹 등록 기준:** 기존 5000점 기준을 `js_file.js` 상단 상수 `LEADERBOARD_MIN_SCORE = 5000`으로 뺀다. 배수가 줄지 않고 아이템 점수도 더해져 기존보다 점수가 크게 오를 수 있으므로, 값은 플레이 테스트 후 조정한다.

### 4.2 게임 상태 (`js_file.js`)

기존 전역 변수에 아래를 더하거나 바꾼다.

- `board`: 현재 판 (기존 1차원 `grid` 배열을 대체)
- `activeFruits`: 이번 판에 쓰는 6종류
- `isAnimating`: 밀기나 아이템 사용 처리(애니메이션 포함)가 진행 중이면 참
- `gameSession`: 게임을 시작하거나 홈으로 갈 때마다 1씩 증가하는 번호
- `timeUp`: 시간이 끝났지만 진행 중인 처리가 있어 종료를 미룬 상태

### 4.3 한 수의 흐름 (`handleSwap(a, b)`)

1. 게임 중이 아니거나 `isAnimating` 또는 `timeUp`이면 무시한다.
2. `isAnimating = true`, 현재 `gameSession` 번호를 기억한다.
3. `Board.resolveMove`로 결과를 계산하고, `Scoring.scoreMove`로 점수와 새 상태를 계산한다.
4. 헛밀기면:
   - 자리 바꾸기 애니메이션 후 되돌리기 애니메이션
   - 실패 효과음, 바꾸려던 두 과일만 4번 프레임 약 0.5초 표시 (벌을 받는 느낌이 들지 않게 판 전체 연출은 쓰지 않음)
   - 점수·배수·콤보는 바뀌지 않음
5. 매칭이면:
   - 자리 바꾸기 애니메이션
   - 공통 단계 재생 함수 `playSteps(steps, stepScores)`로 각 단계를 보여준다 (4.4절).
   - 모든 단계 후 배수·콤보 반영. `isCombo`면 `COMBO x{n}! +0.5x` 표시
   - `board = finalBoard`
6. 공통 마무리 `finishTurn()`을 호출한다 (4.4절).

### 4.4 공통 처리

**`playSteps(steps, stepScores)`**
각 단계마다:
1. 사라지기 애니메이션 (`kind`에 따라 5.3절의 터지기 / 아이템 연출)
2. 해당 단계 점수를 화면 점수에 더함
3. `kind: 'match'`이고 `chain >= 2`이면 `CHAIN x{n}!` 표시
4. (2단계) `kind: 'match'`이면 목표 과일 진행 반영 (6.4절)
5. 떨어지기 애니메이션

각 `await` 후 `gameSession`이 바뀌었으면 즉시 중단한다.

**`finishTurn()`**
1. `Board.hasPossibleMove(board)`가 거짓이면 `Shuffle!` 표시 후 `Board.shuffle` 결과로 판을 다시 그린다.
2. `isAnimating = false`
3. `timeUp`이면 `endGame()`을 호출한다.

### 4.5 타이머와 종료

- 타이머가 0이 됐을 때 `isAnimating`이 거짓이면 즉시 `endGame()`을 호출한다.
- 참이면 `timeUp = true`로 두고, `finishTurn()`에서 종료한다. 진행 중이던 연쇄 점수는 모두 포함된다.
- 시간이 끝난 뒤에는 새 입력을 받지 않는다.
- `restartGame()`은 `gameSession`을 올리고 `isAnimating`, `timeUp`을 초기화한다.

### 4.6 기존 연출 유지

- 배수 1.5 / 2.0 / 3.0 이상에서의 배경·그리드 빛 효과 유지 (`updateComboEffects`)
- 마지막 5초 사이렌 효과 유지
- 콤보 카운터, 배수 표시 유지

## 5. 입력과 애니메이션 — 1단계

### 5.1 화면 구성

- `.grid`: `grid-template-columns: repeat(7, 1fr)`, `grid-template-rows: repeat(8, 1fr)`, 폭 최대 약 360px, `touch-action: none`
- `.cell`: 칸 높이 최대 50px 제한을 풀고 `aspect-ratio: 1/1` 유지. 과일이 판 위에서 떨어져 들어오는 모습이 보이도록 `.cell`의 `overflow: hidden`은 해제하고, `.grid`에서 판 바깥을 잘라낸다.
- 칸 56개는 `data-row`, `data-col`로 위치를 고정한다. 과일 이미지 `src`만 바꾸거나 `transform`으로 움직인다.
- 제거: `selectCell`, `checkMatch`, `removeCells`, `resetAllCells`, `isValidMatch`, `.cell.selected`, `.cell.removing`
- How to Play 문구: 과일을 옆 칸으로 밀어 같은 과일 3개 이상을 가로나 세로로 줄 세우면 사라진다는 내용, 연쇄와 같은 과일 연속 매칭 시 점수가 더 오른다는 팁. (2단계에서 목표 과일과 아이템 설명 추가)

### 5.2 밀기 입력 (Pointer Events)

`.grid`에 `pointerdown`, `pointermove`, `pointerup`, `pointercancel`을 등록한다.

1. **`pointerdown`**: 칸 위에서 눌렀고 입력 가능한 상태면 시작 칸과 좌표를 저장하고 `setPointerCapture`한다. 과일을 2번 프레임으로 바꾸고 뾱 효과음을 낸다. (2단계: 아이템 선택 모드면 6.5절 처리)
2. **`pointermove`**: 시작 좌표에서 가로·세로 이동량 중 큰 쪽이 칸 크기의 30% 이상이면, 그 축과 부호로 방향을 정한다. 목표 칸이 판 안이면 `handleSwap(시작 칸, 목표 칸)`을 한 번 호출하고 이번 누름을 종료 처리한다. 판 밖이면 무시하고 종료 처리한다.
3. **`pointerup` / `pointercancel`**: 아직 밀기가 실행되지 않았으면 과일을 1번 프레임으로 되돌리고 종료한다.

### 5.3 애니메이션

모든 애니메이션은 `element.animate()`로 실행하고 `.finished`를 기다린다. 과일 이미지에는 기존 `fruitIdle` CSS 애니메이션(`transform` 사용)이 걸려 있으므로, 칸마다 `<div class="fruit">` 래퍼 안에 `<img class="fruit-image">`를 두고 이동·크기 애니메이션은 래퍼에만 적용한다.

| 단계 | 시간 | 내용 |
|---|---|---|
| 자리 바꾸기 | 0.15초 | 두 과일이 서로의 위치로 이동. 끝나면 `src`를 교환하고 `transform` 초기화 |
| 헛밀기 되돌리기 | 0.15초 | 다시 원래 위치로 이동 |
| 터지기 | 0.25초 | 3번 프레임으로 바꾸고 커졌다가 작아지며 사라짐 |
| 떨어지기 | 0.2초 + 칸당 0.05초, 최대 0.4초 | 도착 칸의 `src`를 먼저 바꾸고, 출발 위치만큼 위로 옮긴 `transform`에서 0으로 이동 |
| 섞기 | 약 0.4초 | 전체가 작아졌다가 새 배치로 커짐 |

### 5.4 효과음

| 상황 | 효과음 |
|---|---|
| 과일을 잡음 | 기존 `playPopSound` |
| 매칭 단계마다 | 기존 `playSuccessSound`에 연쇄 단계만큼 음을 올리는 인자 추가 |
| 헛밀기 | 기존 `playFailSound` |

기존 `playNoteSound`(3개 선택 시 음계)는 쓰이지 않으므로 제거한다.

## 6. 목표 과일과 아이템 — 2단계

### 6.1 규칙 요약

- 화면 위에 목표 과일 1개와 진행도(0/5)를 표시한다.
- `kind: 'match'` 단계에서 목표 과일 묶음이 터질 때마다 진행도 +1. 묶음 크기(3·4·5개)와 무관하게 1이고, 연쇄로 터진 묶음도 센다. 한 단계에서 목표 과일 묶음이 둘이면 +2.
- 아이템 효과로 직접 사라진 과일(`kind: 'item'` 단계)은 세지 않는다. 아이템 사용 뒤 이어진 연쇄 매칭은 센다.
- 진행도가 5가 되면 보상을 받고, 목표는 현재와 다른 과일(`activeFruits` 중 무작위)로 바뀌며 진행도는 0이 된다.
- 보상은 무작위 아이템 1개. 슬롯이 가득 차 있으면 아이템 대신 보너스 점수.
- 목표·진행도·슬롯은 그 판에서만 유지되고, 새 게임에서 초기화된다.

### 6.2 아이템

| 키 | 이름 | 이모지 | 지급 확률 | 사용 | 효과 |
|---|---|---|---|---|---|
| `bomb` | 폭탄 | 💣 | 40% | 슬롯 누른 뒤 칸 선택 | 선택 칸 중심 3×3 제거. 판 밖은 제외 |
| `basket` | 과일 지우기 | 🧺 | 30% | 슬롯 누른 뒤 과일 선택 | 선택한 과일과 같은 종류를 판에서 전부 제거 |
| `hint` | 힌트 | 💡 | 30% | 슬롯 누르면 즉시 발동 | `findBestMove` 결과 두 칸을 2초 동안 반짝이며 흔들어 표시 |

### 6.3 아이템 규칙 (`items.js`)

**상태**
```js
{
  targetFruit,   // 현재 목표 과일
  progress,      // 0~4
  slots          // 길이 3 배열, 각 칸은 'bomb' | 'basket' | 'hint' | null
}
```
상수: `TARGET_COUNT = 5`, `SLOT_COUNT = 3`, `BONUS_SCORE = 500`

**`createItemState(rng, fruits)`**
목표 과일을 무작위로 고르고, 진행도 0, 슬롯은 모두 `null`.

**`rollItem(rng)`**
`r < 0.4` → `bomb`, `r < 0.7` → `basket`, 그 외 → `hint`.

**`recordMatches(state, groups, rng, fruits)`**
- `groups`를 순서대로 보며, 묶음의 과일이 현재 `targetFruit`와 같으면 진행도 +1.
- 진행도가 `TARGET_COUNT`에 도달하면:
  - `rollItem`으로 아이템을 뽑아 비어 있는 가장 왼쪽 슬롯에 넣고 `{ type: 'item', item, slot }` 보상을 기록한다.
  - 빈 슬롯이 없으면 `{ type: 'bonus' }` 보상을 기록한다.
  - 목표를 현재와 다른 과일로 바꾸고 진행도를 0으로 한다.
  - 같은 `groups`의 남은 묶음은 바뀐 목표 기준으로 계속 센다.
- 결과: `{ state: 새 상태, rewards: [...] }`

**`takeItem(state, slot)`**
해당 슬롯을 `null`로 만든 새 상태를 돌려준다. 빈 슬롯이면 상태를 그대로 돌려준다.

### 6.4 판·점수 확장

**`board.js`**
- **`bombCells(center)`**: `center` 중심 3×3 중 판 안의 칸 목록.
- **`fruitCells(board, fruit)`**: 판에서 `fruit`인 칸 목록.
- **`resolveClear(board, cells, rng, fruits)`**:
  1. `cells`를 `clearAndCollapse`로 처리해 `kind: 'item'`, `chain: 0` 단계를 만든다.
  2. 그 판에서 `cascade(board, rng, fruits, 2)`로 이어지는 연쇄를 붙인다.
  - 결과: `{ steps, finalBoard }`

**`scoring.js`**
- **`ITEM_CELL_SCORE = 30`**
- **`scoreItemUse(steps, state)`**:
  - `kind: 'item'` 단계 점수 = `floor(cleared.length × 30 × multiplier)`
  - `kind: 'match'` 단계 점수 = `matchStepScore(step, multiplier)`
  - 결과: `{ total, stepScores }`. 배수·콤보·기준 과일은 바꾸지 않는다.
- **`bonusScore(multiplier)`**: `floor(500 × multiplier)`

**`playSteps` 확장 (`js_file.js`)**
`kind: 'match'` 단계마다 `Items.recordMatches`를 호출하고, 진행도 표시를 갱신한다. 보상이 있으면:
- `item`: 아이템 획득 효과음, 목표 표시 위치에서 슬롯으로 아이콘이 날아가는 연출
- `bonus`: `bonusScore(현재 배수)`를 점수에 더하고 `BONUS +{n}` 표시

배수는 `playSteps`가 끝난 뒤에 반영되므로, 보너스 점수에는 이번 수를 두기 전 배수를 쓴다.

### 6.5 아이템 사용 흐름 (`js_file.js`)

**추가 상태:** `itemState`, `armedSlot`(선택 모드인 슬롯 번호 또는 `null`), `hintTimer`

**슬롯 누르기 (`onSlotClick(slot)`)**
- 게임 중이 아니거나 `isAnimating` 또는 `timeUp`이면 무시한다. 빈 슬롯도 무시한다.
- 다른 슬롯이 선택 모드인 상태에서 누르면, 기존 선택 모드를 먼저 해제한 뒤 아래를 처리한다.
- `hint`: 즉시 발동.
  1. `Board.findBestMove(board)` 결과가 없으면 아무 일도 하지 않고 아이템도 소모하지 않는다.
  2. 결과가 있으면 `Items.takeItem`으로 소모하고, 두 칸에 `.hint` 클래스를 2초 동안 붙인다.
  3. 힌트는 입력을 잠그지 않는다. 표시 중에 밀기나 다른 아이템 사용이 시작되면 표시를 지운다.
- `bomb` / `basket`:
  - `armedSlot`이 이 슬롯이면 선택 모드를 취소한다.
  - 아니면 `armedSlot = slot`, 슬롯에 `.armed`, 판에 `.item-armed` 클래스를 붙인다.

**선택 모드에서 판 누르기**
`pointerdown`에서 `armedSlot`이 있으면 밀기를 시작하지 않고 `handleItemUse(armedSlot, 누른 칸)`을 호출한다.

**`handleItemUse(slot, cell)`**
1. `isAnimating = true`, `gameSession` 번호를 기억한다. 선택 모드를 해제한다.
2. 대상 칸: `bomb`이면 `Board.bombCells(cell)`, `basket`이면 `Board.fruitCells(board, board[cell.row][cell.col])`.
3. `Items.takeItem`으로 슬롯을 비운다.
4. `Board.resolveClear`로 결과를, `Scoring.scoreItemUse`로 점수를 계산한다.
5. `playSteps(steps, stepScores)`로 재생한다.
6. `board = finalBoard`, `finishTurn()`.

**시간 종료:** 타이머가 0이 되면 선택 모드와 힌트 표시를 해제한다.

**`restartGame()` / 새 게임:** `itemState`를 새로 만들고 `armedSlot`, 힌트 표시를 초기화한다.

### 6.6 화면

점수·콤보 줄(`.header`)과 타이머 사이에 아이템 줄을 추가한다.

```
[SCORE 1200]   [콤보 2 x1.6]   [🏠]
목표 🍎 ●●●○○ 3/5    [💣] [🧺] [  ]
═══════════ 타이머 ═══════════
            (과일 판)
```

- 목표: 과일 이미지(`fruit_{목표}_001.png`) + 점 5개 + `n/5`
- 슬롯: `<button>` 3개. 빈 슬롯은 흐리게 표시하고 누를 수 없다.
- `.armed` 슬롯은 빛나며 살짝 커진다. `.item-armed` 판은 테두리가 빛난다.
- `.hint` 칸은 밝게 빛나며 좌우로 흔들린다.
- How to Play에 목표 과일과 세 아이템 설명을 추가한다.

### 6.7 연출과 효과음

| 상황 | 애니메이션 | 효과음 |
|---|---|---|
| 목표 진행 +1 | 해당 점이 채워지며 튕김 | 없음 (매칭 효과음과 겹치지 않게) |
| 아이템 획득 | 목표 위치에서 슬롯으로 아이콘 이동 (0.4초) | `playItemSound('get')`: 짧은 상승 아르페지오 |
| 보너스 점수 | `BONUS +{n}` 문구 | `playItemSound('get')` |
| 폭탄 | 대상 칸이 커졌다 사라지고 판이 짧게 흔들림 (0.3초) | `playItemSound('bomb')`: 낮은 주파수로 떨어지는 소리 |
| 과일 지우기 | 대상 과일이 위로 떠오르며 사라짐 (0.3초) | `playItemSound('basket')`: 빠른 뾱 소리 연속 |
| 힌트 | `.hint` 표시 | `playItemSound('hint')`: 부드러운 단음 |

## 7. 테스트

### 7.1 Node 테스트 (`node --test tests/`)

**`board.test.js` (1단계)**
- `createBoard`: 크기가 8×7, 매칭 없음, `hasPossibleMove` 참, 지정한 과일만 사용
- `isAdjacent`: 상하좌우 참, 대각선·두 칸 거리·같은 칸 거짓
- `findMatches`: 가로 3, 세로 3, 가로 4·5, L자·T자 합치기, 서로 떨어진 두 묶음, 매칭 없음
- `clearAndCollapse`: 칸 비우기, 떨어뜨리기 위치, 새 과일 개수와 `fromRow`
- `resolveMove`: 인접하지 않은 칸, 매칭 없는 교환은 `valid: false`. 매칭 시 단계 결과 확인. 시드 고정 `rng`로 연쇄 2단계 이상 발생 시 `chain` 번호와 단계별 판 확인. 원본 판이 바뀌지 않음
- `findBestMove`: 가장 큰 매칭을 고름, 동률 시 먼저 찾은 수, 둘 곳 없으면 `null`
- `hasPossibleMove`: 둘 수 있는 판 참, 둘 수 없는 판 거짓
- `shuffle`: 결과에 매칭 없음, `hasPossibleMove` 참, 과일 구성(종류별 개수) 유지

**`board.test.js` (2단계 추가)**
- `bombCells`: 가운데, 모서리, 가장자리
- `fruitCells`: 해당 과일 칸만 반환
- `resolveClear`: 첫 단계 `kind: 'item'`, `chain: 0`. 이어지는 연쇄는 `chain` 2부터 시작

**`scoring.test.js` (1단계)**
- `baseScore`: 3, 4, 5, 6개
- 단일 매칭 점수, 배수 적용과 `floor`
- 연쇄 단계 배율
- 같은 과일 연속 시 +0.5와 콤보 증가, 다른 과일 시 +0.1과 콤보 1
- 기준 과일 결정: 옮긴 과일이 매칭된 경우, 밀려난 과일만 매칭된 경우
- 헛밀기 시 점수 0, 상태(배수·콤보·기준 과일) 그대로 유지
- 다른 과일 매칭 시 콤보는 1이 되지만 배수는 줄지 않음
- 배수 반올림 (0.1을 여러 번 더해도 1.3 등으로 저장)

**`scoring.test.js` (2단계 추가)**
- `scoreItemUse`: 아이템 단계 칸당 30 × 배수, 이어진 연쇄 점수, 상태 변경 없음
- `bonusScore`: 배수 적용과 `floor`

**`items.test.js` (2단계)**
- `createItemState`: 목표가 `fruits` 중 하나, 진행도 0, 빈 슬롯 3개
- `rollItem`: 경계값(0, 0.39, 0.4, 0.69, 0.7, 0.99)
- `recordMatches`: 목표 과일 묶음만 셈, 한 번에 두 묶음 +2, 5 도달 시 아이템 보상과 목표 변경(이전과 다른 과일)·진행도 0, 슬롯 가득 찼을 때 `bonus`, 목표 변경 후 같은 호출의 남은 묶음을 새 목표 기준으로 셈
- `takeItem`: 슬롯 비우기, 빈 슬롯은 그대로

### 7.2 브라우저 확인

모바일 크기(375×812) 화면에서 실제 드래그로 확인한다.

**1단계**
- 매칭 성공과 점수·배수 표시
- 헛밀기 시 되돌림, 배수·콤보 유지
- 연쇄 발생 시 과일이 떨어지고 `CHAIN` 표시
- 애니메이션 중 추가 입력 무시
- 게임 도중 홈 버튼 후 새 게임 시작 시 이전 애니메이션이 새 판에 영향 없음
- 시간 종료, 게임 오버 화면, 최고 점수 저장
- 콘솔 오류 없음

**2단계**
- 목표 과일 매칭 시 진행도 증가, 5/5에서 아이템 획득과 목표 변경
- 슬롯 가득 찬 상태에서 목표 달성 시 보너스 점수
- 폭탄·과일 지우기: 선택 모드 진입과 취소, 사용 후 떨어지기와 연쇄, 점수 반영
- 힌트: 두 칸 표시, 표시 중 밀기 시 해제
- 아이템 선택 모드에서 시간 종료, 홈 버튼 후 새 게임에서 아이템 초기화
