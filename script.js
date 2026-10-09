/**
 * ====================================================================
 * 냥코 대전쟁 - 가마토토 탐험 계산 프로그램
 * ====================================================================
 * 
 * [공식 및 게임 시스템 규칙]
 * 1. 탐험 문장 수: 6 × 탐험시간 (1시간: 6 / 3시간: 18 / 6시간: 36)
 *    - 하얀 문장: 꽝 (미획득)
 *    - 노란 문장: 성공 (아이템 획득)
 * 
 * 2. 대원 가중치 (초보자:1, 평범이:2, 숙련가:4, 카리스마:6, 레전드:7 / 총 10마리 이하)
 *    - 대원 가중치 W = 0 ~ 70
 *    - 노란 문장 성공률 = 32% + (W × 0.27%)
 * 
 * 3. 통조림 & XP 보너스 전환 규칙:
 *    - 통조림 성공률은 32%에 고정
 *    - 통조림의 가중치 보너스 (W × 0.27%)는 통조림이 드롭되는 지역에서 XP 성공률로 전환되어 가산됨
 * 
 * 4. 레벨 효과:
 *    - Lv.1~99: 0.02% × (레벨 - 1)
 *    - Lv.100~130: 2% + 0.02% × 레벨
 * 
 * 5. 최종 결정 확률:
 *    - 최종결정확률 = 기본확률 + 확률조정상수 × 레벨효과
 * 
 * 6. 문장당 획득량 & 총 획득량 상한선:
 *    - 통조림: 문장당 1~2개 (평균 1.5개) / 기본 최대 9개 (이나리 ON: 18개)
 *    - XP: 에리어별 고유 지급 범위 / 무제한
 *    - 배틀 아이템: 문장당 1개 / 무제한
 *    - 캣츠아이: 문장당 1개 / 일반 에리어 무제한, 고양이 눈 동굴은 종류별 최대 1개 (이나리 ON: 2개)
 *    - 이나리: 최대 획득량 상한선 범위를 2배로 확장
 */

// ==========================================
// 1. 대원 가중치
// ==========================================
const HELPER_WEIGHTS = {
  white: 1,   // 초보자 (1점)
  bronze: 2,  // 평범이 (2점)
  silver: 4,  // 숙련가 (4점)
  gold: 6,    // 카리스마 (6점)
  legend: 7   // 레전드 (7점)
};

// ==========================================
// 2. 12종 아이템 정의
// ==========================================
const ITEM_DEFS = [
  { key: 'xp', name: 'XP', unit: 'XP', isSpecial: 'xp' },
  { key: 'can', name: '통조림', unit: '개', isSpecial: 'can' },
  { key: 'speed', name: '스피드업', unit: '개', isBattle: true },
  { key: 'cpu', name: '야옹컴', unit: '개', isBattle: true },
  { key: 'worker', name: '고양이 도령', unit: '개', isBattle: true },
  { key: 'sniper', name: '스냥이퍼', unit: '개', isBattle: true },
  { key: 'doctor', name: '고양이 박사', unit: '개', isBattle: true },
  { key: 'radar', name: '트레저 레이더', unit: '개', isBattle: true },
  { key: 'catseye_ex', name: 'EX 캣츠아이', unit: '개', isCatseye: true },
  { key: 'catseye_rare', name: '레어 캣츠아이', unit: '개', isCatseye: true },
  { key: 'catseye_sr', name: '슈퍼레어 캣츠아이', unit: '개', isCatseye: true },
  { key: 'catseye_uber', name: '울트라 슈퍼 레어 캣츠아이', unit: '개', isCatseye: true }
];

// ==========================================
// 3. 에리어별 공식 데이터베이스
// ==========================================
const AREA_DATABASE = {
  '평화 초원': {
    type: 'normal',
    xpRange: [75, 120],
    items: {
      xp: { base: 83.6, adj: -1.20 },
      can: { base: 15.0, adj: 0.8 },
      speed: { base: 1.4, adj: 0.4 }
    }
  },
  '쿵후 왕국': {
    type: 'normal',
    xpRange: [120, 175],
    items: {
      xp: { base: 83.6, adj: -0.80 },
      can: { base: 15.0, adj: 0.5 },
      cpu: { base: 0.7, adj: 0.15 },
      speed: { base: 0.7, adj: 0.15 }
    }
  },
  '사바의 사막': {
    type: 'normal',
    xpRange: [175, 250],
    items: {
      xp: { base: 83.5, adj: -0.90 },
      can: { base: 15.0, adj: 0.6 },
      cpu: { base: 0.5, adj: 0.1 },
      worker: { base: 0.5, adj: 0.1 },
      sniper: { base: 0.5, adj: 0.1 }
    }
  },
  '고양이 공선': {
    type: 'normal',
    xpRange: [350, 525],
    items: {
      xp: { base: 83.5, adj: -0.90 },
      can: { base: 15.0, adj: 0.6 },
      speed: { base: 0.5, adj: 0.1 },
      sniper: { base: 0.5, adj: 0.1 },
      doctor: { base: 0.5, adj: 0.1 }
    }
  },
  '바람의 습지대': {
    type: 'normal',
    xpRange: [480, 700],
    items: {
      xp: { base: 83.4, adj: -0.90 },
      can: { base: 15.0, adj: 0.6 },
      speed: { base: 0.7, adj: 0.1 },
      worker: { base: 0.7, adj: 0.1 },
      radar: { base: 0.2, adj: 0.1 }
    }
  },
  '엘도라도': {
    type: 'normal',
    xpRange: [800, 1000],
    items: {
      xp: { base: 83.0, adj: -1.36 },
      can: { base: 15.0, adj: 0.8 },
      catseye_ex: { base: 2.0, adj: 0.56 }
    }
  },
  '독수리 평원': {
    type: 'normal',
    xpRange: [850, 1100],
    items: {
      xp: { base: 82.3, adj: -1.36 },
      can: { base: 15.0, adj: 0.8 },
      catseye_rare: { base: 2.7, adj: 0.56 }
    }
  },
  '해저화산': {
    type: 'normal',
    xpRange: [950, 1150],
    items: {
      xp: { base: 83.0, adj: -1.36 },
      can: { base: 15.0, adj: 0.8 },
      catseye_sr: { base: 2.0, adj: 0.56 }
    }
  },
  '파라보라 산맥': {
    type: 'normal',
    xpRange: [1075, 1250],
    items: {
      xp: { base: 83.8, adj: -1.36 },
      can: { base: 15.0, adj: 0.8 },
      catseye_uber: { base: 1.2, adj: 0.56 }
    }
  },
  '평화태평양': {
    type: 'normal',
    xpRange: [825, 1050],
    items: {
      xp: { base: 80.7, adj: -0.90 },
      can: { base: 15.2, adj: 0.7 },
      catseye_ex: { base: 1.8, adj: 0.1 },
      catseye_rare: { base: 2.3, adj: 0.1 }
    }
  },
  '코타츠 대설지대': {
    type: 'normal',
    xpRange: [1013, 1200],
    items: {
      xp: { base: 81.6, adj: -0.90 },
      can: { base: 15.2, adj: 0.7 },
      catseye_sr: { base: 1.9, adj: 0.1 },
      catseye_uber: { base: 1.3, adj: 0.1 }
    }
  },
  '메가 뱅크': {
    type: 'normal',
    xpRange: [1013, 1200],
    items: {
      xp: { base: 80.6, adj: -0.90 },
      can: { base: 15.2, adj: 0.7 },
      catseye_rare: { base: 2.3, adj: 0.1 },
      catseye_sr: { base: 1.9, adj: 0.1 }
    }
  },
  '정부의 극비 시설': {
    type: 'normal',
    xpRange: [1013, 1200],
    items: {
      xp: { base: 81.7, adj: -0.90 },
      can: { base: 15.2, adj: 0.7 },
      catseye_ex: { base: 1.8, adj: 0.1 },
      catseye_uber: { base: 1.3, adj: 0.1 }
    }
  },
  '딸랑딸랑 종유동': {
    type: 'normal',
    xpRange: [1013, 1200],
    items: {
      xp: { base: 81.1, adj: -0.90 },
      can: { base: 15.2, adj: 0.7 },
      catseye_ex: { base: 1.8, adj: 0.1 },
      catseye_sr: { base: 1.9, adj: 0.1 }
    }
  },
  '개운산': {
    type: 'normal',
    xpRange: [1013, 1200],
    items: {
      xp: { base: 81.2, adj: -0.90 },
      can: { base: 15.2, adj: 0.7 },
      catseye_rare: { base: 2.3, adj: 0.1 },
      catseye_uber: { base: 1.3, adj: 0.1 }
    }
  },
  '고양이 눈 동굴': {
    type: 'event',
    xpRange: [1013, 1200],
    isCatseyeCave: true,
    items: {
      xp: { base: 89.0, adj: -1.00 },
      catseye_ex: { base: 2.8, adj: 0.25 },
      catseye_rare: { base: 2.8, adj: 0.25 },
      catseye_sr: { base: 2.8, adj: 0.25 },
      catseye_uber: { base: 2.8, adj: 0.25 }
    }
  },
  '울트라 고양이 눈 동굴': {
    type: 'event',
    xpRange: [1013, 1200],
    isCatseyeCave: true,
    items: {
      xp: { base: 78.0, adj: -1.00 },
      catseye_ex: { base: 5.5, adj: 0.25 },
      catseye_rare: { base: 5.5, adj: 0.25 },
      catseye_sr: { base: 5.5, adj: 0.25 },
      catseye_uber: { base: 5.5, adj: 0.25 }
    }
  },
  '익스플로러 펍': {
    type: 'special',
    xpRange: [1013, 1200],
    isExplorerPub: true,
    items: {
      xp: { base: 100.0, adj: 0.0 }
    }
  }
};

// ==========================================
// 4. 상태 (State)
// ==========================================
const appState = {
  time: 6, // 1, 3, 6 (시간)
  level: 100, // 1 ~ 130
  helpers: {
    white: 0,   // 초보자
    bronze: 0,  // 평범이
    silver: 0,  // 숙련가
    gold: 0,    // 카리스마
    legend: 0   // 레전드
  },
  area: '평화 초원',
  assistantFull: true, // 오토토 개발대 조수 5명 보유 여부 (기본값: true - 풀 상태)
  inari: false, // 신사 이나리 (배틀아이템 & 캣츠아이 2배)
  focus: false, // 초집중 (배틀아이템 & 캣츠아이 +1개)
  trials: 1,    // 시행 횟수
  hasCalculated: false // 사용자가 기대값 계산하기 버튼을 눌렀는지 여부
};

// ==========================================
// 5. DOM 요소 참조
// ==========================================
const DOM = {
  timeRadios: document.querySelectorAll('input[name="expeditionTime"]'),
  infoTotalSentences: document.getElementById('infoTotalSentences'),
  infoYellowSentences: document.getElementById('infoYellowSentences'),
  infoWhiteSentences: document.getElementById('infoWhiteSentences'),

  levelInput: document.getElementById('levelInput'),
  levelSlider: document.getElementById('levelSlider'),
  levelChips: document.querySelectorAll('.quick-level-buttons .btn-chip'),
  levelEffectDisplay: document.getElementById('levelEffectDisplay'),
  levelEffectFormula: document.getElementById('levelEffectFormula'),

  helperCountInputs: {
    white: document.getElementById('countWhite'),
    bronze: document.getElementById('countBronze'),
    silver: document.getElementById('countSilver'),
    gold: document.getElementById('countGold'),
    legend: document.getElementById('countLegend')
  },
  stepButtons: document.querySelectorAll('.btn-step'),
  totalHelperCount: document.getElementById('totalHelperCount'),
  helperTotalBadge: document.getElementById('helperTotalBadge'),
  helperProgressBar: document.getElementById('helperProgressBar'),
  helperWeightDisplay: document.getElementById('helperWeightDisplay'),
  yellowRateDisplay: document.getElementById('yellowRateDisplay'),
  yellowRateFormula: document.getElementById('yellowRateFormula'),
  xpBonusDisplay: document.getElementById('xpBonusDisplay'),
  xpBonusRow: document.getElementById('xpBonusRow'),

  presetClear: document.getElementById('presetClear'),
  presetLegend10: document.getElementById('presetLegend10'),

  btnAssistantUnder5: document.getElementById('btnAssistantUnder5'),
  btnAssistantFull5: document.getElementById('btnAssistantFull5'),

  areaSelect: document.getElementById('areaSelect'),
  areaNameDisplay: document.getElementById('areaNameDisplay'),
  areaTypeTag: document.getElementById('areaTypeTag'),
  areaDropItemsList: document.getElementById('areaDropItemsList'),

  inariToggle: document.getElementById('inariToggle'),
  inariStatusText: document.getElementById('inariStatusText'),
  focusToggle: document.getElementById('focusToggle'),
  focusStatusText: document.getElementById('focusStatusText'),
  buffCardInari: document.getElementById('buffCardInari'),
  buffCardFocus: document.getElementById('buffCardFocus'),

  trialsInput: document.getElementById('trialsInput'),
  btnTrialMinus: document.getElementById('btnTrialMinus'),
  btnTrialPlus: document.getElementById('btnTrialPlus'),
  trialChips: document.querySelectorAll('.btn-trial-chip'),

  btnCalculate: document.getElementById('btnCalculate'),
  calcStandbyBox: document.getElementById('calcStandbyBox'),
  resultsContainer: document.getElementById('resultsContainer'),
  resultTitleDisplay: document.getElementById('resultTitleDisplay'),

  sumTime: document.getElementById('sumTime'),
  sumLevel: document.getElementById('sumLevel'),
  sumHelpers: document.getElementById('sumHelpers'),
  sumArea: document.getElementById('sumArea'),
  sumTrials: document.getElementById('sumTrials'),
  sumInari: document.getElementById('sumInari'),
  sumFocus: document.getElementById('sumFocus'),
  sumAssistant: document.getElementById('sumAssistant'),

  // 대원 & 조수 발견 리포트 DOM
  discoveryAreaTag: document.getElementById('discoveryAreaTag'),
  discoveryTimeTag: document.getElementById('discoveryTimeTag'),
  discoveryAssistantTag: document.getElementById('discoveryAssistantTag'),
  discoveryTotalHelperRate: document.getElementById('discoveryTotalHelperRate'),
  discoveryRateCompare: document.getElementById('discoveryRateCompare'),
  discoveryTrialsSpan: document.getElementById('discoveryTrialsSpan'),

  rates: {
    gold: document.getElementById('rate-gold'),
    silver: document.getElementById('rate-silver'),
    bronze: document.getElementById('rate-bronze'),
    white: document.getElementById('rate-white'),
    assistant: document.getElementById('rate-assistant'),
    none: document.getElementById('rate-none')
  },
  expects: {
    gold: document.getElementById('expect-gold'),
    silver: document.getElementById('expect-silver'),
    bronze: document.getElementById('expect-bronze'),
    white: document.getElementById('expect-white'),
    assistant: document.getElementById('expect-assistant'),
    none: document.getElementById('expect-none')
  },
  cardAssistant: document.getElementById('card-assistant'),
  tagAssistant: document.getElementById('tag-assistant'),

  // 가상 탐험 실제 난수 시뮬레이터 DOM
  simTargetTrials: document.getElementById('simTargetTrials'),
  simBtnTrialsCount: document.getElementById('simBtnTrialsCount'),
  btnRunSimulation: document.getElementById('btnRunSimulation'),
  btnResetSimulation: document.getElementById('btnResetSimulation'),
  simEmptyState: document.getElementById('simEmptyState'),
  simActiveResults: document.getElementById('simActiveResults'),
  simTotalRunsBadge: document.getElementById('simTotalRunsBadge'),
  simResultSummaryText: document.getElementById('simResultSummaryText'),
  simLuckBadge: document.getElementById('simLuckBadge'),
  simCounts: {
    gold: document.getElementById('simCountGold'),
    silver: document.getElementById('simCountSilver'),
    bronze: document.getElementById('simCountBronze'),
    white: document.getElementById('simCountWhite'),
    assistant: document.getElementById('simCountAssistant'),
    none: document.getElementById('simCountNone')
  },
  simLogContainer: document.getElementById('simLogContainer'),

  quoteLevelEffect: document.getElementById('quoteLevelEffect'),
  canLimitNote: document.getElementById('canLimitNote'),

  jsonViewer: document.getElementById('jsonViewer')
};

// ==========================================
// 6. 계산 로직
// ==========================================

function getTotalHelpers() {
  return (
    appState.helpers.white +
    appState.helpers.bronze +
    appState.helpers.silver +
    appState.helpers.gold +
    appState.helpers.legend
  );
}

function getHelperWeight() {
  return (
    appState.helpers.white * HELPER_WEIGHTS.white +
    appState.helpers.bronze * HELPER_WEIGHTS.bronze +
    appState.helpers.silver * HELPER_WEIGHTS.silver +
    appState.helpers.gold * HELPER_WEIGHTS.gold +
    appState.helpers.legend * HELPER_WEIGHTS.legend
  );
}

function getLevelEffect(level) {
  let val = 0;
  let formula = '';
  if (level < 100) {
    val = 0.02 * (level - 1);
    formula = `0.02% × (${level} - 1)`;
  } else {
    val = 2.0 + 0.02 * level;
    formula = `2% + 0.02% × ${level}`;
  }
  return { value: val, formula: formula };
}

function calculateExpeditionRewards() {
  const time = appState.time;
  const level = appState.level;
  const areaName = appState.area;
  const inari = appState.inari;
  const focus = appState.focus;

  const areaData = AREA_DATABASE[areaName] || AREA_DATABASE['평화 초원'];
  const totalSentences = 6 * time;
  const weight = getHelperWeight();
  const helperBonusPct = weight * 0.27; // W × 0.27%
  const levelEff = getLevelEffect(level);

  // 상한선 (이나리 적용 시 2배)
  const canMaxCap = inari ? 18 : 9;
  const catseyeCaveCap = inari ? 2 : 1;

  const [minXpPerSentence, maxXpPerSentence] = areaData.xpRange;
  const avgXpPerSentence = (minXpPerSentence + maxXpPerSentence) / 2;

  // 에리어 내 통조림 존재 여부
  const hasCanInArea = Boolean(areaData.items.can);
  let canDetermProb = 0;
  if (hasCanInArea) {
    const canCfg = areaData.items.can;
    canDetermProb = Math.max(0, canCfg.base + canCfg.adj * levelEff.value);
  }

  const itemResults = {};
  let totalYellowSentences = 0;

  ITEM_DEFS.forEach(item => {
    const config = areaData.items[item.key];
    const isDropped = Boolean(config);

    if (!isDropped) {
      itemResults[item.key] = {
        name: item.name,
        isDropped: false,
        finalProb: 0,
        dropUnit: '드롭 없음',
        expectedQty: 0,
        expectedSentences: 0
      };
      return;
    }

    // 최종결정확률 = 기본확률 + 확률조정상수 × 레벨효과
    let finalProb = config.base + config.adj * levelEff.value;
    finalProb = Math.max(0, finalProb);

    let successRate = 0.32 + (helperBonusPct / 100);
    let expectedSentences = 0;
    let expectedQty = 0;
    let dropUnitText = '';

    if (item.key === 'can') {
      // 통조림 성공률은 32% 고정
      successRate = 0.32;
      expectedSentences = totalSentences * (finalProb / 100) * successRate;
      const rawQty = expectedSentences * 1.5;
      expectedQty = Math.min(rawQty, canMaxCap);
      dropUnitText = '문장당 1~2개';
    } else if (item.key === 'xp') {
      // 통조림이 있는 지역인 경우에만 전환 보너스 유입
      let canTransferredRolls = 0;
      if (hasCanInArea) {
        canTransferredRolls = totalSentences * (canDetermProb / 100) * (helperBonusPct / 100);
      }
      expectedSentences = (totalSentences * (finalProb / 100) * successRate) + canTransferredRolls;
      expectedQty = expectedSentences * avgXpPerSentence;
      dropUnitText = `문장당 ${minXpPerSentence}~${maxXpPerSentence} XP`;
    } else {
      // 배틀아이템 & 캣츠아이
      const singleProb = (finalProb / 100) * successRate;
      expectedSentences = totalSentences * singleProb;

      let baseDrop = 0;
      if (areaData.isCatseyeCave && item.isCatseye) {
        // [고양이 눈 동굴 / 울트라 고양이 눈 동굴]
        // 게임 시스템상 종류별 최대 1개 상한선 적용!
        // N회 시행 중 적어도 1회 이상 당첨될 확률 = 1 - (1 - p)^N
        // 상한선 1개 적용 시 1회 탐험 실제 기대 획득량 = 1 * P(X >= 1)
        baseDrop = 1 - Math.pow(1 - singleProb, totalSentences);
        dropUnitText = '문장당 1개 (최대 1개 상한)';
      } else {
        // 일반 에리어 캣츠아이 및 배틀아이템: 상한선 없음(무제한)
        baseDrop = expectedSentences;
        dropUnitText = '문장당 1개';
      }

      let qty = baseDrop;

      // 1. [이나리 2배] 먼저 적용
      if (inari) {
        qty = qty * 2;
      }
      // 2. [초집중 +1개] 나중에 적용 (0개여도 최소 1개 보장)
      if (focus) {
        qty = qty + 1;
      }

      expectedQty = qty;
    }

    totalYellowSentences += expectedSentences;

    itemResults[item.key] = {
      name: item.name,
      isDropped: true,
      finalProb: finalProb,
      dropUnit: dropUnitText,
      expectedSentences: expectedSentences,
      expectedQty: expectedQty
    };
  });

  const whiteSentences = Math.max(0, totalSentences - totalYellowSentences);

  return {
    totalSentences,
    yellowSentences: totalYellowSentences,
    whiteSentences: whiteSentences,
    levelEffect: levelEff,
    helperWeight: weight,
    helperBonusPct: helperBonusPct,
    hasCanInArea,
    canMaxCap,
    catseyeCaveCap,
    avgXpPerSentence,
    minXpPerSentence,
    maxXpPerSentence,
    items: itemResults
  };
}

// ==========================================
// 6-1. 대원 및 조수 발견 확률 계산 (데이터마이닝 표 6~8 공식)
// ==========================================
function calculateHelperDiscoveryRates(time, area, isAssistantFull) {
  // 초반부 에리어: 평화 초원, 쿵후 왕국, 사바의 사막 (기본 발견율 7.5%)
  // 익스플로러 펍: 대원 영입 특화 에리어 (기본 발견율 18.0% - 2배 특화!)
  // 후반부 에리어: 나머지 12개 에리어 및 동굴 (기본 발견율 9.0%)
  const isExplorerPub = (area === '익스플로러 펍');
  const isEarlyArea = (area === '평화 초원' || area === '쿵후 왕국' || area === '사바의 사막');
  const attempts = time === 1 ? 2 : (time === 3 ? 5 : 9);
  const pFind = isExplorerPub ? 0.180 : (isEarlyArea ? 0.075 : 0.090);

  // 가중치 (표 6 기준, 백분율)
  const wAssistant = 86.67;
  const wWhite = isEarlyArea ? 9.73 : 7.73;
  const wBronze = isEarlyArea ? 2.13 : 3.20;
  const wSilver = isEarlyArea ? 1.07 : 1.60;
  const wGold = isEarlyArea ? 0.40 : 0.80;
  const helperWeightSum = wWhite + wBronze + wSilver + wGold; // 13.33

  let rates = {
    none: 0,
    assistant: 0,
    white: 0,
    bronze: 0,
    silver: 0,
    gold: 0,
    totalHelper: 0
  };

  if (!isAssistantFull) {
    // [표 7] 조수 4마리 이하 (< 5)
    // N회 시도 중 발견 확률 = 1 - (1 - P_find)^N
    const pAny = 1 - Math.pow(1 - pFind, attempts);
    rates.none = Math.pow(1 - pFind, attempts) * 100;
    rates.assistant = pAny * wAssistant;
    rates.white = pAny * wWhite;
    rates.bronze = pAny * wBronze;
    rates.silver = pAny * wSilver;
    rates.gold = pAny * wGold;
    rates.totalHelper = rates.white + rates.bronze + rates.silver + rates.gold;
  } else {
    // [표 8] 조수 5마리 시 (풀)
    // 조수 당첨 시 리롤 (실패 처리 후 다음 시도로 넘어감)
    // 시도당 대원 획득 확률 P_helper = P_find * (13.33 / 100)
    const pHelperPerAttempt = pFind * (helperWeightSum / 100);
    const pHelperAny = 1 - Math.pow(1 - pHelperPerAttempt, attempts);
    rates.none = Math.pow(1 - pHelperPerAttempt, attempts) * 100;
    rates.assistant = 0;
    rates.white = pHelperAny * (wWhite / helperWeightSum) * 100;
    rates.bronze = pHelperAny * (wBronze / helperWeightSum) * 100;
    rates.silver = pHelperAny * (wSilver / helperWeightSum) * 100;
    rates.gold = pHelperAny * (wGold / helperWeightSum) * 100;
    rates.totalHelper = rates.white + rates.bronze + rates.silver + rates.gold;
  }

  return {
    isEarlyArea,
    isExplorerPub,
    attempts,
    pFindPercent: pFind * 100,
    isAssistantFull,
    rates
  };
}

// ==========================================
// 6-2. 몬테카를로 가상 탐험 실제 난수 시뮬레이터
// ==========================================
function simulateExpeditionRolls(trials, time, area, isAssistantFull) {
  const isExplorerPub = (area === '익스플로러 펍');
  const isEarlyArea = (area === '평화 초원' || area === '쿵후 왕국' || area === '사바의 사막');
  const attempts = time === 1 ? 2 : (time === 3 ? 5 : 9);
  const pFind = isExplorerPub ? 0.180 : (isEarlyArea ? 0.075 : 0.090);

  const wWhite = isEarlyArea ? 9.73 : 7.73;
  const wBronze = isEarlyArea ? 2.13 : 3.20;
  const wSilver = isEarlyArea ? 1.07 : 1.60;
  const wGold = isEarlyArea ? 0.40 : 0.80;

  const counts = {
    gold: 0,
    silver: 0,
    bronze: 0,
    white: 0,
    assistant: 0,
    none: 0
  };

  const logs = [];

  for (let t = 1; t <= trials; t++) {
    let outcome = 'none';

    for (let a = 1; a <= attempts; a++) {
      if (Math.random() < pFind) {
        const r = Math.random() * 100;
        if (r < 86.67) {
          // 조수 당첨
          if (isAssistantFull) {
            // 조수 5명 풀 상태: 리롤 (실패 처리 후 다음 시도로 넘어감)
            continue;
          } else {
            outcome = 'assistant';
            break;
          }
        } else if (r < 86.67 + wWhite) {
          outcome = 'white';
          break;
        } else if (r < 86.67 + wWhite + wBronze) {
          outcome = 'bronze';
          break;
        } else if (r < 86.67 + wWhite + wBronze + wSilver) {
          outcome = 'silver';
          break;
        } else {
          outcome = 'gold';
          break;
        }
      }
    }

    counts[outcome]++;

    // 최대 30개까지 대원 발견 로그 기록
    if (trials <= 50 && outcome !== 'none') {
      const nameMap = {
        gold: '카리스마/레전드 (금모자)',
        silver: '숙련가 (은모자)',
        bronze: '평범이 (동모자)',
        white: '초보자 (흰모자)',
        assistant: '오토토 조수'
      };
      logs.push({ trial: t, outcome, name: nameMap[outcome] });
    }
  }

  return { counts, logs };
}

function executeHelperSimulation() {
  const trials = Math.max(1, appState.trials || 1);
  const result = simulateExpeditionRolls(trials, appState.time, appState.area, appState.assistantFull);
  const helperDiscovery = calculateHelperDiscoveryRates(appState.time, appState.area, appState.assistantFull);
  const expectedTotalHelper = trials * (helperDiscovery.rates.totalHelper / 100);
  const actualTotalHelper = result.counts.gold + result.counts.silver + result.counts.bronze + result.counts.white;

  if (DOM.simEmptyState) DOM.simEmptyState.classList.add('hidden');
  if (DOM.simActiveResults) DOM.simActiveResults.classList.remove('hidden');

  if (DOM.simTotalRunsBadge) {
    DOM.simTotalRunsBadge.textContent = `총 ${trials.toLocaleString()}회 가상 탐험 완료`;
  }

  if (DOM.simResultSummaryText) {
    DOM.simResultSummaryText.innerHTML = `대원 총 <strong style="color: #4ade80;">${actualTotalHelper}마리</strong> 영입 성공! <span style="font-size: 0.8rem; color: #94a3b8;">(수학적 기대치: 약 ${expectedTotalHelper.toFixed(2)}마리)</span>`;
  }

  // 행운 뱃지 판정
  if (DOM.simLuckBadge) {
    if (result.counts.gold > 0) {
      DOM.simLuckBadge.textContent = result.counts.gold >= 2 ? '대박! 금모자 2마리 이상!' : '대박! 카리스마/레전드 획득!';
      DOM.simLuckBadge.className = 'sim-luck-badge jackpot';
    } else if (actualTotalHelper >= expectedTotalHelper * 1.25 && trials >= 5) {
      DOM.simLuckBadge.textContent = '운 좋음 (+대원 풍년)';
      DOM.simLuckBadge.className = 'sim-luck-badge';
    } else if (actualTotalHelper < expectedTotalHelper * 0.7 && trials >= 10) {
      DOM.simLuckBadge.textContent = '다소 아쉬움';
      DOM.simLuckBadge.className = 'sim-luck-badge unlucky';
    } else {
      DOM.simLuckBadge.textContent = '보통 운';
      DOM.simLuckBadge.className = 'sim-luck-badge';
    }
  }

  // 수치 갱신
  if (DOM.simCounts.gold) DOM.simCounts.gold.textContent = `${result.counts.gold}마리`;
  if (DOM.simCounts.silver) DOM.simCounts.silver.textContent = `${result.counts.silver}마리`;
  if (DOM.simCounts.bronze) DOM.simCounts.bronze.textContent = `${result.counts.bronze}마리`;
  if (DOM.simCounts.white) DOM.simCounts.white.textContent = `${result.counts.white}마리`;
  if (DOM.simCounts.assistant) DOM.simCounts.assistant.textContent = `${result.counts.assistant}마리`;
  if (DOM.simCounts.none) DOM.simCounts.none.textContent = `${result.counts.none}회`;

  // 로그 출력
  if (DOM.simLogContainer) {
    DOM.simLogContainer.innerHTML = '';
    if (result.logs.length > 0) {
      result.logs.forEach(log => {
        const div = document.createElement('div');
        div.className = `sim-log-entry ${log.outcome}`;
        div.innerHTML = `<span>[${log.trial}회차] 대원 발견!</span> <strong>${log.name}</strong>`;
        DOM.simLogContainer.appendChild(div);
      });
    } else if (trials <= 50) {
      const div = document.createElement('div');
      div.className = 'sim-log-entry';
      div.innerHTML = `<span style="color: #64748b;">${trials}회 탐험 동안 새로운 대원을 발견하지 못했습니다.</span>`;
      DOM.simLogContainer.appendChild(div);
    }
  }
}

function resetHelperSimulation() {
  if (DOM.simEmptyState) DOM.simEmptyState.classList.remove('hidden');
  if (DOM.simActiveResults) DOM.simActiveResults.classList.add('hidden');
  if (DOM.simLogContainer) DOM.simLogContainer.innerHTML = '';
}

// ==========================================
// 7. UI 업데이트 (설정 갱신 vs 계산 결과 산출 분리)
// ==========================================

// 상단 설정 카드들의 실시간 수치 및 안내 갱신
function updateSettingsUI() {
  const calcData = calculateExpeditionRewards();
  const totalHelpers = getTotalHelpers();
  const areaData = AREA_DATABASE[appState.area] || AREA_DATABASE['평화 초원'];

  // 1. 탐험 문장 정보 (DOM 요소가 존재할 경우에만 갱신)
  if (DOM.infoTotalSentences) DOM.infoTotalSentences.textContent = calcData.totalSentences;
  if (DOM.infoYellowSentences) DOM.infoYellowSentences.textContent = calcData.yellowSentences.toFixed(1);
  if (DOM.infoWhiteSentences) DOM.infoWhiteSentences.textContent = calcData.whiteSentences.toFixed(1);

  // 2. 레벨 효과
  DOM.levelEffectDisplay.textContent = `+${calcData.levelEffect.value.toFixed(3)}%`;
  DOM.levelEffectFormula.textContent = `공식: ${calcData.levelEffect.formula}`;

  // 3. 대원 정보
  DOM.totalHelperCount.textContent = totalHelpers;
  const progressPercent = Math.min((totalHelpers / 10) * 100, 100);
  DOM.helperProgressBar.style.width = `${progressPercent}%`;

  if (totalHelpers >= 10) {
    DOM.helperTotalBadge.classList.add('full');
    DOM.helperProgressBar.classList.add('full');
  } else {
    DOM.helperTotalBadge.classList.remove('full');
    DOM.helperProgressBar.classList.remove('full');
  }

  DOM.helperWeightDisplay.textContent = calcData.helperWeight;
  const yellowSuccessPct = 32 + calcData.helperBonusPct;
  DOM.yellowRateDisplay.textContent = `${yellowSuccessPct.toFixed(2)}%`;
  DOM.yellowRateFormula.textContent = `32% + (${calcData.helperWeight} × 0.27%)`;

  const bonusStr = `+${calcData.helperBonusPct.toFixed(2)}%`;
  if (DOM.xpBonusDisplay) DOM.xpBonusDisplay.textContent = bonusStr;

  // 대원 개별 인풋 및 +/- 버튼
  for (const grade in appState.helpers) {
    if (DOM.helperCountInputs[grade]) {
      DOM.helperCountInputs[grade].value = appState.helpers[grade];
    }
  }

  DOM.stepButtons.forEach(btn => {
    const isPlus = btn.classList.contains('btn-plus');
    const target = btn.dataset.target;
    const currentVal = appState.helpers[target];
    if (isPlus) {
      btn.disabled = totalHelpers >= 10;
    } else {
      btn.disabled = currentVal <= 0;
    }
  });

  // 4. 에리어 미리보기 카드: 드롭 아이템 목록 표시
  DOM.areaNameDisplay.textContent = appState.area;
  if (areaData.type === 'event') {
    DOM.areaTypeTag.textContent = '이벤트 에리어';
    DOM.areaTypeTag.className = 'area-tag event';
  } else if (areaData.isExplorerPub || areaData.type === 'special') {
    DOM.areaTypeTag.textContent = '특수 에리어 (대원 영입 특화)';
    DOM.areaTypeTag.className = 'area-tag special';
  } else {
    DOM.areaTypeTag.textContent = '상시 에리어';
    DOM.areaTypeTag.className = 'area-tag';
  }

  const droppedItemNames = ITEM_DEFS.filter(it => areaData.items[it.key]).map(it => it.name);
  if (areaData.isExplorerPub) {
    DOM.areaDropItemsList.textContent = 'XP (통조림 미드롭 / 대원·조수 발견률 18% 2배 특화)';
  } else {
    DOM.areaDropItemsList.textContent = droppedItemNames.join(', ');
  }

  // 5. 특수 버프 (신사 이나리 & 초집중) 상태 표시
  if (DOM.buffCardInari) DOM.buffCardInari.classList.toggle('active', appState.inari);
  if (DOM.inariStatusText) {
    DOM.inariStatusText.textContent = appState.inari ? '적용 중 (2배)' : '미적용 (1배)';
    DOM.inariStatusText.className = appState.inari ? 'buff-status-chip active' : 'buff-status-chip';
  }

  if (DOM.buffCardFocus) DOM.buffCardFocus.classList.toggle('active', appState.focus);
  if (DOM.focusStatusText) {
    DOM.focusStatusText.textContent = appState.focus ? '적용 중 (+1개)' : '미적용 (+0개)';
    DOM.focusStatusText.className = appState.focus ? 'buff-status-chip active' : 'buff-status-chip';
  }

  // 6. 조수 상태 칩 동기화
  if (DOM.btnAssistantUnder5 && DOM.btnAssistantFull5) {
    DOM.btnAssistantUnder5.classList.toggle('active', !appState.assistantFull);
    DOM.btnAssistantFull5.classList.toggle('active', appState.assistantFull);
  }

  // 7. 시뮬레이터 타겟 횟수 동기화
  const curTrials = Math.max(1, appState.trials || 1);
  if (DOM.simTargetTrials) DOM.simTargetTrials.textContent = curTrials.toLocaleString();
  if (DOM.simBtnTrialsCount) DOM.simBtnTrialsCount.textContent = curTrials.toLocaleString();

  // 이미 한 번 계산한 상태에서 설정을 바꿨다면 버튼 강조
  if (appState.hasCalculated && DOM.btnCalculate) {
    DOM.btnCalculate.classList.add('pulse');
  }
}

// [탐험 기대값 계산하기] 버튼 클릭 시 호출되어 최종 보상 계산 및 화면 표시
function calculateAndDisplayResults() {
  appState.hasCalculated = true;

  // 대기 상자 숨기고 결과 상자 표시
  if (DOM.calcStandbyBox) DOM.calcStandbyBox.classList.add('hidden');
  if (DOM.resultsContainer) DOM.resultsContainer.classList.remove('hidden');
  if (DOM.btnCalculate) DOM.btnCalculate.classList.remove('pulse');

  const calcData = calculateExpeditionRewards();
  const areaData = AREA_DATABASE[appState.area] || AREA_DATABASE['평화 초원'];
  const totalHelpers = getTotalHelpers();
  const trials = Math.max(1, appState.trials || 1);

  // 요약 배너 갱신
  const timeNameMap = { 1: '잠깐 탐험 (1시간)', 3: '적당히 탐험 (3시간)', 6: '천천히 탐험 (6시간)' };
  DOM.sumTime.textContent = timeNameMap[appState.time] || `${appState.time}시간`;
  DOM.sumLevel.textContent = `Lv.${appState.level} (+${calcData.levelEffect.value.toFixed(2)}%)`;
  DOM.sumHelpers.textContent = `${totalHelpers}마리 (가중치 ${calcData.helperWeight})`;
  DOM.sumArea.textContent = appState.area;
  if (DOM.sumTrials) DOM.sumTrials.textContent = `${trials}회`;
  DOM.sumInari.textContent = appState.inari ? 'ON (×2)' : 'OFF';
  DOM.sumInari.style.color = appState.inari ? '#fbbf24' : '#e2e8f0';
  if (DOM.sumFocus) {
    DOM.sumFocus.textContent = appState.focus ? 'ON (+1개)' : 'OFF';
    DOM.sumFocus.style.color = appState.focus ? '#f87171' : '#e2e8f0';
  }
  if (DOM.sumAssistant) {
    DOM.sumAssistant.textContent = appState.assistantFull ? '5명 풀' : '5명 미만';
    DOM.sumAssistant.style.color = appState.assistantFull ? '#4ade80' : '#38bdf8';
  }

  // 결과 타이틀 갱신
  if (DOM.resultTitleDisplay) {
    DOM.resultTitleDisplay.textContent = trials > 1
      ? `${trials}회 탐험 누적 기대 보상`
      : '1회 탐험 최종 기대 보상';
  }

  // 수식 인용구 갱신 (존재할 경우)
  if (DOM.quoteLevelEffect) {
    DOM.quoteLevelEffect.textContent = `+${calcData.levelEffect.value.toFixed(3)}%`;
  }

  // 12종 아이템 카드 갱신 (해당 에리어에서 드롭되는 종류만 표시, 없는 종류는 숨김)
  ITEM_DEFS.forEach(item => {
    const res = calcData.items[item.key];
    const cardEl = document.getElementById(`card-${item.key}`);
    const probEl = document.getElementById(`prob-${item.key}`);
    const expectEl = document.getElementById(`expect-${item.key}`);
    const dropUnitEl = document.getElementById(`dropunit-${item.key}`);

    if (cardEl) {
      if (res && res.isDropped) {
        cardEl.classList.remove('hidden');

        if (probEl) probEl.textContent = `${res.finalProb.toFixed(3)}%`;
        if (dropUnitEl) dropUnitEl.textContent = res.dropUnit;

        if (expectEl) {
          const singleQty = res.expectedQty;
          const totalQty = singleQty * trials;

          if (item.key === 'xp') {
            if (trials > 1) {
              expectEl.innerHTML = `약 ${Math.round(totalQty).toLocaleString()} XP <span class="per-run-sub">(1회당 약 ${Math.round(singleQty).toLocaleString()} XP)</span>`;
            } else {
              expectEl.textContent = `약 ${Math.round(singleQty).toLocaleString()} XP`;
            }
          } else {
            if (trials > 1) {
              expectEl.innerHTML = `약 ${totalQty.toFixed(2)}개 <span class="per-run-sub">(1회당 약 ${singleQty.toFixed(2)}개)</span>`;
            } else {
              expectEl.textContent = `약 ${singleQty.toFixed(2)}개`;
            }
          }
        }

        // XP 카드의 통조림 전환 보너스 안내 행
        if (item.key === 'xp' && DOM.xpBonusRow) {
          DOM.xpBonusRow.style.display = calcData.hasCanInArea ? 'flex' : 'none';
        }

        // 배틀아이템 & 캣츠아이 버프 적용 안내 행
        const noteEl = document.getElementById(`note-${item.key}`);
        if (noteEl && (item.isBattle || item.isCatseye)) {
          let buffNotes = [];
          if (areaData.isCatseyeCave && item.isCatseye) {
            buffNotes.push('최대 1개 상한 반영');
          }
          if (appState.inari) buffNotes.push('이나리 ×2');
          if (appState.focus) buffNotes.push('초집중 +1');

          if (buffNotes.length > 0) {
            noteEl.textContent = `※ ${buffNotes.join(' + ')} 적용`;
            noteEl.style.display = 'block';
            noteEl.style.color = '#fbbf24';
          } else {
            noteEl.style.display = 'none';
          }
        }
      } else {
        cardEl.classList.add('hidden');
      }
    }
  });

  // 대원 및 조수 출현 확률 & 기대치 갱신
  const helperDiscovery = calculateHelperDiscoveryRates(appState.time, appState.area, appState.assistantFull);
  const hRates = helperDiscovery.rates;

  if (DOM.discoveryAreaTag) {
    if (helperDiscovery.isExplorerPub) {
      DOM.discoveryAreaTag.textContent = '익스플로러 펍 (기본 18.0% - 대원 특화 2배!)';
      DOM.discoveryAreaTag.className = 'discovery-env-tag jackpot';
    } else if (helperDiscovery.isEarlyArea) {
      DOM.discoveryAreaTag.textContent = '초반부 에리어 (기본 7.5%)';
      DOM.discoveryAreaTag.className = 'discovery-env-tag';
    } else {
      DOM.discoveryAreaTag.textContent = '후반부 에리어 (기본 9.0%)';
      DOM.discoveryAreaTag.className = 'discovery-env-tag';
    }
  }
  if (DOM.discoveryTimeTag) {
    DOM.discoveryTimeTag.textContent = `${appState.time}시간 (${helperDiscovery.attempts}회 시도)`;
  }
  if (DOM.discoveryAssistantTag) {
    DOM.discoveryAssistantTag.textContent = appState.assistantFull ? '조수 5명 풀 (리롤 효과 적용)' : '조수 5명 미만 (0~4명)';
    DOM.discoveryAssistantTag.className = appState.assistantFull ? 'discovery-env-tag highlight' : 'discovery-env-tag';
  }
  if (DOM.discoveryTotalHelperRate) {
    DOM.discoveryTotalHelperRate.textContent = `${hRates.totalHelper.toFixed(2)}%`;
  }
  if (DOM.discoveryRateCompare) {
    DOM.discoveryRateCompare.textContent = appState.assistantFull
      ? '(조수 풀 상태: 대원 확률 +35% UP)'
      : '(조수 획득 가능)';
  }
  if (DOM.discoveryTrialsSpan) {
    DOM.discoveryTrialsSpan.textContent = `${trials}회`;
  }

  // trials count labels in discovery cards
  document.querySelectorAll('.trials-label-text').forEach(el => {
    el.textContent = `${trials}회`;
  });

  // 6개 등급 카드 수치 반영
  const grades = ['gold', 'silver', 'bronze', 'white', 'assistant', 'none'];
  grades.forEach(g => {
    if (DOM.rates[g]) DOM.rates[g].textContent = `${hRates[g].toFixed(2)}%`;
    if (DOM.expects[g]) {
      const expCount = (trials * hRates[g] / 100);
      if (g === 'none') {
        DOM.expects[g].textContent = `약 ${expCount.toFixed(2)}회`;
      } else if (g === 'assistant') {
        DOM.expects[g].textContent = appState.assistantFull ? '0마리 (풀)' : `약 ${expCount.toFixed(2)}마리`;
      } else {
        DOM.expects[g].textContent = `약 ${expCount.toFixed(2)}마리`;
      }
    }
  });

  if (DOM.cardAssistant) {
    if (appState.assistantFull) {
      DOM.cardAssistant.style.opacity = '0.65';
      if (DOM.tagAssistant) DOM.tagAssistant.textContent = '5명 보유 (발견 불가)';
    } else {
      DOM.cardAssistant.style.opacity = '1';
      if (DOM.tagAssistant) DOM.tagAssistant.textContent = '성 개발 보조';
    }
  }

  if (DOM.simTargetTrials) DOM.simTargetTrials.textContent = trials.toLocaleString();
  if (DOM.simBtnTrialsCount) DOM.simBtnTrialsCount.textContent = trials.toLocaleString();

  // 디버그 JSON 뷰어
  const activeItemsSummary = {};
  for (const k in calcData.items) {
    if (calcData.items[k].isDropped) {
      activeItemsSummary[k] = calcData.items[k];
    }
  }

  DOM.jsonViewer.textContent = JSON.stringify({
    설정: {
      탐험시간: timeNameMap[appState.time] || `${appState.time}시간`,
      가마토토_레벨: appState.level,
      레벨_효과: `+${calcData.levelEffect.value.toFixed(3)}%`,
      대원_가중치: calcData.helperWeight,
      노란문장_성공률: `${(32 + calcData.helperBonusPct).toFixed(2)}%`,
      신사_이나리_2배: appState.inari,
      초집중_1개추가: appState.focus,
      조수_5명_보유: appState.assistantFull,
      시행_횟수: `${trials}회`,
      에리어: appState.area,
      출현_아이템_수: Object.keys(activeItemsSummary).length
    },
    대원_조수_발견_분석: {
      에리어_유형: helperDiscovery.isExplorerPub ? '익스플로러 펍 (18.0% 2배 특화)' : (helperDiscovery.isEarlyArea ? '초반부 (7.5%)' : '후반부 (9.0%)'),
      탐험_독립시도: `${helperDiscovery.attempts}회`,
      조수_리롤_적용: appState.assistantFull,
      대원_총_발견율: `${hRates.totalHelper.toFixed(2)}%`,
      등급별_1회_확률: {
        카리스마_레전드: `${hRates.gold.toFixed(2)}%`,
        숙련가: `${hRates.silver.toFixed(2)}%`,
        평범이: `${hRates.bronze.toFixed(2)}%`,
        초보자: `${hRates.white.toFixed(2)}%`,
        오토토_조수: `${hRates.assistant.toFixed(2)}%`,
        꽝_미발견: `${hRates.none.toFixed(2)}%`
      }
    },
    드롭_아이템_기대값: activeItemsSummary
  }, null, 2);

  // 결과 위치로 부드럽게 스크롤 이동
  setTimeout(() => {
    DOM.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

function setLevel(newLevel) {
  let val = parseInt(newLevel, 10);
  if (isNaN(val)) val = 1;
  val = Math.max(1, Math.min(130, val));
  appState.level = val;
  DOM.levelInput.value = val;
  DOM.levelSlider.value = val;
  updateSettingsUI();
}

function setArea(areaName) {
  appState.area = areaName;
  updateSettingsUI();
}

function setTrials(num) {
  let val = parseInt(num, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 10000) val = 10000;
  appState.trials = val;
  if (DOM.trialsInput && parseInt(DOM.trialsInput.value, 10) !== val) {
    DOM.trialsInput.value = val;
  }

  // 칩 활성화 상태 동기화
  if (DOM.trialChips) {
    DOM.trialChips.forEach(chip => {
      chip.classList.toggle('active', parseInt(chip.dataset.trials, 10) === val);
    });
  }

  updateSettingsUI();
}

// ==========================================
// 8. 이벤트 바인딩
// ==========================================

DOM.timeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.checked) {
      appState.time = parseInt(e.target.value, 10);
      updateSettingsUI();
    }
  });
});

DOM.levelSlider.addEventListener('input', (e) => setLevel(e.target.value));
DOM.levelInput.addEventListener('change', (e) => setLevel(e.target.value));
DOM.levelChips.forEach(chip => chip.addEventListener('click', () => setLevel(chip.dataset.level)));

DOM.stepButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const isPlus = btn.classList.contains('btn-plus');
    const target = btn.dataset.target;
    const total = getTotalHelpers();
    if (isPlus) {
      if (total < 10) appState.helpers[target] += 1;
    } else {
      if (appState.helpers[target] > 0) appState.helpers[target] -= 1;
    }
    updateSettingsUI();
  });
});

DOM.presetClear.addEventListener('click', () => {
  appState.helpers = { white: 0, bronze: 0, silver: 0, gold: 0, legend: 0 };
  updateSettingsUI();
});

DOM.presetLegend10.addEventListener('click', () => {
  appState.helpers = { white: 0, bronze: 0, silver: 0, gold: 0, legend: 10 };
  updateSettingsUI();
});

DOM.areaSelect.addEventListener('change', (e) => setArea(e.target.value));
DOM.inariToggle.addEventListener('change', (e) => {
  appState.inari = e.target.checked;
  updateSettingsUI();
});

if (DOM.focusToggle) {
  DOM.focusToggle.addEventListener('change', (e) => {
    appState.focus = e.target.checked;
    updateSettingsUI();
  });
}

// 시행 횟수 조절 이벤트
if (DOM.trialsInput) {
  DOM.trialsInput.addEventListener('input', (e) => setTrials(e.target.value));
  DOM.trialsInput.addEventListener('change', (e) => setTrials(e.target.value));
}

if (DOM.btnTrialMinus) {
  DOM.btnTrialMinus.addEventListener('click', () => {
    setTrials((appState.trials || 1) - 1);
  });
}

if (DOM.btnTrialPlus) {
  DOM.btnTrialPlus.addEventListener('click', () => {
    setTrials((appState.trials || 1) + 1);
  });
}

if (DOM.trialChips) {
  DOM.trialChips.forEach(chip => {
    chip.addEventListener('click', () => {
      setTrials(chip.dataset.trials);
    });
  });
}

// 캣츠아이 순위표 아코디언 토글 텍스트 연동
const catseyeDetails = document.querySelector('.catseye-ranking-details');
if (catseyeDetails) {
  const toggleText = catseyeDetails.querySelector('.catseye-summary-toggle');
  catseyeDetails.addEventListener('toggle', () => {
    if (toggleText) {
      toggleText.textContent = catseyeDetails.open ? '순위표 접기 ▲' : '펼쳐보기 ▼';
    }
  });
}

// 오토토 조수 상태 토글 이벤트
if (DOM.btnAssistantUnder5) {
  DOM.btnAssistantUnder5.addEventListener('click', () => {
    appState.assistantFull = false;
    updateSettingsUI();
    if (appState.hasCalculated) {
      calculateAndDisplayResults();
    }
  });
}

if (DOM.btnAssistantFull5) {
  DOM.btnAssistantFull5.addEventListener('click', () => {
    appState.assistantFull = true;
    updateSettingsUI();
    if (appState.hasCalculated) {
      calculateAndDisplayResults();
    }
  });
}

// 가상 탐험 실제 난수 시뮬레이터 실행 & 리셋 이벤트
if (DOM.btnRunSimulation) {
  DOM.btnRunSimulation.addEventListener('click', () => {
    DOM.btnRunSimulation.style.transform = 'scale(0.96)';
    setTimeout(() => DOM.btnRunSimulation.style.transform = '', 120);
    executeHelperSimulation();
  });
}

if (DOM.btnResetSimulation) {
  DOM.btnResetSimulation.addEventListener('click', () => {
    resetHelperSimulation();
  });
}

// 기대값 계산하기 버튼 클릭
DOM.btnCalculate.addEventListener('click', () => {
  DOM.btnCalculate.style.transform = 'scale(0.97)';
  setTimeout(() => DOM.btnCalculate.style.transform = '', 120);
  calculateAndDisplayResults();
});

// 초기 로딩 (결과는 아직 계산하지 않고 대기 상태 유지)
document.addEventListener('DOMContentLoaded', () => {
  setArea(DOM.areaSelect.value);
  setLevel(100);
  setTrials(1);
  updateSettingsUI();
});
