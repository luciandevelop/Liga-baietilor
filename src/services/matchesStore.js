import { listenMatches } from "./adminService";

// ── Magazin comun, STRICT în memorie, pentru meciurile etapei curente
// (aprobat explicit — P1 audit Firestore reads). NU e cache static: sub
// el rulează EXACT același `listenMatches` (onSnapshot) deja folosit —
// datele rămân 100% live (scor/status/minut se actualizează normal, în
// timp real, cât timp meciul se joacă azi). Ce se schimbă: dacă Home ȘI
// LIVE sunt vizitate în aceeași sesiune, se creează UN SINGUR listener
// Firestore pentru etapă, nu câte unul separat pentru fiecare ecran —
// al doilea consumator primește instant ultimele date cunoscute, fără
// nicio citire nouă.
//
// Referință-numărată: listener-ul se creează la primul abonat și se
// oprește curat când ultimul abonat pleacă (exact ca înainte, per ecran
// — niciun listener nu rămâne agățat după ce toată lumea a navigat în
// altă parte).
const stores = new Map(); // gameweekId -> { unsubscribe, subscribers: Set, lastRows }

export function subscribeToGameweekMatches(gameweekId, callback) {
  if (!gameweekId) return () => {};

  let entry = stores.get(gameweekId);
  if (!entry) {
    entry = { subscribers: new Set(), lastRows: null, unsubscribe: null };
    entry.unsubscribe = listenMatches(gameweekId, (rows) => {
      entry.lastRows = rows;
      entry.subscribers.forEach((cb) => cb(rows));
    });
    stores.set(gameweekId, entry);
  }

  entry.subscribers.add(callback);
  // Dacă cineva se abonează DUPĂ ce datele au sosit deja (ex. al doilea
  // ecran vizitat în aceeași sesiune), primește imediat ultimele date
  // cunoscute — fără nicio citire Firestore nouă.
  if (entry.lastRows) callback(entry.lastRows);

  return () => {
    entry.subscribers.delete(callback);
    if (entry.subscribers.size === 0) {
      entry.unsubscribe();
      stores.delete(gameweekId);
    }
  };
}

// ── Citire sincronă, FĂRĂ abonare — pentru consumatori ocazionali (ex.
// Surprize) care vor să reutilizeze datele DOAR dacă sunt deja
// disponibile (pentru că Home/LIVE sunt/au fost active în sesiune),
// fără să creeze ei înșiși niciun listener. Întoarce null dacă nimeni
// nu a încărcat încă meciurile acestei etape — apelantul rămâne liber
// să facă citirea lui obișnuită în acest caz (comportament neschimbat). ──
export function getLastKnownMatches(gameweekId) {
  return stores.get(gameweekId)?.lastRows || null;
}
