# 밀기 방식 3매칭 전환 설계

- 작성일: 2026-09-15
- 대상: Fruit Market (`index.html`, `js_file.js`, `css_file.css`)

## 1. 목표

현재의 "같은 과일 3개를 터치해서 선택" 방식을, 과일을 옆 칸과 자리 바꿔 가로·세로 3개 이상을 줄 세우는 밀기 방식(애니팡/캔디크러시 계열)으로 바꾼다. 점수 체계도 밀기 방식에 맞게 바꾼다.

### 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 조작 | 과일을 상하좌우로 밀어 옆 칸과 자리 바꾸기 |
| 판 | 7열 × 8행, 매 판 7종류 중 6종류를 무작위로 사용 |
| 헛밀기 | 원래 자리로 되돌리기만 함. 점수·배수·콤보·시간 모두 불이익 없음 |
| 불이익 원칙 | 게임 중 배수는 절대 줄어들지 않음. 점수를 최대한 높이 쌓는 방향 |
| 점수 | 기본 점수(매칭 크기) × 연쇄 단계 × 배수 |
| 특수 과일 | 이번 범위에서 제외 |
| 제한 시간 | 30초 유지 |
| 구조 | 규칙(`board.js`), 점수(`scoring.js`), 화면(`js_file.js`) 분리 |

### 범위 밖

- 특수 과일(줄 지우기, 같은 종류 전부 지우기 등)
- 탭 두 번으로 자리 바꾸기
- 서비스 워커 캐시 버그, 아이콘 파일, 랭킹 이름 XSS, 점수 중복 버그 수정. 이 작업 후 별도로 처리한다. 새 파일(`board.js`, `scoring.js`)의 서비스 워커 캐시 등록도 그때 함께 한다.
  - 단, 점수 중복 버그는 입력 잠금 구조(4.4절)로 이번 작업에서 자연히 사라진다.

## 2. 파일 구조

| 파일 | 역할 | 의존 |
|---|---|---|
| `board.js` (신규) | 판 생성, 매칭 판정, 자리 바꾸기, 떨어뜨리기·채우기, 연쇄 계산, 둘 수 있는 수 검사, 섞기 | 없음 |
| `scoring.js` (신규) | 한 수의 점수와 배수·콤보 변화 계산 | 없음 |
| `js_file.js` (수정) | 입력, 애니메이션, 효과음, 화면 표시, 게임 진행 | `window.Board`, `window.Scoring` |
| `css_file.css` (수정) | 7×8 그리드, `touch-action`, 불필요한 선택 스타일 제거 | - |
| `index.html` (수정) | 새 스크립트 로드, How to Play 문구 | - |
| `tests/board.test.js`, `tests/scoring.test.js` (신규) | Node 내장 `node:test` 테스트 | - |

`board.js`와 `scoring.js`는 빌드 도구 없이 동작해야 한다. 파일 끝에서 `module.exports`가 있으면 그쪽으로 내보내고, 없으면 `window.Board` / `window.Scoring`에 할당한다. `index.html`에서는 `js_file.js`보다 먼저 일반 `<script>`로 불러온다.

## 3. 게임 규칙 (`board.js`)

### 3.1 데이터 표현

- 판: `board[row][col]`에 과일 이름 문자열이 들어간 8행 × 7열 2차원 배열. `row` 0이 맨 위.
- 칸 좌표: `{ row, col }`
- 무작위 함수 `rng`: `() => [0, 1)` 형태로 인자로 받는다. 게임에서는 `Math.random`, 테스트에서는 시드 고정 함수를 쓴다.
- 모든 함수는 인자로 받은 판을 변경하지 않고 새 배열을 돌려준다.
- 상수: `ROWS = 8`, `COLS = 7`

### 3.2 함수

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

**`resolveMove(board, a, b, rng, fruits)`**
- `a`는 사용자가 잡아서 민 칸, `b`는 밀려난 칸이다.
- 인접하지 않으면 `{ valid: false }`를 돌려준다.
- 두 칸을 바꾼 판에서 `findMatches` 결과가 없으면 `{ valid: false }`를 돌려준다.
- 매칭이 있으면 아래를 매칭이 없을 때까지 반복하고, 반복마다 한 단계(step)를 기록한다.
  1. 현재 판에서 매칭 묶음을 찾는다.
  2. 묶음에 속한 칸을 비운다.
  3. 열마다 남은 과일을 아래로 떨어뜨린다.
  4. 빈칸을 `fruits` 중 무작위 과일로 채운다. 새 과일은 해당 열 위쪽 판 밖에서 떨어지는 것으로 기록한다.
- 결과:

```js
{
  valid: true,
  swappedBoard,          // 자리를 바꾼 직후의 판
  steps: [{
    chain,               // 1부터 시작하는 연쇄 단계
    groups,              // findMatches 결과
    falls: [{ from: {row, col}, to: {row, col}, fruit }], // 기존 과일 이동
    spawns: [{ to: {row, col}, fromRow, fruit }],       // 새 과일, fromRow는 음수(판 위)
    board                // 이 단계가 끝난 판
  }],
  finalBoard
}
```

**`hasPossibleMove(board)`**
모든 칸에서 오른쪽·아래쪽 칸과 바꿔 봤을 때 매칭이 하나라도 생기면 참.

**`shuffle(board, rng)`**
판에 있는 과일들을 무작위로 재배치한다. 매칭이 없고 `hasPossibleMove`가 참인 배치가 나올 때까지 반복한다. 100번 시도해도 실패하면 같은 과일 구성으로 `createBoard`와 같은 방식의 새 판을 만든다.

## 4. 점수와 게임 흐름

### 4.1 점수 계산 (`scoring.js`)

**`baseScore(size)`**: 3개 → 100, 4개 → 200, 5개 이상 → 400.

**`scoreMove(result, state, movedFruit, displacedFruit)`**
- `state`: `{ multiplier, comboCount, lastMatchedFruit }` (이번 수를 두기 전 상태)
- `result.valid`가 거짓이면 점수 0, 상태는 그대로 돌려준다. 헛밀기에는 불이익이 없다.
- 매칭이 있으면:
  - 단계별 점수: `stepScores[i] = Σ floor(baseScore(group.cells.length) × step.chain × state.multiplier)`
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

**랭킹 등록 기준:** 기존 5000점 기준을 `js_file.js` 상단 상수 `LEADERBOARD_MIN_SCORE = 5000`으로 뺀다. 배수가 줄지 않아 기존보다 점수가 크게 오를 수 있으므로, 값은 플레이 테스트 후 조정한다.

### 4.2 게임 상태 (`js_file.js`)

기존 전역 변수에 아래를 더하거나 바꾼다.

- `board`: 현재 판 (기존 1차원 `grid` 배열을 대체)
- `activeFruits`: 이번 판에 쓰는 6종류
- `isAnimating`: 한 수의 처리(애니메이션 포함)가 진행 중이면 참
- `gameSession`: 게임을 시작하거나 홈으로 갈 때마다 1씩 증가하는 번호
- `timeUp`: 시간이 끝났지만 진행 중인 수가 있어 종료를 미룬 상태

### 4.3 한 수의 흐름 (`handleSwap(a, b)`)

1. 게임 중이 아니거나 `isAnimating`이면 무시한다.
2. `isAnimating = true`, 현재 `gameSession` 번호를 기억한다.
3. `Board.resolveMove`로 결과를 계산하고, `Scoring.scoreMove`로 점수와 새 상태를 계산한다.
4. 헛밀기면:
   - 자리 바꾸기 애니메이션 후 되돌리기 애니메이션
   - 실패 효과음, 바꾸려던 두 과일만 4번 프레임 약 0.5초 표시 (벌을 받는 느낌이 들지 않게 판 전체 연출은 쓰지 않음)
   - 점수·배수·콤보는 바뀌지 않음
5. 매칭이면:
   - 자리 바꾸기 애니메이션
   - 각 단계마다: 터지기 애니메이션 → 해당 단계 점수 반영 → (2단계 이상이면 `CHAIN x{n}!` 표시) → 떨어지기 애니메이션
   - 모든 단계 후 배수·콤보 반영. `isCombo`면 `COMBO x{n}! +0.5x` 표시
   - `board = finalBoard`
   - `Board.hasPossibleMove(board)`가 거짓이면 `Shuffle!` 표시 후 `Board.shuffle` 결과로 판을 다시 그린다.
6. 각 `await` 후 `gameSession`이 바뀌었으면 즉시 중단한다.
7. `isAnimating = false`. `timeUp`이면 `endGame()`을 호출한다.

### 4.4 타이머와 종료

- 타이머가 0이 됐을 때 `isAnimating`이 거짓이면 즉시 `endGame()`을 호출한다.
- 참이면 `timeUp = true`로 두고, 4.3의 7번에서 종료한다. 진행 중이던 연쇄 점수는 모두 포함된다.
- 시간이 끝난 뒤에는 새 입력을 받지 않는다.
- `restartGame()`은 `gameSession`을 올리고 `isAnimating`, `timeUp`을 초기화한다.

### 4.5 기존 연출 유지

- 배수 1.5 / 2.0 / 3.0 이상에서의 배경·그리드 빛 효과 유지 (`updateComboEffects`)
- 마지막 5초 사이렌 효과 유지
- 콤보 카운터, 배수 표시 유지

## 5. 입력과 애니메이션

### 5.1 화면 구성

- `.grid`: `grid-template-columns: repeat(7, 1fr)`, `grid-template-rows: repeat(8, 1fr)`, 폭 최대 약 360px, `touch-action: none`
- `.cell`: 칸 높이 최대 50px 제한을 풀고 `aspect-ratio: 1/1` 유지. 과일이 판 위에서 떨어져 들어오는 모습이 보이도록 `.cell`의 `overflow: hidden`은 해제하고, `.grid`에서 판 바깥을 잘라낸다.
- 칸 56개는 `data-row`, `data-col`로 위치를 고정한다. 과일 이미지 `src`만 바꾸거나 `transform`으로 움직인다.
- 제거: `selectCell`, `checkMatch`, `removeCells`, `resetAllCells`, `isValidMatch`, `.cell.selected`, `.cell.removing`
- How to Play 문구: 과일을 옆 칸으로 밀어 같은 과일 3개 이상을 가로나 세로로 줄 세우면 사라진다는 내용, 연쇄와 같은 과일 연속 매칭 시 점수가 더 오른다는 팁.

### 5.2 밀기 입력 (Pointer Events)

`.grid`에 `pointerdown`, `pointermove`, `pointerup`, `pointercancel`을 등록한다.

1. **`pointerdown`**: 칸 위에서 눌렀고 입력 가능한 상태면 시작 칸과 좌표를 저장하고 `setPointerCapture`한다. 과일을 2번 프레임으로 바꾸고 뾱 효과음을 낸다.
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

## 6. 테스트

### 6.1 Node 테스트 (`node --test tests/`)

**`board.test.js`**
- `createBoard`: 크기가 8×7, 매칭 없음, `hasPossibleMove` 참, 지정한 과일만 사용
- `isAdjacent`: 상하좌우 참, 대각선·두 칸 거리·같은 칸 거짓
- `findMatches`: 가로 3, 세로 3, 가로 4·5, L자·T자 합치기, 서로 떨어진 두 묶음, 매칭 없음
- `resolveMove`: 인접하지 않은 칸, 매칭 없는 교환은 `valid: false`. 매칭 시 칸 비우기·떨어뜨리기·채우기 결과 확인. 시드 고정 `rng`로 연쇄 2단계 이상 발생 시 `chain` 번호와 단계별 판 확인. 원본 판이 바뀌지 않음
- `hasPossibleMove`: 둘 수 있는 판 참, 둘 수 없는 판 거짓
- `shuffle`: 결과에 매칭 없음, `hasPossibleMove` 참, 과일 구성(종류별 개수) 유지

**`scoring.test.js`**
- `baseScore`: 3, 4, 5, 6개
- 단일 매칭 점수, 배수 적용과 `floor`
- 연쇄 단계 배율
- 같은 과일 연속 시 +0.5와 콤보 증가, 다른 과일 시 +0.1과 콤보 1
- 기준 과일 결정: 옮긴 과일이 매칭된 경우, 밀려난 과일만 매칭된 경우
- 헛밀기 시 점수 0, 상태(배수·콤보·기준 과일) 그대로 유지
- 다른 과일 매칭 시 콤보는 1이 되지만 배수는 줄지 않음
- 배수 반올림 (0.1을 여러 번 더해도 1.3 등으로 저장)

### 6.2 브라우저 확인

모바일 크기(375×812) 화면에서 실제 드래그로 확인한다.
- 매칭 성공과 점수·배수 표시
- 헛밀기 시 되돌림, 배수·콤보 유지
- 연쇄 발생 시 `CHAIN` 표시
- 애니메이션 중 추가 입력 무시
- 게임 도중 홈 버튼 후 새 게임 시작 시 이전 애니메이션이 새 판에 영향 없음
- 시간 종료, 게임 오버 화면, 최고 점수 저장
- 콘솔 오류 없음
