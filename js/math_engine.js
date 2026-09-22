// 초등학생 대상 수학 문제 및 영단어 스킬(아군) 카드 생성 엔진 (8단계 승급 체계)
class MathEngine {
    constructor() {
        // 3단계 난이도 모드 정의 (초등 1~2학년, 3~4학년, 4~5학년)
        this.difficulty = 'beginner'; // 'beginner' | 'intermediate' | 'expert'
        this.difficultyInfo = {
            beginner: {
                id: 'beginner',
                name: '초보 단계',
                grade: '초등 1~2학년',
                desc: '1+1 덧셈 · 1+11 덧셈 · 1×1 구구단',
                badge: '🌱 초보',
                color: '#22c55e'
            },
            intermediate: {
                id: 'intermediate',
                name: '중수 단계',
                grade: '초등 3~4학년',
                desc: '11+11 덧셈 · 1-1 / 11-1 뺄셈 · 1×11 빠른 곱셈',
                badge: '⚔️ 중수',
                color: '#0284c7'
            },
            expert: {
                id: 'expert',
                name: '고수 단계',
                grade: '초등 4~5학년',
                desc: '호환수 나눗셈 · 분수 연산 · 소수 계산',
                badge: '👑 고수',
                color: '#f59e0b'
            }
        };

        // 8단계 스코어 승급 체계 정의
        this.tiers = [
            { tier: 1, name: '초심자', minScore: 0, mathDesc: '기초 연산 훈련' },
            { tier: 2, name: '견습 수호자', minScore: 500, mathDesc: '수학 감각 배양' },
            { tier: 3, name: '정예 수호자', minScore: 1200, mathDesc: '중급 계산 돌파' },
            { tier: 4, name: '베테랑 마법사', minScore: 2200, mathDesc: '연산 숙달' },
            { tier: 5, name: '마스터 디펜더', minScore: 3500, mathDesc: '고급 응용 연산' },
            { tier: 6, name: '대마법사', minScore: 5200, mathDesc: '마법 연산 집중' },
            { tier: 7, name: '그랜드 마스터', minScore: 7300, mathDesc: '극의의 계산' },
            { tier: 8, name: '전장의 수호신', minScore: 10000, mathDesc: '완전 연산 정복' }
        ];

        // 8단계별 스킬(아군) 템플릿 (타워 15종 + 스포너/유닛 12종 + 버프 1종 + 12종 마법 = 총 40종 카드)
        this.unitTemplates = {
            1: [
                {
                    word: 'ARCHER',
                    name: '개틀링 궁수',
                    icon: '🏹',
                    type: 'archer',
                    hp: 400,
                    damage: 25,
                    attackSpeed: 0.22,
                    duration: 40,
                    desc: '위험 레인에 고속 화살 3발 집중 사격 (지속 40초)'
                },
                {
                    word: 'WALL',
                    name: '타이탄 방벽',
                    icon: '🛡️',
                    type: 'defense',
                    wallSpread: 1,
                    hp: 3000,
                    damage: 0,
                    healBase: 15,
                    duration: 50,
                    desc: '좌우 +1칸(3개 레인) 돌벽 구축 & 기지 체력 +15 수리 (지속 50초)'
                },
                {
                    word: 'KNIGHT',
                    name: '기사단 벙커',
                    icon: '🏰',
                    type: 'knight',
                    isBunker: true,
                    hp: 800,
                    damage: 35,
                    attackSpeed: 2.50,
                    duration: 45,
                    desc: '기사단 벙커 구축 & 돌격 전사 출격 (방벽 통과, 지속 45초)'
                },
                {
                    word: 'HOUND',
                    name: '돌격 군견 훈련소',
                    icon: '🐕',
                    type: 'spawner_hound',
                    isBunker: true,
                    hp: 600,
                    damage: 25,
                    attackSpeed: 2.0,
                    duration: 45,
                    desc: '군견 훈련소 구축 & 날쌘 군견 출격 (초고속 이동, 몬스터 감속 30%, 지속 45초)'
                }
            ],
            2: [
                {
                    word: 'TRAP',
                    name: '맹독 거미덧',
                    icon: '🕸️',
                    type: 'trap',
                    hp: 900,
                    damage: 55,
                    slowRatio: 0.2,
                    slowDuration: 4.0,
                    duration: 35,
                    desc: '전방 레인에 맹독 거미망 투척 (80% 감속 & 맹독 폭발, 지속 35초)'
                },
                {
                    word: 'FROST',
                    name: '빙결 크리스탈',
                    icon: '❄️',
                    type: 'frost',
                    hp: 550,
                    damage: 40,
                    slowRatio: 0.4,
                    freezeDuration: 2.5,
                    duration: 45,
                    desc: '냉기 파동으로 전방 적 전원 2.5초 결빙 & 냉기 폭발 (지속 45초)'
                },
                {
                    word: 'DRONE',
                    name: '가디언 드론',
                    icon: '🛸',
                    type: 'drone',
                    hp: 450,
                    damage: 30,
                    attackSpeed: 0.25,
                    duration: 40,
                    desc: '좌우 1레인 범위 유도 펄스 미사일 사격 (지속 40초)'
                },
                {
                    word: 'SPEAR',
                    name: '장창병 주둔지',
                    icon: '🔱',
                    type: 'spawner_spear',
                    isBunker: true,
                    hp: 700,
                    damage: 45,
                    attackSpeed: 2.6,
                    duration: 45,
                    desc: '장창병 주둔지 구축 & 장창병 출격 (긴 사거리 찌르기 관통 공격, 지속 45초)'
                },
                {
                    word: 'RANGER',
                    name: '순찰 레인저 캠프',
                    icon: '🧝',
                    type: 'spawner_ranger',
                    isBunker: true,
                    hp: 650,
                    damage: 38,
                    attackSpeed: 2.8,
                    duration: 45,
                    desc: '순찰 레인저 캠프 구축 & 이동형 궁수 출격 (전진 화살 사격, 지속 45초)'
                },
                {
                    word: 'X2',
                    name: '더블 증폭',
                    icon: '⚡',
                    type: 'buff',
                    isBuff: true,
                    damage: 0,
                    hp: 1,
                    duration: 0,
                    desc: '보드 위 타워/유닛에 장착! 지속시간 +30%(특수 +50%) 및 2배 공격/갑옷 강화 (최대 3회 중첩)'
                }
            ],
            3: [
                {
                    word: 'CANNON',
                    name: '메가 블래스트 캐논',
                    icon: '🚀',
                    type: 'cannon',
                    hp: 750,
                    damage: 130,
                    splash: 120,
                    duration: 45,
                    desc: '대구경 폭발 포탄으로 밀집된 몬스터 무리 일격 소탕 (지속 45초)'
                },
                {
                    word: 'LIGHTNING',
                    name: '체인 라이트닝',
                    icon: '⚡',
                    type: 'spell_lightning',
                    damage: 180,
                    chainCount: 8,
                    isSpell: true,
                    desc: '8체의 적에게 연쇄 번개를 내리쳐 즉사급 피해'
                },
                {
                    word: 'TESLA',
                    name: '테슬라 코일탑',
                    icon: '🗼',
                    type: 'tesla',
                    hp: 700,
                    damage: 85,
                    attackSpeed: 0.70,
                    duration: 45,
                    desc: '3체 연쇄 전자기 볼트 방출 & 0.4초 감전 (지속 45초)'
                },
                {
                    word: 'MORTAR',
                    name: '화염 박격포병',
                    icon: '🔥',
                    type: 'mortar',
                    hp: 650,
                    damage: 160,
                    splash: 110,
                    attackSpeed: 1.20,
                    duration: 45,
                    desc: '장거리 곡사 화염 포탄 투하 & 110px 광역 폭발 (지속 45초)'
                },
                {
                    word: 'WALL+2',
                    name: '대형 방벽',
                    icon: '🧱',
                    type: 'defense',
                    wallSpread: 2,
                    hp: 3000,
                    damage: 0,
                    healBase: 30,
                    duration: 50,
                    desc: '좌우 +2칸(최대 5레인) 돌벽 구축 & 기지 체력 +30 수리 (지속 50초)'
                },
                {
                    word: 'LURKER',
                    name: '잠복 럴커',
                    icon: '🦂',
                    type: 'trap_lurker',
                    isTrap: true,
                    hp: 900,
                    damage: 65,
                    attackSpeed: 1.0,
                    duration: 45,
                    desc: '바닥에 잠복하여 사방(상/하/좌/우)으로 가시를 분출해 관통 피해 (지속 45초)'
                },
                {
                    word: 'BARRACKS',
                    name: '철벽 근위병영',
                    icon: '🏛️',
                    type: 'spawner_barracks',
                    isBunker: true,
                    hp: 1100,
                    damage: 40,
                    attackSpeed: 3.0,
                    duration: 50,
                    desc: '철벽 근위병영 구축 & 방패 근위병 출격 (고체력 400HP, 방패 밀치기 넉백, 지속 50초)'
                },
                {
                    word: 'SKELETON',
                    name: '망자의 묘지',
                    icon: '☠️',
                    type: 'spawner_skeleton',
                    isBunker: true,
                    hp: 650,
                    damage: 30,
                    attackSpeed: 2.4,
                    duration: 45,
                    desc: '망자의 묘지 구축 & 해골 전사 2체 동시 출격 (빠른 연타, 물량 우위, 지속 45초)'
                }
            ],
            4: [
                {
                    word: 'TANK',
                    name: '하이퍼 레일건 탱크',
                    icon: '🚜',
                    type: 'tank',
                    hp: 2400,
                    damage: 220,
                    pierce: true,
                    duration: 60,
                    desc: '레인 전체를 일직선 관통하는 초고출력 레이저 빔 (지속 60초)'
                },
                {
                    word: 'METEOR',
                    name: '메테오 폭탄',
                    icon: '💣',
                    type: 'spell_bomb',
                    damage: 450,
                    splash: 160,
                    isSpell: true,
                    desc: '상공에서 거대 운석이 낙하하여 광역 적 전멸'
                },
                {
                    word: 'SNIPER',
                    name: '호크아이 저격수',
                    icon: '🎯',
                    type: 'sniper',
                    hp: 500,
                    damage: 320,
                    attackSpeed: 1.40,
                    duration: 50,
                    desc: '원거리 정밀 저격 100% 치명타 (지속 50초)'
                },
                {
                    word: 'CAVALRY',
                    name: '돌격 기마대 요새',
                    icon: '🐎',
                    type: 'spawner_cavalry',
                    isBunker: true,
                    hp: 1200,
                    damage: 110,
                    attackSpeed: 3.5,
                    duration: 50,
                    desc: '돌격 기마대 요새 구축 & 중갑 기마병 출격 (고속 돌진 들이받기 & 광역 넉백, 지속 50초)'
                },
                {
                    word: 'CLERIC',
                    name: '성스러운 성소',
                    icon: '⛪',
                    type: 'spawner_cleric',
                    isBunker: true,
                    hp: 800,
                    damage: 45,
                    healAmount: 80,
                    attackSpeed: 3.5,
                    duration: 50,
                    desc: '성스러운 성소 구축 & 치유 성직자 출격 (전방 아군 치료 + 신성 강타, 지속 50초)'
                },
                {
                    word: 'X2',
                    name: '더블 증폭',
                    icon: '⚡',
                    type: 'buff',
                    isBuff: true,
                    damage: 0,
                    hp: 1,
                    duration: 0,
                    desc: '보드 위 타워/유닛에 장착! 지속시간 +30%(특수 +50%) 및 2배 공격/갑옷 강화 (최대 3회 중첩)'
                }
            ],
            5: [
                {
                    word: 'BLIZZARD',
                    name: '절대영도 블리자드',
                    icon: '🌨️',
                    type: 'spell_blizzard',
                    damage: 180,
                    freezeDuration: 4.5,
                    isSpell: true,
                    desc: '전 화면의 모든 적을 4.5초간 완전 동결 및 냉기 피해'
                },
                {
                    word: 'VALKYRIE',
                    name: '발키리 돌격',
                    icon: '⚔️',
                    type: 'spell_valkyrie',
                    damage: 400,
                    isSpell: true,
                    desc: '빛의 발키리가 전장을 휩쓸며 적들을 양단'
                },
                {
                    word: 'PALADIN',
                    name: '천상의 수호기사',
                    icon: '🛡️',
                    type: 'paladin',
                    hp: 3500,
                    damage: 120,
                    attackSpeed: 0.80,
                    duration: 55,
                    desc: '황금 결계를 두르고 주변 아군 보호 및 전방 도발 (지속 55초)'
                },
                {
                    word: 'PHOENIX',
                    name: '화염 불사조',
                    icon: '🦅',
                    type: 'phoenix',
                    hp: 800,
                    damage: 150,
                    attackSpeed: 0.50,
                    duration: 50,
                    desc: '전방 레인에 화염 돌풍을 지속 방출하여 적 무리 소각 (지속 50초)'
                },
                {
                    word: 'VALKYRIE_CAMP',
                    name: '발키리 강림 진영',
                    icon: '🪽',
                    type: 'spawner_valkyrie',
                    isBunker: true,
                    hp: 1400,
                    damage: 160,
                    attackSpeed: 3.8,
                    duration: 55,
                    desc: '발키리 진영 구축 & 날개 달린 발키리 출격 (비행 돌진, 전방 3체 동시 참격, 지속 55초)'
                }
            ],
            6: [
                {
                    word: 'ORBITAL',
                    name: '플라즈마 궤도폭격',
                    icon: '🛸',
                    type: 'spell_orbital',
                    damage: 650,
                    isSpell: true,
                    desc: '위성 궤도에서 3개 레인 동시 초강력 플라즈마 융단폭격'
                },
                {
                    word: 'DRAGON',
                    name: '드래곤 브레스',
                    icon: '🐉',
                    type: 'spell_dragon',
                    damage: 750,
                    isSpell: true,
                    desc: '화염 드래곤이 전방 전체에 지옥의 화염을 토해냄'
                },
                {
                    word: 'LASER',
                    name: '프리즘 레이저포',
                    icon: '📡',
                    type: 'laser',
                    hp: 900,
                    damage: 280,
                    attackSpeed: 0.35,
                    duration: 55,
                    desc: '레인 전체 관통 프리즘 광선 빔 (지속 55초)'
                },
                {
                    word: 'MECHA',
                    name: '골리앗 메카 격납고',
                    icon: '🤖',
                    type: 'spawner_mecha',
                    isBunker: true,
                    hp: 1800,
                    damage: 240,
                    attackSpeed: 4.2,
                    duration: 55,
                    desc: '메카 격납고 구축 & 이족보행 골리앗 출격 (철갑 방어력, 미사일 난사, 지속 55초)'
                }
            ],
            7: [
                {
                    word: 'VOLCANO',
                    name: '볼케이노 대폭발',
                    icon: '🌋',
                    type: 'spell_volcano',
                    damage: 1100,
                    isSpell: true,
                    desc: '전 화면에 화산 분화구가 솟구치며 치명적 용암 폭격'
                },
                {
                    word: 'DIVINE',
                    name: '신성 결계',
                    icon: '✨',
                    type: 'spell_divine',
                    healBase: 35,
                    pushBack: 220,
                    isSpell: true,
                    desc: '기지 체력 +35 대량 회복 & 전체 적을 먼 지평선으로 넉백'
                },
                {
                    word: 'GOLEM',
                    name: '고대 룬 골렘',
                    icon: '🗿',
                    type: 'golem',
                    hp: 5000,
                    damage: 350,
                    attackSpeed: 1.10,
                    splash: 120,
                    duration: 60,
                    desc: '지면을 내려찍어 지진파 발생 & 레인 내 적 스턴 (지속 60초)'
                },
                {
                    word: 'DRAKE',
                    name: '드래곤 부화 둥지',
                    icon: '🐲',
                    type: 'spawner_drake',
                    isBunker: true,
                    hp: 2200,
                    damage: 340,
                    attackSpeed: 4.5,
                    duration: 60,
                    desc: '드래곤 둥지 구축 & 화염 드레이크 출격 (비행 브레스, 레인 화염 방사, 지속 60초)'
                }
            ],
            8: [
                {
                    word: 'APOCALYPSE',
                    name: '아포칼립스 심판',
                    icon: '👑',
                    type: 'spell_apocalypse',
                    damage: 2800,
                    isSpell: true,
                    desc: '신의 심판의 빛이 전 화면의 모든 일반/엘리트 몬스터를 즉시 증발'
                },
                {
                    word: 'CHRONOS',
                    name: '크로노스 시간정지',
                    icon: '⏳',
                    type: 'spell_timestop',
                    duration: 6.0,
                    isSpell: true,
                    desc: '6초 동안 전장의 모든 적을 완전 정지 상태로 만듦'
                },
                {
                    word: 'TITAN',
                    name: '천공의 거신 타이탄',
                    icon: '🤖',
                    type: 'titan',
                    hp: 7500,
                    damage: 550,
                    attackSpeed: 0.60,
                    duration: 60,
                    desc: '3개 레인 동시 플라즈마 캐논 난사 & 기지 완벽 방어 (지속 60초)'
                },
                {
                    word: 'ARCHANGEL',
                    name: '대천사 강림 제단',
                    icon: '🌟',
                    type: 'spawner_archangel',
                    isBunker: true,
                    hp: 3000,
                    damage: 650,
                    attackSpeed: 5.0,
                    duration: 65,
                    desc: '대천사 제단 구축 & 신성 대천사 출격 (황금 오라, 광역 신성 일격, 아군 피해 50% 감소, 지속 65초)'
                }
            ]
        };
    }

    // 난이도 설정 및 조회
    setDifficulty(diff) {
        if (this.difficultyInfo[diff]) {
            this.difficulty = diff;
        }
    }

    getDifficultyInfo(diff = null) {
        return this.difficultyInfo[diff || this.difficulty] || this.difficultyInfo.beginner;
    }

    // 값의 숫자 정렬용 크기(sortVal) 계산 (분수 '3/5', 소수 '0.8', 정수 15 등 호환)
    getSortValue(val) {
        if (typeof val === 'number') return val;
        const s = String(val).trim();
        if (s.includes('/')) {
            const parts = s.split('/');
            const n = parseFloat(parts[0]);
            const d = parseFloat(parts[1]);
            return (d !== 0 && !isNaN(d)) ? n / d : 0;
        }
        const num = parseFloat(s);
        return isNaN(num) ? 0 : num;
    }

    // 스코어에 따른 현재 티어 데이터 조회 (1~8단계)
    getTierData(score) {
        let currentTier = this.tiers[0];
        for (let i = this.tiers.length - 1; i >= 0; i--) {
            if (score >= this.tiers[i].minScore) {
                currentTier = this.tiers[i];
                break;
            }
        }
        return currentTier;
    }

    // 랜덤 정수 반환 [min, max]
    rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 배열 셔플
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ==========================================
    // 1. [🌱 초보 단계: 초등 1~2학년] 연산 생성기
    // ==========================================

    // 1-1. 1 + 1 (1자리수 + 1자리수 덧셈)
    genSingleSingleAdd() {
        const a = this.rand(1, 9);
        const b = this.rand(1, 9);
        const ans = a + b;
        return {
            question: `${a} + ${b}`,
            answer: ans,
            answerNum: ans,
            typeId: 1,
            typeName: '1자리 덧셈 (1+1)',
            offsets: [-2, -1, 1, 2, -3, 3]
        };
    }

    // 1-2. 1 + 11 (1자리수 + 2자리수 덧셈)
    genSingleDoubleAdd() {
        const isSingleFirst = Math.random() < 0.5;
        const single = this.rand(1, 9);
        const double = this.rand(10, 29);
        const a = isSingleFirst ? single : double;
        const b = isSingleFirst ? double : single;
        const ans = a + b;
        return {
            question: `${a} + ${b}`,
            answer: ans,
            answerNum: ans,
            typeId: 2,
            typeName: '1자리+2자리 덧셈 (1+11)',
            offsets: [-10, 10, -2, -1, 1, 2, -5, 5]
        };
    }

    // 1-3. 1 × 1 (1자리수 기초 구구단 1단~9단)
    genBasicMultiplication() {
        const a = this.rand(2, 9);
        const b = this.rand(1, 9);
        const ans = a * b;
        return {
            question: `${a} × ${b}`,
            answer: ans,
            answerNum: ans,
            typeId: 3,
            typeName: '기초 구구단 (1×1)',
            offsets: [-a, a, -b, b, -1, 1, -2, 2, -5, 5]
        };
    }

    // ==========================================
    // 2. [⚔️ 중수 단계: 초등 3~4학년] 연산 생성기
    // ==========================================

    // 2-1. 11 + 11 (2자리수 + 2자리수 덧셈)
    genDoubleDoubleAdd() {
        const a = this.rand(11, 49);
        const b = this.rand(11, 49);
        const ans = a + b;
        return {
            question: `${a} + ${b}`,
            answer: ans,
            answerNum: ans,
            typeId: 11,
            typeName: '2자리 덧셈 (11+11)',
            offsets: [-10, 10, -1, 1, -2, 2, -5, 5, -9, 9]
        };
    }

    // 2-2. 1 - 1 (1자리수 - 1자리수 뺄셈)
    genSingleSingleSub() {
        const a = this.rand(2, 9);
        const b = this.rand(1, a - 1); // 1 이상의 양수 결과
        const ans = a - b;
        return {
            question: `${a} - ${b}`,
            answer: ans,
            answerNum: ans,
            typeId: 12,
            typeName: '1자리 뺄셈 (1-1)',
            offsets: [-2, -1, 1, 2, -3, 3]
        };
    }

    // 2-3. 11 - 1 (2자리수 - 1자리수 뺄셈)
    genDoubleSingleSub() {
        const a = this.rand(11, 39);
        const b = this.rand(2, 9);
        const ans = a - b;
        return {
            question: `${a} - ${b}`,
            answer: ans,
            answerNum: ans,
            typeId: 13,
            typeName: '2자리-1자리 뺄셈 (11-1)',
            offsets: [-10, 10, -2, -1, 1, 2, -5, 5]
        };
    }

    // 2-4. 1 × 11 (호환수 및 10, 5, 2 단위 빠른 암산 곱셈)
    genCompatibleMultiplication() {
        const sub = this.rand(1, 4);
        let a, b, ans;

        if (sub === 1) {
            // 10단위 배수 (예: 3 × 10 = 30, 4 × 20 = 80, 2 × 30 = 60)
            const tens = [10, 20, 30, 40][this.rand(0, 3)];
            const single = this.rand(2, tens === 10 ? 9 : (tens === 20 ? 5 : 3));
            a = Math.random() < 0.5 ? single : tens;
            b = a === single ? tens : single;
            ans = a * b;
        } else if (sub === 2) {
            // 5단위 호환수 (예: 2 × 15 = 30, 4 × 15 = 60, 6 × 15 = 90, 2 × 25 = 50, 4 × 25 = 100)
            const fivPairs = [
                [2, 15], [3, 15], [4, 15], [6, 15], [8, 15],
                [2, 25], [3, 25], [4, 25], [2, 35]
            ];
            const p = fivPairs[this.rand(0, fivPairs.length - 1)];
            const isSingleFirst = Math.random() < 0.5;
            a = isSingleFirst ? p[0] : p[1];
            b = isSingleFirst ? p[1] : p[0];
            ans = a * b;
        } else if (sub === 3) {
            // 2/짝수 호환수 (예: 2 × 12 = 24, 3 × 12 = 36, 4 × 12 = 48, 5 × 12 = 60, 2 × 14 = 28, 2 × 16 = 32)
            const evenPairs = [
                [2, 12], [3, 12], [4, 12], [5, 12],
                [2, 14], [3, 14], [2, 16], [3, 16], [2, 18]
            ];
            const p = evenPairs[this.rand(0, evenPairs.length - 1)];
            const isSingleFirst = Math.random() < 0.5;
            a = isSingleFirst ? p[0] : p[1];
            b = isSingleFirst ? p[1] : p[0];
            ans = a * b;
        } else {
            // 11의 배수 (예: 2 × 11 = 22, 3 × 11 = 33, 4 × 11 = 44, 5 × 11 = 55, 7 × 11 = 77)
            const single = this.rand(2, 9);
            a = Math.random() < 0.5 ? single : 11;
            b = a === single ? 11 : single;
            ans = a * b;
        }

        return {
            question: `${a} × ${b}`,
            answer: ans,
            answerNum: ans,
            typeId: 14,
            typeName: '호환수 빠른 곱셈 (1×11)',
            offsets: [-10, 10, -5, 5, -2, 2, -11, 11]
        };
    }

    // ==========================================
    // 3. [👑 고수 단계: 초등 4~5학년] 연산 생성기
    // ==========================================

    // 3-1. 호환수의 나눗셈 (구구단 및 10/5/2 호환수)
    genElementaryDivision() {
        const isTens = Math.random() < 0.45;
        let q, ans;

        if (isTens) {
            // 10/5/2 호환수 나눗셈 (예: 40 ÷ 4 = 10, 48 ÷ 4 = 12, 60 ÷ 5 = 12, 100 ÷ 4 = 25)
            const tensPairs = [
                { q: '40 ÷ 4', a: 10 }, { q: '48 ÷ 4', a: 12 }, { q: '50 ÷ 5', a: 10 },
                { q: '60 ÷ 5', a: 12 }, { q: '60 ÷ 3', a: 20 }, { q: '75 ÷ 3', a: 25 },
                { q: '80 ÷ 4', a: 20 }, { q: '84 ÷ 4', a: 21 }, { q: '90 ÷ 3', a: 30 },
                { q: '96 ÷ 3', a: 32 }, { q: '100 ÷ 4', a: 25 }, { q: '100 ÷ 5', a: 20 },
                { q: '120 ÷ 6', a: 20 }, { q: '150 ÷ 5', a: 30 }, { q: '200 ÷ 4', a: 50 }
            ];
            const p = tensPairs[this.rand(0, tensPairs.length - 1)];
            q = p.q;
            ans = p.a;
        } else {
            // 구구단 나눗셈 (예: 18 ÷ 3 = 6, 24 ÷ 4 = 6, 36 ÷ 6 = 6, 56 ÷ 8 = 7, 72 ÷ 8 = 9)
            const guguPairs = [
                { q: '18 ÷ 3', a: 6 }, { q: '24 ÷ 4', a: 6 }, { q: '24 ÷ 3', a: 8 },
                { q: '28 ÷ 4', a: 7 }, { q: '32 ÷ 4', a: 8 }, { q: '35 ÷ 5', a: 7 },
                { q: '36 ÷ 6', a: 6 }, { q: '36 ÷ 4', a: 9 }, { q: '40 ÷ 5', a: 8 },
                { q: '42 ÷ 6', a: 7 }, { q: '42 ÷ 7', a: 6 }, { q: '45 ÷ 5', a: 9 },
                { q: '48 ÷ 6', a: 8 }, { q: '48 ÷ 8', a: 6 }, { q: '54 ÷ 6', a: 9 },
                { q: '56 ÷ 7', a: 8 }, { q: '56 ÷ 8', a: 7 }, { q: '63 ÷ 7', a: 9 },
                { q: '64 ÷ 8', a: 8 }, { q: '72 ÷ 8', a: 9 }, { q: '72 ÷ 9', a: 8 },
                { q: '81 ÷ 9', a: 9 }
            ];
            const p = guguPairs[this.rand(0, guguPairs.length - 1)];
            q = p.q;
            ans = p.a;
        }

        return {
            question: q,
            answer: ans,
            answerNum: ans,
            typeId: 21,
            typeName: '호환수 나눗셈',
            offsets: [-3, -2, -1, 1, 2, 3, -5, 5]
        };
    }

    // 3-2. 분수 연산 (동모분수 덧셈/뺄셈, 자연수가 되는 분수, 자연수의 분수)
    genFractionProblem() {
        const sub = this.rand(1, 4);

        if (sub === 1) {
            // A. 동모분수 덧셈 (예: 1/5 + 2/5 = 3/5, 2/7 + 3/7 = 5/7)
            const d = [5, 6, 7, 8, 9, 10][this.rand(0, 5)];
            const maxN = d - 1;
            const a = this.rand(1, maxN - 1);
            const b = this.rand(1, maxN - a);
            const sum = a + b;
            const ansStr = `${sum}/${d}`;
            const options = [ansStr];
            const diffs = [-2, -1, 1, 2];
            for (let df of diffs) {
                const optN = sum + df;
                if (optN > 0 && optN < d && !options.includes(`${optN}/${d}`)) {
                    options.push(`${optN}/${d}`);
                }
            }
            let tries = 0;
            while (options.length < 4 && tries++ < 25) {
                const fake = this.rand(1, d - 1);
                if (!options.includes(`${fake}/${d}`)) options.push(`${fake}/${d}`);
            }
            while (options.length < 4) {
                const fallbackN = (sum + options.length) % (d + 2) + 1;
                const fb = `${fallbackN}/${d}`;
                if (!options.includes(fb)) options.push(fb);
                else options.push(`${options.length + 1}/${d}`);
            }
            return {
                question: `${a}/${d} + ${b}/${d}`,
                answer: ansStr,
                answerNum: sum / d,
                typeId: 22,
                typeName: '동모분수 덧셈',
                customOptions: options
            };
        } else if (sub === 2) {
            // B. 동모분수 뺄셈 (예: 4/7 - 1/7 = 3/7, 5/8 - 2/8 = 3/8)
            const d = [5, 6, 7, 8, 9, 10][this.rand(0, 5)];
            const a = this.rand(2, d - 1);
            const b = this.rand(1, a - 1);
            const subVal = a - b;
            const ansStr = `${subVal}/${d}`;
            const options = [ansStr];
            const diffs = [-2, -1, 1, 2];
            for (let df of diffs) {
                const optN = subVal + df;
                if (optN > 0 && optN < d && !options.includes(`${optN}/${d}`)) {
                    options.push(`${optN}/${d}`);
                }
            }
            let tries = 0;
            while (options.length < 4 && tries++ < 25) {
                const fake = this.rand(1, d - 1);
                if (!options.includes(`${fake}/${d}`)) options.push(`${fake}/${d}`);
            }
            while (options.length < 4) {
                const fallbackN = (subVal + options.length) % (d + 2) + 1;
                const fb = `${fallbackN}/${d}`;
                if (!options.includes(fb)) options.push(fb);
                else options.push(`${options.length + 1}/${d}`);
            }
            return {
                question: `${a}/${d} - ${b}/${d}`,
                answer: ansStr,
                answerNum: subVal / d,
                typeId: 22,
                typeName: '동모분수 뺄셈',
                customOptions: options
            };
        } else if (sub === 3) {
            // C. 자연수가 되는 분수 덧셈/뺄셈 (예: 3/4 + 1/4 = 1, 2/5 + 3/5 = 1, 1 - 2/5 = 3/5)
            const isOne = Math.random() < 0.6;
            if (isOne) {
                const d = [3, 4, 5, 6, 7, 8][this.rand(0, 5)];
                const a = this.rand(1, d - 1);
                const b = d - a;
                return {
                    question: `${a}/${d} + ${b}/${d}`,
                    answer: 1,
                    answerNum: 1,
                    typeId: 22,
                    typeName: '자연수 분수 덧셈',
                    offsets: [-2, 2, -1, 1]
                };
            } else {
                const d = [4, 5, 6, 7, 8][this.rand(0, 4)];
                const a = this.rand(1, d - 1);
                const ansN = d - a;
                const ansStr = `${ansN}/${d}`;
                const options = [ansStr];
                for (let k = 1; k <= 6; k++) {
                    const candidate = `${(ansN + k) % d || 1}/${d}`;
                    if (!options.includes(candidate)) options.push(candidate);
                    if (options.length >= 4) break;
                }
                while (options.length < 4) {
                    options.push(`${options.length + 1}/${d}`);
                }
                return {
                    question: `1 - ${a}/${d}`,
                    answer: ansStr,
                    answerNum: ansN / d,
                    typeId: 22,
                    typeName: '1에서 분수 빼기',
                    customOptions: options
                };
            }
        } else {
            // D. 자연수의 분수 (예: 12의 1/2 = 6, 20의 1/4 = 5, 15의 2/3 = 10, 16의 3/4 = 12)
            const fracPairs = [
                { total: 12, n: 1, d: 2, a: 6 },
                { total: 12, n: 2, d: 3, a: 8 },
                { total: 16, n: 1, d: 4, a: 4 },
                { total: 16, n: 3, d: 4, a: 12 },
                { total: 15, n: 1, d: 3, a: 5 },
                { total: 15, n: 2, d: 3, a: 10 },
                { total: 20, n: 1, d: 4, a: 5 },
                { total: 20, n: 3, d: 4, a: 15 },
                { total: 24, n: 1, d: 3, a: 8 },
                { total: 24, n: 1, d: 4, a: 6 },
                { total: 24, n: 3, d: 4, a: 18 },
                { total: 30, n: 1, d: 5, a: 6 },
                { total: 30, n: 2, d: 5, a: 12 }
            ];
            const p = fracPairs[this.rand(0, fracPairs.length - 1)];
            return {
                question: `${p.total}의 ${p.n}/${p.d}`,
                answer: p.a,
                answerNum: p.a,
                typeId: 22,
                typeName: '자연수의 분수',
                offsets: [-3, -2, -1, 1, 2, 3, -4, 4]
            };
        }
    }

    // 3-3. 소수 계산 (소수 한 자리 덧셈/뺄셈, 소수 x 자연수)
    genDecimalProblem() {
        const sub = this.rand(1, 3);

        if (sub === 1) {
            // A. 소수 한 자리 덧셈 (예: 0.3 + 0.5 = 0.8, 0.7 + 0.6 = 1.3, 1.2 + 0.5 = 1.7)
            const a = this.rand(2, 25) / 10;
            const b = this.rand(2, 19) / 10;
            const sum = Math.round((a + b) * 10) / 10;
            const ansStr = sum.toFixed(1);
            const options = [ansStr];
            const deltas = [-0.2, -0.1, 0.1, 0.2];
            for (let d of deltas) {
                const opt = Math.round((sum + d) * 10) / 10;
                if (opt > 0 && !options.includes(opt.toFixed(1))) {
                    options.push(opt.toFixed(1));
                }
            }
            let tries = 0;
            while (options.length < 4 && tries++ < 25) {
                const fake = Math.round((sum + (Math.random() < 0.5 ? -0.3 : 0.3)) * 10) / 10;
                if (fake > 0 && !options.includes(fake.toFixed(1))) options.push(fake.toFixed(1));
            }
            while (options.length < 4) {
                const fb = (sum + options.length * 0.4 + 0.1).toFixed(1);
                if (!options.includes(fb)) options.push(fb);
                else options.push((sum + options.length * 0.7 + 0.2).toFixed(1));
            }
            return {
                question: `${a.toFixed(1)} + ${b.toFixed(1)}`,
                answer: ansStr,
                answerNum: sum,
                typeId: 23,
                typeName: '소수 한 자리 덧셈',
                customOptions: options
            };
        } else if (sub === 2) {
            // B. 소수 한 자리 뺄셈 (예: 0.9 - 0.4 = 0.5, 1.5 - 0.7 = 0.8, 2.4 - 1.1 = 1.3)
            const a = this.rand(11, 35) / 10;
            const b = this.rand(2, Math.round((a - 0.2) * 10)) / 10;
            const diff = Math.round((a - b) * 10) / 10;
            const ansStr = diff.toFixed(1);
            const options = [ansStr];
            const deltas = [-0.2, -0.1, 0.1, 0.2];
            for (let d of deltas) {
                const opt = Math.round((diff + d) * 10) / 10;
                if (opt > 0 && !options.includes(opt.toFixed(1))) {
                    options.push(opt.toFixed(1));
                }
            }
            let tries = 0;
            while (options.length < 4 && tries++ < 25) {
                const fake = Math.round((diff + (Math.random() < 0.5 ? -0.3 : 0.3)) * 10) / 10;
                if (fake > 0 && !options.includes(fake.toFixed(1))) options.push(fake.toFixed(1));
            }
            while (options.length < 4) {
                const fb = (diff + options.length * 0.4 + 0.1).toFixed(1);
                if (!options.includes(fb)) options.push(fb);
                else options.push((diff + options.length * 0.7 + 0.2).toFixed(1));
            }
            return {
                question: `${a.toFixed(1)} - ${b.toFixed(1)}`,
                answer: ansStr,
                answerNum: diff,
                typeId: 23,
                typeName: '소수 한 자리 뺄셈',
                customOptions: options
            };
        } else {
            // C. 소수 × 자연수 (예: 0.5 × 4 = 2, 0.3 × 3 = 0.9, 0.2 × 6 = 1.2, 1.5 × 2 = 3)
            const decList = [0.2, 0.3, 0.4, 0.5, 0.6, 1.2, 1.5];
            const dec = decList[this.rand(0, decList.length - 1)];
            const mult = this.rand(2, 6);
            const prod = Math.round(dec * mult * 10) / 10;
            const ansStr = (prod % 1 === 0) ? String(prod) : prod.toFixed(1);
            const options = [ansStr];
            const deltas = [-0.2, -0.1, 0.1, 0.2, -1, 1];
            for (let d of deltas) {
                const opt = Math.round((prod + d) * 10) / 10;
                if (opt > 0) {
                    const optStr = (opt % 1 === 0) ? String(opt) : opt.toFixed(1);
                    if (!options.includes(optStr)) options.push(optStr);
                }
            }
            let tries = 0;
            while (options.length < 4 && tries++ < 25) {
                const fake = Math.round((prod + (Math.random() < 0.5 ? -0.3 : 0.3)) * 10) / 10;
                const fakeStr = (fake % 1 === 0) ? String(fake) : fake.toFixed(1);
                if (fake > 0 && !options.includes(fakeStr)) options.push(fakeStr);
            }
            while (options.length < 4) {
                const fb = (prod + options.length * 0.5 + 0.2).toFixed(1);
                if (!options.includes(fb)) options.push(fb);
                else options.push((prod + options.length * 1.1 + 0.3).toFixed(1));
            }
            return {
                question: `${dec.toFixed(1)} × ${mult}`,
                answer: ansStr,
                answerNum: prod,
                typeId: 23,
                typeName: '소수 곱셈',
                customOptions: options
            };
        }
    }

    // 선택된 난이도 및 티어에 따른 수학 문제 생성기
    generateProblem(tier = 1, forceCategory = null) {
        let probData = null;

        if (this.difficulty === 'beginner') {
            // 🌱 초보 단계 (초등 1~2학년): 1+1, 1+11, 1x1 구구단
            let cat = forceCategory;
            if (!cat) {
                if (tier <= 2) {
                    cat = Math.random() < 0.7 ? 'single_add' : 'single_double_add';
                } else if (tier <= 4) {
                    cat = Math.random() < 0.45 ? 'single_double_add' : (Math.random() < 0.55 ? 'single_add' : 'gugudan');
                } else {
                    cat = Math.random() < 0.55 ? 'gugudan' : (Math.random() < 0.65 ? 'single_double_add' : 'single_add');
                }
            }
            if (cat === 'single_add' || cat === 1) probData = this.genSingleSingleAdd();
            else if (cat === 'single_double_add' || cat === 2) probData = this.genSingleDoubleAdd();
            else probData = this.genBasicMultiplication();
        } else if (this.difficulty === 'intermediate') {
            // ⚔️ 중수 단계 (초등 3~4학년): 11+11, 1-1, 11-1, 1x11 호환수/단위 곱셈
            let cat = forceCategory;
            if (!cat) {
                const r = Math.random();
                if (r < 0.35) cat = 'double_add';
                else if (r < 0.65) cat = 'sub';
                else cat = 'mult_comp';
            }
            if (cat === 'double_add' || cat === 3) probData = this.genDoubleDoubleAdd();
            else if (cat === 'sub' || cat === 4) {
                probData = Math.random() < 0.4 ? this.genSingleSingleSub() : this.genDoubleSingleSub();
            } else probData = this.genCompatibleMultiplication();
        } else {
            // 👑 고수 단계 (초등 4~5학년): 나눗셈, 분수, 소수
            let cat = forceCategory;
            if (!cat) {
                const r = Math.random();
                if (r < 0.34) cat = 'div';
                else if (r < 0.67) cat = 'fraction';
                else cat = 'decimal';
            }
            if (cat === 'div' || cat === 6) probData = this.genElementaryDivision();
            else if (cat === 'fraction') probData = this.genFractionProblem();
            else probData = this.genDecimalProblem();
        }

        const answer = probData.answer;
        let options = [];

        if (probData.customOptions) {
            options = this.shuffle([...probData.customOptions]);
        } else {
            const optSet = new Set();
            optSet.add(answer);
            const offsets = this.shuffle([...(probData.offsets || [-2, -1, 1, 2])]);
            for (let offset of offsets) {
                const wrong = (typeof answer === 'number') ? answer + offset : answer;
                if (wrong > 0 && wrong !== answer) optSet.add(wrong);
                if (optSet.size >= 4) break;
            }
            let tries = 0;
            const numAns = (typeof answer === 'number') ? answer : this.getSortValue(answer);
            while (optSet.size < 4 && tries++ < 25) {
                const delta = this.rand(-4, 4);
                const fake = numAns + delta;
                if (fake > 0 && fake !== numAns) optSet.add(fake);
            }
            while (optSet.size < 4) {
                optSet.add(optSet.size + 1);
            }
            options = this.shuffle(Array.from(optSet));
        }

        return {
            question: probData.question,
            displayExpr: probData.question,
            answer: answer,
            answerNum: (probData.answerNum !== undefined) ? probData.answerNum : this.getSortValue(answer),
            typeId: probData.typeId,
            typeName: probData.typeName,
            options: options
        };
    }

    // 손패 5개 문제들을 풀기 위한 상단 룬 랙 답안 풀 생성 (7개 확장, 오름차순 정렬)
    generateAnswerPool(cardsInHand, poolSize = 7) {
        const pool = [];
        const usedAnswers = new Set();

        const addAnswer = (val, tier) => {
            const strKey = String(val).trim();
            if (!usedAnswers.has(strKey) && pool.length < poolSize) {
                pool.push({
                    id: 'ans_' + Math.random().toString(36).substr(2, 6),
                    val: val,
                    sortVal: this.getSortValue(val),
                    tier: tier
                });
                usedAnswers.add(strKey);
            }
        };

        // 1. 손패에 있는 미해결 카드의 정답들을 최우선 포함 (적어도 1개 이상 항상 정답 존재 보장)
        const unsolved = cardsInHand.filter(c => !c.charged);
        unsolved.forEach(c => {
            if (c.problem && c.problem.answer !== undefined) {
                addAnswer(c.problem.answer, c.tier);
            }
        });

        // 2. 남은 슬롯은 문제 카드의 그럴듯한 보기(options)들로 채움
        unsolved.forEach(c => {
            if (c.problem && c.problem.options) {
                c.problem.options.forEach(opt => addAnswer(opt, c.tier));
            }
        });

        // 3. 부족한 경우 난이도에 맞는 백업 풀로 보충
        let backupPool = [];
        if (this.difficulty === 'beginner') {
            backupPool = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 20, 24, 25, 30];
        } else if (this.difficulty === 'intermediate') {
            backupPool = [4, 6, 8, 12, 15, 18, 22, 25, 28, 30, 32, 36, 40, 44, 48, 50, 55, 60, 66, 70, 77, 80];
        } else {
            backupPool = ['1/2', '1/3', '2/3', '1/4', '3/4', '2/5', '3/5', '4/5', '0.5', '0.8', '1.2', '1.5', 2, 4, 6, 8, 10, 12, 15, 20, 25];
        }
        this.shuffle(backupPool);
        let bIdx = 0;
        while (pool.length < poolSize && bIdx < backupPool.length) {
            addAnswer(backupPool[bIdx++], 1);
        }

        // 답안카드는 작은 숫자 -> 큰 숫자 순서로 정렬 (분수/소수/정수 모두 sortVal 기준 오름차순)
        return pool.sort((a, b) => a.sortVal - b.sortVal);
    }

    // 새로운 카드 생성 (영단어 유닛 + 수학 문제 융합, 타워형 카드 등장 확률 3.5배 가중치 부여)
    createCard(tier = 1, forceCategory = null) {
        const templates = this.unitTemplates[tier] || this.unitTemplates[1];

        // 타워/방어벽/배치형 유닛 카드(!isSpell && !isBuff)는 3.5배 높은 가중치 적용
        const weighted = templates.map(t => ({
            template: t,
            weight: (!t.isSpell && !t.isBuff) ? 3.5 : 1.0
        }));

        const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
        let rand = Math.random() * totalWeight;
        let selectedTemplate = templates[0];
        for (const item of weighted) {
            rand -= item.weight;
            if (rand <= 0) {
                selectedTemplate = item.template;
                break;
            }
        }

        const problem = this.generateProblem(tier, forceCategory);

        return {
            id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            tier: tier,
            ...selectedTemplate,
            problem: problem,
            charged: false, // 문제 풀림(합성) 여부
            createdAt: Date.now()
        };
    }
}

if (typeof window !== 'undefined') {
    window.mathEngine = new MathEngine();
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MathEngine };
}
