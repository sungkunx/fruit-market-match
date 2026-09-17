const ALL_FRUITS = ['apple', 'orange', 'banana', 'grape', 'strawberry', 'kiwi', 'cherry'];
const FRUITS_PER_GAME = 6;
const GAME_DURATION = 30;
const LEADERBOARD_MIN_SCORE = 5000;
const SWIPE_THRESHOLD = 0.3; // fraction of a cell the finger must travel to count as a swipe
const TIMER_TICK_MS = 100;
const HURRY_TIME = 5; // seconds left when the warning and the faster music start

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
let lastScore = 0;
let maxMultiplier = 1.0;
let highestScore = 0;
let isAnimating = false;
let timeUp = false;
let gameSession = 0;
let pointerStart = null;
let comboTextTimer;

function updateSoundButtons() {
    const label = GameAudio.isMuted() ? '🔇' : '🔊';
    document.querySelectorAll('.sound-btn').forEach(button => {
        button.textContent = label;
        button.setAttribute('aria-pressed', GameAudio.isMuted() ? 'true' : 'false');
    });
}

function toggleSound() {
    GameAudio.init();
    GameAudio.setMuted(!GameAudio.isMuted());
    updateSoundButtons();
}

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

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Runs a Web Animation and resolves when it ends. Cancelled animations resolve too.
function animate(element, keyframes, options) {
    return element.animate(keyframes, { fill: 'forwards', ...options }).finished.catch(() => {});
}

// Distance in layout pixels between neighboring cells (cells are square).
function cellPitch() {
    return (cellElements[0][Board.COLS - 1].offsetLeft - cellElements[0][0].offsetLeft) / (Board.COLS - 1);
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

async function animateShuffle(nextBoard, session) {
    const wrappers = cellElements.flat().map(cell => cell.firstChild);
    await Promise.all(wrappers.map(wrapper => animate(wrapper, [
        { transform: 'scale(1)' },
        { transform: 'scale(0)' }
    ], { duration: 200, easing: 'ease-in' })));
    if (session !== gameSession) return;

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
    if (event.button !== 0) return;
    const cell = cellFromEvent(event);
    if (!cell) return;

    event.preventDefault();
    document.getElementById('grid').setPointerCapture(event.pointerId);
    pointerStart = { pointerId: event.pointerId, cell, x: event.clientX, y: event.clientY };
    GameAudio.playPop();
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
    gridElement.addEventListener('lostpointercapture', onGridPointerEnd);
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
        GameAudio.playFail();
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
        GameAudio.playSuccess(step.chain);
        await animatePop(step.cleared);
        if (session !== gameSession) return false;

        score += stepScores[i];
        updateScoreDisplay();
        const secondsAdded = addTime(Scoring.stepTimeBonus(step));
        if (secondsAdded > 0) {
            showTimeBonus(secondsAdded);
        }
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
        await animateShuffle(Board.shuffle(board, Math.random), session);
        if (session !== gameSession) return;
    }
    isAnimating = false;
    if (timeUp) {
        endGame();
    }
}

function updateScoreDisplay() {
    document.getElementById('score').textContent = score;
}

function updateDisplay() {
    updateScoreDisplay();
    const multiplierElement = document.getElementById('multiplier');
    multiplierElement.textContent = `x${multiplier.toFixed(1)}`;
    
    // Update background and grid effects based on multiplier
    updateComboEffects();
    
    // Fancy effect when multiplier increases
    if (multiplier > 1.0) {
        multiplierElement.classList.add('multiplier-boost');
        setTimeout(() => {
            multiplierElement.classList.remove('multiplier-boost');
        }, 800);
    }
}

function updateComboEffects() {
    const body = document.body;
    const grid = document.getElementById('grid');
    
    // Remove all combo classes
    body.classList.remove('combo-bg-1', 'combo-bg-2', 'combo-bg-3');
    grid.classList.remove('combo-glow-1', 'combo-glow-2', 'combo-glow-3');
    
    // Add combo effects based on multiplier level
    if (multiplier >= 3.0) {
        body.classList.add('combo-bg-3');
        grid.classList.add('combo-glow-3');
        GameAudio.setIntensity(3);
    } else if (multiplier >= 2.0) {
        body.classList.add('combo-bg-2');
        grid.classList.add('combo-glow-2');
        GameAudio.setIntensity(2);
    } else if (multiplier >= 1.5) {
        body.classList.add('combo-bg-1');
        grid.classList.add('combo-glow-1');
        GameAudio.setIntensity(1);
    } else {
        GameAudio.setIntensity(0);
    }
}

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

function round1(value) {
    return Math.round(value * 10) / 10;
}

function updateTimerBar() {
    const ratio = timeLeft / GAME_DURATION;
    const timerBar = document.getElementById('timerBar');
    timerBar.style.width = ratio * 100 + '%';
    timerBar.classList.toggle('time-mid', ratio <= 0.5 && ratio > 0.25);
    timerBar.classList.toggle('time-low', ratio <= 0.25);
}

// The warning follows the clock both ways: time bonuses can push it back above 5s.
function updateHurryState() {
    const hurrying = timeLeft <= HURRY_TIME && timeLeft > 0;
    document.getElementById('sirenWarning').classList.toggle('siren-active', hurrying);
    GameAudio.setHurry(hurrying);
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft = Math.max(0, round1(timeLeft - TIMER_TICK_MS / 1000));
        updateTimerBar();
        updateHurryState();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (isAnimating) {
                // Let the running move and its chain finish, then finishTurn() ends the game
                timeUp = true;
            } else {
                endGame();
            }
        }
    }, TIMER_TICK_MS);
}

// Gives seconds back for a match, never past the starting time.
// Returns how many seconds were actually added.
function addTime(seconds) {
    if (!gameRunning || timeUp || timeLeft <= 0 || seconds <= 0) return 0;

    const next = Math.min(GAME_DURATION, round1(timeLeft + seconds));
    const added = round1(next - timeLeft);
    timeLeft = next;
    updateTimerBar();
    updateHurryState();
    return added;
}

function showTimeBonus(seconds) {
    const timerContainer = document.querySelector('.timer-container');
    const label = document.createElement('div');
    label.className = 'time-bonus';
    label.textContent = `+${seconds}s`;
    label.style.top = timerContainer.offsetTop + 'px';
    document.querySelector('.game-container').appendChild(label);
    setTimeout(() => label.remove(), 800);

    const timerBar = document.getElementById('timerBar');
    timerBar.classList.remove('timer-flash');
    void timerBar.offsetWidth; // restart the flash animation
    timerBar.classList.add('timer-flash');
}

function endGame() {
    gameRunning = false;
    clearInterval(timerInterval);
    document.getElementById('sirenWarning').classList.remove('siren-active');
    document.getElementById('finalScore').textContent = score;
    
    // Check if this is a new personal best score (worth submitting to leaderboard)
    const isNewPersonalBest = score > highestScore;
    const meetsMinimumThreshold = score >= LEADERBOARD_MIN_SCORE;
    
    // Show ranking submission only if it's both a new personal best AND meets minimum threshold
    if (isNewPersonalBest && meetsMinimumThreshold) {
        document.getElementById('scoreSubmit').style.display = 'block';
        document.getElementById('playAgainBtn').style.display = 'none';
    } else {
        document.getElementById('scoreSubmit').style.display = 'none';
        document.getElementById('playAgainBtn').style.display = 'block';
    }
    
    document.getElementById('gameOver').style.display = 'flex';
    
    // Update last score and save data
    lastScore = score;
    if (score > highestScore) {
        highestScore = score;
    }
    saveGameData();
    updateStartScreenStats();
    
    GameAudio.stopMusic();
}

// Submit score to Firebase
async function submitScore() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    
    if (!playerName) {
        alert('Please enter your name!');
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('.submit-score-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="btn-icon">⏳</span>Submitting...';
    submitBtn.disabled = true;
    
    try {
        const success = await submitScoreToFirebase(playerName, score);
        
        if (success) {
            alert('Successfully added to leaderboard! 🎉');
        } else {
            alert('Failed to submit score. Please try again.');
        }
    } catch (error) {
        alert('An error occurred while submitting your score.');
        console.error('Submit score error:', error);
    }
    
    // Reset button state
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    
    // Hide submit form and show play again button
    hideSubmitForm();
}

// Skip score submission
function skipSubmit() {
    hideSubmitForm();
}

// Hide submit form and show play again button
function hideSubmitForm() {
    document.getElementById('scoreSubmit').style.display = 'none';
    document.getElementById('playAgainBtn').style.display = 'block';
}

function startGame() {
    // Initialize audio (after user gesture)
    GameAudio.init();
    
    // Hide start screen
    document.getElementById('startScreen').style.display = 'none';
    
    // Show countdown
    showCountdown();
}

function showCountdown() {
    const countdownOverlay = document.getElementById('countdownOverlay');
    const countdownText = document.getElementById('countdownText');
    
    // Show countdown overlay
    countdownOverlay.classList.add('show');
    
    // Start with "Ready"
    countdownText.textContent = 'Ready';
    countdownText.className = 'countdown-text ready';
    countdownText.style.animation = 'countdownPulse 1s ease-out';
    
    setTimeout(() => {
        // Change to "START!"
        countdownText.textContent = 'START!';
        countdownText.className = 'countdown-text start';
        countdownText.style.animation = 'countdownPulse 1s ease-out';
        
        setTimeout(() => {
            // Hide countdown and start game
            countdownOverlay.classList.remove('show');
            actuallyStartGame();
        }, 1000);
    }, 1000);
}

function actuallyStartGame() {
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
    updateDisplay();
    updateComboDisplay();
    GameAudio.setIntensity(0);
    GameAudio.setHurry(false);
    
    updateTimerBar();
    updateHurryState();

    GameAudio.startMusic();
    startTimer();
}

function restartGame() {
    // Stop current game session; any running move animation sees the new session and stops
    gameRunning = false;
    gameSession++;
    isAnimating = false;
    timeUp = false;
    pointerStart = null;
    clearInterval(timerInterval);
    
    GameAudio.stopMusic();
    
    // Reset game state
    score = 0;
    multiplier = 1.0;
    maxMultiplier = 1.0;
    timeLeft = GAME_DURATION;
    lastMatchedFruit = null;
    comboCount = 0;
    
    // Reset combo effects
    const body = document.body;
    const grid = document.getElementById('grid');
    body.classList.remove('combo-bg-1', 'combo-bg-2', 'combo-bg-3');
    grid.classList.remove('combo-glow-1', 'combo-glow-2', 'combo-glow-3');
    
    // Hide game over screen and show start screen
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
    
    // Reset siren warning
    document.getElementById('sirenWarning').classList.remove('siren-active');
}

// Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('ServiceWorker registration successful');
      })
      .catch(function(err) {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

// Save and load game data
function saveGameData() {
    const gameData = {
        lastScore: lastScore,
        highestScore: highestScore
    };
    localStorage.setItem('fruitMarketData', JSON.stringify(gameData));
}

function loadGameData() {
    const savedData = localStorage.getItem('fruitMarketData');
    if (savedData) {
        const gameData = JSON.parse(savedData);
        lastScore = gameData.lastScore || 0;
        highestScore = gameData.highestScore || 0;
    }
    updateStartScreenStats();
}

function updateStartScreenStats() {
    document.getElementById('lastScore').textContent = lastScore;
    document.getElementById('highestScore').textContent = highestScore;
}

function updateComboDisplay() {
    const comboElement = document.getElementById('comboCounter');
    comboElement.textContent = comboCount;
    
    // Add glow effect when combo is active
    if (comboCount > 1) {
        comboElement.classList.add('combo-active');
        setTimeout(() => {
            comboElement.classList.remove('combo-active');
        }, 800);
    } else {
        comboElement.classList.remove('combo-active');
    }
}

// Initialize title fruit animations
function initializeTitleAnimations() {
    // 장식 과일 애니메이션 시작
    startDecorationAnimations();
}

// Start decoration fruit animations
function startDecorationAnimations() {
    const decorationFruits = document.querySelectorAll('.decoration-fruit');
    
    decorationFruits.forEach((fruit, index) => {
        // 각 과일마다 다른 간격으로 표정 변경 (2-5초 사이)
        const interval = 2000 + (index * 500) + Math.random() * 1000;
        
        setInterval(() => {
            changeDecorationExpression(fruit);
        }, interval);
    });
}

// Change decoration fruit expression randomly
function changeDecorationExpression(fruitElement) {
    const fruitType = fruitElement.dataset.fruit;
    
    // 랜덤하게 표정 선택 (1-4번 프레임 중)
    const expressions = ['001', '002', '003', '004'];
    const randomExpression = expressions[Math.floor(Math.random() * expressions.length)];
    
    // 표정 변경
    fruitElement.src = `img/fruit_${fruitType}_${randomExpression}.png`;
    
    // 약간의 스케일 효과 추가
    fruitElement.style.transform = 'scale(1.1)';
    
    // 1초 후 원래 크기로 복원하고 기본 표정으로 돌아가기
    setTimeout(() => {
        fruitElement.style.transform = 'scale(1)';
        // 50% 확률로 기본 표정으로 돌아가기
        if (Math.random() < 0.5) {
            fruitElement.src = `img/fruit_${fruitType}_001.png`;
        }
    }, 1000);
}

// Handle decoration fruit click
function onDecorationFruitClick(fruitElement) {
    const fruitType = fruitElement.dataset.fruit;
    
    // 현재 표정 확인
    const currentSrc = fruitElement.src;
    const currentFrame = currentSrc.substring(currentSrc.lastIndexOf('_') + 1, currentSrc.lastIndexOf('.'));
    
    // 현재 표정과 다른 표정들 중에서 랜덤 선택
    const allExpressions = ['001', '002', '003', '004'];
    const otherExpressions = allExpressions.filter(exp => exp !== currentFrame);
    const randomExpression = otherExpressions[Math.floor(Math.random() * otherExpressions.length)];
    
    // 클릭 효과음 재생 (항상 재생)
    GameAudio.init();
    GameAudio.playPop();
    
    // 표정 변경
    fruitElement.src = `img/fruit_${fruitType}_${randomExpression}.png`;
    
    // 클릭 애니메이션 효과
    fruitElement.style.transform = 'scale(1.2)';
    
    setTimeout(() => {
        fruitElement.style.transform = 'scale(1)';
    }, 200);
}

// Popup Functions
function showTutorial() {
    const popup = document.getElementById('tutorialPopup');
    popup.classList.add('show');
    // Prevent body scroll when popup is open
    document.body.style.overflow = 'hidden';
}

function closeTutorial() {
    const popup = document.getElementById('tutorialPopup');
    popup.classList.remove('show');
    document.body.style.overflow = '';
}

function showRanking() {
    const popup = document.getElementById('rankingPopup');
    popup.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Update header with current month
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();
    
    const header = popup.querySelector('.popup-header h2');
    header.textContent = `🏆 Global Ranking - ${currentMonth} ${currentYear}`;
    
    // Generate and display ranking
    generateRanking();
}

function closeRanking() {
    const popup = document.getElementById('rankingPopup');
    popup.classList.remove('show');
    document.body.style.overflow = '';
}

// Get current month collection name (for monthly reset)
function getCurrentMonthCollection() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 01-12
    return `rankings_${year}_${month}`; // e.g., "rankings_2024_01"
}

// Firebase ranking functions
async function submitScoreToFirebase(playerName, score) {
    if (!window.firebaseDB || !window.firebaseUtils) {
        console.log('Firebase not initialized, using local ranking');
        return false;
    }
    
    try {
        const { collection, addDoc, serverTimestamp } = window.firebaseUtils;
        
        // Use monthly collection for automatic reset
        const monthlyCollection = getCurrentMonthCollection();
        
        await addDoc(collection(window.firebaseDB, monthlyCollection), {
            name: playerName,
            score: score,
            timestamp: serverTimestamp()
        });
        
        console.log(`Score submitted to Firebase successfully (${monthlyCollection})`);
        return true;
    } catch (error) {
        console.error('Error submitting score to Firebase:', error);
        return false;
    }
}

async function loadRankingsFromFirebase() {
    if (!window.firebaseDB || !window.firebaseUtils) {
        console.log('Firebase not initialized, using fake ranking');
        generateFakeRanking();
        return;
    }
    
    try {
        const { collection, query, orderBy, limit, getDocs } = window.firebaseUtils;
        
        // Use current month's collection for rankings
        const monthlyCollection = getCurrentMonthCollection();
        
        // Query top 10 scores from current month
        const q = query(
            collection(window.firebaseDB, monthlyCollection),
            orderBy('score', 'desc'),
            limit(10)
        );
        
        const querySnapshot = await getDocs(q);
        const rankings = [];
        
        querySnapshot.forEach((doc) => {
            rankings.push(doc.data());
        });
        
        if (rankings.length === 0) {
            console.log(`No rankings found for ${monthlyCollection}, using fake data`);
            generateFakeRanking();
            return;
        }
        
        displayRankings(rankings);
        updateUserRank(rankings);
        
        console.log(`Rankings loaded from ${monthlyCollection}`);
        
    } catch (error) {
        console.error('Error loading rankings from Firebase:', error);
        generateFakeRanking();
    }
}

function displayRankings(rankings) {
    const rankingList = document.getElementById('rankingList');
    rankingList.innerHTML = '';
    
    rankings.forEach((player, index) => {
        const rankItem = document.createElement('div');
        rankItem.className = 'rank-item';
        rankItem.innerHTML = `
            <span class="rank-number">${index + 1}</span>
            <span class="rank-name">${player.name}</span>
            <span class="rank-score">${player.score.toLocaleString()}</span>
        `;
        rankingList.appendChild(rankItem);
    });
}

function updateUserRank(rankings) {
    const userScore = highestScore;
    const userRankElement = document.getElementById('yourRankScore');
    userRankElement.textContent = userScore.toLocaleString();
    
    // Calculate user position
    const userPosition = rankings.filter(player => player.score > userScore).length + 1;
    const rankNumberElement = document.querySelector('.your-rank .rank-number');
    
    if (userScore === 0) {
        rankNumberElement.textContent = '-';
    } else if (userPosition <= 10) {
        rankNumberElement.textContent = userPosition;
    } else {
        rankNumberElement.textContent = '10+';
    }
}

// Fallback function for fake ranking (when Firebase is not available)
function generateFakeRanking() {
    const names = [
        'FruitMaster', 'ComboKing', 'SwipeQueen', 'MatchLord', 'PuzzleGuru',
        'TouchWizard', 'ScoreHunter', 'GameChamp', 'FruitNinja', 'MatchMaker',
        'SwipeHero', 'PuzzlePro', 'ComboMaster', 'TouchLegend', 'ScoreBeast',
        'MatchGod', 'FruitExpert', 'SwipeMaster', 'PuzzleKing', 'TouchPro'
    ];
    
    // Generate 10 random scores between 15000-20000
    const rankings = [];
    for (let i = 0; i < 10; i++) {
        const score = Math.floor(Math.random() * 5000) + 15000; // 15000-20000
        const name = names[Math.floor(Math.random() * names.length)];
        rankings.push({ name, score });
    }
    
    // Sort by score (highest first)
    rankings.sort((a, b) => b.score - a.score);
    
    displayRankings(rankings);
    updateUserRank(rankings);
}

// Initialize Firebase with dummy data (call once per month)
async function initializeMonthlyRankings() {
    if (!window.firebaseDB || !window.firebaseUtils) {
        console.log('Firebase not initialized');
        return false;
    }
    
    try {
        const { collection, addDoc, serverTimestamp } = window.firebaseUtils;
        const monthlyCollection = getCurrentMonthCollection();
        
        // Dummy ranking data with funny names
        const dummyData = [
            { name: "God", score: 20000 },           // 신
            { name: "Deity", score: 15000 },         // 신들중에 가장 아래
            { name: "Demigod", score: 12000 },       // 신의 바로 밑 인간
            { name: "Bookworm", score: 9000 },       // 책을 읽을 줄 아는 인간
            { name: "Awakened", score: 7000 },       // 정신차린 인간
            { name: "Noob", score: 5000 },           // 폐급 인간
            { name: "Human", score: 3500 },          // 드디어 인간
            { name: "Fruitarian", score: 2000 },     // 과일을 좋아하는 유인원
            { name: "Thinker", score: 1000 },        // 생각을 하는 유인원
            { name: "Ape", score: 500 }              // 유인원
        ];
        
        console.log(`Initializing rankings for ${monthlyCollection}...`);
        
        // Add each dummy entry to Firebase
        for (const entry of dummyData) {
            await addDoc(collection(window.firebaseDB, monthlyCollection), {
                name: entry.name,
                score: entry.score,
                timestamp: serverTimestamp()
            });
        }
        
        console.log(`Successfully initialized ${dummyData.length} entries for ${monthlyCollection}`);
        return true;
        
    } catch (error) {
        console.error('Error initializing monthly rankings:', error);
        return false;
    }
}

// Updated generateRanking function to use Firebase
function generateRanking() {
    loadRankingsFromFirebase();
}

// Reset current month's rankings (delete all entries)
async function resetCurrentMonthRankings() {
    if (!window.firebaseDB || !window.firebaseUtils) {
        console.log('Firebase not initialized');
        return false;
    }
    
    try {
        const { collection, query, getDocs, deleteDoc } = window.firebaseUtils;
        const monthlyCollection = getCurrentMonthCollection();
        
        console.log(`Resetting rankings for ${monthlyCollection}...`);
        
        // Get all documents in current month's collection
        const q = query(collection(window.firebaseDB, monthlyCollection));
        const querySnapshot = await getDocs(q);
        
        let deletedCount = 0;
        
        // Delete each document
        for (const doc of querySnapshot.docs) {
            await deleteDoc(doc.ref);
            deletedCount++;
        }
        
        console.log(`Successfully deleted ${deletedCount} entries from ${monthlyCollection}`);
        return true;
        
    } catch (error) {
        console.error('Error resetting monthly rankings:', error);
        return false;
    }
}

// Convenience function to reset and reinitialize rankings
async function resetAndInitializeRankings() {
    console.log('🔄 Resetting and reinitializing rankings...');
    
    const resetSuccess = await resetCurrentMonthRankings();
    if (resetSuccess) {
        const initSuccess = await initializeMonthlyRankings();
        if (initSuccess) {
            console.log('✅ Rankings reset and reinitialized successfully!');
            return true;
        }
    }
    
    console.log('❌ Failed to reset and reinitialize rankings');
    return false;
}

// Make functions available globally for console access
window.initializeMonthlyRankings = initializeMonthlyRankings;
window.resetCurrentMonthRankings = resetCurrentMonthRankings;
window.resetAndInitializeRankings = resetAndInitializeRankings;

// Close popup when clicking outside
document.addEventListener('click', function(e) {
    const tutorialPopup = document.getElementById('tutorialPopup');
    const rankingPopup = document.getElementById('rankingPopup');
    
    if (e.target === tutorialPopup) {
        closeTutorial();
    }
    if (e.target === rankingPopup) {
        closeRanking();
    }
});

// Close popup with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeTutorial();
        closeRanking();
    }
});

// Initialize
loadGameData();
updateSoundButtons();
buildGrid();
setupGridInput();
newBoard();
updateDisplay();
updateComboDisplay();
initializeTitleAnimations();