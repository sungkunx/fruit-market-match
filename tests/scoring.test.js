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

test('timeBonusForSize gives more seconds for bigger groups', () => {
    assert.equal(Scoring.timeBonusForSize(3), 0.5);
    assert.equal(Scoring.timeBonusForSize(4), 1);
    assert.equal(Scoring.timeBonusForSize(5), 2);
    assert.equal(Scoring.timeBonusForSize(6), 2);
});

test('stepTimeBonus adds up every group in the step', () => {
    assert.equal(Scoring.stepTimeBonus(step(1, [group('apple', 3)])), 0.5);
    assert.equal(Scoring.stepTimeBonus(step(2, [group('apple', 4), group('kiwi', 3)])), 1.5);
    assert.equal(Scoring.stepTimeBonus(step(1, [group('apple', 3), group('kiwi', 3), group('grape', 3)])), 1.5);
});

test('stepTimeBonus gives nothing for an item step', () => {
    assert.equal(Scoring.stepTimeBonus({ kind: 'item', chain: 0, groups: [] }), 0);
});
