const generatedList = document.querySelector("#generated-list");
const setCountSelect = document.querySelector("#set-count");
const modeSelect = document.querySelector("#generator-mode");
const modeHelp = document.querySelector("#mode-help");
const modePickerWrap = document.querySelector("#mode-picker-wrap");
const modePickerTitle = document.querySelector("#mode-picker-title");
const modePickedSummary = document.querySelector("#mode-picked-summary");
const clearModePickedBtn = document.querySelector("#clear-mode-picked-btn");
const generateBtn = document.querySelector("#generate-btn");
const resetOptionsBtn = document.querySelector("#reset-options-btn");
const generatorMessage = document.querySelector("#generator-message");
const modePicker = document.querySelector("#mode-picker");

const drawInput = document.querySelector("#draw-no");
const checkDrawBtn = document.querySelector("#check-draw-btn");
const loadLatestBtn = document.querySelector("#load-latest-btn");
const drawResult = document.querySelector("#draw-result");

const storeInput = document.querySelector("#store-draw-no");
const storeSearchBtn = document.querySelector("#store-search-btn");
const storeResult = document.querySelector("#store-result");

const API_DRAW = "/api/draw";
const API_STORES = "/api/stores";

const pickedNumbers = new Set();

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
    return;
  }

  modePickerWrap.style.display = "block";

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

  modeHelp.textContent = "직전회차 6개 번호를 선택하면 해당 번호를 제외하고 생성합니다.";
  modePickerTitle.textContent = "직전회차 번호 선택 (정확히 6개)";
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

  return [...includeNumbers, ...pickRandom(pool, need)].sort((a, b) => a - b);
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
      generatedList.appendChild(li);
    }

    generatorMessage.textContent = `생성 완료: 방식=${mode}, 선택=${selectedNumbers.length}개`;
  } catch (error) {
    generatorMessage.textContent = `생성 실패: ${error.message}`;
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

modeSelect.addEventListener("change", updateModeUI);
modePicker.addEventListener("click", handleModePickerClick);
clearModePickedBtn.addEventListener("click", () => {
  pickedNumbers.clear();
  paintModePicker();
  syncModePickedSummary();
});

generateBtn.addEventListener("click", renderGeneratedSets);
resetOptionsBtn.addEventListener("click", resetGeneratorOptions);
checkDrawBtn.addEventListener("click", handleCheckDraw);
loadLatestBtn.addEventListener("click", handleLoadLatest);
storeSearchBtn.addEventListener("click", handleStoreSearch);

buildModePicker();
updateModeUI();
paintModePicker();
syncModePickedSummary();
renderGeneratedSets();
initAdsense();
