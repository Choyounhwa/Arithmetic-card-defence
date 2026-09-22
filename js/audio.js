// Web Audio API 기반 사운드 엔진 (무설치/무외부에셋)
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, gainStart = 0.2, gainEnd = 0.001) {
        if (this.muted) return;
        this.init();
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(gainStart, now);
            gain.gain.exponentialRampToValueAtTime(gainEnd, now + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {
            console.warn("Audio play error", e);
        }
    }

    // 정답 / 카드 합성 성공 (도-미-솔-도 아르페지오)
    playCorrect() {
        if (this.muted) return;
        this.init();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, 'triangle', 0.25, 0.25, 0.01);
            }, idx * 60);
        });
    }

    // 오답 음 (낮은 버저)
    playWrong() {
        if (this.muted) return;
        this.init();
        this.playTone(180, 'sawtooth', 0.3, 0.25, 0.01);
    }

    // 유닛 소환 / 배치 쿵
    playDeploy() {
        if (this.muted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    // 포탄 발사 펑!
    playShoot() {
        if (this.muted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
    }

    // 타격 사운드 (몬스터 피격)
    playHit() {
        this.playTone(280, 'square', 0.08, 0.15, 0.01);
    }

    // 폭발 사운드 (광역 폭발 / 몬스터 사망)
    playExplosion() {
        if (this.muted) return;
        this.init();
        try {
            const bufferSize = this.ctx.sampleRate * 0.4;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, this.ctx.currentTime);
            filter.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.4);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start();
        } catch (e) {
            this.playTone(100, 'sawtooth', 0.3, 0.3, 0.01);
        }
    }

    // 빙결 사운드
    playFreeze() {
        if (this.muted) return;
        this.init();
        const notes = [1200, 1500, 1800, 2400];
        notes.forEach((f, i) => {
            setTimeout(() => {
                this.playTone(f, 'sine', 0.2, 0.15, 0.01);
            }, i * 50);
        });
    }

    // 피버 모드 돌입 팡파레!
    playFever() {
        if (this.muted) return;
        this.init();
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((f, i) => {
            setTimeout(() => {
                this.playTone(f, 'square', 0.2, 0.2, 0.02);
            }, i * 80);
        });
    }

    // 슬로우 모션 (불릿 타임) 진입음
    playSlowEnter() {
        this.playTone(220, 'sine', 0.2, 0.1, 0.01);
    }

    // 카드 뽑기 (드로우 휙)
    playCardDraw() {
        if (this.muted) return;
        this.init();
        this.playTone(320, 'triangle', 0.08, 0.1, 0.01);
    }

    // 카드 마우스 호버 (사각 사운드)
    playCardHover() {
        if (this.muted) return;
        this.init();
        this.playTone(480, 'sine', 0.04, 0.05, 0.005);
    }

    // 카드 집어들기 (픽업)
    playCardPick() {
        if (this.muted) return;
        this.init();
        this.playTone(520, 'triangle', 0.07, 0.12, 0.01);
    }

    // 카드 보드 슬램 (전장에 쾅 내려놓을 때의 묵직한 타격)
    playCardSlam() {
        if (this.muted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
    }

    // 카드 디스카드 / 버리기 (경쾌하게 슥 날아가는 소리)
    playDiscard() {
        if (this.muted) return;
        this.init();
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(360, now);
            osc.frequency.exponentialRampToValueAtTime(90, now + 0.16);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.16);
        } catch (e) {}
    }
}

window.soundEngine = new SoundEngine();
