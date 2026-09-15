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
