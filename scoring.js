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

    // Seconds added to the clock for a popped group.
    function timeBonusForSize(size) {
        if (size >= 5) return 2;
        if (size === 4) return 1;
        return 0.5;
    }

    // Seconds a single cascade step gives back. Item steps (phase 2) give none.
    function stepTimeBonus(step) {
        if (step.kind !== 'match') return 0;
        const total = step.groups.reduce((sum, group) => sum + timeBonusForSize(group.cells.length), 0);
        return Math.round(total * 10) / 10;
    }

    const Scoring = { createScoreState, baseScore, matchStepScore, scoreMove, timeBonusForSize, stepTimeBonus };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Scoring;
    } else {
        root.Scoring = Scoring;
    }
})(typeof window !== 'undefined' ? window : globalThis);
