# 🔊 ASCUNSELEA — fișiere audio (opționale)

Jocul merge complet și fără ele: efectele și muzica sunt generate în cod, iar replicile apar scrise pe ecran.

## Cum adaugi un fișier (fără cod)
1. Urci fișierul .mp3 în acest folder: `public/audio/hideseek/`.
2. Îl treci în `manifest.json`, la grupa potrivită. Exemplu: `"voice": { "prins": "prins.mp3" }`.
3. Gata. Vocea coboară automat muzica cât vorbește. Un efect cu fișier îl înlocuiește pe cel generat.

## Voce ("voice")
| id | Ce spune | Când se aude |
|---|---|---|
| rhyme | Unu, doi, trei, patru, cinci, șase, șapte, opt, nouă, zece! Cine nu-i gata, îl iau cu lopata! | Vânătorul numără (prima confruntare a fiecărei ture) și intro-ul tragerii |
| count_3 | Trei… | Numărătoare scurtă |
| count_2 | Doi… | Numărătoare scurtă |
| count_1 | Unu! | Numărătoare scurtă |
| ready | Gata sau nu, vin! | Vânătorul pornește să caute |
| level_1 | Nivelul unu. Holul de intrare. | Intro nivel 1 |
| level_2 | Nivelul doi. Scările încrucișate. | Intro nivel 2 |
| level_3 | Nivelul trei. Labirintul. | Intro nivel 3 |
| level_4 | Nivelul patru. Turnul. | Intro nivel 4 |
| level_5 | Ultimul nivel. EXIT. | Intro nivel 5 |
| last_turn | Ultima tură. Treizeci de puncte. | Înainte de nivelul 5 |
| prins | PRINS! | Ușa deschisă, ascunsul e acolo |
| scapat | A SCĂPAT! | Ușa deschisă e goală |
| tie | Egalitate! Trei la trei. | Tură 3–3 |
| turn_win | Tura e câștigată! | Poster de tură |
| shutout | Șase la zero! Umilință! | Tură 6–0 |
| exit | EXIT! | Câștigătorul iese pe ușa finală |
| final | Și câștigătorul duelului este… | Posterul final |
| draw_intro | Tragerea la sorți. Nouă dueluri. Cinci niveluri. | Începutul show-ului perechilor |
| hunt | Let the hunt begin! | Finalul show-ului perechilor |
| cinema_intro | Bine ați venit la seara de proiecție! | Începutul modului cinema |
| titles | Și acum… titlurile săptămânii! | Finalul modului cinema |
| quip_caught | (râs batjocoritor) Te-ai ascuns ca pula! | Replică la PRINS |
| quip_escaped | (râs) Nu-l găsești nici cu mandat! | Replică la A SCĂPAT |
| quip_streak | Iar a scăpat! Houdini! | Serie de evadări |
| quip_blind | Bastonul alb e pe drum! | Vânător care nu nimerește |
| quip_same_door | Iar la aceeași ușă?! | Prinderi repetate la aceeași ușă |

## Muzică ("music") — buclă, se repetă
| id | Când |
|---|---|
| loop_0 | atmosferă (alegerea ușilor) |
| loop_1 | duel liniștit, tragerea |
| loop_2 | căutare, suspans |
| loop_3 | momentul deschiderii ușii |

## Efecte ("sfx") — înlocuiesc efectele generate
`step`, `door_open`, `door_close`, `handle`, `heart`, `riser`, `impact`, `whoosh`, `escape`, `victory`, `fail`, `siren`, `lift`, `lift_ding`, `tick`, `beep`, `confetti`, `shutter`, `box`, `flicker`, `slide`

Muzica și vocile din serial NU se folosesc (drepturi de autor).
