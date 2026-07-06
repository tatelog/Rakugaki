// ============================================================
//  X(旧Twitter) アバター取得プロキシ  ―  Cloudflare Worker
// ------------------------------------------------------------
//  ブラウザから  https://<your>.workers.dev/?u=<アカウント名>
//  を叩くと、そのアカウントのプロフィール画像を
//  CORS(Access-Control-Allow-Origin:*)付きで返します。
//
//  サーバー側(エッジ)で取得するため、閲覧者の回線が
//  twimg/unavatar 等をブロックしていても影響を受けません。
//
//  デプロイ手順は同じフォルダの README.md を参照。
// ============================================================

const UA = 'Mozilla/5.0 (compatible; RakugakiAvatarBot/1.0)';

// アカウント名 → 実アバターURL を解決（公式JSON → 失敗時はunavatar）
async function resolveAvatarUrl(user) {
  const api = 'https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=' +
    encodeURIComponent(user);
  try {
    const r = await fetch(api, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
    if (r.ok) {
      const j = await r.json();
      const u = j && j[0] && j[0].profile_image_url_https;
      if (u) return u.replace('_normal', '_400x400'); // 高解像度版
    }
  } catch (_) { /* fall through */ }
  // フォールバック：unavatar（サーバー側なのでCORSは無関係）
  return 'https://unavatar.io/twitter/' + encodeURIComponent(user) + '?fallback=false';
}

function withCors(resp) {
  const h = new Headers(resp.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return new Response(resp.body, { status: resp.status, headers: h });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }));
    }
    const url = new URL(request.url);
    const user = (url.searchParams.get('u') || '').replace(/^@+/, '').trim();
    if (!user) {
      return withCors(new Response('usage: ?u=<screen_name>', { status: 400 }));
    }
    try {
      const imgUrl = await resolveAvatarUrl(user);
      const ir = await fetch(imgUrl, { headers: { 'User-Agent': UA } });
      if (!ir.ok) {
        return withCors(new Response('avatar fetch failed: ' + ir.status, { status: 502 }));
      }
      const buf = await ir.arrayBuffer();
      const headers = new Headers();
      headers.set('Content-Type', ir.headers.get('content-type') || 'image/jpeg');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ
      return new Response(buf, { status: 200, headers });
    } catch (e) {
      return withCors(new Response('error: ' + (e && e.message || e), { status: 500 }));
    }
  }
};
