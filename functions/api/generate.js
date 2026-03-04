// HMD-V2 Proprietary Algorithm (Server-side)
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];

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

function calculateHarmonicScore(numbers, profile) {
  let totalWeight = 0;
  numbers.forEach(n => {
    let w = 1.0;
    if (n % 3 === 1) w *= profile.mod1Weight;
    else if (n % 3 === 2) w *= profile.mod2Weight;
    else w *= profile.mod0Weight;
    if (PRIMES.includes(n)) w *= profile.primeWeight;
    totalWeight += w;
  });
  const baseAvg = totalWeight / 6;
  return Math.min(99, Math.max(10, Math.round(baseAvg * 25)));
}

export async function onRequestPost({ request }) {
  try {
    const { rhythm, strength, setCount } = await request.json();
    
    // 가중치 보정 (영업비밀 로직)
    const factor = strength === "weak" ? 0.3 : strength === "strong" ? 3.0 : 1.0;
    const adjust = (val) => 1 + (val - 1) * factor;
    
    const profile = {
      mod1Weight: adjust(0.5 + rhythm.physical / 50),
      mod2Weight: adjust(0.5 + rhythm.emotional / 50),
      mod0Weight: adjust(0.5 + rhythm.intellectual / 50),
      primeWeight: adjust(rhythm.overall >= 50 ? 1.3 : 0.8),
      overall: rhythm.overall
    };

    const results = [];
    const pool = Array.from({ length: 45 }, (_, i) => i + 1);

    for (let i = 0; i < setCount; i++) {
      const numbers = pickWeightedUnique(pool, 6, (n) => {
        let w = 1.0;
        if (n % 3 === 1) w *= profile.mod1Weight;
        else if (n % 3 === 2) w *= profile.mod2Weight;
        else w *= profile.mod0Weight;
        if (PRIMES.includes(n)) w *= profile.primeWeight;
        return w;
      }).sort((a, b) => a - b);

      const score = calculateHarmonicScore(numbers, profile);
      results.push({ numbers, score });
    }

    return new Response(JSON.stringify({ ok: true, data: results }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 400 });
  }
}
