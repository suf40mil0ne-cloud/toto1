const generatedList = document.querySelector("#generated-list");
const setCountSelect = document.querySelector("#set-count");
const generateBtn = document.querySelector("#generate-btn");
const resetOptionsBtn = document.querySelector("#reset-options-btn");
const generatorMessage = document.querySelector("#generator-message");

const includePicker = document.querySelector("#include-picker");
const excludePicker = document.querySelector("#exclude-picker");
const lastDrawPicker = document.querySelector("#last-draw-picker");
const includeSummary = document.querySelector("#include-summary");
const excludeSummary = document.querySelector("#exclude-summary");
const lastDrawSummary = document.querySelector("#last-draw-summary");
const clearIncludeBtn = document.querySelector("#clear-include-btn");
const clearExcludeBtn = document.querySelector("#clear-exclude-btn");
const clearLastDrawBtn = document.querySelector("#clear-last-draw-btn");
const excludeLastDrawInput = document.querySelector("#exclude-last-draw");
const sumRangeInput = document.querySelector("#sum-range");
const oddRangeInput = document.querySelector("#odd-range");
const lowRangeInput = document.querySelector("#low-range");
const maxConsecutiveSelect = document.querySelector("#max-consecutive");
const maxSameEndingSelect = document.querySelector("#max-same-ending");

const drawInput = document.querySelector("#draw-no");
const checkDrawBtn = document.querySelector("#check-draw-btn");
const loadLatestBtn = document.querySelector("#load-latest-btn");
const drawResult = document.querySelector("#draw-result");

const storeInput = document.querySelector("#store-draw-no");
const storeSearchBtn = document.querySelector("#store-search-btn");
const storeResult = document.querySelector("#store-result");

const API_DRAW = "/api/draw";
const API_STORES = "/api/stores";
const picked = {
  include: new Set(),
  exclude: new Set(),
  lastDraw: new Set(),
};

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

function parseMinMax(text, label, min, max) {
  const tokens = text
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => Number(v));

  if (tokens.length !== 2 || tokens.some((v) => !Number.isInteger(v))) {
    throw new Error(`${label} 형식은 "최소,최대" 입니다.`);
  }

  const [a, b] = tokens;
  if (a > b || a < min || b > max) {
    throw new Error(`${label} 범위는 ${min}~${max} 사이에서 최소<=최대로 입력해야 합니다.`);
  }

  return { min: a, max: b };
}

function getMaxConsecutive(numbers) {
  let best = 1;
  let streak = 1;

  for (let i = 1; i < numbers.length; i += 1) {
    if (numbers[i] === numbers[i - 1] + 1) {
      streak += 1;
      best = Math.max(best, streak);
    } else {
      streak = 1;
    }
  }

  return best;
}

function getMaxSameEnding(numbers) {
  const counts = new Map();
  numbers.forEach((n) => {
    const key = n % 10;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Math.max(...counts.values());
}

function toSortedArray(setObj) {
  return Array.from(setObj).sort((a, b) => a - b);
}

function formatPickedSummary(type) {
  const arr = toSortedArray(picked[type]);
  return arr.length ? arr.join(", ") : "선택 없음";
}

function syncPickerSummary() {
  includeSummary.textContent = formatPickedSummary("include");
  excludeSummary.textContent = formatPickedSummary("exclude");
  lastDrawSummary.textContent = formatPickedSummary("lastDraw");
}

function buildPicker(container, type) {
  container.innerHTML = "";
  for (let n = 1; n <= 45; n += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pick-btn";
    btn.dataset.type = type;
    btn.dataset.number = String(n);
    btn.textContent = String(n);
    container.appendChild(btn);
  }
}

function paintPickerButtons() {
  document.querySelectorAll(".pick-btn").forEach((btn) => {
    const type = btn.dataset.type;
    const n = Number(btn.dataset.number);
    btn.classList.remove("active-include", "active-exclude", "active-lastdraw");
    if (type === "include" && picked.include.has(n)) btn.classList.add("active-include");
    if (type === "exclude" && picked.exclude.has(n)) btn.classList.add("active-exclude");
    if (type === "lastDraw" && picked.lastDraw.has(n)) btn.classList.add("active-lastdraw");
  });
}

function togglePicked(type, n) {
  const target = picked[type];

  if (target.has(n)) {
    target.delete(n);
    return;
  }

  if (type === "include") {
    if (picked.include.size >= 6) {
      throw new Error("포함 번호는 최대 6개까지 선택할 수 있습니다.");
    }
    if (picked.exclude.has(n) || picked.lastDraw.has(n)) {
      throw new Error("해당 번호는 제외 계열에 이미 선택되어 있습니다.");
    }
  }

  if (type === "exclude" || type === "lastDraw") {
    if (picked.include.has(n)) {
      throw new Error("해당 번호는 포함 번호로 이미 선택되어 있습니다.");
    }
  }

  if (type === "lastDraw" && picked.lastDraw.size >= 6) {
    throw new Error("직전회차 번호는 6개까지만 선택할 수 있습니다.");
  }

  target.add(n);
}

function onPickerClick(event) {
  const btn = event.target.closest(".pick-btn");
  if (!btn) return;

  const type = btn.dataset.type;
  const n = Number(btn.dataset.number);

  try {
    togglePicked(type, n);
    generatorMessage.textContent = "옵션을 설정한 뒤 번호를 생성하세요.";
    paintPickerButtons();
    syncPickerSummary();
  } catch (error) {
    generatorMessage.textContent = `선택 실패: ${error.message}`;
  }
}

function initPickers() {
  buildPicker(includePicker, "include");
  buildPicker(excludePicker, "exclude");
  buildPicker(lastDrawPicker, "lastDraw");

  includePicker.addEventListener("click", onPickerClick);
  excludePicker.addEventListener("click", onPickerClick);
  lastDrawPicker.addEventListener("click", onPickerClick);

  clearIncludeBtn.addEventListener("click", () => {
    picked.include.clear();
    paintPickerButtons();
    syncPickerSummary();
  });

  clearExcludeBtn.addEventListener("click", () => {
    picked.exclude.clear();
    paintPickerButtons();
    syncPickerSummary();
  });

  clearLastDrawBtn.addEventListener("click", () => {
    picked.lastDraw.clear();
    paintPickerButtons();
    syncPickerSummary();
  });

  paintPickerButtons();
  syncPickerSummary();
}

function parseGeneratorOptions() {
  const includeNumbers = toSortedArray(picked.include);
  const excludeNumbers = toSortedArray(picked.exclude);
  const useLastDraw = excludeLastDrawInput.checked;
  const lastDrawNumbers = useLastDraw ? toSortedArray(picked.lastDraw) : [];

  if (useLastDraw && lastDrawNumbers.length !== 6) {
    throw new Error("직전회차 제외를 사용하려면 번호 6개를 입력해야 합니다.");
  }

  if (includeNumbers.length > 6) {
    throw new Error("포함 번호는 최대 6개까지 입력할 수 있습니다.");
  }

  const sumRange = parseMinMax(sumRangeInput.value, "합계 범위", 21, 255);
  const oddRange = parseMinMax(oddRangeInput.value, "홀수 개수 범위", 0, 6);
  const lowRange = parseMinMax(lowRangeInput.value, "저번호 개수 범위", 0, 6);

  const finalExcluded = new Set([...excludeNumbers, ...lastDrawNumbers]);

  includeNumbers.forEach((n) => {
    if (finalExcluded.has(n)) {
      throw new Error(`번호 ${n}은(는) 포함과 제외에 동시에 들어갈 수 없습니다.`);
    }
  });

  return {
    setCount: Number(setCountSelect.value),
    includeNumbers,
    excludedNumbers: Array.from(finalExcluded),
    sumRange,
    oddRange,
    lowRange,
    maxConsecutive: Number(maxConsecutiveSelect.value),
    maxSameEnding: Number(maxSameEndingSelect.value),
    useLastDraw,
  };
}

function matchesRules(numbers, options) {
  const sum = numbers.reduce((a, b) => a + b, 0);
  if (sum < options.sumRange.min || sum > options.sumRange.max) return false;

  const oddCount = numbers.filter((n) => n % 2 === 1).length;
  if (oddCount < options.oddRange.min || oddCount > options.oddRange.max) return false;

  const lowCount = numbers.filter((n) => n <= 22).length;
  if (lowCount < options.lowRange.min || lowCount > options.lowRange.max) return false;

  if (getMaxConsecutive(numbers) > options.maxConsecutive) return false;
  if (getMaxSameEnding(numbers) > options.maxSameEnding) return false;

  return true;
}

function generateOneSet(options) {
  const includeSet = new Set(options.includeNumbers);
  const pool = [];

  for (let i = 1; i <= 45; i += 1) {
    if (includeSet.has(i)) continue;
    if (options.excludedNumbers.includes(i)) continue;
    pool.push(i);
  }

  const need = 6 - options.includeNumbers.length;
  if (need < 0) throw new Error("포함 번호가 6개를 초과했습니다.");
  if (pool.length < need) {
    throw new Error("제외 조건이 너무 많아 6개 번호를 구성할 수 없습니다.");
  }

  const maxAttempts = 25000;
  for (let i = 0; i < maxAttempts; i += 1) {
    const picked = pickRandom(pool, need);
    const candidate = [...options.includeNumbers, ...picked].sort((a, b) => a - b);

    if (matchesRules(candidate, options)) {
      return candidate;
    }
  }

  throw new Error("설정한 조건이 너무 엄격해 번호를 생성하지 못했습니다. 범위를 완화해 보세요.");
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

function renderGeneratedSets() {
  generatedList.innerHTML = "";

  try {
    const options = parseGeneratorOptions();

    for (let i = 0; i < options.setCount; i += 1) {
      const numbers = generateOneSet(options);
      const li = document.createElement("li");
      li.className = "number-set";

      const label = document.createElement("strong");
      label.textContent = `${i + 1}세트`;
      li.appendChild(label);

      numbers.forEach((num) => li.appendChild(createBall(num)));
      generatedList.appendChild(li);
    }

    const applied = [
      `포함 ${options.includeNumbers.length}개`,
      `제외 ${options.excludedNumbers.length}개`,
      `합계 ${options.sumRange.min}-${options.sumRange.max}`,
      `홀수 ${options.oddRange.min}-${options.oddRange.max}`,
      `저번호 ${options.lowRange.min}-${options.lowRange.max}`,
      `연속최대 ${options.maxConsecutive}`,
      `끝수최대 ${options.maxSameEnding}`,
    ];

    if (options.useLastDraw) applied.push("직전회차 제외 적용");
    generatorMessage.textContent = `적용 조건: ${applied.join(" · ")}`;
  } catch (error) {
    generatorMessage.textContent = `생성 실패: ${error.message}`;
  }
}

function resetGeneratorOptions() {
  setCountSelect.value = "3";
  picked.include.clear();
  picked.exclude.clear();
  picked.lastDraw.clear();
  excludeLastDrawInput.checked = false;
  sumRangeInput.value = "100,180";
  oddRangeInput.value = "2,4";
  lowRangeInput.value = "2,4";
  maxConsecutiveSelect.value = "2";
  maxSameEndingSelect.value = "2";
  paintPickerButtons();
  syncPickerSummary();
  generatorMessage.textContent = "옵션을 초기화했습니다. 새 조건으로 생성하세요.";
  generatedList.innerHTML = "";
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
  } catch (error) {
    drawResult.textContent = `최신 회차 조회 실패: ${error.message}`;
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

generateBtn.addEventListener("click", renderGeneratedSets);
resetOptionsBtn.addEventListener("click", resetGeneratorOptions);
checkDrawBtn.addEventListener("click", handleCheckDraw);
loadLatestBtn.addEventListener("click", handleLoadLatest);
storeSearchBtn.addEventListener("click", handleStoreSearch);

initPickers();
renderGeneratedSets();
initAdsense();
