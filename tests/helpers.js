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
