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

function startGame() {
    // Initialize audio (after user gesture)
    if (!audioContext) {
        initAudio();
    }
    
    document.getElementById('startScreen').style.display = 'none';
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
    // 제목의 과일들은 기본 프레임만 사용
    const titleApple = document.querySelector('.title-fruit-left');
    const titleOrange = document.querySelector('.title-fruit-right');
    
    if (titleApple) {
        titleApple.src = 'img/fruit_apple_001.png';
    }
    if (titleOrange) {
        titleOrange.src = 'img/fruit_orange_001.png';
    }
}

// Initialize
loadGameData();
initializeGrid();
updateDisplay();
updateComboDisplay();
initializeTitleAnimations();