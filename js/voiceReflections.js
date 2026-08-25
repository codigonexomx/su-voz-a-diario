/**
 * VoiceReflections - Sistema de Grabación y Reproducción de Reflexiones de Audio (max 30s)
 * Su Voz a Diario - Módulo 4
 */

class VoiceReflectionRecorder {
    constructor(options = {}) {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.maxDuration = options.maxDuration || 30; // 30 segundos máximo
        this.isRecording = false;
        this.timerInterval = null;
        this.currentDuration = 0;
        this.audioBlob = null;
        this.audioURL = null;
        this.onStateChange = options.onStateChange || null;
    }

    async startRecording() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Tu dispositivo no soporta grabación de audio.');
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 44100
                }
            });

            this.audioChunks = [];
            this.currentDuration = 0;
            this.audioBlob = null;
            this.audioURL = null;

            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4';
                } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                    mimeType = 'audio/aac';
                } else {
                    mimeType = '';
                }
            }

            const options = mimeType ? { mimeType } : {};
            this.mediaRecorder = new MediaRecorder(stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                const type = mimeType || 'audio/webm';
                this.audioBlob = new Blob(this.audioChunks, { type });
                this.audioURL = URL.createObjectURL(this.audioBlob);
                if (typeof this.onStateChange === 'function') {
                    this.onStateChange('recorded', { audioURL: this.audioURL, blob: this.audioBlob, duration: this.currentDuration });
                }
            };

            this.mediaRecorder.start(1000);
            this.isRecording = true;
            this.startTimer();

            if (typeof this.onStateChange === 'function') {
                this.onStateChange('recording', { duration: 0 });
            }

        } catch (error) {
            console.error('[VoiceRecorder] Error al iniciar grabación:', error);
            this.showPermissionError(error.message);
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.stopTimer();

            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
        }
    }

    cancelRecording() {
        this.stopTimer();
        if (this.mediaRecorder && this.isRecording) {
            this.isRecording = false;
            this.mediaRecorder.stop();
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
        }
        this.audioChunks = [];
        this.audioBlob = null;
        this.audioURL = null;
        this.currentDuration = 0;
        if (typeof this.onStateChange === 'function') {
            this.onStateChange('idle', null);
        }
    }

    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            this.currentDuration++;

            if (typeof this.onStateChange === 'function') {
                this.onStateChange('recording', { duration: this.currentDuration });
            }

            if (this.currentDuration >= this.maxDuration) {
                this.stopRecording();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    async uploadAudio(audioBlob = this.audioBlob) {
        if (!audioBlob) return null;

        const auth = window.firebaseAuth?.() || window.firebase?.auth?.();
        const currentUser = auth?.currentUser;
        if (!currentUser?.uid) {
            console.warn('[VoiceRecorder] No hay usuario autenticado para subir audio.');
            return null;
        }

        const uid = currentUser.uid;
        const timestamp = Date.now();
        const storage = window.firebaseStorage?.() || window.firebase?.storage?.();

        if (!storage) {
            console.warn('[VoiceRecorder] Firebase Storage no está inicializado.');
            return null;
        }

        const storageRef = storage.ref(`community/audio/${timestamp}-${uid}.webm`);

        try {
            const uploadTask = await storageRef.put(audioBlob, {
                contentType: audioBlob.type || 'audio/webm',
                customMetadata: {
                    uid: uid,
                    duration: String(this.currentDuration)
                }
            });

            const downloadURL = await storageRef.getDownloadURL();
            return downloadURL;
        } catch (error) {
            console.error('[VoiceRecorder] Error al subir audio a Storage:', error);
            return null;
        }
    }

    showPermissionError(msg) {
        if (window.app?.showToast) {
            window.app.showToast(msg || 'No se pudo acceder al micrófono');
        } else {
            alert('No se pudo acceder al micrófono: ' + msg);
        }
    }
}

class AudioPlayer {
    constructor(audioURL, containerElement, options = {}) {
        this.audioURL = audioURL;
        this.container = containerElement;
        this.duration = options.duration || 30;
        this.audio = new Audio(audioURL);
        this.init();
    }

    init() {
        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="audio-player-card">
                <button class="audio-play-btn" type="button" aria-label="Reproducir audio">
                    ▶
                </button>
                <div class="audio-progress-container">
                    <div class="audio-progress-bar">
                        <div class="audio-progress-fill" style="width: 0%;"></div>
                    </div>
                    <span class="audio-time-display">0:00 / 0:${String(Math.min(30, this.duration)).padStart(2, '0')}</span>
                </div>
                <button class="audio-speed-btn" type="button" title="Velocidad de reproducción">1x</button>
            </div>
        `;
    }

    bindEvents() {
        const playBtn = this.container.querySelector('.audio-play-btn');
        const speedBtn = this.container.querySelector('.audio-speed-btn');

        if (playBtn) playBtn.addEventListener('click', () => this.togglePlay());
        if (speedBtn) speedBtn.addEventListener('click', () => this.changeSpeed());

        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => {
            if (playBtn) playBtn.textContent = '▶';
            const fill = this.container.querySelector('.audio-progress-fill');
            if (fill) fill.style.width = '0%';
        });
    }

    togglePlay() {
        const playBtn = this.container.querySelector('.audio-play-btn');
        if (this.audio.paused) {
            this.audio.play();
            if (playBtn) playBtn.textContent = '⏸';
        } else {
            this.audio.pause();
            if (playBtn) playBtn.textContent = '▶';
        }
    }

    changeSpeed() {
        const speeds = [1, 1.5, 2];
        const currentIndex = speeds.indexOf(this.audio.playbackRate);
        const nextIndex = (currentIndex + 1) % speeds.length;
        this.audio.playbackRate = speeds[nextIndex];
        const speedBtn = this.container.querySelector('.audio-speed-btn');
        if (speedBtn) speedBtn.textContent = `${speeds[nextIndex]}x`;
    }

    updateProgress() {
        const fill = this.container.querySelector('.audio-progress-fill');
        const timeDisplay = this.container.querySelector('.audio-time-display');

        const dur = this.audio.duration || this.duration;
        const cur = this.audio.currentTime || 0;
        const percent = Math.min(100, (cur / dur) * 100);

        if (fill) fill.style.width = `${percent}%`;

        if (timeDisplay) {
            const formatSec = (s) => {
                const sec = Math.floor(s);
                return `0:${String(sec).padStart(2, '0')}`;
            };
            timeDisplay.textContent = `${formatSec(cur)} / ${formatSec(dur)}`;
        }
    }

    destroy() {
        if (this.audio) {
            this.audio.pause();
            this.audio.src = '';
        }
    }
}

if (typeof window !== 'undefined') {
    window.VoiceReflectionRecorder = VoiceReflectionRecorder;
    window.AudioPlayer = AudioPlayer;
}
