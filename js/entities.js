// 엔티티(1인칭 세로 모드 타워, 몬스터, 투사체, 파티클) 정의

// 1. 방어 타워 / 소환 유닛 (정면 북쪽을 향해 사격)
class Tower {
    constructor(lane, row, cardData, grid) {
        this.id = 'tower_' + Math.random().toString(36).substr(2, 6);
        this.lane = lane;
        this.row = row;
        this.card = cardData;
        this.grid = grid;

        // 위치 계산 (레인 X, 행 Y)
        const pos = grid.getCellCenter(lane, row);
        this.x = pos.x;
        this.y = pos.y;

        this.maxHp = cardData.hp;
        this.hp = cardData.hp;
        this.type = cardData.type;
        this.damage = cardData.damage || 0;
        this.attackSpeed = cardData.attackSpeed || 1.0;
        this.attackTimer = 0;

        // 지속시간 타이머 (30초~1분 지속 후 자동 소멸)
        this.maxLifeTime = cardData.duration || 45;
        this.lifeTimer = this.maxLifeTime;
        this.expired = false;

        this.animTimer = 0;
        this.recoil = 0; // 발사 시 후퇴 반동 (아래쪽으로 튕김)

        // [NEW] x2 버프 및 특수 상태 변수
        this.buffCount = 0;
        this.fanShot = 1;
        this.hasArmor = false;
        this.spawnTimer = 0;
        this.spineEffectTimer = 0;
    }

    update(dt, monsters, projectiles, fever, warriors = []) {
        this.animTimer += dt;
        if (this.recoil > 0) {
            this.recoil = Math.max(0, this.recoil - dt * 12);
        }
        if (this.spineEffectTimer > 0) {
            this.spineEffectTimer -= dt;
        }

        // 지속시간 타이머 감쇠
        this.lifeTimer -= dt;
        if (this.lifeTimer <= 0) {
            this.lifeTimer = 0;
            this.hp = 0;
            this.expired = true;
            return;
        }

        // 덫(Trap) 작동 로직 (지나가는 적 슬라임 구속 & 지속 피해 - 적을 막거나 밀쳐내지 않음)
        if (this.type === 'trap') {
            monsters.forEach(m => {
                if (m.lane === this.lane && Math.abs(m.y - this.y) < 24 && m.hp > 0) {
                    m.applySlow(this.card.slowRatio || 0.2, this.card.slowDuration || 3.5);
                    m.takeDamage(this.damage * dt * 2, [], '', false); // 지속 맹독 피해 (넉백 없음)
                    this.hp -= dt * 60; // 덫 내구도 소모
                }
            });
            return;
        }

        // [NEW] 럴커 (LURKER) 사방(위, 아래, 좌, 우) 가시 분출 (적을 막지 않음)
        if (this.type === 'trap_lurker') {
            this.attackTimer += dt;
            const spineRate = fever ? 0.6 : 1.0;
            if (this.attackTimer >= spineRate) {
                this.attackTimer = 0;
                window.soundEngine.playShoot();
                const bonusDmg = fever ? 1.5 : 1.0;
                const spineDmg = Math.round(this.damage * bonusDmg);
                monsters.forEach(m => {
                    if (m.hp <= 0) return;
                    const inNorth = m.lane === this.lane && m.y < this.y && (this.y - m.y) < 75;
                    const inSouth = m.lane === this.lane && m.y >= this.y && (m.y - this.y) < 60;
                    const inWest = m.lane === this.lane - 1 && Math.abs(m.y - this.y) < 45;
                    const inEast = m.lane === this.lane + 1 && Math.abs(m.y - this.y) < 45;
                    if (inNorth || inSouth || inWest || inEast) {
                        m.takeDamage(spineDmg, [], 'crit', false); // 관통 넉백 없음
                    }
                });
                this.recoil = 8;
                this.spineEffectTimer = 0.25;
            }
            return;
        }

        // [NEW] KNIGHT 및 10종 신규 아군 유닛 스포너/벙커 소환 처리
        if (this.type === 'knight' || (this.card && this.card.isBunker) || this.type.startsWith('spawner_')) {
            this.spawnTimer = (this.spawnTimer || 0) + dt;
            const baseInterval = this.card.attackSpeed || 2.5;
            const spawnInterval = fever ? baseInterval * 0.55 : baseInterval;
            if (this.spawnTimer >= spawnInterval) {
                this.spawnTimer = 0;
                window.soundEngine.playDeploy();
                this.recoil = 5;
                if (warriors) {
                    this.spawnMobileUnits(warriors);
                }
            }
            return;
        }

        if (this.damage <= 0) return; // 벽 등 비공격 유닛

        const effectiveSpeed = fever ? this.attackSpeed * 0.5 : this.attackSpeed;
        this.attackTimer += dt;

        if (this.attackTimer >= effectiveSpeed) {
            let targets = [];
            if (this.type === 'drone') {
                // 드론: 좌우 1레인 범위까지 유도 탐색
                targets = monsters.filter(m => Math.abs(m.lane - this.lane) <= 1 && m.y < this.y && m.hp > 0);
            } else if (this.type === 'titan' || this.type === 'paladin') {
                // 타이탄/팔라딘: 좌우 1레인 범위 탐색
                targets = monsters.filter(m => Math.abs(m.lane - this.lane) <= 1 && m.y < this.y && m.hp > 0);
            } else if (this.type === 'sniper') {
                // 저격수: 전 레인 몬스터 타겟팅 (보스/엘리트 우선)
                targets = monsters.filter(m => m.hp > 0 && m.y < this.y);
                targets.sort((a, b) => (b.isBoss ? 1 : 0) - (a.isBoss ? 1 : 0) || a.y - b.y);
            } else if (this.type === 'archer') {
                // 궁수: 동일 레인 우선 사격
                targets = monsters.filter(m => m.lane === this.lane && m.y < this.y && m.hp > 0);
                targets.sort((a, b) => b.y - a.y);
            } else if (this.type === 'laser') {
                // 프리즘 레이저: 동일 레인 관통 요격
                targets = monsters.filter(m => m.lane === this.lane && m.y < this.y && m.hp > 0);
                targets.sort((a, b) => b.y - a.y);
            } else {
                // 일반 지상 타워: 동일 레인 탐색
                targets = monsters.filter(m => m.lane === this.lane && m.y < this.y && m.hp > 0);
                targets.sort((a, b) => b.y - a.y);
            }

            if (targets.length > 0) {
                if (this.type !== 'sniper' && this.type !== 'archer' && this.type !== 'laser') {
                    // 타워에 가장 근접한(Y값이 가장 큰) 몬스터 우선 타겟팅
                    targets.sort((a, b) => b.y - a.y);
                }
                this.attack(targets[0], projectiles, fever, monsters);
                this.attackTimer = 0;
                this.recoil = 6;
            }
        }
    }

    attack(target, projectiles, fever, allMonsters = []) {
        const bonusDmg = fever ? 1.5 : 1.0;
        const finalDmg = Math.round(this.damage * bonusDmg);

        if (this.type === 'archer') {
            window.soundEngine.playShoot();
            // [NEW] 위험 레인에 고속 화살 3발 집중 사격! x2 버프 시 부채꼴 6발 사격
            const count = (this.fanShot && this.fanShot > 1) ? 6 : 3;
            if (count === 3) {
                [-10, 0, 10].forEach((ox, idx) => {
                    projectiles.push(new Projectile(this.x + ox, this.y - 12 - idx * 5, target, 'arrow', finalDmg, 700, this.lane));
                });
            } else {
                [-20, -12, -4, 4, 12, 20].forEach((ox, idx) => {
                    const angleOffset = (idx - 2.5) * 0.08;
                    projectiles.push(new Projectile(this.x + ox, this.y - 12, target, 'arrow', finalDmg, 700, this.lane, { angleOffset }));
                });
            }
        } else if (this.type === 'cannon') {
            window.soundEngine.playShoot();
            projectiles.push(new Projectile(this.x, this.y - 15, target, 'cannon', finalDmg, 500, this.lane, {
                splash: this.card.splash || 65
            }));
        } else if (this.type === 'frost') {
            window.soundEngine.playFreeze();
            projectiles.push(new Projectile(this.x, this.y - 15, target, 'ice', finalDmg, 520, this.lane, {
                slow: this.card.slowRatio || 0.5,
                duration: this.card.slowDuration || 2.5
            }));
        } else if (this.type === 'tank') {
            window.soundEngine.playExplosion();
            projectiles.push(new Projectile(this.x, this.y - 15, target, 'hyper_shell', finalDmg, 800, this.lane, {
                pierce: true
            }));
        } else if (this.type === 'drone') {
            // 가디언 드론: 유도 펄스 미사일
            window.soundEngine.playShoot();
            projectiles.push(new Projectile(this.x, this.y - 12, target, 'drone_missile', finalDmg, 620, target.lane));
        } else if (this.type === 'tesla') {
            // 테슬라 코일: 3체 연쇄 전자기 볼트 & 0.4초 감전
            window.soundEngine.playShoot();
            projectiles.push(new Projectile(this.x, this.y - 15, target, 'tesla_bolt', finalDmg, 750, this.lane, {
                chain: 3,
                stun: 0.4
            }));
        } else if (this.type === 'mortar') {
            // 화염 박격포: 장거리 곡사 화염 포탄 투하 (x2 버프 시 부채꼴 2발)
            window.soundEngine.playExplosion();
            const fanCount = (this.fanShot && this.fanShot > 1) ? 2 : 1;
            if (fanCount === 1) {
                projectiles.push(new Projectile(this.x, this.y - 15, target, 'mortar_shell', finalDmg, 460, this.lane, {
                    splash: this.card.splash || 110
                }));
            } else {
                [-18, 18].forEach((ox, idx) => {
                    projectiles.push(new Projectile(this.x + ox, this.y - 15, target, 'mortar_shell', finalDmg, 460, this.lane, {
                        splash: this.card.splash || 110,
                        angleOffset: (idx === 0 ? -0.12 : 0.12)
                    }));
                });
            }
        } else if (this.type === 'sniper') {
            // [NEW] 저격수: 지상/공중 모두 공격 & 100% 치명타 (x2 버프 시 부채꼴 2발)
            window.soundEngine.playShoot();
            const fanCount = (this.fanShot && this.fanShot > 1) ? 2 : 1;
            if (fanCount === 1) {
                projectiles.push(new Projectile(this.x, this.y - 20, target, 'sniper_bullet', finalDmg, 1300, target.lane, {
                    pierce: true,
                    crit: true
                }));
            } else {
                [-0.10, 0.10].forEach(angleOffset => {
                    projectiles.push(new Projectile(this.x, this.y - 20, target, 'sniper_bullet', finalDmg, 1300, target.lane, {
                        pierce: true,
                        crit: true,
                        angleOffset
                    }));
                });
            }
        } else if (this.type === 'paladin') {
            // [NEW] 수호기사: 신성한 빛의 검기 투척 (광역 충격파)
            window.soundEngine.playShoot();
            projectiles.push(new Projectile(this.x, this.y - 15, target, 'holy_blade', finalDmg, 620, this.lane, {
                splash: 85
            }));
        } else if (this.type === 'phoenix') {
            // [NEW] 화염 불사조: 전방 레인을 관통하는 불사조 화염 폭풍
            window.soundEngine.playExplosion();
            projectiles.push(new Projectile(this.x, this.y - 15, target, 'phoenix_fire', finalDmg, 600, this.lane, {
                pierce: true,
                splash: 75
            }));
        } else if (this.type === 'laser') {
            // [NEW] 프리즘 레이저: 초고출력 관통 광선 빔
            window.soundEngine.playShoot();
            projectiles.push(new Projectile(this.x, this.y - 20, target, 'laser_beam', finalDmg, 1400, this.lane, {
                pierce: true
            }));
        } else if (this.type === 'golem') {
            // [NEW] 룬 골렘: 지진파 충격파 (120px 광역 & 1.5초 스턴)
            window.soundEngine.playExplosion();
            projectiles.push(new Projectile(this.x, this.y - 10, target, 'earthquake', finalDmg, 520, this.lane, {
                splash: 120,
                stun: 1.5
            }));
        } else if (this.type === 'titan') {
            // [NEW] 거신 타이탄: 3개 레인 동시 플라즈마 캐논 일제 사격!
            window.soundEngine.playExplosion();
            [-1, 0, 1].forEach(offset => {
                const targetLane = Math.max(0, Math.min(5, this.lane + offset));
                const targetPos = this.grid.getCellCenter(targetLane, 1);
                projectiles.push(new Projectile(this.x, this.y - 20, { x: targetPos.x, y: targetPos.y, lane: targetLane }, 'titan_plasma', finalDmg, 680, targetLane, {
                    splash: 95
                }));
            });
        }
    }

    // [NEW] 아군 유닛 스폰 메서드 (기사단 벙커 및 10종 신규 아군 유닛)
    spawnMobileUnits(warriors) {
        const type = this.type;
        const armor = this.hasArmor;

        switch (type) {
            case 'spawner_hound': {
                const hp = armor ? 220 : 110;
                const dmg = armor ? 40 : 25;
                warriors.push(new Warrior(this.lane, this.x, this.y - 12, hp, dmg, armor, this.grid, 'hound'));
                break;
            }
            case 'spawner_spear': {
                const hp = armor ? 380 : 190;
                const dmg = armor ? 70 : 45;
                warriors.push(new Warrior(this.lane, this.x, this.y - 12, hp, dmg, armor, this.grid, 'spearman'));
                break;
            }
            case 'spawner_ranger': {
                const hp = armor ? 320 : 160;
                const dmg = armor ? 60 : 38;
                warriors.push(new Warrior(this.lane, this.x, this.y - 12, hp, dmg, armor, this.grid, 'ranger'));
                break;
            }
            case 'spawner_barracks': {
                const hp = armor ? 750 : 400;
                const dmg = armor ? 65 : 40;
                warriors.push(new Warrior(this.lane, this.x, this.y - 12, hp, dmg, armor, this.grid, 'shieldman'));
                break;
            }
            case 'spawner_skeleton': {
                const hp = armor ? 240 : 120;
                const dmg = armor ? 50 : 30;
                // 2체 동시 출격
                warriors.push(new Warrior(this.lane, this.x - 10, this.y - 12, hp, dmg, armor, this.grid, 'skeleton'));
                warriors.push(new Warrior(this.lane, this.x + 10, this.y - 12, hp, dmg, armor, this.grid, 'skeleton'));
                break;
            }
            case 'spawner_cavalry': {
                const hp = armor ? 900 : 480;
                const dmg = armor ? 170 : 110;
                warriors.push(new Warrior(this.lane, this.x, this.y - 14, hp, dmg, armor, this.grid, 'cavalry'));
                break;
            }
            case 'spawner_cleric': {
                const hp = armor ? 500 : 260;
                const dmg = armor ? 75 : 45;
                warriors.push(new Warrior(this.lane, this.x, this.y - 12, hp, dmg, armor, this.grid, 'cleric', { healAmount: this.card.healAmount || 80 }));
                break;
            }
            case 'spawner_valkyrie': {
                const hp = armor ? 1200 : 650;
                const dmg = armor ? 250 : 160;
                warriors.push(new Warrior(this.lane, this.x, this.y - 14, hp, dmg, armor, this.grid, 'valkyrie'));
                break;
            }
            case 'spawner_mecha': {
                const hp = armor ? 2200 : 1200;
                const dmg = armor ? 380 : 240;
                warriors.push(new Warrior(this.lane, this.x, this.y - 16, hp, dmg, armor, this.grid, 'mecha'));
                break;
            }
            case 'spawner_drake': {
                const hp = armor ? 2800 : 1500;
                const dmg = armor ? 520 : 340;
                warriors.push(new Warrior(this.lane, this.x, this.y - 16, hp, dmg, armor, this.grid, 'drake'));
                break;
            }
            case 'spawner_archangel': {
                const hp = armor ? 6000 : 3200;
                const dmg = armor ? 1000 : 650;
                warriors.push(new Warrior(this.lane, this.x, this.y - 18, hp, dmg, armor, this.grid, 'archangel'));
                break;
            }
            default: { // knight
                const warriorHp = armor ? 280 : 140;
                const warriorDmg = armor ? 50 : 35;
                warriors.push(new Warrior(this.lane, this.x, this.y - 12, warriorHp, warriorDmg, armor, this.grid, 'warrior'));
                break;
            }
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        return this.hp <= 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y + this.recoil);

        // 지속시간 만료 임박(3초 이하) 점멸 효과
        if (this.lifeTimer <= 3) {
            const blink = Math.sin(this.animTimer * 16) > 0 ? 0.35 : 1.0;
            ctx.globalAlpha = blink;
        }

        // 유닛 베이스 원형 발판
        ctx.beginPath();
        ctx.arc(0, 16, 24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        const breathe = Math.sin(this.animTimer * 4) * 2;

        if (this.type === 'defense') {
            // 거대한 홀로그램 방어벽
            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 12;
            ctx.fillRect(-24, -26 + breathe, 48, 52);
            ctx.strokeStyle = '#e0f7fa';
            ctx.lineWidth = 3;
            ctx.strokeRect(-24, -26 + breathe, 48, 52);
            ctx.font = '26px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🛡️', 0, 0 + breathe);
        } else if (this.type === 'archer') {
            ctx.fillStyle = '#15803d';
            ctx.beginPath();
            ctx.arc(0, breathe, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#86efac';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.font = '22px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🏹', 0, breathe);
        } else if (this.type === 'cannon') {
            ctx.fillStyle = '#c2410c';
            ctx.beginPath();
            ctx.arc(0, breathe, 23, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fdba74';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🚀', 0, breathe);
        } else if (this.type === 'frost') {
            ctx.fillStyle = '#0369a1';
            ctx.shadowColor = '#7dd3fc';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(0, breathe, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#e0f2fe';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('❄️', 0, breathe);
        } else if (this.type === 'tank') {
            ctx.fillStyle = '#334155';
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 12;
            ctx.fillRect(-26, -20 + breathe, 52, 40);
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 3;
            ctx.strokeRect(-26, -20 + breathe, 52, 40);
            ctx.font = '26px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🚜', 0, breathe);
        } else if (this.type === 'trap') {
            ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.font = '26px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🕸️', 0, 0);
        } else if (this.type === 'trap_lurker') {
            // [NEW] 럴커 지하 매복형 덫 (바닥에 숨어 4방향 가시 분출)
            ctx.fillStyle = 'rgba(67, 20, 7, 0.7)';
            ctx.shadowColor = '#ea580c';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.ellipse(0, 0, 26, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🦂', 0, 0);

            // 4방향 가시(Spine) 분출 이펙트
            if (this.spineEffectTimer > 0) {
                ctx.strokeStyle = '#fca5a5';
                ctx.lineWidth = 3.5;
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 12;
                [
                    [0, -10, 0, -42],
                    [0, 10, 0, 36],
                    [-10, 0, -40, 0],
                    [10, 0, 40, 0]
                ].forEach(([x1, y1, x2, y2]) => {
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                });
            }
        } else if (this.type === 'knight' || (this.card && this.card.isBunker) || this.type.startsWith('spawner_')) {
            // [NEW] 기사단 벙커 및 10종 아군 스포너 기지 건물 렌더링
            const spawnerThemes = {
                'knight': { bg: '#1e293b', border: '#60a5fa', shadow: '#3b82f6', icon: '🏰' },
                'spawner_hound': { bg: '#451a03', border: '#f59e0b', shadow: '#d97706', icon: '🐕' },
                'spawner_spear': { bg: '#14532d', border: '#4ade80', shadow: '#22c55e', icon: '🔱' },
                'spawner_ranger': { bg: '#064e3b', border: '#34d399', shadow: '#10b981', icon: '🧝' },
                'spawner_barracks': { bg: '#334155', border: '#94a3b8', shadow: '#64748b', icon: '🏛️' },
                'spawner_skeleton': { bg: '#3b0764', border: '#c084fc', shadow: '#a855f7', icon: '☠️' },
                'spawner_cavalry': { bg: '#831843', border: '#f472b6', shadow: '#ec4899', icon: '🐎' },
                'spawner_cleric': { bg: '#713f12', border: '#fde047', shadow: '#eab308', icon: '⛪' },
                'spawner_valkyrie': { bg: '#1e3a5f', border: '#38bdf8', shadow: '#0284c7', icon: '🪽' },
                'spawner_mecha': { bg: '#0f172a', border: '#38bdf8', shadow: '#06b6d4', icon: '🤖' },
                'spawner_drake': { bg: '#7f1d1d', border: '#f87171', shadow: '#ef4444', icon: '🐲' },
                'spawner_archangel': { bg: '#78350f', border: '#fef08a', shadow: '#facc15', icon: '🌟' }
            };
            const theme = spawnerThemes[this.type] || { bg: '#1e293b', border: '#60a5fa', shadow: '#3b82f6', icon: '🏰' };
            ctx.fillStyle = theme.bg;
            ctx.shadowColor = this.hasArmor ? '#facc15' : theme.shadow;
            ctx.shadowBlur = this.hasArmor ? 18 : 14;
            ctx.fillRect(-26, -24 + breathe, 52, 48);
            ctx.strokeStyle = this.hasArmor ? '#fbbf24' : theme.border;
            ctx.lineWidth = this.hasArmor ? 3.5 : 3;
            ctx.strokeRect(-26, -24 + breathe, 52, 48);
            ctx.font = '28px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(theme.icon, 0, breathe);
        } else if (this.type === 'drone') {
            ctx.fillStyle = '#0e7490';
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.ellipse(0, breathe, 24, 16, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#67e8f9';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.font = '22px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🛸', 0, breathe);
        } else if (this.type === 'tesla') {
            ctx.fillStyle = '#581c87';
            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(0, breathe, 23, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#d8b4fe';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🗼', 0, breathe);
        } else if (this.type === 'mortar') {
            ctx.fillStyle = '#7c2d12';
            ctx.shadowColor = '#fb923c';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(0, breathe, 23, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fdba74';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔥', 0, breathe);
        } else if (this.type === 'sniper') {
            ctx.fillStyle = '#14532d';
            ctx.shadowColor = '#4ade80';
            ctx.shadowBlur = 12;
            ctx.fillRect(-22, -20 + breathe, 44, 40);
            ctx.strokeStyle = '#86efac';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(-22, -20 + breathe, 44, 40);
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🎯', 0, breathe);
        } else if (this.type === 'paladin') {
            ctx.fillStyle = '#b45309';
            ctx.shadowColor = '#fde047';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(0, breathe, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 3.5;
            ctx.stroke();
            ctx.font = '26px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🛡️', 0, breathe);
        } else if (this.type === 'phoenix') {
            ctx.fillStyle = '#991b1b';
            ctx.shadowColor = '#f87171';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(0, breathe, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fca5a5';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.font = '25px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🦅', 0, breathe);
        } else if (this.type === 'laser') {
            ctx.fillStyle = '#0f766e';
            ctx.shadowColor = '#2dd4bf';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(0, breathe, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#5eead4';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.font = '25px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('📡', 0, breathe);
        } else if (this.type === 'golem') {
            ctx.fillStyle = '#475569';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 16;
            ctx.fillRect(-26, -22 + breathe, 52, 44);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 3.5;
            ctx.strokeRect(-26, -22 + breathe, 52, 44);
            ctx.font = '28px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🗿', 0, breathe);
        } else if (this.type === 'titan') {
            ctx.fillStyle = '#3b0764';
            ctx.shadowColor = '#e879f9';
            ctx.shadowBlur = 20;
            ctx.fillRect(-27, -24 + breathe, 54, 48);
            ctx.strokeStyle = '#f0abfc';
            ctx.lineWidth = 4;
            ctx.strokeRect(-27, -24 + breathe, 54, 48);
            ctx.font = '30px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🤖', 0, breathe);
        }

        // 영단어 명찰 배지
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(-26, -38, 52, 13);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.strokeRect(-26, -38, 52, 13);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 8.5px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.card.word, 0, -32);

        // 체력바
        const hpRatio = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-22, 23, 44, 4);
        ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : (hpRatio > 0.25 ? '#eab308' : '#ef4444');
        ctx.fillRect(-22, 23, 44 * hpRatio, 4);

        // 지속시간 타이머 게이지 바 (30초~1분 지속 게이지)
        const timeRatio = Math.max(0, this.lifeTimer / this.maxLifeTime);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(-22, 29, 44, 3.5);

        let timerColor = '#38bdf8';
        if (this.lifeTimer <= 5) {
            timerColor = (Math.floor(this.animTimer * 6) % 2 === 0) ? '#ef4444' : '#f97316';
        } else if (this.lifeTimer <= 10) {
            timerColor = '#f59e0b';
        }
        ctx.fillStyle = timerColor;
        ctx.fillRect(-22, 29, 44 * timeRatio, 3.5);

        // 지속시간 초 카운트 텍스트 (예: ⏱️ 38s)
        ctx.fillStyle = timerColor;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`⏱️${Math.ceil(this.lifeTimer)}s`, 0, 39);

        // [NEW] x2 버프 중첩 배지 (⚡x1, ⚡x2, ⚡x3)
        if (this.buffCount && this.buffCount > 0) {
            ctx.save();
            ctx.fillStyle = '#f59e0b';
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(22, -22, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 9.5px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`⚡x${this.buffCount}`, 22, -22);
            ctx.restore();
        }

        ctx.restore();
    }
}

// 2. 적 몬스터 (상단 원거리에서 화면 앞 나를 향해 1인칭 돌진)
class Monster {
    constructor(lane, type, wave, grid, offsetX = 0, offsetY = 0) {
        this.id = 'mob_' + Math.random().toString(36).substr(2, 6);
        this.lane = lane;
        this.grid = grid;
        this.type = type;

        // X좌표: 해당 세로 레인의 중심 + 떼(Swarm) 무리 분산 오프셋
        this.x = grid.getLaneCenterX(lane) + offsetX;
        // Y좌표: 지평선 먼 곳(상단 포탈 중심 100px)에서 스폰 + 종대 오프셋
        this.y = 100 + offsetY;

        this.slowTimer = 0;
        this.slowFactor = 1.0;
        this.freezeTimer = 0;
        this.hurtTimer = 0;

        // 웨이브 단계별 속도 배율:
        // 1단계(초3 기초 학습): 0.85x (~15초 여유), 2단계: 1.0x, 3단계: 1.15x, 4단계: 1.3x
        const waveSpeedMult = 0.70 + wave * 0.15;

        if (type === 'minion') {
            // 좀비 러너 미니언 (기본 적)
            this.name = '좀비 러너';
            this.icon = '🧟';
            this.maxHp = 22 + wave * 6;
            this.speed = Math.round(44 * waveSpeedMult); // 웨이브 1: 37 px/s (~15.4초), 웨이브 4: 57 px/s
            this.damage = 6;
            this.score = 25;
            this.baseSize = 17;
        } else if (type === 'goblin') {
            this.name = '고블린';
            this.icon = '👺';
            this.maxHp = 45 + wave * 14;
            this.speed = Math.round(38 * waveSpeedMult); // 웨이브 1: 32 px/s, 웨이브 4: 50 px/s
            this.damage = 14;
            this.score = 40;
            this.baseSize = 21;
        } else if (type === 'wolf') {
            this.name = '스피드 울프';
            this.icon = '🐺';
            this.maxHp = 32 + wave * 10;
            this.speed = Math.round(58 * waveSpeedMult); // 웨이브 1: 49 px/s (~11.6초), 웨이브 4: 75 px/s
            this.damage = 12;
            this.score = 50;
            this.baseSize = 19;
        } else if (type === 'orc') {
            this.name = '아머드 오크';
            this.icon = '👹';
            this.maxHp = 180 + wave * 40;
            this.speed = Math.round(28 * waveSpeedMult); // 웨이브 1: 24 px/s (~23.7초), 웨이브 4: 36 px/s
            this.damage = 35;
            this.score = 100;
            this.baseSize = 28;
        } else if (type === 'boss') {
            this.name = '수학 거신 골렘';
            this.icon = '🗿';
            this.maxHp = 1100 + wave * 350;
            this.speed = Math.round(19 * waveSpeedMult); // 웨이브 4: 25 px/s (~22.8초)
            this.damage = 150;
            this.score = 800;
            this.baseSize = 44;
            this.isBoss = true;
        } else if (type === 'golem_minion') {
            // 5분 경과 시 1분대 보스(골렘)가 일반 졸병으로 출현!
            this.name = '졸병 거신 골렘';
            this.icon = '🗿';
            this.maxHp = 480 + wave * 50;
            this.speed = Math.round(23 * waveSpeedMult);
            this.damage = 25;
            this.score = 120;
            this.baseSize = 32;
            this.isBoss = false;
        } else if (type === 'boss_warlord') {
            // 2분대 보스: 다크 오크 워로드
            this.name = '다크 오크 워로드';
            this.icon = '🧌';
            this.maxHp = 2200 + wave * 300;
            this.speed = Math.round(20 * waveSpeedMult);
            this.damage = 180;
            this.score = 1200;
            this.baseSize = 46;
            this.isBoss = true;
        } else if (type === 'boss_dragon') {
            // 3분대 보스: 인페르노 드래곤
            this.name = '인페르노 드래곤';
            this.icon = '🐲';
            this.maxHp = 3600 + wave * 400;
            this.speed = Math.round(23 * waveSpeedMult);
            this.damage = 240;
            this.score = 1800;
            this.baseSize = 50;
            this.isBoss = true;
        } else if (type === 'boss_lich') {
            // 4분대 보스: 심연의 네크로맨서
            this.name = '심연의 네크로맨서';
            this.icon = '🧙';
            this.maxHp = 5200 + wave * 500;
            this.speed = Math.round(21 * waveSpeedMult);
            this.damage = 320;
            this.score = 2500;
            this.baseSize = 48;
            this.isBoss = true;
        } else if (type === 'boss_apocalypse') {
            // 5분 이후: 대재앙 파괴신
            this.name = '아포칼립스 파괴신';
            this.icon = '☠️';
            this.maxHp = 7500 + wave * 800;
            this.speed = Math.round(20 * waveSpeedMult);
            this.damage = 450;
            this.score = 4000;
            this.baseSize = 54;
            this.isBoss = true;
        }
        // [추후 개발] 하늘 비행 몬스터(다크 배트, 공중 팬텀, 스카이 와이번)는 추후 개발 예정

        this.size = this.baseSize;
        this.hp = this.maxHp;
        this.attackCooldown = 0;
    }

    update(dt, towers, particles) {
        if (this.hurtTimer > 0) this.hurtTimer -= dt;

        if (this.freezeTimer > 0) {
            this.freezeTimer -= dt;
            return;
        }

        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) this.slowFactor = 1.0;
        }

        // 1인칭 원근감 크기 계산 (화면 앞쪽 성벽으로 올수록 점진 확대)
        const travelH = (this.grid && this.grid.height) ? (this.grid.height - 180) : 580;
        const depth = Math.max(0, Math.min(1, (this.y - 100) / travelH));
        this.size = this.baseSize * (0.65 + depth * 0.75);

        // 1. 덫(trap) 및 럴커(trap_lurker)류 카드는 적군을 가로막지 않음 (적군이 통과하며 피해를 입음)
        // 2. 방어벽(defense)이 존재하는 경우 방어벽이 우선적으로 적군의 공격을 방어
        const blockingTowers = towers.filter(t => t.type !== 'trap' && t.type !== 'trap_lurker' && !t.card?.isTrap && t.lane === this.lane && t.y > this.y && (t.y - this.y) < (this.size + 18));
        const blockedTower = blockingTowers.length > 0 ? (blockingTowers.find(t => t.type === 'defense') || blockingTowers[0]) : null;

        if (blockedTower) {
            this.attackCooldown += dt;
            if (this.attackCooldown >= 1.0) {
                this.attackCooldown = 0;
                const destroyed = blockedTower.takeDamage(this.damage);
                window.soundEngine.playHit();
                particles.push(new TextParticle(blockedTower.x, blockedTower.y - 20, `-${this.damage}`, '#ef4444'));
                if (destroyed) {
                    window.soundEngine.playExplosion();
                }
            }
        } else {
            const currentSpeed = this.speed * this.slowFactor;
            this.y += currentSpeed * dt;
        }
    }

    takeDamage(dmg, particles, hitType = '', applyKnockback = true) {
        this.hp -= dmg;
        this.hurtTimer = 0.12;
        if (applyKnockback) {
            // 피격 넉백 (화살/포탄에 밀려 뒤로 살짝 밀림)
            this.y = Math.max(100, this.y - 6);
        }
        window.soundEngine.playHit();

        const color = hitType === 'crit' ? '#fbbf24' : '#ffffff';
        particles.push(new TextParticle(this.x + (Math.random() * 20 - 10), this.y - 25, `-${dmg}`, color, hitType === 'crit'));
        return this.hp <= 0;
    }

    applySlow(factor, duration) {
        this.slowFactor = factor;
        this.slowTimer = duration;
    }

    applyFreeze(duration) {
        this.freezeTimer = duration;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.hurtTimer > 0) {
            ctx.filter = 'brightness(1.8) contrast(1.4)';
        } else if (this.freezeTimer > 0) {
            ctx.filter = 'hue-rotate(180deg) saturate(2)';
        } else if (this.slowTimer > 0) {
            ctx.filter = 'hue-rotate(150deg)';
        }

        // 원근감 그림자
        const shadowOffsetY = this.size * 0.7;
        ctx.beginPath();
        ctx.ellipse(0, shadowOffsetY, this.size * 0.9, this.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fill();

        // 몬스터 이모지 (원근감에 따라 커진 사이즈)
        ctx.font = `${this.size * 1.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, 0, 0);

        if (this.isBoss) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, this.size + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 체력바
        ctx.filter = 'none';
        const barW = Math.max(26, this.size * 1.8);
        const hpRatio = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-barW / 2, -this.size - 12, barW, 4);
        ctx.fillStyle = this.isBoss ? '#ef4444' : '#eab308';
        ctx.fillRect(-barW / 2, -this.size - 12, barW * hpRatio, 4);

        ctx.restore();
    }
}

// 3. 투사체 (정면 북쪽을 향해 상향 발사)
class Projectile {
    constructor(x, y, target, type, damage, speed, lane, extra = {}) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.type = type;
        this.damage = damage;
        this.speed = speed;
        this.lane = lane;
        this.extra = extra;
        this.dead = false;
        this.piercedMonsters = new Set();
    }

    update(dt, monsters, particles) {
        // [NEW] 부채꼴 사격(angleOffset) 궤도 이동 지원
        if (this.extra.angleOffset) {
            const angle = -Math.PI / 2 + this.extra.angleOffset;
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
        } else {
            // 상향(북쪽) 이동
            this.y -= this.speed * dt;
        }

        // 라인 및 근접 몬스터 충돌 검사
        for (let mob of monsters) {
            if (mob.hp > 0) {
                const dist = Math.hypot(mob.x - this.x, mob.y - this.y);
                if (dist < mob.size + 18) {
                    this.onHit(mob, monsters, particles);
                    if (!this.extra.pierce) {
                        this.dead = true;
                        break;
                    }
                }
            }
        }

        // 상단 지평선 밖이나 화면 좌우 밖으로 날아가면 제거
        if (this.y < 80 || this.x < -30 || this.x > 570) this.dead = true;
    }

    onHit(primaryMob, allMonsters, particles) {
        if (this.extra.pierce) {
            if (this.piercedMonsters.has(primaryMob.id)) return;
            this.piercedMonsters.add(primaryMob.id);
            primaryMob.takeDamage(this.damage, particles, 'crit');
            for (let i = 0; i < 6; i++) {
                particles.push(new SparkParticle(this.x, this.y, '#fde047'));
            }
            return;
        }

        if (this.extra.splash) {
            window.soundEngine.playExplosion();
            for (let i = 0; i < 20; i++) {
                particles.push(new SparkParticle(this.x, this.y, '#f97316'));
            }
            allMonsters.forEach(m => {
                const dist = Math.hypot(m.x - this.x, m.y - this.y);
                if (dist <= this.extra.splash && m.hp > 0) {
                    m.takeDamage(this.damage, particles);
                }
            });
            return;
        }

        if (this.extra.slow) {
            primaryMob.applySlow(this.extra.slow, this.extra.duration);
            for (let i = 0; i < 10; i++) {
                particles.push(new SparkParticle(this.x, this.y, '#38bdf8'));
            }
        }

        if (this.extra.stun) {
            primaryMob.freezeTimer = Math.max(primaryMob.freezeTimer || 0, this.extra.stun);
        }

        if (this.extra.chain && allMonsters.length > 1) {
            const extraTargets = allMonsters.filter(m => m.id !== primaryMob.id && m.hp > 0)
                .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))
                .slice(0, this.extra.chain - 1);
            extraTargets.forEach(m => {
                m.takeDamage(Math.round(this.damage * 0.75), particles);
                if (this.extra.stun) m.freezeTimer = Math.max(m.freezeTimer || 0, this.extra.stun);
                for (let i = 0; i < 4; i++) particles.push(new SparkParticle(m.x, m.y, '#c084fc'));
            });
        }

        const hitType = this.extra.crit ? 'crit' : '';
        primaryMob.takeDamage(this.damage, particles, hitType);
        for (let i = 0; i < 6; i++) {
            particles.push(new SparkParticle(this.x, this.y, '#ffffff'));
        }
    }

    draw(ctx) {
        ctx.save();
        if (this.extra.angleOffset) {
            ctx.translate(this.x, this.y);
            ctx.rotate(this.extra.angleOffset);
            ctx.translate(-this.x, -this.y);
        }
        if (this.type === 'arrow') {
            // 상향 수직 고속 화살
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + 14);
            ctx.lineTo(this.x, this.y - 10);
            ctx.stroke();
        } else if (this.type === 'cannon') {
            // 대구경 폭발 포탄
            ctx.fillStyle = '#ea580c';
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 9, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'ice') {
            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#bae6fd';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 7, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'hyper_shell') {
            // 하이퍼 레일건 관통 레이저 빔
            ctx.fillStyle = '#fde047';
            ctx.shadowColor = '#eab308';
            ctx.shadowBlur = 20;
            ctx.fillRect(this.x - 7, this.y - 30, 14, 60);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.x - 3, this.y - 25, 6, 50);
        } else if (this.type === 'sword_slash') {
            // [NEW] 성기사 검기 (초승달 은빛 궤적)
            ctx.strokeStyle = '#93c5fd';
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 12;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 14, Math.PI * 0.8, Math.PI * 2.2);
            ctx.stroke();
        } else if (this.type === 'drone_missile') {
            // [NEW] 드론 유도 미사일
            ctx.fillStyle = '#22d3ee';
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x - 2, this.y + 4, 4, 8);
        } else if (this.type === 'tesla_bolt') {
            // [NEW] 테슬라 전자기 스파크
            ctx.strokeStyle = '#e879f9';
            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = 15;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(this.x - 6, this.y + 12);
            ctx.lineTo(this.x + 4, this.y);
            ctx.lineTo(this.x - 3, this.y - 6);
            ctx.lineTo(this.x + 5, this.y - 14);
            ctx.stroke();
        } else if (this.type === 'mortar_shell') {
            // [NEW] 박격포 화염 포탄
            ctx.fillStyle = '#f97316';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'sniper_bullet') {
            // [NEW] 저격수 초고속 레드 트레이서 탄환
            ctx.strokeStyle = '#ef4444';
            ctx.shadowColor = '#dc2626';
            ctx.shadowBlur = 10;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + 24);
            ctx.lineTo(this.x, this.y - 20);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x, this.y - 20, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'holy_blade') {
            // [NEW] 수호기사 황금빛 대검 검기
            ctx.strokeStyle = '#fde047';
            ctx.shadowColor = '#eab308';
            ctx.shadowBlur = 16;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + 18);
            ctx.lineTo(this.x, this.y - 16);
            ctx.stroke();
            ctx.strokeRect(this.x - 9, this.y + 4, 18, 4);
        } else if (this.type === 'phoenix_fire') {
            // [NEW] 불사조 화염 돌풍
            ctx.fillStyle = '#ea580c';
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 7, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'laser_beam') {
            // [NEW] 프리즘 레이저 고출력 빔
            ctx.fillStyle = '#22d3ee';
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 22;
            ctx.fillRect(this.x - 8, this.y - 35, 16, 70);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.x - 3, this.y - 30, 6, 60);
        } else if (this.type === 'earthquake') {
            // [NEW] 골렘 지진파 링
            ctx.strokeStyle = '#94a3b8';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 16;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 18, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === 'titan_plasma') {
            // [NEW] 타이탄 초거대 플라즈마 구체
            ctx.fillStyle = '#c084fc';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 24;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// 4. 파티클 이펙트
class TextParticle {
    constructor(x, y, text, color = '#fff', isCrit = false) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.isCrit = isCrit;
        this.life = 0.8;
        this.maxLife = 0.8;
        this.vy = -45;
    }

    update(dt) {
        this.life -= dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.font = this.isCrit ? 'bold 20px sans-serif' : 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class SparkParticle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 0.4 + Math.random() * 0.3;
        this.maxLife = this.life;
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 120;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = 2 + Math.random() * 3;
    }

    update(dt) {
        this.life -= dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 5. [NEW] 기사단 벙커 및 10종 스포너에서 출격하는 아군 전투 유닛 (방벽 통과 가능)
class Warrior {
    constructor(lane, x, y, hp, damage, hasArmor, grid, unitType = 'warrior', extra = {}) {
        this.lane = lane;
        this.x = x;
        this.y = y;
        this.hp = hp;
        this.maxHp = hp;
        this.damage = damage;
        this.hasArmor = hasArmor;
        this.grid = grid;
        this.unitType = unitType;
        this.extra = extra;
        this.dead = false;
        this.attackCooldown = 0;
        this.animTimer = 0;
        this.hurtTimer = 0;
        this.shootTimer = 0;
        this.healTimer = 0;
        this.chargeHit = false;

        // 유닛별 고유 기본값
        this.speed = 65;
        this.range = 32;
        this.attackInterval = 0.7;

        switch (unitType) {
            case 'hound':
                this.speed = 95;
                this.attackInterval = 0.45;
                this.range = 28;
                break;
            case 'spearman':
                this.speed = 60;
                this.attackInterval = 0.75;
                this.range = 48;
                break;
            case 'ranger':
                this.speed = 55;
                this.attackInterval = 0.65;
                this.range = 30;
                this.shootRange = 140;
                break;
            case 'shieldman':
                this.speed = 50;
                this.attackInterval = 0.9;
                this.range = 32;
                this.dmgReduction = 0.50;
                break;
            case 'skeleton':
                this.speed = 72;
                this.attackInterval = 0.5;
                this.range = 28;
                break;
            case 'cavalry':
                this.speed = 105;
                this.attackInterval = 0.8;
                this.range = 35;
                break;
            case 'cleric':
                this.speed = 48;
                this.attackInterval = 1.0;
                this.range = 30;
                this.healAmount = extra.healAmount || 80;
                break;
            case 'valkyrie':
                this.speed = 80;
                this.attackInterval = 0.75;
                this.range = 38;
                break;
            case 'mecha':
                this.speed = 42;
                this.attackInterval = 0.85;
                this.range = 36;
                this.shootRange = 150;
                break;
            case 'drake':
                this.speed = 68;
                this.attackInterval = 0.6;
                this.range = 45;
                break;
            case 'archangel':
                this.speed = 60;
                this.attackInterval = 0.7;
                this.range = 50;
                break;
            default: // warrior
                this.speed = 65;
                this.attackInterval = 0.7;
                this.range = 32;
                break;
        }
    }

    update(dt, monsters, particles, projectiles = [], towers = [], allies = []) {
        this.animTimer += dt;
        if (this.hurtTimer > 0) this.hurtTimer -= dt;

        // 1. 성직자(cleric) 지원 치유
        if (this.unitType === 'cleric' && allies && allies.length > 0) {
            this.healTimer += dt;
            if (this.healTimer >= 1.2) {
                this.healTimer = 0;
                const injured = allies.find(a => a !== this && !a.dead && Math.abs(a.lane - this.lane) <= 1 && Math.abs(a.y - this.y) < 100 && a.hp < a.maxHp);
                if (injured) {
                    const heal = this.hasArmor ? Math.round(this.healAmount * 1.5) : this.healAmount;
                    injured.hp = Math.min(injured.maxHp, injured.hp + heal);
                    particles.push(new TextParticle(injured.x, injured.y - 20, `+${heal} HP`, '#10b981', true));
                    for (let i = 0; i < 6; i++) {
                        particles.push(new SparkParticle(injured.x, injured.y, '#34d399'));
                    }
                }
            }
        }

        // 2. 대천사(archangel) 신성 오라: 주변 아군 지속 재생
        if (this.unitType === 'archangel' && allies && allies.length > 0) {
            this.healTimer += dt;
            if (this.healTimer >= 1.0) {
                this.healTimer = 0;
                allies.filter(a => a !== this && !a.dead && Math.abs(a.lane - this.lane) <= 1 && Math.abs(a.y - this.y) < 100 && a.hp < a.maxHp)
                    .forEach(a => {
                        a.hp = Math.min(a.maxHp, a.hp + 35);
                        particles.push(new SparkParticle(a.x, a.y, '#fef08a'));
                    });
            }
        }

        // 3. 원거리 사격 지원 (레인저, 메카)
        if (this.unitType === 'ranger' && projectiles) {
            this.shootTimer += dt;
            const shootInterval = this.hasArmor ? 0.45 : 0.75;
            if (this.shootTimer >= shootInterval) {
                const frontTarget = monsters.find(m => m.lane === this.lane && m.hp > 0 && m.y < this.y && (this.y - m.y) <= (this.shootRange || 140));
                if (frontTarget) {
                    this.shootTimer = 0;
                    window.soundEngine.playShoot();
                    projectiles.push(new Projectile(this.x, this.y - 12, frontTarget, 'arrow', Math.round(this.damage * 0.85), 650, this.lane));
                }
            }
        } else if (this.unitType === 'mecha' && projectiles) {
            this.shootTimer += dt;
            const shootInterval = this.hasArmor ? 0.6 : 1.0;
            if (this.shootTimer >= shootInterval) {
                const frontTarget = monsters.find(m => Math.abs(m.lane - this.lane) <= 1 && m.hp > 0 && m.y < this.y && (this.y - m.y) <= (this.shootRange || 150));
                if (frontTarget) {
                    this.shootTimer = 0;
                    window.soundEngine.playShoot();
                    projectiles.push(new Projectile(this.x, this.y - 15, frontTarget, 'missile', this.damage, 700, this.lane, { splash: 65 }));
                }
            }
        }

        // 4. 전방 교전 중인 적 몬스터 검사 (전사는 방벽 통과 가능)
        const target = monsters.find(m => m.lane === this.lane && m.hp > 0 && Math.abs(m.y - this.y) < this.range);

        if (target) {
            this.attackCooldown += dt;
            if (this.attackCooldown >= this.attackInterval) {
                this.attackCooldown = 0;

                // 유닛 타입별 고유 공격 메커니즘
                if (this.unitType === 'cavalry') {
                    // 돌격 기마대: 첫 충돌 시 1.8배 광역 피해 + 40px 밀쳐내기
                    if (!this.chargeHit) {
                        this.chargeHit = true;
                        target.y = Math.max(80, target.y - 40);
                        target.takeDamage(Math.round(this.damage * 1.8), particles, 'crit');
                        particles.push(new TextParticle(this.x, this.y - 20, '💥 CHARGE!', '#f59e0b', true));
                        window.soundEngine.playExplosion();
                    } else {
                        target.y = Math.max(80, target.y - 15);
                        target.takeDamage(this.damage, particles, this.hasArmor ? 'crit' : 'hit');
                        window.soundEngine.playHit();
                    }
                } else if (this.unitType === 'shieldman') {
                    // 방패 근위병: 25px 넉백 방패 밀치기
                    target.y = Math.max(80, target.y - 25);
                    target.takeDamage(this.damage, particles, 'hit');
                    window.soundEngine.playHit();
                } else if (this.unitType === 'hound') {
                    // 군견: 빠른 물기 & 30% 감속 2초 부여
                    target.takeDamage(this.damage, particles, 'hit');
                    target.speedMultiplier = 0.70;
                    target.slowTimer = 2.0;
                    window.soundEngine.playHit();
                } else if (this.unitType === 'spearman') {
                    // 장창병: 전방 적 찌르기 & 후방 1체 관통
                    target.takeDamage(this.damage, particles, this.hasArmor ? 'crit' : 'hit');
                    const behind = monsters.find(m => m.lane === this.lane && m.hp > 0 && m !== target && Math.abs(m.y - this.y) < this.range + 35);
                    if (behind) behind.takeDamage(Math.round(this.damage * 0.6), particles, 'hit');
                    window.soundEngine.playHit();
                } else if (this.unitType === 'valkyrie') {
                    // 발키리: 전방 3체 동시 빛의 참격
                    const targets = monsters.filter(m => Math.abs(m.lane - this.lane) <= 1 && m.hp > 0 && Math.abs(m.y - this.y) < 45).slice(0, 3);
                    targets.forEach(t => t.takeDamage(this.damage, particles, 'crit'));
                    window.soundEngine.playShoot();
                } else if (this.unitType === 'drake') {
                    // 드레이크: 전방 레인 65px 화염 브레스 방사
                    const targets = monsters.filter(m => m.lane === this.lane && m.hp > 0 && m.y < this.y && (this.y - m.y) < 65);
                    targets.forEach(t => t.takeDamage(this.damage, particles, 'crit'));
                    window.soundEngine.playExplosion();
                } else if (this.unitType === 'archangel') {
                    // 대천사: 화면 레인 전체 신성 참격
                    const targets = monsters.filter(m => Math.abs(m.lane - this.lane) <= 1 && m.hp > 0 && Math.abs(m.y - this.y) < 70);
                    targets.forEach(t => t.takeDamage(this.damage, particles, 'crit'));
                    window.soundEngine.playFever();
                } else {
                    // 일반 전사 / 스켈레톤 / 힐러 등
                    window.soundEngine.playHit();
                    target.takeDamage(this.damage, particles, this.hasArmor ? 'crit' : 'hit');
                }

                this.y = Math.max(100, this.y + 4);

                // 몬스터의 반격 피해 계산
                let incomingDmg = Math.round(target.damage * 0.4);
                if (this.unitType === 'shieldman') incomingDmg = Math.round(incomingDmg * 0.50);
                if (this.unitType === 'archangel') incomingDmg = Math.round(incomingDmg * 0.30);
                if (this.hasArmor) incomingDmg = Math.round(incomingDmg * 0.65);
                this.hp -= Math.max(1, incomingDmg);
                this.hurtTimer = 0.15;

                if (this.hp <= 0) {
                    this.dead = true;
                    particles.push(new TextParticle(this.x, this.y - 15, `${this.unitType || '아군'} 전사`, '#94a3b8'));
                }
            }
        } else {
            // 북쪽(상단)으로 전진
            this.y -= this.speed * dt;
            if (this.y < 90) {
                this.dead = true;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const bob = Math.sin(this.animTimer * 10) * 2;

        if (this.hurtTimer > 0) {
            ctx.filter = 'brightness(1.6)';
        }

        // 그림자
        ctx.beginPath();
        const shadowW = (['cavalry', 'mecha', 'drake', 'archangel'].includes(this.unitType)) ? 18 : 12;
        ctx.ellipse(0, 10, shadowW, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        // 유닛 테마 설정
        const unitThemes = {
            'warrior': { fill: '#1e3a8a', stroke: '#93c5fd', icon: this.hasArmor ? '🛡️' : '⚔️', radius: 14 },
            'hound': { fill: '#78350f', stroke: '#fbbf24', icon: '🐕', radius: 13 },
            'spearman': { fill: '#14532d', stroke: '#86efac', icon: '🔱', radius: 14 },
            'ranger': { fill: '#064e3b', stroke: '#6ee7b7', icon: '🧝', radius: 14 },
            'shieldman': { fill: '#334155', stroke: '#cbd5e1', icon: '🛡️', radius: 17 },
            'skeleton': { fill: '#4a044e', stroke: '#e879f9', icon: '💀', radius: 12 },
            'cavalry': { fill: '#831843', stroke: '#f472b6', icon: '🐎', radius: 18 },
            'cleric': { fill: '#713f12', stroke: '#fde047', icon: '✝️', radius: 15 },
            'valkyrie': { fill: '#0369a1', stroke: '#7dd3fc', icon: '🪽', radius: 17 },
            'mecha': { fill: '#0f172a', stroke: '#38bdf8', icon: '🤖', radius: 20 },
            'drake': { fill: '#991b1b', stroke: '#fca5a5', icon: '🐲', radius: 19 },
            'archangel': { fill: '#78350f', stroke: '#fef08a', icon: '🌟', radius: 22 }
        };
        const theme = unitThemes[this.unitType] || unitThemes['warrior'];

        // 외형 서클 (갑옷 착용 시 골드 아머 테두리)
        ctx.fillStyle = this.hasArmor ? '#1e293b' : theme.fill;
        ctx.beginPath();
        ctx.arc(0, bob, theme.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = this.hasArmor ? '#f59e0b' : theme.stroke;
        ctx.lineWidth = this.hasArmor ? 3.5 : 2;
        if (this.hasArmor) {
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 10;
        }
        ctx.stroke();

        ctx.font = `${Math.round(theme.radius * 1.3)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(theme.icon, 0, bob);

        // 체력바
        const barW = Math.max(24, theme.radius * 1.8);
        const hpRatio = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-barW / 2, -theme.radius - 6 + bob, barW, 3.5);
        ctx.fillStyle = this.hasArmor ? '#38bdf8' : (this.unitType === 'cleric' ? '#fde047' : '#22c55e');
        ctx.fillRect(-barW / 2, -theme.radius - 6 + bob, barW * hpRatio, 3.5);

        ctx.restore();
    }
}

window.Tower = Tower;
window.Monster = Monster;
window.Projectile = Projectile;
window.TextParticle = TextParticle;
window.SparkParticle = SparkParticle;
window.Warrior = Warrior;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Tower, Monster, Projectile, TextParticle, SparkParticle, Warrior };
}

