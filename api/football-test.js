// ══════════════════════════════════════════════════════════════════
// api/football-test.js — "Test Connection", apelat DOAR din Admin
// diagnostic (buton, nu automat). Autentificare DIFERITĂ de
// football-sync.js: acolo CRON_SECRET (îl știe doar GitHub Actions),
// aici tokenul Firebase al userului conectat — CRON_SECRET nu poate
// ajunge în browser, deci nu putea fi refolosit pentru butonul ăsta.
//
// Verifică: userul e autentificat ȘI e admin (același criteriu ca
// regula Firestore isAdmin() — existența documentului admins/{uid}).
// Maximum UN request către API-Football (endpoint /status — gândit
// EXACT pentru asta, nu consumă din cota "reală" de date).
// ══════════════════════════════════════════════════════════════════
import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { getAuth } from "firebase-admin/auth";

export default async function handler(req, res) {
  const authHeader = req.headers["authorization"];
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: "lipsă token" });

  const db = getAdminDb();
  let uid;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: "token invalid" });
  }

  const adminSnap = await db.collection("admins").doc(uid).get();
  if (!adminSnap.exists) return res.status(403).json({ error: "doar admin" });

  const API_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_KEY) return res.status(500).json({ error: "API_FOOTBALL_KEY nu e configurată" });

  try {
    const resp = await fetch("https://v3.football.api-sports.io/status", {
      headers: { "x-apisports-key": API_KEY },
    });
    const data = await resp.json();
    return res.status(200).json({
      reachable: resp.ok,
      quotaRemaining: data?.response?.requests ? (data.response.requests.limit_day - data.response.requests.current) : null,
      responseValid: !!data?.response,
    });
  } catch (err) {
    return res.status(200).json({ reachable: false, error: String(err) });
  }
}
