// All game sound: the synthesized background track, the effect sounds, and mute.
(function (root) {
    'use strict';

    const STEPS_PER_BAR = 16;
    const LOOP_STEPS = 64;
    const NORMAL_BPM = 125;
    const HURRY_BPM = 145;
    const LOOKAHEAD_MS = 25;
    const SCHEDULE_AHEAD = 0.1; // seconds of music queued in advance
    const MUSIC_VOLUME = 0.35;
    const SFX_VOLUME = 0.8;
    const STORAGE_KEY = 'fruitMarketSound';

    // C, Am, F, G as MIDI notes around middle C.
    const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];

    // One note per sixteenth, null for a rest. Chord tones of the bar plus passing notes.
    const MELODY = [
        72, null, 76, null, 79, null, 76, null, 72, null, null, 74, 76, null, null, null,
        69, null, 72, null, 76, null, 72, null, 69, null, null, 71, 72, null, null, null,
        77, null, 81, null, 84, null, 81, null, 77, null, null, 79, 81, null, null, null,
        79, null, 74, null, 71, null, 74, null, 79, null, 81, null, 83, null, null, null
    ];

    // Which instruments play on a given sixteenth. Pure: no audio, safe to test in Node.
    function musicStep(step, intensity) {
        const index = ((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
        const bar = Math.floor(index / STEPS_PER_BAR);
        const beatStep = index % STEPS_PER_BAR;
        const chord = CHORDS[bar];
        const events = [];

        if (beatStep % 4 === 0) {
            events.push({ instrument: 'kick', midi: null });
        }
        if (beatStep % 2 === 0) {
            events.push({ instrument: 'bass', midi: chord[0] - 24 + (beatStep % 4 === 2 ? 12 : 0) });
        }
        if (MELODY[index] !== null) {
            events.push({ instrument: 'melody', midi: MELODY[index] });
        }
        if (intensity >= 1 && beatStep % 4 === 2) {
            events.push({ instrument: 'hat', midi: null });
        }
        if (intensity >= 2 && (beatStep === 4 || beatStep === 12)) {
            events.push({ instrument: 'clap', midi: null });
        }
        if (intensity >= 3 && beatStep % 2 === 1) {
            events.push({ instrument: 'sparkle', midi: chord[Math.floor(beatStep / 2) % 3] + 24 });
        }

        return events;
    }

    function midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    function readStoredMute() {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'off';
        } catch (error) {
            return false;
        }
    }

    function storeMute(muted) {
        try {
            localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
        } catch (error) {
            // Private mode or blocked storage: keep the choice for this session only.
        }
    }

    let context = null;
    let masterGain = null;
    let musicGain = null;
    let sfxGain = null;
    let noiseBuffer = null;
    let muted = readStoredMute();

    let schedulerId = null;
    let nextStep = 0;
    let nextStepTime = 0;
    let intensity = 0;
    let bpm = NORMAL_BPM;

    function init() {
        if (context) {
            if (!muted && context.state === 'suspended') context.resume().catch(() => {});
            return;
        }

        const AudioContextClass = root.AudioContext || root.webkitAudioContext;
        if (!AudioContextClass) return;

        context = new AudioContextClass();
        masterGain = context.createGain();
        masterGain.gain.value = muted ? 0 : 1;
        masterGain.connect(context.destination);

        musicGain = context.createGain();
        musicGain.gain.value = MUSIC_VOLUME;
        musicGain.connect(masterGain);

        sfxGain = context.createGain();
        sfxGain.gain.value = SFX_VOLUME;
        sfxGain.connect(masterGain);

        const frames = Math.floor(context.sampleRate * 0.4);
        noiseBuffer = context.createBuffer(1, frames, context.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < frames; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    function isMuted() {
        return muted;
    }

    function setMuted(nextMuted) {
        muted = nextMuted;
        storeMute(muted);
        if (masterGain) {
            masterGain.gain.setTargetAtTime(muted ? 0 : 1, context.currentTime, 0.01);
        }
        if (context) {
            if (muted) {
                context.suspend().catch(() => {});
            } else {
                context.resume().catch(() => {});
            }
        }
    }

    function envelope(target, time, peak, duration) {
        const gain = context.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(peak, time + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        gain.connect(target);
        return gain;
    }

    function playTone(target, time, { type, freq, endFreq, peak, duration, harmonic }) {
        const gain = envelope(target, time, peak, duration);
        const oscillator = context.createOscillator();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, time);
        if (endFreq) {
            oscillator.frequency.exponentialRampToValueAtTime(endFreq, time + duration);
        }
        oscillator.connect(gain);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.02);

        if (harmonic) {
            const harmonicGain = envelope(target, time, peak * 0.25, duration * 0.6);
            const harmonicOsc = context.createOscillator();
            harmonicOsc.type = 'sine';
            harmonicOsc.frequency.setValueAtTime(freq * 4, time);
            harmonicOsc.connect(harmonicGain);
            harmonicOsc.start(time);
            harmonicOsc.stop(time + duration);
        }
    }

    function playNoise(target, time, { filterType, frequency, peak, duration }) {
        const source = context.createBufferSource();
        source.buffer = noiseBuffer;
        const filter = context.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(frequency, time);
        const gain = envelope(target, time, peak, duration);
        source.connect(filter);
        filter.connect(gain);
        source.start(time);
        source.stop(time + duration + 0.02);
    }

    function playInstrument(event, time) {
        switch (event.instrument) {
            case 'kick':
                playTone(musicGain, time, { type: 'sine', freq: 150, endFreq: 45, peak: 0.9, duration: 0.15 });
                break;
            case 'bass':
                playTone(musicGain, time, { type: 'triangle', freq: midiToFreq(event.midi), peak: 0.5, duration: 0.18 });
                break;
            case 'melody':
                playTone(musicGain, time, { type: 'sine', freq: midiToFreq(event.midi), peak: 0.45, duration: 0.25, harmonic: true });
                break;
            case 'hat':
                playNoise(musicGain, time, { filterType: 'highpass', frequency: 7000, peak: 0.25, duration: 0.04 });
                break;
            case 'clap':
                playNoise(musicGain, time, { filterType: 'bandpass', frequency: 1500, peak: 0.4, duration: 0.12 });
                break;
            case 'sparkle':
                playTone(musicGain, time, { type: 'square', freq: midiToFreq(event.midi), peak: 0.08, duration: 0.08 });
                break;
        }
    }

    function stepDuration() {
        return 60 / bpm / 4;
    }

    function scheduler() {
        // A hidden tab throttles this interval; skip the missed beats instead of dumping them at once.
        if (nextStepTime < context.currentTime) {
            nextStep = Math.ceil(nextStep / STEPS_PER_BAR) * STEPS_PER_BAR;
            nextStepTime = context.currentTime + 0.05;
        }

        while (nextStepTime < context.currentTime + SCHEDULE_AHEAD) {
            musicStep(nextStep, intensity).forEach(event => playInstrument(event, nextStepTime));
            nextStepTime += stepDuration();
            nextStep++;
        }
    }

    function startMusic() {
        init();
        if (!context) return;
        stopMusic();
        nextStep = 0;
        nextStepTime = context.currentTime + 0.05;
        schedulerId = setInterval(scheduler, LOOKAHEAD_MS);
    }

    function stopMusic() {
        if (schedulerId !== null) {
            clearInterval(schedulerId);
            schedulerId = null;
        }
    }

    function setIntensity(level) {
        intensity = Math.max(0, Math.min(3, level));
    }

    function setHurry(on) {
        bpm = on ? HURRY_BPM : NORMAL_BPM;
    }

    // A hidden tab keeps the AudioContext clock running while throttling our
    // interval; suspend it outright so there is nothing for the scheduler to
    // catch up on when the tab comes back.
    function setPageHidden(hidden) {
        if (!context) return;
        if (hidden) {
            context.suspend().catch(() => {});
        } else if (!muted) {
            context.resume().catch(() => {});
        }
    }

    function playPop() {
        if (!context) return;
        playTone(sfxGain, context.currentTime, { type: 'square', freq: 800, endFreq: 200, peak: 0.3, duration: 0.1 });
    }

    function playSuccess(chain = 1) {
        if (!context) return;
        const pitch = Math.pow(2, ((chain - 1) * 2) / 12);
        [523.25, 659.25, 783.99].forEach((freq, index) => {
            playTone(sfxGain, context.currentTime + index * 0.1, {
                type: 'sine',
                freq: freq * pitch,
                peak: 0.2,
                duration: 0.3
            });
        });
    }

    function playFail() {
        if (!context) return;
        playTone(sfxGain, context.currentTime, { type: 'sawtooth', freq: 200, endFreq: 100, peak: 0.2, duration: 0.5 });
    }

    const GameAudio = {
        init,
        isMuted,
        setMuted,
        startMusic,
        stopMusic,
        setIntensity,
        setHurry,
        setPageHidden,
        playPop,
        playSuccess,
        playFail,
        musicStep
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = GameAudio;
    } else {
        root.GameAudio = GameAudio;
    }
})(typeof window !== 'undefined' ? window : globalThis);
