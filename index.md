---
layout: null
---
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#101829">
    <meta name="description" content="MediSync helps people explore hospital capacity and coordinate care.">
    <title>MediSync — Hospital capacity, in real time</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #eef4fa;
        background: #101829;
        font-synthesis: none;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        --muted: #9eacc1;
        --line: rgb(219 234 254 / 12%);
        --mint: #78e5d1;
      }

      * { box-sizing: border-box; }

      body {
        min-width: 320px;
        min-height: 100vh;
        margin: 0;
        background:
          radial-gradient(900px 520px at 8% -10%, rgb(49 192 194 / 19%), transparent 66%),
          radial-gradient(760px 480px at 96% 7%, rgb(136 98 220 / 19%), transparent 65%),
          radial-gradient(900px 600px at 50% 110%, rgb(48 111 176 / 14%), transparent 66%),
          #101829;
      }

      a { color: inherit; }

      .shell { width: min(1120px, calc(100% - 40px)); margin: 0 auto; }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 2;
        border-bottom: 1px solid var(--line);
        background: rgb(14 23 39 / 78%);
        backdrop-filter: blur(20px);
      }

      .nav { min-height: 76px; display: flex; align-items: center; gap: 14px; }

      .brand-mark {
        display: grid;
        width: 42px;
        height: 42px;
        place-items: center;
        border-radius: 15px;
        background: linear-gradient(140deg, #72e3d1, #34bdd0 54%, #9a7ce8);
        color: #10202b;
        box-shadow: 0 8px 26px rgb(75 203 205 / 20%);
      }

      .brand-mark svg { width: 23px; height: 23px; }
      .brand-name { font-size: 17px; font-weight: 700; letter-spacing: -.03em; }
      .brand-caption { margin-top: 3px; color: var(--muted); font-size: 12px; }
      .nav-link { margin-left: auto; color: #c6d4e4; font-size: 13px; text-decoration: none; }
      .nav-link:hover { color: var(--mint); }

      main { padding: 82px 0 58px; }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(270px, .85fr);
        align-items: center;
        gap: 48px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        padding: 8px 12px;
        border: 1px solid rgb(120 229 209 / 22%);
        border-radius: 999px;
        background: rgb(120 229 209 / 8%);
        color: #9cebdd;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: .02em;
      }

      .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #63dfac; }

      h1 {
        max-width: 660px;
        margin: 22px 0 14px;
        font-size: clamp(40px, 6vw, 66px);
        font-weight: 650;
        letter-spacing: -.055em;
        line-height: 1.04;
      }

      .gradient {
        background: linear-gradient(100deg, #85ead8, #71d5ed 54%, #b8a0f4);
        background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .intro { max-width: 560px; margin: 0; color: #afbdd0; font-size: 16px; line-height: 1.75; }

      .notice {
        display: flex;
        gap: 12px;
        max-width: 600px;
        margin-top: 28px;
        padding: 16px;
        border: 1px solid rgb(250 190 96 / 22%);
        border-radius: 16px;
        background: linear-gradient(140deg, rgb(250 190 96 / 9%), rgb(132 93 178 / 8%));
        color: #eddfc7;
        font-size: 13px;
        line-height: 1.65;
      }

      .notice svg { width: 19px; height: 19px; flex: 0 0 auto; margin-top: 1px; color: #f0c576; }
      .notice strong { color: #fff0d6; }

      .visual {
        position: relative;
        min-height: 320px;
        overflow: hidden;
        border: 1px solid rgb(219 234 254 / 14%);
        border-radius: 30px;
        background:
          radial-gradient(circle at 50% 46%, rgb(93 205 201 / 13%), transparent 43%),
          linear-gradient(145deg, rgb(39 54 78 / 76%), rgb(24 31 52 / 72%));
        box-shadow: inset 0 1px rgb(255 255 255 / 6%), 0 28px 80px rgb(0 0 0 / 28%);
        backdrop-filter: blur(22px);
      }

      .visual::before, .visual::after {
        position: absolute;
        width: 205px;
        height: 205px;
        border: 1px solid rgb(137 223 218 / 18%);
        border-radius: 50%;
        content: "";
      }

      .visual::before { top: 51px; left: 50%; transform: translateX(-50%); }
      .visual::after { top: 76px; left: 50%; width: 155px; height: 155px; transform: translateX(-50%); }

      .pulse {
        position: absolute;
        top: 50%;
        left: 50%;
        display: grid;
        width: 78px;
        height: 78px;
        place-items: center;
        transform: translate(-50%, -56%);
        border: 1px solid rgb(153 241 227 / 40%);
        border-radius: 27px;
        background: linear-gradient(145deg, rgb(124 225 211 / 25%), rgb(146 124 226 / 22%));
        color: #a4f0e2;
        box-shadow: 0 0 55px rgb(85 208 206 / 20%), inset 0 1px rgb(255 255 255 / 15%);
      }

      .pulse svg { width: 37px; height: 37px; }

      .visual-label {
        position: absolute;
        right: 20px;
        bottom: 20px;
        left: 20px;
        padding: 14px 15px;
        border: 1px solid rgb(219 234 254 / 11%);
        border-radius: 15px;
        background: rgb(15 23 39 / 58%);
        color: #c0cede;
        font-size: 12px;
        line-height: 1.5;
        text-align: center;
        backdrop-filter: blur(14px);
      }

      .section-heading { margin: 72px 0 18px; font-size: 20px; letter-spacing: -.025em; }

      .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }

      .feature {
        min-height: 145px;
        padding: 21px;
        border: 1px solid var(--line);
        border-radius: 20px;
        background: linear-gradient(145deg, rgb(37 49 69 / 72%), rgb(26 33 51 / 58%));
        box-shadow: inset 0 1px rgb(255 255 255 / 4%);
      }

      .feature-icon {
        display: grid;
        width: 37px;
        height: 37px;
        place-items: center;
        border: 1px solid rgb(120 229 209 / 16%);
        border-radius: 12px;
        background: rgb(120 229 209 / 8%);
        color: var(--mint);
      }

      .feature-icon svg { width: 18px; height: 18px; }
      .feature h3 { margin: 15px 0 6px; font-size: 14px; }
      .feature p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.65; }

      footer {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-top: 46px;
        padding-top: 20px;
        border-top: 1px solid var(--line);
        color: #8392a8;
        font-size: 12px;
      }

      footer a { color: #b7c8db; text-decoration: none; }
      footer a:hover { color: var(--mint); }

      @media (max-width: 760px) {
        main { padding-top: 52px; }
        .hero { grid-template-columns: 1fr; gap: 32px; }
        .visual { min-height: 280px; }
        .section-heading { margin-top: 48px; }
        .features { grid-template-columns: 1fr; }
        .feature { min-height: 0; }
      }

      @media (max-width: 440px) {
        .shell { width: min(100% - 30px, 1120px); }
        .brand-caption { font-size: 11px; }
        footer { flex-direction: column; }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; }
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <div class="shell nav">
        <div class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12h4l3-8 4 16 3-8h4" />
          </svg>
        </div>
        <div>
          <div class="brand-name">MediSync</div>
          <div class="brand-caption">Hospital capacity, in real time</div>
        </div>
        <a class="nav-link" href="https://github.com/yaswanthr613-dot/bed-state-live">Project repository ↗</a>
      </div>
    </header>

    <main class="shell">
      <section class="hero" aria-labelledby="headline">
        <div>
          <div class="eyebrow"><span class="live-dot" aria-hidden="true"></span> A clearer view of care coordination</div>
          <h1 id="headline">Find care with <span class="gradient">confidence.</span></h1>
          <p class="intro">MediSync brings hospital discovery and bed-capacity coordination together in one clear, real-time experience.</p>
          <div class="notice" role="note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18.6A1.6 1.6 0 0 0 3.2 21h17.6a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" />
            </svg>
            <div><strong>Static GitHub Pages preview.</strong> This host serves static files only. Live hospital search, bed reservations, and real-time updates require the app's server and are not available on this page. No live capacity data is shown here.</div>
          </div>
        </div>

        <div class="visual" role="img" aria-label="Decorative MediSync healthcare signal illustration; it does not display live hospital data">
          <div class="pulse" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12h4l3-8 4 16 3-8h4" />
            </svg>
          </div>
          <div class="visual-label">A calmer interface for finding and coordinating care<br>Illustrative preview · not a live availability map</div>
        </div>
      </section>

      <h2 class="section-heading">Designed for a clearer next step</h2>
      <section class="features" aria-label="MediSync capabilities">
        <article class="feature">
          <div class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
          </div>
          <h3>Explore nearby hospitals</h3>
          <p>Search local care options and review hospital details when the live app service is available.</p>
        </article>
        <article class="feature">
          <div class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10M3 14h18M7 10h3M7 18v2m10-2v2"/></svg>
          </div>
          <h3>Understand bed status</h3>
          <p>See availability by care unit in the full app. This static preview intentionally shows no capacity figures.</p>
        </article>
        <article class="feature">
          <div class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="5"/></svg>
          </div>
          <h3>Stay in sync</h3>
          <p>Shared reservations and live updates need a server runtime, which GitHub Pages does not provide.</p>
        </article>
      </section>

      <footer>
        <span>MediSync · Hospital bed tracker</span>
        <a href="https://github.com/yaswanthr613-dot/bed-state-live">View the source on GitHub</a>
      </footer>
    </main>
  </body>
</html>
