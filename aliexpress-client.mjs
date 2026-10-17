/* Server-only AliExpress adapter, CJ-shaped interface.
   AliExpress Affiliate / Open Platform API (Portals -> Tools -> API, then the
   Open Platform console). Approval-gated: the user must supply an approved
   App Key + App Secret + Tracking ID, all from the SAME AliExpress account.
   Signing (per AliExpress affiliate guides): sort ALL request params except
   `sign` by key, concatenate key+value with no separator, wrap with the
   secret on both sides (secret + concatenated + secret), MD5, uppercase hex.
   `sign_method` is `md5` by default; `hmac-sha256` is also supported via
   ALIEXPRESS_SIGN_METHOD for consoles that require it. Requests are POST,
   form-urlencoded, to the Open Platform gateway (default
   https://api-sg.aliexpress.com/sync, overridable via ALIEXPRESS_BASE_URL).
   Methods used: aliexpress.affiliate.product.query (search) and
   aliexpress.affiliate.productdetail.get (detail/draft). If the live console
   reports an unknown method, the provider error is surfaced as a 502 — the
   adapter never guesses a different method or fakes a result.
   HONEST LIMITS (affiliate API != fulfilment API): the Affiliate API returns
   catalogue data + tracked links. It does NOT place orders, quote freight,
   or report live stock, so freight(), createOrder(), payOrder() and order()
   refuse with a plain 422 explaining the manual step. Dropshipping fulfilment
   stays manual: place the order in AliExpress / the Dropshipping Center,
   where you pay per order. No key configured -> 503, like every adapter. */
import {createHash, createHmac} from 'node:crypto';
const failure = (status, message) => Object.assign(new Error(message), {status});
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v));
const first = (...values) => { for (const v of values) if (v !== undefined && v !== null && v !== '') return v; return undefined; };
function utcTimestamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
export function signParams(params, secret, method = 'md5') {
  const sorted = Object.keys(params).filter(k => k !== 'sign').sort();
  const joined = sorted.map(k => k + params[k]).join('');
  if (method === 'hmac-sha256') return createHmac('sha256', secret).update(joined, 'utf8').digest('hex').toUpperCase();
  if (method !== 'md5') throw failure(422, 'ALIEXPRESS_SIGN_METHOD must be md5 or hmac-sha256');
  return createHash('md5').update(secret + joined + secret, 'utf8').digest('hex').toUpperCase();
}
export function createAliExpress({
  appKey = process.env.ALIEXPRESS_APP_KEY || '',
  appSecret = process.env.ALIEXPRESS_APP_SECRET || '',
  trackingId = process.env.ALIEXPRESS_TRACKING_ID || '',
  baseUrl = process.env.ALIEXPRESS_BASE_URL || 'https://api-sg.aliexpress.com/sync',
  signMethod = process.env.ALIEXPRESS_SIGN_METHOD || 'md5',
  currency = process.env.ALIEXPRESS_CURRENCY || 'USD',
  language = process.env.ALIEXPRESS_LANGUAGE || 'EN',
  fetcher = fetch,
} = {}) {
  const configured = !!(appKey && appSecret && trackingId);
  async function call(apiMethod, params = {}) {
    if (!configured) throw failure(503, 'Configure ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET and ALIEXPRESS_TRACKING_ID privately on Render to connect AliExpress.');
    if (!['md5', 'hmac-sha256'].includes(signMethod)) throw failure(422, 'ALIEXPRESS_SIGN_METHOD must be md5 or hmac-sha256');
    const all = {
      method: apiMethod, app_key: appKey, timestamp: utcTimestamp(), v: '2.0',
      sign_method: signMethod, format: 'json', ...params,
    };
    all.sign = signParams(all, appSecret, signMethod);
    let response, data;
    try {
      response = await fetcher(baseUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'},
        body: new URLSearchParams(all).toString(),
        signal: AbortSignal.timeout(20000),
      });
      data = await response.json();
    } catch { throw failure(502, 'AliExpress is temporarily unavailable. Try again later.'); }
    const result = data?.resp_result?.result ?? data?.result ?? data?.resp_result;
    const code = data?.resp_result?.resp_code ?? data?.code;
    const message = data?.resp_result?.resp_msg ?? data?.msg ?? data?.error_message;
    if (!response.ok || (code !== undefined && String(code) !== '200') || result === undefined) {
      throw failure(response.status === 429 ? 429 : 502, 'AliExpress rejected the request' + (message ? ': ' + String(message).slice(0, 200) : '. Check the App Key, approval status, or try again later.'));
    }
    return result;
  }
  function toProduct(p) {
    const id = str(first(p.product_id, p.productId, p.id));
    if (!id) return null;
    const price = num(first(p.app_sale_price, p.sale_price, p.target_sale_price, p.product_price, p.price));
    const image = str(first(p.product_main_image_url, p.product_main_image, p.image_url, p.image));
    return {
      id, name: str(first(p.product_title, p.title, p.name)).slice(0, 160),
      image: /^https:\/\//.test(image) ? image : '',
      cost: price !== null && price > 0 ? price : null,
      stock: null, stockUnknown: true, category: str(first(p.first_level_category_name, p.category_name, p.category)).slice(0, 100) || 'AliExpress',
      orders: num(first(p.lastest_volume, p.volume, p.orders)) ?? null,
      rating: num(first(p.evaluate_rate, p.rating)) ?? null,
      affiliateUrl: str(first(p.product_detail_url, p.promotion_link, p.detail_url)),
      madeToOrder: false,
    };
  }
  return {
    configured,
    async search(query, page = 1) {
      const q = String(query || '').trim();
      if (!q) throw failure(422, 'Enter a search term');
      const result = await call('aliexpress.affiliate.product.query', {
        keywords: q, tracking_id: trackingId, target_currency: currency, target_language: language,
        page_no: String(Math.max(1, page)), page_size: '12',
      });
      const products = (Array.isArray(result?.products) ? result.products : Array.isArray(result) ? result : [])
        .map(toProduct).filter(Boolean);
      const total = num(first(result?.total_count, result?.total)) ?? products.length;
      return {page: Math.max(1, page), total, products, affiliate: true,
        note: 'AliExpress catalogue via the Affiliate API. Stock is not reported live — verify stock, shipping time and cost on the listing before publishing.'};
    },
    async draft(id, category, markup) {
      if (typeof id !== 'string' || !id) throw failure(422, 'Invalid AliExpress product id');
      if (typeof markup !== 'number' || !Number.isFinite(markup) || markup < 0 || markup > 1000) throw failure(422, 'Invalid markup');
      const result = await call('aliexpress.affiliate.productdetail.get', {
        product_ids: id, tracking_id: trackingId, target_currency: currency, target_language: language,
      });
      const raw = Array.isArray(result?.products) ? result.products[0] : Array.isArray(result) ? result[0] : result;
      const p = toProduct(raw || {});
      if (!p || p.cost === null) throw failure(422, 'This AliExpress product has no usable price. Review it manually.');
      const variantId = 'ae-' + p.id;
      const price = Math.round(p.cost * (1 + markup / 100) * 100) / 100;
      return {
        name: p.name, brand: 'VEGArance', category, line: '', blurb: '', image: p.image,
        inStock: false, stockUnknown: true,
        variants: [{id: variantId, label: 'Standard', sku: '', inStock: false}],
        prices: {[variantId]: price},
        supplier: {provider: 'aliexpress', productId: p.id},
        affiliateUrl: p.affiliateUrl,
        note: 'Draft from AliExpress affiliate data. Stock, shipping time and final cost are NOT verified by the API — check the live listing before approving for sale. Fulfilment is manual: you place and pay for the order in AliExpress.',
      };
    },
    async variant(id) {
      if (typeof id !== 'string' || !id) throw failure(422, 'Invalid AliExpress variant id');
      const productId = id.startsWith('ae-') ? id.slice(3) : id;
      const result = await call('aliexpress.affiliate.productdetail.get', {
        product_ids: productId, tracking_id: trackingId, target_currency: currency, target_language: language,
      });
      const raw = Array.isArray(result?.products) ? result.products[0] : Array.isArray(result) ? result[0] : result;
      const p = toProduct(raw || {});
      if (!p || p.cost === null) throw failure(502, 'AliExpress product data is incomplete.');
      // quantity null = unknown, never zero. Callers must not treat it as "out of stock".
      return {cost: p.cost, quantity: null, stockUnknown: true};
    },
    async freight() { throw failure(422, 'AliExpress does not expose a fulfilment freight API. Check shipping time and cost on the live listing and place the order manually in AliExpress.'); },
    async createOrder() { throw failure(422, 'AliExpress orders are placed manually in AliExpress / the Dropshipping Center. This adapter never places orders automatically.'); },
    async payOrder() { throw failure(422, 'AliExpress orders are paid manually at AliExpress checkout. This adapter never charges anything.'); },
    async order() { throw failure(422, 'AliExpress order status is not available through the Affiliate API. Track the order in your AliExpress account.'); },
  };
}
