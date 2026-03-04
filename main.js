const generatedList = document.querySelector("#generated-list");
const setCountSelect = document.querySelector("#set-count");
const modeSelect = document.querySelector("#generator-mode");
const modeHelp = document.querySelector("#mode-help");
const generatorMessage = document.querySelector("#generator-message");

const drawInput = document.querySelector("#draw-no");
const checkDrawBtn = document.querySelector("#check-draw-btn");
const loadLatestBtn = document.querySelector("#load-latest-btn");
const drawResult = document.querySelector("#draw-result");

const birthDateInput = document.querySelector("#birth-date-simple");
const calcBioBtn = document.querySelector("#calc-bio-btn");
const biorhythmResult = document.querySelector("#biorhythm-result");

const API_DRAW = "/api/draw";

// 페이지 새로고침 시 맨 위로 이동
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

const pickedNumbers = new Set();
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
    let selectedIndex = -1;

    let threshold = Math.random() * total;
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
  if (number <= 10) return "#f59e0b"; // Yellow
  if (number <= 20) return "#3b82f6"; // Blue
  if (number <= 30) return "#ef4444"; // Red
  if (number <= 40) return "#64748b"; // Gray
  return "#10b981"; // Green
}

function createBall(number) {
  const span = document.createElement("span");
  span.className = "ball";
  span.style.background = ballColor(number);
  span.textContent = String(number);
  return span;
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
  
  const physical = Math.round((cycleValue(23) + 1) * 50);
  const emotional = Math.round((cycleValue(28) + 1) * 50);
  const intellectual = Math.round((cycleValue(33) + 1) * 50);
  const overall = Math.round(physical * 0.4 + emotional * 0.35 + intellectual * 0.25);

  return { days, physical, emotional, intellectual, overall };
}

function normalizeBirthDateInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 8) throw new Error("생년월일 8자리를 입력하세요.");
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) {
    throw new Error("유효한 날짜가 아닙니다.");
  }
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
    luckyWeight: adjust(1.6),
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
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const paddingX = 40;
  const paddingY = 40;
  const chartW = w - paddingX * 2;
  const chartH = h - paddingY * 2;
  const centerY = h / 2;

  ctx.clearRect(0, 0, w, h);

  // 가로 가이드 라인
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(p => {
    const y = paddingY + chartH * p;
    ctx.beginPath(); ctx.moveTo(paddingX, y); ctx.lineTo(w - paddingX, y); ctx.stroke();
  });

  // 오늘 날짜 배경 강조
  ctx.fillStyle = "rgba(79, 70, 229, 0.05)";
  ctx.fillRect(w / 2 - 20, paddingY, 40, chartH);

  // 오늘 선
  ctx.strokeStyle = "#4f46e5";
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(w / 2, paddingY); ctx.lineTo(w / 2, h - paddingY); ctx.stroke();
  ctx.setLineDash([]);

  const drawWave = (period, color, label) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color + "66";
    
    ctx.beginPath();
    for (let x = 0; x <= chartW; x += 2) {
      const offset = ((x / chartW) - 0.5) * 28; // 28일 범위
      const val = Math.sin((2 * Math.PI * (days + offset)) / period);
      const y = centerY - val * (chartH / 2.2);
      if (x === 0) ctx.moveTo(paddingX + x, y);
      else ctx.lineTo(paddingX + x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 끝점 라벨 생략 (범례 사용)
  };

  drawWave(23, "#f59e0b", "물리");
  drawWave(28, "#ef4444", "감성");
  drawWave(33, "#3b82f6", "지성");
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
          <div class="legend-item"><span class="dot p" style="background:#f59e0b"></span> 신체(1~15)</div>
          <div class="legend-item"><span class="dot e" style="background:#ef4444"></span> 감성(16~30)</div>
          <div class="legend-item"><span class="dot i" style="background:#3b82f6"></span> 지성(31~45)</div>
        </div>
      </div>
      <div class="bio-lucky-wrap" style="margin-top: 1.5rem; text-align: center;">
        <p style="font-weight: 800; margin-bottom: 1rem; color: var(--brand);">오늘의 추천 리듬 번호</p>
        <div id="bio-lucky-balls" style="display:flex; justify-content:center; gap:8px;"></div>
      </div>
    `;

    drawBiorhythmChart(document.querySelector("#bio-canvas"), result.days);
    const ballContainer = document.querySelector("#bio-lucky-balls");
    currentBioProfile.luckyNumbers.forEach(n => ballContainer.appendChild(createBall(n)));
    
    generatorMessage.textContent = "리듬 분석이 생성기에 반영되었습니다. 번호를 생성해 보세요!";
  } catch (error) {
    biorhythmResult.textContent = error.message;
  }
}

async function renderGeneratedSets() {
  generatedList.innerHTML = "";
  const setCount = Number(setCountSelect.value);
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);

  for (let i = 0; i < setCount; i += 1) {
    let numbers;
    if (currentBioProfile) {
      // 리듬 기반 가중치 추출
      numbers = pickWeightedUnique(pool, 6, (n) => {
        let w = n <= 15 ? currentBioProfile.lowWeight : n <= 30 ? currentBioProfile.midWeight : currentBioProfile.highWeight;
        w *= (n % 2 === 0 ? currentBioProfile.evenWeight : currentBioProfile.oddWeight);
        // 연동 추천 번호에 추가 보너스
        if (currentBioProfile.luckyNumbers.includes(n)) w *= currentBioProfile.luckyWeight;
        return w;
      }).sort((a, b) => a - b);
    } else {
      numbers = shuffle([...pool]).slice(0, 6).sort((a, b) => a - b);
    }

    const li = document.createElement("li");
    li.className = "number-set";
    const label = document.createElement("span");
    label.style.fontWeight = "800";
    label.style.marginRight = "1rem";
    label.textContent = `${i + 1}SET`;
    li.appendChild(label);
    numbers.forEach(n => li.appendChild(createBall(n)));
    
    if (currentBioScore) {
      const score = Math.round(currentBioScore * 0.4 + (Math.random() * 20 + 40) * 0.6);
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.style.marginLeft = "auto";
      badge.textContent = `적합도 ${score}%`;
      li.appendChild(badge);
    }
    generatedList.appendChild(li);
  }
}

async function requestJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function handleCheckDraw() {
  const drawNo = drawInput.value;
  if (!drawNo) return;
  drawResult.textContent = "조회 중...";
  const body = await requestJson(`${API_DRAW}?drawNo=${drawNo}`);
  if (body.ok) {
    const data = body.data;
    drawResult.innerHTML = `<strong>${data.drwNo}회</strong>: ${data.drwtNo1}, ${data.drwtNo2}, ${data.drwtNo3}, ${data.drwtNo4}, ${data.drwtNo5}, ${data.drwtNo6} + ${data.bnusNo}`;
  } else {
    drawResult.textContent = "조회 실패";
  }
}

async function handleLoadLatest() {
  const body = await requestJson(`${API_DRAW}?drawNo=latest`);
  if (body.ok) {
    drawInput.value = body.data.drwNo;
    handleCheckDraw();
  }
}

calcBioBtn.addEventListener("click", handleCalculateBiorhythm);
generateBtn.addEventListener("click", renderGeneratedSets);
resetOptionsBtn.addEventListener("click", () => {
  currentBioProfile = null;
  currentBioScore = null;
  generatedList.innerHTML = "";
  biorhythmResult.innerHTML = "생년월일을 입력하면 리듬 분석 그래프가 나타납니다.";
  generatorMessage.textContent = "초기화되었습니다.";
});
loadLatestBtn.addEventListener("click", handleLoadLatest);
checkDrawBtn.addEventListener("click", handleCheckDraw);

document.querySelectorAll('input[name="bio-strength"]').forEach(r => {
  r.addEventListener("change", () => { if (birthDateInput.value.length >= 8) handleCalculateBiorhythm(); });
});
