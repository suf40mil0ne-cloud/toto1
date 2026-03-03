const OFFICIAL_DRAW_URL = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber";
const FIRST_DRAW_DATE = new Date("2002-12-07T20:45:00+09:00");

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

function estimateLatestDrawNo() {
  const now = new Date();
  const elapsed = now.getTime() - FIRST_DRAW_DATE.getTime();
  const weeks = Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, weeks + 1);
}

async function fetchDraw(drawNo) {
  const url = `${OFFICIAL_DRAW_URL}&drwNo=${drawNo}`;
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/json,text/plain,*/*",
      referer: "https://www.dhlottery.co.kr/",
    },
    cf: { cacheTtl: 60, cacheEverything: false },
  });

  if (!res.ok) {
    throw new Error(`동행복권 호출 실패: HTTP ${res.status}`);
  }

  return res.json();
}

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const drawNoRaw = url.searchParams.get("drawNo");

    if (!drawNoRaw || drawNoRaw === "latest") {
      const start = estimateLatestDrawNo();
      for (let i = 0; i < 5; i += 1) {
        const candidate = start - i;
        const data = await fetchDraw(candidate);
        if (data.returnValue === "success") {
          return json({ ok: true, source: "dhlottery", data });
        }
      }
      return json({ ok: false, error: "최신 회차 정보를 찾지 못했습니다." }, 404);
    }

    const drawNo = Number(drawNoRaw);
    if (!Number.isInteger(drawNo) || drawNo < 1) {
      return json({ ok: false, error: "drawNo는 1 이상의 정수여야 합니다." }, 400);
    }

    const data = await fetchDraw(drawNo);
    if (data.returnValue !== "success") {
      return json({ ok: false, error: "해당 회차를 찾지 못했습니다." }, 404);
    }

    return json({ ok: true, source: "dhlottery", data });
  } catch (error) {
    return json({ ok: false, error: error.message || "알 수 없는 서버 오류" }, 500);
  }
}
