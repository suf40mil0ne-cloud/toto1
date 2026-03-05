// HMD-V2 Proprietary Algorithm (Server-side)
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
const RANGE_MIN = 1;
const RANGE_MAX = 45;
const PICK_COUNT = 6;
const STRENGTH_TUNING = {
  weak: {
    trialsPerSet: 10,
    overlapPenaltyUnit: 4.5,
    sumSlope: 0.30,
    targetBias: 0.88
  },
  normal: {
    trialsPerSet: 16,
    overlapPenaltyUnit: 6.0,
    sumSlope: 0.34,
    targetBias: 1.0
  },
  strong: {
    trialsPerSet: 24,
    overlapPenaltyUnit: 7.0,
    sumSlope: 0.38,
    targetBias: 1.14
  }
};
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 25;
const requestBuckets = new Map();

function pickWeightedUnique(pool, count, getWeight) {
  const source = [...pool];
  const picked = [];
  for (let i = 0; i < count; i += 1) {
    if (!source.length) break;
    const weights = source.map((n) => Math.max(0.01, Number(getWeight(n)) || 0));
    const total = weights.reduce((acc, v) => acc + v, 0);
    let threshold = Math.random() * total;
    let selectedIndex = -1;
    for (let j = 0; j < source.length; j += 1) {
      threshold -= weights[j];
      if (threshold <= 0) {
        selectedIndex = j;
        break;
      }
    }
    if (selectedIndex < 0) selectedIndex = source.length - 1;
    picked.push(source[selectedIndex]);
    source.splice(selectedIndex, 1);
  }
  return picked;
}

function countByMod(numbers) {
  return numbers.reduce((acc, n) => {
    acc[n % 3] += 1;
    return acc;
  }, [0, 0, 0]);
}

function getOddCount(numbers) {
  return numbers.reduce((acc, n) => acc + (n % 2 === 1 ? 1 : 0), 0);
}

function getPrimeCount(numbers) {
  return numbers.reduce((acc, n) => acc + (PRIMES.includes(n) ? 1 : 0), 0);
}

function getDecadeDiversity(numbers) {
  return new Set(numbers.map((n) => Math.floor((n - 1) / 10))).size;
}

function getConsecutiveCount(numbers) {
  let consecutivePairs = 0;
  for (let i = 1; i < numbers.length; i += 1) {
    if (numbers[i] - numbers[i - 1] === 1) consecutivePairs += 1;
  }
  return consecutivePairs;
}

function buildTargetModel(profile, tuning) {
  const modWeights = [profile.mod0Weight, profile.mod1Weight, profile.mod2Weight];
  const modSum = modWeights.reduce((acc, v) => acc + v, 0);
  const modTarget = modWeights.map((v) => (v / modSum) * PICK_COUNT);

  return {
    modTarget,
    primeTarget: (profile.overall >= 65 ? 2.3 : profile.overall >= 50 ? 2.0 : 1.7) * tuning.targetBias,
    oddTarget: (3.0 + (profile.overall >= 70 ? 0.2 : 0)) * Math.min(1.06, tuning.targetBias),
    sumTarget: 120 + profile.overall * 0.5
  };
}

function calculateHarmonicScore(numbers, profile, targetModel, tuning) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const modCounts = countByMod(sorted);
  const primeCount = getPrimeCount(sorted);
  const oddCount = getOddCount(sorted);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const span = sorted[sorted.length - 1] - sorted[0];
  const decadeDiversity = getDecadeDiversity(sorted);
  const consecutivePairs = getConsecutiveCount(sorted);

  const modDeviation = modCounts.reduce(
    (acc, v, idx) => acc + Math.abs(v - targetModel.modTarget[idx]),
    0
  );
  const modScore = Math.max(0, 26 - modDeviation * 5.2);
  const primeScore = Math.max(0, 16 - Math.abs(primeCount - targetModel.primeTarget) * 5);
  const oddEvenScore = Math.max(0, 14 - Math.abs(oddCount - targetModel.oddTarget) * 4.2);
  const sumScore = Math.max(0, 18 - Math.abs(sum - targetModel.sumTarget) * tuning.sumSlope);
  const spanScore = Math.max(0, 12 - Math.abs(span - 28) * 0.5);
  const diversityScore = Math.max(0, Math.min(8, decadeDiversity * 2));
  const consecutivePenalty = consecutivePairs >= 3 ? 9 : consecutivePairs * 2.8;

  let raw = 18 + modScore + primeScore + oddEvenScore + sumScore + spanScore + diversityScore - consecutivePenalty;
  raw = Math.max(18, raw);
  return Math.min(99, Math.round(raw));
}

function overlapCount(a, b) {
  const setB = new Set(b);
  return a.reduce((acc, n) => acc + (setB.has(n) ? 1 : 0), 0);
}

function createNumberWeightFn(profile) {
  return (n) => {
    let w = 1.0;
    if (n % 3 === 1) w *= profile.mod1Weight;
    else if (n % 3 === 2) w *= profile.mod2Weight;
    else w *= profile.mod0Weight;
    if (PRIMES.includes(n)) w *= profile.primeWeight;
    if (n <= 15 && profile.physical >= 60) w *= 1.08;
    if (n >= 31 && profile.intellectual >= 60) w *= 1.08;
    return w;
  };
}

function getClientIp(request) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

function checkRateLimit(clientIp) {
  const now = Date.now();
  const hitList = requestBuckets.get(clientIp) || [];
  const recentHits = hitList.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recentHits.length >= RATE_LIMIT_MAX) {
    requestBuckets.set(clientIp, recentHits);
    return false;
  }
  recentHits.push(now);
  requestBuckets.set(clientIp, recentHits);
  return true;
}

function simulateScoreBaseline(profile, targetModel, tuning) {
  const pool = Array.from({ length: RANGE_MAX }, (_, i) => i + RANGE_MIN);
  const getWeight = createNumberWeightFn(profile);
  const samples = [];
  for (let i = 0; i < 220; i += 1) {
    const numbers = pickWeightedUnique(pool, PICK_COUNT, getWeight).sort((a, b) => a - b);
    samples.push(calculateHarmonicScore(numbers, profile, targetModel, tuning));
  }
  samples.sort((a, b) => a - b);
  return samples;
}

function scoreToPercentile(score, sortedSamples) {
  const lowerOrEqual = sortedSamples.filter((s) => s <= score).length;
  const percentile = (lowerOrEqual / sortedSamples.length) * 100;
  return Number(percentile.toFixed(1));
}

export async function onRequestPost({ request }) {
  try {
    const clientIp = getClientIp(request);
    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }), {
        status: 429,
        headers: { "content-type": "application/json" }
      });
    }

    const { rhythm, strength, setCount } = await request.json();
    
    // 가중치 보정 (영업비밀 로직)
    const strengthKey = strength === "weak" || strength === "strong" ? strength : "normal";
    const tuning = STRENGTH_TUNING[strengthKey];
    const factor = strength === "weak" ? 0.25 : strength === "strong" ? 3.3 : 1.0;
    const adjust = (val) => 1 + (val - 1) * factor;
    
    const profile = {
      mod1Weight: adjust(0.5 + rhythm.physical / 50),
      mod2Weight: adjust(0.5 + rhythm.emotional / 50),
      mod0Weight: adjust(0.5 + rhythm.intellectual / 50),
      primeWeight: adjust(rhythm.overall >= 50 ? 1.3 : 0.8),
      physical: rhythm.physical,
      emotional: rhythm.emotional,
      intellectual: rhythm.intellectual,
      overall: rhythm.overall
    };

    const results = [];
    const pool = Array.from({ length: RANGE_MAX }, (_, i) => i + RANGE_MIN);
    const targetModel = buildTargetModel(profile, tuning);
    const getWeight = createNumberWeightFn(profile);
    const baselineSamples = simulateScoreBaseline(profile, targetModel, tuning);

    for (let i = 0; i < setCount; i++) {
      let best = null;
      for (let t = 0; t < tuning.trialsPerSet; t += 1) {
        const numbers = pickWeightedUnique(pool, PICK_COUNT, getWeight).sort((a, b) => a - b);
        let score = calculateHarmonicScore(numbers, profile, targetModel, tuning);
        if (results.length > 0) {
          const maxOverlap = Math.max(...results.map((r) => overlapCount(numbers, r.numbers)));
          if (maxOverlap >= 4) score -= (maxOverlap - 3) * tuning.overlapPenaltyUnit;
        }
        if (!best || score > best.score) best = { numbers, score };
      }
      const secureScore = Math.max(10, Math.min(99, best.score));
      const rankPercentile = scoreToPercentile(secureScore, baselineSamples);
      results.push({ numbers: best.numbers, score: secureScore, rankPercentile });
    }

    return new Response(JSON.stringify({ ok: true, data: results }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 400 });
  }
}
