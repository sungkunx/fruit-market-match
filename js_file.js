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

// Initialize audio context
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

// Create background music (simple melody)
function createBackgroundMusic() {
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00]; // C, D, E, F, G, A
    let noteIndex = 0;
    let isPlaying = true;

    function playNote() {
        if (!isPlaying || !gameRunning) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(notes[noteIndex], audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.8);
        
        noteIndex = (noteIndex + 1) % notes.length;
        
        setTimeout(playNote, 1000);
    }

    return {
        start: () => { isPlaying = true; playNote(); },
        stop: () => { isPlaying = false; }
    };
}

// Create musical note sound for 3-cell selection
function playNoteSound() {
    if (!audioContext) return;

    // Musical scale: C, D, E, F, G, A, B, C (octave)
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(notes[noteIndex], audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Move to next note, cycle back to 0 after reaching the end
    noteIndex = (noteIndex + 1) % notes.length;
}

// 효과음 생성 (뾱 소리)
function playPopSound() {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 뾱 소리를 위한 주파수 변화
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
    
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

// 성공 효과음
function playSuccessSound() {
    if (!audioContext) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.1);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + index * 0.1);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + index * 0.1 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.1 + 0.3);
        
        oscillator.start(audioContext.currentTime + index * 0.1);
        oscillator.stop(audioContext.currentTime + index * 0.1 + 0.3);
    });
}

// 실패 효과음
function playFailSound() {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(100, audioContext.currentTime + 0.5);
    
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

function initializeGrid() {
    const gridElement = document.getElementById('grid');
    gridElement.innerHTML = '';
    grid = [];
    
    // Create grid with fruits only
    const gridItems = [];
    
    // Add 50 regular fruits
    for (let i = 0; i < 50; i++) {
        const fruit = fruits[Math.floor(Math.random() * fruits.length)];
        gridItems.push(fruit);
    }
    
    // Create cells
    for (let i = 0; i < 50; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = i;
        
        const item = gridItems[i];
        const img = document.createElement('img');
        img.src = `img/fruit_${item}_001.png`;
        img.className = 'fruit-image';
        img.dataset.fruit = item;
        cell.appendChild(img);
        cell.onclick = () => selectCell(i);
        
        gridElement.appendChild(cell);
        grid.push(item);
    }
}

function selectCell(index) {
    if (!gameRunning) return;
    
    // 터치 효과음 재생
    playPopSound();
    
    const cell = document.querySelector(`[data-index="${index}"]`);
    const img = cell.querySelector('.fruit-image');
    const fruit = grid[index];
    
    if (selectedCells.includes(index)) {
        // 이미 선택된 셀 클릭 시 선택 해제
        selectedCells = selectedCells.filter(i => i !== index);
        cell.classList.remove('selected');
        // 기본 프레임으로 되돌리기
        img.src = `img/fruit_${fruit}_001.png`;
    } else if (selectedCells.length < 3) {
        // 새로운 셀 선택
        selectedCells.push(index);
        cell.classList.add('selected');
        // 선택 프레임으로 변경
        img.src = `img/fruit_${fruit}_002.png`;
        
        if (selectedCells.length === 3) {
            playNoteSound();
            checkMatch();
        }
    }
}

function isValidMatch(selectedFruits) {
    // Check if all fruits are the same
    return selectedFruits.every(fruit => fruit === selectedFruits[0]);
}

function checkMatch() {
    const selectedFruits = selectedCells.map(index => grid[index]);
    
    // Check if it's a valid match (considering jokers)
    const isMatch = isValidMatch(selectedFruits);
    
    if (isMatch) {
        // Success sound effect
        playSuccessSound();
        
        // Get the matched fruit
        const matchedFruit = selectedFruits[0];
        
        // 성공: 점수 추가 및 배수 증가
        const baseScore = 100;
        const earnedScore = Math.floor(baseScore * multiplier);
        score += earnedScore;
        
        // Check consecutive same fruit matching
        if (lastMatchedFruit === matchedFruit) {
            // Same fruit combo: +0.5x multiplier and increase combo count
            comboCount++;
            multiplier += 0.5;
            showComboEffect(`COMBO x${comboCount}! +0.5x`);
            updateComboDisplay();
        } else {
            // Different fruit match: +0.1x multiplier and reset combo
            comboCount = 1;
            multiplier += 0.1;
            updateComboDisplay();
        }
        
        // Track maximum multiplier
        if (multiplier > maxMultiplier) {
            maxMultiplier = multiplier;
        }
        
        lastMatchedFruit = matchedFruit;
        updateDisplay();
        removeCells();
    } else {
        // 실패 효과음
        playFailSound();
        
        // Failed: Reset all cells, multiplier, and combo
        multiplier = 1.0;
        lastMatchedFruit = null;
        comboCount = 0;
        updateDisplay();
        updateComboDisplay();
        resetAllCells();
        // 그리드 리프레시 후 실패 표정 표시
        setTimeout(() => {
            showFailedExpression();
        }, 350);
    }
    
    // Reset selection
    selectedCells.forEach(index => {
        const cell = document.querySelector(`[data-index="${index}"]`);
        cell.classList.remove('selected');
        if (!isMatch) {
            // 실패한 경우가 아니라면 기본 프레임으로 되돌리기
            const img = cell.querySelector('.fruit-image');
            const fruit = grid[index];
            img.src = `img/fruit_${fruit}_001.png`;
        }
    });
    selectedCells = [];
}

function removeCells() {
    selectedCells.forEach(index => {
        const cell = document.querySelector(`[data-index="${index}"]`);
        const img = cell.querySelector('.fruit-image');
        const fruit = grid[index];
        
        // 매칭 성공 프레임으로 변경
        img.src = `img/fruit_${fruit}_003.png`;
        cell.classList.add('removing');
        
        setTimeout(() => {
            const newItem = getRandomItem();
            grid[index] = newItem;
            img.src = `img/fruit_${newItem}_001.png`;
            img.dataset.fruit = newItem;
            cell.classList.remove('removing');
        }, 800);
    });
}

function getRandomItem() {
    // Return a random fruit
    return fruits[Math.floor(Math.random() * fruits.length)];
}

function resetAllCells() {
    const gridElement = document.getElementById('grid');
    gridElement.style.animation = 'none';
    gridElement.offsetHeight; // 리플로우 강제 실행
    gridElement.style.animation = 'removeAnimation 0.3s ease-out';
    
    setTimeout(() => {
        // Reset grid with fruits only
        const gridItems = [];
        
        // Add 50 regular fruits
        for (let i = 0; i < 50; i++) {
            const fruit = fruits[Math.floor(Math.random() * fruits.length)];
            gridItems.push(fruit);
        }
        
        // Update grid
        for (let i = 0; i < 50; i++) {
            grid[i] = gridItems[i];
            const cell = document.querySelector(`[data-index="${i}"]`);
            const img = cell.querySelector('.fruit-image');
            img.src = `img/fruit_${gridItems[i]}_001.png`;
            img.dataset.fruit = gridItems[i];
        }
        
        gridElement.style.animation = '';
    }, 300);
}

function updateDisplay() {
    document.getElementById('score').textContent = score;
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
    } else if (multiplier >= 2.0) {
        body.classList.add('combo-bg-2');
        grid.classList.add('combo-glow-2');
    } else if (multiplier >= 1.5) {
        body.classList.add('combo-bg-1');
        grid.classList.add('combo-glow-1');
    }
}

function showComboEffect(text) {
    const comboElement = document.getElementById('comboText');
    comboElement.textContent = text;
    comboElement.classList.add('combo-show');
    
    setTimeout(() => {
        comboElement.classList.remove('combo-show');
    }, 1500);
}

function startTimer() {
    const timerBar = document.getElementById('timerBar');
    const sirenWarning = document.getElementById('sirenWarning');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        const percentage = (timeLeft / 30) * 100;
        timerBar.style.width = percentage + '%';
        
        // Siren effect in last 5 seconds
        if (timeLeft <= 5 && timeLeft > 0) {
            sirenWarning.classList.add('siren-active');
        } else {
            sirenWarning.classList.remove('siren-active');
        }
        
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function endGame() {
    gameRunning = false;
    clearInterval(timerInterval);
    document.getElementById('sirenWarning').classList.remove('siren-active');
    document.getElementById('finalScore').textContent = score;
    
    // Check if this is a new personal best score (worth submitting to leaderboard)
    const isNewPersonalBest = score > highestScore;
    const meetsMinimumThreshold = score >= 5000; // Minimum score threshold for leaderboard
    
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
    
    // Stop background music
    if (backgroundMusic) {
        backgroundMusic.stop();
    }
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
    if (!audioContext) {
        initAudio();
    }
    
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
    score = 0;
    multiplier = 1.0;
    maxMultiplier = 1.0; // Reset max multiplier for new game
    timeLeft = 30;
    gameRunning = true;
    selectedCells = [];
    lastMatchedFruit = null;
    comboCount = 0;
    
    initializeGrid();
    updateDisplay();
    updateComboDisplay();
    
    const timerBar = document.getElementById('timerBar');
    timerBar.style.width = '100%';
    
    // Start background music
    backgroundMusic = createBackgroundMusic();
    backgroundMusic.start();
    
    startTimer();
}

function restartGame() {
    // Stop current game session
    gameRunning = false;
    clearInterval(timerInterval);
    
    // Stop background music
    if (backgroundMusic) {
        backgroundMusic.stop();
    }
    
    // Reset game state
    score = 0;
    multiplier = 1.0;
    maxMultiplier = 1.0;
    timeLeft = 30;
    selectedCells = [];
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

function showFailedExpression() {
    // 모든 과일을 실패 표정(4번 프레임)으로 변경
    for (let i = 0; i < 50; i++) {
        const cell = document.querySelector(`[data-index="${i}"]`);
        const img = cell.querySelector('.fruit-image');
        const fruit = grid[i];
        img.src = `img/fruit_${fruit}_004.png`;
    }
    
    // 0.5초 후 기본 프레임으로 되돌리기
    setTimeout(() => {
        for (let i = 0; i < 50; i++) {
            const cell = document.querySelector(`[data-index="${i}"]`);
            const img = cell.querySelector('.fruit-image');
            const fruit = grid[i];
            img.src = `img/fruit_${fruit}_001.png`;
        }
    }, 500);
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
    if (!audioContext) {
        initAudio();
    }
    if (audioContext) {
        playPopSound();
    }
    
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
initializeGrid();
updateDisplay();
updateComboDisplay();
initializeTitleAnimations();