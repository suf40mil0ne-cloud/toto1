const OFFICIAL_DRAW_URL = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber";
const NAVER_SEARCH_URL = "https://search.naver.com/search.naver";
const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";
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

  const text = await res.text();
  if (text.includes("현재 접속 사용자가 많아") || text.includes("errorPage")) {
    throw new Error("동행복권 서버 대기열로 인해 조회가 제한되고 있습니다.");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error("동행복권 응답 형식이 변경되어 조회에 실패했습니다.");
  }

  return parsed;
}

function extractNumbersFromBalls(html) {
  return Array.from(html.matchAll(/<span class="ball[^"]*">(\d+)<\/span>/g)).map((m) => Number(m[1]));
}

function htmlDecode(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value) {
  return htmlDecode(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDrawDate(drawNo) {
  const date = new Date(FIRST_DRAW_DATE.getTime() + (drawNo - 1) * 7 * 24 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function parseNaverDraw(html) {
  const headMatch = html.match(/class="text _select_trigger _text"[^>]*>\s*(\d+)회차\s*\((\d{4}\.\d{2}\.\d{2})\.\)\s*<\/a>/);
  if (!headMatch) {
    throw new Error("네이버 로또 결과에서 회차 정보를 찾지 못했습니다.");
  }

  const numbersMatch = html.match(
    /<div class="winning_number">([\s\S]*?)<\/div>[\s\S]*?<div class="bonus_number">([\s\S]*?)<\/div>/,
  );
  if (!numbersMatch) {
    throw new Error("네이버 로또 결과에서 당첨번호 정보를 찾지 못했습니다.");
  }

  const winning = extractNumbersFromBalls(numbersMatch[1]);
  const bonus = extractNumbersFromBalls(numbersMatch[2]);
  if (winning.length !== 6 || bonus.length < 1) {
    throw new Error("네이버 로또 당첨번호 파싱에 실패했습니다.");
  }

  const prizeMatch = html.match(
    /1등 당첨금\s*<strong class="emphasis">([\d,]+)<\/strong>원\s*\(당첨 복권수\s*([\d,]+)개\)/,
  );

  const drwNo = Number(headMatch[1]);
  const data = {
    returnValue: "success",
    drwNo,
    drwNoDate: headMatch[2],
    drwtNo1: winning[0],
    drwtNo2: winning[1],
    drwtNo3: winning[2],
    drwtNo4: winning[3],
    drwtNo5: winning[4],
    drwtNo6: winning[5],
    bnusNo: bonus[0],
    firstWinamnt: prizeMatch ? Number(prizeMatch[1].replace(/,/g, "")) : 0,
    firstPrzwnerCo: prizeMatch ? Number(prizeMatch[2].replace(/,/g, "")) : 0,
  };

  return data;
}

async function fetchDrawFromNaver(drawNo) {
  const query = Number.isInteger(drawNo) ? `${drawNo}회 로또 당첨번호` : "로또 당첨번호";
  const target = `${NAVER_SEARCH_URL}?query=${encodeURIComponent(query)}`;
  const res = await fetch(target, {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "text/html,application/xhtml+xml",
      referer: "https://search.naver.com/",
    },
    cf: { cacheTtl: 120, cacheEverything: false },
  });

  if (!res.ok) {
    throw new Error(`네이버 검색 호출 실패: HTTP ${res.status}`);
  }

  const html = await res.text();
  const parsed = parseNaverDraw(html);

  if (Number.isInteger(drawNo) && parsed.drwNo !== drawNo) {
    throw new Error(`네이버 검색 결과가 요청 회차(${drawNo})와 다릅니다.`);
  }

  return parsed;
}

function parseGoogleNewsItems(xml) {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).map((m) => m[1]);
}

function parseGoogleDrawFromText(text, requestedDrawNo) {
  const drawMatch = text.match(/(?:로또\s*)?(\d{3,4})회/);
  if (!drawMatch) return null;

  const drawNo = Number(drawMatch[1]);
  if (Number.isInteger(requestedDrawNo) && drawNo !== requestedDrawNo) return null;

  const sixMatch = text.match(/(\d{1,2}\s*,\s*\d{1,2}\s*,\s*\d{1,2}\s*,\s*\d{1,2}\s*,\s*\d{1,2}\s*,\s*\d{1,2})/);
  if (!sixMatch) return null;
  const winning = sixMatch[1].split(",").map((v) => Number(v.trim()));
  if (winning.length !== 6 || winning.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) return null;

  const bonusMatch = text.match(/보너스(?:\s*번호)?\s*[‘'"]?(\d{1,2})/);
  const winnerMatch = text.match(/1등(?:\s*당첨자)?\s*(\d+)\s*명/);
  const prizeMatch = text.match(/(?:각|1인당)\s*([\d,]+)\s*원/);

  return {
    returnValue: "success",
    drwNo: drawNo,
    drwNoDate: formatDrawDate(drawNo),
    drwtNo1: winning[0],
    drwtNo2: winning[1],
    drwtNo3: winning[2],
    drwtNo4: winning[3],
    drwtNo5: winning[4],
    drwtNo6: winning[5],
    bnusNo: bonusMatch ? Number(bonusMatch[1]) : 0,
    firstWinamnt: prizeMatch ? Number(prizeMatch[1].replace(/,/g, "")) : 0,
    firstPrzwnerCo: winnerMatch ? Number(winnerMatch[1]) : 0,
  };
}

function parseGoogleDraw(xml, requestedDrawNo) {
  const items = parseGoogleNewsItems(xml);
  for (const item of items) {
    const titleRaw = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
    const descRaw = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";
    const sourceRaw = item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "";
    const text = `${stripTags(titleRaw)} ${stripTags(descRaw)} ${stripTags(sourceRaw)}`;
    const parsed = parseGoogleDrawFromText(text, requestedDrawNo);
    if (parsed) return parsed;
  }
  throw new Error("구글 검색 결과에서 당첨번호를 찾지 못했습니다.");
}

async function fetchDrawFromGoogle(drawNo) {
  const query = Number.isInteger(drawNo) ? `${drawNo}회 로또 당첨번호` : "로또 당첨번호";
  const target = `${GOOGLE_NEWS_RSS_URL}?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const res = await fetch(target, {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/rss+xml,application/xml,text/xml",
      referer: "https://news.google.com/",
    },
    cf: { cacheTtl: 180, cacheEverything: false },
  });

  if (!res.ok) {
    throw new Error(`구글 뉴스 RSS 호출 실패: HTTP ${res.status}`);
  }

  const xml = await res.text();
  return parseGoogleDraw(xml, drawNo);
}

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const drawNoRaw = url.searchParams.get("drawNo");

    if (!drawNoRaw || drawNoRaw === "latest") {
      const start = estimateLatestDrawNo();
      let officialError;
      for (let i = 0; i < 5; i += 1) {
        const candidate = start - i;
        try {
          const data = await fetchDraw(candidate);
          if (data.returnValue === "success") {
            return json({ ok: true, source: "dhlottery", data });
          }
        } catch (error) {
          officialError = error;
        }
      }

      try {
        const data = await fetchDrawFromNaver();
        return json({ ok: true, source: "naver-search", data });
      } catch (naverError) {
        try {
          for (let i = 0; i < 5; i += 1) {
            const candidate = start - i;
            const data = await fetchDrawFromGoogle(candidate);
            return json({ ok: true, source: "google-news", data });
          }
          throw new Error("구글 검색에서 최신 회차를 찾지 못했습니다.");
        } catch (googleError) {
          const reason = googleError.message || naverError.message || officialError?.message || "최신 회차 정보를 찾지 못했습니다.";
          return json({ ok: false, error: reason }, 404);
        }
      }
    }

    const drawNo = Number(drawNoRaw);
    if (!Number.isInteger(drawNo) || drawNo < 1) {
      return json({ ok: false, error: "drawNo는 1 이상의 정수여야 합니다." }, 400);
    }

    try {
      const data = await fetchDraw(drawNo);
      if (data.returnValue === "success") {
        return json({ ok: true, source: "dhlottery", data });
      }
    } catch (error) {
      // fall through to naver fallback
    }

    try {
      const fallbackData = await fetchDrawFromNaver(drawNo);
      return json({ ok: true, source: "naver-search", data: fallbackData });
    } catch (naverError) {
      const googleData = await fetchDrawFromGoogle(drawNo);
      return json({ ok: true, source: "google-news", data: googleData });
    }
  } catch (error) {
    const message = error.message || "알 수 없는 서버 오류";
    const blocked = message.includes("대기열");
    return json({ ok: false, blocked, error: message }, blocked ? 503 : 500);
  }
}
