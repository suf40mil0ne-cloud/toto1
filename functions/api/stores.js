const OFFICIAL_STORE_URL = "https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645";
const NAVER_SEARCH_URL = "https://search.naver.com/search.naver";

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

function stripTags(value) {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseStores(html) {
  if (html.includes("현재 접속 사용자가 많아") || html.includes("errorPage")) {
    throw new Error("동행복권 서버 대기열로 인해 판매점 조회가 제한되고 있습니다.");
  }

  const stores = [];
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    const cols = row.match(/<td[\s\S]*?<\/td>/gi) || [];
    if (cols.length < 4) continue;

    const cells = cols.map((col) => stripTags(col));
    const joined = cells.join(" ");
    if (!/(자동|수동|반자동)/.test(joined)) continue;

    stores.push({
      rank: cells[0] || "-",
      name: cells[1] || "-",
      method: cells[2] || "-",
      address: cells.slice(3).join(" ") || "-",
    });
  }

  return stores;
}

function stripTagsFromHtml(value) {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseNaverStores(html) {
  const drawMatch = html.match(/class="text _select_trigger _text"[^>]*>\s*(\d+)회차\s*\((\d{4}\.\d{2}\.\d{2})\.\)\s*<\/a>/);
  if (!drawMatch) {
    throw new Error("네이버 검색 결과에서 회차 정보를 찾지 못했습니다.");
  }

  const panelMatch = html.match(
    /<div class="win_card_box _store_panel" aria-hidden="false">([\s\S]*?)<div class="win_card_box _store_panel" aria-hidden="true">/,
  );
  if (!panelMatch) {
    throw new Error("네이버 검색 결과에서 판매점 패널을 찾지 못했습니다.");
  }

  const panel = panelMatch[1];
  const cardMatches = panel.matchAll(/<div class="card_inner">([\s\S]*?)<\/li>/g);
  const stores = [];

  for (const card of cardMatches) {
    const block = card[1];
    const nameMatch = block.match(/class="text"[^>]*>([\s\S]*?)<\/a>/);
    const addressMatch = block.match(/<dd class="line_1">([\s\S]*?)<\/dd>/);
    const countMatch = block.match(/1등 당첨 복권수\s*<strong>\s*([\d,]+)\s*개?\s*<\/strong>/);

    const name = nameMatch ? stripTagsFromHtml(nameMatch[1]) : "-";
    const address = addressMatch ? stripTagsFromHtml(addressMatch[1]) : "-";
    const count = countMatch ? Number(countMatch[1].replace(/,/g, "")) : 0;
    if (!name || name === "-") continue;

    stores.push({
      rank: "1등",
      name,
      method: count > 0 ? `1등 ${count}개` : "1등",
      address,
    });
  }

  if (!stores.length) {
    throw new Error("네이버 검색 결과에서 판매점 항목을 찾지 못했습니다.");
  }

  return { drawNo: Number(drawMatch[1]), stores };
}

async function fetchStoresFromNaver(drawNo) {
  const query = `${drawNo}회 로또 당첨번호`;
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
  const parsed = parseNaverStores(html);
  if (parsed.drawNo !== drawNo) {
    throw new Error(`네이버 검색 결과가 요청 회차(${drawNo})와 다릅니다.`);
  }

  return parsed.stores;
}

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const drawNo = Number(url.searchParams.get("drawNo"));

    if (!Number.isInteger(drawNo) || drawNo < 1) {
      return json({ ok: false, error: "drawNo는 1 이상의 정수여야 합니다." }, 400);
    }

    try {
      const target = `${OFFICIAL_STORE_URL}&drwNo=${drawNo}`;
      const res = await fetch(target, {
        headers: {
          "user-agent": "Mozilla/5.0",
          accept: "text/html,application/xhtml+xml",
          referer: "https://www.dhlottery.co.kr/",
        },
        cf: { cacheTtl: 120, cacheEverything: false },
      });

      if (res.ok) {
        const html = await res.text();
        const stores = parseStores(html);
        if (stores.length) {
          return json({ ok: true, source: "dhlottery", drawNo, count: stores.length, stores });
        }
      }
    } catch (error) {
      // fall through to naver fallback
    }

    const stores = await fetchStoresFromNaver(drawNo);
    return json({ ok: true, source: "naver-search", drawNo, count: stores.length, stores });
  } catch (error) {
    return json({ ok: false, error: error.message || "알 수 없는 서버 오류" }, 500);
  }
}
