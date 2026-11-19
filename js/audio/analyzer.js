// js/audio/analyzer.js
// Audio Engine with 3 input sources:
// 1. Built-in Procedural Synth Beat (Zero-setup instant groove with kick, bassline, and arpeggios via Web Audio API)
// 2. Microphone Input
// 3. Audio File Upload / Drag & Drop
// Analyzes audio into 4 smoothed frequency envelopes: Sub-Bass, Low-Mid, High-Mid, Treble

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.analyser = null;
        this.dataArray = null;
        this.freqData = null;
        this.sourceNode = null;
        this.microphoneStream = null;
        this.sourceRequest = 0;
        
        this.bands = {
            bass: 0,
            lowMid: 0,
            highMid: 0,
            treble: 0
        };
        
        // Smoothing envelopes
        this.smoothedBands = {
            bass: 0,
            lowMid: 0,
            highMid: 0,
            treble: 0
        };

        this.sourceType = 'none'; // 'none' | 'synth' | 'mic' | 'file'
        this.isPlaying = false;
        
        // Procedural synth timer
        this.synthTimer = null;
        this.synthStep = 0;
        this.bpm = 124;
    }

    initContext() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.8;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    stopCurrentSource() {
        this.sourceRequest++;
        this.microphoneStream?.getTracks().forEach(track => track.stop());
        this.microphoneStream = null;
        if (this.sourceNode) {
            try {
                this.sourceNode.stop?.();
            } catch (e) {}
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        if (this.synthTimer) {
            clearInterval(this.synthTimer);
            this.synthTimer = null;
        }
        this.isPlaying = false;
        this.sourceType = 'none';
    }

    // 1. Built-in Procedural Synth Loop (Kick, Acid Bass, Shimmer Arp)
    startSynthBeat() {
        this.initContext();
        this.stopCurrentSource();
        this.sourceType = 'synth';
        this.isPlaying = true;

        const stepTime = (60 / this.bpm) / 4 * 1000; // 16th notes
        this.synthStep = 0;

        const synthMaster = this.ctx.createGain();
        synthMaster.gain.value = 0.65;
        synthMaster.connect(this.analyser);
        synthMaster.connect(this.ctx.destination);

        const bassScale = [110, 110, 130.81, 110, 146.83, 110, 164.81, 130.81]; // A2 minor groove
        const arpScale = [440, 523.25, 659.25, 783.99, 880, 1046.5];

        this.synthTimer = setInterval(() => {
            if (!this.isPlaying || !this.ctx) return;
            const t = this.ctx.currentTime;
            const step = this.synthStep % 16;

            // Kick on steps 0, 4, 8, 12
            if (step % 4 === 0) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(140, t);
                osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
                gain.gain.setValueAtTime(1.0, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                osc.connect(gain);
                gain.connect(synthMaster);
                osc.start(t);
                osc.stop(t + 0.25);
            }

            // Snare / Hi-hat on offbeats
            if (step % 2 === 1) {
                const bufferSize = this.ctx.sampleRate * 0.05;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = this.ctx.createBiquadFilter();
                filter.type = (step % 4 === 2) ? 'bandpass' : 'highpass';
                filter.frequency.value = (step % 4 === 2) ? 1200 : 7000;
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime((step % 4 === 2) ? 0.4 : 0.15, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                noise.connect(filter);
                filter.connect(gain);
                gain.connect(synthMaster);
                noise.start(t);
                noise.stop(t + 0.05);
            }

            // Acid Bassline
            if (step % 2 === 0) {
                const osc = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                const freq = bassScale[(step / 2) % bassScale.length];
                osc.frequency.setValueAtTime(freq, t);

                filter.type = 'lowpass';
                filter.Q.value = 8.0;
                filter.frequency.setValueAtTime(freq * 1.5, t);
                filter.frequency.exponentialRampToValueAtTime(freq * 6.0, t + 0.06);
                filter.frequency.exponentialRampToValueAtTime(freq * 2.0, t + 0.18);

                gain.gain.setValueAtTime(0.35, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(synthMaster);
                osc.start(t);
                osc.stop(t + 0.2);
            }

            // Shimmering Arp
            if (Math.random() > 0.3) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                const note = arpScale[Math.floor(Math.random() * arpScale.length)];
                osc.frequency.setValueAtTime(note, t);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                osc.connect(gain);
                gain.connect(synthMaster);
                osc.start(t);
                osc.stop(t + 0.15);
            }

            this.synthStep++;
        }, stepTime);
    }

    // 2. Microphone stream
    async startMicrophone() {
        this.initContext();
        this.stopCurrentSource();
        const request = this.sourceRequest;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            if (request !== this.sourceRequest) {
                stream.getTracks().forEach(track => track.stop());
                return false;
            }
            this.microphoneStream = stream;
            this.sourceType = 'mic';
            this.isPlaying = true;
            this.sourceNode = this.ctx.createMediaStreamSource(stream);
            this.sourceNode.connect(this.analyser);
            // Mic is NOT connected to destination to avoid feedback loops!
            return true;
        } catch (err) {
            if (request !== this.sourceRequest) return false;
            console.warn('Microphone permission denied or unavailable:', err);
            this.stopCurrentSource();
            return false;
        }
    }

    // 3. Audio File playback
    async loadAudioFile(file) {
        this.initContext();
        this.stopCurrentSource();
        const request = this.sourceRequest;
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            if (request !== this.sourceRequest) return false;
            this.sourceNode = this.ctx.createBufferSource();
            this.sourceNode.buffer = audioBuffer;
            this.sourceNode.loop = true;
            this.sourceNode.connect(this.analyser);
            this.sourceNode.connect(this.ctx.destination);
            this.sourceNode.start(0);
            this.sourceType = 'file';
            this.isPlaying = true;
            return true;
        } catch (err) {
            if (request !== this.sourceRequest) return false;
            this.stopCurrentSource();
            console.error('Failed to decode audio file:', err);
            return false;
        }
    }

    update(dt) {
        if (!this.isPlaying || !this.analyser) {
            // Decay bands towards zero
            for (const k of ['bass', 'lowMid', 'highMid', 'treble']) {
                this.smoothedBands[k] *= 0.85;
                if (this.smoothedBands[k] < 0.001) this.smoothedBands[k] = 0;
            }
            return this.smoothedBands;
        }

        this.analyser.getByteFrequencyData(this.dataArray);
        const len = this.dataArray.length;

        // Band indices (approx for 512 fft, sample rate 44.1/48k)
        // Bass: bins 1 - 7 (~20 - 150 Hz)
        let bassSum = 0, bassCount = 0;
        for (let i = 1; i <= 7 && i < len; i++) {
            bassSum += this.dataArray[i];
            bassCount++;
        }
        this.bands.bass = (bassSum / (bassCount * 255)) || 0;

        // Low-Mid: bins 8 - 30 (~150 - 650 Hz)
        let lmSum = 0, lmCount = 0;
        for (let i = 8; i <= 30 && i < len; i++) {
            lmSum += this.dataArray[i];
            lmCount++;
        }
        this.bands.lowMid = (lmSum / (lmCount * 255)) || 0;

        // High-Mid: bins 31 - 90 (~650 - 2000 Hz)
        let hmSum = 0, hmCount = 0;
        for (let i = 31; i <= 90 && i < len; i++) {
            hmSum += this.dataArray[i];
            hmCount++;
        }
        this.bands.highMid = (hmSum / (hmCount * 255)) || 0;

        // Treble: bins 91 - 220 (~2000 - 5000+ Hz)
        let trSum = 0, trCount = 0;
        for (let i = 91; i <= 220 && i < len; i++) {
            trSum += this.dataArray[i];
            trCount++;
        }
        this.bands.treble = (trSum / (trCount * 255)) || 0;

        // Apply smooth attack / release
        const attack = 0.45;
        const release = 0.82;
        for (const k of ['bass', 'lowMid', 'highMid', 'treble']) {
            const target = this.bands[k];
            if (target > this.smoothedBands[k]) {
                this.smoothedBands[k] = this.smoothedBands[k] * (1.0 - attack) + target * attack;
            } else {
                this.smoothedBands[k] = this.smoothedBands[k] * release + target * (1.0 - release);
            }
        }

        return this.smoothedBands;
    }
}
