const OFFICIAL_STORE_URL = "https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645";

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

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const drawNo = Number(url.searchParams.get("drawNo"));

    if (!Number.isInteger(drawNo) || drawNo < 1) {
      return json({ ok: false, error: "drawNo는 1 이상의 정수여야 합니다." }, 400);
    }

    const target = `${OFFICIAL_STORE_URL}&drwNo=${drawNo}`;
    const res = await fetch(target, {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/html,application/xhtml+xml",
        referer: "https://www.dhlottery.co.kr/",
      },
      cf: { cacheTtl: 120, cacheEverything: false },
    });

    if (!res.ok) {
      return json({ ok: false, error: `동행복권 호출 실패: HTTP ${res.status}` }, 502);
    }

    const html = await res.text();
    const stores = parseStores(html);

    return json({ ok: true, source: "dhlottery", drawNo, count: stores.length, stores });
  } catch (error) {
    return json({ ok: false, error: error.message || "알 수 없는 서버 오류" }, 500);
  }
}
