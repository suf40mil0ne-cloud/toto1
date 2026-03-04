const generatedList = document.querySelector("#generated-list");
const setCountSelect = document.querySelector("#set-count");
const modeSelect = document.querySelector("#generator-mode");
const modeHelp = document.querySelector("#mode-help");
const modePickerWrap = document.querySelector("#mode-picker-wrap");
const modePickerTitle = document.querySelector("#mode-picker-title");
const modePickedSummary = document.querySelector("#mode-picked-summary");
const clearModePickedBtn = document.querySelector("#clear-mode-picked-btn");
const autoLastDrawBtn = document.querySelector("#auto-last-draw-btn");
const generateBtn = document.querySelector("#generate-btn");
const resetOptionsBtn = document.querySelector("#reset-options-btn");
const generatorMessage = document.querySelector("#generator-message");
const modePicker = document.querySelector("#mode-picker");

const drawInput = document.querySelector("#draw-no");
const checkDrawBtn = document.querySelector("#check-draw-btn");
const loadLatestBtn = document.querySelector("#load-latest-btn");
const drawResult = document.querySelector("#draw-result");
const latestNetAmount = document.querySelector("#latest-net-amount");
const latestJackpotMeta = document.querySelector("#latest-jackpot-meta");

const storeInput = document.querySelector("#store-draw-no");
const storeSearchBtn = document.querySelector("#store-search-btn");
const storeResult = document.querySelector("#store-result");
const birthDateInput = document.querySelector("#birth-date-simple");
const calcBioBtn = document.querySelector("#calc-bio-btn");
// ... (previous constants)
const biorhythmResult = document.querySelector("#biorhythm-result");

const API_DRAW = "/api/draw";
const API_STORES = "/api/stores";

// 페이지 새로고침 시 맨 위로 이동
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

const pickedNumbers = new Set();
// ... (rest of the code)
let cachedLatestDrawNumbers = [];
let currentBioScore = null;
let currentBioProfile = null;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function pickRandom(array, count) {
  return shuffle([...array]).slice(0, count);
}

function pickWeightedUnique(pool, count, getWeight) {
  const source = [...pool];
  const picked = [];

  for (let i = 0; i < count; i += 1) {
    if (!source.length) break;

    const weights = source.map((n) => Math.max(0, Number(getWeight(n)) || 0));
    const total = weights.reduce((acc, v) => acc + v, 0);
    let selectedIndex = -1;

    if (total <= 0) {
      selectedIndex = Math.floor(Math.random() * source.length);
    } else {
      let threshold = Math.random() * total;
      for (let j = 0; j < source.length; j += 1) {
        threshold -= weights[j];
        if (threshold <= 0) {
          selectedIndex = j;
          break;
        }
      }
      if (selectedIndex < 0) selectedIndex = source.length - 1;
    }

    picked.push(source[selectedIndex]);
    source.splice(selectedIndex, 1);
  }

  return picked;
}

function toSortedArray(setObj) {
  return Array.from(setObj).sort((a, b) => a - b);
}

function ballColor(number) {
  if (number <= 10) return "#f4b400";
  if (number <= 20) return "#2d9cdb";
  if (number <= 30) return "#eb5757";
  if (number <= 40) return "#646c7a";
  return "#27ae60";
}

function createBall(number) {
  const span = document.createElement("span");
  span.className = "ball";
  span.style.background = ballColor(number);
  span.textContent = String(number);
  return span;
}

function calculateTakeHomeAmount(gross) {
  const amount = Number(gross);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount <= 3_000_000) return amount;
  if (amount <= 300_000_000) return Math.floor(amount * 0.78);
  return Math.floor(300_000_000 * 0.78 + (amount - 300_000_000) * 0.67);
}

function calculateBiorhythm(dateString) {
  const { year, month, day } = dateString;
  const birthDate = new Date(year, month - 1, day);

  const now = new Date();
  birthDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const days = Math.floor((now.getTime() - birthDate.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) {
    throw new Error("미래 날짜는 입력할 수 없습니다.");
  }

  const cycleValue = (period) => Math.sin((2 * Math.PI * days) / period);
  const toScore = (raw) => Math.round((raw + 1) * 50);

  const physical = toScore(cycleValue(23));
  const emotional = toScore(cycleValue(28));
  const intellectual = toScore(cycleValue(33));
  const overall = Math.round(physical * 0.4 + emotional * 0.35 + intellectual * 0.25);

  return { days, physical, emotional, intellectual, overall };
}

function normalizeBirthDateInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 8) {
    throw new Error("생년월일 8자리를 입력하세요. (예: 19940321)");
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const candidate = new Date(year, month - 1, day);
  const now = new Date();

  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || year < 1900
    || year > now.getFullYear()
    || month < 1
    || month > 12
    || day < 1
    || day > 31
    || Number.isNaN(candidate.getTime())
    || candidate.getFullYear() !== year
    || candidate.getMonth() !== month - 1
    || candidate.getDate() !== day
  ) {
    throw new Error("유효한 생년월일을 입력하세요.");
  }

  return {
    year,
    month,
    day,
    compact: digits,
    iso: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function formatBirthInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function buildBioProfile(birthDate, rhythm, strength = "medium") {
  const lucky = new Set();
  const firstTwo = Number(birthDate.compact.slice(0, 2));
  const lastTwo = Number(birthDate.compact.slice(2, 4));
  const digitsSum = birthDate.compact.split("").reduce((acc, d) => acc + Number(d), 0);

  // 후보 번호 생성
  const candidates = [
    birthDate.day,
    birthDate.month,
    (birthDate.year % 45) || 45,
    (firstTwo % 45) || 45,
    (lastTwo % 45) || 45,
    (digitsSum % 45) || 45,
    ((rhythm.physical + rhythm.emotional + rhythm.intellectual) % 45) || 45,
    ((rhythm.overall + birthDate.day + birthDate.month) % 45) || 45,
  ];

  // 정확히 6개가 될 때까지 유효한 번호 추가
  candidates.forEach((n) => {
    if (lucky.size < 6 && n >= 1 && n <= 45) lucky.add(n);
  });

  // 부족하면 랜덤으로 채움
  while (lucky.size < 6) {
    lucky.add(Math.floor(Math.random() * 45) + 1);
  }

  const factor = strength === "weak" ? 0.5 : strength === "strong" ? 1.5 : 1.0;

  // 기본 가중치 편차를 강도(factor)에 따라 조절
  const adjust = (val) => 1 + (val - 1) * factor;

  return {
    lowWeight: adjust(0.75 + rhythm.physical / 100),
    midWeight: adjust(0.75 + rhythm.emotional / 100),
    highWeight: adjust(0.75 + rhythm.intellectual / 100),
    oddWeight: adjust(rhythm.overall >= 50 ? 1.18 : 0.94),
    evenWeight: adjust(rhythm.overall < 50 ? 1.18 : 0.94),
    luckyNumbers: [...lucky].sort((a, b) => a - b),
    luckyWeight: adjust(1.45),
  };
}

function getBioNumberWeight(number, profile) {
  const rangeWeight = number <= 15
    ? profile.lowWeight
    : number <= 30
      ? profile.midWeight
      : profile.highWeight;
  const parityWeight = number % 2 === 0 ? profile.evenWeight : profile.oddWeight;
  const luckyWeight = profile.luckyNumbers.includes(number) ? profile.luckyWeight : 1;
  return rangeWeight * parityWeight * luckyWeight;
}

function calculateSetQuality(numbers) {
  const oddCount = numbers.filter((n) => n % 2 === 1).length;
  const sum = numbers.reduce((acc, n) => acc + n, 0);
  const low = numbers.filter((n) => n <= 15).length;
  const mid = numbers.filter((n) => n > 15 && n <= 30).length;
  const high = numbers.filter((n) => n > 30).length;

  const parityScore = Math.max(0, 100 - Math.abs(oddCount - 3) * 22);
  const sumScore = Math.max(0, 100 - Math.abs(sum - 138));
  const spreadPenalty = Math.abs(low - 2) + Math.abs(mid - 2) + Math.abs(high - 2);
  const spreadScore = Math.max(0, 100 - spreadPenalty * 22);

  return Math.round(parityScore * 0.34 + sumScore * 0.33 + spreadScore * 0.33);
}

function buildModePicker() {
  modePicker.innerHTML = "";
  for (let n = 1; n <= 45; n += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pick-btn";
    btn.dataset.number = String(n);
    btn.textContent = String(n);
    modePicker.appendChild(btn);
  }
}

function paintModePicker() {
  document.querySelectorAll("#mode-picker .pick-btn").forEach((btn) => {
    const number = Number(btn.dataset.number);
    btn.classList.remove("active-include");
    if (pickedNumbers.has(number)) {
      btn.classList.add("active-include");
    }
  });
}

function syncModePickedSummary() {
  const numbers = toSortedArray(pickedNumbers);
  modePickedSummary.textContent = numbers.length ? numbers.join(", ") : "선택 없음";
}

function updateModeUI() {
  const mode = modeSelect.value;

  if (mode === "random") {
    modeHelp.textContent = "완전 랜덤은 번호 선택 없이 생성합니다.";
    modePickerTitle.textContent = "번호 선택 (사용 안 함)";
    modePickerWrap.style.display = "none";
    autoLastDrawBtn.style.display = "none";
    return;
  }

  modePickerWrap.style.display = "block";
  autoLastDrawBtn.style.display = "none";

  if (mode === "include") {
    modeHelp.textContent = "선택한 번호를 반드시 포함해 생성합니다. (최대 6개 선택)";
    modePickerTitle.textContent = "포함할 번호 선택";
    return;
  }

  if (mode === "exclude") {
    modeHelp.textContent = "선택한 번호를 제외하고 생성합니다.";
    modePickerTitle.textContent = "제외할 번호 선택";
    return;
  }

  modeHelp.textContent = "직전회차 번호를 자동으로 불러와 제외합니다. 필요하면 직접 수정도 가능합니다.";
  modePickerTitle.textContent = "직전회차 번호 선택 (정확히 6개)";
  autoLastDrawBtn.style.display = "inline-flex";
}

function handleModePickerClick(event) {
  const btn = event.target.closest(".pick-btn");
  if (!btn) return;

  const mode = modeSelect.value;
  if (mode === "random") return;

  const n = Number(btn.dataset.number);

  if (pickedNumbers.has(n)) {
    pickedNumbers.delete(n);
  } else {
    if (mode === "include" && pickedNumbers.size >= 6) {
      generatorMessage.textContent = "선택 번호 포함 방식은 최대 6개까지만 선택할 수 있습니다.";
      return;
    }
    if (mode === "exclude-last" && pickedNumbers.size >= 6) {
      generatorMessage.textContent = "직전회차 제외 방식은 6개만 선택할 수 있습니다.";
      return;
    }
    pickedNumbers.add(n);
  }

  paintModePicker();
  syncModePickedSummary();
}

function generateOneSet(mode, selectedNumbers) {
  const includeNumbers = mode === "include" ? selectedNumbers : [];
  const excludedNumbers = mode === "exclude" || mode === "exclude-last" ? selectedNumbers : [];

  const includeSet = new Set(includeNumbers);
  const excludedSet = new Set(excludedNumbers);

  includeNumbers.forEach((n) => {
    if (excludedSet.has(n)) {
      throw new Error(`번호 ${n}은(는) 동시에 포함/제외될 수 없습니다.`);
    }
  });

  const pool = [];
  for (let n = 1; n <= 45; n += 1) {
    if (includeSet.has(n)) continue;
    if (excludedSet.has(n)) continue;
    pool.push(n);
  }

  const need = 6 - includeNumbers.length;
  if (need < 0) throw new Error("포함 번호는 최대 6개입니다.");
  if (pool.length < need) throw new Error("제외 번호가 너무 많아 조합을 만들 수 없습니다.");

  const picked = currentBioProfile
    ? pickWeightedUnique(pool, need, (n) => getBioNumberWeight(n, currentBioProfile))
    : pickRandom(pool, need);

  return [...includeNumbers, ...picked].sort((a, b) => a - b);
}

function renderGeneratedSets() {
  generatedList.innerHTML = "";

  try {
    const mode = modeSelect.value;
    const selectedNumbers = toSortedArray(pickedNumbers);

    if (mode === "exclude-last" && selectedNumbers.length !== 6) {
      throw new Error("직전회차 제외 방식은 번호를 정확히 6개 선택해야 합니다.");
    }

    const setCount = Number(setCountSelect.value);
    for (let i = 0; i < setCount; i += 1) {
      const numbers = generateOneSet(mode, selectedNumbers);
      const li = document.createElement("li");
      li.className = "number-set";

      const label = document.createElement("strong");
      label.textContent = `${i + 1}세트`;
      li.appendChild(label);

      numbers.forEach((num) => li.appendChild(createBall(num)));

      if (currentBioScore !== null) {
        const setQuality = calculateSetQuality(numbers);
        const finalScore = Math.round(setQuality * 0.55 + currentBioScore * 0.45);
        const badge = document.createElement("span");
        badge.className = "score-badge";
        badge.textContent = `구매 점수 ${finalScore}점`;
        li.appendChild(badge);
      }

      generatedList.appendChild(li);
    }

    const bioMode = currentBioProfile ? " · 바이오리듬 연동 ON" : "";
    generatorMessage.textContent = `생성 완료: 방식=${mode}, 선택=${selectedNumbers.length}개${bioMode}`;
  } catch (error) {
    generatorMessage.textContent = `생성 실패: ${error.message}`;
  }
}

function applyLastDrawNumbers(numbers) {
  pickedNumbers.clear();
  numbers.forEach((n) => pickedNumbers.add(n));
  paintModePicker();
  syncModePickedSummary();
}

async function autoLoadLastDrawNumbers() {
  try {
    generatorMessage.textContent = "직전회차 번호 불러오는 중...";
    const body = await requestJson(`${API_DRAW}?drawNo=latest`);
    const numbers = [
      body.data.drwtNo1,
      body.data.drwtNo2,
      body.data.drwtNo3,
      body.data.drwtNo4,
      body.data.drwtNo5,
      body.data.drwtNo6,
    ];
    cachedLatestDrawNumbers = [...numbers];
    applyLastDrawNumbers(numbers);
    generatorMessage.textContent = `직전회차 ${body.data.drwNo}회 번호 자동 적용 완료`;
  } catch (error) {
    if (cachedLatestDrawNumbers.length === 6) {
      applyLastDrawNumbers(cachedLatestDrawNumbers);
      generatorMessage.textContent = "서버 조회 실패로 마지막 저장 번호를 사용했습니다.";
      return;
    }
    generatorMessage.textContent = `자동 불러오기 실패: ${error.message}`;
  }
}

function resetGeneratorOptions() {
  modeSelect.value = "random";
  setCountSelect.value = "3";
  pickedNumbers.clear();
  updateModeUI();
  paintModePicker();
  syncModePickedSummary();
  generatedList.innerHTML = "";
  generatorMessage.textContent = "초기화 완료. 방식을 선택하고 생성하세요.";
}

async function requestJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok || !body.ok) {
    const error = new Error(body.error || `요청 실패: HTTP ${res.status}`);
    error.blocked = Boolean(body.blocked);
    throw error;
  }
  return body;
}

function renderDrawResult(data) {
  const numbers = [
    data.drwtNo1,
    data.drwtNo2,
    data.drwtNo3,
    data.drwtNo4,
    data.drwtNo5,
    data.drwtNo6,
  ];
  cachedLatestDrawNumbers = [...numbers];

  drawResult.innerHTML = "";

  const title = document.createElement("div");
  title.innerHTML = `<strong>${data.drwNo}회</strong> (${data.drwNoDate})`;

  const ballsWrap = document.createElement("div");
  ballsWrap.className = "number-set";
  numbers.forEach((num) => ballsWrap.appendChild(createBall(num)));

  const bonusLabel = document.createElement("span");
  bonusLabel.textContent = "보너스";
  bonusLabel.className = "bonus-label";

  ballsWrap.appendChild(bonusLabel);
  ballsWrap.appendChild(createBall(data.bnusNo));

  const prize = document.createElement("p");
  prize.className = "result-meta";
  prize.textContent = `1등 ${Number(data.firstPrzwnerCo).toLocaleString()}명 · 1인당 ${Number(data.firstWinamnt).toLocaleString()}원`;

  drawResult.append(title, ballsWrap, prize);
}

function updateLatestJackpot(data) {
  const net = calculateTakeHomeAmount(data.firstWinamnt);
  latestNetAmount.textContent = net > 0 ? `${net.toLocaleString()}원` : "정보 없음";
  latestJackpotMeta.textContent = `${data.drwNo}회 (${data.drwNoDate}) · 세전 ${Number(data.firstWinamnt || 0).toLocaleString()}원 · 1등 ${Number(data.firstPrzwnerCo || 0).toLocaleString()}명`;
}

function renderStoreResult(drawNo, stores) {
  if (!stores.length) {
    storeResult.textContent = `${drawNo}회 판매점 정보를 찾지 못했습니다.`;
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "store-list";

  stores.forEach((store) => {
    const li = document.createElement("li");
    li.textContent = `[${store.method}] ${store.name} - ${store.address}`;
    ul.appendChild(li);
  });

  storeResult.innerHTML = `<strong>${drawNo}회 1등 판매점 ${stores.length}곳</strong>`;
  storeResult.appendChild(ul);
}

async function handleCheckDraw() {
  const drawNo = Number(drawInput.value);
  if (!Number.isInteger(drawNo) || drawNo < 1) {
    drawResult.textContent = "1 이상의 회차 번호를 입력하세요.";
    return;
  }

  drawResult.textContent = "조회 중...";
  try {
    const body = await requestJson(`${API_DRAW}?drawNo=${drawNo}`);
    renderDrawResult(body.data);
  } catch (error) {
    if (error.blocked) {
      drawResult.innerHTML = `조회 실패: ${error.message}<br/><a href="https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo=${drawNo}" target="_blank" rel="noopener noreferrer">동행복권 공식 페이지에서 확인</a>`;
      return;
    }
    drawResult.textContent = `조회 실패: ${error.message}`;
  }
}

async function handleLoadLatest() {
  drawResult.textContent = "최신 회차 조회 중...";
  try {
    const body = await requestJson(`${API_DRAW}?drawNo=latest`);
    drawInput.value = body.data.drwNo;
    storeInput.value = body.data.drwNo;
    renderDrawResult(body.data);
    updateLatestJackpot(body.data);
  } catch (error) {
    drawResult.textContent = `최신 회차 조회 실패: ${error.message}`;
  }
}

async function loadLatestSummary() {
  try {
    const body = await requestJson(`${API_DRAW}?drawNo=latest`);
    drawInput.value = body.data.drwNo;
    storeInput.value = body.data.drwNo;
    updateLatestJackpot(body.data);
  } catch (error) {
    latestNetAmount.textContent = "조회 실패";
    latestJackpotMeta.textContent = error.message;
  }
}

function handleCalculateBiorhythm() {
  try {
    if (!birthDateInput.value) {
      throw new Error("생년월일을 먼저 입력하세요.");
    }
    const birthDate = normalizeBirthDateInput(birthDateInput.value);
    birthDateInput.value = formatBirthInput(birthDate.compact);
    const result = calculateBiorhythm(birthDate);

    const strengthEl = document.querySelector('input[name="bio-strength"]:checked');
    const strength = strengthEl ? strengthEl.value : "medium";

    const bioProfile = buildBioProfile(birthDate, result, strength);
    currentBioScore = result.overall;
    currentBioProfile = bioProfile;

    biorhythmResult.innerHTML = `
      <strong>오늘의 바이오리듬 종합 점수: ${result.overall}점</strong>
      <div class="bio-grid">
        <div class="bio-item"><strong>신체 리듬</strong><span>${result.physical}점</span></div>
        <div class="bio-item"><strong>감성 리듬</strong><span>${result.emotional}점</span></div>
        <div class="bio-item"><strong>지성 리듬</strong><span>${result.intellectual}점</span></div>
        <div class="bio-item"><strong>로또 구매 적합도</strong><span>${result.overall}점</span></div>
      </div>
      <p class="bio-note">연동 강도: ${strength === "weak" ? "약" : strength === "strong" ? "강" : "중"}</p>
      <div class="bio-lucky-wrap" style="margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e9eef5;">
        <p style="margin: 0 0 8px; font-weight: 700; font-size: 0.9rem;">연동 추천 번호 (6개)</p>
        <div id="bio-lucky-balls" class="number-set mini-balls" style="border: none; background: none; padding: 0;"></div>
      </div>
      <p class="bio-note">번호 생성 시 바이오리듬 가중치로 숫자 풀을 먼저 선별하고, 조합 점수(55%)와 바이오리듬 점수(45%)를 합산해 세트별 구매 점수를 표시합니다.</p>
    `;

    const luckyBallsContainer = biorhythmResult.querySelector("#bio-lucky-balls");
    bioProfile.luckyNumbers.forEach((num) => {
      luckyBallsContainer.appendChild(createBall(num));
    });
  } catch (error) {
    currentBioScore = null;
    currentBioProfile = null;
    biorhythmResult.textContent = `계산 실패: ${error.message}`;
  }
}

async function handleStoreSearch() {
  const drawNo = Number(storeInput.value);
  if (!Number.isInteger(drawNo) || drawNo < 1) {
    storeResult.textContent = "1 이상의 회차 번호를 입력하세요.";
    return;
  }

  storeResult.textContent = "판매점 조회 중...";
  try {
    const body = await requestJson(`${API_STORES}?drawNo=${drawNo}`);
    renderStoreResult(drawNo, body.stores || []);
  } catch (error) {
    if (error.blocked) {
      storeResult.innerHTML = `조회 실패: ${error.message}<br/><a href="https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645&drwNo=${drawNo}" target="_blank" rel="noopener noreferrer">동행복권 공식 판매점 페이지 열기</a>`;
      return;
    }
    storeResult.textContent = `조회 실패: ${error.message}`;
  }
}

function initAdsense() {
  const adSlots = document.querySelectorAll(".adsbygoogle");
  adSlots.forEach(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      // 광고 스크립트 미설치/심사 전 상태에서는 조용히 무시
    }
  });
}

modeSelect.addEventListener("change", updateModeUI);
modeSelect.addEventListener("change", () => {
  if (modeSelect.value === "exclude-last" && pickedNumbers.size === 0) {
    autoLoadLastDrawNumbers();
  }
});
modePicker.addEventListener("click", handleModePickerClick);
clearModePickedBtn.addEventListener("click", () => {
  pickedNumbers.clear();
  paintModePicker();
  syncModePickedSummary();
});
autoLastDrawBtn.addEventListener("click", autoLoadLastDrawNumbers);

generateBtn.addEventListener("click", renderGeneratedSets);
resetOptionsBtn.addEventListener("click", resetGeneratorOptions);
checkDrawBtn.addEventListener("click", handleCheckDraw);
loadLatestBtn.addEventListener("click", handleLoadLatest);
storeSearchBtn.addEventListener("click", handleStoreSearch);
calcBioBtn.addEventListener("click", handleCalculateBiorhythm);
birthDateInput.addEventListener("input", () => {
  birthDateInput.value = formatBirthInput(birthDateInput.value);
});

buildModePicker();
updateModeUI();
paintModePicker();
syncModePickedSummary();
generatedList.innerHTML = "";
generatorMessage.textContent = "실행 버튼을 눌러 번호를 생성하세요.";
loadLatestSummary();
initAdsense();
