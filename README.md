# CreatorHub

A creator-first hub + marketplace for digital creator work: emotes, PNG / VTuber assets, overlays, thumbnails, and video editing commissions — built around **trust** (verified creators) and **discoverability** (search, filters, “Live now”).

**Status:** Early development (v0 UI + routing)

---

## Why CreatorHub exists
Creators often struggle to:
- get discovered in a niche audience
- prove legitimacy / avoid impersonation
- avoid scams (buyers/sellers disappearing or refusing to pay or provide products)

CreatorHub aims to:
- make it easy to find trusted creators and their offerings
- surface who’s currently live
- eventually support **safe payments** (hold/release + milestones) so both sides are protected

---

## v0 Features (current focus)
- Multi-page React app with clean routes
- Creator directory (`/creators`)
- Live creators page (`/live`)
- Market browsing (`/market`)
- Creator profiles (`/creator/:handle`)
- Listing pages (`/listing/:id`)
- Mock data to iterate the UI quickly

---

## Roadmap
### v0 — Directory + Discovery
- UI/UX foundations
- Search + filters
- Mock data → real API later

### v1 — Verification + Live status
- Connect Twitch / YouTube to “claim” profiles
- Live indicators updated server-side
- Moderation + reporting flow

### v2 — Marketplace payments (anti-scam core)
- Orders + milestones + delivery
- Funds held until approval/timeout
- Dispute window
- Platform fee + creator payouts (Stripe Connect)

### v3 — Sustainability
- Featured listings / boosts
- Banner ads (once traffic exists)

---

## Tech stack
- React + Vite
- React Router
- (Planned) Django + DRF + Postgres
- (Planned) Stripe Connect for marketplace payout flows

---

## Getting started

### Prereqs
- Node.js (LTS recommended)

### Install
```bash
npm install