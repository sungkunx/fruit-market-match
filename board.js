// Board rules for the swipe match game. No DOM access.
(function (root) {
    'use strict';

    const ROWS = 8;
    const COLS = 7;

    function cloneBoard(board) {
        return board.map(row => row.slice());
    }

    function randomFruit(rng, fruits) {
        return fruits[Math.floor(rng() * fruits.length)];
    }

    function inBounds(board, cell) {
        return cell.row >= 0 && cell.row < board.length && cell.col >= 0 && cell.col < board[0].length;
    }

    function isAdjacent(a, b) {
        return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
    }

    function swapCells(board, a, b) {
        const next = cloneBoard(board);
        next[a.row][a.col] = board[b.row][b.col];
        next[b.row][b.col] = board[a.row][a.col];
        return next;
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

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Board;
    } else {
        root.Board = Board;
    }
})(typeof window !== 'undefined' ? window : globalThis);
