// ══════════════════════════════════════════════════════════════════
// 👤 TRANSFER DE CONT (doar Admin) — pentru înlocuirea unui jucător.
// Contul rămâne ACELAȘI (același uid): punctele, numărul, istoricul rămân.
// Se schimbă doar datele de logare: emailul noului jucător + parola lui,
// iar logarea cu Google a vechiului jucător poate fi scoasă.
// Parola NU se salvează nicăieri (nici în Firestore) — merge direct în
// Firebase Authentication. Sesiunile vechi sunt deconectate.
//
//   POST /api/account { action:"transfer", uid, email, password?, unlinkGoogle? }
// ══════════════════════════════════════════════════════════════════
import { getAuth } from "firebase-admin/auth";
import { getAdminDb } from "./_lib/firebaseAdmin.js";

function send(res, code, body) { res.status(code).setHeader("Cache-Control", "no-store"); res.json(body); }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  let db;
  try { db = getAdminDb(); } catch { return send(res, 500, { ok: false, error: "server_not_configured" }); }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
  const auth = getAuth();
  let caller;
  try { caller = (await auth.verifyIdToken(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""))).uid; }
  catch { return send(res, 401, { ok: false, error: "auth" }); }
  if (!(await db.doc(`admins/${caller}`).get()).exists) return send(res, 403, { ok: false, error: "admin_only" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { action, uid, email, password, unlinkGoogle } = body;
  if (action !== "transfer") return send(res, 400, { ok: false, error: "action" });
  if (!uid || typeof uid !== "string") return send(res, 400, { ok: false, error: "uid" });
  const mail = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) return send(res, 400, { ok: false, error: "email" });
  if (password != null && password !== "" && String(password).length < 6) return send(res, 400, { ok: false, error: "password_short" });
  if (uid === caller) return send(res, 400, { ok: false, error: "self" });

  try {
    const user = await auth.getUser(uid);                       // contul trebuie să existe
    try {                                                       // emailul nu are voie să fie al ALTUI cont
      const other = await auth.getUserByEmail(mail);
      if (other.uid !== uid) return send(res, 409, { ok: false, error: "email_in_use" });
    } catch (e) { if (e.code !== "auth/user-not-found") throw e; }
    const upd = { email: mail, emailVerified: false };
    if (password) upd.password = String(password);
    const hasGoogle = user.providerData.some((p) => p.providerId === "google.com");
    const hasPassword = user.providerData.some((p) => p.providerId === "password");
    if (unlinkGoogle && hasGoogle && !password && !hasPassword) return send(res, 400, { ok: false, error: "password_required" }); // altfel contul ar rămâne fără nicio logare
    if (unlinkGoogle && hasGoogle) upd.providersToUnlink = ["google.com"];
    await auth.updateUser(uid, upd);
    await auth.revokeRefreshTokens(uid);                        // vechiul jucător e deconectat de pe toate dispozitivele
    await db.doc(`users/${uid}/private/profile`).set({ email: mail }, { merge: true });
    const after = await auth.getUser(uid);
    return send(res, 200, { ok: true, email: after.email, providers: after.providerData.map((p) => p.providerId), passwordSet: !!password });
  } catch (e) {
    console.error("account:", e);
    if (e.code === "auth/user-not-found") return send(res, 404, { ok: false, error: "not_found" });
    if (e.code === "auth/email-already-exists") return send(res, 409, { ok: false, error: "email_in_use" });
    return send(res, 500, { ok: false, error: "server" });
  }
}
