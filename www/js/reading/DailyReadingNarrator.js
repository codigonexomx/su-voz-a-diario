export function chunkDailyVoiceText(value, maxLength = 2800) {
    let text = String(value || '').replace(/\s+/g, ' ').trim();
    const chunks = [];
    while (text.length > maxLength) {
        const space = text.lastIndexOf(' ', maxLength);
        const end = space > 0 ? space : maxLength;
        chunks.push(text.slice(0, end));
        text = text.slice(end).trimStart();
    }
    if (text) chunks.push(text);
    return chunks;
}

export class DailyReadingNarrator {
    constructor({ synthesis, Utterance, native, selectVoice, onState, onComplete, onError }) {
        Object.assign(this, { synthesis, Utterance, native, selectVoice, onState, onComplete, onError });
        this.state = { status: 'idle', date: null, verseIndex: -1, utterance: null };
        this.nativeStop = Promise.resolve();
    }

    emit() {
        const entry = this.queue?.[this.index];
        this.onState({ ...this.state, verseIndex: entry?.verseIndex ?? -1 });
    }

    active(token) {
        return this.token === token && this.state.status !== 'idle';
    }

    invalidate() {
        const token = this.token;
        this.token = null;
        token?.cancel?.();
        token?.cleanup?.();
    }

    stop(stopEngine = true) {
        this.invalidate();
        this.queue = [];
        this.index = 0;
        this.offset = 0;
        this.state = { status: 'idle', date: null, verseIndex: -1, utterance: null };
        if (stopEngine) {
            if (this.native) this.nativeStop = Promise.resolve().then(() => this.native.stop()).catch(() => {});
            else { try { this.synthesis?.cancel(); } catch { /* The run is already invalidated. */ } }
        }
        this.emit();
    }

    start(date, queue, version) {
        this.stop();
        if (!queue.length) return;
        this.queue = queue.map(entry => ({ ...entry }));
        this.state = { status: 'speaking', date, version, utterance: null };
        this.token = {};
        if (!this.native && this.synthesis.paused) this.synthesis.resume();
        this.play(this.token);
    }

    pause() {
        if (this.state.status !== 'speaking') return;
        if (this.native) {
            this.invalidate();
            this.nativeStop = Promise.resolve().then(() => this.native.stop()).catch(() => {});
            this.state.utterance = null;
        } else {
            this.synthesis.pause();
        }
        this.state.status = 'paused';
        this.emit();
    }

    resume() {
        if (this.state.status !== 'paused') return;
        this.state.status = 'speaking';
        if (!this.native) this.synthesis.resume();
        if (!this.native && this.token && this.state.utterance) {
            this.emit();
        } else {
            this.token = {};
            this.play(this.token);
        }
    }

    async speak(entry, token) {
        const offset = this.offset;
        const text = entry.text.slice(offset);
        const progress = position => {
            if (this.active(token) && Number.isInteger(position) && position >= 0 && position < text.length) {
                this.offset = offset + position;
            }
        };
        const cancellation = new Promise(resolve => { token.cancel = () => resolve(false); });
        let speech;
        if (this.native) {
            speech = (async () => {
                await this.nativeStop;
                if (!this.active(token)) return false;
                let listener;
                token.cleanup = () => {
                    const handle = listener;
                    listener = null;
                    if (handle) Promise.resolve(handle.remove()).catch(() => {});
                };
                if (typeof this.native.addListener === 'function') {
                    try {
                        listener = await this.native.addListener('onRangeStart', event => progress(event.start));
                    } catch { /* Verse-level playback remains available without word events. */ }
                }
                if (!this.active(token)) { token.cleanup(); return false; }
                try {
                    await this.native.speak({ text, lang: 'es-MX', rate: 0.92, pitch: 1,
                        volume: 1, category: 'ambient', queueStrategy: 0 });
                    return true;
                } finally { token.cleanup(); }
            })();
        } else {
            speech = new Promise((resolve, reject) => {
                const utterance = new this.Utterance(text);
                const voice = this.selectVoice(this.synthesis.getVoices());
                if (voice) utterance.voice = voice;
                utterance.lang = voice?.lang || 'es-MX';
                utterance.rate = 0.92;
                utterance.pitch = 1;
                utterance.onboundary = event => progress(event.charIndex);
                utterance.onend = () => resolve(true);
                utterance.onerror = error => reject(error);
                this.state.utterance = utterance;
                this.synthesis.speak(utterance);
            });
        }
        return Promise.race([speech, cancellation]);
    }

    async play(token) {
        try {
            while (this.active(token)) {
                const entry = this.queue[this.index];
                if (!entry) break;
                const speech = this.speak(entry, token);
                this.emit();
                if (!await speech || !this.active(token)) return;
                this.index++;
                this.offset = 0;
                this.state.utterance = null;
                if (this.state.status === 'paused') { this.token = null; return; }
            }
            if (!this.active(token)) return;
            const { date, version } = this.state;
            this.stop(false);
            this.onComplete({ date, version });
        } catch {
            if (!this.active(token)) return;
            this.stop();
            this.onError();
        }
    }
}
