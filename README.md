# Lotto Insight

Cloudflare Pages 기반 로또 정보 사이트입니다.

## 기능
- 로또번호 생성기
- 회차별 당첨번호 조회 (`/api/draw`)
- 회차별 1등 판매점 조회 (`/api/stores`)

## 배포
- Cloudflare Pages에 이 저장소를 연결
- Production branch: `main`
- Build command: 없음
- Build output directory: `/`
- Functions directory: `functions`

## 애드센스 적용 전 필수 교체
다음 값은 실제 운영값으로 바꿔야 합니다.
- `index.html`
  - `ca-pub-xxxxxxxxxxxxxxxx` -> 본인 AdSense Publisher ID
  - `data-ad-slot="1234567890"` -> 본인 광고 슬롯 ID
- `ads.txt`
  - `pub-xxxxxxxxxxxxxxxx` -> 본인 AdSense Publisher ID
- `contact.html`
  - `contact@example.com` -> 실제 문의 이메일
- `robots.txt`, `sitemap.xml`
  - `https://example.com` -> 실제 도메인

## 참고
AdSense 심사는 정책 준수/콘텐츠 품질/도메인 신뢰도 등 복합요인으로 결정되므로 100% 보장할 수 없습니다.
