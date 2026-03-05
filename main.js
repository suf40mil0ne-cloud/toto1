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
    generatorMessage.textContent = "패턴 분석 완료! 이제 번호를 생성하세요.";
  } catch (error) { biorhythmResult.textContent = error.message; }
}

async function renderGeneratedSets() {
  if (!currentRhythm) { alert("먼저 STEP 01에서 리듬 분석을 진행해주세요."); return; }
  generatedList.innerHTML = "";
  generatorMessage.textContent = "서버 알고리즘 연산 중...";
  
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
    generatorMessage.textContent = "서버 사이드 리듬 최적화 조합 추출 완료 (HMD-V2)";
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
  drawResult.textContent = "조회 중...";
  try {
    const body = await requestJson(`${API_DRAW}?drawNo=${drawNo}`);
    const d = body.data;
    drawResult.innerHTML = `<strong>${d.drwNo}회 (${d.drwNoDate})</strong><br><div class="number-set" style="border:none; background:none; padding:10px 0; justify-content:center;"></div><p style="margin-top:10px; font-size:0.9rem;">1등 당첨금: ${Number(d.firstWinamnt).toLocaleString()}원 (${d.firstPrzwnerCo}명)</p>`;
    const target = drawResult.querySelector(".number-set");
    [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6].forEach(n => target.appendChild(createBall(n)));
    const bLabel = document.createElement("span"); bLabel.textContent = "+"; bLabel.style.margin = "0 5px"; target.appendChild(bLabel);
    target.appendChild(createBall(d.bnusNo));
  } catch (e) { drawResult.textContent = "조회 실패"; }
}

async function handleStoreSearch() {
  const drawNo = storeInput.value; if (!drawNo) return;
  storeResult.textContent = "조회 중...";
  try {
    const body = await requestJson(`${API_STORES}?drawNo=${drawNo}`);
    if (body.stores) {
      storeResult.innerHTML = `<strong>${drawNo}회 1등 배출점</strong><ul style="margin-top:10px; font-size:0.85rem; text-align:left; padding-left:20px;"></ul>`;
      body.stores.forEach(s => {
        const li = document.createElement("li"); li.textContent = `[${s.method}] ${s.name} (${s.address})`;
        storeResult.querySelector("ul").appendChild(li);
      });
    }
  } catch (e) { storeResult.textContent = "조회 실패"; }
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
    latestNetAmount.textContent = "연결 지연";
    latestJackpotMeta.textContent = "새로고침을 눌러주세요.";
  }
}

calcBioBtn.addEventListener("click", handleCalculateBiorhythm);
generateBtn.addEventListener("click", renderGeneratedSets);
resetOptionsBtn.addEventListener("click", () => {
  currentRhythm = null; generatedList.innerHTML = "";
  biorhythmResult.innerHTML = "생년월일을 입력하면 리듬 분석 그래프가 나타납니다.";
});
loadLatestBtn.addEventListener("click", async () => { await initLatestData(); handleCheckDraw(); });
checkDrawBtn.addEventListener("click", handleCheckDraw);
storeSearchBtn.addEventListener("click", handleStoreSearch);

initLatestData();
