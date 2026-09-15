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
