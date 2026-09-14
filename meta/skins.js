/* =====================================================================
   meta-design: skins
   ---------------------------------------------------------------------
   A skin decides how the page's component vocabulary looks. The markup
   declares components with data-md="component variant …" and the runtime
   toggles states with data-state="on bad …". A skin is:

     assets   external CSS/JS to load (a framework from a CDN)
     mode()   how to tell the framework which colour mode is active
     map      vocabulary → framework classes; the most specific key wins:
              "chip.on" beats "chip"; "btn.primary" beats "btn"
     style    CSS for what the framework has no utility for
     icons    the icon style the skin declares by default

   The native skin is the page's own design; the other three are the
   top CSS frameworks so the same page can be shown in any of them.
   ===================================================================== */
(function (MD) {
  const SKINS = {};

  // ---------------------------------------------------------------- native
  SKINS.native = {
    id: "native", label: "Landed",
    assets: { css: ["https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&display=swap"], js: [] },
    mode: () => {},
    icons: "line",
    map: {},
    style: `
      body { font-family: var(--font); font-size: 17px; line-height: 1.5; }
      [data-md~="wordmark"] { font-weight: 800; font-size: 22px; letter-spacing: -0.02em; }
      [data-md~="place"] { color: var(--muted); font-size: 15px; }
      [data-md~="h1"] { font-size: clamp(38px, 6vw, 58px); line-height: 1.02; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 16px; max-width: 12ch; font-variation-settings: "opsz" 96; }
      @media (max-width: 720px) { [data-md~="h1"] { max-width: none; } }
      [data-md~="lead"] { font-size: 19px; margin: 0 0 12px; max-width: 34ch; }
      [data-md~="terms"] { color: var(--muted); font-size: 15px; margin: 0; }
      [data-md~="cap"] { color: var(--muted); font-size: 14px; margin: 8px 4px 0; min-height: 1.5em; }
      [data-md~="cap"].center { text-align: center; }
      [data-md~="h2"] { font-size: 24px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 14px; }
      [data-md~="h3"] { font-size: 17px; font-weight: 700; margin: 18px 0 8px; }
      [data-md~="kit"] { position: relative; border: 2px solid var(--fog-deep); border-radius: var(--radius); background: var(--surface); padding: 14px 16px; cursor: pointer; display: grid; grid-template-columns: 44px 1fr auto; gap: 12px; align-items: center; transition: border-color var(--t), background var(--t); }
      [data-md~="kit"] input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
      [data-md~="kit"][data-state~="on"] { border-color: var(--ink); background: var(--fog); }
      [data-md~="kit"]:has(input:focus-visible) { outline: 3px solid var(--amber); outline-offset: 3px; }
      [data-md~="kit-name"] { font-weight: 700; font-size: 19px; }
      [data-md~="kit-line"] { color: var(--muted); font-size: 15px; }
      [data-md~="save"] { color: var(--ok); font-weight: 600; }
      [data-md~="kit-price"] { font-weight: 800; font-size: 22px; white-space: nowrap; }
      [data-md~="compare"] { margin-top: 18px; background: var(--fog); border-radius: var(--radius); padding: 14px 16px; }
      [data-md~="compare"] [data-md~="h3"] { margin: 0 0 8px; font-size: 16px; }
      [data-md~="bar-row"] { display: grid; grid-template-columns: 10ch 1fr auto; align-items: center; gap: 10px; font-size: 15px; margin: 6px 0; }
      [data-md~="bar-row"] b { font-weight: 700; }
      [data-md~="bar"] { height: 14px; border-radius: 7px; background: var(--fog-deep); overflow: hidden; }
      [data-md~="bar-fill"] { display: block; height: 100%; background: var(--granite); border-radius: 7px; width: 0; transition: width .4s ease; }
      [data-md~="bar-fill"].us { background: var(--amber); }
      [data-md~="foot"] { color: var(--muted); font-size: 14px; margin: 8px 0 0; }
      [data-md~="item"] { background: var(--fog); border-radius: 12px; padding: 10px 8px 8px; text-align: center; font-size: 13px; line-height: 1.25; color: var(--ink); }
      [data-md~="item"] md-icon { display: block; margin: 0 auto 6px; }
      [data-md~="item"].winter { background: var(--amber-tint); }
      button[data-md~="item"] { border: 2px solid transparent; cursor: pointer; width: 100%; transition: border-color var(--t), background var(--t); }
      button[data-md~="item"][data-state~="on"] { border-color: var(--ink); background: var(--surface); }
      button[data-md~="item"]:focus-visible { outline: 3px solid var(--amber); outline-offset: 2px; }
      [data-md~="item-price"] { display: block; color: var(--muted); font-size: 12px; margin-top: 3px; }
      [data-state~="on"] > [data-md~="item-price"] { color: var(--ink); font-weight: 700; }
      [data-md~="nudge"] { display: none; margin-top: 12px; padding: 12px 14px; background: var(--amber-tint); border-radius: 12px; font-size: 15px; align-items: center; gap: 12px; justify-content: space-between; flex-wrap: wrap; }
      [data-md~="nudge"][data-state~="show"] { display: flex; }
      [data-md~="err-msg"] { display: none; color: var(--err); font-size: 15px; margin-top: 8px; }
      [data-md~="err-msg"][data-state~="show"] { display: block; }
      [data-md~="addon"] { display: grid; grid-template-columns: 34px 1fr auto; gap: 12px; align-items: center; padding: 10px 12px; border: 2px solid var(--fog-deep); border-radius: 12px; transition: border-color var(--t); }
      [data-md~="addon"][data-state~="on"] { border-color: var(--ink); }
      [data-md~="addon-name"] { font-weight: 600; }
      [data-md~="addon-price"] { color: var(--muted); font-size: 15px; }
      [data-md~="stepper"] { display: inline-flex; align-items: center; border: 2px solid var(--fog-deep); border-radius: 999px; }
      [data-md~="stepper-btn"] { width: 36px; height: 34px; border: 0; background: transparent; font-size: 20px; font-weight: 700; cursor: pointer; color: var(--ink); border-radius: 999px; }
      [data-md~="stepper-btn"]:focus-visible { outline: 3px solid var(--amber); }
      [data-md~="stepper-out"] { min-width: 22px; text-align: center; font-weight: 700; }
      [data-md~="storage"] { margin-top: 12px; border-radius: var(--radius); background: var(--fog); padding: 14px 16px; display: flex; gap: 12px; align-items: flex-start; }
      [data-md~="checkbox"] { width: 22px; height: 22px; margin: 3px 0 0; accent-color: var(--ink); flex: none; }
      [data-md~="storage"] label { cursor: pointer; }
      [data-md~="storage-name"] { font-weight: 700; }
      [data-md~="storage-line"] { color: var(--muted); font-size: 15px; }
      [data-md~="chips"] { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
      [data-md~="chip"] { position: relative; }
      [data-md~="chip"] input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
      [data-md~="chip"] span { display: inline-block; padding: 10px 16px; border-radius: 999px; border: 2px solid var(--fog-deep); font-weight: 600; font-size: 16px; cursor: pointer; transition: background var(--t), color var(--t); }
      [data-md~="chip"][data-state~="on"] span { background: var(--ink); color: var(--bg); border-color: var(--ink); }
      [data-md~="chip"]:has(input:focus-visible) span { outline: 3px solid var(--amber); outline-offset: 2px; }
      [data-md~="field"] { margin-bottom: 16px; }
      [data-md~="label"] { display: block; font-weight: 600; font-size: 16px; margin-bottom: 6px; }
      [data-md~="label"] small { font-weight: 400; color: var(--muted); }
      [data-md~="input"] { width: 100%; font: inherit; font-size: 17px; color: var(--ink); border: 2px solid var(--fog-deep); border-radius: var(--radius-sm); padding: 12px 14px; background: var(--surface); }
      textarea[data-md~="input"] { min-height: 84px; resize: vertical; }
      [data-md~="input"]:focus-visible { outline: 3px solid var(--amber); outline-offset: 1px; border-color: var(--ink); }
      [data-md~="error"] { color: var(--err); font-size: 15px; margin-top: 6px; display: none; }
      [data-md~="field"][data-state~="bad"] [data-md~="input"] { border-color: var(--err); }
      [data-md~="field"][data-state~="bad"] [data-md~="error"] { display: block; }
      [data-md~="note"] { font-size: 15px; margin-top: 6px; min-height: 1.5em; }
      [data-md~="note"].ok { color: var(--ok); font-weight: 600; }
      [data-md~="note"].no { color: var(--muted); }
      [data-md~="info"] { margin-top: 8px; padding: 10px 14px; background: var(--amber-tint); border-radius: 10px; font-size: 15px; display: none; }
      [data-md~="info"][data-state~="show"] { display: block; }
      [data-md~="step"] { background: var(--fog); border-radius: var(--radius); padding: 16px; }
      [data-md~="step"] md-icon { display: block; margin-bottom: 8px; }
      [data-md~="step-title"] { display: block; margin-bottom: 4px; font-weight: 700; }
      [data-md~="step-text"] { margin: 0; font-size: 15px; color: var(--granite); }
      [data-md~="faq-item"] { border-top: 2px solid var(--fog); padding: 4px 0; }
      [data-md~="faq-item"]:last-child { border-bottom: 2px solid var(--fog); }
      [data-md~="faq-q"] { list-style: none; cursor: pointer; font-weight: 600; padding: 10px 0; padding-inline-end: 28px; position: relative; }
      [data-md~="faq-q"]::-webkit-details-marker { display: none; }
      [data-md~="faq-q"]::after { content: "+"; position: absolute; inset-inline-end: 4px; top: 8px; font-size: 22px; font-weight: 400; color: var(--muted); }
      [data-md~="faq-item"][open] [data-md~="faq-q"]::after { content: "–"; }
      [data-md~="faq-a"] { margin: 0 0 12px; color: var(--granite); font-size: 16px; }
      [data-md~="footer"] { color: var(--muted); font-size: 14px; padding: 30px 0 10px; }
      [data-md~="sticky"] { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; background: var(--surface); border-top: 2px solid var(--fog); padding: 12px 20px calc(12px + env(safe-area-inset-bottom)); }
      [data-md~="sticky"] .inner { max-width: var(--maxw); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
      [data-md~="total"] { line-height: 1.2; }
      [data-md~="total"] b { font-size: 22px; font-weight: 800; display: block; }
      [data-md~="total-sub"] { color: var(--muted); font-size: 14px; }
      [data-md~="total-sub"] em { color: var(--ok); font-style: normal; font-weight: 600; }
      [data-md~="btn"] { font-weight: 600; font-size: 15px; color: var(--ink); background: var(--fog); border: 0; border-radius: 999px; padding: 10px 16px; cursor: pointer; text-decoration: none; display: inline-block; }
      [data-md~="btn"]:hover { background: var(--fog-deep); }
      [data-md~="btn"]:focus-visible { outline: 3px solid var(--amber); }
      [data-md~="btn"].primary { font-weight: 700; font-size: 17px; color: #1B2430; background: var(--amber); padding: 14px 24px; white-space: nowrap; }
      [data-md~="btn"].primary:hover { background: var(--amber-deep); }
      [data-md~="btn"].primary:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
      [data-md~="btn"][disabled] { opacity: .6; cursor: default; }
      [data-md~="done"] { display: none; padding: 36px 0; max-width: 620px; }
      [data-md~="done"] [data-md~="h2"] { font-size: 32px; letter-spacing: -0.02em; }
      [data-md~="ref-badge"] { font-weight: 800; font-size: 24px; background: var(--fog); border-radius: 10px; padding: 12px 16px; display: inline-block; margin: 8px 0 18px; }
      [data-md~="summary"] { margin: 0 0 20px; display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; font-size: 16px; }
      [data-md~="summary"] dt { color: var(--muted); }
      [data-md~="summary"] dd { margin: 0; }
      [data-md~="link"] { color: var(--ink); font-weight: 600; }
      [data-md~="share"] { background: var(--amber-tint); border-radius: var(--radius); padding: 16px; margin: 18px 0; }
      [data-md~="share"] b { display: block; margin-bottom: 6px; }
      [data-md~="share"] .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
      [data-md~="code"] { font-family: inherit; font-weight: 800; font-size: 18px; background: var(--surface); padding: 6px 10px; border-radius: 8px; }
      [data-md~="pay"] { background: var(--fog); border-radius: var(--radius); padding: 16px; margin: 18px 0; }
      [data-md~="pay"] b { display: block; margin-bottom: 8px; }
      .md-chat, .md-share { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; color: var(--ink); background: var(--fog); border-radius: 999px; padding: 10px 16px; text-decoration: none; }
      .md-chat svg, .md-share svg { width: 18px; height: 18px; }
      html.submitted form, html.submitted [data-md~="sticky"], html.submitted .md-hero, html.submitted .after-form { display: none; }
      html.submitted [data-md~="done"] { display: block; }
      html.submitted .md-main { padding-bottom: 20px; }
      /* icon declarations for this skin */
      :root { --icon-style: line; }
      .md-steps { --icon-style: 3d; --icon-box: "3d-dpd-style"; --icon-fill: var(--amber); }
    `,
  };

  // -------------------------------------------------------------- tailwind
  SKINS.tailwind = {
    id: "tailwind", label: "Tailwind CSS",
    assets: {
      css: [],
      js: ["https://cdn.tailwindcss.com"],
      afterJs: () => { if (window.tailwind) window.tailwind.config = { darkMode: ["selector", '[data-mode="dark"]'], corePlugins: { preflight: true } }; },
    },
    mode: () => {},
    icons: "flat",
    map: {
      wordmark: "text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white",
      place: "text-sm text-slate-500 dark:text-slate-400",
      h1: "text-4xl md:text-6xl font-extrabold tracking-tight leading-none text-slate-900 dark:text-white mb-4",
      lead: "text-lg text-slate-700 dark:text-slate-300 mb-3 max-w-prose",
      terms: "text-sm text-slate-500 dark:text-slate-400",
      cap: "text-sm text-slate-500 dark:text-slate-400 mt-2 min-h-[1.5em]",
      h2: "text-2xl font-bold text-slate-900 dark:text-white mb-3",
      h3: "text-base font-bold text-slate-900 dark:text-white mt-4 mb-2",
      kit: "relative grid grid-cols-[44px_1fr_auto] gap-3 items-center p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer transition [&>input]:absolute [&>input]:inset-0 [&>input]:opacity-0 [&>input]:cursor-pointer",
      "kit.on": "relative grid grid-cols-[44px_1fr_auto] gap-3 items-center p-4 rounded-2xl border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-950 cursor-pointer transition [&>input]:absolute [&>input]:inset-0 [&>input]:opacity-0 [&>input]:cursor-pointer",
      "kit-name": "font-bold text-lg text-slate-900 dark:text-white",
      "kit-line": "text-sm text-slate-500 dark:text-slate-400",
      save: "text-emerald-600 dark:text-emerald-400 font-semibold",
      "kit-price": "font-extrabold text-xl whitespace-nowrap text-slate-900 dark:text-white",
      compare: "mt-4 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800",
      "bar-row": "grid grid-cols-[10ch_1fr_auto] items-center gap-2 text-sm my-1 text-slate-700 dark:text-slate-300",
      bar: "h-3 rounded-full bg-slate-300 dark:bg-slate-600 overflow-hidden",
      "bar-fill": "block h-full rounded-full bg-slate-600 dark:bg-slate-300 transition-all duration-500 [&.us]:bg-indigo-500",
      foot: "text-xs text-slate-500 dark:text-slate-400 mt-2",
      item: "rounded-xl bg-slate-100 dark:bg-slate-800 p-2 text-center text-xs leading-tight text-slate-800 dark:text-slate-200 border-2 border-transparent [&.winter]:bg-amber-50 dark:[&.winter]:bg-amber-950 [&>md-icon]:block [&>md-icon]:mx-auto [&>md-icon]:mb-1",
      "item.on": "rounded-xl bg-white dark:bg-slate-900 p-2 text-center text-xs leading-tight text-slate-900 dark:text-white border-2 border-indigo-500 [&>md-icon]:block [&>md-icon]:mx-auto [&>md-icon]:mb-1",
      "item-price": "block text-slate-500 dark:text-slate-400 text-[11px] mt-1",
      nudge: "hidden mt-3 p-3 rounded-xl bg-amber-100 dark:bg-amber-950 text-sm items-center justify-between gap-3 flex-wrap text-slate-900 dark:text-amber-100",
      "nudge.show": "flex mt-3 p-3 rounded-xl bg-amber-100 dark:bg-amber-950 text-sm items-center justify-between gap-3 flex-wrap text-slate-900 dark:text-amber-100",
      "err-msg": "hidden text-red-600 dark:text-red-400 text-sm mt-2",
      "err-msg.show": "block text-red-600 dark:text-red-400 text-sm mt-2",
      addon: "grid grid-cols-[34px_1fr_auto] gap-3 items-center p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700",
      "addon.on": "grid grid-cols-[34px_1fr_auto] gap-3 items-center p-3 rounded-xl border-2 border-indigo-500",
      "addon-name": "font-semibold text-slate-900 dark:text-white",
      "addon-price": "text-sm text-slate-500 dark:text-slate-400",
      stepper: "inline-flex items-center rounded-full border-2 border-slate-200 dark:border-slate-700",
      "stepper-btn": "w-9 h-8 rounded-full text-xl font-bold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800",
      "stepper-out": "min-w-[22px] text-center font-bold text-slate-900 dark:text-white",
      storage: "mt-3 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex gap-3 items-start",
      checkbox: "w-5 h-5 mt-1 accent-indigo-500 shrink-0",
      "storage-name": "font-bold text-slate-900 dark:text-white",
      "storage-line": "text-sm text-slate-500 dark:text-slate-400",
      chips: "flex flex-wrap gap-2 mb-3",
      chip: "relative [&>input]:absolute [&>input]:inset-0 [&>input]:opacity-0 [&>input]:cursor-pointer [&>span]:inline-block [&>span]:px-4 [&>span]:py-2 [&>span]:rounded-full [&>span]:border-2 [&>span]:border-slate-200 dark:[&>span]:border-slate-700 [&>span]:font-semibold [&>span]:text-slate-900 dark:[&>span]:text-white",
      "chip.on": "relative [&>input]:absolute [&>input]:inset-0 [&>input]:opacity-0 [&>input]:cursor-pointer [&>span]:inline-block [&>span]:px-4 [&>span]:py-2 [&>span]:rounded-full [&>span]:border-2 [&>span]:border-indigo-500 [&>span]:bg-indigo-500 [&>span]:text-white [&>span]:font-semibold",
      field: "mb-4",
      label: "block font-semibold text-sm mb-1 text-slate-900 dark:text-white [&>small]:font-normal [&>small]:text-slate-500",
      input: "w-full rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900",
      error: "hidden text-red-600 dark:text-red-400 text-sm mt-1",
      note: "text-sm mt-1 min-h-[1.5em] [&.ok]:text-emerald-600 [&.no]:text-slate-500",
      info: "hidden mt-2 p-3 rounded-xl bg-amber-100 dark:bg-amber-950 text-sm text-slate-900 dark:text-amber-100",
      "info.show": "block mt-2 p-3 rounded-xl bg-amber-100 dark:bg-amber-950 text-sm text-slate-900 dark:text-amber-100",
      step: "rounded-2xl bg-slate-100 dark:bg-slate-800 p-4 [&>md-icon]:block [&>md-icon]:mb-2",
      "step-title": "block font-bold mb-1 text-slate-900 dark:text-white",
      "step-text": "text-sm text-slate-600 dark:text-slate-300",
      "faq-item": "border-t-2 border-slate-100 dark:border-slate-800 last:border-b-2 py-1",
      "faq-q": "cursor-pointer font-semibold py-2 text-slate-900 dark:text-white list-none marker:hidden",
      "faq-a": "mb-3 text-slate-600 dark:text-slate-300",
      footer: "text-sm text-slate-500 dark:text-slate-400 py-8",
      sticky: "fixed inset-x-0 bottom-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t-2 border-slate-100 dark:border-slate-800 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] [&>.inner]:max-w-[960px] [&>.inner]:mx-auto [&>.inner]:flex [&>.inner]:items-center [&>.inner]:justify-between [&>.inner]:gap-3",
      total: "leading-tight text-slate-900 dark:text-white [&>b]:block [&>b]:text-2xl [&>b]:font-extrabold",
      "total-sub": "text-xs text-slate-500 dark:text-slate-400 [&>em]:not-italic [&>em]:font-semibold [&>em]:text-emerald-600",
      btn: "inline-block rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm px-4 py-2 hover:bg-slate-200 dark:hover:bg-slate-700 no-underline",
      "btn.primary": "inline-block rounded-full bg-indigo-600 text-white font-bold px-6 py-3.5 hover:bg-indigo-700 whitespace-nowrap disabled:opacity-60",
      done: "hidden py-9 max-w-[620px]",
      "ref-badge": "inline-block font-extrabold text-2xl bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 my-2 mb-4 text-slate-900 dark:text-white",
      summary: "grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 mb-5 [&>dt]:text-slate-500 [&>dd]:m-0",
      link: "font-semibold underline text-indigo-600 dark:text-indigo-400",
      share: "rounded-2xl bg-amber-100 dark:bg-amber-950 p-4 my-4 text-slate-900 dark:text-amber-50 [&>b]:block [&>b]:mb-1 [&>.row]:flex [&>.row]:flex-wrap [&>.row]:gap-2 [&>.row]:items-center [&>.row]:mt-2",
      pay: "rounded-2xl bg-slate-100 dark:bg-slate-800 p-4 my-4 [&>b]:block [&>b]:mb-2 text-slate-900 dark:text-white",
      code: "font-extrabold text-lg bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5",
    },
    style: `
      body { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 16px; line-height: 1.5; background: #fff; color: #0f172a; }
      html[data-mode="dark"] body { background: #0f172a; color: #f1f5f9; }
      [data-md~="faq-q"]::-webkit-details-marker { display: none; }
      [data-md~="field"][data-state~="bad"] [data-md~="input"] { border-color: #dc2626; }
      [data-md~="field"][data-state~="bad"] [data-md~="error"] { display: block; }
      .md-chat, .md-share { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; color: inherit; background: rgba(148,163,184,.2); border-radius: 999px; padding: 10px 16px; text-decoration: none; }
      .md-chat svg, .md-share svg { width: 18px; height: 18px; }
      html.submitted form, html.submitted [data-md~="sticky"], html.submitted .md-hero, html.submitted .after-form { display: none; }
      html.submitted [data-md~="done"] { display: block; }
      :root { --icon-style: flat; --icon-fill: #6366f1; --icon-fill-2: #e0e7ff; --icon-stroke: #1e1b4b; }
      html[data-mode="dark"] { --icon-fill-2: #312e81; --icon-stroke: #c7d2fe; }
    `,
  };

  // ------------------------------------------------------------- bootstrap
  SKINS.bootstrap = {
    id: "bootstrap", label: "Bootstrap 5",
    assets: { css: ["https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"], js: [] },
    mode: m => document.documentElement.setAttribute("data-bs-theme", m),
    icons: "3d",
    map: {
      wordmark: "fs-4 fw-bolder", place: "text-body-secondary small",
      h1: "display-4 fw-bold lh-1 mb-3", lead: "lead mb-2", terms: "text-body-secondary small mb-0", cap: "text-body-secondary small mt-2",
      h2: "h3 fw-bold mb-3", h3: "h6 fw-bold mt-4 mb-2",
      kit: "card p-3 position-relative flex-row align-items-center gap-3 shadow-sm", "kit.on": "card p-3 position-relative flex-row align-items-center gap-3 border-primary bg-primary-subtle",
      "kit-name": "fw-bold fs-5", "kit-line": "text-body-secondary small", save: "text-success fw-semibold", "kit-price": "fw-bolder fs-4 text-nowrap ms-auto",
      compare: "card card-body bg-body-tertiary border-0 mt-3", "bar-row": "small", bar: "progress", "bar-fill": "progress-bar bg-secondary", foot: "text-body-secondary small mt-2 mb-0",
      item: "card card-body p-2 text-center small border-0 bg-body-tertiary", "item.on": "card card-body p-2 text-center small border-primary bg-primary-subtle", "item-price": "d-block text-body-secondary",
      nudge: "alert alert-warning d-none mt-3 mb-0 py-2 align-items-center justify-content-between flex-wrap gap-2", "nudge.show": "alert alert-warning d-flex mt-3 mb-0 py-2 align-items-center justify-content-between flex-wrap gap-2",
      "err-msg": "text-danger small mt-2 d-none", "err-msg.show": "text-danger small mt-2 d-block",
      addon: "card p-2 flex-row align-items-center gap-3", "addon.on": "card p-2 flex-row align-items-center gap-3 border-primary",
      "addon-name": "fw-semibold", "addon-price": "text-body-secondary small",
      stepper: "btn-group btn-group-sm ms-auto", "stepper-btn": "btn btn-outline-secondary", "stepper-out": "btn btn-outline-secondary disabled fw-bold px-2",
      storage: "card card-body bg-body-tertiary border-0 mt-3 flex-row gap-3 align-items-start", checkbox: "form-check-input flex-shrink-0 mt-1", "storage-name": "fw-bold", "storage-line": "text-body-secondary small",
      chips: "d-flex flex-wrap gap-2 mb-3", chip: "position-relative", "chip.on": "position-relative on",
      field: "mb-3", label: "form-label fw-semibold", input: "form-control form-control-lg", error: "invalid-feedback", note: "form-text",
      info: "alert alert-warning py-2 small mt-2 mb-0 d-none", "info.show": "alert alert-warning py-2 small mt-2 mb-0 d-block",
      step: "card card-body bg-body-tertiary border-0", "step-title": "fw-bold d-block mb-1", "step-text": "small mb-0",
      "faq-item": "border-top py-1", "faq-q": "fw-semibold py-2", "faq-a": "text-body-secondary mb-3",
      footer: "text-body-secondary small py-4",
      sticky: "fixed-bottom bg-body border-top py-2 px-3", total: "lh-sm", "total-sub": "text-body-secondary small",
      btn: "btn btn-light rounded-pill fw-semibold", "btn.primary": "btn btn-primary btn-lg rounded-pill fw-bold text-nowrap",
      done: "py-5 d-none", "ref-badge": "badge text-bg-light fs-4 my-2 mb-4", summary: "row row-cols-1 mb-3", link: "link-primary fw-semibold",
      share: "alert alert-warning my-3", pay: "card card-body bg-body-tertiary border-0 my-3", code: "fw-bolder fs-5 bg-body px-2 py-1 rounded",
    },
    style: `
      [data-md~="kit"] input, [data-md~="chip"] input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; z-index: 1; }
      [data-md~="kit"] { cursor: pointer; }
      [data-md~="kit"] md-icon { flex: none; }
      [data-md~="bar-row"] { display: grid; grid-template-columns: 10ch 1fr auto; align-items: center; gap: 10px; margin: 6px 0; }
      [data-md~="bar"] { height: 14px; }
      [data-md~="bar-fill"] { width: 0; transition: width .4s ease; }
      [data-md~="bar-fill"].us { background-color: var(--bs-primary) !important; }
      [data-md~="item"] md-icon { display: block; margin: 0 auto 6px; }
      [data-md~="item"].winter { background: var(--bs-warning-bg-subtle) !important; }
      button[data-md~="item"] { cursor: pointer; }
      [data-md~="chip"] span { display: inline-block; padding: 8px 16px; border-radius: 999px; border: 2px solid var(--bs-border-color); font-weight: 600; }
      [data-md~="chip"].on span { background: var(--bs-primary); color: #fff; border-color: var(--bs-primary); }
      [data-md~="stepper-out"] { opacity: 1; }
      [data-md~="field"][data-state~="bad"] [data-md~="input"] { border-color: var(--bs-danger); }
      [data-md~="field"][data-state~="bad"] [data-md~="error"] { display: block; }
      [data-md~="note"].ok { color: var(--bs-success); font-weight: 600; }
      [data-md~="faq-item"]:last-child { border-bottom: var(--bs-border-width) solid var(--bs-border-color); }
      [data-md~="faq-q"] { cursor: pointer; list-style: none; }
      [data-md~="faq-q"]::-webkit-details-marker { display: none; }
      [data-md~="sticky"] .inner { max-width: var(--maxw); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
      [data-md~="total"] b { font-size: 22px; font-weight: 800; display: block; }
      [data-md~="total-sub"] em { color: var(--bs-success); font-style: normal; font-weight: 600; }
      [data-md~="step"] md-icon { display: block; margin-bottom: 8px; }
      [data-md~="summary"] { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; }
      [data-md~="summary"] dt { color: var(--bs-secondary-color); font-weight: 400; }
      [data-md~="summary"] dd { margin: 0; }
      [data-md~="share"] .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 10px 0 0; }
      [data-md~="share"] b, [data-md~="pay"] b { display: block; margin-bottom: 6px; }
      .md-chat, .md-share { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; color: var(--bs-body-color); background: var(--bs-tertiary-bg); border-radius: 999px; padding: 8px 16px; text-decoration: none; }
      .md-chat svg, .md-share svg { width: 18px; height: 18px; }
      html.submitted form, html.submitted [data-md~="sticky"], html.submitted .md-hero, html.submitted .after-form { display: none; }
      html.submitted [data-md~="done"] { display: block !important; }
      :root { --icon-style: 3d; --icon-fill: #0d6efd; --icon-fill-2: #cfe2ff; --icon-depth: #052c65; --icon-stroke: #052c65; }
      html[data-mode="dark"] { --icon-stroke: #cfe2ff; }
    `,
  };

  // ----------------------------------------------------------------- bulma
  SKINS.bulma = {
    id: "bulma", label: "Bulma",
    assets: { css: ["https://cdn.jsdelivr.net/npm/bulma@1.0.2/css/bulma.min.css"], js: [] },
    mode: m => document.documentElement.setAttribute("data-theme", m),
    icons: "3d-dpd",
    map: {
      wordmark: "title is-4 mb-0", place: "has-text-grey is-size-7",
      h1: "title is-1 mb-4", lead: "subtitle is-5 mb-3", terms: "has-text-grey is-size-6 mb-0", cap: "has-text-grey is-size-7 mt-2",
      h2: "title is-4 mb-3", h3: "title is-6 mt-4 mb-2",
      kit: "box p-4 is-clickable", "kit.on": "box p-4 is-clickable has-background-primary-light on",
      "kit-name": "has-text-weight-bold is-size-5", "kit-line": "has-text-grey is-size-6", save: "has-text-success has-text-weight-semibold", "kit-price": "has-text-weight-bold is-size-4",
      compare: "box has-background-light mt-4", "bar-row": "is-size-6", bar: "bar", "bar-fill": "bar-fill", foot: "has-text-grey is-size-7 mt-2",
      item: "box p-2 has-background-light has-text-centered is-size-7 is-shadowless", "item.on": "box p-2 has-text-centered is-size-7 on", "item-price": "is-block has-text-grey",
      nudge: "notification is-warning is-light mt-3 p-3 is-hidden", "nudge.show": "notification is-warning is-light mt-3 p-3 is-flex is-align-items-center is-justify-content-space-between is-flex-wrap-wrap",
      "err-msg": "help is-danger is-size-6 is-hidden", "err-msg.show": "help is-danger is-size-6",
      addon: "box p-3 is-shadowless", "addon.on": "box p-3 is-shadowless on",
      "addon-name": "has-text-weight-semibold", "addon-price": "has-text-grey is-size-6",
      stepper: "buttons has-addons mb-0", "stepper-btn": "button is-small mb-0", "stepper-out": "button is-small is-static mb-0 has-text-weight-bold",
      storage: "box has-background-light is-shadowless mt-3", checkbox: "checkbox", "storage-name": "has-text-weight-bold", "storage-line": "has-text-grey is-size-6",
      chips: "tags are-medium mb-3", chip: "tag is-medium is-rounded is-clickable", "chip.on": "tag is-medium is-rounded is-primary is-clickable",
      field: "field", label: "label", input: "input is-medium", error: "help is-danger", note: "help",
      info: "notification is-warning is-light p-3 mt-2 is-hidden", "info.show": "notification is-warning is-light p-3 mt-2",
      step: "box has-background-light is-shadowless", "step-title": "has-text-weight-bold is-block mb-1", "step-text": "is-size-6",
      "faq-item": "faq", "faq-q": "has-text-weight-semibold py-2 is-clickable", "faq-a": "has-text-grey mb-3",
      footer: "has-text-grey is-size-7 py-5",
      sticky: "sticky", total: "", "total-sub": "has-text-grey is-size-7",
      btn: "button is-light is-rounded has-text-weight-semibold", "btn.primary": "button is-primary is-medium is-rounded has-text-weight-bold",
      done: "py-6 is-hidden", "ref-badge": "tag is-large is-light has-text-weight-bold my-2 mb-4", summary: "summary", link: "has-text-weight-semibold",
      share: "notification is-warning is-light my-4", pay: "box has-background-light is-shadowless my-4", code: "tag is-medium has-text-weight-bold",
    },
    style: `
      [data-md~="kit"] { position: relative; display: grid; grid-template-columns: 44px 1fr auto; gap: 12px; align-items: center; border: 2px solid var(--bulma-border); }
      [data-md~="kit"].on { border-color: var(--bulma-primary); }
      [data-md~="kit"] input, [data-md~="chip"] input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
      [data-md~="chip"] { position: relative; }
      [data-md~="bar-row"] { display: grid; grid-template-columns: 10ch 1fr auto; align-items: center; gap: 10px; margin: 6px 0; }
      [data-md~="bar"] { height: 14px; border-radius: 7px; background: var(--bulma-border); overflow: hidden; }
      [data-md~="bar-fill"] { display: block; height: 100%; background: var(--bulma-text); width: 0; transition: width .4s ease; }
      [data-md~="bar-fill"].us { background: var(--bulma-primary); }
      [data-md~="item"] md-icon { display: block; margin: 0 auto 6px; }
      [data-md~="item"].winter { background: var(--bulma-warning-light) !important; }
      button[data-md~="item"] { border: 2px solid transparent; cursor: pointer; width: 100%; color: inherit; }
      button[data-md~="item"].on { border-color: var(--bulma-primary); }
      [data-md~="addon"] { display: grid; grid-template-columns: 34px 1fr auto; gap: 12px; align-items: center; border: 2px solid var(--bulma-border); }
      [data-md~="addon"].on { border-color: var(--bulma-primary); }
      [data-md~="storage"] { display: flex; gap: 12px; align-items: flex-start; }
      [data-md~="checkbox"] { width: 22px; height: 22px; margin-top: 3px; flex: none; }
      [data-md~="field"][data-state~="bad"] [data-md~="input"] { border-color: var(--bulma-danger); }
      [data-md~="error"] { display: none; }
      [data-md~="field"][data-state~="bad"] [data-md~="error"] { display: block; }
      [data-md~="note"].ok { color: var(--bulma-success); font-weight: 600; }
      [data-md~="faq-item"] { border-top: 2px solid var(--bulma-border); padding: 4px 0; }
      [data-md~="faq-item"]:last-child { border-bottom: 2px solid var(--bulma-border); }
      [data-md~="faq-q"] { list-style: none; }
      [data-md~="faq-q"]::-webkit-details-marker { display: none; }
      [data-md~="sticky"] { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; background: var(--bulma-scheme-main); border-top: 2px solid var(--bulma-border); padding: 12px 20px calc(12px + env(safe-area-inset-bottom)); }
      [data-md~="sticky"] .inner { max-width: var(--maxw); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
      [data-md~="total"] b { font-size: 22px; font-weight: 800; display: block; }
      [data-md~="total-sub"] em { color: var(--bulma-success); font-style: normal; font-weight: 600; }
      [data-md~="step"] md-icon { display: block; margin-bottom: 8px; }
      [data-md~="summary"] { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin-bottom: 20px; }
      [data-md~="summary"] dt { color: var(--bulma-text-weak); }
      [data-md~="summary"] dd { margin: 0; }
      [data-md~="share"] .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
      [data-md~="share"] b, [data-md~="pay"] b { display: block; margin-bottom: 6px; }
      .md-chat, .md-share { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; color: var(--bulma-text); background: var(--bulma-background); border-radius: 999px; padding: 8px 16px; text-decoration: none; }
      .md-chat svg, .md-share svg { width: 18px; height: 18px; }
      html.submitted form, html.submitted [data-md~="sticky"], html.submitted .md-hero, html.submitted .after-form { display: none; }
      html.submitted [data-md~="done"] { display: block !important; }
      :root { --icon-style: 3d-dpd; }
    `,
  };

  MD.skins = { SKINS, list: () => Object.values(SKINS).map(s => ({ id: s.id, label: s.label })), register: s => { SKINS[s.id] = s; } };
})(window.MD = window.MD || {});
