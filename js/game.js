// 메인 게임 컨트롤러 (1인칭 세로 모드 540x960)
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // 모바일 최적화 가상 해상도 (기준 가로 540px, 세로는 화면에 맞춰 꽉 채움)
        this.width = 540;
        this.height = 800; // fitCanvas에서 컨테이너 실제 비율에 맞춰 실시간 동적 계산
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.rampartHeight = 6;
        this.rampartY = this.height - 6;
        this.horizonY = 155;

        // 1인칭 세로 그리드 (6세로 레인 x 7수평 방어선 행 = 총 42칸 전장 가득 채움)
        this.grid = {
            width: this.width,
            height: this.height,
            lanes: 6,
            rows: 7,
            laneOffsetX: 12, // 좌우 12px 여백 (12 + 6*86 = 528px)
            laneWidth: 86,  // 6개 레인 폭 86px
            rowOffsetY: 160,
            rowHeight: 88,
            getLaneCenterX: (lane) => 12 + lane * 86 + 43,
            getCellCenter: (lane, row) => ({
                x: 12 + lane * 86 + 43,
                y: 160 + row * 88 + 44
            })
        };

        // 게임 상태 (무한 생존 모드 & 8단계 승급)
        this.state = 'TITLE';
        this.score = 0;
        this.castleHp = 100;
        this.maxCastleHp = 100;
        this.survivalTime = 0; // 초 단위 무한 생존 시간
        this.currentTier = { tier: 1, name: '초심자' };
        this.lastTier = 1;
        this.bossesSpawned = {}; // 분 단위 보스 스폰 여부
        this.lastStep30s = 0; // 5분 이후 30초 단위 1.2배 증가 스텝 추적
        this.spawnTimer = 0;

        // 라스트워 스타일 킬 스트릭 카운터
        this.killStreak = 0;
        this.killStreakTimer = 0;

        // 콤보 및 피버
        this.combo = 0;
        this.fever = false;
        this.feverTimer = 0;
        this.maxFeverTime = 7.0;

        // 불릿 타임 (시간 5배 감속)
        this.isBulletTime = false;
        this.bulletTimeScale = 0.2;

        // 엔티티
        this.towers = [];
        this.warriors = [];
        this.monsters = [];
        this.projectiles = [];
        this.particles = [];

        // 화면 흔들림
        this.shakeTimer = 0;
        this.shakeIntensity = 0;

        // 하스스톤 문제 손패 & 답안 랙 상태
        this.hand = []; // 문제 카드들 (최대 5장)
        this.answerCards = []; // 상단 가로 랙에 진열된 정답/오답 룬스톤들 (7개)
        this.maxHandSize = 5; // 수평 5열 나란히 시인성 극대화
        this.draggingCard = null; // 현재 드래그 중인 카드
        this.selectedCard = null; // 현재 탭/선택된 각성 카드 (타일 터치 배치용)
        this.dragProxyEl = null; // 드래그 따라다니는 카드 엘리먼트
        this.hoverCell = null; // { lane, row }
        this.firstTurnTutorialDone = false;
        this.firstDeployTutorialDone = false;

        this.pointer = { x: 0, y: 0, down: false };

        this.initEvents();
        this.setupDOM();
    }

    setupDOM() {
        this.uiSurvivalTime = document.getElementById('uiSurvivalTime');
        this.uiTierBadge = document.getElementById('uiTierBadge');
        this.uiScore = document.getElementById('uiScore');
        this.uiCastleHp = document.getElementById('uiCastleHp');
        this.uiHpBar = document.getElementById('uiHpBar');
        this.uiCombo = document.getElementById('uiCombo');
        this.uiFeverBar = document.getElementById('uiFeverBar');
        this.uiFeverContainer = document.getElementById('uiFeverContainer');

        this.tierUpBanner = document.getElementById('tierUpBanner');
        this.bossAlertBanner = document.getElementById('bossAlertBanner');

        this.handContainer = document.getElementById('problemHand');
        this.answerRackContainer = document.getElementById('answerRack');
        this.damageFlashEl = document.getElementById('damageFlash');

        this.startModal = document.getElementById('startModal');
        this.resultModal = document.getElementById('resultModal');
        this.resultTitle = document.getElementById('resultTitle');
        this.resultSurvivalTime = document.getElementById('resultSurvivalTime');
        this.resultTier = document.getElementById('resultTier');
        this.resultScore = document.getElementById('resultScore');
        this.bulletTimeIndicator = document.getElementById('bulletTimeIndicator');
        this.dragDiscardZone = document.getElementById('dragDiscardZone');

        // 난이도 및 복귀 관련 UI
        this.selectedDifficulty = 'beginner';
        this.uiDiffBadge = document.getElementById('uiDiffBadge');
        this.confirmExitModal = document.getElementById('confirmExitModal');

        // 시작 모달 난이도 3단계 카드 선택 리스너
        const diffCards = document.querySelectorAll('#difficultySelector .diff-card');
        diffCards.forEach(card => {
            card.addEventListener('click', () => {
                diffCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.selectedDifficulty = card.dataset.difficulty || 'beginner';
                window.soundEngine.playCardPick();
            });
        });

        // 인게임 상단 HUD 뒤로가기(메인 화면 복귀) 버튼
        const btnBackToMain = document.getElementById('btnBackToMain');
        if (btnBackToMain) {
            btnBackToMain.addEventListener('click', () => {
                if (this.state === 'PLAYING') {
                    this.isBulletTime = true;
                    if (this.confirmExitModal) this.confirmExitModal.classList.remove('hidden');
                    window.soundEngine.playCardPick();
                }
            });
        }

        // 메인 복귀 확인 모달: 계속 플레이 (취소)
        const confirmExitCancelBtn = document.getElementById('confirmExitCancelBtn');
        if (confirmExitCancelBtn) {
            confirmExitCancelBtn.addEventListener('click', () => {
                if (this.confirmExitModal) this.confirmExitModal.classList.add('hidden');
                this.isBulletTime = false;
                window.soundEngine.playCardPick();
            });
        }

        // 메인 복귀 확인 모달: 나가기 (메인)
        const confirmExitOkBtn = document.getElementById('confirmExitOkBtn');
        if (confirmExitOkBtn) {
            confirmExitOkBtn.addEventListener('click', () => {
                if (this.confirmExitModal) this.confirmExitModal.classList.add('hidden');
                this.returnToMain();
            });
        }

        // 결과 모달: 🏠 난이도 변경 (메인 복귀)
        const resultMainBtn = document.getElementById('resultMainBtn');
        if (resultMainBtn) {
            resultMainBtn.addEventListener('click', () => {
                if (this.resultModal) this.resultModal.classList.add('hidden');
                this.returnToMain();
            });
        }

        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.startGame());
    }

    showDiscardZone(visible) {
        if (!this.dragDiscardZone) return;
        if (visible) {
            this.dragDiscardZone.classList.add('visible');
        } else {
            this.dragDiscardZone.classList.remove('visible', 'ready');
            const msg = this.dragDiscardZone.querySelector('.discard-msg');
            if (msg) msg.textContent = '아래로 끌어내려 카드 버리기';
        }
    }

    updateDiscardZoneReady(ready) {
        if (!this.dragDiscardZone) return;
        if (ready) {
            this.dragDiscardZone.classList.add('ready');
            const msg = this.dragDiscardZone.querySelector('.discard-msg');
            if (msg) msg.textContent = '🔥 손을 떼면 카드 버리기!';
        } else {
            this.dragDiscardZone.classList.remove('ready');
            const msg = this.dragDiscardZone.querySelector('.discard-msg');
            if (msg) msg.textContent = '아래로 끌어내려 카드 버리기';
        }
    }

    initEvents() {
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        };

        const onMove = (e) => {
            const pos = getPos(e);
            this.pointer.x = pos.x;
            this.pointer.y = pos.y;
            this.updateHoverCell();
        };

        const onDown = (e) => {
            window.soundEngine.init();
            const pos = getPos(e);
            this.pointer.x = pos.x;
            this.pointer.y = pos.y;
            this.pointer.down = true;
            this.updateHoverCell();

            // 만약 선택된 각성 카드가 있다면 클릭/터치한 전장 타일에 즉시 배치!
            if (this.selectedCard && this.hoverCell) {
                const placed = this.deployCardToCell(this.selectedCard, this.hoverCell.lane, this.hoverCell.row);
                if (placed) {
                    const idx = this.hand.indexOf(this.selectedCard);
                    if (idx !== -1) this.hand.splice(idx, 1);
                    this.selectedCard = null;
                    this.hoverCell = null;
                    this.renderHand();
                    setTimeout(() => this.drawCard(), 300);
                }
            }
        };

        const onUp = () => {
            this.pointer.down = false;
        };

        this.canvas.addEventListener('mousemove', onMove);
        this.canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);

        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
        this.canvas.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); onDown(e); }, { passive: false });
        window.addEventListener('touchend', onUp);
        window.addEventListener('touchcancel', onUp);

        // [모바일 최적화] 전역 뷰포트 고정 - 화면 가장자리나 외부 터치 시 게임 전체 창이 손가락을 따라 밀리거나 튀는 현상 원천 차단
        window.addEventListener('touchmove', (e) => {
            // 모달 창 내부 스크롤 허용 대상(예: 규칙 안내)인 경우 제외
            if (e.target.closest && e.target.closest('.modal-box')) return;
            if (e.cancelable) e.preventDefault();
        }, { passive: false });

        // iOS Safari 핀치 줌 및 제스처 줌 방지
        document.addEventListener('gesturestart', (e) => { if (e.cancelable) e.preventDefault(); });
        document.addEventListener('gesturechange', (e) => { if (e.cancelable) e.preventDefault(); });
        document.addEventListener('gestureend', (e) => { if (e.cancelable) e.preventDefault(); });

        window.addEventListener('resize', () => {
            this.fitCanvas();
            if (!this.firstTurnTutorialDone) this.updateTutorialArrowGuide();
            if (!this.firstDeployTutorialDone) this.updateDeployTutorialGuide();
        });
        this.fitCanvas();
    }

    fitCanvas() {
        const container = document.getElementById('gameContainer');
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;

        // 가상 캔버스 세로 해상도를 컨테이너 실제 비율에 맞춰 실시간 1:1 일치
        // 좌우/상하 검은 여백(Letterbox/Pillarbox)을 완전히 제거하고 화면을 꽉 채움!
        this.width = 540;
        this.height = Math.max(680, Math.round(540 * (h / w)));
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;

        this.updateGridDimensions();
    }

    updateGridDimensions() {
        const g = this.grid;
        g.width = this.width;
        g.height = this.height;

        // 파란색 성벽 바 삭제 -> 최하단 경계선으로 설정하여 타일이 덱 바로 위까지 가득 채움
        this.rampartHeight = 6;
        this.rampartY = this.height - 6;

        // 상단 차원문/지평선 영역 (헤더 바로 아래부터 시작)
        this.horizonY = 155;

        // 6개 레인 폭: 540px 전폭을 꽉 채움 (좌우 여백 12px, 레인당 86px)
        g.laneOffsetX = 12;
        g.laneWidth = 86;

        // 7개 방어선 행: 상단 지평선 아래부터 덱 바로 위까지 전면 배치
        const availableH = this.rampartY - this.horizonY - 8;
        g.rowHeight = Math.floor(availableH / g.rows);
        g.rowOffsetY = this.horizonY + Math.floor((availableH - g.rowHeight * g.rows) / 2) + 4;

        g.getLaneCenterX = (lane) => {
            return g.laneOffsetX + lane * g.laneWidth + g.laneWidth / 2;
        };
        g.getCellCenter = (lane, row) => {
            return {
                x: g.laneOffsetX + lane * g.laneWidth + g.laneWidth / 2,
                y: g.rowOffsetY + row * g.rowHeight + g.rowHeight / 2
            };
        };

        // 리사이즈 시 기존 배치된 타워 좌표 자동 동기화
        if (this.towers && this.towers.length > 0) {
            this.towers.forEach(t => {
                const pos = g.getCellCenter(t.lane, t.row);
                t.x = pos.x;
                t.y = pos.y;
            });
        }
    }

    updateHoverCell(customX = null, customY = null) {
        const x = customX !== null ? customX : this.pointer.x;
        const y = customY !== null ? customY : this.pointer.y;

        const g = this.grid;
        // 6개 세로 레인 및 7개 수평 행 범위 검사
        if (x >= g.laneOffsetX && x < g.laneOffsetX + g.lanes * g.laneWidth &&
            y >= g.rowOffsetY && y < g.rowOffsetY + g.rows * g.rowHeight) {
            const lane = Math.floor((x - g.laneOffsetX) / g.laneWidth);
            const row = Math.floor((y - g.rowOffsetY) / g.rowHeight);
            if (lane >= 0 && lane < g.lanes && row >= 0 && row < g.rows) {
                this.hoverCell = { lane, row };
            } else {
                this.hoverCell = null;
            }
        } else {
            this.hoverCell = null;
        }
    }

    startGame() {
        this.state = 'PLAYING';
        this.score = 0;
        this.castleHp = this.maxCastleHp;
        this.survivalTime = 0; // 생존 시간 리셋
        
        // 선택된 수학 난이도 주입
        window.mathEngine.setDifficulty(this.selectedDifficulty || 'beginner');

        this.currentTier = window.mathEngine.getTierData(0);
        this.lastTier = 1;
        this.bossesSpawned = {};
        this.lastStep30s = 0;
        this.spawnTimer = 999; // 준비 시간 종료 즉시 첫 몬스터 스폰
        this.combo = 0;
        this.fever = false;
        this.feverTimer = 0;
        this.killStreak = 0;
        this.killStreakTimer = 0;

        this.towers = [];
        this.warriors = [];
        this.monsters = [];
        this.projectiles = [];
        this.particles = [];

        this.hand = [];
        this.answerCards = [];
        this.draggingCard = null;
        this.selectedCard = null;
        this.isBulletTime = false;

        this.startModal.classList.add('hidden');
        this.resultModal.classList.add('hidden');
        if (this.confirmExitModal) this.confirmExitModal.classList.add('hidden');
        if (this.tierUpBanner) this.tierUpBanner.classList.add('hidden');
        if (this.bossAlertBanner) this.bossAlertBanner.classList.add('hidden');

        this.dismissDeployTutorialGuide(true);
        this.firstTurnTutorialDone = false;
        this.firstDeployTutorialDone = false;

        this.initHand();
        this.updateHUD();

        window.soundEngine.init();
        window.soundEngine.playCorrect();

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));

        // 첫 턴 사용법 안내 화살표 UI 표시
        setTimeout(() => this.showTutorialArrowGuide(), 150);
    }

    initHand() {
        this.hand = [];
        // 선택된 난이도에 맞춘 문제 5장으로 핸드 구성
        for (let i = 0; i < this.maxHandSize; i++) {
            this.hand.push(window.mathEngine.createCard(1));
        }

        this.refreshAnswerRack();
        this.renderHand();
    }

    refreshAnswerRack() {
        this.answerCards = window.mathEngine.generateAnswerPool(this.hand, 7);
        // 답안카드는 작은 숫자 -> 큰 숫자 오름차순 정렬 (sortVal 기준 정렬로 분수/소수 완벽 지원)
        this.answerCards.sort((a, b) => a.sortVal - b.sortVal);
        this.renderAnswerRack();
    }

    // 상단 가로 랙 (7개 답안 룬스톤) 렌더링 & 드래그 이벤트 바인딩
    renderAnswerRack() {
        if (!this.answerRackContainer) return;
        this.answerRackContainer.innerHTML = '';

        this.answerCards.forEach(ans => {
            const ansEl = document.createElement('div');
            ansEl.className = 'hs-answer-card';
            ansEl.dataset.val = ans.val;
            const strVal = String(ans.val);
            const lenClass = strVal.length >= 4 ? 'val-len-4' : (strVal.length === 3 ? 'val-len-3' : '');
            ansEl.innerHTML = `
                <div class="answer-rune-badge">RUNE</div>
                <div class="answer-val-num ${lenClass}">${strVal}</div>
            `;
            this.bindAnswerDrag(ansEl, ans);
            this.answerRackContainer.appendChild(ansEl);
        });

        // 튜토리얼 진행 중인 경우 하이라이트 및 화살표 위치 갱신
        if (!this.firstTurnTutorialDone) {
            requestAnimationFrame(() => this.updateTutorialArrowGuide());
        }
    }

    // 맨 처음 스테이지 시작할 때 답안카드와 문제카드 사용법을 알려주는 화살표 UI (한 턴 이후 자동 소멸)
    showTutorialArrowGuide() {
        if (this.firstTurnTutorialDone) return;
        this.dismissTutorialGuide(true); // 혹시 남아있는 기존 튜토리얼 강제 정리
        this.firstTurnTutorialDone = false; // 플래그 복구

        // 미해결 문제 카드 중 첫 번째 카드와 그 정답을 가진 룬스톤 탐색
        const targetCard = this.hand.find(c => !c.charged);
        if (!targetCard || !targetCard.problem) return;

        const targetAns = targetCard.problem.answer;
        const matchRune = this.answerCards.find(a => {
            return String(a.val).trim() === String(targetAns).trim() ||
                (a.sortVal !== undefined && targetCard.problem.answerNum !== undefined && Math.abs(a.sortVal - targetCard.problem.answerNum) < 0.001);
        });
        if (!matchRune) return;

        const appEl = document.getElementById('app');
        if (!appEl) return;

        // DOM 엘리먼트 탐색
        const runeEls = document.querySelectorAll('#answerRack .hs-answer-card');
        let sourceEl = null;
        runeEls.forEach(el => {
            const val = el.dataset.val;
            if ((String(val).trim() === String(matchRune.val).trim()) && !sourceEl) {
                sourceEl = el;
            }
        });

        const cardIdx = this.hand.indexOf(targetCard);
        const cardEls = document.querySelectorAll('#problemHand .hs-card');
        const targetEl = cardEls[cardIdx];

        if (!sourceEl || !targetEl) return;

        sourceEl.classList.add('tutorial-source-highlight');
        targetEl.classList.add('tutorial-target-highlight');

        const overlay = document.createElement('div');
        overlay.id = 'tutorialArrowOverlay';
        overlay.className = 'tutorial-arrow-overlay';

        const cleanQ = (targetCard.problem.displayExpr || targetCard.problem.question || '').replace(/\s*=\s*\?$/, '').trim();

        overlay.innerHTML = `
            <div id="tutorialGuideBanner" class="tutorial-guide-banner">
                <span class="tutorial-pulse-icon">💡</span>
                <span class="tutorial-guide-text">정답 <strong>[${targetAns}]</strong> 룬을 아래 문제 <strong>[${cleanQ}]</strong> 카드로 드래그하세요!</span>
            </div>
            <svg id="tutorialSvgCanvas" class="tutorial-svg-canvas">
                <defs>
                    <marker id="tutArrowHead" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
                        <polygon points="0 0.5, 6 3.5, 0 6.5" fill="#38bdf8" />
                    </marker>
                    <linearGradient id="tutGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#facc15" />
                        <stop offset="100%" stop-color="#38bdf8" />
                    </linearGradient>
                </defs>
                <path id="tutorialFlowPath" class="tutorial-flow-path" d=""
                      stroke="url(#tutGrad)" stroke-width="4.5" fill="none"
                      marker-end="url(#tutArrowHead)" />
            </svg>
            <div id="tutorialArrowPointer" class="tutorial-arrow-pointer">
                <div class="tutorial-arrow-body">
                    <div class="tutorial-finger-icon">👇</div>
                </div>
            </div>
        `;

        appEl.appendChild(overlay);
        this.updateTutorialArrowGuide();
    }

    // 화면 크기 또는 위치 변경 시 화살표 궤적 및 배너 좌표 갱신
    updateTutorialArrowGuide() {
        if (this.firstTurnTutorialDone) return;
        const overlay = document.getElementById('tutorialArrowOverlay');
        if (!overlay) return;

        const sourceEl = document.querySelector('.tutorial-source-highlight');
        const targetEl = document.querySelector('.tutorial-target-highlight');
        if (!sourceEl || !targetEl) return;

        const appEl = document.getElementById('app');
        if (!appEl) return;
        const appRect = appEl.getBoundingClientRect();
        const srcRect = sourceEl.getBoundingClientRect();
        const tgtRect = targetEl.getBoundingClientRect();

        const srcX = (srcRect.left + srcRect.width / 2) - appRect.left;
        const srcY = srcRect.bottom - appRect.top;
        const tgtX = (tgtRect.left + tgtRect.width / 2) - appRect.left;
        const tgtY = tgtRect.top - appRect.top;

        const formulaEl = targetEl.querySelector('.hs-formula-tag');
        const formRect = formulaEl ? formulaEl.getBoundingClientRect() : null;
        const formCenterY = formRect ? (formRect.top + formRect.height / 2 - appRect.top) : (tgtY + 50);

        const banner = document.getElementById('tutorialGuideBanner');
        if (banner) {
            const runeBar = document.querySelector('.answer-runes-bar');
            if (runeBar) {
                const runeBarRect = runeBar.getBoundingClientRect();
                banner.style.left = `${appRect.width / 2}px`;
                banner.style.top = `${runeBarRect.top - appRect.top - 10}px`;
            } else {
                banner.style.left = `${srcX}px`;
                banner.style.top = `${srcY - 45}px`;
            }
        }

        const pathEl = document.getElementById('tutorialFlowPath');
        if (pathEl) {
            const startY = srcY + 1;
            const endY = formCenterY - 16;
            const ctrlX = (srcX + tgtX) / 2;
            const ctrlY = (startY + endY) / 2;
            pathEl.setAttribute('d', `M ${srcX} ${startY} Q ${ctrlX} ${ctrlY} ${tgtX} ${endY}`);
        }

        const pointer = document.getElementById('tutorialArrowPointer');
        if (pointer) {
            pointer.style.left = `${(srcX + tgtX) / 2}px`;
            pointer.style.top = `${srcY + 10}px`;
        }
    }

    // 한 턴(첫 문제 풀이 / 드롭 / 액션) 후 튜토리얼 화살표 소멸
    dismissTutorialGuide(immediate = false) {
        this.firstTurnTutorialDone = true;
        const overlay = document.getElementById('tutorialArrowOverlay');
        if (overlay) {
            if (immediate) {
                overlay.remove();
            } else {
                overlay.classList.add('tutorial-fade-out');
                setTimeout(() => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                }, 350);
            }
        }
        document.querySelectorAll('.tutorial-source-highlight, .tutorial-target-highlight').forEach(el => {
            el.classList.remove('tutorial-source-highlight', 'tutorial-target-highlight');
        });
    }

    // 2단계: 각성 완료된 카드를 전장 타일에 배치하는 사용법 튜토리얼 안내 (첫 배치 시 자동 소멸)
    showDeployTutorialGuide(card) {
        if (this.firstDeployTutorialDone) return;
        const prevOverlay = document.getElementById('tutorialDeployOverlay');
        if (prevOverlay) prevOverlay.remove();
        document.querySelectorAll('.tutorial-deploy-highlight').forEach(el => {
            el.classList.remove('tutorial-deploy-highlight');
        });

        const cardIdx = this.hand.indexOf(card);
        const cardEls = document.querySelectorAll('#problemHand .hs-card');
        const cardEl = cardEls[cardIdx];
        if (!cardEl) return;

        const appEl = document.getElementById('app');
        if (!appEl) return;

        cardEl.classList.add('tutorial-deploy-highlight');

        const overlay = document.createElement('div');
        overlay.id = 'tutorialDeployOverlay';
        overlay.className = 'tutorial-arrow-overlay';

        const actionVerb = card.isSpell ? '시전' : '배치';
        overlay.innerHTML = `
            <div id="tutorialDeployBanner" class="tutorial-guide-banner tutorial-deploy-banner">
                <span class="tutorial-pulse-icon">🚀</span>
                <span class="tutorial-guide-text"><strong>[${card.name || card.word}] 각성 완료!</strong> 타일을 터치하거나 위로 드래그하여 ${actionVerb}!</span>
            </div>
            <div id="tutorialDeployPointer" class="tutorial-deploy-pointer">
                <div class="tutorial-deploy-arrow">⬆️</div>
            </div>
        `;

        appEl.appendChild(overlay);
        this.updateDeployTutorialGuide();
    }

    updateDeployTutorialGuide() {
        if (this.firstDeployTutorialDone) return;
        const overlay = document.getElementById('tutorialDeployOverlay');
        if (!overlay) return;

        const cardEl = document.querySelector('.tutorial-deploy-highlight');
        if (!cardEl) return;

        const appEl = document.getElementById('app');
        if (!appEl) return;
        const appRect = appEl.getBoundingClientRect();
        const cardRect = cardEl.getBoundingClientRect();

        const cardCenterX = (cardRect.left + cardRect.width / 2) - appRect.left;
        const cardTopY = cardRect.top - appRect.top;

        const banner = document.getElementById('tutorialDeployBanner');
        if (banner) {
            banner.style.left = `${appRect.width / 2}px`;
            banner.style.top = `${cardTopY - 32}px`;
        }

        const pointer = document.getElementById('tutorialDeployPointer');
        if (pointer) {
            pointer.style.left = `${cardCenterX}px`;
            pointer.style.top = `${cardTopY - 8}px`;
        }
    }

    dismissDeployTutorialGuide(immediate = false) {
        this.firstDeployTutorialDone = true;
        const overlay = document.getElementById('tutorialDeployOverlay');
        if (overlay) {
            if (immediate) {
                overlay.remove();
            } else {
                overlay.classList.add('tutorial-fade-out');
                setTimeout(() => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                }, 350);
            }
        }
        document.querySelectorAll('.tutorial-deploy-highlight').forEach(el => {
            el.classList.remove('tutorial-deploy-highlight');
        });
    }

    drawCard() {
        if (this.hand.length >= this.maxHandSize) return;
        const curTierNum = (this.currentTier && this.currentTier.tier) ? this.currentTier.tier : 1;
        // [NEW] 티어가 승급되어도 1~하급 티어 카드들이 지속적으로 섞여 등장 (방어벽/궁수/타워 지속 보급)
        let chosenTier = 1;
        if (curTierNum === 1) {
            chosenTier = 1;
        } else if (curTierNum === 2) {
            chosenTier = Math.random() < 0.50 ? 2 : 1;
        } else {
            const roll = Math.random();
            if (roll < 0.40) {
                // 현재 도달한 최고 티어 카드 (40%)
                chosenTier = curTierNum;
            } else if (roll < 0.65) {
                // 직전 티어 카드 (25%)
                chosenTier = curTierNum - 1;
            } else {
                // 1티어부터 (현재티어 - 2)까지의 하급 티어 카드들이 골고루 섞여 등장 (35%)
                const minTier = 1;
                const maxTier = curTierNum - 2;
                chosenTier = minTier + Math.floor(Math.random() * (maxTier - minTier + 1));
            }
        }
        const card = window.mathEngine.createCard(chosenTier);
        this.hand.push(card);
        window.soundEngine.playCardDraw();
        this.refreshAnswerRack();
        this.renderHand();
    }

    // 카드 디스카드(버리기) 실행 메서드
    discardCard(card, cardEl) {
        if (!this.hand.includes(card)) return;

        this.dismissTutorialGuide();
        window.soundEngine.playDiscard();

        // 파티클 효과 (카드 위치에서 붉은 스파크 파티클 폭발)
        if (cardEl) {
            cardEl.classList.add('discarding');
            const rect = cardEl.getBoundingClientRect();
            const cRect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / cRect.width;
            const scaleY = this.canvas.height / cRect.height;
            const cx = (rect.left + rect.width / 2 - cRect.left) * scaleX;
            const cy = (rect.top + rect.height / 2 - cRect.top) * scaleY;

            for (let i = 0; i < 15; i++) {
                this.particles.push(new SparkParticle(cx, cy, '#ef4444'));
            }
        }

        const unitName = card.word || card.name || '카드';
        this.showToast(`🗑️ [${unitName}] 디스카드 완료`);

        setTimeout(() => {
            const idx = this.hand.indexOf(card);
            if (idx !== -1) {
                this.hand.splice(idx, 1);
            }
            this.drawCard();
        }, 220);
    }

    // 하단 수평 나란히(Side-by-Side) 문제 손패 렌더링 (회전 없음, 대형 수식, 아래로 끌어내려 디스카드)
    renderHand() {
        if (!this.handContainer) return;
        this.handContainer.innerHTML = '';

        this.hand.forEach((card) => {
            const cardEl = document.createElement('div');
            const isSelected = this.selectedCard === card;
            cardEl.className = `hs-card tier-${card.tier} ${card.charged ? 'charged' : ''} ${isSelected ? 'selected-card' : ''}`;
            cardEl.dataset.cardId = card.id;

            if (card.charged) {
                const durText = card.duration ? `⏱️${card.duration}s` : '즉시시전';
                // 이미 전투 유닛/무기/덧으로 변신 완료된 카드 (전장 배치 대기)
                cardEl.innerHTML = `
                    <div class="hs-mana-crystal">${card.tier}</div>
                    <div class="hs-ribbon-banner">${card.word}</div>
                    <div class="hs-portrait-frame">
                        <span>${card.icon}</span>
                    </div>
                    <div class="hs-desc-box">
                        <div class="hs-charged-tag">✨ ${card.name || card.word}</div>
                        <div class="hs-deploy-hint">${durText} / 👆터치·드래그 배치</div>
                    </div>
                    ${!card.isSpell ? `
                        <div class="hs-stat-gem attack">${card.damage || 0}</div>
                        <div class="hs-stat-gem health">${Math.round((card.hp || 100) / 10)}</div>
                    ` : ''}
                `;
                this.bindDeployDrag(cardEl, card);
            } else {
                // 상단 답안 룬 투하를 기다리는 문제 카드 (대형 수식 - '= ?' 제거 및 크기 대폭 확대)
                const rawQ = (card.problem && (card.problem.displayExpr || card.problem.question)) || '';
                const q = rawQ.replace(/\s*=\s*\?$/, '').trim();
                const isLong = q.length >= 11;
                const isMedium = q.length >= 8;
                const fontClass = isLong ? 'hs-formula-sm' : (isMedium ? 'hs-formula-md' : '');
                cardEl.innerHTML = `
                    <div class="hs-mana-crystal">${card.tier}</div>
                    <div class="hs-ribbon-banner" style="color: #38bdf8;">${card.word}</div>
                    <div class="hs-portrait-frame">
                        <span>${card.icon}</span>
                    </div>
                    <div class="hs-desc-box">
                        <div class="hs-formula-tag ${fontClass}">${q}</div>
                    </div>
                `;
                this.bindProblemCardDrag(cardEl, card);
            }

            cardEl.addEventListener('mouseenter', () => {
                if (!this.draggingCard) window.soundEngine.playCardHover();
            });

            this.handContainer.appendChild(cardEl);
        });

        // 튜토리얼 진행 중인 경우 하이라이트 및 화살표 위치 갱신
        if (!this.firstTurnTutorialDone) {
            requestAnimationFrame(() => this.updateTutorialArrowGuide());
        }
        if (!this.firstDeployTutorialDone) {
            requestAnimationFrame(() => this.updateDeployTutorialGuide());
        }
    }

    // 상단 답안 룬 드래그 ➔ 하단 문제 카드 드롭 합성 컨트롤러
    bindAnswerDrag(ansEl, ans) {
        let isDragging = false;
        let dragProxy = null;

        const startAction = (clientX, clientY) => {
            isDragging = true;
            window.soundEngine.playCardPick();
            ansEl.style.opacity = '0.3';

            // 불릿 타임 (5배 감속)
            this.isBulletTime = true;
            this.bulletTimeIndicator.classList.remove('hidden');
            window.soundEngine.playSlowEnter();

            // 튜토리얼 일시 반투명 처리
            const tutOverlay = document.getElementById('tutorialArrowOverlay');
            if (tutOverlay) tutOverlay.style.opacity = '0.15';

            // 답안 룬 드래그 프록시 생성
            dragProxy = document.createElement('div');
            dragProxy.className = 'hs-answer-drag-proxy';
            dragProxy.innerHTML = `
                <div class="answer-rune-badge">RUNE</div>
                <div class="answer-val-num">${ans.val}</div>
            `;
            dragProxy.style.left = `${clientX}px`;
            dragProxy.style.top = `${clientY}px`;
            document.body.appendChild(dragProxy);

            // 미해결 문제 카드들에 드롭 가이드 표시
            document.querySelectorAll('#problemHand .hs-card:not(.charged)').forEach(el => {
                el.classList.add('drop-zone-ready');
            });

            let lastX = clientX;
            let lastY = clientY;

            const onPointerMove = (moveEvent) => {
                if (!isDragging) return;
                if (moveEvent.cancelable) moveEvent.preventDefault();
                const curX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const curY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
                lastX = curX;
                lastY = curY;

                if (dragProxy) {
                    dragProxy.style.left = `${curX}px`;
                    dragProxy.style.top = `${curY}px`;
                }

                // 문제 카드와 충돌 판정 및 호버 하이라이트
                const elements = document.elementsFromPoint(curX, curY) || [];
                let hoveredCardEl = null;
                for (const el of elements) {
                    const found = el.closest && el.closest('.hs-card');
                    if (found && found.dataset.cardId) {
                        hoveredCardEl = found;
                        break;
                    }
                }

                document.querySelectorAll('#problemHand .hs-card').forEach(el => {
                    if (el === hoveredCardEl && !el.classList.contains('charged')) {
                        el.classList.add('drop-hover');
                    } else {
                        el.classList.remove('drop-hover');
                    }
                });
            };

            const onPointerUp = (upEvent) => {
                if (!isDragging) return;
                if (upEvent && upEvent.cancelable) upEvent.preventDefault();
                isDragging = false;
                window.removeEventListener('mousemove', onPointerMove);
                window.removeEventListener('mouseup', onPointerUp);
                window.removeEventListener('touchmove', onPointerMove);
                window.removeEventListener('touchend', onPointerUp);
                window.removeEventListener('touchcancel', onPointerUp);

                // 불릿 타임 해제
                this.isBulletTime = false;
                this.bulletTimeIndicator.classList.add('hidden');

                if (dragProxy) {
                    dragProxy.remove();
                    dragProxy = null;
                }
                ansEl.style.opacity = '1';

                const tutOverlay = document.getElementById('tutorialArrowOverlay');
                if (tutOverlay && !this.firstTurnTutorialDone) tutOverlay.style.opacity = '1';

                // 드롭 영역 하이라이트 해제
                document.querySelectorAll('#problemHand .hs-card').forEach(el => {
                    el.classList.remove('drop-zone-ready');
                    el.classList.remove('drop-hover');
                });

                // 마우스/터치를 놓은 위치의 문제 카드 감지
                const elements = document.elementsFromPoint(lastX, lastY) || [];
                let targetCardEl = null;
                for (const el of elements) {
                    const found = el.closest && el.closest('.hs-card');
                    if (found && found.dataset.cardId) {
                        targetCardEl = found;
                        break;
                    }
                }

                if (targetCardEl) {
                    const cardId = targetCardEl.dataset.cardId;
                    const problemCard = this.hand.find(c => c.id === cardId);
                    if (problemCard) {
                        this.handleAnswerDropOnProblem(ans, problemCard, targetCardEl);
                    }
                }
            };

            window.addEventListener('mousemove', onPointerMove);
            window.addEventListener('mouseup', onPointerUp);
            window.addEventListener('touchmove', onPointerMove, { passive: false });
            window.addEventListener('touchend', onPointerUp);
            window.addEventListener('touchcancel', onPointerUp);
        };

        ansEl.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startAction(e.clientX, e.clientY);
        });

        ansEl.addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            startAction(touch.clientX, touch.clientY);
        }, { passive: false });
    }

    // 답안 룬을 문제 카드에 드롭했을 때의 정답/오답 판정 (정답 ➔ 즉시 스킬 / 오답 ➔ 스코어 감점)
    // 답안 룬을 문제 카드에 드롭했을 때의 정답/오답 판정 (정답 ➔ 카드 각성 준비 완료 / 오답 ➔ 스코어 감점)
    handleAnswerDropOnProblem(ans, card, cardEl) {
        if (card.charged) {
            this.showToast('이미 준비 완료된 카드입니다! 원하는 타일로 드래그하세요.');
            return;
        }

        // 첫 턴 사용법 튜토리얼 화살표 소멸
        this.dismissTutorialGuide();

        const isValEqual = String(ans.val).trim() === String(card.problem.answer).trim();
        const isNumEqual = (ans.sortVal !== undefined && card.problem.answerNum !== undefined) && Math.abs(ans.sortVal - card.problem.answerNum) < 0.001;
        const isCorrect = isValEqual || isNumEqual;

        if (isCorrect) {
            // ★ 정답 ➔ 카드가 각성되어 전장 배치/시전 준비 완료 (자동배치 하지 않음!)
            card.charged = true;
            this.combo++;
            const earned = 100 * card.tier;
            this.score += earned;
            window.soundEngine.playCorrect();
            this.addScreenShake(0.35, 8);

            // 황금빛 파티클 폭발
            try {
                const rect = cardEl.getBoundingClientRect();
                const cvRect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / cvRect.width;
                const scaleY = this.canvas.height / cvRect.height;
                const px = (rect.left + rect.width / 2 - cvRect.left) * scaleX;
                const py = (rect.top + rect.height / 2 - cvRect.top) * scaleY;

                for (let i = 0; i < 25; i++) {
                    this.particles.push(new SparkParticle(px, py, '#facc15'));
                }
                this.particles.push(new TextParticle(px, py - 30, `정답! +${earned}점 ✨`, '#22c55e', true));
            } catch (e) {
                console.warn('Particle error:', e);
            }

            // 승급 체크
            this.checkTierPromotion();

            // 사용된 답안 룬 제거 및 랙 갱신
            const ansIdx = this.answerCards.indexOf(ans);
            if (ansIdx !== -1) {
                this.answerCards.splice(ansIdx, 1);
            }
            this.refreshAnswerRack();

            // 손패 리렌더링 (카드가 각성 완료 상태로 전환되어 플레이어의 수동 배치 대기)
            this.renderHand();

            // 2단계 전장 배치 안내 튜토리얼 화살표 가이드 호출
            if (!this.firstDeployTutorialDone) {
                setTimeout(() => this.showDeployTutorialGuide(card), 200);
            }

            const actionDesc = card.isSpell ? '전장 타일을 터치하거나 드래그하여 시전!' : '전장 타일을 터치하거나 드래그하여 소환!';
            this.showToast(`✨ [${card.name || card.word}] 준비 완료! ${actionDesc}`);
            this.updateHUD();
        } else {
            // ★ 오답 ➔ 스코어 깎임! (-50 * card.tier)
            const penalty = 50 * card.tier;
            this.score = Math.max(0, this.score - penalty);
            this.combo = 0;
            window.soundEngine.playWrong();

            // [NEW] 오답카드 합성 1회 할때마다 화면이 약하게 흔들림
            this.addScreenShake(0.35, 6);

            // [NEW] 아군의 지속시간 및 필드 유닛 체력이 10% 줄어듦
            let reducedCount = 0;
            if (this.towers && this.towers.length > 0) {
                this.towers.forEach(t => {
                    const dec = t.lifeTimer * 0.10;
                    t.lifeTimer = Math.max(0.1, t.lifeTimer - dec);
                    reducedCount++;
                    this.particles.push(new TextParticle(t.x, t.y - 30, `-10% ⏱️`, '#ef4444', true));
                    for (let i = 0; i < 4; i++) {
                        this.particles.push(new SparkParticle(t.x, t.y, '#f87171'));
                    }
                });
            }
            if (this.warriors && this.warriors.length > 0) {
                this.warriors.forEach(w => {
                    const dec = Math.max(1, Math.round(w.hp * 0.10));
                    w.hp = Math.max(1, w.hp - dec);
                    reducedCount++;
                    this.particles.push(new TextParticle(w.x, w.y - 20, `-10% HP`, '#ef4444', true));
                    for (let i = 0; i < 3; i++) {
                        this.particles.push(new SparkParticle(w.x, w.y, '#ef4444'));
                    }
                });
            }

            // 진동 애니메이션
            if (cardEl) {
                cardEl.classList.remove('wrong-shake');
                void cardEl.offsetWidth; // trigger reflow
                cardEl.classList.add('wrong-shake');
                setTimeout(() => cardEl.classList.remove('wrong-shake'), 420);
            }

            // 붉은색 오답 감점 파티클 & 토스트
            const cvRect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / cvRect.width;
            const scaleY = this.canvas.height / cvRect.height;
            let px = this.width / 2;
            let py = this.height - 120;
            if (cardEl) {
                const rect = cardEl.getBoundingClientRect();
                px = (rect.left + rect.width / 2 - cvRect.left) * scaleX;
                py = (rect.top + rect.height / 2 - cvRect.top) * scaleY;
            }

            for (let i = 0; i < 15; i++) {
                this.particles.push(new SparkParticle(px, py, '#ef4444'));
            }
            this.particles.push(new TextParticle(px, py - 30, `❌ 오답! -${penalty}점`, '#ef4444', true));
            if (reducedCount > 0) {
                this.showToast(`❌ 오답 페널티! (-${penalty}점 & 아군 지속시간 -10%)`);
            } else {
                this.showToast(`❌ 오답입니다! (-${penalty}점 감점)`);
            }

            this.checkTierPromotion();
            this.updateHUD();
        }
    }

    // 스코어 8단계 승급 여부 실시간 체크 및 레벨업 연출
    checkTierPromotion() {
        const newTierData = window.mathEngine.getTierData(this.score);
        if (newTierData.tier > this.lastTier) {
            this.lastTier = newTierData.tier;
            this.currentTier = newTierData;
            window.soundEngine.playFever();
            this.addScreenShake(0.6, 12);
            if (this.tierUpBanner) {
                this.tierUpBanner.textContent = `👑 TIER UP! [${newTierData.tier}단계: ${newTierData.name}] 승급! 👑`;
                this.tierUpBanner.classList.remove('hidden');
                setTimeout(() => {
                    if (this.tierUpBanner) this.tierUpBanner.classList.add('hidden');
                }, 2800);
            }
            this.showToast(`🎉 [${newTierData.tier}단계: ${newTierData.name}] 승급! 강력한 상위 연산 및 스킬 해금!`);
        } else if (newTierData.tier < this.lastTier) {
            this.lastTier = newTierData.tier;
            this.currentTier = newTierData;
        }
    }

    // 변신 완료된 유닛 카드를 전장 타일로 끌고 올라가 배치하거나, 아래로 끌어내려 디스카드하는 핸들러
    bindDeployDrag(cardEl, card) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let lastY = 0;
        let dragMode = null; // 'deploy' | 'discard'

        const startAction = (clientX, clientY) => {
            isDragging = true;
            startX = clientX;
            startY = clientY;
            lastY = clientY;
            dragMode = null;

            const onPointerMove = (moveEvent) => {
                if (!isDragging) return;
                if (moveEvent.cancelable) moveEvent.preventDefault();
                const curX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const curY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
                lastY = curY;
                const dy = curY - startY;
                const dx = curX - startX;

                if (!dragMode) {
                    if (dy > 14) {
                        dragMode = 'discard';
                        this.showDiscardZone(true);
                    } else if (dy < -12 || Math.hypot(dx, dy) > 20) {
                        dragMode = 'deploy';
                        this.draggingCard = card;
                        window.soundEngine.playCardPick();
                        this.createDragProxy(card, curX, curY);
                        cardEl.style.opacity = '0.3';
                    }
                }

                if (dragMode === 'discard') {
                    const pullY = Math.max(0, dy);
                    cardEl.style.transform = `translateY(${Math.min(pullY, 65)}px) scale(0.95)`;
                    if (pullY > 32) {
                        cardEl.classList.add('ready-to-discard');
                        this.updateDiscardZoneReady(true);
                    } else {
                        cardEl.classList.remove('ready-to-discard');
                        this.updateDiscardZoneReady(false);
                    }
                } else if (dragMode === 'deploy') {
                    if (this.dragProxyEl) {
                        this.dragProxyEl.style.left = `${curX}px`;
                        this.dragProxyEl.style.top = `${curY}px`;
                    }
                    const rect = this.canvas.getBoundingClientRect();
                    const scaleX = this.canvas.width / rect.width;
                    const scaleY = this.canvas.height / rect.height;
                    const canvasX = (curX - rect.left) * scaleX;
                    const canvasY = (curY - rect.top) * scaleY;
                    this.updateHoverCell(canvasX, canvasY);
                }
            };

            const onPointerUp = (upEvent) => {
                if (!isDragging) return;
                if (upEvent && upEvent.cancelable) upEvent.preventDefault();
                isDragging = false;
                window.removeEventListener('mousemove', onPointerMove);
                window.removeEventListener('mouseup', onPointerUp);
                window.removeEventListener('touchmove', onPointerMove);
                window.removeEventListener('touchend', onPointerUp);
                window.removeEventListener('touchcancel', onPointerUp);

                this.showDiscardZone(false);
                cardEl.classList.remove('ready-to-discard');

                if (dragMode === 'discard') {
                    const dy = lastY - startY;
                    if (dy > 32) {
                        this.discardCard(card, cardEl);
                        return;
                    } else {
                        cardEl.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        cardEl.style.transform = 'translateY(0)';
                        setTimeout(() => { cardEl.style.transition = ''; }, 200);
                    }
                } else if (dragMode === 'deploy') {
                    if (this.dragProxyEl) {
                        this.dragProxyEl.remove();
                        this.dragProxyEl = null;
                    }
                    cardEl.style.opacity = '1';

                    // 유효한 전장 타일 위에 드롭 시 즉시 소환!
                    if (this.hoverCell) {
                        const placed = this.deployCardToCell(card, this.hoverCell.lane, this.hoverCell.row);
                        if (placed) {
                            const idx = this.hand.indexOf(card);
                            if (idx !== -1) this.hand.splice(idx, 1);
                            this.renderHand();
                            setTimeout(() => this.drawCard(), 300);
                        }
                    } else {
                        this.renderHand();
                    }

                    this.draggingCard = null;
                    this.hoverCell = null;
                } else {
                    cardEl.style.transform = 'translateY(0)';
                    // [NEW] 터치 또는 클릭 시 카드 선택 토글 (클릭/터치 배치 지원)
                    if (this.selectedCard === card) {
                        this.selectedCard = null;
                        this.hoverCell = null;
                        this.showToast('카드 선택을 해제했습니다.');
                    } else {
                        this.selectedCard = card;
                        window.soundEngine.playCardPick();
                        const actionDesc = card.isSpell ? '시전할 전장 타일을 터치하세요!' : '소환할 전장 타일을 터치하세요!';
                        this.showToast(`✨ [${card.name || card.word}] 선택됨 - ${actionDesc}`);
                    }
                    this.renderHand();
                }
            };

            window.addEventListener('mousemove', onPointerMove);
            window.addEventListener('mouseup', onPointerUp);
            window.addEventListener('touchmove', onPointerMove, { passive: false });
            window.addEventListener('touchend', onPointerUp);
            window.addEventListener('touchcancel', onPointerUp);
        };

        cardEl.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startAction(e.clientX, e.clientY);
        });

        cardEl.addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            startAction(touch.clientX, touch.clientY);
        }, { passive: false });
    }

    // 미완성 문제 카드를 아래로 끌어내려 디스카드하거나 터치 시 안내하는 핸들러
    bindProblemCardDrag(cardEl, card) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let lastY = 0;
        let lastX = 0;

        const startAction = (clientX, clientY) => {
            isDragging = true;
            startX = clientX;
            startY = clientY;
            lastX = clientX;
            lastY = clientY;

            const onPointerMove = (moveEvent) => {
                if (!isDragging) return;
                if (moveEvent.cancelable) moveEvent.preventDefault();
                const curX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const curY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
                lastX = curX;
                lastY = curY;
                const dy = curY - startY;

                if (dy > 12) {
                    this.showDiscardZone(true);
                    const pullY = Math.max(0, dy);
                    cardEl.style.transform = `translateY(${Math.min(pullY, 65)}px) scale(0.95)`;
                    if (pullY > 32) {
                        cardEl.classList.add('ready-to-discard');
                        this.updateDiscardZoneReady(true);
                    } else {
                        cardEl.classList.remove('ready-to-discard');
                        this.updateDiscardZoneReady(false);
                    }
                } else if (dy < -10) {
                    // 위로 끌면 가벼운 저항감 표현
                    cardEl.style.transform = `translateY(${Math.max(dy * 0.25, -15)}px)`;
                    this.showDiscardZone(false);
                } else {
                    cardEl.style.transform = 'none';
                    this.showDiscardZone(false);
                }
            };

            const onPointerUp = (upEvent) => {
                if (!isDragging) return;
                if (upEvent && upEvent.cancelable) upEvent.preventDefault();
                isDragging = false;
                window.removeEventListener('mousemove', onPointerMove);
                window.removeEventListener('mouseup', onPointerUp);
                window.removeEventListener('touchmove', onPointerMove);
                window.removeEventListener('touchend', onPointerUp);
                window.removeEventListener('touchcancel', onPointerUp);

                this.showDiscardZone(false);
                cardEl.classList.remove('ready-to-discard');

                const dy = lastY - startY;
                const dist = Math.hypot(lastX - startX, lastY - startY);

                if (dy > 32) {
                    // 아래로 충분히 끌어내려 디스카드 확정!
                    this.discardCard(card, cardEl);
                } else {
                    cardEl.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    cardEl.style.transform = 'translateY(0)';
                    setTimeout(() => { cardEl.style.transition = ''; }, 200);

                    // 단순 탭 / 클릭인 경우 안내 토스트 노출
                    if (dist < 10) {
                        this.showToast('💡 상단 [답안 룬]을 이 카드로 드래그하세요! (↓ 아래로 끌면 버리기)');
                        window.soundEngine.playCardPick();
                    }
                }
            };

            window.addEventListener('mousemove', onPointerMove);
            window.addEventListener('mouseup', onPointerUp);
            window.addEventListener('touchmove', onPointerMove, { passive: false });
            window.addEventListener('touchend', onPointerUp);
            window.addEventListener('touchcancel', onPointerUp);
        };

        cardEl.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startAction(e.clientX, e.clientY);
        });

        cardEl.addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            startAction(touch.clientX, touch.clientY);
        }, { passive: false });
    }

    createDragProxy(card, x, y) {
        if (this.dragProxyEl) this.dragProxyEl.remove();
        const proxy = document.createElement('div');
        proxy.className = `hs-card tier-${card.tier} charged hs-drag-proxy`;
        proxy.style.left = `${x}px`;
        proxy.style.top = `${y}px`;

        const durText = card.duration ? ` (⏱️ ${card.duration}초 지속)` : '';
        proxy.innerHTML = `
            <div class="hs-mana-crystal">${card.tier}</div>
            <div class="hs-ribbon-banner">${card.word}</div>
            <div class="hs-portrait-frame"><span>${card.icon}</span></div>
            <div class="hs-desc-box">
                <div class="hs-charged-tag">✨ ${card.name || card.word}!</div>
                <div style="font-size: 8px; color: #38bdf8; margin-top:2px;">전장 타일로 드래그!${durText}</div>
            </div>
            ${!card.isSpell ? `
                <div class="hs-stat-gem attack">${card.damage || 0}</div>
                <div class="hs-stat-gem health">${Math.round((card.hp || 100) / 10)}</div>
            ` : ''}
        `;
        document.body.appendChild(proxy);
        this.dragProxyEl = proxy;
    }

    deployCardToCell(card, lane, row) {
        this.dismissTutorialGuide();
        this.dismissDeployTutorialGuide();
        if (card.isSpell) {
            this.castSpell(card, lane, row);
            window.soundEngine.playCardSlam();
            return true;
        }

        // [NEW] x2 배수/강화 카드 (보드 위의 타워/유닛에 심어주면 발동)
        if (card.isBuff || card.type === 'buff') {
            const cellCenter = this.grid.getCellCenter(lane, row);
            const targetTowers = this.towers.filter(t => t.lane === lane && t.row === row);

            // 필드 위를 통과 중인 아군 유닛 탐색 (해당 레인 & 셀 중심 반경 55px 이내)
            const targetWarrior = (this.warriors || []).find(w => w.lane === lane && !w.dead && Math.abs(w.y - cellCenter.y) < 55);

            if (targetTowers.length === 0 && !targetWarrior) {
                this.showToast('강화할 유닛/타워 위에 배치해주세요!');
                return false;
            }

            // 1) 필드 위 모바일 아군 유닛 직접 장착 (타워가 없는 타일이거나 유닛을 직접 타겟팅)
            if (targetTowers.length === 0 && targetWarrior) {
                targetWarrior.buffCount = (targetWarrior.buffCount || 0) + 1;
                if (targetWarrior.buffCount > 3) {
                    this.showToast('더 이상 강화할 수 없습니다! (최대 3개 중첩)');
                    return false;
                }
                targetWarrior.hasArmor = true;
                targetWarrior.hp += 200;
                targetWarrior.maxHp += 200;
                targetWarrior.damage = Math.round(targetWarrior.damage * 1.5);
                window.soundEngine.playFever();
                this.particles.push(new TextParticle(targetWarrior.x, targetWarrior.y - 30, `⚡ x2 ARMOR UP! (${targetWarrior.buffCount}/3)`, '#facc15', true));
                for (let i = 0; i < 20; i++) {
                    this.particles.push(new SparkParticle(targetWarrior.x, targetWarrior.y, '#f59e0b'));
                }
                this.showToast(`⚡ [아군 ${targetWarrior.unitType || '전사'}] 황금 갑옷 장착 & 체력/공격력 대폭 강화!`);
                return true;
            }

            // 2) 타워 / 벙커 / 스포너 건물 장착
            const target = targetTowers.find(t => t.type !== 'trap' && t.type !== 'trap_lurker') || targetTowers[0];
            target.buffCount = target.buffCount || 0;
            if (target.buffCount >= 3) {
                this.showToast('더 이상 강화할 수 없습니다! (최대 3개 중첩)');
                return false;
            }
            target.buffCount += 1;

            // 남은 지속시간 증가 (TANK, WALL, TESLA, MORTAR, TITAN: 50%, 기타 유닛: 30%)
            const durRate = ['tank', 'defense', 'tesla', 'mortar', 'titan'].includes(target.type) ? 0.50 : 0.30;
            target.lifeTimer += target.lifeTimer * durRate;
            target.maxLifeTime = Math.max(target.maxLifeTime, target.lifeTimer);

            // SNIPER, ARCHER, MORTAR: 부채꼴 x2 발사
            if (['sniper', 'archer', 'mortar'].includes(target.type)) {
                target.fanShot = (target.fanShot || 1) * 2;
            }

            // KNIGHT(벙커) 및 모든 아군 스포너: 향후 스폰 유닛 갑옷 장착 & 현재 레인의 행군 중인 유닛들에게 즉시 갑옷 및 체력/공격력 전파
            if (target.type === 'knight' || (target.card && target.card.isBunker) || target.type.startsWith('spawner_')) {
                target.hasArmor = true;
                if (this.warriors) {
                    this.warriors.filter(w => w.lane === target.lane && !w.dead).forEach(w => {
                        w.hasArmor = true;
                        w.hp += 150;
                        w.maxHp += 150;
                        w.damage = Math.round(w.damage * 1.4);
                        this.particles.push(new TextParticle(w.x, w.y - 25, `⚡ ARMOR!`, '#facc15', true));
                        for (let i = 0; i < 8; i++) {
                            this.particles.push(new SparkParticle(w.x, w.y, '#fbbf24'));
                        }
                    });
                }
            }

            // PALADIN: 갑옷 착용 및 체력/공격력 증가
            if (target.type === 'paladin') {
                target.hasArmor = true;
                target.hp = Math.round(target.hp * 1.5);
                target.maxHp = Math.round(target.maxHp * 1.5);
                target.damage = Math.round(target.damage * 1.5);
            }

            const pos = this.grid.getCellCenter(lane, row);
            window.soundEngine.playFever();
            this.particles.push(new TextParticle(pos.x, pos.y - 30, `⚡ x2 POWER UP! (중첩 ${target.buffCount}/3)`, '#facc15', true));
            for (let i = 0; i < 20; i++) {
                this.particles.push(new SparkParticle(pos.x, pos.y, '#f59e0b'));
            }
            this.showToast(`⚡ [${target.card.name || target.card.word}] x2 강화 완료! (중첩 ${target.buffCount}/3)`);
            return true;
        }

        // [NEW] WALL / WALL+2 좌우 확장 방벽 설치
        if (card.type === 'defense' && card.wallSpread) {
            const spread = card.wallSpread; // 1 (WALL) or 2 (WALL+2)
            const minLane = Math.max(0, lane - spread);
            const maxLane = Math.min(this.grid.lanes - 1, lane + spread);

            // 중앙 셀에 이미 방어벽이 있는지 확인
            const centerOccupied = this.towers.some(t => t.lane === lane && t.row === row && t.type === 'defense');
            if (centerOccupied) {
                this.showToast('해당 타일에 이미 방어벽이 구축되어 있습니다!');
                return false;
            }

            let placedCount = 0;
            for (let l = minLane; l <= maxLane; l++) {
                const cellHasDefense = this.towers.some(t => t.lane === l && t.row === row && t.type === 'defense');
                if (!cellHasDefense) {
                    const wallTower = new Tower(l, row, card, this.grid);
                    this.towers.push(wallTower);
                    placedCount++;
                    const pos = this.grid.getCellCenter(l, row);
                    for (let i = 0; i < 10; i++) {
                        this.particles.push(new SparkParticle(pos.x, pos.y, '#38bdf8'));
                    }
                }
            }

            window.soundEngine.playCardSlam();
            window.soundEngine.playDeploy();
            this.addScreenShake(0.4, 10);

            if (card.healBase) {
                this.castleHp = Math.min(this.maxCastleHp, this.castleHp + card.healBase);
                const centerPos = this.grid.getCellCenter(lane, row);
                this.particles.push(new TextParticle(centerPos.x, centerPos.y - 45, `+${card.healBase} HP REPAIR!`, '#10b981', true));
            }

            const centerPos = this.grid.getCellCenter(lane, row);
            this.particles.push(new TextParticle(centerPos.x, centerPos.y - 25, `${card.word}!`, '#f8fafc', true));
            this.showToast(`🛡️ [${card.name || card.word}] ${placedCount}칸 방벽 전개! (+${card.healBase || 0} HP 수리)`);
            return true;
        }

        // 공존 배치 규칙 (방어벽은 아군에게 영향을 주지 않음 & 덫은 바닥 오브젝트)
        // 레이어 분류: 'defense'(방어벽), 'trap'(바닥 덫 및 럴커), 'unit'(일반 아군 유닛)
        const getLayer = (c) => {
            if (c.type === 'defense') return 'defense';
            if (c.type === 'trap' || c.type === 'trap_lurker' || c.isTrap) return 'trap';
            return 'unit';
        };

        const targetLayer = getLayer(card);
        const cellTowers = this.towers.filter(t => t.lane === lane && t.row === row);
        const duplicateInLayer = cellTowers.some(t => getLayer(t) === targetLayer);

        if (duplicateInLayer) {
            if (targetLayer === 'defense') {
                this.showToast('해당 타일에 이미 방어벽이 구축되어 있습니다!');
            } else if (targetLayer === 'trap') {
                this.showToast('해당 타일에 이미 덫이 설치되어 있습니다!');
            } else {
                this.showToast('해당 타일에 이미 아군 유닛이 배치되어 있습니다!');
            }
            return false;
        }

        const newTower = new Tower(lane, row, card, this.grid);
        this.towers.push(newTower);
        window.soundEngine.playCardSlam();
        window.soundEngine.playDeploy();
        this.addScreenShake(0.35, 8);

        const pos = this.grid.getCellCenter(lane, row);

        if (card.healBase) {
            this.castleHp = Math.min(this.maxCastleHp, this.castleHp + card.healBase);
            this.particles.push(new TextParticle(pos.x, pos.y - 45, `+${card.healBase} HP REPAIR!`, '#10b981', true));
        }

        for (let i = 0; i < 20; i++) {
            this.particles.push(new SparkParticle(pos.x, pos.y, card.tier === 3 ? '#facc15' : '#38bdf8'));
        }
        this.particles.push(new TextParticle(pos.x, pos.y - 25, `${card.word}!`, '#f8fafc', true));
        const dur = card.duration || 45;
        this.showToast(`🛡️ [${card.name || card.word}] 소환 완료! (지속 ${dur}초)`);
        return true;
    }

    triggerFever() {
        this.fever = true;
        this.feverTimer = this.maxFeverTime;
        window.soundEngine.playFever();
        const center = this.grid.getCellCenter(2, 2);
        this.particles.push(new TextParticle(center.x, center.y - 40, '🔥 FEVER TIME! 2x POWER 🔥', '#f59e0b', true));
    }

    castSpell(card, lane, row) {
        const center = this.grid.getCellCenter(lane, row);

        if (card.type === 'spell_lightning') {
            window.soundEngine.playShoot();
            this.addScreenShake(0.4, 10);
            this.particles.push(new TextParticle(center.x, center.y - 30, '⚡ CHAIN LIGHTNING! ⚡', '#facc15', true));
            const targets = this.monsters.filter(m => m.hp > 0)
                .sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y))
                .slice(0, card.chainCount || 8);
            targets.forEach(m => {
                m.takeDamage(card.damage || 180, this.particles, 'crit');
                for (let i = 0; i < 6; i++) {
                    this.particles.push(new SparkParticle(m.x, m.y, '#facc15'));
                }
            });
        } else if (card.type === 'spell_bomb') {
            window.soundEngine.playExplosion();
            this.addScreenShake(0.5, 14);
            for (let i = 0; i < 35; i++) {
                this.particles.push(new SparkParticle(center.x, center.y, '#f97316'));
            }
            this.particles.push(new TextParticle(center.x, center.y - 30, 'METEOR BOOM!', '#f97316', true));

            this.monsters.forEach(m => {
                const dist = Math.hypot(m.x - center.x, m.y - center.y);
                if (dist <= 190 && m.hp > 0) {
                    m.takeDamage(card.damage || 450, this.particles, 'crit');
                }
            });
        } else if (card.type === 'spell_blizzard') {
            window.soundEngine.playFreeze();
            this.addScreenShake(0.3, 6);
            this.particles.push(new TextParticle(this.width / 2, this.height / 2 - 80, '❄️ BLIZZARD FREEZE! ❄️', '#38bdf8', true));

            this.monsters.forEach(m => {
                m.applyFreeze(card.freezeDuration || 4.5);
                m.takeDamage(card.damage || 180, this.particles);
            });
        } else if (card.type === 'spell_valkyrie') {
            window.soundEngine.playShoot();
            this.addScreenShake(0.4, 12);
            this.particles.push(new TextParticle(center.x, center.y - 30, '⚔️ VALKYRIE CHARGE! ⚔️', '#f43f5e', true));
            this.monsters.forEach(m => {
                if (Math.abs(m.lane - lane) <= 1 && m.hp > 0) {
                    m.takeDamage(card.damage || 400, this.particles, 'crit');
                    for (let i = 0; i < 8; i++) {
                        this.particles.push(new SparkParticle(m.x, m.y, '#fb7185'));
                    }
                }
            });
        } else if (card.type === 'spell_orbital') {
            window.soundEngine.playExplosion();
            this.addScreenShake(0.6, 16);
            this.particles.push(new TextParticle(center.x, center.y - 30, '🛸 ORBITAL BOMBARDMENT! 🛸', '#06b6d4', true));
            this.monsters.forEach(m => {
                if (Math.abs(m.lane - lane) <= 1 && m.hp > 0) {
                    m.takeDamage(card.damage || 650, this.particles, 'crit');
                    for (let i = 0; i < 10; i++) {
                        this.particles.push(new SparkParticle(m.x, m.y, '#22d3ee'));
                    }
                }
            });
        } else if (card.type === 'spell_dragon') {
            window.soundEngine.playExplosion();
            this.addScreenShake(0.6, 18);
            this.particles.push(new TextParticle(this.width / 2, this.height / 2 - 60, '🐉 DRAGON BREATH! 🐉', '#ef4444', true));
            this.monsters.forEach(m => {
                if (m.hp > 0) {
                    m.takeDamage(card.damage || 750, this.particles, 'crit');
                    for (let i = 0; i < 6; i++) {
                        this.particles.push(new SparkParticle(m.x, m.y, '#f97316'));
                    }
                }
            });
        } else if (card.type === 'spell_volcano') {
            window.soundEngine.playExplosion();
            this.addScreenShake(0.7, 20);
            this.particles.push(new TextParticle(this.width / 2, this.height / 2 - 60, '🌋 VOLCANO ERUPTION! 🌋', '#ea580c', true));
            this.monsters.forEach(m => {
                if (m.hp > 0) {
                    m.takeDamage(card.damage || 1100, this.particles, 'crit');
                    for (let i = 0; i < 8; i++) {
                        this.particles.push(new SparkParticle(m.x, m.y, '#f97316'));
                    }
                }
            });
        } else if (card.type === 'spell_divine') {
            window.soundEngine.playFever();
            this.addScreenShake(0.3, 8);
            const heal = card.healBase || 35;
            this.castleHp = Math.min(this.maxCastleHp, this.castleHp + heal);
            this.particles.push(new TextParticle(this.width / 2, this.height / 2 - 60, `✨ DIVINE SANCTUARY! +${heal} HP ✨`, '#10b981', true));
            this.monsters.forEach(m => {
                if (m.hp > 0) {
                    m.y = Math.max(-40, m.y - (card.pushBack || 220));
                    for (let i = 0; i < 5; i++) {
                        this.particles.push(new SparkParticle(m.x, m.y, '#34d399'));
                    }
                }
            });
        } else if (card.type === 'spell_apocalypse') {
            window.soundEngine.playExplosion();
            window.soundEngine.playFever();
            this.addScreenShake(0.8, 24);
            this.particles.push(new TextParticle(this.width / 2, this.height / 2 - 60, '👑 APOCALYPSE JUDGMENT! 👑', '#fbbf24', true));
            this.monsters.forEach(m => {
                if (m.hp > 0) {
                    m.takeDamage(card.damage || 2800, this.particles, 'crit');
                    for (let i = 0; i < 12; i++) {
                        this.particles.push(new SparkParticle(m.x, m.y, '#fef08a'));
                    }
                }
            });
        } else if (card.type === 'spell_timestop') {
            window.soundEngine.playFreeze();
            this.addScreenShake(0.3, 8);
            this.particles.push(new TextParticle(this.width / 2, this.height / 2 - 60, '⏳ CHRONOS TIME STOP! ⏳', '#a855f7', true));
            this.monsters.forEach(m => {
                if (m.hp > 0) {
                    m.applyFreeze(card.duration || 6.0);
                    for (let i = 0; i < 5; i++) {
                        this.particles.push(new SparkParticle(m.x, m.y, '#c084fc'));
                    }
                }
            });
        }
    }

    addScreenShake(time, intensity) {
        this.shakeTimer = time;
        this.shakeIntensity = intensity;
    }

    showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'game-toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1800);
    }

    loop(timestamp) {
        if (this.state !== 'PLAYING') return;

        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        if (dt > 0.1) dt = 0.1;

        const effectiveDt = this.isBulletTime ? dt * this.bulletTimeScale : dt;

        this.update(effectiveDt, dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt, realDt) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= realDt;
        }

        // 킬 스트릭 타이머 감쇠
        if (this.killStreakTimer > 0) {
            this.killStreakTimer -= dt;
            if (this.killStreakTimer <= 0) {
                this.killStreak = 0;
            }
        }

        if (this.fever) {
            this.feverTimer -= dt;
            if (this.feverTimer <= 0) {
                this.fever = false;
                this.feverTimer = 0;
            }
        }

        this.updateSurvivalSpawns(dt);

        this.towers.forEach(t => t.update(dt, this.monsters, this.projectiles, this.fever, this.warriors));
        this.towers = this.towers.filter(t => {
            if (t.hp <= 0) {
                if (t.expired) {
                    for (let i = 0; i < 10; i++) {
                        this.particles.push(new SparkParticle(t.x, t.y, '#94a3b8'));
                    }
                    this.particles.push(new TextParticle(t.x, t.y - 20, '⏳ 지속시간 만료', '#94a3b8', false));
                } else {
                    for (let i = 0; i < 12; i++) {
                        this.particles.push(new SparkParticle(t.x, t.y, '#ef4444'));
                    }
                }
                return false;
            }
            return true;
        });

        // [NEW] 벙커 출격 전사(Warrior) 업데이트 및 전투/소멸 처리 (방벽 비간섭)
        if (this.warriors && this.warriors.length > 0) {
            this.warriors.forEach(w => w.update(dt, this.monsters, this.particles, this.projectiles, this.towers, this.warriors));
            this.warriors = this.warriors.filter(w => !w.dead && w.hp > 0);
        }

        // 몬스터 업데이트 & 1인칭 피격
        this.monsters.forEach(m => {
            m.update(dt, this.towers, this.particles);

            // 성벽(플레이어 코앞 Y: this.rampartY) 침공 시 1인칭 공격 발생!
            const hitY = this.rampartY || (this.height - 80);
            if (m.y >= hitY && m.hp > 0) {
                this.castleHp -= m.damage;
                m.hp = 0;
                window.soundEngine.playExplosion();
                this.addScreenShake(0.5, 14);

                if (this.damageFlashEl) {
                    this.damageFlashEl.classList.add('active');
                    setTimeout(() => this.damageFlashEl.classList.remove('active'), 250);
                }

                this.particles.push(new TextParticle(m.x, hitY - 20, `DIRECT HIT! -${m.damage}`, '#ef4444', true));
                if (this.castleHp <= 0) {
                    this.castleHp = 0;
                    this.gameOver();
                }
            }
        });

        // 몬스터 처치 및 라스트워 스타일 킬 스트릭 정산
        this.monsters = this.monsters.filter(m => {
            if (m.hp <= 0) {
                this.score += m.score;
                this.killStreak++;
                this.killStreakTimer = 2.2;

                this.checkKillStreak(this.killStreak, m.x, m.y);

                // 처치 팝핑 스파크 파티클
                for (let i = 0; i < 4; i++) {
                    this.particles.push(new SparkParticle(m.x, m.y, '#facc15'));
                }
                return false;
            }
            return true;
        });

        this.projectiles.forEach(p => p.update(dt, this.monsters, this.particles));
        this.projectiles = this.projectiles.filter(p => !p.dead);

        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.life > 0);

        this.updateHUD();
    }

    checkKillStreak(streak, x, y) {
        if (streak === 10) {
            this.particles.push(new TextParticle(this.width / 2, 280, '🔥 10x MULTI-KILL! 🔥', '#f59e0b', true));
            this.addScreenShake(0.25, 5);
            window.soundEngine.playTone(550, 'triangle', 0.15, 0.2, 0.01);
        } else if (streak === 25) {
            this.particles.push(new TextParticle(this.width / 2, 260, '⚡ 25x MASSACRE!! ⚡', '#ec4899', true));
            this.addScreenShake(0.35, 8);
            window.soundEngine.playTone(750, 'square', 0.2, 0.25, 0.01);
        } else if (streak === 50) {
            this.particles.push(new TextParticle(this.width / 2, 240, '💥 50x RAMPAGE!!! 💥', '#ef4444', true));
            this.addScreenShake(0.5, 12);
            this.triggerFever();
        } else if (streak === 100) {
            this.particles.push(new TextParticle(this.width / 2, 220, '👑 100x GODLIKE UNSTOPPABLE!! 👑', '#facc15', true));
            this.addScreenShake(0.7, 16);
            window.soundEngine.playFever();
        }
    }

    updateSurvivalSpawns(dt) {
        this.survivalTime += dt;

        // 1. [요구사항 1] 10분(600초) 도달 시 즉시 방어 성공(클리어) 종료 판정
        if (this.survivalTime >= 600 && this.state === 'PLAYING') {
            this.survivalTime = 600;
            this.updateHUD();
            this.victory();
            return;
        }

        const minute = Math.floor(this.survivalTime / 60);

        // 2. [요구사항 3] 매 1분마다 보스 출현 (5분 이후부터는 다중 보스러쉬로 전환)
        if (minute >= 1 && !this.bossesSpawned[minute]) {
            this.bossesSpawned[minute] = true;
            if (minute >= 5) {
                this.spawnBossRush(minute);
            } else {
                this.spawnMinuteBoss(minute);
            }
        }

        // 3. [요구사항 2] 5분(300초) 이후 매 30초마다 몬스터 스폰량 1.2배 복리 증가 알림
        if (this.survivalTime >= 300) {
            const currentStep = Math.floor((this.survivalTime - 300) / 30);
            if (currentStep > this.lastStep30s) {
                this.lastStep30s = currentStep;
                const multiplier = Math.pow(1.2, currentStep).toFixed(2);
                const toastMsg = `⚠️ [위험도 급상승] 몬스터 군단 출현량 ${multiplier}배 증가!`;
                this.particles.push(new TextParticle(this.width / 2, 210, toastMsg, '#f59e0b', true));
                this.addScreenShake(0.6, 12);
                window.soundEngine.playCombo();
                this.showToast(toastMsg);
            }
        }

        // 시작 4.5초 준비 시간 (Grace Period)
        if (this.survivalTime < 4.5) {
            return;
        }

        this.spawnTimer += dt;

        // 1분 단위 스폰 주기 가속
        // 0분대: ~4.2초, 1분대: ~3.4초, 2분대: ~2.8초, 3분대: ~2.2초, 4분대: ~1.8초, 5분대 이상: ~1.35초
        let baseInterval = 4.2;
        if (minute === 1) baseInterval = 3.4;
        else if (minute === 2) baseInterval = 2.8;
        else if (minute === 3) baseInterval = 2.2;
        else if (minute === 4) baseInterval = 1.8;
        else if (minute >= 5) baseInterval = 1.35;

        if (this.spawnTimer >= baseInterval) {
            this.spawnTimer = 0;
            this.spawnSurvivalHorde(minute);
        }
    }

    spawnMinuteBoss(minute) {
        window.soundEngine.playFever();
        this.addScreenShake(0.8, 16);

        let bossType = 'boss';
        let bossName = '수학 거신 골렘';
        if (minute === 1) {
            bossType = 'boss';
            bossName = '수학 거신 골렘 (1분 보스)';
        } else if (minute === 2) {
            bossType = 'boss_warlord';
            bossName = '다크 오크 워로드 (2분 보스)';
        } else if (minute === 3) {
            bossType = 'boss_dragon';
            bossName = '인페르노 드래곤 (3분 보스)';
        } else if (minute === 4) {
            bossType = 'boss_lich';
            bossName = '심연의 네크로맨서 (4분 보스)';
        } else {
            bossType = 'boss_apocalypse';
            bossName = `아포칼립스 파괴신 (${minute}분 보스)`;
        }

        // 보스 출현 알림 배너
        if (this.bossAlertBanner) {
            this.bossAlertBanner.textContent = `🚨 [${minute}:00 경과] 보스 [${bossName}] 출현! 🚨`;
            this.bossAlertBanner.classList.remove('hidden');
            setTimeout(() => {
                if (this.bossAlertBanner) this.bossAlertBanner.classList.add('hidden');
            }, 3200);
        }

        const lane = Math.floor(this.grid.lanes / 2);
        this.monsters.push(new Monster(lane, bossType, minute, this.grid));
    }

    // [요구사항 3] 플레이타임 5분 이후 매 1분마다 다중 보스러쉬 (BOSS RUSH)
    spawnBossRush(minute) {
        window.soundEngine.playFever();
        this.addScreenShake(1.0, 20);

        // 보스러쉬 전용 긴급 경보 배너
        if (this.bossAlertBanner) {
            this.bossAlertBanner.textContent = `🚨 [${minute}:00 경고] 대재앙 다중 보스 러쉬(BOSS RUSH) 발동!! 🚨`;
            this.bossAlertBanner.classList.remove('hidden');
            setTimeout(() => {
                if (this.bossAlertBanner) this.bossAlertBanner.classList.add('hidden');
            }, 3600);
        }

        let rushConfigs = [];
        if (minute === 5) {
            // 5분 보스러쉬: 3개 레인 (골렘, 워로드, 드래곤)
            rushConfigs = [
                { lane: 1, type: 'boss' },
                { lane: 2, type: 'boss_warlord' },
                { lane: 3, type: 'boss_dragon' }
            ];
        } else if (minute === 6) {
            // 6분 보스러쉬: 3개 레인 (워로드, 드래곤, 네크로맨서)
            rushConfigs = [
                { lane: 0, type: 'boss_warlord' },
                { lane: 2, type: 'boss_dragon' },
                { lane: 4, type: 'boss_lich' }
            ];
        } else if (minute === 7) {
            // 7분 보스러쉬: 4개 레인 (골렘, 드래곤, 네크로맨서, 아포칼립스)
            rushConfigs = [
                { lane: 0, type: 'boss' },
                { lane: 1, type: 'boss_dragon' },
                { lane: 3, type: 'boss_lich' },
                { lane: 4, type: 'boss_apocalypse' }
            ];
        } else if (minute === 8) {
            // 8분 보스러쉬: 4개 레인 (워로드, 드래곤, 네크로맨서, 아포칼립스)
            rushConfigs = [
                { lane: 0, type: 'boss_warlord' },
                { lane: 1, type: 'boss_dragon' },
                { lane: 2, type: 'boss_lich' },
                { lane: 4, type: 'boss_apocalypse' }
            ];
        } else {
            // 9분 이상 파이널 보스러쉬: 5개 전 레인 총출격
            rushConfigs = [
                { lane: 0, type: 'boss_warlord' },
                { lane: 1, type: 'boss_dragon' },
                { lane: 2, type: 'boss_apocalypse' },
                { lane: 3, type: 'boss_lich' },
                { lane: 4, type: 'boss' }
            ];
        }

        rushConfigs.forEach(cfg => {
            if (cfg.lane < this.grid.lanes) {
                this.monsters.push(new Monster(cfg.lane, cfg.type, minute, this.grid));
            }
        });
        this.showToast(`🚨 [${minute}:00] 대재앙 다중 보스러쉬 시작! 🚨`);
    }

    spawnSurvivalHorde(minute) {
        const lane = Math.floor(Math.random() * this.grid.lanes);
        const secondLane = (lane + 1 + Math.floor(Math.random() * (this.grid.lanes - 1))) % this.grid.lanes;
        const thirdLane = (lane + 2 + Math.floor(Math.random() * (this.grid.lanes - 2))) % this.grid.lanes;

        if (minute === 0) {
            // 0분대: 좀비 러너 2~3마리, 가끔 고블린
            this.spawnMonsterSwarm('minion', lane, Math.random() < 0.5 ? 2 : 3, minute);
            if (Math.random() < 0.3) this.spawnMonsterSwarm('goblin', secondLane, 1, minute);
        } else if (minute === 1) {
            // 1분대: 미니언 3~4마리, 스피드 울프 1~2마리
            this.spawnMonsterSwarm('minion', lane, 3, minute);
            this.spawnMonsterSwarm('wolf', secondLane, Math.random() < 0.6 ? 1 : 2, minute);
        } else if (minute === 2) {
            // 2분대: 미니언 4~5마리, 아머드 오크 1마리, 울프 2마리
            this.spawnMonsterSwarm('minion', lane, 4, minute);
            this.spawnMonsterSwarm('orc', secondLane, 1, minute);
            if (Math.random() < 0.4) this.spawnMonsterSwarm('wolf', thirdLane, 2, minute);
        } else if (minute === 3) {
            // 3분대: 아머드 오크, 울프, 미니언 출현
            this.spawnMonsterSwarm('minion', lane, 4, minute);
            this.spawnMonsterSwarm('orc', secondLane, 1, minute);
            this.spawnMonsterSwarm('wolf', thirdLane, 2, minute);
            if (Math.random() < 0.5) {
                this.spawnMonsterSwarm('goblin', (lane + 1) % this.grid.lanes, 2, minute);
            }
        } else if (minute === 4) {
            // 4분대: 3개 레인 동시 맹공격 (오크, 울프, 고블린, 미니언 대규모 진격)
            this.spawnMonsterSwarm('minion', lane, 5, minute);
            this.spawnMonsterSwarm('orc', secondLane, 2, minute);
            this.spawnMonsterSwarm('wolf', thirdLane, 2, minute);
            if (Math.random() < 0.5) {
                this.spawnMonsterSwarm('goblin', (lane + 2) % this.grid.lanes, 2, minute);
            }
        } else {
            // 5분대 이상 (대재앙 CATACLYSM):
            // ★ 5분이 넘어가면 1분대에 나온 보스(수학 거신 골렘)도 졸병으로 등장하고 대규모 지상군 출몰
            const golemCount = Math.random() < 0.6 ? 1 : 2;
            this.spawnMonsterSwarm('golem_minion', lane, golemCount, minute);
            this.spawnMonsterSwarm('orc', secondLane, 2 + Math.floor((minute - 5) * 0.5), minute);
            this.spawnMonsterSwarm('wolf', thirdLane, 2, minute);
            this.spawnMonsterSwarm('minion', (lane + 3) % this.grid.lanes, 4, minute);
            this.spawnMonsterSwarm('goblin', (lane + 1) % this.grid.lanes, 2, minute);
        }
    }

    // [요구사항 2] 5분(300초) 이후부터 30초에 1.2배씩 기하급수(복리) 스폰량 증가
    spawnMonsterSwarm(type, lane, count, minute = 0) {
        let spawnCount = count;
        if (this.survivalTime >= 300) {
            const step30s = Math.floor((this.survivalTime - 300) / 30);
            const multiplier = Math.pow(1.2, step30s);
            spawnCount = Math.max(1, Math.round(count * multiplier));
        }

        for (let i = 0; i < spawnCount; i++) {
            const offsetX = (Math.random() - 0.5) * 36;
            const offsetY = -i * 28; // 종대 간격을 벌려 겹침 현상 완화
            this.monsters.push(new Monster(lane, type, minute, this.grid, offsetX, offsetY));
        }
    }

    // [요구사항 1] 10분 생존 대성공 (작전 승리) 처리
    victory() {
        this.state = 'VICTORY';
        if (this.bulletTimeIndicator) this.bulletTimeIndicator.classList.add('hidden');
        if (this.confirmExitModal) this.confirmExitModal.classList.add('hidden');
        this.resultModal.classList.remove('hidden');
        this.resultTitle.textContent = '🎉 10분 생존 대성공! (작전 승리)';
        this.resultTitle.style.color = '#38bdf8';

        if (this.resultSurvivalTime) {
            this.resultSurvivalTime.textContent = '⏱️ 생존 시간: 10분 00초 (완전 클리어!)';
        }
        if (this.resultTier) {
            const t = this.currentTier || window.mathEngine.getTierData(this.score);
            this.resultTier.textContent = `🏆 최종 도달: ${t.tier}단계 (${t.name})`;
        }
        if (this.resultScore) {
            this.resultScore.textContent = `⭐ 최종 점수: ${this.score}점`;
        }

        // 축하 파티클
        const colors = ['#facc15', '#38bdf8', '#4ade80', '#ec4899', '#a855f7', '#fbbf24'];
        for (let i = 0; i < 60; i++) {
            const px = Math.random() * this.width;
            const py = Math.random() * (this.height * 0.7);
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push(new SparkParticle(px, py, color));
        }
        this.particles.push(new TextParticle(this.width / 2, 220, '👑 10 MINUTES SURVIVAL VICTORY! 👑', '#facc15', true));
        this.draw();
        this.addScreenShake(0.8, 15);
        window.soundEngine.playFever();
        this.showToast('🎉 10분 방어 성공! 축하합니다!');
    }

    gameOver() {
        this.state = 'GAMEOVER';
        this.resultModal.classList.remove('hidden');
        this.resultTitle.textContent = '💀 성벽 방어 종료 (생존 기록)';
        this.resultTitle.style.color = '#ef4444';

        const totalSec = Math.floor(this.survivalTime);
        const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const ss = String(totalSec % 60).padStart(2, '0');

        if (this.resultSurvivalTime) {
            this.resultSurvivalTime.textContent = `⏱️ 생존 시간: ${mm}분 ${ss}초`;
        }
        if (this.resultTier) {
            const t = this.currentTier || window.mathEngine.getTierData(this.score);
            this.resultTier.textContent = `🏆 최종 도달: ${t.tier}단계 (${t.name})`;
        }
        if (this.resultScore) {
            this.resultScore.textContent = `⭐ 최종 점수: ${this.score}점`;
        }

        window.soundEngine.playWrong();
    }

    returnToMain() {
        this.state = 'TITLE';
        this.isBulletTime = false;
        if (this.bulletTimeIndicator) this.bulletTimeIndicator.classList.add('hidden');
        if (this.confirmExitModal) this.confirmExitModal.classList.add('hidden');
        if (this.resultModal) this.resultModal.classList.add('hidden');
        if (this.tierUpBanner) this.tierUpBanner.classList.add('hidden');
        if (this.bossAlertBanner) this.bossAlertBanner.classList.add('hidden');

        this.dismissTutorialGuide(true);
        this.dismissDeployTutorialGuide(true);

        this.towers = [];
        this.warriors = [];
        this.monsters = [];
        this.projectiles = [];
        this.particles = [];
        this.hand = [];
        this.answerCards = [];
        this.selectedCard = null;
        this.draggingCard = null;

        if (this.handContainer) this.handContainer.innerHTML = '';
        if (this.answerRackContainer) this.answerRackContainer.innerHTML = '';

        this.score = 0;
        this.castleHp = this.maxCastleHp;
        this.survivalTime = 0;
        this.bossesSpawned = {};
        this.lastStep30s = 0;
        this.combo = 0;
        this.fever = false;
        this.feverTimer = 0;
        this.updateHUD();

        if (this.startModal) this.startModal.classList.remove('hidden');
        this.draw();
        window.soundEngine.playCardPick();
    }

    updateHUD() {
        if (this.uiSurvivalTime) {
            const totalSec = Math.floor(this.survivalTime);
            const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
            const ss = String(totalSec % 60).padStart(2, '0');
            this.uiSurvivalTime.textContent = `${mm}:${ss}`;
        }
        if (this.uiDiffBadge) {
            const dInfo = window.mathEngine.getDifficultyInfo(this.selectedDifficulty || 'beginner');
            this.uiDiffBadge.className = `hud-diff-badge ${this.selectedDifficulty || 'beginner'}`;
            this.uiDiffBadge.textContent = dInfo.badge;
        }
        if (this.uiTierBadge) {
            const t = this.currentTier || window.mathEngine.getTierData(this.score);
            this.uiTierBadge.textContent = `${t.tier}단: ${t.name}`;
        }
        if (this.uiScore) this.uiScore.textContent = this.score;
        if (this.uiCastleHp) this.uiCastleHp.textContent = `${this.castleHp} / ${this.maxCastleHp}`;
        if (this.uiHpBar) this.uiHpBar.style.width = `${(this.castleHp / this.maxCastleHp) * 100}%`;
        if (this.uiCombo) this.uiCombo.textContent = this.combo;

        if (this.fever) {
            this.uiFeverContainer.classList.remove('hidden');
            this.uiFeverBar.style.width = `${(this.feverTimer / this.maxFeverTime) * 100}%`;
        } else {
            this.uiFeverContainer.classList.add('hidden');
        }
    }

    draw() {
        const ctx = this.ctx;
        ctx.save();

        if (this.shakeTimer > 0) {
            const ox = (Math.random() * 2 - 1) * this.shakeIntensity;
            const oy = (Math.random() * 2 - 1) * this.shakeIntensity;
            ctx.translate(ox, oy);
        }

        // 1인칭 세로 배경 (원거리 지평선 + 세로 4개 고속도로 레인 + 하단 성벽)
        this.drawBackground(ctx);

        // 방어선 타일 그리드
        this.drawGrid(ctx);

        // 타워 렌더링 (바닥 덫/럴커 -> 방어벽 -> 일반 아군 순으로 안정적 레이어 렌더링)
        const renderOrder = { trap: 0, trap_lurker: 0, defense: 1 };
        const sortedTowers = [...this.towers].sort((a, b) => (renderOrder[a.type] ?? 2) - (renderOrder[b.type] ?? 2));
        sortedTowers.forEach(t => t.draw(ctx));

        // [NEW] 벙커 출격 전사(Warrior) 렌더링
        if (this.warriors && this.warriors.length > 0) {
            this.warriors.forEach(w => w.draw(ctx));
        }

        // 몬스터 렌더링 (원근감 스케일 적용)
        this.monsters.forEach(m => m.draw(ctx));

        // 투사체 렌더링
        this.projectiles.forEach(p => p.draw(ctx));

        // 플레이어 성벽 난간 (1인칭 시점 앞쪽 성벽)
        this.drawRamparts(ctx);

        // 파티클
        this.particles.forEach(p => p.draw(ctx));

        // 드래그 또는 탭 선택 고스트
        if ((this.draggingCard || this.selectedCard) && this.hoverCell) {
            this.drawPlacementGhost(ctx);
        }

        if (this.isBulletTime) {
            this.drawBulletTimeVignette(ctx);
        }

        ctx.restore();
    }

    drawBackground(ctx) {
        const hy = this.horizonY || 155;
        const ry = this.rampartY || (this.height - 6);

        // 1. 지평선 하늘 (상단 원거리 - 뉴트럴 다크 퍼플/블랙)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, hy);
        skyGrad.addColorStop(0, '#090d16');
        skyGrad.addColorStop(0.6, '#18181b');
        skyGrad.addColorStop(1, '#27272a');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, this.width, hy);

        // 먼 산 실루엣 & 몬스터 소환 차원문
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, hy);
        ctx.lineTo(80, hy - 40);
        ctx.lineTo(160, hy - 15);
        ctx.lineTo(270, hy - 65); // 포탈 중앙
        ctx.lineTo(380, hy - 20);
        ctx.lineTo(460, hy - 45);
        ctx.lineTo(540, hy);
        ctx.fill();

        // 중앙 어둠의 차원문 (상단)
        const portalY = hy - 65;
        const portalGlow = ctx.createRadialGradient(this.width / 2, portalY, 10, this.width / 2, portalY, 65);
        portalGlow.addColorStop(0, 'rgba(236, 72, 153, 0.9)');
        portalGlow.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)');
        portalGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = portalGlow;
        ctx.beginPath();
        ctx.arc(this.width / 2, portalY, 65, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f472b6';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ ABYSSAL PORTAL ⚡', this.width / 2, portalY - 22);

        // 2. 전장 지면 그라디언트 (지평선부터 하단 끝까지 꽉 채움 - 뉴트럴 흑연/다크 아스팔트)
        const groundGrad = ctx.createLinearGradient(0, hy, 0, ry);
        groundGrad.addColorStop(0, '#18181b');
        groundGrad.addColorStop(1, '#09090b');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, hy, this.width, ry - hy);

        // 3. 6개 세로 레인 트랙 (지면 전폭 꽉 채움)
        const g = this.grid;
        for (let l = 0; l < g.lanes; l++) {
            const lx = g.laneOffsetX + l * g.laneWidth;
            ctx.fillStyle = l % 2 === 0 ? 'rgba(24, 24, 27, 0.4)' : 'rgba(39, 39, 42, 0.25)';
            ctx.fillRect(lx, hy - 20, g.laneWidth, ry - (hy - 20));

            // 레인 경계선
            ctx.strokeStyle = 'rgba(63, 63, 70, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(lx, hy - 20);
            ctx.lineTo(lx, ry);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(g.laneOffsetX + g.lanes * g.laneWidth, hy - 20);
        ctx.lineTo(g.laneOffsetX + g.lanes * g.laneWidth, ry);
        ctx.stroke();
    }

    drawGrid(ctx) {
        const g = this.grid;
        const hasActiveDeploy = !!(this.draggingCard || this.selectedCard);

        for (let l = 0; l < g.lanes; l++) {
            for (let r = 0; r < g.rows; r++) {
                const x = g.laneOffsetX + l * g.laneWidth;
                const y = g.rowOffsetY + r * g.rowHeight;

                if (this.hoverCell && this.hoverCell.lane === l && this.hoverCell.row === r) {
                    ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
                    ctx.fillRect(x + 4, y + 4, g.laneWidth - 8, g.rowHeight - 8);
                    ctx.strokeStyle = '#22c55e';
                    ctx.lineWidth = 2.5;
                    ctx.strokeRect(x + 4, y + 4, g.laneWidth - 8, g.rowHeight - 8);
                } else if (hasActiveDeploy) {
                    // 카드 배치 모드일 때 전장 그리드 타일 시각화 안내
                    ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
                    ctx.fillRect(x + 5, y + 5, g.laneWidth - 10, g.rowHeight - 10);
                    ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
                    ctx.lineWidth = 1.2;
                    ctx.setLineDash([4, 4]);
                    ctx.strokeRect(x + 5, y + 5, g.laneWidth - 10, g.rowHeight - 10);
                    ctx.setLineDash([]);
                } else {
                    ctx.fillStyle = 'rgba(24, 24, 27, 0.45)';
                    ctx.fillRect(x + 5, y + 5, g.laneWidth - 10, g.rowHeight - 10);
                    ctx.strokeStyle = 'rgba(113, 113, 122, 0.25)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 5, y + 5, g.laneWidth - 10, g.rowHeight - 10);
                }
            }
        }
    }

    drawRamparts(ctx) {
        // 파란색 성벽 바 및 텍스트 박스를 완전히 제거하고, 전장 최하단 깔끔한 최종 방어선 가이드라인만 표시
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(0, this.height - 2);
        ctx.lineTo(this.width, this.height - 2);
        ctx.stroke();
        ctx.restore();
    }

    drawPlacementGhost(ctx) {
        const activeCard = this.draggingCard || this.selectedCard;
        if (!this.hoverCell || !activeCard) return;

        // x2 버프 카드 고스트 (황금빛 원형 아우라)
        if (activeCard.type === 'buff' || activeCard.isBuff) {
            const pos = this.grid.getCellCenter(this.hoverCell.lane, this.hoverCell.row);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.font = '36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚡', 0, 0);

            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(0, 0, 26, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            return;
        }

        // WALL / WALL+2 다중 레인 방벽 고스트
        if (activeCard.type === 'defense' && activeCard.wallSpread) {
            const spread = activeCard.wallSpread;
            const minLane = Math.max(0, this.hoverCell.lane - spread);
            const maxLane = Math.min(this.grid.lanes - 1, this.hoverCell.lane + spread);

            for (let l = minLane; l <= maxLane; l++) {
                const pos = this.grid.getCellCenter(l, this.hoverCell.row);
                ctx.save();
                ctx.globalAlpha = (l === this.hoverCell.lane) ? 0.8 : 0.45;
                ctx.translate(pos.x, pos.y);
                ctx.font = '32px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(activeCard.icon || '🛡️', 0, 0);

                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = (l === this.hoverCell.lane) ? 3 : 2;
                ctx.setLineDash([6, 4]);
                const ghostW = this.grid.laneWidth - 8;
                const ghostH = this.grid.rowHeight - 8;
                ctx.strokeRect(-ghostW / 2, -ghostH / 2, ghostW, ghostH);
                ctx.restore();
            }
            return;
        }

        const pos = this.grid.getCellCenter(this.hoverCell.lane, this.hoverCell.row);
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.translate(pos.x, pos.y);
        ctx.font = '36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeCard.icon, 0, 0);

        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        const ghostW = this.grid.laneWidth - 8;
        const ghostH = this.grid.rowHeight - 8;
        ctx.strokeRect(-ghostW / 2, -ghostH / 2, ghostW, ghostH);
        ctx.restore();
    }

    drawBulletTimeVignette(ctx) {
        const grad = ctx.createRadialGradient(
            this.width / 2, this.height / 2, 150,
            this.width / 2, this.height / 2, 450
        );
        grad.addColorStop(0, 'rgba(14, 165, 233, 0)');
        grad.addColorStop(1, 'rgba(14, 165, 233, 0.4)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
