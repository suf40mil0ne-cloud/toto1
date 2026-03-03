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

const FIRST_DRAW_DATE = new Date("2002-12-07T20:45:00+09:00");
const OFFICIAL_DRAW_ENDPOINT = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber";
const OFFICIAL_STORE_ENDPOINT = "https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645";

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
  if (number <= 40) return "#888f9b";
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

    createLottoSet().forEach((num) => {
      li.appendChild(createBall(num));
    });

    generatedList.appendChild(li);
  }
}

function estimatedLatestDrawNo() {
  const now = new Date();
  const elapsed = now.getTime() - FIRST_DRAW_DATE.getTime();
  const weeks = Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, weeks + 1);
}

async function fetchJsonWithFallback(url) {
  try {
    const directResponse = await fetch(url, { cache: "no-store" });
    if (!directResponse.ok) {
      throw new Error(`HTTP ${directResponse.status}`);
    }
    return await directResponse.json();
  } catch (directError) {
    const wrapped = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const wrappedResponse = await fetch(wrapped, { cache: "no-store" });
    if (!wrappedResponse.ok) {
      throw new Error(`프록시 호출 실패: HTTP ${wrappedResponse.status}`);
    }
    return await wrappedResponse.json();
  }
}

async function fetchTextWithFallback(url) {
  try {
    const directResponse = await fetch(url, { cache: "no-store" });
    if (!directResponse.ok) {
      throw new Error(`HTTP ${directResponse.status}`);
    }
    return await directResponse.text();
  } catch (directError) {
    const wrapped = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const wrappedResponse = await fetch(wrapped, { cache: "no-store" });
    if (!wrappedResponse.ok) {
      throw new Error(`프록시 호출 실패: HTTP ${wrappedResponse.status}`);
    }
    return await wrappedResponse.text();
  }
}

async function fetchDraw(drawNo) {
  return fetchJsonWithFallback(`${OFFICIAL_DRAW_ENDPOINT}&drwNo=${drawNo}`);
}

function renderDrawResult(data) {
  if (data.returnValue !== "success") {
    drawResult.textContent = "해당 회차 정보를 찾을 수 없습니다.";
    return;
  }

  const numbers = [
    data.drwtNo1,
    data.drwtNo2,
    data.drwtNo3,
    data.drwtNo4,
    data.drwtNo5,
    data.drwtNo6,
  ];

  drawResult.innerHTML = "";

  const top = document.createElement("div");
  top.innerHTML = `<strong>${data.drwNo}회</strong> (${data.drwNoDate})`;

  const ballsWrap = document.createElement("div");
  ballsWrap.className = "number-set";
  numbers.forEach((num) => ballsWrap.appendChild(createBall(num)));

  const bonusLabel = document.createElement("span");
  bonusLabel.textContent = "보너스";
  bonusLabel.style.marginLeft = "4px";
  ballsWrap.appendChild(bonusLabel);
  ballsWrap.appendChild(createBall(data.bnusNo));

  const firstPrize = document.createElement("p");
  firstPrize.style.margin = "10px 0 0";
  firstPrize.textContent = `1등 총 ${Number(data.firstPrzwnerCo).toLocaleString()}명, 1인당 ${Number(data.firstWinamnt).toLocaleString()}원`;

  drawResult.append(top, ballsWrap, firstPrize);
}

async function findLatestDraw() {
  let current = estimatedLatestDrawNo();
  for (let i = 0; i < 4; i += 1) {
    const data = await fetchDraw(current - i);
    if (data.returnValue === "success") {
      return data;
    }
  }
  throw new Error("최신 회차를 찾을 수 없습니다.");
}

function parseStoreRowsFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const rows = Array.from(doc.querySelectorAll("tbody tr"));
  const stores = [];

  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll("td")).map((td) =>
      td.textContent ? td.textContent.trim() : ""
    );

    if (cells.length >= 3) {
      const joined = cells.join(" ");
      if (joined.includes("자동") || joined.includes("수동") || joined.includes("반자동")) {
        stores.push({
          rank: cells[0] || "-",
          name: cells[1] || "-",
          method: cells[2] || "-",
          address: cells.slice(3).join(" ") || "-",
        });
      }
    }
  });

  return stores;
}

function renderStoreResult(drawNo, stores) {
  if (!stores.length) {
    storeResult.textContent = `${drawNo}회 1등 판매점 정보를 찾지 못했습니다.`;
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
  if (!drawNo || drawNo < 1) {
    drawResult.textContent = "1 이상의 회차 번호를 입력하세요.";
    return;
  }

  drawResult.textContent = "조회 중...";
  try {
    const data = await fetchDraw(drawNo);
    renderDrawResult(data);
  } catch (error) {
    drawResult.textContent = `조회 실패: ${error.message}`;
  }
}

async function handleLoadLatest() {
  drawResult.textContent = "최신 회차 확인 중...";
  try {
    const latest = await findLatestDraw();
    drawInput.value = latest.drwNo;
    storeInput.value = latest.drwNo;
    renderDrawResult(latest);
  } catch (error) {
    drawResult.textContent = `최신 회차 조회 실패: ${error.message}`;
  }
}

async function handleStoreSearch() {
  const drawNo = Number(storeInput.value);
  if (!drawNo || drawNo < 1) {
    storeResult.textContent = "1 이상의 회차 번호를 입력하세요.";
    return;
  }

  storeResult.textContent = "판매점 조회 중...";

  try {
    const url = `${OFFICIAL_STORE_ENDPOINT}&drwNo=${drawNo}`;
    const html = await fetchTextWithFallback(url);
    const stores = parseStoreRowsFromHtml(html);
    renderStoreResult(drawNo, stores);
  } catch (error) {
    storeResult.textContent = `조회 실패: ${error.message}`;
  }
}

generateBtn.addEventListener("click", renderGeneratedSets);
checkDrawBtn.addEventListener("click", handleCheckDraw);
loadLatestBtn.addEventListener("click", handleLoadLatest);
storeSearchBtn.addEventListener("click", handleStoreSearch);

renderGeneratedSets();
handleLoadLatest();
