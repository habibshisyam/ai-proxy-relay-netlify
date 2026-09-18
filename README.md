# AI Proxy Relay — Netlify Edge

Stateless edge header relay untuk 9Router / VansRouter. Alternatif deployment selain Cloudflare Worker dan Vercel Edge.

## Deploy

1. Buka [Netlify](https://app.netlify.com/).
2. **Add new project → Import an existing project**.
3. Pilih GitHub repository ini.
4. Build command: kosongkan.
5. Publish directory: kosongkan atau gunakan `.`.
6. Deploy.

Struktur wajib:

```text
netlify.toml
edge-functions/relay.js
```

Jika Netlify meminta environment variable, tambahkan optional:

```text
HEALTH_HOSTS=httpbin.org,api.httpbin.org,www.google.com
```

## Test

```bash
curl -i "https://<site>.netlify.app/__health"
```

```bash
curl -i "https://<site>.netlify.app/" -H "x-relay-target: https://httpbin.org" -H "x-relay-path: /get"
```

```bash
curl -i "https://<site>.netlify.app/" -H "x-relay-target: https://api.deepseek.com" -H "x-relay-path: /v1/models" -H "Authorization: Bearer test"
```

Expected:

```text
/__health → 200
httpbin health shim → 200
DeepSeek with fake key → 401
```

## Pasang di 9Router

```text
Proxy URL: https://<site>.netlify.app
Type: vercel
```

`type: vercel` hanya memilih header-relay branch pada router lama. Trafik tetap menuju Netlify. Jangan gunakan `type: http`.

## Behavior

- Meneruskan method, body, authorization, dan header aman.
- Menghapus hop-by-hop, internal relay, dan forwarding headers.
- Memaksa `accept-encoding: identity`.
- Response tetap streaming melalui `Response(upstream.body)`.
- Health shim lokal menghindari false `503` dari httpbin pada health test.
- IP egress adalah IP/ASN Netlify, bukan IP Indonesia dan bukan IP static yang dijamin.
