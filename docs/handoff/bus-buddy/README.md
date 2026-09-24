# Handoff: Bus Buddy marketing website

## Overview
Marketing site for **Bus Buddy**, a school-transport safety SaaS (live bus tracking, boarding confirmation, face-recognition attendance, on-bus safety). Audience: school decision-makers and parents. Main call to action: **Book a demo**.

Pages: Home, Product & services, Pricing, About, Contact.

## About the design files
`bus-buddy-website.html` is a **design reference built in HTML**: a single offline file you can open in a browser to see the intended look and behavior. It is **not production code**. The file is compiled and minified, so don't edit it directly.

The job is to **rebuild this design** in a real stack. Recommended: **Next.js (App Router) + React + Tailwind CSS**, one route per page, fully static (SSG). Plain HTML/CSS/JS is also fine if the site stays static.

## Fidelity
**High fidelity.** Colors, type, spacing, copy and interactions are final. Match them exactly.

## Design tokens
**Fonts** (Google Fonts)
- Display/body: `Sora` at weights 200, 300, 400, 600, 800
- Mono labels and numbers: `JetBrains Mono` at weights 500, 700

**Colors**
| Token | Hex | Use |
|---|---|---|
| bg | `#08090a` | page background |
| surface | `#0a0c0d` | cards, table rows |
| surface-2 | `#0c0e10` / `#0e1113` | raised panels, inputs, active rows |
| hover-surface | `#101315` | active tab |
| line | `#16181a` | section dividers, 1px grid gaps |
| line-2 | `#1c1f22` / `#1e2124` | card borders |
| line-3 | `#23272a` / `#26292c` | input and ghost-button borders |
| hover-border | `#3a4044` / `#6a7075` | hover border |
| text | `#f2f3f4` | primary text, primary button bg |
| text-2 | `#c9ccce` | secondary strong text, button hover bg |
| muted | `#9aa0a5` | nav, secondary text |
| muted-2 | `#8b9196` | paragraph copy |
| muted-3 | `#7c8287` / `#6b7176` | captions |
| eyebrow | `#5f666b` | mono eyebrow labels |
| faint | `#4f565b` / `#3a4044` | tertiary text, "—" in the pricing table |
| paper | `#f4f4f2` | light contrast sections (testimonials, hardware, selected plan) |
| paper-card | `#ffffff`, border `#e3e3e0` | cards on paper |

**Type scale**
- Hero H1: `clamp(46px, 8.4vw, 124px)`, weight 800, letter-spacing -0.05em, line-height 0.92. Second line in weight 200 italic.
- Page H1: `clamp(34–38px, 5–6vw, 70–82px)`, weight 800, -0.05em, line-height 0.98. Second line in 200 italic.
- Section H2: `clamp(28px, 3.8vw, 48px)`, weight 800, -0.04em, line-height 1.04
- Card H3: 18.5–22px, weight 600, -0.02em
- Body: 13.5–17px, weight 300, line-height 1.6–1.65
- Eyebrow: JetBrains Mono 10px, uppercase, letter-spacing 0.2em, color `#5f666b`
- Stats: JetBrains Mono 26–42px, weight 700, -0.04em

**Radius:** buttons and chips `100px` (pill); cards `16–20px`; inner lists `12–14px`; inputs `10px`
**Container:** max-width 1280px, horizontal padding 26px. Section vertical padding 70–120px.
**Dividers:** every section has `border-bottom: 1px solid #16181a`. For grouped lists, use a `gap:1px` grid on a `#16181a` background so the gaps render as hairlines.

## Global components
- **Header:** sticky, `rgba(8,9,10,.72)` with `backdrop-filter: blur(16px)`, 68px min height. Logo on the left: a 28px rounded-square outline containing a small bus-window rectangle, plus "Bus Buddy" in 800 weight. Nav: *Product & services, Pricing, About*. The active item gets a 1px underline. On the right, one pill button, **Book a demo** (bg `#f2f3f4`, text `#08090a`, hover bg `#c9ccce`).
- **Footer:** 4 columns (brand blurb, Navigation, Company, Legal), then a bottom bar with "Bus Buddy © 2026" and "Parent-paid · School-managed" in mono uppercase.
- **Custom cursor:** a 26px ring with 1px white border and `mix-blend-mode: difference` that follows the mouse. Desktop only; hide it on touch devices.
- **Scroll reveal:** elements with `data-reveal` start at opacity 0 and translateY 18px, then transition to visible over 0.7s when 12% of the element is on screen (IntersectionObserver). Respect `prefers-reduced-motion`.

## Screens

### 1. Home
1. **Hero:** centered. Drifting radial white glows (26s loop), a masked 72px grid, a status pill ("The platform for school transport safety" with a blinking dot), H1 "Every journey, / *accounted for*", subcopy, and two pill buttons (Book a demo, Explore the platform).
2. **Live route panel:** docked under the hero with top corners only rounded. Header strip reads "Live · Route 12 · Morning trip" and "Bus TN-91-SP-3777 · 38 students". Left side: an SVG map. A bus icon moves along a 7-stop polyline (Depot → Green Park → Lake View → Sector 9 → Rosewood → Hillside → School) at about 4.5s per segment, and a dashed route line animates. Right side: Next stop, ETA and Boarded (updates live), a progress bar, and a notification feed that adds one item every 2.3s, up to 4.
3. **School marquee:** "Already in motion". A school icon plus name, scrolling infinitely (34s), with edges faded by a mask.
4. **Vision:** four numbered cells (01–04) on a hairline grid.
5. **Platform tabs:** four tabs on the left (Instrument the bus / Watch the trip / Confirm who boarded / Prove it later). Clicking a tab switches the status list in the right panel.
6. **Design for trust:** three cards with line icons (lock, eye, document).
7. **From the field:** light `#f4f4f2` section with three quote cards, each a quote icon plus text.
8. **Safety+ at the door:** a four-step sequence that cycles every 1.7s (active row is inverted white), next to an animated face-scan frame.
9. **Stats:** four counters that animate from 0 on reveal: 1,240 / 3s / 99.4% / 87%.
10. **FAQ:** accordion with one item open at a time. Six Q&As.
11. **Closing CTA:** "Change what parents / *worry about*." plus two buttons.

### 2. Product & services (one page)
- Hero, then four module cards (Parent app, Attendant app, School console, Safety layer). Each card lists five items.
- Light "Hardware handled at deployment" band: GPS, Camera, Face ID, Fire.
- `#services` anchor section: five phase rows (Route survey → Hardware → Data setup → Onboarding → Run & support) with tag chips, followed by a four-cell SLA strip (<4 h, Monthly, Quarterly, 2 days). The hero has a "Jump to services ↓" link to this anchor.

### 3. Pricing
- Three plan cards: **Basic ₹129**, **Smart ₹149** (selected by default), **Safety+ ₹199**, all per student per month. Clicking a card selects it, and the selected card inverts to paper `#f4f4f2`.
- Full comparison table: 10 groups, ✓ or — per tier. "All features" / "Only differences" filter. The table scrolls horizontally below 620px.
- Commercial model note at the bottom. All tier data is in the JS arrays inside the reference file.

### 4. About
Hero, three principles, a "No budget line required" block with stats (₹0 / 3 / 2 wks), four team cards (person icon, name and role placeholders), and a four-row milestone timeline.

### 5. Contact
Heading and intro on the left, form card on the right. Fields: Name, Work email, School, Buses in service, interest chips (multi-select toggle), and a message textarea. Validation: name, email and school are required, and email is checked with a regex. On success, the form is replaced by a "Request received" state with a "Send another" reset. **Wire the form to a real endpoint** (Formspree, Resend or similar). It currently sends nothing.

## Responsive behavior
All multi-column layouts use `repeat(auto-fit, minmax(200–330px, 1fr))`, so columns collapse to one on mobile. The nav wraps. Add a hamburger menu below about 720px when you rebuild.

## Content still to supply
Real school names or logos, testimonials, team names and photos, and phone and email (removed for now). Legal pages are listed in the footer but not built.

## Files
- `bus-buddy-website.html`: self-contained interactive reference that works offline. Open it in a browser.
- `source.dc.html`: readable source (markup with inline styles, plus a JS logic class at the bottom containing all content arrays: route, pricing groups, FAQs, quotes, services, modules). **Point Claude Code at this file** to lift exact copy and values.

---

## Build status

Built in this repo as `src/app/(marketing)`, one static route per page:
`/`, `/product`, `/pricing`, `/about`, `/contact`.

- Tokens live in `globals.css` under `@theme`, prefixed `bb-` and scoped to
  `.bb-root`, so they cannot collide with the Transport OS design system.
- Copy and data are in `src/lib/marketing/content.ts`, lifted from
  `source.dc.html`. Treat edits there as content changes.
- The hamburger menu below 720px was added as the handoff asks.
- Scroll reveal is gated on `html[data-js]` so the content is still readable
  without JavaScript.

**Not reproduced from the reference, deliberately:**
- The two reference HTML files are not checked in — they are large compiled
  artefacts. Keep them wherever the design handoff lives.

### The contact form

Wired. It posts to `POST /api/demo-request`, which validates the request again
server-side and records it in Supabase.

**To switch it on:**
1. Run `demo-requests.sql` in this folder against your Supabase project
   (Dashboard → SQL Editor). It creates the table, its length constraints and
   an insert-only RLS policy.
2. Nothing else — the deploy already has `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Read the leads in Dashboard → Table Editor → `demo_requests`.

**Hardening (optional):** set `SUPABASE_SERVICE_ROLE_KEY` in the deploy and the
route writes as the service role, bypassing RLS. The public insert policy can
then be dropped, closing the table completely. See `.env.example`.

The table is never readable with the publishable key: RLS is on and there is no
SELECT policy, so the key that ships to every browser can add a row and can
never list them.

Protections: a honeypot field (bots that fill it get a success response and no
row), server-side validation and length limits, and a best-effort per-instance
rate limit of 5 accepted requests per minute per IP. That limit is counted
*after* validation, so correcting a typo does not spend it. Serverless gives
each instance its own memory, so a distributed flood needs edge rate limiting
(Vercel WAF, Cloudflare) — the in-process limit is a floor, not a wall.

**Outstanding:**
- Real school names, testimonials, team names and photos are still placeholders.
- Privacy policy and terms pages are listed in the footer but not built.
- Nothing notifies anyone when a request arrives; leads sit in the table until
  someone looks. A Supabase Database Webhook or a scheduled digest would fix
  that.
