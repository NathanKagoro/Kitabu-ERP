# Daftari

The first of the finance trackers: a one-page sales book built for **Big Rabbit Meat** (Kimara Kona, Dar es Salaam), a seller of rabbit meat. Swahili only. It started life as a claude.ai artifact ("Big Rabbit Book") and was also uploaded by hand to Netlify as `daftari-book`.

This branch holds its code unchanged. The other two trackers live on other branches of this repo:

| Branch | Product |
|---|---|
| `daftari` | Daftari (this one): one shop, one product, a paper notebook made digital |
| `hesabu-original` | Hesabu: a full shop app with stock, credit, invoices, VAT and staff |
| `main` | Kitabu: Hesabu simplified into a multi-shop template |

## What it does

Six tabs:

- **Muhtasari:** the business at a glance: sales, profit, rabbits in stock, money still owed, with a chart and a plain breakdown of how profit is worked out.
- **Mauzo:** record a sale: date, customer, number of rabbits, price per rabbit, payment method (cash, M-Pesa, Mixx, Airtel Money, HaloPesa, bank), paid or not yet paid.
- **Manunuzi:** record rabbits bought: count, cost, area, transport for the trip.
- **Hasara:** record losses: rabbits lost and any other money lost, with what happened.
- **Wateja:** customers with phone/WhatsApp, who hasn't paid yet, and who to call.
- **Mipangilio:** the usual price per rabbit, and CSV downloads of every list.

There is also a guided tour (the **?** button).

## Files

- `index.html`: the whole app (HTML, CSS and JavaScript in one file), as it was in the artifact. The only change is one line in `<head>` that loads `local-db.js`.
- `local-db.js`: lets the page work outside claude.ai. In the artifact, data is saved through claude.ai's shared storage; anywhere else that is missing, so this file stands in for it and keeps the data in the browser's localStorage, on that device only. Inside claude.ai it does nothing.

## Run it

Open `index.html` through any static server, e.g.

```bash
python3 -m http.server
```

then visit http://localhost:8000.
