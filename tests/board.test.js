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

// The UI's animateFalls only rewrites destination cells, so every step returned by
// resolveMove must obey this contract: starting from the board before the step
// (swappedBoard for step 0, the previous step's board afterwards), clearing every
// `cleared` cell to null and then applying `falls` and `spawns` (read source values
// from the pre-step board, write them into a result grid) must reproduce `step.board`
// exactly, with every other cell unchanged.
function replayStep(preBoard, step) {
    const result = preBoard.map(row => row.slice());
    const clearedKeys = new Set();

    step.cleared.forEach(cell => {
        const key = `${cell.row},${cell.col}`;
        assert.equal(clearedKeys.has(key), false, `cell ${key} cleared twice in one step`);
        clearedKeys.add(key);
        result[cell.row][cell.col] = null;
    });

    const filledKeys = new Set();
    step.falls.forEach(fall => {
        result[fall.to.row][fall.to.col] = preBoard[fall.from.row][fall.from.col];
        filledKeys.add(`${fall.to.row},${fall.to.col}`);
    });
    step.spawns.forEach(spawn => {
        result[spawn.to.row][spawn.to.col] = spawn.fruit;
        filledKeys.add(`${spawn.to.row},${spawn.to.col}`);
    });

    clearedKeys.forEach(key => {
        assert.ok(filledKeys.has(key), `cleared cell ${key} was never refilled by a fall or spawn`);
    });

    return result;
}

test('resolveMove steps replay correctly for many random games (property test)', () => {
    const fruits = ['a', 'b', 'c', 'd', 'e', 'f'];
    const seedCount = 40;
    const maxMoves = 20;

    for (let seed = 1; seed <= seedCount; seed++) {
        const rng = seededRng(seed);
        let board = Board.createBoard(rng, fruits);

        for (let moveIndex = 0; moveIndex < maxMoves; moveIndex++) {
            const move = Board.findBestMove(board);
            if (!move) {
                board = Board.shuffle(board, rng);
                continue;
            }

            const result = Board.resolveMove(board, move.a, move.b, rng, fruits);
            assert.equal(result.valid, true, `seed ${seed} move ${moveIndex}: expected a valid move`);
            assert.ok(result.steps.length > 0, `seed ${seed} move ${moveIndex}: expected at least one step`);

            let preBoard = result.swappedBoard;
            result.steps.forEach((step, index) => {
                assert.equal(step.kind, 'match');
                assert.equal(step.chain, index + 1);
                const replayed = replayStep(preBoard, step);
                assert.deepEqual(replayed, step.board, `seed ${seed} move ${moveIndex} step ${index}: replay mismatch`);
                preBoard = step.board;
            });

            assert.deepEqual(result.finalBoard, result.steps[result.steps.length - 1].board);
            assert.deepEqual(Board.findMatches(result.finalBoard), []);

            board = result.finalBoard;
        }
    }
});
