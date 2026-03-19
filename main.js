const generatedList = document.querySelector("#generated-list");
const setCountSelect = document.querySelector("#set-count");
const generatorMessage = document.querySelector("#generator-message");
const generateBtn = document.querySelector("#generate-btn");
const resetOptionsBtn = document.querySelector("#reset-options-btn");

const drawInput = document.querySelector("#draw-no");
const checkDrawBtn = document.querySelector("#check-draw-btn");
const loadLatestBtn = document.querySelector("#load-latest-btn");
const drawResult = document.querySelector("#draw-result");

const storeInput = document.querySelector("#store-draw-no");
const storeSearchBtn = document.querySelector("#store-search-btn");
const storeResult = document.querySelector("#store-result");

const latestNetAmount = document.querySelector("#latest-net-amount");
const latestJackpotMeta = document.querySelector("#latest-jackpot-meta");

const birthDateInput = document.querySelector("#birth-date-simple");
const calcBioBtn = document.querySelector("#calc-bio-btn");
const biorhythmResult = document.querySelector("#biorhythm-result");

const API_DRAW = "/api/draw";
const API_STORES = "/api/stores";
const API_GENERATE = "/api/generate";

// 페이지 새로고침 시 맨 위로 이동
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

// 전역 리듬 상태
let currentRhythm = null;
let historicalDraws = [];
let isSyncing = false;

const DEFAULT_BIORHYTHM_HTML = `
  <p class="result-title">분석 전 안내</p>
  <p>생년월일을 입력하면 오늘의 바이오리듬 그래프와 종합 리듬 수치가 여기에 표시됩니다. 분석 결과는 개인화된 해석용 정보이며, 이어지는 번호 생성 단계에서 참고용으로만 반영됩니다.</p>
`;

const DEFAULT_DRAW_HTML = `
  <p class="result-title">조회 전 안내</p>
  <p>회차를 입력하면 결과가 여기에 표시됩니다. 당첨번호와 보너스번호는 번호색으로 구분되어 보이고, 1등 당첨금과 당첨자 수까지 함께 확인할 수 있습니다.</p>
`;

const DEFAULT_STORE_HTML = `
  <p class="result-title">조회 전 안내</p>
  <p>조회 결과에는 해당 회차에서 1등이 나온 판매점 목록이 표시됩니다. 자동, 수동, 반자동 여부와 상호명, 주소가 정리되어 나타납니다.</p>
`;

function ballColor(number) {
  if (number <= 10) return "#f59e0b";
  if (number <= 20) return "#3b82f6";
  if (number <= 30) return "#ef4444";
  if (number <= 40) return "#64748b";
  return "#10b981";
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
  if (days < 0) throw new Error("미래 날짜는 입력할 수 없습니다.");
  const cycleValue = (period, offset = 0) => Math.sin((2 * Math.PI * (days + offset)) / period);
  const p = Math.round((cycleValue(23) + 1) * 50);
  const e = Math.round((cycleValue(28) + 1) * 50);
  const i = Math.round((cycleValue(33) + 1) * 50);
  return { days, physical: p, emotional: e, intellectual: i, overall: Math.round(p * 0.4 + e * 0.35 + i * 0.25) };
}

function normalizeBirthDateInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 8) throw new Error("생년월일 8자리를 입력하세요.");
  const year = Number(digits.slice(0, 4)), month = Number(digits.slice(4, 6)), day = Number(digits.slice(6, 8));
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) throw new Error("유효한 날짜가 아닙니다.");
  return { year, month, day, compact: digits };
}

function drawBiorhythmChart(canvas, days) {
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const paddingX = 40, paddingY = 40, chartW = w - paddingX * 2, chartH = h - paddingY * 2, centerY = h / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#f1f5f9";
  [0.25, 0.5, 0.75].forEach(p => {
    const y = paddingY + chartH * p;
    ctx.beginPath(); ctx.moveTo(paddingX, y); ctx.lineTo(w - paddingX, y); ctx.stroke();
  });
  ctx.fillStyle = "rgba(79, 70, 229, 0.05)";
  ctx.fillRect(w / 2 - 20, paddingY, 40, chartH);
  ctx.strokeStyle = "#4f46e5"; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(w / 2, paddingY); ctx.lineTo(w / 2, h - paddingY); ctx.stroke();
  ctx.setLineDash([]);
  const drawWave = (period, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.shadowBlur = 8; ctx.shadowColor = color + "66";
    ctx.beginPath();
    for (let x = 0; x <= chartW; x += 2) {
      const offset = ((x / chartW) - 0.5) * 28;
      const val = Math.sin((2 * Math.PI * (days + offset)) / period);
      const y = centerY - val * (chartH / 2.2);
      if (x === 0) ctx.moveTo(paddingX + x, y); else ctx.lineTo(paddingX + x, y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
  };
  drawWave(23, "#f59e0b"); drawWave(28, "#ef4444"); drawWave(33, "#3b82f6");
}

function handleCalculateBiorhythm() {
  try {
    const birthDate = normalizeBirthDateInput(birthDateInput.value);
    const result = calculateBiorhythm(birthDate);
    currentRhythm = result;
    
    biorhythmResult.innerHTML = `
      <div class="bio-chart-container">
        <p style="text-align:center; font-weight:800; margin-bottom:15px; color:var(--brand);">오늘의 리듬 하모니 (종합 ${result.overall}%)</p>
        <canvas id="bio-canvas" width="800" height="300" style="width:100%; height:auto;"></canvas>
        <div class="bio-legend" style="display:flex; justify-content:center; gap:15px; margin-top:15px; font-size:0.85rem; font-weight:700;">
          <div style="display:flex; align-items:center; gap:5px;"><span style="width:12px; height:12px; border-radius:50%; background:#f59e0b; display:inline-block;"></span> 신체 리듬</div>
          <div style="display:flex; align-items:center; gap:5px;"><span style="width:12px; height:12px; border-radius:50%; background:#ef4444; display:inline-block;"></span> 감성 리듬</div>
          <div style="display:flex; align-items:center; gap:5px;"><span style="width:12px; height:12px; border-radius:50%; background:#3b82f6; display:inline-block;"></span> 지성 리듬</div>
        </div>
      </div>
    `;
    drawBiorhythmChart(document.querySelector("#bio-canvas"), result.days);
    generatorMessage.textContent = "리듬 분석이 완료되었습니다. 참고용 번호 조합을 생성해 보세요.";
  } catch (error) {
    biorhythmResult.innerHTML = `<p class="result-title">입력 확인</p><p>${error.message}</p>`;
  }
}

async function renderGeneratedSets() {
  if (!currentRhythm) { alert("먼저 STEP 01에서 리듬 분석을 진행해주세요."); return; }
  generatedList.innerHTML = "";
  generatorMessage.textContent = "번호 조합을 생성하는 중입니다.";
  
  const strength = document.querySelector('input[name="bio-strength"]:checked').value;
  const setCount = Number(setCountSelect.value);

  try {
    const res = await fetch(API_GENERATE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rhythm: currentRhythm, strength, setCount })
    });
    const body = await res.json();
    if (!body.ok) throw new Error(body.error);

    body.data.forEach((item, i) => {
      const rankText = Number.isFinite(item.rankPercentile) ? ` (시뮬레이션 상위 ${item.rankPercentile}%)` : "";
      
      const li = document.createElement("li"); li.className = "number-set";
      const label = document.createElement("span"); label.style.fontWeight = "800"; label.style.marginRight = "1rem"; label.textContent = `${i + 1}SET`;
      li.appendChild(label);
      item.numbers.forEach(n => li.appendChild(createBall(n)));
      const badge = document.createElement("span"); badge.className = "badge"; badge.style.marginLeft = "auto"; badge.style.background = "var(--brand-2)";
      badge.textContent = `리듬 점수 ${item.score}점${rankText}`;
      li.appendChild(badge);
      generatedList.appendChild(li);
    });
    generatorMessage.textContent = "리듬 결과를 반영한 참고용 번호 조합을 불러왔습니다.";
  } catch (e) { generatorMessage.textContent = "생성 오류: " + e.message; }
}

async function requestJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error || "데이터 요청 실패");
  return body;
}

async function handleCheckDraw() {
  const drawNo = drawInput.value; if (!drawNo) return;
  drawResult.innerHTML = `<p class="result-title">조회 중</p><p>선택한 회차의 당첨번호와 당첨금 정보를 불러오고 있습니다.</p>`;
  try {
    const body = await requestJson(`${API_DRAW}?drawNo=${drawNo}`);
    const d = body.data;
    drawResult.innerHTML = `<strong>${d.drwNo}회 (${d.drwNoDate})</strong><br><div class="number-set" style="border:none; background:none; padding:10px 0; justify-content:center;"></div><p style="margin-top:10px; font-size:0.9rem;">1등 당첨금: ${Number(d.firstWinamnt).toLocaleString()}원 (${d.firstPrzwnerCo}명)</p>`;
    const target = drawResult.querySelector(".number-set");
    [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6].forEach(n => target.appendChild(createBall(n)));
    const bLabel = document.createElement("span"); bLabel.textContent = "+"; bLabel.style.margin = "0 5px"; target.appendChild(bLabel);
    target.appendChild(createBall(d.bnusNo));
  } catch (e) {
    drawResult.innerHTML = `<p class="result-title">조회 실패</p><p>${e.message || "회차 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}</p><p>회차 번호를 다시 확인하거나 최신 회차 불러오기 버튼으로 다시 시도해 보세요.</p>`;
  }
}

async function handleStoreSearch() {
  const drawNo = storeInput.value; if (!drawNo) return;
  storeResult.innerHTML = `<p class="result-title">조회 중</p><p>선택한 회차의 1등 판매점 목록을 불러오고 있습니다.</p>`;
  try {
    const body = await requestJson(`${API_STORES}?drawNo=${drawNo}`);
    if (body.stores) {
      storeResult.innerHTML = `<strong>${drawNo}회 1등 배출점</strong><ul style="margin-top:10px; font-size:0.85rem; text-align:left; padding-left:20px;"></ul>`;
      body.stores.forEach(s => {
        const li = document.createElement("li"); li.textContent = `[${s.method}] ${s.name} (${s.address})`;
        storeResult.querySelector("ul").appendChild(li);
      });
    }
  } catch (e) {
    storeResult.innerHTML = `<p class="result-title">조회 실패</p><p>${e.message || "판매점 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}</p><p>회차 번호를 다시 확인한 뒤 판매점 조회를 다시 실행해 보세요.</p>`;
  }
}

async function syncHistoricalData(latestNo) {
  if (isSyncing) return;
  isSyncing = true;
  const savedData = localStorage.getItem("lotto_history");
  let draws = savedData ? JSON.parse(savedData) : [];
  const startNo = draws.length > 0 ? draws[draws.length - 1].drwNo + 1 : 1;
  if (startNo > latestNo) {
    historicalDraws = draws;
    isSyncing = false;
    return;
  }
  for (let i = startNo; i <= latestNo; i++) {
    try {
      const body = await requestJson(`${API_DRAW}?drawNo=${i}`);
      if (body.ok) {
        const d = body.data;
        draws.push({ drwNo: d.drwNo, numbers: [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6] });
        if (i % 50 === 0) localStorage.setItem("lotto_history", JSON.stringify(draws));
      }
      if (i % 10 === 0) await new Promise(r => setTimeout(r, 100));
    } catch (e) { break; }
  }
  localStorage.setItem("lotto_history", JSON.stringify(draws));
  historicalDraws = draws;
  isSyncing = false;
}

async function initLatestData() {
  try {
    const body = await requestJson(`${API_DRAW}?drawNo=latest`);
    const d = body.data;
    const net = calculateTakeHomeAmount(d.firstWinamnt);
    latestNetAmount.textContent = `${net.toLocaleString()}원`;
    latestJackpotMeta.textContent = `${d.drwNo}회 (${d.drwNoDate}) · 세전 ${Number(d.firstWinamnt).toLocaleString()}원`;
    drawInput.value = d.drwNo;
    storeInput.value = d.drwNo;
    syncHistoricalData(d.drwNo);
  } catch (e) {
    latestNetAmount.textContent = "최신 회차 연결 지연";
    latestJackpotMeta.textContent = "잠시 후 다시 시도하면 최신 실수령액 정보를 불러올 수 있습니다.";
  }
}

calcBioBtn.addEventListener("click", handleCalculateBiorhythm);
generateBtn.addEventListener("click", renderGeneratedSets);
resetOptionsBtn.addEventListener("click", () => {
  currentRhythm = null; generatedList.innerHTML = "";
  generatorMessage.textContent = "먼저 위 단계에서 바이오리듬을 분석하면 해당 결과가 참고용 가중치로 연결됩니다.";
  biorhythmResult.innerHTML = DEFAULT_BIORHYTHM_HTML;
});
loadLatestBtn.addEventListener("click", async () => { await initLatestData(); handleCheckDraw(); });
checkDrawBtn.addEventListener("click", handleCheckDraw);
storeSearchBtn.addEventListener("click", handleStoreSearch);

initLatestData();
