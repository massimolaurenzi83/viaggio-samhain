// Audioguida: lettura ad alta voce in italiano con la Web Speech API (speechSynthesis).
// - sceglie la migliore voce it-IT disponibile (attende "voiceschanged", che su Chrome Android arriva in ritardo)
// - spezza il testo in blocchi brevi e li legge in coda (Chrome taglia le utterance lunghe)
// - la pausa ferma la lettura e ricorda il blocco (pause/resume nativi sono inaffidabili su Android)
// - lo stato e' globale e osservabile dall'interfaccia (osserva)

const sy = (typeof window !== 'undefined' && 'speechSynthesis' in window) ? window.speechSynthesis : null;

/** Stato globale della lettura. stato: 'fermo' | 'lettura' | 'pausa' | 'errore'. */
const S = {
  id: null, titolo: '', blocchi: [], indice: 0,
  stato: 'fermo', errore: null, silenzioso: false, interrotta: false,
};

const osservatori = new Set();
let token = 0;            // invalida i callback delle utterance annullate
let tenere = [];          // riferimenti alle utterance (Chrome le butta via con il GC e perde onend)
let voceScelta = null;
let vociPronte = null;

export const supportata = () => !!sy && typeof SpeechSynthesisUtterance !== 'undefined';

function notifica() {
  const s = stato();
  osservatori.forEach((f) => { try { f(s); } catch (e) { /* un osservatore rotto non ferma gli altri */ } });
}

/** Copia dello stato corrente, con avanzamento (0..1) e numero di parte (1..totale). */
export function stato() {
  const totale = S.blocchi.length;
  return {
    id: S.id, titolo: S.titolo, stato: S.stato, errore: S.errore, silenzioso: S.silenzioso, interrotta: S.interrotta,
    indice: S.indice, parte: Math.min(S.indice + 1, Math.max(totale, 1)), totale,
    avanzamento: totale ? Math.min(1, S.indice / totale) : 0,
  };
}

/** Registra un osservatore; restituisce la funzione per annullarlo. */
export function osserva(fn) {
  osservatori.add(fn);
  return () => osservatori.delete(fn);
}

// ------------------------------------------------------------------ voci

function elencoVoci() {
  try { return sy ? (sy.getVoices() || []) : []; } catch (e) { return []; }
}

const eItaliana = (v) => /^it([-_]|$)/i.test(v.lang || '');

function punteggio(v) {
  const n = (v.name || '').toLowerCase();
  let p = 0;
  if (/^it[-_]it$/i.test(v.lang || '')) p += 20;
  if (n.includes('google')) p += 50;
  if (/natural|neural|online|wavenet/.test(n)) p += 45;
  if (/premium|enhanced|migliorat/.test(n)) p += 35;
  if (/compact/.test(n)) p -= 10;
  if (v.default) p += 3;
  return p;
}

function scegliVoce(voci) {
  const it = voci.filter(eItaliana);
  if (!it.length) return null;
  return it.slice().sort((a, b) => punteggio(b) - punteggio(a))[0];
}

/** Attende l'elenco delle voci (fino a ~3 s). Se resta vuoto, la prossima chiamata riprova. */
function attendiVoci() {
  if (vociPronte) return vociPronte;
  vociPronte = new Promise((risolvi) => {
    if (!sy) { risolvi([]); return; }
    if (elencoVoci().length) { risolvi(elencoVoci()); return; }
    let fatto = false;
    let iv = 0; let to = 0;
    const fine = () => {
      if (fatto) return;
      fatto = true;
      clearInterval(iv); clearTimeout(to);
      try { sy.removeEventListener('voiceschanged', su); } catch (e) { /* vecchi browser */ }
      risolvi(elencoVoci());
    };
    const su = () => { if (elencoVoci().length) fine(); };
    try { sy.addEventListener('voiceschanged', su); } catch (e) { sy.onvoiceschanged = su; }
    iv = setInterval(su, 250);
    to = setTimeout(fine, 3000);
  }).then((v) => { if (!v.length) vociPronte = null; return v; });
  return vociPronte;
}

/**
 * Controlla le voci italiane.
 * stato: 'ok' (voce trovata) | 'nessuna' (ci sono voci ma nessuna italiana) |
 *        'sconosciuta' (il browser non elenca voci: si prova comunque) | 'non-supportata'.
 */
export async function voceItaliana() {
  if (!supportata()) return { stato: 'non-supportata', voce: null, nome: '', quante: 0, totali: 0 };
  const voci = await attendiVoci();
  const it = voci.filter(eItaliana);
  voceScelta = scegliVoce(voci);
  if (!voci.length) return { stato: 'sconosciuta', voce: null, nome: '', quante: 0, totali: 0 };
  if (!it.length) return { stato: 'nessuna', voce: null, nome: '', quante: 0, totali: voci.length };
  return { stato: 'ok', voce: voceScelta, nome: voceScelta.name, quante: it.length, totali: voci.length };
}

// ------------------------------------------------------------------ suddivisione del testo

const perFrasi = (t) => t.match(/[^.!?…;:]+[.!?…;:]*["»”')\]]*\s*|[.!?…;:]+\s*/g) || [t];
const perVirgole = (t) => t.match(/[^,]+,?\s*/g) || [t];
function perParole(t, max) {
  const out = [];
  let cur = '';
  for (const w of t.split(' ')) {
    if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else { cur = cur ? cur + ' ' + w : w; }
  }
  if (cur) out.push(cur);
  return out;
}

function raggruppa(pezzi, max, piuFine) {
  const out = [];
  let cur = '';
  for (const p of pezzi) {
    if ((cur + p).length <= max) { cur += p; continue; }
    if (cur.trim()) out.push(cur.trim());
    cur = '';
    if (p.length > max) out.push(...piuFine(p)); else cur = p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Spezza il testo in blocchi sotto `max` caratteri, preferendo la fine di frase. */
export function spezza(testo, max = 190) {
  const pulito = String(testo || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  const blocchi = [];
  for (const par of pulito.split(/\n+/)) {
    const p = par.trim();
    if (!p) continue;
    blocchi.push(...raggruppa(perFrasi(p), max, (f) => raggruppa(perVirgole(f), max, (c) => perParole(c, max))));
  }
  return blocchi.filter((b) => /[\p{L}\p{N}]/u.test(b));
}

// ------------------------------------------------------------------ lettura in coda

let guardia = 0;

function errore(codice) {
  token++;
  try { sy && sy.cancel(); } catch (e) { /* niente */ }
  tenere = [];
  S.stato = 'errore';
  S.errore = codice;
  notifica();
}

function parla(i) {
  if (!sy) return;
  if (i >= S.blocchi.length) { chiudi(); return; }
  const mio = token;
  S.indice = i;
  S.stato = 'lettura';
  S.interrotta = false;
  notifica();

  const u = new SpeechSynthesisUtterance(S.blocchi[i]);
  u.lang = (voceScelta && voceScelta.lang) || 'it-IT';
  if (voceScelta) u.voice = voceScelta;
  u.rate = 0.96;
  u.pitch = 1;
  u.volume = 1;
  let partita = false;
  u.onstart = () => { partita = true; };
  u.onend = () => {
    if (mio !== token) return;
    tenere = tenere.filter((x) => x !== u);
    parla(i + 1);
  };
  u.onerror = (e) => {
    if (mio !== token) return;
    const er = e && e.error;
    if (er === 'interrupted' || er === 'canceled') return;
    errore(er === 'not-allowed' ? 'bloccato' : 'motore');
  };
  tenere.push(u);
  try { sy.speak(u); } catch (e) { errore('motore'); return; }

  // se il motore non parte entro 7 secondi (a pagina visibile) lo segnaliamo
  clearTimeout(guardia);
  guardia = setTimeout(() => {
    if (mio !== token || partita || S.stato !== 'lettura') return;
    if (document.visibilityState !== 'visible') return;
    if (sy.speaking || sy.pending) return;
    errore('motore');
  }, 7000);
}

function chiudi() {
  clearTimeout(guardia);
  token++;
  tenere = [];
  S.stato = 'fermo';
  S.id = null; S.titolo = ''; S.blocchi = []; S.indice = 0; S.errore = null; S.silenzioso = false; S.interrotta = false;
  notifica();
}

/** Avvia la lettura di `testo` per l'elemento `id`. Va chiamata da un tocco dell'utente. */
export function leggi(id, titolo, testo, opzioni = {}) {
  clearTimeout(guardia);
  token++;
  tenere = [];
  S.id = id; S.titolo = titolo || ''; S.silenzioso = !!opzioni.silenzioso;
  S.blocchi = []; S.indice = 0; S.errore = null; S.interrotta = false;
  if (!supportata()) { S.stato = 'errore'; S.errore = 'non-supportata'; notifica(); return; }
  try { sy.cancel(); } catch (e) { /* niente */ }

  const voci = elencoVoci();
  if (voci.length) {
    voceScelta = scegliVoce(voci);
    if (!voceScelta) { S.stato = 'errore'; S.errore = 'nessuna-voce'; notifica(); return; }
  } // se l'elenco e' vuoto si prova comunque con lang it-IT: sceglie il browser

  S.blocchi = spezza(testo);
  if (!S.blocchi.length) { S.stato = 'errore'; S.errore = 'motore'; notifica(); return; }
  S.stato = 'lettura';
  notifica();
  // piccola attesa dopo cancel(): su Chrome un speak() immediato puo' essere ignorato
  const mio = token;
  setTimeout(() => { if (mio === token) parla(0); }, 60);
}

/** Pausa: ferma la lettura e ricorda il blocco corrente. */
export function pausa() {
  if (S.stato !== 'lettura') return;
  clearTimeout(guardia);
  token++;
  tenere = [];
  try { sy.cancel(); } catch (e) { /* niente */ }
  S.stato = 'pausa';
  notifica();
}

/** Riprende dall'inizio del blocco in cui ci si era fermati. */
export function riprendi() {
  if (S.stato !== 'pausa') return;
  token++;
  S.stato = 'lettura';
  S.interrotta = false;
  notifica();
  const mio = token;
  setTimeout(() => { if (mio === token) parla(S.indice); }, 80);
}

export function ferma() {
  clearTimeout(guardia);
  token++;
  tenere = [];
  try { sy && sy.cancel(); } catch (e) { /* niente */ }
  chiudi();
}

/** Toglie lo stato di errore (dopo aver sistemato la voce) senza avviare nulla. */
export function azzeraErrore() {
  if (S.stato !== 'errore') return;
  S.stato = 'fermo'; S.errore = null; S.id = null; S.titolo = '';
  notifica();
}

/** Lettura di prova per la schermata Info (non mostra il mini-player). */
export function prova(testo) {
  leggi('__prova__', 'Prova della voce', testo, { silenzioso: true });
}

// ------------------------------------------------------------------ eventi di sistema

if (sy) {
  attendiVoci().then(() => { voceScelta = scegliVoce(elencoVoci()); });

  // Se il sistema ferma la voce (schermo spento, cambio app) la lettura diventa "in pausa" riprendibile.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || S.stato !== 'lettura') return;
    const mio = token;
    setTimeout(() => {
      if (mio !== token || S.stato !== 'lettura') return;
      if (sy.speaking || sy.pending) return;
      token++;
      tenere = [];
      try { sy.cancel(); } catch (e) { /* niente */ }
      S.stato = 'pausa';
      S.interrotta = true;
      notifica();
    }, 700);
  });

  window.addEventListener('pagehide', () => { try { sy.cancel(); } catch (e) { /* niente */ } });
}
