// ══════════════════════════════════════════════════════════════════
// 🌉 PODUL DE STICLĂ — SERVERUL DE ÎNCREDERE (Vercel Serverless Function)
//
// De ce aici și nu în aplicație: traseul secret NU trebuie să ajungă
// niciodată pe telefon. Doar acest server (cont de service Firebase)
// citește traseele și decide dacă o săritură e sigură.
//
//   GET  /api/bridge                → verificare: serverul și Firebase funcționează
//   POST /api/bridge  { action:"setup",   gameweekId, deadlineMs }   (doar Admin)
//   POST /api/bridge  { action:"jump",    gameweekId, row, side }
//   POST /api/bridge  { action:"cashout", gameweekId }
//   POST /api/bridge  { action:"reset",   gameweekId:"test-…" }        (doar Admin, doar poduri de test)
// Autentificare: header „Authorization: Bearer <ID token Firebase>”.
//
// Date:
//   bridgeSecret/{gw}          traseele (NIMENI nu le citește din aplicație)
//   bridge/{gw}                perechile + termenul (public, doar citire)
//   bridge/{gw}/players/{uid}  starea publică a fiecărui jucător (doar citire)
// Toate scrierile se fac în tranzacții: două sărituri simultane nu pot consuma
// vieți de două ori; o cerere retrimisă nu schimbă rezultatul (verificarea „row”).
// ══════════════════════════════════════════════════════════════════
import { randomInt } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./_lib/firebaseAdmin.js";
import {
  applyCashout, applyJump, BRIDGE_ROWS, initialPlayerState, makePairs, makeRoute, publicView,
} from "../src/services/bridgeLogic.js";

const rng = () => randomInt(0, 1_000_000) / 1_000_000;   // aleatoriu criptografic, pe server
const GW_RE = /^[A-Za-z0-9_-]{1,80}$/;

function send(res, code, body) { res.status(code).setHeader("Cache-Control", "no-store"); res.json(body); }

export default async function handler(req, res) {
  let db;
  try { db = getAdminDb(); } catch (e) { return send(res, 500, { ok: false, error: "server_not_configured" }); }

  if (req.method === "GET") return send(res, 200, { ok: true, service: "bridge", firebase: true });
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });

  // ── Cine cere? ──
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  let uid;
  try { uid = (await getAuth().verifyIdToken(token)).uid; } catch { return send(res, 401, { ok: false, error: "auth" }); }

  const body = typeof req.body === "string" ? safeJson(req.body) : (req.body || {});
  const { action, gameweekId } = body;
  if (!GW_RE.test(String(gameweekId || ""))) return send(res, 400, { ok: false, error: "gameweek" });

  const pubRef = db.doc(`bridge/${gameweekId}`);
  const secRef = db.doc(`bridgeSecret/${gameweekId}`);
  const meRef = db.doc(`bridge/${gameweekId}/players/${uid}`);

  try {
    if (action === "setup") {
      const isAdmin = (await db.doc(`admins/${uid}`).get()).exists;
      if (!isAdmin) return send(res, 403, { ok: false, error: "admin_only" });
      const deadlineMs = Number(body.deadlineMs);
      if (!Number.isFinite(deadlineMs) || deadlineMs < Date.now()) return send(res, 400, { ok: false, error: "deadline" });
      const users = await db.collection("users").get();
      const active = users.docs.filter((d) => (d.data().status || "active") === "active").map((d) => d.id);
      if (active.length < 1) return send(res, 400, { ok: false, error: "no_players" });
      const result = await db.runTransaction(async (tx) => {
        const existing = await tx.get(pubRef);
        if (existing.exists) return { already: true };          // traseele NU se regenerează niciodată
        const { pairs } = makePairs(active, rng);
        const secretPairs = pairs.map((p) => ({ ...p, route: makeRoute(rng) }));
        tx.set(secRef, { pairs: secretPairs, createdAt: FieldValue.serverTimestamp() });
        tx.set(pubRef, { gameweekId, pairs, deadlineMs, rows: BRIDGE_ROWS, createdAt: FieldValue.serverTimestamp(), createdBy: uid });
        pairs.forEach((p) => p.members.forEach((m) => {
          tx.set(db.doc(`bridge/${gameweekId}/players/${m}`), { ...publicView(initialPlayerState(m, p.id, !!p.solo)), updatedAt: FieldValue.serverTimestamp() });
        }));
        return { already: false, pairs: pairs.length };
      });
      return send(res, 200, { ok: true, ...result });
    }

    // Doar pentru TESTE: un Pod cu id „test-…” poate fi șters de Admin și repornit.
    // Podurile reale (id-ul etapei) NU pot fi resetate niciodată.
    if (action === "reset") {
      const isAdmin = (await db.doc(`admins/${uid}`).get()).exists;
      if (!isAdmin) return send(res, 403, { ok: false, error: "admin_only" });
      if (!String(gameweekId).startsWith("test-")) return send(res, 400, { ok: false, error: "not_test" });
      const ps = await db.collection(`bridge/${gameweekId}/players`).get();
      const batch = db.batch();
      ps.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(pubRef); batch.delete(secRef);
      await batch.commit();
      return send(res, 200, { ok: true, reset: true });
    }

    if (action === "jump" || action === "cashout") {
      const out = await db.runTransaction(async (tx) => {
        const [pub, sec, me] = await Promise.all([tx.get(pubRef), tx.get(secRef), tx.get(meRef)]);
        if (!pub.exists || !sec.exists) return { ok: false, error: "not_started" };
        if (!me.exists) return { ok: false, error: "not_player" };
        const state = me.data();
        const deadlineMs = pub.data().deadlineMs;
        let r;
        if (action === "jump") {
          const pair = (sec.data().pairs || []).find((p) => p.id === state.pairId);
          r = applyJump(state, pair?.route, Number(body.row), Number(body.side), Date.now(), deadlineMs);
        } else {
          r = applyCashout(state, Date.now(), deadlineMs);
        }
        if (!r.ok) return { ok: false, error: r.error, state: publicView(r.state || state) };
        tx.set(meRef, { ...publicView(r.state), updatedAt: FieldValue.serverTimestamp() });
        return { ok: true, result: r.result || "cashed", points: r.points ?? r.state.points, state: publicView(r.state) };
      });
      return send(res, 200, out);
    }

    return send(res, 400, { ok: false, error: "action" });
  } catch (e) {
    console.error("bridge:", e);
    return send(res, 500, { ok: false, error: "server" });
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
