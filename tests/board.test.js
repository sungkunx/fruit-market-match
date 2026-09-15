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
