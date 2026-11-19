// Stilurile scenei ASCUNSELEA — toate sub .hsx, ca să nu atingă restul aplicației.
export const HS_CSS = `
.hsx { --void:#07060f; --ink:#f4f1ff; --muted:#9b94b8; --pink:#ff3d8b; --mint:#1fe3c2; --gold:#ffd23f; --red:#ff2448; --vestA:#1fd46a; --vestB:#3d7bff;
  --hud:"Chakra Petch","Arial Narrow",system-ui,sans-serif; --txt:"Inter",system-ui,sans-serif;
  position:fixed; inset:0; z-index:9999; background:var(--void); color:var(--ink); font-family:var(--txt); display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
  padding:max(8px,env(safe-area-inset-top,0px)) max(8px,env(safe-area-inset-right,0px)) max(8px,env(safe-area-inset-bottom,0px)) max(8px,env(safe-area-inset-left,0px)); box-sizing:border-box; overflow:hidden; -webkit-tap-highlight-color:transparent; user-select:none; }
.hsx *, .hsx *::before, .hsx *::after { box-sizing:border-box; }
.hsx [hidden] { display:none !important; }
.hsx-top { width:min(100%,460px); display:flex; align-items:center; gap:8px; margin-bottom:6px; }
.hsx-top b { flex:1; min-width:0; font:700 13px/1.2 var(--hud); letter-spacing:.12em; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hsx button { font:700 12.5px/1 var(--hud); letter-spacing:.08em; color:var(--ink); background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.16); border-radius:999px; padding:10px 13px; cursor:pointer; touch-action:manipulation; }
.hsx button:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
.hsx button.go { background:var(--pink); border-color:var(--pink); color:#1a0410; }
.hsx button.alt { background:var(--mint); border-color:var(--mint); color:#03201a; }
.hsx button:disabled { opacity:.45; }
.hsx-stage { position:relative; width:min(100%,460px,calc((100dvh - 118px) * 9 / 16)); aspect-ratio:9/16; border-radius:18px; overflow:hidden; container-type:size; background:#0b0818; box-shadow:0 0 0 1px rgba(255,255,255,.08),0 30px 80px rgba(255,61,139,.15); flex:none; }
.hsx-ctrl { width:min(100%,460px); display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin-top:8px; }
.hsx-world { position:absolute; inset:0; }
.hsx canvas.bg { position:absolute; inset:0; width:100%; height:100%; display:block; }
.hsx-scene2d { position:absolute; inset:0; }
.hsx-ui { position:absolute; inset:0; pointer-events:none; z-index:20; }
.hsx-ui .tap { pointer-events:auto; }
.hsx .dark, .hsx .alarm, .hsx .hsx-scene2d, .hsx canvas.bg { pointer-events:none; }

/* ── 3D ── */
.hsx .s3d { position:absolute; inset:0; overflow:hidden; perspective-origin:50% 42%; }
.hsx .cam { position:absolute; left:50%; top:52%; width:0; height:0; transform-style:preserve-3d; }
.hsx .p3 { position:absolute; left:0; top:0; transform-origin:0 0; pointer-events:none; }
.hsx .g3 { position:absolute; left:0; top:0; width:0; height:0; transform-style:preserve-3d; pointer-events:none; }
.hsx .dwrap { pointer-events:auto; cursor:pointer; }
.hsx .bb { position:absolute; left:0; top:0; width:14em; height:27em; transform-origin:0 0; pointer-events:none; }
.hsx .bb > .ch { position:absolute; left:0; top:0; font-size:inherit; }
.hsx .exit3 { display:flex; align-items:center; justify-content:center; font-family:var(--hud); font-weight:700; letter-spacing:.14em; color:#ff6b6b; border:.25em solid #ff5a5a; border-radius:.3em; text-shadow:0 0 .3em #ff2448,0 0 .8em #ff2448; box-shadow:0 0 1em rgba(255,36,72,.6),inset 0 0 .6em rgba(255,36,72,.4); background:rgba(30,0,6,.75); animation:hs-neon 2.2s infinite; }
.hsx .beacon { border-radius:50%; background:radial-gradient(circle,#ff6b6b,#ff2448 45%,transparent 70%); animation:hs-beacon .5s infinite alternate; }
.hsx .liftcab { box-shadow:0 0 3em rgba(255,210,63,.6); }

/* ── Personaj: cap mare (avatar) pe corp în costumul de rol, cu vestă ── */
.hsx .ch { position:absolute; width:14em; height:27em; font-size:1cqw; transform-origin:50% 100%; z-index:8; }
.hsx .ch .sh { position:absolute; left:2em; right:2em; bottom:-1.2em; height:2.6em; border-radius:50%; background:radial-gradient(closest-side,rgba(0,0,0,.55),transparent); }
.hsx .ch .lg { position:absolute; top:18.4em; width:3.3em; height:7.6em; border-radius:1.5em 1.5em .6em .6em; background:var(--suitD); transform-origin:50% 0; border-bottom:1.5em solid #f2f2f2; }
.hsx .ch .lg.l { left:3.6em; } .hsx .ch .lg.r { right:3.6em; }
.hsx .ch .bd { position:absolute; top:10.2em; left:2.3em; width:9.4em; height:9.4em; border-radius:3.2em 3.2em 1.6em 1.6em; background:linear-gradient(180deg,var(--suit),var(--suitD)); box-shadow:inset 0 -1em 1.6em rgba(0,0,0,.25); }
.hsx .ch .vest { position:absolute; left:1.2em; right:1.2em; top:.9em; bottom:1.3em; border-radius:1.4em 1.4em .8em .8em; background:var(--vest,transparent); display:flex; align-items:center; justify-content:center; box-shadow:0 0 2.4em color-mix(in srgb,var(--vest,transparent) 60%,transparent); }
.hsx .ch .vest span { font:700 2.9em/1 var(--hud); color:#fff; text-shadow:0 .1em .2em rgba(0,0,0,.4); }
.hsx .ch .ar { position:absolute; top:11.2em; width:2.5em; height:7.4em; border-radius:1.3em; background:var(--suitD); transform-origin:50% 1em; }
.hsx .ch .ar::after { content:""; position:absolute; left:.3em; right:.3em; bottom:-.4em; height:1.9em; border-radius:50%; background:#f1c9a5; }
.hsx .ch .ar.l { left:.9em; transform:rotate(14deg); } .hsx .ch .ar.r { right:.9em; transform:rotate(-14deg); }
.hsx .ch .hd { position:absolute; top:0; left:1.2em; width:11.6em; height:11.6em; border-radius:50%; overflow:hidden; border:.55em solid var(--ring,rgba(255,255,255,.85)); background:#222; box-shadow:0 .6em 1.6em rgba(0,0,0,.45),0 0 3em color-mix(in srgb,var(--ring,#fff) 45%,transparent); }
.hsx .ch .hd img { width:100%; height:130%; object-fit:cover; object-position:50% 12%; display:block; }
.hsx .ch .nm { position:absolute; left:50%; top:-4em; transform:translateX(-50%); font:700 2.6em/1 var(--hud); letter-spacing:.1em; padding:.25em .5em; border-radius:.35em; background:rgba(6,5,14,.8); color:#fff; white-space:nowrap; opacity:0; transition:opacity .25s; }
.hsx .ch.named .nm { opacity:1; }
.hsx .ch .bub { position:absolute; left:50%; top:-8.5em; transform:translateX(-50%) scale(0); transform-origin:50% 100%; font:800 3em/1.1 var(--txt); padding:.35em .6em; border-radius:.7em; background:#fff; color:#14101f; white-space:nowrap; transition:transform .18s cubic-bezier(.3,1.6,.5,1); box-shadow:0 .3em 1em rgba(0,0,0,.35); }
.hsx .ch .bub::after { content:""; position:absolute; left:50%; bottom:-.45em; margin-left:-.4em; border:.45em solid transparent; border-top-color:#fff; border-bottom:0; }
.hsx .ch .bub.on { transform:translateX(-50%) scale(1); }
.hsx .ch .mark { position:absolute; left:50%; top:-10em; transform:translateX(-50%); font:700 9em/1 var(--hud); color:#ff2448; text-shadow:0 0 .2em #ff2448; opacity:0; }
.hsx .ch.alert .mark { animation:hs-mark .6s ease-out forwards; }
.hsx .ch .sweat { position:absolute; inset:0; opacity:0; pointer-events:none; }
.hsx .ch .sweat i { position:absolute; width:1.6em; height:2.3em; border-radius:50% 50% 50% 50% / 60% 60% 40% 40%; background:linear-gradient(180deg,#bfe8ff,#4fb3ff); }
.hsx .ch.sweaty .sweat { opacity:1; } .hsx .ch.sweaty .sweat i { animation:hs-drop .7s ease-in infinite; }
.hsx .ch .sweat i:nth-child(1) { left:.4em; top:1.5em; } .hsx .ch .sweat i:nth-child(2) { right:.2em; top:3em; animation-delay:.25s !important; } .hsx .ch .sweat i:nth-child(3) { right:1.6em; top:-.6em; animation-delay:.5s !important; }
.hsx .ch.run .lg.l, .hsx .ch.run .ar.r { animation:hs-swA .26s ease-in-out infinite alternate; }
.hsx .ch.run .lg.r, .hsx .ch.run .ar.l { animation:hs-swB .26s ease-in-out infinite alternate; }
.hsx .ch.run .inner { animation:hs-bob .13s ease-in-out infinite alternate; }
.hsx .ch.sneak .inner { transform:translateY(1.6em) scaleY(.93); }
.hsx .ch.cheer .ar.l { transform:rotate(160deg); } .hsx .ch.cheer .ar.r { transform:rotate(-160deg); }
.hsx .ch.cheer .inner { animation:hs-hop .4s ease-in-out infinite alternate; }
.hsx .ch.dance .inner { animation:hs-dance .5s ease-in-out infinite alternate; } .hsx .ch.dance .ar.l { animation:hs-swA .25s infinite alternate; } .hsx .ch.dance .ar.r { animation:hs-swB .25s infinite alternate; }
.hsx .ch.scared .ar.l { transform:rotate(150deg); } .hsx .ch.scared .ar.r { transform:rotate(-150deg); }
.hsx .ch.scared .inner { animation:hs-shiver .07s linear infinite alternate; }
.hsx .ch.sad .hd { transform:rotate(-12deg) translateY(.8em); } .hsx .ch.sad .inner { transform:translateY(1em); } .hsx .ch.sad .ar.l { transform:rotate(4deg); } .hsx .ch.sad .ar.r { transform:rotate(-4deg); }
.hsx .ch.eyes .hd::after { content:""; position:absolute; left:8%; right:8%; top:26%; height:22%; border-radius:1em; background:var(--suitD); box-shadow:0 0 0 .3em rgba(255,255,255,.2); }
.hsx .ch.eyes .ar.l { transform:rotate(150deg) translate(-1em,1em); } .hsx .ch.eyes .ar.r { transform:rotate(-150deg) translate(1em,1em); }
.hsx .ch.look .hd { animation:hs-look 1.2s ease-in-out infinite; }
.hsx .ch .inner { position:absolute; inset:0; }
.hsx .bb.top { transform-style:preserve-3d; } .hsx .bb.top > .ch { transform-origin:50% 100%; transform:rotateX(34deg); }
.hsx .door.small .plate { font-size:3.7em; top:-8.4em; } .hsx .door.small .sym { width:68%; }
.hsx .lift { position:absolute; inset:0; z-index:36; pointer-events:none; overflow:hidden; }
.hsx .lift > i { position:absolute; top:0; bottom:0; width:50.5%; background:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 14px),linear-gradient(90deg,#211b33,#4b4265 55%,#2b2440); box-shadow:inset 0 0 6cqw rgba(0,0,0,.6); transform:translateX(-100%); }
.hsx .lift > i:nth-child(2) { right:0; transform:translateX(100%); background:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 14px),linear-gradient(270deg,#211b33,#4b4265 55%,#2b2440); }
.hsx .lift > i:first-child { left:0; border-right:.5cqw solid #ffd23f; } .hsx .lift > i:nth-child(2) { border-left:.5cqw solid #ffd23f; }
.hsx .lift .lbl { position:absolute; left:0; right:0; top:38cqh; text-align:center; opacity:0; }
.hsx .lift .lbl .arrow { display:block; font:700 12cqw/1 var(--hud); color:var(--gold); text-shadow:0 0 5cqw var(--gold); }
.hsx .lift .lbl b { display:block; margin-top:1.6cqh; font:700 9cqw/1 var(--hud); color:#fff; text-shadow:0 0 4cqw var(--pink); }
.hsx .lift .lbl small { display:block; margin-top:1cqh; font:700 3.4cqw/1 var(--hud); letter-spacing:.3em; color:var(--muted); }
/* încărcare */
.hsx-load { position:fixed; inset:0; z-index:9998; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; background:radial-gradient(60% 40% at 50% 45%,rgba(255,61,139,.25),#07060f 70%); color:#f4f1ff; font:700 13px/1.4 "Chakra Petch",system-ui,sans-serif; letter-spacing:.24em; }
.hsx-load .s { display:flex; gap:18px; font-size:40px; color:#ff3d8b; text-shadow:0 0 18px #ff3d8b; }
.hsx-load .s span { animation:hs-load 1s ease-in-out infinite; } .hsx-load .s span:nth-child(2) { animation-delay:.15s; color:#1fe3c2; text-shadow:0 0 18px #1fe3c2; } .hsx-load .s span:nth-child(3) { animation-delay:.3s; color:#ffd23f; text-shadow:0 0 18px #ffd23f; }
@keyframes hs-load { 0%,100% { transform:translateY(0); opacity:.5; } 50% { transform:translateY(-12px); opacity:1; } }
/* întoarcere: ceafa când pleacă spre fund, aplecare stânga/dreapta */
.hsx .ch.back .hd img { opacity:0; }
.hsx .ch.back .hd { background:radial-gradient(circle at 50% 30%,#4a3426,#1d130d 72%); }
.hsx .ch.back[data-bald] .hd { background:radial-gradient(circle at 45% 30%,#f6d2b4,#d39f7d 72%); }
.hsx .ch.back .hd::before { content:""; position:absolute; left:20%; right:20%; bottom:4%; height:16%; border-radius:50%; background:rgba(0,0,0,.25); }
.hsx .ch.goL .hd { transform:translateX(-1.3em) rotate(-9deg); } .hsx .ch.goR .hd { transform:translateX(1.3em) rotate(9deg); }
.hsx .ch.goL .bd { transform:skewX(7deg); } .hsx .ch.goR .bd { transform:skewX(-7deg); }
.hsx .ch .hd { transition:transform .15s; }

/* ── Uși ── */
.hsx .door { position:absolute; left:0; top:0; width:24em; height:50em; }
.hsx .door .plate { position:absolute; top:-6em; left:50%; transform:translateX(-50%); font:700 2.5em/1 var(--hud); letter-spacing:.2em; color:var(--c); padding:.4em .8em; border:.12em solid color-mix(in srgb,var(--c) 70%,transparent); border-radius:.45em; background:rgba(5,4,14,.75); text-shadow:0 0 .8em var(--c); white-space:nowrap; }
.hsx .door .frame { position:absolute; inset:0; border-radius:2.4em 2.4em .6em .6em; background:linear-gradient(180deg,#3a3550,#1a1728 60%,#0e0c18); box-shadow:inset 0 0 0 .5em rgba(255,255,255,.08),0 0 0 .45em color-mix(in srgb,var(--c) 85%,transparent),0 0 5em color-mix(in srgb,var(--c) 45%,transparent); }
.hsx .door .inside { position:absolute; inset:1.6em 1.6em 0; border-radius:1.6em 1.6em 0 0; overflow:hidden; background:radial-gradient(120% 70% at 50% 100%,color-mix(in srgb,var(--c) 55%,#000) 0%,#07060c 70%); }
.hsx .door .peek { position:absolute; left:4%; top:22%; width:46%; border-radius:50%; opacity:0; border:.5em solid var(--vestA); }
.hsx .door .hinge { position:absolute; inset:1.6em 1.6em 0; perspective:90em; z-index:3; }
.hsx .door .panel { position:absolute; inset:0; transform-origin:0 50%; border-radius:1.6em 1.6em 0 0; background:linear-gradient(90deg,rgba(255,255,255,.22),transparent 18%,transparent 82%,rgba(0,0,0,.25)),linear-gradient(180deg,color-mix(in srgb,var(--c) 92%,#fff) 0%,var(--c) 45%,color-mix(in srgb,var(--c) 70%,#000) 100%); box-shadow:inset 0 0 0 .5em rgba(255,255,255,.25),inset 0 -5em 7em rgba(0,0,0,.25); backface-visibility:hidden; }
.hsx .door .panel::before { content:""; position:absolute; left:12%; right:12%; top:7%; bottom:7%; border-radius:1.2em; box-shadow:inset 0 0 0 .35em rgba(0,0,0,.18),inset 0 0 0 .7em rgba(255,255,255,.18); }
.hsx .door .knob { position:absolute; right:8%; top:52%; width:1.6em; height:10em; border-radius:1em; background:linear-gradient(180deg,#fff,#9aa); box-shadow:0 0 1.4em rgba(255,255,255,.7); transform-origin:50% 15%; }
.hsx .door .sym { position:absolute; left:50%; top:32%; width:54%; transform:translate(-50%,-50%); filter:drop-shadow(0 0 1.2em #fff) drop-shadow(0 0 3em rgba(255,255,255,.6)); }
.hsx .door .sym svg { display:block; width:100%; height:auto; }
.hsx .door .led { position:absolute; left:50%; bottom:6%; width:40%; height:1.4em; transform:translateX(-50%); border-radius:1em; background:rgba(0,0,0,.35); overflow:hidden; }
.hsx .door .led::after { content:""; position:absolute; inset:0; width:30%; background:#fff; box-shadow:0 0 2em #fff; animation:hs-scan 1.6s linear infinite; }
.hsx .door .spot { position:absolute; inset:-12%; background:radial-gradient(closest-side,rgba(255,255,255,.8),rgba(200,230,255,.28) 60%,transparent); opacity:0; z-index:5; pointer-events:none; }
.hsx .door .scanbox { position:absolute; inset:-1.5em; border:.45em solid var(--ink); border-radius:3em; opacity:0; z-index:4; }
.hsx .door .scanbox::before { content:""; position:absolute; left:0; right:0; height:.8em; background:var(--ink); box-shadow:0 0 3em var(--ink); opacity:.8; animation:hs-sweep 1.1s ease-in-out infinite alternate; }
.hsx .door .hit { position:absolute; inset:-14% -22% -6% -22%; }
.hsx .door .badges { position:absolute; left:50%; bottom:-7em; transform:translateX(-50%); display:flex; gap:.6em; z-index:6; }
.hsx .door .badges span { font:700 3em/1 var(--hud); padding:.2em .35em; border-radius:.4em; background:rgba(8,6,20,.9); border:.12em solid var(--c); color:#fff; white-space:nowrap; }
.hsx .door.pickable .frame { animation:hs-pulse 1.2s ease-in-out infinite; }
.hsx .door.chosen .scanbox { opacity:1; }

/* ── HUD ── */
.hsx .hud { position:absolute; left:3cqw; right:3cqw; top:2.4cqh; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:2cqw; opacity:0; }
.hsx .pl { display:flex; align-items:center; gap:2cqw; min-width:0; }
.hsx .pl.r { flex-direction:row-reverse; text-align:right; }
.hsx .pl img { width:11cqw; height:11cqw; border-radius:3cqw; object-fit:cover; object-position:50% 15%; border:.7cqw solid var(--c); box-shadow:0 0 3cqw color-mix(in srgb,var(--c) 60%,transparent); }
.hsx .pl b { display:block; font:700 3.6cqw/1 var(--hud); letter-spacing:.04em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:24cqw; }
.hsx .pl small { display:block; font:700 2.4cqw/1.3 var(--hud); color:var(--c); letter-spacing:.1em; }
.hsx .score { text-align:center; font:700 7.6cqw/1 var(--hud); font-variant-numeric:tabular-nums; text-shadow:0 0 4cqw rgba(255,255,255,.35); }
.hsx .score small { display:block; font-size:2.3cqw; letter-spacing:.3em; color:var(--muted); margin-top:.6cqh; }
.hsx .sa { color:var(--vestA); } .hsx .sb { color:var(--vestB); }
.hsx .strip { position:absolute; top:14.6cqh; left:50%; transform:translateX(-50%); font:700 2.7cqw/1 var(--hud); letter-spacing:.2em; color:var(--muted); white-space:nowrap; display:flex; gap:2cqw; align-items:center; opacity:0; }
.hsx .live { color:var(--red); } .hsx .live::before { content:"●"; margin-right:1cqw; animation:hs-blink 1s steps(2) infinite; }
.hsx .alti { position:absolute; right:1.6cqw; top:30cqh; display:flex; flex-direction:column-reverse; gap:.9cqh; opacity:0; }
.hsx .alti span { width:6.4cqw; height:3.2cqh; border-radius:1cqw; display:flex; align-items:center; justify-content:center; font:700 2.6cqw/1 var(--hud); background:rgba(8,6,20,.7); border:.25cqw solid rgba(255,255,255,.18); color:var(--muted); }
.hsx .alti span.on { background:var(--pink); border-color:var(--pink); color:#1a0410; box-shadow:0 0 3cqw var(--pink); }
.hsx .alti span.done { border-color:var(--gold); color:var(--gold); }
.hsx .duelbar { position:absolute; left:4cqw; right:4cqw; top:14.6cqh; display:grid; gap:.8cqh; justify-items:center; padding:1.8cqw 3cqw; border-radius:2.4cqw; background:rgba(8,6,20,.84); border:.3cqw solid rgba(255,255,255,.14); opacity:0; text-align:center; }
.hsx .duelbar b { font:700 3cqw/1 var(--hud); letter-spacing:.24em; color:var(--gold); }
.hsx .duelbar span { font:700 3.2cqw/1.25 var(--hud); letter-spacing:.04em; }
.hsx .duelbar i { font-style:normal; }
.hsx .duelbar .cnt { font:700 3.2cqw/1 var(--hud); color:var(--gold); margin:0 .6cqw; padding:.3cqw 1.2cqw; border-radius:1cqw; background:rgba(255,210,63,.14); } .hsx .duelbar .cnt b { display:inline-block; color:#fff; font-size:1.15em; }
.hsx .duelbar .lv { display:block; font:700 2.3cqw/1 var(--hud); letter-spacing:.2em; color:var(--muted); margin-bottom:.7cqh; } .hsx .duelbar .lv::first-letter { color:var(--red); }
.hsx .duelbar .sep { color:rgba(255,255,255,.35); font:700 2.6cqw/1 var(--hud); margin:0 .4cqw; }
.hsx .poster .halves { display:grid; gap:.8cqh; margin-bottom:1.6cqh; font:700 3cqw/1.3 var(--hud); color:#e6e1f7; }
.hsx .duelbar em { display:flex; gap:1.2cqw; font-style:normal; }
.hsx .duelbar u { width:4.4cqw; height:1.3cqw; border-radius:1cqw; background:rgba(255,255,255,.14); text-decoration:none; }
.hsx .duelbar u.a { background:var(--vestA); box-shadow:0 0 2cqw var(--vestA); } .hsx .duelbar u.b { background:var(--vestB); box-shadow:0 0 2cqw var(--vestB); } .hsx .duelbar u.cur { background:#fff; }
.hsx .verdict { position:absolute; left:5cqw; right:5cqw; bottom:22cqh; display:grid; gap:.8cqh; justify-items:center; padding:2.2cqw 3cqw; border-radius:2.6cqw; background:rgba(8,6,20,.9); border:.3cqw solid rgba(255,255,255,.18); text-align:center; opacity:0; }
.hsx .verdict span { font:700 3.7cqw/1.2 var(--hud); } .hsx .verdict span b { font-size:1.25em; }
.hsx .verdict em { font:700 3.2cqw/1 var(--hud); font-style:normal; letter-spacing:.08em; } .hsx .verdict .c { color:var(--red); } .hsx .verdict .e { color:var(--vestA); }
.hsx .big { position:absolute; left:0; right:0; top:31cqh; text-align:center; font:700 16cqw/1 var(--hud); opacity:0; }
.hsx .big.caught { color:#fff; text-shadow:-.9cqw 0 var(--red),.9cqw 0 #00e5ff,0 0 6cqw var(--red); }
.hsx .big.esc { color:#eafff4; text-shadow:-.7cqw 0 var(--vestA),.7cqw 0 #00e5ff,0 0 6cqw var(--vestA); font-size:13cqw; }
.hsx .big.count { top:40cqh; font-size:20cqw; color:#fff; text-shadow:0 0 5cqw var(--pink); }
.hsx .level { position:absolute; left:6cqw; right:6cqw; top:34cqh; text-align:center; opacity:0; }
.hsx .level small { display:block; font:700 3cqw/1 var(--hud); letter-spacing:.36em; color:var(--gold); }
.hsx .level b { display:block; margin-top:1.6cqh; font:700 10.5cqw/1 var(--hud); letter-spacing:.03em; text-shadow:0 0 5cqw rgba(255,61,139,.7); text-wrap:balance; }
.hsx .level span { display:block; margin-top:1.4cqh; font:700 3cqw/1.3 var(--hud); letter-spacing:.22em; color:var(--muted); }
.hsx .role { position:absolute; left:6cqw; right:6cqw; bottom:6cqh; display:flex; align-items:center; gap:3cqw; padding:2.4cqw 3cqw; border-radius:3cqw; background:rgba(8,6,20,.84); border:.35cqw solid color-mix(in srgb,var(--c) 70%,transparent); box-shadow:0 0 6cqw color-mix(in srgb,var(--c) 30%,transparent); opacity:0; }
.hsx .role img { width:12cqw; height:12cqw; border-radius:2.4cqw; object-fit:cover; object-position:50% 15%; }
.hsx .role small { display:block; font:700 2.5cqw/1.2 var(--hud); letter-spacing:.22em; color:var(--c); }
.hsx .role b { display:block; margin-top:.8cqh; font:700 5.2cqw/1 var(--hud); }
.hsx .karaoke { position:absolute; left:4cqw; right:4cqw; top:80cqh; text-align:center; font:700 6cqw/1.25 var(--hud); opacity:0; text-wrap:balance; }
.hsx .karaoke span { color:rgba(255,255,255,.22); transition:color .12s,text-shadow .12s; }
.hsx .karaoke span.on { color:#fff; text-shadow:0 0 3cqw var(--pink); } .hsx .karaoke span.last { color:var(--gold); text-shadow:0 0 4cqw var(--gold); }
.hsx .karaoke.one { top:84cqh; font-size:8cqw; white-space:nowrap; letter-spacing:.08em; }
.hsx .quip { position:absolute; left:4cqw; right:4cqw; bottom:2.6cqh; padding:2.2cqw 3.2cqw; border-radius:2.4cqw; background:rgba(8,6,20,.9); border:.3cqw solid rgba(255,255,255,.16); font:800 3.3cqw/1.32 var(--txt); text-align:center; opacity:0; text-wrap:balance; }
.hsx .quip .vh { font:700 3.5cqw/1.25 var(--hud); margin-bottom:1cqh; padding-bottom:1cqh; border-bottom:.25cqw solid rgba(255,255,255,.12); } .hsx .quip .vh b { font-size:1.2em; } .hsx .quip .vh em { display:block; font-style:normal; letter-spacing:.06em; margin-top:.5cqh; } .hsx .quip .vh .c { color:var(--red); } .hsx .quip .vh .e { color:var(--vestA); }
.hsx .quip.withv::before { display:none; }
.hsx .quip::before { content:"🎙️ COMENTATORUL"; display:block; font:700 2.3cqw/1 var(--hud); letter-spacing:.3em; color:var(--pink); margin-bottom:1cqh; }
.hsx .vs { position:absolute; left:5cqw; right:5cqw; top:13cqh; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:2cqw; padding:3cqw; border-radius:3cqw; background:rgba(8,6,20,.9); border:.3cqw solid rgba(255,255,255,.14); opacity:0; }
.hsx .vs .p { text-align:center; min-width:0; } .hsx .vs img { width:22cqw; height:22cqw; border-radius:3cqw; object-fit:cover; object-position:50% 15%; border:.8cqw solid var(--c); box-shadow:0 0 4cqw var(--c); }
.hsx .vs b { display:block; font:700 4cqw/1 var(--hud); margin-top:1cqh; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .hsx .vs small { display:block; font:700 2.4cqw/1.2 var(--hud); color:var(--c); letter-spacing:.18em; margin-top:.6cqh; }
.hsx .vs .x { font:700 9cqw/1 var(--hud); color:var(--pink); text-shadow:0 0 4cqw var(--pink); }
.hsx .vs .k { grid-column:1/-1; text-align:center; font:700 2.6cqw/1 var(--hud); letter-spacing:.32em; color:var(--gold); order:-1; }
.hsx .poster { position:absolute; left:5cqw; right:5cqw; top:22cqh; padding:4cqw; border-radius:3.4cqw; background:rgba(8,6,20,.94); border:.35cqw solid rgba(255,210,63,.5); box-shadow:0 0 8cqw rgba(255,210,63,.18); text-align:center; opacity:0; }
.hsx .poster small { display:block; font:700 2.7cqw/1 var(--hud); letter-spacing:.3em; color:var(--gold); }
.hsx .poster .res { display:flex; justify-content:center; align-items:center; gap:4cqw; margin:2.4cqh 0; }
.hsx .poster .res img { width:16cqw; height:16cqw; border-radius:2.6cqw; object-fit:cover; object-position:50% 15%; border:.7cqw solid var(--c); }
.hsx .poster .res b { font:700 11cqw/1 var(--hud); font-variant-numeric:tabular-nums; }
.hsx .poster p { margin:0; font:800 3.4cqw/1.35 var(--txt); text-wrap:balance; }
.hsx .poster .pts { font:700 3.6cqw/1.2 var(--hud); letter-spacing:.06em; margin-bottom:1.6cqh; }
.hsx .poster .cardbtn { margin-top:2.4cqh; font-size:3.2cqw; padding:2.2cqw 4cqw; }
.hsx .grid { position:absolute; left:4cqw; right:4cqw; top:7cqh; padding:3.2cqw; border-radius:3cqw; background:rgba(8,6,20,.92); border:.3cqw solid rgba(255,255,255,.14); opacity:0; max-height:80cqh; overflow:hidden; }
.hsx .grid h3 { margin:0 0 1.4cqh; text-align:center; font:700 4.6cqw/1.15 var(--hud); text-wrap:balance; }
.hsx .grid .row { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:2cqw; padding:.8cqh 0; border-top:.2cqw solid rgba(255,255,255,.08); font:700 3cqw/1 var(--hud); }
.hsx .grid .row span { display:flex; align-items:center; gap:1.6cqw; min-width:0; white-space:nowrap; overflow:hidden; } .hsx .grid .row span:last-child { flex-direction:row-reverse; }
.hsx .grid img { width:6.4cqw; height:6.4cqw; border-radius:50%; object-fit:cover; object-position:50% 15%; border:.45cqw solid var(--c); flex:none; }
.hsx .grid i { font-style:normal; color:var(--pink); }
.hsx .grid .t { display:flex; align-items:center; gap:2.4cqw; padding:1.2cqh 0; border-top:.2cqw solid rgba(255,255,255,.08); text-align:left; }
.hsx .grid .t big { font-size:8cqw; } .hsx .grid .t b { display:block; font:700 3.6cqw/1.1 var(--hud); color:var(--gold); } .hsx .grid .t small { display:block; font:700 3cqw/1.3 var(--txt); }
.hsx .hunt { position:absolute; left:0; right:0; bottom:6cqh; text-align:center; font:700 9.6cqw/1 var(--hud); color:#fff; text-shadow:-.6cqw 0 var(--pink),.6cqw 0 var(--mint),0 0 5cqw var(--pink); opacity:0; }
.hsx .flash { position:absolute; inset:0; background:var(--red); opacity:0; mix-blend-mode:screen; }
.hsx .dark { position:absolute; inset:0; background:radial-gradient(80% 60% at 50% 60%,rgba(4,3,12,.35),rgba(4,3,12,.93)); opacity:0; }
.hsx .alarm { position:absolute; inset:0; background:radial-gradient(80% 70% at 50% 40%,transparent 40%,rgba(255,20,50,.45)); opacity:0; }
.hsx .alarm.on { animation:hs-alarm .6s ease-in-out infinite alternate; }
.hsx .slow { position:absolute; inset:0; box-shadow:inset 0 0 12cqw rgba(0,0,0,.85); opacity:0; }
.hsx .scanl { position:absolute; inset:0; background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px); }
.hsx .vig { position:absolute; inset:0; background:radial-gradient(120% 90% at 50% 45%,transparent 55%,rgba(0,0,0,.55)); }
.hsx .trail { position:absolute; width:2.4cqw; height:2.4cqw; border-radius:50%; pointer-events:none; }
.hsx .confetti { position:absolute; inset:0; overflow:hidden; pointer-events:none; }
.hsx .confetti i { position:absolute; top:-3cqh; width:2cqw; height:3cqw; border-radius:.4cqw; }
.hsx .menu { position:absolute; inset:0; z-index:40; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2.6cqh; background:radial-gradient(60% 40% at 50% 42%,rgba(255,61,139,.3),rgba(7,6,15,.6) 70%,rgba(7,6,15,.85)); backdrop-filter:blur(2px); padding:6cqw; text-align:center; }
.hsx .menu h1 { margin:0; font:700 12cqw/1 var(--hud); letter-spacing:.04em; text-shadow:0 0 5cqw var(--pink); }
.hsx .menu p { margin:0; font:700 2.9cqw/1.4 var(--hud); letter-spacing:.24em; color:var(--muted); }
.hsx .menu .syms { font:700 9cqw/1 var(--hud); letter-spacing:.4em; color:var(--pink); text-shadow:0 0 4cqw var(--pink); }
.hsx .menu button { min-width:60%; font-size:4cqw; padding:3cqw 5cqw; }
/* alegere */
.hsx .pickbar { position:absolute; left:4cqw; right:4cqw; top:2.4cqh; padding:2.4cqw 3cqw; border-radius:2.6cqw; background:rgba(8,6,20,.88); border:.3cqw solid rgba(255,255,255,.16); text-align:center; }
.hsx .pickbar small { display:block; font:700 2.6cqw/1 var(--hud); letter-spacing:.24em; color:var(--gold); }
.hsx .pickbar b { display:block; margin-top:1cqh; font:700 4.6cqw/1.15 var(--hud); text-wrap:balance; }
.hsx .pickbar span { display:block; margin-top:.8cqh; font:700 2.8cqw/1.3 var(--txt); color:var(--muted); }
.hsx .tray { position:absolute; left:3cqw; right:3cqw; bottom:2.4cqh; display:grid; grid-template-columns:repeat(6,1fr); gap:1.4cqw; padding:2cqw; border-radius:2.6cqw; background:rgba(8,6,20,.88); border:.3cqw solid rgba(255,255,255,.16); }
.hsx .tray div { display:flex; flex-direction:column; align-items:center; gap:.4cqh; padding:1cqw 0; border-radius:1.6cqw; background:rgba(255,255,255,.05); border:.25cqw dashed rgba(255,255,255,.18); font:700 2.4cqw/1 var(--hud); color:var(--muted); }
.hsx .tray div b { font-size:6cqw; line-height:1; color:#fff; min-height:6cqw; }
.hsx .tray div.cur { border-style:solid; border-color:var(--pink); box-shadow:0 0 3cqw rgba(255,61,139,.5); }
.hsx .tray div.f { border-style:solid; border-color:rgba(255,255,255,.3); }
.hsx .pickact { position:absolute; left:3cqw; right:3cqw; bottom:16cqh; display:flex; justify-content:center; gap:2cqw; }
.hsx .pickact button { font-size:3.2cqw; padding:2.4cqw 4cqw; }
.hsx .modal { position:absolute; inset:0; z-index:45; background:rgba(4,3,12,.78); display:flex; align-items:center; justify-content:center; padding:5cqw; pointer-events:auto; }
.hsx .modal > div { width:100%; padding:5cqw; border-radius:3.4cqw; background:#120c22; border:.35cqw solid rgba(255,61,139,.55); text-align:center; display:grid; gap:2cqh; }
.hsx .modal h4 { margin:0; font:700 5.4cqw/1.1 var(--hud); }
.hsx .modal p { margin:0; font:700 3.4cqw/1.4 var(--txt); color:#e6e1f7; }
.hsx .modal .doorsline { font:700 7cqw/1.2 var(--hud); letter-spacing:.2em; }
.hsx .modal .btns { display:flex; gap:2cqw; justify-content:center; flex-wrap:wrap; }
.hsx .modal button { font-size:3.4cqw; padding:2.8cqw 4.4cqw; }
.hsx .modal img.card { width:100%; max-height:62cqh; object-fit:contain; border-radius:2cqw; }
.hsx .mixer { position:absolute; z-index:50; right:0; bottom:calc(100% + 6px); width:240px; padding:12px; border-radius:14px; background:#120c22; border:1px solid rgba(255,255,255,.16); display:grid; gap:8px; text-align:left; }
.hsx .mixer label { display:grid; grid-template-columns:62px 1fr; align-items:center; gap:8px; font:700 12px/1 var(--hud); letter-spacing:.06em; color:var(--muted); }
.hsx .mixer input[type=range] { width:100%; accent-color:#ff3d8b; }
.hsx .ctrlwrap { position:relative; }

@keyframes hs-swA { from { transform:rotate(32deg); } to { transform:rotate(-32deg); } }
@keyframes hs-swB { from { transform:rotate(-32deg); } to { transform:rotate(32deg); } }
@keyframes hs-bob { to { transform:translateY(-.9em); } }
@keyframes hs-hop { to { transform:translateY(-2.4em); } }
@keyframes hs-dance { from { transform:rotate(-10deg) translateY(0); } to { transform:rotate(10deg) translateY(-1.6em); } }
@keyframes hs-shiver { from { transform:translateX(-.35em); } to { transform:translateX(.35em); } }
@keyframes hs-look { 0%,100% { transform:rotate(-14deg); } 50% { transform:rotate(14deg); } }
@keyframes hs-mark { 0% { opacity:0; transform:translateX(-50%) scale(.2); } 40% { opacity:1; transform:translateX(-50%) scale(1.3); } 100% { opacity:1; transform:translateX(-50%) scale(1); } }
@keyframes hs-drop { from { transform:translateY(0); opacity:1; } to { transform:translateY(3em); opacity:0; } }
@keyframes hs-blink { to { opacity:0; } }
@keyframes hs-scan { from { transform:translateX(-100%); } to { transform:translateX(340%); } }
@keyframes hs-sweep { from { top:4%; } to { top:94%; } }
@keyframes hs-neon { 0%,100%,47%,50%,54% { opacity:1; } 48% { opacity:.55; } 52% { opacity:.7; } }
@keyframes hs-beacon { from { opacity:.35; transform:scale(.8); } to { opacity:1; transform:scale(1.15); } }
@keyframes hs-alarm { from { opacity:.25; } to { opacity:1; } }
@keyframes hs-pulse { 0%,100% { filter:brightness(1); } 50% { filter:brightness(1.35); } }
@media (prefers-reduced-motion: reduce) { .hsx .door .led::after, .hsx .door .scanbox::before, .hsx .live::before, .hsx .exit3, .hsx .alarm.on, .hsx .door.pickable .frame { animation:none; } }
`;
let injected = false;
export function injectHsStyles() {
  if (injected || typeof document === "undefined") return; injected = true;
  const st = document.createElement("style"); st.id = "hsx-styles"; st.textContent = HS_CSS; document.head.appendChild(st);
  if (!document.querySelector("link[data-hsx-font]")) { const l = document.createElement("link"); l.rel = "stylesheet"; l.dataset.hsxFont = "1"; l.href = "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;700&family=Inter:wght@600;800&display=swap"; document.head.appendChild(l); }
}
