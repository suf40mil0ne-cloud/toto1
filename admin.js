// =====================================================================
// 로또리듬 관리자 페이지 스크립트
// =====================================================================

let _db = null;

// ─── 초기화 ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const configError = document.getElementById('config-error');

  if (typeof FIREBASE_CONFIG === 'undefined' || FIREBASE_CONFIG.apiKey.startsWith('FILL_IN')) {
    configError.textContent = 'firebase-config.js 파일에 Firebase 설정이 완료되지 않았습니다.';
    configError.classList.remove('hidden');
    document.getElementById('google-signin-btn').disabled = true;
    return;
  }

  if (ADMIN_EMAIL.startsWith('FILL_IN')) {
    configError.textContent = 'firebase-config.js에서 ADMIN_EMAIL을 설정해주세요.';
    configError.classList.remove('hidden');
    document.getElementById('google-signin-btn').disabled = true;
    return;
  }

  // Firebase 초기화 (index.html에서 이미 초기화됐을 수 있으므로 체크)
  try {
    firebase.app();
  } catch (_) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  _db = firebase.firestore();
  const auth = firebase.auth();

  // 인증 상태 감지
  auth.onAuthStateChanged(user => {
    if (user) {
      if (user.email === ADMIN_EMAIL) {
        showDashboard(user);
      } else {
        auth.signOut();
        showLoginError('접근 권한이 없습니다. 관리자 계정으로 로그인해주세요.');
      }
    } else {
      showLogin();
    }
  });

  // Google 로그인 버튼
  document.getElementById('google-signin-btn').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => showLoginError(e.message));
  });

  // 로그아웃 버튼
  document.getElementById('signout-btn').addEventListener('click', () => auth.signOut());
});

// ─── UI 전환 ─────────────────────────────────────────────────────────

function showLogin() {
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById('dashboard-section').classList.add('hidden');
  document.getElementById('user-info').classList.add('hidden');
}

function showDashboard(user) {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('dashboard-section').classList.remove('hidden');
  document.getElementById('user-info').classList.remove('hidden');
  document.getElementById('user-info').classList.add('flex');
  document.getElementById('user-email').textContent = user.email;
  loadData();
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── 데이터 로드 ──────────────────────────────────────────────────────

async function loadData() {
  const loadingEl = document.getElementById('loading');
  try {
    // 생성된 번호 불러오기 (복합 인덱스 불필요하도록 단일 정렬 후 클라이언트 정렬)
    const genSnap = await _db.collection('generatedNumbers')
      .orderBy('createdAt', 'desc')
      .get();

    // 당첨번호 불러오기
    const winSnap = await _db.collection('winningNumbers').get();
    const winningMap = {};
    winSnap.forEach(doc => { winningMap[doc.id] = doc.data(); });

    // 회차별 그룹핑
    const grouped = {};
    genSnap.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      const key = String(data.targetDrawNo || '미지정');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(data);
    });

    renderStats(grouped, winningMap);
    renderDraws(grouped, winningMap);
  } catch (e) {
    console.error('[Admin] 데이터 로딩 실패:', e);
    loadingEl.innerHTML = `
      <div class="text-center py-8">
        <p class="text-red-500 font-semibold mb-2">데이터 로딩 실패</p>
        <p class="text-sm text-gray-500 mb-4">${e.message}</p>
        ${e.message.includes('index') ? `<p class="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">Firestore 복합 인덱스가 필요합니다.<br>콘솔 로그의 링크를 클릭해 인덱스를 생성해주세요.</p>` : ''}
        ${e.message.includes('permission') || e.message.includes('PERMISSION') ? `<p class="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">Firestore 보안 규칙을 설정해주세요.</p>` : ''}
      </div>`;
  }
}

// ─── 통계 렌더 ────────────────────────────────────────────────────────

function renderStats(grouped, winningMap) {
  const drawNos = Object.keys(grouped);
  const totalSessions = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);
  const totalSets = Object.values(grouped).reduce((s, arr) =>
    s + arr.reduce((ss, e) => ss + (e.numbers?.length || 0), 0), 0);

  let rankedSets = 0;
  drawNos.forEach(drawNo => {
    const winning = winningMap[drawNo];
    if (!winning) return;
    grouped[drawNo].forEach(entry => {
      (entry.numbers || []).forEach(nums => {
        const prize = calcPrize(nums, winning.numbers, winning.bonusNo);
        if (prize.rank >= 1 && prize.rank <= 5) rankedSets++;
      });
    });
  });

  document.getElementById('stat-draws').textContent = drawNos.length;
  document.getElementById('stat-sessions').textContent = totalSessions;
  document.getElementById('stat-sets').textContent = totalSets;
  document.getElementById('stat-ranked').textContent = rankedSets;
}

// ─── 회차 목록 렌더 ───────────────────────────────────────────────────

function renderDraws(grouped, winningMap) {
  document.getElementById('loading').classList.add('hidden');
  const container = document.getElementById('draws-container');
  container.innerHTML = '';

  const drawNos = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

  if (drawNos.length === 0) {
    container.innerHTML = '<div class="text-center py-16 text-gray-400">저장된 번호가 없습니다.<br><span class="text-sm">메인 페이지에서 번호를 생성하면 자동으로 저장됩니다.</span></div>';
    return;
  }

  drawNos.forEach(drawNo => {
    const entries = grouped[drawNo];
    const winning = winningMap[drawNo] || null;
    const totalSets = entries.reduce((s, e) => s + (e.numbers?.length || 0), 0);

    const card = document.createElement('div');
    card.className = 'mb-6 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden';
    card.id = `draw-card-${drawNo}`;

    card.innerHTML = `
      <!-- 회차 헤더 -->
      <div class="px-6 py-4 bg-gray-50 border-b border-gray-100">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span class="text-lg font-bold text-gray-900">${drawNo}회</span>
            <span class="ml-2 text-sm text-gray-400">${entries.length}세션 · ${totalSets}세트</span>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button onclick="fetchWinning('${drawNo}')" id="fetch-btn-${drawNo}"
              class="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all">
              당첨번호 자동 조회
            </button>
            <button onclick="toggleInput('${drawNo}')"
              class="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300 active:scale-95 transition-all">
              직접 입력
            </button>
          </div>
        </div>

        <!-- 당첨번호 표시 영역 -->
        <div id="winning-display-${drawNo}" class="mt-3">
          ${winning ? winningHTML(winning) : '<p class="text-sm text-gray-400">당첨번호가 없습니다. 자동 조회 또는 직접 입력하세요.</p>'}
        </div>

        <!-- 직접 입력 폼 -->
        <div id="winning-form-${drawNo}" class="hidden mt-3">
          <div class="flex flex-wrap gap-2 items-center">
            ${[1,2,3,4,5,6].map(i =>
              `<input type="number" id="wn-${drawNo}-${i}" min="1" max="45" placeholder="${i}"
                class="w-14 border border-gray-300 rounded-lg px-1 py-1.5 text-center text-sm focus:ring-2 focus:ring-primary/30 outline-none font-bold"/>`
            ).join('')}
            <span class="text-gray-400 font-bold text-sm">+보너스</span>
            <input type="number" id="wn-${drawNo}-b" min="1" max="45" placeholder="B"
              class="w-14 border border-gray-300 rounded-lg px-1 py-1.5 text-center text-sm focus:ring-2 focus:ring-primary/30 outline-none font-bold"/>
            <button onclick="saveWinning('${drawNo}')"
              class="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all">저장</button>
          </div>
        </div>
      </div>

      <!-- 세션별 번호 목록 -->
      <div id="entries-${drawNo}">
        ${entries.map(entry => entryHTML(entry, winning)).join('')}
      </div>
    `;

    container.appendChild(card);
  });
}

// ─── 세션 HTML ────────────────────────────────────────────────────────

function entryHTML(entry, winning) {
  const ts = entry.createdAt?.toDate
    ? entry.createdAt.toDate().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '시간 정보 없음';
  const shortId = (entry.sessionId || 'unknown').slice(0, 8);

  const setsHTML = (entry.numbers || []).map((nums, idx) => {
    const ballsHTML = nums.map(n => `<span class="ball" style="background:${ballColor(n)}">${n}</span>`).join('');

    let prizeBadge = '';
    if (winning) {
      const prize = calcPrize(nums, winning.numbers, winning.bonusNo);
      const matchCount = nums.filter(n => winning.numbers.includes(n)).length;
      prizeBadge = `<span class="badge-rank ml-2" style="background:${prize.bg};color:${prize.fg}">${prize.emoji}${prize.label} (${matchCount}개 일치)</span>`;
    }

    return `
      <div class="flex items-center flex-wrap gap-1 py-2 border-b border-gray-50 last:border-0">
        <span class="text-xs font-bold text-primary w-12 shrink-0 tabular-nums">SET ${idx + 1}</span>
        <div class="flex flex-wrap items-center">${ballsHTML}${prizeBadge}</div>
      </div>`;
  }).join('');

  return `
    <div class="px-6 py-4 border-b border-gray-50 last:border-0">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">${shortId}</span>
        <span class="text-xs text-gray-400">${ts}</span>
      </div>
      <div>${setsHTML}</div>
    </div>`;
}

// ─── 당첨번호 HTML ────────────────────────────────────────────────────

function winningHTML(winning) {
  const ballsHTML = (winning.numbers || []).map(n =>
    `<span class="ball" style="background:${ballColor(n)}">${n}</span>`).join('');
  const bonusHTML = `<span class="ball" style="background:${ballColor(winning.bonusNo)};outline:2px solid #006c49;outline-offset:1px">${winning.bonusNo}</span>`;
  const dateLabel = winning.date ? `<span class="text-xs text-gray-400 ml-2">${winning.date}</span>` : '';

  return `
    <div class="flex items-center flex-wrap gap-1">
      <span class="text-xs font-semibold text-gray-500 mr-1">당첨번호</span>
      ${ballsHTML}
      <span class="text-gray-400 font-bold text-sm mx-1">+</span>
      ${bonusHTML}
      ${dateLabel}
    </div>`;
}

// ─── 버튼 핸들러 (전역) ───────────────────────────────────────────────

window.toggleInput = function (drawNo) {
  document.getElementById(`winning-form-${drawNo}`).classList.toggle('hidden');
};

window.fetchWinning = async function (drawNo) {
  const btn = document.getElementById(`fetch-btn-${drawNo}`);
  btn.textContent = '조회 중...';
  btn.disabled = true;
  try {
    const res = await fetch(`/api/draw?drawNo=${drawNo}`);
    const body = await res.json();
    if (!body.ok) throw new Error(body.error || '조회 실패');
    const d = body.data;
    const winning = {
      numbers: [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6],
      bonusNo: d.bnusNo,
      date: d.drwNoDate || ''
    };
    await _db.collection('winningNumbers').doc(String(drawNo)).set(winning);
    document.getElementById(`winning-display-${drawNo}`).innerHTML = winningHTML(winning);
    refreshEntries(drawNo, winning);
  } catch (e) {
    alert('당첨번호 조회 실패: ' + e.message);
  } finally {
    btn.textContent = '당첨번호 자동 조회';
    btn.disabled = false;
  }
};

window.saveWinning = async function (drawNo) {
  const nums = [1,2,3,4,5,6].map(i => Number(document.getElementById(`wn-${drawNo}-${i}`).value));
  const bonus = Number(document.getElementById(`wn-${drawNo}-b`).value);

  if (nums.some(n => !n || n < 1 || n > 45) || !bonus || bonus < 1 || bonus > 45) {
    alert('1~45 사이 번호 6개와 보너스 번호를 모두 입력해주세요.');
    return;
  }

  const winning = { numbers: nums, bonusNo: bonus, date: '' };
  try {
    await _db.collection('winningNumbers').doc(String(drawNo)).set(winning);
    document.getElementById(`winning-display-${drawNo}`).innerHTML = winningHTML(winning);
    document.getElementById(`winning-form-${drawNo}`).classList.add('hidden');
    refreshEntries(drawNo, winning);
  } catch (e) {
    alert('저장 실패: ' + e.message);
  }
};

// 당첨번호 저장 후 해당 회차 세션들 즉시 재렌더
async function refreshEntries(drawNo, winning) {
  const snap = await _db.collection('generatedNumbers')
    .where('targetDrawNo', '==', Number(drawNo))
    .get();

  const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const container = document.getElementById(`entries-${drawNo}`);
  if (container) {
    container.innerHTML = entries.map(e => entryHTML(e, winning)).join('');
  }
}

// ─── 유틸리티 ─────────────────────────────────────────────────────────

function ballColor(n) {
  if (n <= 10) return '#f59e0b';
  if (n <= 20) return '#3b82f6';
  if (n <= 30) return '#ef4444';
  if (n <= 40) return '#64748b';
  return '#10b981';
}

function calcPrize(generatedNums, winningNums, bonusNum) {
  const match = generatedNums.filter(n => winningNums.includes(n)).length;
  const hasBonus = generatedNums.includes(bonusNum);
  if (match === 6)                    return { rank: 1, label: '1등', emoji: '🏆 ', bg: '#dc2626', fg: 'white' };
  if (match === 5 && hasBonus)        return { rank: 2, label: '2등', emoji: '🥈 ', bg: '#f59e0b', fg: 'white' };
  if (match === 5)                    return { rank: 3, label: '3등', emoji: '🥉 ', bg: '#10b981', fg: 'white' };
  if (match === 4)                    return { rank: 4, label: '4등', emoji: '',    bg: '#3b82f6', fg: 'white' };
  if (match === 3)                    return { rank: 5, label: '5등', emoji: '',    bg: '#64748b', fg: 'white' };
  return { rank: 0, label: '낙첨', emoji: '', bg: '#e5e7eb', fg: '#9ca3af' };
}
