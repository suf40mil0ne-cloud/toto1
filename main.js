const generatedList = document.querySelector("#generated-list");
const setCountSelect = document.querySelector("#set-count");
const generatorMessage = document.querySelector("#generator-message");

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

// 페이지 새로고침 시 맨 위로 이동
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

let currentBioScore = null;
let currentBioProfile = null;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

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
  return {
    days,
    physical: Math.round((cycleValue(23) + 1) * 50),
    emotional: Math.round((cycleValue(28) + 1) * 50),
    intellectual: Math.round((cycleValue(33) + 1) * 50),
    overall: Math.round(Math.round((cycleValue(23) + 1) * 50) * 0.4 + Math.round((cycleValue(28) + 1) * 50) * 0.35 + Math.round((cycleValue(33) + 1) * 50) * 0.25)
  };
}

function normalizeBirthDateInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 8) throw new Error("생년월일 8자리를 입력하세요.");
  const year = Number(digits.slice(0, 4)), month = Number(digits.slice(4, 6)), day = Number(digits.slice(6, 8));
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) throw new Error("유효한 날짜가 아닙니다.");
  return { year, month, day, compact: digits };
}

function buildBioProfile(birthDate, rhythm, strength = "medium") {
  const factor = strength === "weak" ? 0.3 : strength === "strong" ? 4.0 : 1.0;
  const adjust = (val) => 1 + (val - 1) * factor;
  const profile = {
    lowWeight: adjust(0.7 + rhythm.physical / 100),
    midWeight: adjust(0.7 + rhythm.emotional / 100),
    highWeight: adjust(0.7 + rhythm.intellectual / 100),
    oddWeight: adjust(rhythm.overall >= 50 ? 1.2 : 0.8),
    evenWeight: adjust(rhythm.overall < 50 ? 1.2 : 0.8),
    luckyNumbers: [],
    luckyWeight: adjust(1.6)
  };
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  const getWeight = (n) => {
    let w = n <= 15 ? profile.lowWeight : n <= 30 ? profile.midWeight : profile.highWeight;
    w *= (n % 2 === 0 ? profile.evenWeight : profile.oddWeight);
    return w;
  };
  profile.luckyNumbers = pickWeightedUnique(pool, 6, getWeight).sort((a, b) => a - b);
  return profile;
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
    const strength = document.querySelector('input[name="bio-strength"]:checked').value;
    currentBioProfile = buildBioProfile(birthDate, result, strength);
    currentBioScore = result.overall;
    biorhythmResult.innerHTML = `
      <div class="bio-grid">
        <div class="bio-item"><strong>신체</strong><span>${result.physical}%</span></div>
        <div class="bio-item"><strong>감성</strong><span>${result.emotional}%</span></div>
        <div class="bio-item"><strong>지성</strong><span>${result.intellectual}%</span></div>
        <div class="bio-item"><strong>행운지수</strong><span>${result.overall}%</span></div>
      </div>
      <div class="bio-chart-container">
        <canvas id="bio-canvas" width="800" height="300" style="width:100%; height:auto;"></canvas>
        <div class="bio-legend">
          <div class="legend-item"><span class="dot p" style="background:#f59e0b"></span> 신체</div>
          <div class="legend-item"><span class="dot e" style="background:#ef4444"></span> 감성</div>
          <div class="legend-item"><span class="dot i" style="background:#3b82f6"></span> 지성</div>
        </div>
      </div>
      <div class="bio-lucky-wrap" style="margin-top: 1.5rem; text-align: center;">
        <p style="font-weight: 800; margin-bottom: 1rem; color: var(--brand);">오늘의 추천 리듬 번호</p>
        <div id="bio-lucky-balls" style="display:flex; justify-content:center; gap:8px;"></div>
      </div>
    `;
    drawBiorhythmChart(document.querySelector("#bio-canvas"), result.days);
    currentBioProfile.luckyNumbers.forEach(n => document.querySelector("#bio-lucky-balls").appendChild(createBall(n)));
    generatorMessage.textContent = "리듬 분석 완료! 이제 아래에서 번호를 생성하세요.";
  } catch (error) { biorhythmResult.textContent = error.message; }
}

async function renderGeneratedSets() {
  if (!currentBioProfile) { alert("먼저 STEP 01에서 리듬 분석을 진행해주세요."); return; }
  generatedList.innerHTML = "";
  const setCount = Number(setCountSelect.value), pool = Array.from({ length: 45 }, (_, i) => i + 1);
  for (let i = 0; i < setCount; i += 1) {
    const numbers = pickWeightedUnique(pool, 6, (n) => {
      let w = n <= 15 ? currentBioProfile.lowWeight : n <= 30 ? currentBioProfile.midWeight : currentBioProfile.highWeight;
      w *= (n % 2 === 0 ? currentBioProfile.evenWeight : currentBioProfile.oddWeight);
      if (currentBioProfile.luckyNumbers.includes(n)) w *= currentBioProfile.luckyWeight;
      return w;
    }).sort((a, b) => a - b);
    const li = document.createElement("li"); li.className = "number-set";
    const label = document.createElement("span"); label.style.fontWeight = "800"; label.style.marginRight = "1rem"; label.textContent = `${i + 1}SET`;
    li.appendChild(label);
    numbers.forEach(n => li.appendChild(createBall(n)));
    const score = Math.round(currentBioScore * 0.4 + (Math.random() * 20 + 40) * 0.6);
    const badge = document.createElement("span"); badge.className = "badge"; badge.style.marginLeft = "auto"; badge.textContent = `적합도 ${score}%`;
    li.appendChild(badge);
    generatedList.appendChild(li);
  }
}

async function requestJson(url) { const res = await fetch(url); return res.json(); }

async function handleCheckDraw() {
  const drawNo = drawInput.value; if (!drawNo) return;
  drawResult.textContent = "조회 중...";
  const body = await requestJson(`${API_DRAW}?drawNo=${drawNo}`);
  if (body.ok) {
    const d = body.data;
    drawResult.innerHTML = `<strong>${d.drwNo}회 (${d.drwNoDate})</strong><br><div class="number-set" style="border:none; background:none; padding:10px 0;"></div><p style="margin-top:10px; font-size:0.9rem;">1등 당첨금: ${Number(d.firstWinamnt).toLocaleString()}원 (${d.firstPrzwnerCo}명)</p>`;
    [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6].forEach(n => drawResult.querySelector(".number-set").appendChild(createBall(n)));
    const bLabel = document.createElement("span"); bLabel.textContent = "+"; bLabel.style.margin = "0 5px"; drawResult.querySelector(".number-set").appendChild(bLabel);
    drawResult.querySelector(".number-set").appendChild(createBall(d.bnusNo));
  } else { drawResult.textContent = "조회 실패"; }
}

async function handleStoreSearch() {
  const drawNo = storeInput.value; if (!drawNo) return;
  storeResult.textContent = "조회 중...";
  const body = await requestJson(`${API_STORES}?drawNo=${drawNo}`);
  if (body.ok && body.stores) {
    storeResult.innerHTML = `<strong>${drawNo}회 1등 배출점</strong><ul style="margin-top:10px; font-size:0.85rem; text-align:left; padding-left:20px;"></ul>`;
    body.stores.forEach(s => {
      const li = document.createElement("li"); li.textContent = `[${s.method}] ${s.name} (${s.address})`;
      storeResult.querySelector("ul").appendChild(li);
    });
  } else { storeResult.textContent = "조회 실패"; }
}

async function initLatestData() {
  const body = await requestJson(`${API_DRAW}?drawNo=latest`);
  if (body.ok) {
    const d = body.data;
    const net = calculateTakeHomeAmount(d.firstWinamnt);
    latestNetAmount.textContent = `${net.toLocaleString()}원`;
    latestJackpotMeta.textContent = `${d.drwNo}회 (${d.drwNoDate}) · 세전 ${Number(d.firstWinamnt).toLocaleString()}원`;
    drawInput.value = d.drwNo;
    storeInput.value = d.drwNo;
  }
}

calcBioBtn.addEventListener("click", handleCalculateBiorhythm);
generateBtn.addEventListener("click", renderGeneratedSets);
resetOptionsBtn.addEventListener("click", () => {
  currentBioProfile = null; currentBioScore = null; generatedList.innerHTML = "";
  biorhythmResult.innerHTML = "생년월일을 입력하면 리듬 분석 그래프가 나타납니다.";
  generatorMessage.textContent = "초기화되었습니다.";
});
loadLatestBtn.addEventListener("click", async () => { await initLatestData(); handleCheckDraw(); });
checkDrawBtn.addEventListener("click", handleCheckDraw);
storeSearchBtn.addEventListener("click", handleStoreSearch);
document.querySelectorAll('input[name="bio-strength"]').forEach(r => {
  r.addEventListener("change", () => { if (birthDateInput.value.length >= 8) handleCalculateBiorhythm(); });
});

initLatestData();
