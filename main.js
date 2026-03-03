const generatedList = document.querySelector("#generated-list");
const setCountSelect = document.querySelector("#set-count");
const generateBtn = document.querySelector("#generate-btn");

const drawInput = document.querySelector("#draw-no");
const checkDrawBtn = document.querySelector("#check-draw-btn");
const loadLatestBtn = document.querySelector("#load-latest-btn");
const drawResult = document.querySelector("#draw-result");

const storeInput = document.querySelector("#store-draw-no");
const storeSearchBtn = document.querySelector("#store-search-btn");
const storeResult = document.querySelector("#store-result");

const API_DRAW = "/api/draw";
const API_STORES = "/api/stores";

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createLottoSet() {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  return shuffle(pool).slice(0, 6).sort((a, b) => a - b);
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
  const setCount = Number(setCountSelect.value);
  generatedList.innerHTML = "";

  for (let i = 0; i < setCount; i += 1) {
    const li = document.createElement("li");
    li.className = "number-set";

    const label = document.createElement("strong");
    label.textContent = `${i + 1}세트`;
    li.appendChild(label);

    createLottoSet().forEach((num) => li.appendChild(createBall(num)));
    generatedList.appendChild(li);
  }
}

async function requestJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `요청 실패: HTTP ${res.status}`);
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
checkDrawBtn.addEventListener("click", handleCheckDraw);
loadLatestBtn.addEventListener("click", handleLoadLatest);
storeSearchBtn.addEventListener("click", handleStoreSearch);

renderGeneratedSets();
handleLoadLatest();
initAdsense();
