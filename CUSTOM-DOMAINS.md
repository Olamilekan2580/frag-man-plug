# VEGArance — Custom Merchant Domains (Design Only — NOT BUILT)

**Status: documented next step. Nothing in this file is implemented.
No merchant can set a custom domain today. The billing gate for
`custom_domain` always refuses, even on Growth, because there is nothing
behind it.**

## Goal

Let a merchant serve their storefront from their own domain
(`shop.example.com`) instead of `/shops/{slug}`, with valid HTTPS, while
the platform still owns routing, checkout, and webhooks.

## Design (for the future build)

1. **Request + verification.**
   - Merchant enters a hostname in the dashboard (Growth plan only,
     billing gate `custom_domain`).
   - Platform generates a verification token; merchant publishes a DNS
     TXT record (`_vegarance-verification.shop.example.com`) or a file
     at a well-known path. Platform checks it before the domain goes
     live. Unverified domains never serve the storefront.
   - Hostname validation: lowercase, valid DNS labels, no wildcards in
     v1, no Vegarance-owned or reserved names, one domain per store in
     v1 (apex + www counts as one mapping, configured as two records).
2. **DNS.**
   - Merchant points the hostname at the platform: CNAME to the
     platform's canonical host (preferred) or A/AAAA to the platform IP.
   - The platform stores the mapping `hostname → storeId` in a new
     `merchant_domains` table (hostname, storeId, status:
     `pending | verified | active | failed`, verifiedAt, tlsStatus).
3. **TLS.**
   - Per-domain certificates are required — a single platform cert does
     not cover merchant domains. Options, to be decided at build time:
     (a) the hosting provider's per-domain TLS (e.g. Render custom
     domains, which provision and renew certificates per domain);
     (b) ACME (Let's Encrypt) issuance + renewal inside the platform,
     with a challenge responder for HTTP-01.
   - The storefront must never be served over plain HTTP on a custom
     domain. If TLS is not ready, the domain stays `pending` and the
     `/shops/{slug}` URL keeps working.
4. **Routing.**
   - The HTTP server resolves the request `Host` header to a storeId via
     the verified mapping; unknown hosts fall through to the normal
     `/shops/{slug}` routing (never to a random store, never a 500).
   - All store-scoped URLs (public catalogue, quote/checkout, order
     lookup, webhooks) must work under the custom host. Webhook URLs
     registered with payment providers must be re-registered per host
     change — or kept on the platform host, which is simpler and
     recommended in v1 (webhooks stay on the platform domain; only the
     buyer-facing storefront moves).
   - Cookies: merchant session cookies are host-scoped; the merchant
     dashboard stays on the platform host (no cross-domain session).
5. **Limits & abuse.**
   - Growth plan only; one domain per store in v1; verification attempts
     rate-limited; failed verifications do not block the `/shops/{slug}`
     storefront.
   - The platform must not serve another merchant's storefront on a
     domain the requester does not own — verification is the whole
     security boundary. Treat a verification bypass as a sev-1 bug.
6. **Email.**
   - Custom domains do not change email sending: Resend senders are
     verified per sending domain separately. A merchant who wants
     receipts from `orders@shop.example.com` verifies that sending
     domain in Resend first (existing flow).

## Why it is not half-built

Custom domains touch DNS, TLS, routing, and the security boundary at
once. A partial build (e.g. Host-header routing without verification
or TLS) would let anyone point any domain at any store. The design
above is the full scope; it ships as one complete build or not at all.
