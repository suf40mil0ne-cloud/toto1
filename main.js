const siteLogo = document.querySelector("#site-logo");
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
  <p class="text-zinc-500 text-center text-sm md:text-base break-keep">생년월일을 입력하면 분석 결과가 여기에 표시됩니다.</p>
`;

const DEFAULT_DRAW_HTML = `
  회차를 조회해 주세요.
`;

const DEFAULT_STORE_HTML = `
  조회 결과가 여기에 표시됩니다.
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
  ctx.strokeStyle = "#006c49"; ctx.setLineDash([4, 4]);
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
        <p style="text-align:center; font-weight:800; margin-bottom:15px; color:#006c49;">오늘의 리듬 하모니 (종합 ${result.overall}%)</p>
        <canvas id="bio-canvas" width="800" height="300" style="width:100%; height:auto;"></canvas>
        <div class="bio-legend" style="display:flex; justify-content:center; gap:15px; margin-top:15px; font-size:0.85rem; font-weight:700;">
          <div style="display:flex; align-items:center; gap:5px;"><span style="width:12px; height:12px; border-radius:50%; background:#f59e0b; display:inline-block;"></span> 신체</div>
          <div style="display:flex; align-items:center; gap:5px;"><span style="width:12px; height:12px; border-radius:50%; background:#ef4444; display:inline-block;"></span> 감성</div>
          <div style="display:flex; align-items:center; gap:5px;"><span style="width:12px; height:12px; border-radius:50%; background:#3b82f6; display:inline-block;"></span> 지성</div>
        </div>
      </div>
    `;
    drawBiorhythmChart(document.querySelector("#bio-canvas"), result.days);
    generatorMessage.textContent = "리듬 분석이 완료되었습니다. 참고용 번호 조합을 생성해 보세요.";
  } catch (error) {
    biorhythmResult.innerHTML = `<p class="text-red-500 text-center">${error.message}</p>`;
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
      const label = document.createElement("span"); label.textContent = `${i + 1}SET`;
      li.appendChild(label);
      item.numbers.forEach(n => li.appendChild(createBall(n)));
      const badge = document.createElement("span"); badge.className = "badge";
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
  drawResult.innerHTML = `조회 중...`;
  try {
    const body = await requestJson(`${API_DRAW}?drawNo=${drawNo}`);
    const d = body.data;
    drawResult.innerHTML = `<div class="font-bold mb-2">${d.drwNo}회 (${d.drwNoDate})</div><div class="number-set" style="border:none; background:none; padding:10px 0; justify-content:center;"></div><p class="mt-2 text-primary font-bold">1등 당첨금: ${Number(d.firstWinamnt).toLocaleString()}원 (${d.firstPrzwnerCo}명)</p>`;
    const target = drawResult.querySelector(".number-set");
    [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6].forEach(n => target.appendChild(createBall(n)));
    const bLabel = document.createElement("span"); bLabel.textContent = "+"; bLabel.style.margin = "0 5px"; bLabel.style.fontWeight = "800"; target.appendChild(bLabel);
    target.appendChild(createBall(d.bnusNo));
  } catch (e) {
    drawResult.innerHTML = `<p class="text-red-500">${e.message || "오류가 발생했습니다."}</p>`;
  }
}

async function handleStoreSearch() {
  const drawNo = storeInput.value; if (!drawNo) return;
  storeResult.innerHTML = `조회 중...`;
  try {
    const body = await requestJson(`${API_STORES}?drawNo=${drawNo}`);
    if (body.stores) {
      storeResult.innerHTML = `<div class="font-bold mb-4">${drawNo}회 1등 배출점</div><ul class="space-y-2 text-sm text-left"></ul>`;
      body.stores.forEach(s => {
        const li = document.createElement("li"); li.className = "p-3 bg-zinc-50 rounded-lg border border-zinc-100";
        li.textContent = `[${s.method}] ${s.name} (${s.address})`;
        storeResult.querySelector("ul").appendChild(li);
      });
    }
  } catch (e) {
    storeResult.innerHTML = `<p class="text-red-500">${e.message || "오류가 발생했습니다."}</p>`;
  }
}

async function initLatestData() {
  try {
    const body = await requestJson(`${API_DRAW}?drawNo=latest`);
    const d = body.data;
    const net = calculateTakeHomeAmount(d.firstWinamnt);
    latestNetAmount.textContent = `${net.toLocaleString()}원`;
    latestJackpotMeta.innerHTML = `<span>${d.drwNo}회</span><span class="opacity-30">|</span><span>${d.drwNoDate}</span><span class="opacity-30">|</span><span>세전 ${Number(d.firstWinamnt).toLocaleString()}원</span>`;
    drawInput.value = d.drwNo;
    storeInput.value = d.drwNo;
  } catch (e) {
    latestNetAmount.textContent = "연결 지연";
  }
}

function resetAll() {
  currentRhythm = null;
  birthDateInput.value = "";
  setCountSelect.value = "3";
  generatedList.innerHTML = "";
  generatorMessage.textContent = "준비 완료";
  biorhythmResult.innerHTML = DEFAULT_BIORHYTHM_HTML;
  drawResult.innerHTML = DEFAULT_DRAW_HTML;
  storeResult.innerHTML = DEFAULT_STORE_HTML;
  initLatestData();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

if (siteLogo) {
  siteLogo.addEventListener("click", (e) => {
    e.preventDefault();
    resetAll();
  });
}

calcBioBtn.addEventListener("click", handleCalculateBiorhythm);
generateBtn.addEventListener("click", renderGeneratedSets);
resetOptionsBtn.addEventListener("click", resetAll);
loadLatestBtn.addEventListener("click", async () => { await initLatestData(); handleCheckDraw(); });
checkDrawBtn.addEventListener("click", handleCheckDraw);
storeSearchBtn.addEventListener("click", handleStoreSearch);

initLatestData();
