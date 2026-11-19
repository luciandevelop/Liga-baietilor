// ══════════════════════════════════════════════════════════════════
// 🖕 ASCUNSELEA — CARTONAȘUL RUȘINII. Imagine verticală 1080×1920 (PNG), desenată în canvas.
// Pe Android se trimite direct prin meniul de partajare (WhatsApp); altfel se descarcă fișierul.
// ══════════════════════════════════════════════════════════════════
const VEST = { A: "#1fd46a", B: "#3d7bff" };
const FONT = '"Chakra Petch", "Arial Narrow", system-ui, sans-serif';

const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
function wrap(g, text, x, y, maxW, lh, maxLines = 4) {
  const words = String(text || "").split(/\s+/); const lines = []; let cur = "";
  words.forEach((w) => { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur); lines.slice(0, maxLines).forEach((l, i) => g.fillText(l, x, y + i * lh)); return Math.min(lines.length, maxLines) * lh;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function avatar(g, img, cx, cy, size, ring, nick) {
  g.save(); rr(g, cx - size / 2, cy - size / 2, size, size, 48); g.clip();
  if (img) { const r = img.width / img.height; const w = r > 1 ? size * r : size; const h = r > 1 ? size : size / r; g.drawImage(img, cx - w / 2, cy - size / 2 - (h - size) * .12, w, h); }
  else { g.fillStyle = "#2a2140"; g.fillRect(cx - size / 2, cy - size / 2, size, size); g.fillStyle = "#fff"; g.font = `700 ${size * .5}px ${FONT}`; g.textAlign = "center"; g.fillText((nick || "?").charAt(0), cx, cy + size * .18); }
  g.restore(); g.lineWidth = 14; g.strokeStyle = ring; g.shadowColor = ring; g.shadowBlur = 40; rr(g, cx - size / 2, cy - size / 2, size, size, 48); g.stroke(); g.shadowBlur = 0;
}

// d = { A:{nick,num,av}, B:{nick,num,av}, turn, level, winsA, winsB, ptsA, ptsB, result:"A"|"B"|"T", quip, title? }
export async function makeCard(d) {
  try { if (document.fonts?.load) await Promise.race([document.fonts.load(`700 60px "Chakra Petch"`), new Promise((r) => setTimeout(r, 1200))]); } catch (e) { /* font de rezervă */ }
  const [ia, ib] = await Promise.all([loadImg(d.A?.av), loadImg(d.B?.av)]);
  const W = 1080, H = 1920; const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  // fundal: hol pastel întunecat + grilă de neon
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1b0d2e"); bg.addColorStop(.55, "#2a1040"); bg.addColorStop(1, "#07060f"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(255,61,139,.22)"; g.lineWidth = 2; for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * 40, 1180); g.lineTo(W / 2 + i * 260, H); g.stroke(); }
  for (let k = 0; k < 12; k++) { const p = k / 12; const y = 1180 + (H - 1180) * p * p; g.globalAlpha = p; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.globalAlpha = 1;
  g.font = `700 260px ${FONT}`; g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,.05)"; g.fillText("○ △ □", W / 2, 330);
  // titlu
  g.fillStyle = "#ffd23f"; g.font = `700 38px ${FONT}`; g.fillText(`PLAY LEAGUE · ASCUNSELEA · TURA ${d.turn} / 5`, W / 2, 120);
  g.fillStyle = "#fff"; g.font = `700 96px ${FONT}`; g.shadowColor = "#ff3d8b"; g.shadowBlur = 40; g.fillText(d.level || "", W / 2, 230); g.shadowBlur = 0;
  // avatare
  avatar(g, ia, 290, 560, 360, VEST.A, d.A?.nick); avatar(g, ib, 790, 560, 360, VEST.B, d.B?.nick);
  g.font = `700 64px ${FONT}`; g.fillStyle = "#fff"; g.fillText((d.A?.nick || "").toUpperCase(), 290, 820); g.fillText((d.B?.nick || "").toUpperCase(), 790, 820);
  g.font = `700 40px ${FONT}`; g.fillStyle = VEST.A; g.fillText(`${d.A?.num || ""} · VERDE`, 290, 875); g.fillStyle = VEST.B; g.fillText(`${d.B?.num || ""} · ALBASTRU`, 790, 875);
  g.font = `700 90px ${FONT}`; g.fillStyle = "#ff3d8b"; g.fillText("VS", W / 2, 590);
  // scorul confruntărilor
  g.font = `700 230px ${FONT}`; g.fillStyle = VEST.A; g.textAlign = "right"; g.fillText(String(d.winsA), W / 2 - 50, 1110);
  g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText("–", W / 2, 1100); g.fillStyle = VEST.B; g.textAlign = "left"; g.fillText(String(d.winsB), W / 2 + 50, 1110); g.textAlign = "center";
  // verdict
  const verdict = d.result === "T" ? `🤝 EGALITATE · ${d.ptsA} PCT FIECARE` : `🏆 ${(d.result === "A" ? d.A : d.B)?.nick?.toUpperCase()} IA ${d.result === "A" ? d.ptsA : d.ptsB} PCT`;
  rr(g, 90, 1170, W - 180, 120, 30); g.fillStyle = d.result === "T" ? "rgba(255,210,63,.18)" : "rgba(31,212,106,.16)"; g.fill(); g.strokeStyle = d.result === "T" ? "#ffd23f" : "#1fd46a"; g.lineWidth = 4; g.stroke();
  g.fillStyle = "#fff"; g.font = `700 58px ${FONT}`; g.fillText(verdict, W / 2, 1250);
  if (d.result !== "T") { g.font = `700 44px ${FONT}`; g.fillStyle = "#ff2448"; g.fillText(`🖕 ${(d.result === "A" ? d.B : d.A)?.nick?.toUpperCase()} · RUȘINE PUBLICĂ`, W / 2, 1360); }
  // replica
  rr(g, 70, 1420, W - 140, 330, 36); g.fillStyle = "rgba(8,6,20,.85)"; g.fill(); g.strokeStyle = "rgba(255,255,255,.2)"; g.lineWidth = 3; g.stroke();
  g.fillStyle = "#ff3d8b"; g.font = `700 34px ${FONT}`; g.fillText("🎙️ COMENTATORUL", W / 2, 1480);
  g.fillStyle = "#fff"; g.font = `800 50px system-ui, sans-serif`; wrap(g, `„${d.quip || ""}”`, W / 2, 1555, W - 220, 64, 3);
  g.fillStyle = "rgba(255,255,255,.55)"; g.font = `700 32px ${FONT}`; g.fillText("SEZONUL 3 · SCAPĂ CINE POATE", W / 2, 1850);
  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

// Trimite/descarcă. Întoarce "shared" | "downloaded" | "failed".
export async function shareCard(blob, name = "ascunselea.png") {
  if (!blob) return "failed";
  try {
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Ascunselea", text: "Cartonașul rușinii 🖕" }); return "shared"; }
  } catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
  if (typeof window !== "undefined" && window.__HS_NO_FILE_SAVE) return "failed"; // pagina demo: salvarea fișierelor e blocată
  try {
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); return "downloaded";
  } catch (e) { return "failed"; }
}
