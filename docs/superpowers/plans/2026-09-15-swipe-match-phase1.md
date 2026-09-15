# 밀기 방식 3매칭 1단계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 과일을 터치해 3개를 고르는 방식을, 과일을 옆 칸으로 밀어 가로·세로 3개 이상을 맞추는 방식으로 바꾼다. 떨어짐, 연쇄, 새 점수 체계를 포함한다.

**Architecture:** 판 규칙(`board.js`)과 점수 규칙(`scoring.js`)은 DOM을 쓰지 않는 순수 함수로 만들고 Node 내장 테스트로 검증한다. `js_file.js`는 그 결과를 받아 Pointer Events 입력, Web Animations API 애니메이션, 효과음, 화면 표시만 담당한다. 한 수를 처리하는 동안(`isAnimating`)에는 입력을 받지 않고, 게임 번호(`gameSession`)로 중간에 끝난 게임의 애니메이션이 새 게임을 건드리지 못하게 한다.

**Tech Stack:** 빌드 도구 없는 HTML/CSS/JavaScript, Web Animations API, Pointer Events, Node 내장 `node:test` (Node 18 이상, 현재 v24.7.0)

**Spec:** `docs/superpowers/specs/2026-09-15-swipe-match-design.md` (3~5장, 7장의 1단계 항목)

## Global Constraints

- npm 패키지·빌드 도구를 추가하지 않는다. `package.json`도 만들지 않는다.
- `board.js`, `scoring.js`는 일반 `<script>`로 로드되며, 브라우저에서는 `window.Board` / `window.Scoring`, Node에서는 `module.exports`로 내보낸다.
- 판: 8행 × 7열 (`ROWS = 8`, `COLS = 7`), 매 판 7종류 중 6종류 사용.
- 헛밀기에는 불이익이 없다. 점수·배수·콤보·시간이 바뀌지 않는다.
- 게임 중 배수는 줄어들지 않는다. 같은 과일 연속 +0.5, 다른 과일 +0.1, 소수 첫째 자리로 반올림.
- 기본 점수: 3개 100, 4개 200, 5개 이상 400. 묶음 점수 = `floor(기본 점수 × 연쇄 단계 × 배수)`.
- 제한 시간 30초, 랭킹 등록 기준 5000점(`LEADERBOARD_MIN_SCORE`).
- 게임 화면 문구는 기존처럼 영어로 쓴다.
- `js_file.js`는 4칸 들여쓰기, 세미콜론 사용. 기존 한국어/영어 주석은 건드리지 않는다.
- 이번 계획에서 `sw.js`, 아이콘, 랭킹 XSS는 수정하지 않는다.
- 모든 커밋 메시지 끝에 아래 줄을 넣는다.
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

## 파일 구조

| 파일 | 작업 | 책임 |
|---|---|---|
| `board.js` | 생성 (Task 1~3) | 매칭 판정, 떨어뜨리기·채우기, 연쇄, 둘 수 있는 수, 판 생성, 섞기 |
| `scoring.js` | 생성 (Task 4) | 한 수의 점수와 배수·콤보 변화 |
| `tests/helpers.js` | 생성 (Task 1) | 문자열 판 변환, 결정적 난수 |
| `tests/board.test.js` | 생성 (Task 1~3) | `board.js` 테스트 |
| `tests/scoring.test.js` | 생성 (Task 4) | `scoring.js` 테스트 |
| `index.html` | 수정 (Task 5, 7) | 스크립트 로드, 설명 문구 |
| `css_file.css` | 수정 (Task 5) | 7×8 그리드, 과일 래퍼, 옛 선택 스타일 제거 |
| `js_file.js` | 수정 (Task 5~7) | 판 렌더링, 밀기 입력, 애니메이션, 게임 진행 |
| `manifest.json` | 수정 (Task 7) | 설명 문구 |

## 브라우저 확인 방법 (Task 5~7 공통)

프로젝트 폴더에서 로컬 서버를 띄운다.

```bash
python3 -m http.server 8765
```

- 브라우저에서 `http://localhost:8765`를 열고, 개발자 도구에서 모바일 크기(375×812)로 맞춘다.
- 코드를 바꾼 뒤에는 강력 새로고침(Cmd+Shift+R)을 한다.
- 브라우저 탭이 보이는 상태여야 한다. 탭이 숨겨지면 애니메이션이 멈춘다.
- 콘솔에 `sw.js`의 `/html_file.html` 404와 관련된 오류가 보일 수 있다. 기존 문제이므로 무시한다.

---

### Task 1: 테스트 도구와 매칭 판정

**Files:**
- Create: `tests/helpers.js`
- Create: `board.js`
- Create: `tests/board.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `Board.ROWS = 8`, `Board.COLS = 7`
  - `Board.isAdjacent(a, b) → boolean` (`a`, `b`: `{ row, col }`)
  - `Board.findMatches(board) → Array<{ fruit: string, cells: Array<{ row, col }> }>`
    - `board`: `board[row][col]`에 과일 문자열(빈칸은 `null`)이 든 2차원 배열
  - `tests/helpers.js`: `parseBoard(lines)`, `boardToLines(board)`, `sequenceRng(values)`, `seededRng(seed)`, `cellKeys(cells)`

- [ ] **Step 1: 테스트 도구 작성**

`tests/helpers.js`:

```js
// Test helpers: boards are written as strings, one letter per fruit.

function parseBoard(lines) {
    return lines.map(line => line.split(''));
}

function boardToLines(board) {
    return board.map(row => row.join(''));
}

// Returns the given values in order, repeating from the start.
function sequenceRng(values) {
    let index = 0;
    return () => values[index++ % values.length];
}

// Deterministic pseudo-random numbers in [0, 1) (mulberry32).
function seededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function cellKeys(cells) {
    return cells.map(cell => `${cell.row},${cell.col}`).sort();
}

module.exports = { parseBoard, boardToLines, sequenceRng, seededRng, cellKeys };
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/board.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Board = require('../board.js');
const { parseBoard, boardToLines, sequenceRng, seededRng, cellKeys } = require('./helpers.js');

test('isAdjacent is true only for up, down, left, right neighbors', () => {
    const center = { row: 2, col: 2 };
    assert.equal(Board.isAdjacent(center, { row: 1, col: 2 }), true);
    assert.equal(Board.isAdjacent(center, { row: 3, col: 2 }), true);
    assert.equal(Board.isAdjacent(center, { row: 2, col: 1 }), true);
    assert.equal(Board.isAdjacent(center, { row: 2, col: 3 }), true);
    assert.equal(Board.isAdjacent(center, { row: 1, col: 1 }), false);
    assert.equal(Board.isAdjacent(center, { row: 2, col: 4 }), false);
    assert.equal(Board.isAdjacent(center, { row: 2, col: 2 }), false);
});

test('findMatches finds a horizontal line of 3', () => {
    const groups = Board.findMatches(parseBoard(['aaab', 'cdec', 'dcfd']));
    assert.equal(groups.length, 1);
    assert.equal(groups[0].fruit, 'a');
    assert.deepEqual(cellKeys(groups[0].cells), ['0,0', '0,1', '0,2']);
});

test('findMatches finds a vertical line of 3', () => {
    const groups = Board.findMatches(parseBoard(['abc', 'ade', 'afg']));
    assert.equal(groups.length, 1);
    assert.deepEqual(cellKeys(groups[0].cells), ['0,0', '1,0', '2,0']);
});

test('findMatches finds lines of 4 and 5', () => {
    assert.equal(Board.findMatches(parseBoard(['aaaab']))[0].cells.length, 4);
    assert.equal(Board.findMatches(parseBoard(['aaaaa']))[0].cells.length, 5);
});

test('findMatches merges an L shape into one group without double counting', () => {
    const groups = Board.findMatches(parseBoard(['abc', 'ade', 'aaa']));
    assert.equal(groups.length, 1);
    assert.deepEqual(cellKeys(groups[0].cells), ['0,0', '1,0', '2,0', '2,1', '2,2']);
});

test('findMatches merges a T shape into one group', () => {
    const groups = Board.findMatches(parseBoard(['aaa', 'bac', 'dae']));
    assert.equal(groups.length, 1);
    assert.equal(groups[0].cells.length, 5);
});

test('findMatches keeps separate lines as separate groups', () => {
    const groups = Board.findMatches(parseBoard(['aaab', 'cdef', 'gbbb']));
    assert.equal(groups.length, 2);
    assert.deepEqual(groups.map(group => group.fruit).sort(), ['a', 'b']);
});

test('findMatches returns an empty list when nothing lines up', () => {
    assert.deepEqual(Board.findMatches(parseBoard(['abc', 'bca', 'cab'])), []);
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `node --test tests/*.test.js`
Expected: FAIL. `Cannot find module '../board.js'`

- [ ] **Step 4: 최소 구현 작성**

`board.js`:

```js
// Board rules for the swipe match game. No DOM access.
(function (root) {
    'use strict';

    const ROWS = 8;
    const COLS = 7;

    function isAdjacent(a, b) {
        return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
    }

    // Straight lines of 3+ identical fruits, horizontal first, then vertical.
    function findRuns(board) {
        const rows = board.length;
        const cols = board[0].length;
        const runs = [];

        for (let row = 0; row < rows; row++) {
            let start = 0;
            for (let col = 1; col <= cols; col++) {
                if (col < cols && board[row][col] !== null && board[row][col] === board[row][start]) continue;
                if (col - start >= 3 && board[row][start] !== null) {
                    const cells = [];
                    for (let k = start; k < col; k++) cells.push({ row, col: k });
                    runs.push({ fruit: board[row][start], cells });
                }
                start = col;
            }
        }

        for (let col = 0; col < cols; col++) {
            let start = 0;
            for (let row = 1; row <= rows; row++) {
                if (row < rows && board[row][col] !== null && board[row][col] === board[start][col]) continue;
                if (row - start >= 3 && board[start][col] !== null) {
                    const cells = [];
                    for (let k = start; k < row; k++) cells.push({ row: k, col });
                    runs.push({ fruit: board[start][col], cells });
                }
                start = row;
            }
        }

        return runs;
    }

    // Runs that share a cell (L, T, cross shapes) are merged into one group.
    function findMatches(board) {
        const runs = findRuns(board);
        const parent = runs.map((_, index) => index);
        const find = index => (parent[index] === index ? index : (parent[index] = find(parent[index])));
        const owner = new Map();

        runs.forEach((run, index) => {
            run.cells.forEach(cell => {
                const key = cell.row + ',' + cell.col;
                if (owner.has(key)) {
                    parent[find(index)] = find(owner.get(key));
                } else {
                    owner.set(key, index);
                }
            });
        });

        const groups = new Map();
        runs.forEach((run, index) => {
            const rootIndex = find(index);
            if (!groups.has(rootIndex)) {
                groups.set(rootIndex, { fruit: run.fruit, cells: [], keys: new Set() });
            }
            const group = groups.get(rootIndex);
            run.cells.forEach(cell => {
                const key = cell.row + ',' + cell.col;
                if (!group.keys.has(key)) {
                    group.keys.add(key);
                    group.cells.push(cell);
                }
            });
        });

        return Array.from(groups.values()).map(group => ({ fruit: group.fruit, cells: group.cells }));
    }

    const Board = {
        ROWS,
        COLS,
        isAdjacent,
        findMatches
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Board;
    } else {
        root.Board = Board;
    }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test tests/*.test.js`
Expected: PASS, `ℹ pass 8`, `ℹ fail 0`

- [ ] **Step 6: 커밋**

```bash
git add board.js tests/helpers.js tests/board.test.js
git commit -m "feat: add board match detection with tests

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 떨어뜨리기, 연쇄, 한 수 처리

**Files:**
- Modify: `board.js`
- Modify: `tests/board.test.js` (파일 끝에 추가)

**Interfaces:**
- Consumes: `Board.isAdjacent`, `Board.findMatches` (Task 1)
- Produces:
  - `Board.clearAndCollapse(board, cells, rng, fruits) → { falls, spawns, board }`
    - `falls: Array<{ from: {row, col}, to: {row, col}, fruit }>`
    - `spawns: Array<{ to: {row, col}, fromRow: number (음수), fruit }>`
    - 새 과일은 열 왼쪽→오른쪽, 한 열 안에서는 아래→위 순서로 `rng`를 쓴다.
  - `Board.cascade(board, rng, fruits, startChain) → { steps, finalBoard }`
  - `Board.resolveMove(board, a, b, rng, fruits) → { valid: false } | { valid: true, swappedBoard, steps, finalBoard }`
    - `a`: 사용자가 민 칸, `b`: 밀려난 칸
  - 단계(step) 형식: `{ kind: 'match', chain, groups, cleared, falls, spawns, board }`
  - `rng`: `() => number` in `[0, 1)`, `fruits`: 새 과일 후보 문자열 배열

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/board.test.js` 끝에 추가:

```js
test('clearAndCollapse drops fruits and fills from the top', () => {
    const board = parseBoard(['ab', 'cd', 'ef']);
    const result = Board.clearAndCollapse(
        board,
        [{ row: 2, col: 0 }, { row: 1, col: 1 }],
        sequenceRng([0, 0.5]),
        ['x', 'y']
    );

    assert.deepEqual(boardToLines(result.board), ['xy', 'ab', 'cf']);
    assert.deepEqual(result.falls, [
        { from: { row: 1, col: 0 }, to: { row: 2, col: 0 }, fruit: 'c' },
        { from: { row: 0, col: 0 }, to: { row: 1, col: 0 }, fruit: 'a' },
        { from: { row: 0, col: 1 }, to: { row: 1, col: 1 }, fruit: 'b' }
    ]);
    assert.deepEqual(result.spawns, [
        { to: { row: 0, col: 0 }, fromRow: -1, fruit: 'x' },
        { to: { row: 0, col: 1 }, fromRow: -1, fruit: 'y' }
    ]);
    assert.deepEqual(boardToLines(board), ['ab', 'cd', 'ef']);
});

// Swapping (3,1) 'a' up into (2,1) makes "aaa" on row 2.
// After it pops, the three 'k's in column 0 fall into a vertical line and pop as chain 2.
const CHAIN_BOARD = ['kqm', 'kno', 'aba', 'kad', 'efg'];
const CHAIN_FRUITS = ['x', 'y', 'z'];
const chainRng = () => sequenceRng([0, 0.4, 0.7]);

test('resolveMove rejects cells that are not neighbors', () => {
    const board = parseBoard(CHAIN_BOARD);
    const result = Board.resolveMove(board, { row: 0, col: 0 }, { row: 0, col: 2 }, chainRng(), CHAIN_FRUITS);
    assert.deepEqual(result, { valid: false });
});

test('resolveMove rejects a swap that makes no match', () => {
    const board = parseBoard(CHAIN_BOARD);
    const result = Board.resolveMove(board, { row: 0, col: 1 }, { row: 0, col: 2 }, chainRng(), CHAIN_FRUITS);
    assert.deepEqual(result, { valid: false });
});

test('resolveMove plays out the full chain reaction', () => {
    const board = parseBoard(CHAIN_BOARD);
    const result = Board.resolveMove(board, { row: 3, col: 1 }, { row: 2, col: 1 }, chainRng(), CHAIN_FRUITS);

    assert.equal(result.valid, true);
    assert.deepEqual(boardToLines(result.swappedBoard), ['kqm', 'kno', 'aaa', 'kbd', 'efg']);
    assert.equal(result.steps.length, 2);

    const [first, second] = result.steps;
    assert.equal(first.kind, 'match');
    assert.equal(first.chain, 1);
    assert.equal(first.groups.length, 1);
    assert.equal(first.groups[0].fruit, 'a');
    assert.deepEqual(cellKeys(first.cleared), ['2,0', '2,1', '2,2']);
    assert.deepEqual(boardToLines(first.board), ['xyz', 'kqm', 'kno', 'kbd', 'efg']);
    assert.deepEqual(first.spawns, [
        { to: { row: 0, col: 0 }, fromRow: -1, fruit: 'x' },
        { to: { row: 0, col: 1 }, fromRow: -1, fruit: 'y' },
        { to: { row: 0, col: 2 }, fromRow: -1, fruit: 'z' }
    ]);

    assert.equal(second.kind, 'match');
    assert.equal(second.chain, 2);
    assert.equal(second.groups[0].fruit, 'k');
    assert.deepEqual(cellKeys(second.cleared), ['1,0', '2,0', '3,0']);
    assert.deepEqual(second.falls, [{ from: { row: 0, col: 0 }, to: { row: 3, col: 0 }, fruit: 'x' }]);
    assert.deepEqual(second.spawns, [
        { to: { row: 2, col: 0 }, fromRow: -1, fruit: 'x' },
        { to: { row: 1, col: 0 }, fromRow: -2, fruit: 'y' },
        { to: { row: 0, col: 0 }, fromRow: -3, fruit: 'z' }
    ]);

    assert.deepEqual(boardToLines(result.finalBoard), ['zyz', 'yqm', 'xno', 'xbd', 'efg']);
    assert.deepEqual(boardToLines(board), CHAIN_BOARD);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/*.test.js`
Expected: FAIL 4개. `Board.clearAndCollapse is not a function`, `Board.resolveMove is not a function`

- [ ] **Step 3: 구현**

`board.js`에서 `const COLS = 7;` 바로 아래에 추가:

```js

    function cloneBoard(board) {
        return board.map(row => row.slice());
    }

    function randomFruit(rng, fruits) {
        return fruits[Math.floor(rng() * fruits.length)];
    }

    function inBounds(board, cell) {
        return cell.row >= 0 && cell.row < board.length && cell.col >= 0 && cell.col < board[0].length;
    }
```

`isAdjacent` 함수 바로 아래에 추가:

```js

    function swapCells(board, a, b) {
        const next = cloneBoard(board);
        next[a.row][a.col] = board[b.row][b.col];
        next[b.row][b.col] = board[a.row][a.col];
        return next;
    }
```

`findMatches` 함수 끝(`}`) 바로 아래, `const Board = {` 위에 추가:

```js

    // Empties the cells, drops fruits down, and fills the top with new fruits.
    // New fruits are drawn column by column (left to right), bottom to top within a column.
    function clearAndCollapse(board, cells, rng, fruits) {
        const rows = board.length;
        const cols = board[0].length;
        const working = cloneBoard(board);
        cells.forEach(cell => {
            working[cell.row][cell.col] = null;
        });

        const next = working.map(row => row.map(() => null));
        const falls = [];
        const spawns = [];

        for (let col = 0; col < cols; col++) {
            let target = rows - 1;
            for (let row = rows - 1; row >= 0; row--) {
                const fruit = working[row][col];
                if (fruit === null) continue;
                next[target][col] = fruit;
                if (target !== row) {
                    falls.push({ from: { row, col }, to: { row: target, col }, fruit });
                }
                target--;
            }

            const emptyCount = target + 1;
            for (let row = target; row >= 0; row--) {
                const fruit = randomFruit(rng, fruits);
                next[row][col] = fruit;
                spawns.push({ to: { row, col }, fromRow: row - emptyCount, fruit });
            }
        }

        return { falls, spawns, board: next };
    }

    function cascade(board, rng, fruits, startChain) {
        const steps = [];
        let current = board;
        let chain = startChain;
        let groups = findMatches(current);

        while (groups.length > 0) {
            const cleared = groups.flatMap(group => group.cells);
            const result = clearAndCollapse(current, cleared, rng, fruits);
            steps.push({
                kind: 'match',
                chain,
                groups,
                cleared,
                falls: result.falls,
                spawns: result.spawns,
                board: result.board
            });
            current = result.board;
            chain++;
            groups = findMatches(current);
        }

        return { steps, finalBoard: current };
    }

    // a: the cell the player dragged, b: the neighbor it was pushed into.
    function resolveMove(board, a, b, rng, fruits) {
        if (!inBounds(board, a) || !inBounds(board, b) || !isAdjacent(a, b)) {
            return { valid: false };
        }
        const swappedBoard = swapCells(board, a, b);
        if (findMatches(swappedBoard).length === 0) {
            return { valid: false };
        }
        const { steps, finalBoard } = cascade(swappedBoard, rng, fruits, 1);
        return { valid: true, swappedBoard, steps, finalBoard };
    }
```

내보내기 객체를 아래로 바꾼다:

```js
    const Board = {
        ROWS,
        COLS,
        isAdjacent,
        findMatches,
        clearAndCollapse,
        cascade,
        resolveMove
    };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/*.test.js`
Expected: PASS, `ℹ pass 12`, `ℹ fail 0`

- [ ] **Step 5: 커밋**

```bash
git add board.js tests/board.test.js
git commit -m "feat: add gravity, refill, and chain resolution for swaps

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: 둘 수 있는 수, 판 생성, 섞기

**Files:**
- Modify: `board.js`
- Modify: `tests/board.test.js` (파일 끝에 추가)

**Interfaces:**
- Consumes: Task 1~2의 `findMatches`, 내부 `swapCells`, `inBounds`, `randomFruit`
- Produces:
  - `Board.findBestMove(board) → { a: {row, col}, b: {row, col}, size: number } | null`
  - `Board.hasPossibleMove(board) → boolean`
  - `Board.pickFruits(rng, allFruits, count) → string[]` (중복 없음)
  - `Board.createBoard(rng, fruits) → string[][]` (8×7, 매칭 없음, 둘 수 있는 수 있음, `fruits`는 3개 이상)
  - `Board.shuffle(board, rng) → string[][]` (같은 과일 구성, 매칭 없음, 둘 수 있는 수 있음)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/board.test.js` 끝에 추가:

```js
test('findBestMove picks the swap that pops the most cells', () => {
    const board = parseBoard(['abaac', 'difgh', 'ijiik', 'lmnop']);
    assert.deepEqual(Board.findBestMove(board), { a: { row: 1, col: 1 }, b: { row: 2, col: 1 }, size: 4 });
});

test('findBestMove keeps the first move found on a tie', () => {
    const board = parseBoard(['abaa', 'ecee']);
    assert.deepEqual(Board.findBestMove(board), { a: { row: 0, col: 0 }, b: { row: 0, col: 1 }, size: 3 });
});

test('findBestMove returns null and hasPossibleMove is false when no swap matches', () => {
    const board = parseBoard(['abcd', 'cdab', 'abcd']);
    assert.equal(Board.findBestMove(board), null);
    assert.equal(Board.hasPossibleMove(board), false);
    assert.equal(Board.hasPossibleMove(parseBoard(['abaa'])), true);
});

test('pickFruits returns the requested number of distinct fruits', () => {
    const all = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const picked = Board.pickFruits(seededRng(1), all, 6);
    assert.equal(picked.length, 6);
    assert.equal(new Set(picked).size, 6);
    picked.forEach(fruit => assert.ok(all.includes(fruit)));
});

test('createBoard makes an 8x7 board with no matches and at least one move', () => {
    const fruits = ['a', 'b', 'c', 'd', 'e', 'f'];
    for (let seed = 1; seed <= 20; seed++) {
        const board = Board.createBoard(seededRng(seed), fruits);
        assert.equal(board.length, Board.ROWS);
        board.forEach(row => assert.equal(row.length, Board.COLS));
        board.flat().forEach(fruit => assert.ok(fruits.includes(fruit)));
        assert.deepEqual(Board.findMatches(board), []);
        assert.equal(Board.hasPossibleMove(board), true);
    }
});

test('shuffle keeps the same fruits, leaves no matches, and has a move', () => {
    const fruits = ['a', 'b', 'c', 'd', 'e', 'f'];
    const countFruits = board => board.flat().sort().join('');
    for (let seed = 1; seed <= 10; seed++) {
        const board = Board.createBoard(seededRng(seed), fruits);
        const shuffled = Board.shuffle(board, seededRng(seed + 100));
        assert.equal(countFruits(shuffled), countFruits(board));
        assert.deepEqual(Board.findMatches(shuffled), []);
        assert.equal(Board.hasPossibleMove(shuffled), true);
    }
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/*.test.js`
Expected: FAIL 6개. `Board.findBestMove is not a function` 등

- [ ] **Step 3: 구현**

`board.js`의 `resolveMove` 함수 끝(`}`) 바로 아래, `const Board = {` 위에 추가:

```js

    // The swap that pops the most cells right away. Ties keep the first one found
    // (top to bottom, left to right, right neighbor before bottom neighbor).
    function findBestMove(board) {
        const rows = board.length;
        const cols = board[0].length;
        let best = null;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const a = { row, col };
                const neighbors = [{ row, col: col + 1 }, { row: row + 1, col }];
                neighbors.forEach(b => {
                    if (!inBounds(board, b) || board[a.row][a.col] === board[b.row][b.col]) return;
                    const groups = findMatches(swapCells(board, a, b));
                    const size = groups.reduce((sum, group) => sum + group.cells.length, 0);
                    if (size > 0 && (best === null || size > best.size)) {
                        best = { a, b, size };
                    }
                });
            }
        }

        return best;
    }

    function hasPossibleMove(board) {
        return findBestMove(board) !== null;
    }

    function pickFruits(rng, allFruits, count) {
        const pool = allFruits.slice();
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool.slice(0, count);
    }

    // Requires at least 3 fruits so every cell has a fruit that does not complete a line.
    function createBoard(rng, fruits) {
        for (;;) {
            const board = [];
            for (let row = 0; row < ROWS; row++) {
                const line = [];
                board.push(line);
                for (let col = 0; col < COLS; col++) {
                    const options = fruits.filter(fruit => {
                        const makesRow = col >= 2 && line[col - 1] === fruit && line[col - 2] === fruit;
                        const makesColumn = row >= 2 && board[row - 1][col] === fruit && board[row - 2][col] === fruit;
                        return !makesRow && !makesColumn;
                    });
                    line.push(randomFruit(rng, options));
                }
            }
            if (hasPossibleMove(board)) return board;
        }
    }

    function shuffle(board, rng) {
        const rows = board.length;
        const cols = board[0].length;
        const flat = board.flat();

        for (let attempt = 0; attempt < 100; attempt++) {
            const items = flat.slice();
            for (let i = items.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [items[i], items[j]] = [items[j], items[i]];
            }
            const next = [];
            for (let row = 0; row < rows; row++) {
                next.push(items.slice(row * cols, (row + 1) * cols));
            }
            if (findMatches(next).length === 0 && hasPossibleMove(next)) return next;
        }

        return createBoard(rng, Array.from(new Set(flat)));
    }
```

내보내기 객체를 아래로 바꾼다:

```js
    const Board = {
        ROWS,
        COLS,
        isAdjacent,
        findMatches,
        clearAndCollapse,
        cascade,
        resolveMove,
        findBestMove,
        hasPossibleMove,
        pickFruits,
        createBoard,
        shuffle
    };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/*.test.js`
Expected: PASS, `ℹ pass 18`, `ℹ fail 0`

- [ ] **Step 5: 커밋**

```bash
git add board.js tests/board.test.js
git commit -m "feat: add move search, board generation, and shuffle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: 점수 계산

**Files:**
- Create: `scoring.js`
- Create: `tests/scoring.test.js`

**Interfaces:**
- Consumes: `Board.resolveMove` 결과 형식 (Task 2). `scoring.js`는 `board.js`를 불러오지 않는다.
- Produces:
  - `Scoring.createScoreState() → { multiplier: 1.0, comboCount: 0, lastMatchedFruit: null }`
  - `Scoring.baseScore(size) → 100 | 200 | 400`
  - `Scoring.matchStepScore(step, multiplier) → number`
  - `Scoring.scoreMove(result, state, movedFruit, displacedFruit) → { total, stepScores: number[], isCombo: boolean, state }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/scoring.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Scoring = require('../scoring.js');

// Builds a group with `size` placeholder cells.
function group(fruit, size) {
    return { fruit, cells: Array.from({ length: size }, (_, col) => ({ row: 0, col })) };
}

function step(chain, groups) {
    return { kind: 'match', chain, groups };
}

function validResult(steps) {
    return { valid: true, steps };
}

function state(multiplier, comboCount, lastMatchedFruit) {
    return { multiplier, comboCount, lastMatchedFruit };
}

test('createScoreState starts at x1.0 with no combo', () => {
    assert.deepEqual(Scoring.createScoreState(), state(1.0, 0, null));
});

test('baseScore rewards bigger matches', () => {
    assert.equal(Scoring.baseScore(3), 100);
    assert.equal(Scoring.baseScore(4), 200);
    assert.equal(Scoring.baseScore(5), 400);
    assert.equal(Scoring.baseScore(6), 400);
});

test('matchStepScore multiplies by chain and multiplier and floors each group', () => {
    assert.equal(Scoring.matchStepScore(step(1, [group('a', 3)]), 1.0), 100);
    assert.equal(Scoring.matchStepScore(step(2, [group('a', 4)]), 1.5), 600);
    assert.equal(Scoring.matchStepScore(step(1, [group('a', 3), group('b', 3)]), 1.25), 250);
    assert.equal(Scoring.matchStepScore(step(1, [group('a', 3)]), 1.333), 133);
});

test('scoreMove adds up every step using the multiplier from before the move', () => {
    const result = validResult([step(1, [group('apple', 4)]), step(2, [group('kiwi', 3)])]);
    const scored = Scoring.scoreMove(result, state(1.5, 0, null), 'apple', 'kiwi');
    assert.deepEqual(scored.stepScores, [300, 300]);
    assert.equal(scored.total, 600);
});

test('scoreMove gives +0.1 and restarts the combo count for a different fruit', () => {
    const result = validResult([step(1, [group('apple', 3)])]);
    const scored = Scoring.scoreMove(result, state(2.0, 3, 'kiwi'), 'apple', 'kiwi');
    assert.equal(scored.isCombo, false);
    assert.deepEqual(scored.state, state(2.1, 1, 'apple'));
});

test('scoreMove gives +0.5 and grows the combo for the same fruit again', () => {
    const result = validResult([step(1, [group('apple', 3)])]);
    const scored = Scoring.scoreMove(result, state(1.1, 1, 'apple'), 'apple', 'kiwi');
    assert.equal(scored.isCombo, true);
    assert.deepEqual(scored.state, state(1.6, 2, 'apple'));
});

test('scoreMove uses the displaced fruit when only it matched', () => {
    const result = validResult([step(1, [group('kiwi', 3)])]);
    const scored = Scoring.scoreMove(result, state(1.0, 0, null), 'apple', 'kiwi');
    assert.equal(scored.state.lastMatchedFruit, 'kiwi');
});

test('scoreMove prefers the moved fruit when both swapped fruits matched', () => {
    const result = validResult([step(1, [group('kiwi', 3), group('apple', 3)])]);
    const scored = Scoring.scoreMove(result, state(1.0, 0, null), 'apple', 'kiwi');
    assert.equal(scored.state.lastMatchedFruit, 'apple');
});

test('scoreMove gives no points and keeps the state for an invalid swap', () => {
    const before = state(2.3, 4, 'grape');
    const scored = Scoring.scoreMove({ valid: false }, before, 'apple', 'kiwi');
    assert.equal(scored.total, 0);
    assert.deepEqual(scored.stepScores, []);
    assert.equal(scored.isCombo, false);
    assert.deepEqual(scored.state, before);
});

test('scoreMove rounds the multiplier to one decimal place', () => {
    const fruits = ['apple', 'kiwi', 'grape'];
    let current = Scoring.createScoreState();
    fruits.forEach(fruit => {
        current = Scoring.scoreMove(validResult([step(1, [group(fruit, 3)])]), current, fruit, 'x').state;
    });
    assert.equal(current.multiplier, 1.3);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/scoring.test.js`
Expected: FAIL. `Cannot find module '../scoring.js'`

- [ ] **Step 3: 구현**

`scoring.js`:

```js
// Score and multiplier rules for the swipe match game. No DOM access.
(function (root) {
    'use strict';

    const SAME_FRUIT_BONUS = 0.5;
    const OTHER_FRUIT_BONUS = 0.1;

    function createScoreState() {
        return { multiplier: 1.0, comboCount: 0, lastMatchedFruit: null };
    }

    function baseScore(size) {
        if (size >= 5) return 400;
        if (size === 4) return 200;
        return 100;
    }

    function roundMultiplier(value) {
        return Math.round(value * 10) / 10;
    }

    function matchStepScore(step, multiplier) {
        return step.groups.reduce(
            (sum, group) => sum + Math.floor(baseScore(group.cells.length) * step.chain * multiplier),
            0
        );
    }

    // movedFruit: the fruit the player dragged, displacedFruit: the fruit it swapped with.
    function scoreMove(result, state, movedFruit, displacedFruit) {
        if (!result.valid) {
            return { total: 0, stepScores: [], isCombo: false, state };
        }

        const stepScores = result.steps.map(step => matchStepScore(step, state.multiplier));
        const total = stepScores.reduce((sum, value) => sum + value, 0);
        const firstStepFruits = result.steps[0].groups.map(group => group.fruit);
        const matchedFruit = firstStepFruits.includes(movedFruit) ? movedFruit : displacedFruit;
        const isCombo = matchedFruit === state.lastMatchedFruit;

        return {
            total,
            stepScores,
            isCombo,
            state: {
                multiplier: roundMultiplier(state.multiplier + (isCombo ? SAME_FRUIT_BONUS : OTHER_FRUIT_BONUS)),
                comboCount: isCombo ? state.comboCount + 1 : 1,
                lastMatchedFruit: matchedFruit
            }
        };
    }

    const Scoring = { createScoreState, baseScore, matchStepScore, scoreMove };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Scoring;
    } else {
        root.Scoring = Scoring;
    }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/*.test.js`
Expected: PASS, `ℹ pass 28`, `ℹ fail 0`

- [ ] **Step 5: 커밋**

```bash
git add scoring.js tests/scoring.test.js
git commit -m "feat: add swipe match scoring rules

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: 7×8 판 렌더링과 옛 선택 방식 제거

이 태스크가 끝나면 게임을 시작했을 때 새 7×8 판이 보인다. 아직 밀기 입력은 없다(Task 6).

아래 단계의 줄 번호는 수정 전 원본 파일 기준이다. 앞 단계를 적용하면 줄 번호가 밀리므로, 인용된 코드 블록을 찾아 바꾼다.

**Files:**
- Modify: `index.html:150-151`
- Modify: `css_file.css:228-243`, `css_file.css:287-348`
- Modify: `js_file.js` (여러 곳, 아래 단계 참고)

**Interfaces:**
- Consumes: `Board.ROWS`, `Board.COLS`, `Board.pickFruits`, `Board.createBoard` (Task 1~3)
- Produces (Task 6, 7에서 사용하는 전역):
  - 상수: `ALL_FRUITS`, `FRUITS_PER_GAME`, `GAME_DURATION`, `LEADERBOARD_MIN_SCORE`, `SWIPE_THRESHOLD`
  - 상태: `board`, `activeFruits`, `cellElements` (8×7 `.cell` 요소 배열), `isAnimating`, `timeUp`, `gameSession`, `pointerStart`, `comboTextTimer`
  - `fruitSrc(fruit, frame) → string`
  - `buildGrid()`, `renderBoard()`, `newBoard()`
  - `fruitWrapper(cell) → HTMLElement` (`.fruit`), `fruitImage(cell) → HTMLImageElement`
  - `setCellFruit(cell, fruit, frame = '001')`, `setCellFrame(cell, frame)`, `clearAnimations(cell)`
  - `updateScoreDisplay()`
  - 칸 DOM: `.cell[data-row][data-col] > .fruit > img.fruit-image[data-fruit]`

- [ ] **Step 1: 스크립트 로드 추가**

`index.html`에서:

```html
    <script src="js_file.js"></script>
```

를 아래로 바꾼다:

```html
    <script src="board.js"></script>
    <script src="scoring.js"></script>
    <script src="js_file.js"></script>
```

- [ ] **Step 2: 그리드 CSS 교체**

`css_file.css`의 `.grid { ... }` 블록(228~243줄) 전체를 아래로 바꾼다:

```css
.grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(8, 1fr);
    gap: 4px;
    width: 100%;
    max-width: 360px;
    background: rgba(255, 255, 255, 0.1);
    padding: 10px;
    border-radius: 18px;
    backdrop-filter: blur(5px);
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
    transition: all 0.3s ease;
    overflow: hidden;
    touch-action: none;
}
```

- [ ] **Step 3: 칸 CSS 교체**

`css_file.css`에서 `.cell {`로 시작하는 블록부터 `@keyframes removeAnimation { ... }` 블록 끝까지(287~348줄: `.cell`, `.fruit-image`, `@keyframes fruitIdle`, `.cell:active`, `.cell.selected`, `.cell.removing`, `@keyframes removeAnimation`)를 아래로 바꾼다. `.game-over {` 블록은 그대로 둔다.

```css
.cell {
    background: transparent;
    border-radius: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    position: relative;
    aspect-ratio: 1/1;
}

.fruit {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
}

.fruit-image {
    width: 95%;
    height: 95%;
    object-fit: contain;
    pointer-events: none;
    -webkit-user-drag: none;
    animation: fruitIdle 3s infinite ease-in-out;
}

@keyframes fruitIdle {
    0% { transform: rotate(0deg) scale(1); }
    25% { transform: rotate(-5deg) scale(1.02); }
    50% { transform: rotate(0deg) scale(1); }
    75% { transform: rotate(5deg) scale(1.02); }
    100% { transform: rotate(0deg) scale(1); }
}

.fruit.moving {
    z-index: 2;
}
```

- [ ] **Step 4: 전역 변수 교체**

`js_file.js` 1~16줄:

```js
const fruits = ['apple', 'orange', 'banana', 'grape', 'strawberry', 'kiwi', 'cherry'];
let grid = [];
let selectedCells = [];
let score = 0;
let multiplier = 1.0;
let timeLeft = 30;
let gameRunning = false;
let timerInterval;
let lastMatchedFruit = null;
let comboCount = 0;
let audioContext;
let backgroundMusic;
let noteIndex = 0; // Track current note for 3-cell selection
let lastScore = 0;
let maxMultiplier = 1.0;
let highestScore = 0;
```

를 아래로 바꾼다:

```js
const ALL_FRUITS = ['apple', 'orange', 'banana', 'grape', 'strawberry', 'kiwi', 'cherry'];
const FRUITS_PER_GAME = 6;
const GAME_DURATION = 30;
const LEADERBOARD_MIN_SCORE = 5000;
const SWIPE_THRESHOLD = 0.3; // fraction of a cell the finger must travel to count as a swipe

let board = [];
let activeFruits = [];
let cellElements = [];
let score = 0;
let multiplier = 1.0;
let timeLeft = GAME_DURATION;
let gameRunning = false;
let timerInterval;
let lastMatchedFruit = null;
let comboCount = 0;
let audioContext;
let backgroundMusic;
let lastScore = 0;
let maxMultiplier = 1.0;
let highestScore = 0;
let isAnimating = false;
let timeUp = false;
let gameSession = 0;
let pointerStart = null;
let comboTextTimer;
```

- [ ] **Step 5: `playNoteSound` 삭제**

`// Create musical note sound for 3-cell selection` 주석과 `function playNoteSound() { ... }` 함수 전체(59~84줄)를 삭제한다. 바로 아래 `// 효과음 생성 (뾱 소리)`와 `playPopSound`는 그대로 둔다. (`createBackgroundMusic` 안의 지역 변수 `noteIndex`는 건드리지 않는다.)

- [ ] **Step 6: 옛 격자·선택 로직을 렌더링 함수로 교체**

`function initializeGrid() {`부터 `function resetAllCells() { ... }` 끝까지(`initializeGrid`, `selectCell`, `isValidMatch`, `checkMatch`, `removeCells`, `getRandomItem`, `resetAllCells`, 157~348줄)를 삭제하고, 그 자리(`function updateDisplay() {` 바로 위)에 아래를 넣는다:

```js
function fruitSrc(fruit, frame) {
    return `img/fruit_${fruit}_${frame}.png`;
}

// Builds the 8x7 cell elements once. Each cell holds a .fruit wrapper (moved by
// animations) around the fruit image (which keeps its idle CSS animation).
function buildGrid() {
    const gridElement = document.getElementById('grid');
    gridElement.innerHTML = '';
    cellElements = [];

    for (let row = 0; row < Board.ROWS; row++) {
        const rowElements = [];
        for (let col = 0; col < Board.COLS; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            const wrapper = document.createElement('div');
            wrapper.className = 'fruit';

            const img = document.createElement('img');
            img.className = 'fruit-image';
            img.alt = '';
            img.draggable = false;

            wrapper.appendChild(img);
            cell.appendChild(wrapper);
            gridElement.appendChild(cell);
            rowElements.push(cell);
        }
        cellElements.push(rowElements);
    }
}

function fruitWrapper(cell) {
    return cellElements[cell.row][cell.col].firstChild;
}

function fruitImage(cell) {
    return fruitWrapper(cell).firstChild;
}

function setCellFruit(cell, fruit, frame = '001') {
    const img = fruitImage(cell);
    img.src = fruitSrc(fruit, frame);
    img.dataset.fruit = fruit;
}

function setCellFrame(cell, frame) {
    const img = fruitImage(cell);
    img.src = fruitSrc(img.dataset.fruit, frame);
}

function clearAnimations(cell) {
    const wrapper = fruitWrapper(cell);
    wrapper.getAnimations().forEach(animation => animation.cancel());
    wrapper.classList.remove('moving');
}

function renderBoard() {
    for (let row = 0; row < Board.ROWS; row++) {
        for (let col = 0; col < Board.COLS; col++) {
            const cell = { row, col };
            clearAnimations(cell);
            setCellFruit(cell, board[row][col]);
        }
    }
}

function newBoard() {
    activeFruits = Board.pickFruits(Math.random, ALL_FRUITS, FRUITS_PER_GAME);
    board = Board.createBoard(Math.random, activeFruits);
    renderBoard();
}

```

- [ ] **Step 7: 점수 표시 분리**

```js
function updateDisplay() {
    document.getElementById('score').textContent = score;
    const multiplierElement = document.getElementById('multiplier');
```

를 아래로 바꾼다:

```js
function updateScoreDisplay() {
    document.getElementById('score').textContent = score;
}

function updateDisplay() {
    updateScoreDisplay();
    const multiplierElement = document.getElementById('multiplier');
```

- [ ] **Step 8: 게임 시작 시 새 판 만들기**

`actuallyStartGame` 안의:

```js
    score = 0;
    multiplier = 1.0;
    maxMultiplier = 1.0; // Reset max multiplier for new game
    timeLeft = 30;
    gameRunning = true;
    selectedCells = [];
    lastMatchedFruit = null;
    comboCount = 0;
    
    initializeGrid();
```

를 아래로 바꾼다:

```js
    gameSession++;
    score = 0;
    multiplier = 1.0;
    maxMultiplier = 1.0; // Reset max multiplier for new game
    timeLeft = GAME_DURATION;
    gameRunning = true;
    isAnimating = false;
    timeUp = false;
    pointerStart = null;
    lastMatchedFruit = null;
    comboCount = 0;
    
    newBoard();
```

- [ ] **Step 9: `restartGame`에서 옛 변수 제거**

`restartGame` 안의:

```js
    timeLeft = 30;
    selectedCells = [];
    lastMatchedFruit = null;
```

를 아래로 바꾼다:

```js
    timeLeft = GAME_DURATION;
    lastMatchedFruit = null;
```

- [ ] **Step 10: 옛 실패 표정 함수 삭제**

`function showFailedExpression() { ... }` 함수 전체(판 50칸을 4번 프레임으로 바꾸는 함수, 635~653줄)를 삭제한다. 바로 아래 `function updateComboDisplay()`는 그대로 둔다.

- [ ] **Step 11: 초기화 코드 교체**

파일 맨 끝의:

```js
loadGameData();
initializeGrid();
updateDisplay();
```

를 아래로 바꾼다:

```js
loadGameData();
buildGrid();
newBoard();
updateDisplay();
```

- [ ] **Step 12: 남은 참조 확인**

Run: `grep -nE "selectedCells|initializeGrid|playNoteSound|checkMatch|removeCells|resetAllCells|getRandomItem|isValidMatch|\bgrid\[|\bfruits\[" js_file.js; node --check js_file.js && echo syntax-ok`
Expected: grep 결과 없음, `syntax-ok`

Run: `node --test tests/*.test.js`
Expected: `ℹ pass 28`, `ℹ fail 0`

- [ ] **Step 13: 브라우저 확인**

"브라우저 확인 방법"대로 서버를 띄우고 확인한다.
1. 시작 화면이 전과 같이 보인다.
2. Start Game → Ready/START 후 7열 × 8줄 판이 보이고, 과일이 6종류만 쓰이며, 처음부터 3개가 이어진 곳이 없다.
3. 과일을 눌러도 아무 일도 없다 (입력은 Task 6).
4. 30초 후 Game Over 화면이 뜬다.
5. 콘솔에서 아래가 `ok`를 출력한다.
   ```js
   board.length === 8 && board.every(r => r.length === 7) && document.querySelectorAll('.cell').length === 56 && new Set(board.flat()).size <= 6 && Board.findMatches(board).length === 0 ? 'ok' : 'bad'
   ```
6. 콘솔에 JavaScript 오류가 없다 (서비스 워커 404는 무시).

- [ ] **Step 14: 커밋**

```bash
git add index.html css_file.css js_file.js
git commit -m "feat: render 7x8 board and remove tap-to-select logic

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: 밀기 입력, 애니메이션, 한 수 처리

**Files:**
- Modify: `js_file.js`

**Interfaces:**
- Consumes:
  - Task 5의 전역과 함수 전체
  - `Board.resolveMove`, `Board.hasPossibleMove`, `Board.shuffle` (Task 2~3)
  - `Scoring.scoreMove` (Task 4)
  - 기존 `playPopSound()`, `playFailSound()`, `updateDisplay()`, `updateComboDisplay()`, `endGame()`
- Produces:
  - `handleSwap(a, b) → Promise<void>` (`a`: 민 칸, `b`: 밀려난 칸)
  - `playSteps(steps, stepScores, session) → Promise<boolean>` (중간에 게임이 바뀌면 `false`)
  - `finishTurn(session) → Promise<void>` (섞기 확인, `isAnimating` 해제, `timeUp`이면 `endGame()`)
  - `canAcceptInput() → boolean`
  - `showComboEffect(text)` (연속 호출 시 애니메이션 재시작)
  - `playSuccessSound(chain = 1)`

- [ ] **Step 1: 성공 효과음에 연쇄 음높이 추가**

```js
// 성공 효과음
function playSuccessSound() {
    if (!audioContext) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
```

를 아래로 바꾼다:

```js
// 성공 효과음 (연쇄 단계마다 2음씩 높아짐)
function playSuccessSound(chain = 1) {
    if (!audioContext) return;

    const pitch = Math.pow(2, ((chain - 1) * 2) / 12);
    const notes = [523.25, 659.25, 783.99].map(freq => freq * pitch); // C5, E5, G5
```

- [ ] **Step 2: 애니메이션·입력·한 수 처리 코드 추가**

Task 5에서 넣은 `function newBoard() { ... }` 함수 바로 아래(`function updateScoreDisplay() {` 위)에 추가:

```js
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Runs a Web Animation and resolves when it ends. Cancelled animations resolve too.
function animate(element, keyframes, options) {
    return element.animate(keyframes, { fill: 'forwards', ...options }).finished.catch(() => {});
}

// Distance in layout pixels between neighboring cells (cells are square).
function cellPitch() {
    return cellElements[0][1].offsetLeft - cellElements[0][0].offsetLeft;
}

function animateSwap(a, b, reverse = false) {
    const pitch = cellPitch();
    const dx = (b.col - a.col) * pitch;
    const dy = (b.row - a.row) * pitch;
    const wrapperA = fruitWrapper(a);
    const wrapperB = fruitWrapper(b);
    const still = 'translate(0px, 0px)';
    const toB = `translate(${dx}px, ${dy}px)`;
    const toA = `translate(${-dx}px, ${-dy}px)`;
    const options = { duration: 150, easing: 'ease-in-out' };

    wrapperA.classList.add('moving');
    return Promise.all([
        animate(wrapperA, reverse ? [{ transform: toB }, { transform: still }] : [{ transform: still }, { transform: toB }], options),
        animate(wrapperB, reverse ? [{ transform: toA }, { transform: still }] : [{ transform: still }, { transform: toA }], options)
    ]);
}

function animatePop(cells) {
    cells.forEach(cell => setCellFrame(cell, '003'));
    return Promise.all(cells.map(cell => animate(fruitWrapper(cell), [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(1.25)', opacity: 1, offset: 0.4 },
        { transform: 'scale(0.2)', opacity: 0 }
    ], { duration: 250, easing: 'ease-in' })));
}

// Every cell that changed receives its new fruit, starting from where it falls from.
async function animateFalls(step) {
    const pitch = cellPitch();
    const moves = [
        ...step.falls.map(fall => ({ to: fall.to, fruit: fall.fruit, distance: fall.to.row - fall.from.row })),
        ...step.spawns.map(spawn => ({ to: spawn.to, fruit: spawn.fruit, distance: spawn.to.row - spawn.fromRow }))
    ];

    const animations = moves.map(move => {
        clearAnimations(move.to);
        setCellFruit(move.to, move.fruit);
        return animate(fruitWrapper(move.to), [
            { transform: `translateY(${-move.distance * pitch}px)` },
            { transform: 'translateY(0px)' }
        ], { duration: Math.min(400, 200 + move.distance * 50), easing: 'ease-in' });
    });

    await Promise.all(animations);
    moves.forEach(move => clearAnimations(move.to));
}

async function animateShuffle(nextBoard) {
    const wrappers = cellElements.flat().map(cell => cell.firstChild);
    await Promise.all(wrappers.map(wrapper => animate(wrapper, [
        { transform: 'scale(1)' },
        { transform: 'scale(0)' }
    ], { duration: 200, easing: 'ease-in' })));

    board = nextBoard;
    renderBoard();
    await Promise.all(wrappers.map(wrapper => animate(wrapper, [
        { transform: 'scale(0)' },
        { transform: 'scale(1)' }
    ], { duration: 200, easing: 'ease-out' })));
    wrappers.forEach(wrapper => wrapper.getAnimations().forEach(animation => animation.cancel()));
}

// Frowning faces on the two swapped fruits. Does not block input.
function showFailedExpression(cells) {
    cells.forEach(cell => setCellFrame(cell, '004'));
    setTimeout(() => {
        cells.forEach(cell => {
            if (fruitImage(cell).src.endsWith('_004.png')) setCellFrame(cell, '001');
        });
    }, 500);
}

function canAcceptInput() {
    return gameRunning && !isAnimating && !timeUp;
}

function cellFromEvent(event) {
    const cellElement = event.target.closest('.cell');
    if (!cellElement) return null;
    return { row: Number(cellElement.dataset.row), col: Number(cellElement.dataset.col) };
}

function onGridPointerDown(event) {
    if (!canAcceptInput() || pointerStart) return;
    const cell = cellFromEvent(event);
    if (!cell) return;

    event.preventDefault();
    document.getElementById('grid').setPointerCapture(event.pointerId);
    pointerStart = { pointerId: event.pointerId, cell, x: event.clientX, y: event.clientY };
    playPopSound();
    setCellFrame(cell, '002');
}

function onGridPointerMove(event) {
    if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;

    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    const threshold = cellElements[0][0].getBoundingClientRect().width * SWIPE_THRESHOLD;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;

    const from = pointerStart.cell;
    const to = Math.abs(dx) > Math.abs(dy)
        ? { row: from.row, col: from.col + Math.sign(dx) }
        : { row: from.row + Math.sign(dy), col: from.col };
    pointerStart = null;

    if (to.row < 0 || to.row >= Board.ROWS || to.col < 0 || to.col >= Board.COLS) {
        setCellFrame(from, '001');
        return;
    }
    handleSwap(from, to);
}

function onGridPointerEnd(event) {
    if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
    const cell = pointerStart.cell;
    pointerStart = null;
    setCellFrame(cell, '001');
}

function setupGridInput() {
    const gridElement = document.getElementById('grid');
    gridElement.addEventListener('pointerdown', onGridPointerDown);
    gridElement.addEventListener('pointermove', onGridPointerMove);
    gridElement.addEventListener('pointerup', onGridPointerEnd);
    gridElement.addEventListener('pointercancel', onGridPointerEnd);
}

// a: the cell the player dragged, b: the neighbor it was pushed into.
async function handleSwap(a, b) {
    if (!canAcceptInput()) return;
    isAnimating = true;
    const session = gameSession;
    const movedFruit = board[a.row][a.col];
    const displacedFruit = board[b.row][b.col];
    const result = Board.resolveMove(board, a, b, Math.random, activeFruits);

    await animateSwap(a, b);
    if (session !== gameSession) return;

    if (!result.valid) {
        await animateSwap(a, b, true);
        if (session !== gameSession) return;
        clearAnimations(a);
        clearAnimations(b);
        playFailSound();
        showFailedExpression([a, b]);
        await finishTurn(session);
        return;
    }

    setCellFruit(a, result.swappedBoard[a.row][a.col]);
    setCellFruit(b, result.swappedBoard[b.row][b.col]);
    clearAnimations(a);
    clearAnimations(b);

    const scored = Scoring.scoreMove(result, { multiplier, comboCount, lastMatchedFruit }, movedFruit, displacedFruit);
    const completed = await playSteps(result.steps, scored.stepScores, session);
    if (!completed) return;

    board = result.finalBoard;
    multiplier = scored.state.multiplier;
    comboCount = scored.state.comboCount;
    lastMatchedFruit = scored.state.lastMatchedFruit;
    maxMultiplier = Math.max(maxMultiplier, multiplier);
    if (scored.isCombo) {
        showComboEffect(`COMBO x${comboCount}! +0.5x`);
    }
    updateDisplay();
    updateComboDisplay();

    await finishTurn(session);
}

// Plays each pop-and-fall step in order. Returns false if the game was left midway.
async function playSteps(steps, stepScores, session) {
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        playSuccessSound(step.chain);
        await animatePop(step.cleared);
        if (session !== gameSession) return false;

        score += stepScores[i];
        updateScoreDisplay();
        if (step.kind === 'match' && step.chain >= 2) {
            showComboEffect(`CHAIN x${step.chain}!`);
        }

        await animateFalls(step);
        if (session !== gameSession) return false;
    }
    return true;
}

async function finishTurn(session) {
    if (!Board.hasPossibleMove(board)) {
        showComboEffect('Shuffle!');
        await animateShuffle(Board.shuffle(board, Math.random));
        if (session !== gameSession) return;
    }
    isAnimating = false;
    if (timeUp) {
        endGame();
    }
}
```

- [ ] **Step 3: 콤보 문구가 연속으로 떠도 다시 재생되게 수정**

```js
function showComboEffect(text) {
    const comboElement = document.getElementById('comboText');
    comboElement.textContent = text;
    comboElement.classList.add('combo-show');
    
    setTimeout(() => {
        comboElement.classList.remove('combo-show');
    }, 1500);
}
```

를 아래로 바꾼다:

```js
function showComboEffect(text) {
    const comboElement = document.getElementById('comboText');
    comboElement.textContent = text;
    comboElement.classList.remove('combo-show');
    void comboElement.offsetWidth; // restart the CSS animation
    comboElement.classList.add('combo-show');
    
    clearTimeout(comboTextTimer);
    comboTextTimer = setTimeout(() => {
        comboElement.classList.remove('combo-show');
    }, 1500);
}
```

- [ ] **Step 4: 입력 연결**

파일 맨 끝의:

```js
buildGrid();
newBoard();
```

를 아래로 바꾼다:

```js
buildGrid();
setupGridInput();
newBoard();
```

- [ ] **Step 5: 문법과 단위 테스트 확인**

Run: `node --check js_file.js && echo syntax-ok && node --test tests/*.test.js`
Expected: `syntax-ok`, `ℹ pass 28`, `ℹ fail 0`

- [ ] **Step 6: 브라우저에서 직접 밀어 확인**

서버를 띄우고 모바일 크기에서 Start Game을 누른 뒤 확인한다.
1. 과일을 누르면 뾱 소리와 함께 표정이 바뀐다. 누른 채 옆으로 밀면 두 과일이 자리를 바꾼다.
2. 3개 이상이 줄지어지면 과일이 커졌다 사라지고, 위 과일이 떨어지며 새 과일이 판 위에서 내려온다. 판 테두리 밖으로 과일이 보이지 않는다.
3. 점수와 배수(x1.1 등)가 오른다. 같은 과일을 연속으로 맞추면 `COMBO x2! +0.5x`가 뜬다.
4. 매칭이 안 되는 방향으로 밀면 두 과일이 되돌아오고, 두 과일만 잠깐 찡그린다. 점수·배수는 그대로다.
5. 판 가장자리에서 판 밖으로 밀면 아무 일도 없다.
6. 애니메이션 중에 다른 과일을 밀어도 무시된다.

- [ ] **Step 7: 콘솔로 연쇄·섞기·화면 일치 확인**

게임 화면에서 콘솔에 순서대로 붙여 넣는다. 첫 줄 실행 전에 게임이 끝나지 않도록 `timeLeft`를 늘린다.

```js
timeLeft = 9999;
window.domOk = () => { for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) { const img = fruitImage({ row: r, col: c }); if (img.dataset.fruit !== board[r][c] || !img.src.endsWith('_001.png') || fruitWrapper({ row: r, col: c }).getAnimations().length) return `bad ${r},${c}`; } return Board.findMatches(board).length === 0 ? 'ok' : 'matches left'; };
window.seeded = seed => { let st = seed >>> 0; return () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
```

**연쇄 확인:** 2단계 이상 연쇄가 나는 판과 수를 찾아 실행한다. `CHAIN x2!` 이상의 문구가 떠야 한다.

```js
let found = null;
outer: for (let s = 1; s < 500; s++) { const b = Board.createBoard(seeded(s), activeFruits); for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) { const a = { row: r, col: c }, bb = { row: r + dr, col: c + dc }; if (bb.row >= 8 || bb.col >= 7) continue; const res = Board.resolveMove(b, a, bb, seeded(9999), activeFruits); if (res.valid && res.steps.length >= 2) { found = { a, b: bb, board: b }; break outer; } } }
board = found.board; renderBoard(); const realRandom = Math.random; Math.random = seeded(9999); handleSwap(found.a, found.b); Math.random = realRandom;
```

몇 초 뒤:

```js
({ score, isAnimating, dom: domOk(), text: document.getElementById('comboText').textContent })
```

Expected: `score > 0`, `isAnimating: false`, `dom: 'ok'`, `text`가 `CHAIN x2!` 이상 (마지막 연쇄 단계 번호)

**헛밀기 확인:**

```js
(async () => { const before = JSON.stringify({ score, multiplier, comboCount, lastMatchedFruit, board }); let inv = null; for (let r = 0; r < 8 && !inv; r++) for (let c = 0; c < 6 && !inv; c++) { if (board[r][c] !== board[r][c + 1] && !Board.resolveMove(board, { row: r, col: c }, { row: r, col: c + 1 }, Math.random, activeFruits).valid) inv = { row: r, col: c }; } handleSwap(inv, { row: inv.row, col: inv.col + 1 }); await wait(1000); console.log({ unchanged: before === JSON.stringify({ score, multiplier, comboCount, lastMatchedFruit, board }), isAnimating, dom: domOk() }); })();
```

Expected: `{ unchanged: true, isAnimating: false, dom: 'ok' }`

**섞기 확인:** 둘 수 있는 수가 없는 판을 만들고 마무리 처리를 실행한다. `Shuffle!` 문구와 함께 판이 섞여야 한다.

```js
(async () => { const f = activeFruits; board = Array.from({ length: 8 }, (_, r) => Array.from({ length: 7 }, (_, c) => f[(r + 2 * c) % 4])); renderBoard(); console.log('before', Board.hasPossibleMove(board)); isAnimating = true; await finishTurn(gameSession); console.log({ after: Board.hasPossibleMove(board), isAnimating, dom: domOk() }); })();
```

Expected: `before false`, 이어서 `{ after: true, isAnimating: false, dom: 'ok' }`

- [ ] **Step 8: 커밋**

```bash
git add js_file.js
git commit -m "feat: add swipe input with swap, pop, fall, and chain animations

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: 시간 종료·홈 버튼 처리와 문구 정리

**Files:**
- Modify: `js_file.js` (`startTimer`, `endGame`, `restartGame`)
- Modify: `index.html:7`, `index.html:114`, `index.html:119-121`
- Modify: `manifest.json:4`

**Interfaces:**
- Consumes: Task 5~6의 `isAnimating`, `timeUp`, `gameSession`, `pointerStart`, `finishTurn`, `GAME_DURATION`, `LEADERBOARD_MIN_SCORE`
- Produces: 없음 (마지막 태스크)

- [ ] **Step 1: 타이머 수정**

`startTimer` 안의:

```js
        const percentage = (timeLeft / 30) * 100;
```

를 아래로 바꾼다:

```js
        const percentage = (timeLeft / GAME_DURATION) * 100;
```

같은 함수 안의:

```js
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
```

를 아래로 바꾼다:

```js
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (isAnimating) {
                // Let the running move and its chain finish, then finishTurn() ends the game
                timeUp = true;
            } else {
                endGame();
            }
        }
    }, 1000);
```

- [ ] **Step 2: 랭킹 기준 상수 사용**

`endGame` 안의:

```js
    const meetsMinimumThreshold = score >= 5000; // Minimum score threshold for leaderboard
```

를 아래로 바꾼다:

```js
    const meetsMinimumThreshold = score >= LEADERBOARD_MIN_SCORE;
```

- [ ] **Step 3: 홈 버튼으로 나갈 때 진행 중인 수 중단**

`restartGame` 안의:

```js
    // Stop current game session
    gameRunning = false;
    clearInterval(timerInterval);
```

를 아래로 바꾼다:

```js
    // Stop current game session; any running move animation sees the new session and stops
    gameRunning = false;
    gameSession++;
    isAnimating = false;
    timeUp = false;
    pointerStart = null;
    clearInterval(timerInterval);
```

- [ ] **Step 4: 설명 문구 수정**

`index.html` 7줄:

```html
    <meta name="description" content="Touch 3 same fruits to remove them - Puzzle game">
```

→

```html
    <meta name="description" content="Swipe fruits to line up 3 or more - Puzzle game">
```

`index.html` 114줄:

```html
                    <div class="rule-text">Touch 3 same fruits to remove them!</div>
```

→

```html
                    <div class="rule-text">Swipe a fruit up, down, left, or right to swap it with its neighbor. Line up 3 or more of the same fruit to pop them!</div>
```

`index.html` 120줄:

```html
                        Match the same fruits consecutively to boost your score faster!
```

→

```html
                        Bigger matches score more, and falling fruits can set off chain reactions for bonus points. Match the same fruit back-to-back to boost your multiplier faster!
```

`manifest.json` 4줄:

```json
  "description": "Touch 3 same fruits to remove them - Puzzle game",
```

→

```json
  "description": "Swipe fruits to line up 3 or more - Puzzle game",
```

- [ ] **Step 5: 문법과 단위 테스트 확인**

Run: `node --check js_file.js && echo syntax-ok && node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest-ok')" && node --test tests/*.test.js`
Expected: `syntax-ok`, `manifest-ok`, `ℹ pass 28`, `ℹ fail 0`

- [ ] **Step 6: 콘솔로 홈 버튼·시간 종료 확인**

아래 확인은 애니메이션을 느리게 만들어 "수 처리 도중" 상황을 재현한다. 게임 화면(Start Game 이후)에서 실행한다.

**홈 버튼 도중 누르기:** 이전 수가 새 게임의 점수나 판을 건드리지 않아야 한다.

```js
(async () => { initAudio(); timeLeft = 9999; const fast = animate; window.animate = () => wait(400); const m = Board.findBestMove(board); handleSwap(m.a, m.b); await wait(500); const mid = isAnimating; restartGame(); document.getElementById('startScreen').style.display = 'none'; actuallyStartGame(); timeLeft = 9999; await wait(4000); window.animate = fast; console.log({ mid, score, isAnimating, gameRunning, sameCells: board.every((row, r) => row.every((fruit, c) => fruitImage({ row: r, col: c }).dataset.fruit === fruit)) }); })();
```

Expected: `{ mid: true, score: 0, isAnimating: false, gameRunning: true, sameCells: true }`

**수 처리 도중 시간 종료:** 연쇄가 끝난 뒤 게임이 끝나고, 그 수의 점수가 최종 점수에 포함되어야 한다.

```js
(async () => { const fast = animate; window.animate = () => wait(400); const m = Board.findBestMove(board); handleSwap(m.a, m.b); timeLeft = 1; await wait(1100); const mid = { timeUp, gameRunning }; while (isAnimating) await wait(200); window.animate = fast; console.log({ mid, gameRunning, score, finalScore: document.getElementById('finalScore').textContent, overlay: document.getElementById('gameOver').style.display }); })();
```

Expected: `mid`는 `{ timeUp: true, gameRunning: true }`, 이후 `gameRunning: false`, `score > 0`, `finalScore`가 `score`와 같음, `overlay: 'flex'`

- [ ] **Step 7: 전체 플레이 확인 (스펙 7.2절 1단계)**

강력 새로고침 후 콘솔 조작 없이 한 판을 끝까지 플레이한다.
1. How to Play에 새 설명이 보인다.
2. 밀어서 매칭, 헛밀기 되돌림, 연쇄 `CHAIN` 표시가 모두 동작한다.
3. 게임 도중 🏠 → Start Game으로 새 게임을 시작하면 점수 0, 배수 x1.0, 판이 정상이다.
4. 30초가 지나면 Game Over가 뜨고, 시작 화면의 Last Score/Best Score가 갱신된다. 새로고침 후에도 Best Score가 남아 있다.
5. 마지막 5초 사이렌, 배수 1.5 이상 배경 효과가 전처럼 보인다.
6. 콘솔에 JavaScript 오류가 없다 (서비스 워커 404는 무시).

- [ ] **Step 8: 커밋**

```bash
git add js_file.js index.html manifest.json
git commit -m "feat: finish moves before time-up, guard restarts, update how-to-play copy

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
