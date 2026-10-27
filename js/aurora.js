// Probabilità di aurora per una serata (NOAA Kp previsto + nuvolosità Open-Meteo). Porta di Aurora.kt.
import { istante } from './tempo.js';

const URL_PREVISTO = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
const URL_ATTUALE = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
const TTL_CACHE_MS = 3 * 3600 * 1000;
const TIMEOUT_MS = 10000;
const BLOCCO_MS = 3 * 3600 * 1000;
const LIVELLI = ['nulla', 'bassa', 'media', 'alta'];

function leggiCache(chiave) {
  try {
    const t = localStorage.getItem(chiave);
    return t ? JSON.parse(t) : null;
  } catch (e) {
    return null;
  }
}

function scriviCache(chiave, valore) {
  try {
    localStorage.setItem(chiave, JSON.stringify(valore));
  } catch (e) { /* storage non disponibile o pieno */ }
}

async function scarica(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Orario NOAA ("2026-10-30T00:00:00" o "2026-10-30 00:00:00", in UTC) -> millisecondi. */
function tempoNoaa(s) {
  const t = String(s).replace(' ', 'T');
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : t + 'Z');
  return isNaN(ms) ? null : ms;
}

/** Blocchi {inizio (ms UTC), kp} dalla previsione NOAA (accetta sia array di oggetti sia array di array). */
function leggiBlocchi(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (const r of arr) {
    let t;
    let kp;
    if (Array.isArray(r)) {
      t = r[0];
      kp = parseFloat(r[1]);
    } else if (r && typeof r === 'object') {
      t = r.time_tag;
      kp = parseFloat(r.kp);
    } else continue;
    const ms = tempoNoaa(t);
    if (ms !== null && isFinite(kp)) out.push({ inizio: ms, kp });
  }
  return out;
}

async function previsioneNoaa() {
  try {
    const blocchi = leggiBlocchi(await scarica(URL_PREVISTO));
    if (blocchi.length) {
      scriviCache('noaa_previsione', { blocchi, aggiornato: Date.now() });
      return { blocchi, daCache: false };
    }
  } catch (e) { /* si ripiega sulla cache */ }
  const c = leggiCache('noaa_previsione');
  if (c && Array.isArray(c.blocchi) && c.blocchi.length) return { blocchi: c.blocchi, daCache: true };
  return null;
}

/** Fuso della serata: a est di -3° di longitudine è il Regno Unito, altrimenti Irlanda. */
function fusoSerata(s) {
  return s.lon > -3 ? 'Europe/London' : 'Europe/Dublin';
}

function giornoDopo(data) {
  const [y, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Nuvolosità media (%) tra le 19 e le 03 locali del punto buio. */
async function nuvoleMedie(lat, lon, data) {
  try {
    const dopo = giornoDopo(data);
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(4) + '&longitude=' + lon.toFixed(4)
      + '&hourly=cloud_cover&timezone=auto&start_date=' + data + '&end_date=' + dopo;
    const h = (await scarica(url)).hourly;
    const valori = [];
    for (let i = 0; i < h.time.length; i++) {
      const [g, ora] = h.time[i].split('T');
      const hh = parseInt(ora.slice(0, 2), 10);
      const dentro = (g === data && hh >= 19) || (g === dopo && hh <= 3);
      if (dentro && typeof h.cloud_cover[i] === 'number') valori.push(h.cloud_cover[i]);
    }
    if (!valori.length) return null;
    return Math.round(valori.reduce((a, b) => a + b, 0) / valori.length);
  } catch (e) {
    return null;
  }
}

function livelloDaKp(kp, nuvole) {
  let l = kp >= 5.5 ? 3 : kp >= 4.5 ? 2 : kp >= 3.5 ? 1 : 0;
  if (nuvole !== null && nuvole > 70 && l > 0) l -= 1;
  return l;
}

function testoRisultato(prob, kpMax, nuvole) {
  const kp = Math.round(kpMax * 10) / 10;
  let cielo = '';
  if (nuvole !== null) {
    if (nuvole > 70) cielo = ` Il cielo sarà molto coperto (${nuvole}% di nuvole): difficile vederla.`;
    else if (nuvole < 30) cielo = ` Cielo in gran parte sereno (${nuvole}% di nuvole).`;
    else cielo = ` Nuvolosità media ${nuvole}%.`;
  }
  const base = {
    nulla: `Aurora praticamente nulla: Kp massimo previsto ${kp}, troppo basso a questa latitudine.`,
    bassa: `Aurora poco probabile: Kp massimo previsto ${kp}. Con cielo limpido potresti vedere un debole chiarore a nord.`,
    media: `Aurora possibile: Kp massimo previsto ${kp}. Con cielo sereno vale la pena uscire a guardare.`,
    alta: `Aurora molto probabile: Kp massimo previsto ${kp}. Esci a guardare verso nord!`,
  }[prob];
  return base + cielo;
}

const TESTO_LONTANO = 'La previsione NOAA esce circa 3 giorni prima';

function nonDisponibile(testo) {
  return { disponibile: false, probabilita: null, kpMax: null, nuvole: null, testo, aggiornato: null, daCache: false };
}

function dalCache(c, daCache) {
  return {
    disponibile: !!c.disponibile,
    probabilita: c.probabilita ?? null,
    kpMax: c.kpMax ?? null,
    nuvole: c.nuvole ?? null,
    testo: c.testo,
    aggiornato: c.aggiornato ? new Date(c.aggiornato) : null,
    daCache,
  };
}

export async function auroraSerata(serata) {
  try {
    const chiave = 'aurora_' + serata.data;
    const cache = leggiCache(chiave);
    if (cache && cache.disponibile && typeof cache.aggiornato === 'number' && Date.now() - cache.aggiornato < TTL_CACHE_MS) {
      return dalCache(cache, true);
    }

    const fuso = fusoSerata(serata);
    const inizio = istante(serata.data, '19:00', fuso).getTime();
    const fine = istante(giornoDopo(serata.data), '03:00', fuso).getTime();

    const [previsione, nuvole] = await Promise.all([previsioneNoaa(), nuvoleMedie(serata.lat, serata.lon, serata.data)]);
    if (!previsione) {
      if (cache && cache.disponibile) return dalCache(cache, true);
      return nonDisponibile('Previsione non disponibile: serve una connessione internet.');
    }
    const { blocchi } = previsione;
    const ultimaFine = Math.max(...blocchi.map((b) => b.inizio)) + BLOCCO_MS;
    const primoInizio = Math.min(...blocchi.map((b) => b.inizio));
    if (inizio >= ultimaFine) return nonDisponibile(TESTO_LONTANO);
    if (fine <= primoInizio) return nonDisponibile('Serata già passata: la previsione NOAA non la copre più.');

    const nellaFinestra = blocchi.filter((b) => b.inizio < fine && b.inizio + BLOCCO_MS > inizio);
    if (!nellaFinestra.length) return nonDisponibile(TESTO_LONTANO);

    const kpMax = Math.max(...nellaFinestra.map((b) => b.kp));
    const nuv = nuvole !== null ? nuvole : (cache && typeof cache.nuvole === 'number' ? cache.nuvole : null);
    const probabilita = LIVELLI[livelloDaKp(kpMax, nuv)];
    const aggiornato = Date.now();
    const risultato = {
      disponibile: true, probabilita, kpMax, nuvole: nuv,
      testo: testoRisultato(probabilita, kpMax, nuv), aggiornato,
    };
    scriviCache(chiave, risultato);
    return dalCache(risultato, previsione.daCache);
  } catch (e) {
    return nonDisponibile('Previsione non disponibile.');
  }
}

/** Kp stimato adesso (NOAA, dato al minuto) oppure null. */
export async function kpAttuale() {
  try {
    const arr = await scarica(URL_ATTUALE);
    for (let i = arr.length - 1; i >= 0; i--) {
      const r = arr[i];
      const kp = [r.estimated_kp, r.kp_index].map(parseFloat).find((v) => isFinite(v));
      const t = tempoNoaa(r.time_tag);
      if (kp !== undefined && t !== null) return { kp, quando: new Date(t) };
    }
    return null;
  } catch (e) {
    return null;
  }
}
