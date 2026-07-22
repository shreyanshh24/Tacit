# Tacit — Pitch Deck

Single-file, self-contained slide deck (no build step). Matches the Tacit app
theme: near-black `#070708`, amber `#fbbf24` accent, ambient amber glow, Geist
fonts.

Slides: **Title → Problem → Solution → Demo → Chat → Agents**.

## Run locally

Open `index.html` directly, or serve it:

```bash
python3 -m http.server -d deck 8080   # http://localhost:8080
```

## Navigate

`→` / `space` / click / swipe — next · `←` — back · dots — jump · `Home`/`End` — ends.

Also: mouse-wheel / trackpad scroll and the `←`/`→` buttons (bottom-right).

## Background shader

The animated amber background is the **neuro-noise** shader from
[paper.design](https://shaders.paper.design/neuro-noise). It loads the vanilla
`@paper-design/shaders` (zero deps) at runtime via the esm.sh CDN — no build
step, so the deck stays a single deployable HTML file.

**To revert:** delete the `#shader-bg` / `#shader-veil` divs, their CSS block,
and the `<script type="module">` shader block at the bottom of `index.html`.
Tune colors/intensity via the `u_colorMid` / `u_brightness` / `u_contrast`
uniforms in that script.

## Deploy

Any static host — it's one HTML file (needs network for the Geist font + shader CDN).

```bash
npx vercel deploy --prod deck      # or: netlify deploy --dir=deck --prod
```
