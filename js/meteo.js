// Meteo di un evento (Open-Meteo). Porta della logica di Meteo.kt.

const TTL_CACHE_MS = 3 * 3600 * 1000;
const TIMEOUT_MS = 8000;
const GIORNI_MAX = 15;

const DESCRIZIONI = {
  0: ['Sereno', '☀️'],
  1: ['Prevalentemente sereno', '🌤️'],
  2: ['Parzialmente nuvoloso', '⛅'],
  3: ['Coperto', '☁️'],
  45: ['Nebbia', '🌫️'], 48: ['Nebbia', '🌫️'],
  51: ['Pioviggine', '🌦️'], 53: ['Pioviggine', '🌦️'], 55: ['Pioviggine', '🌦️'],
  56: ['Pioviggine gelata', '🌧️'], 57: ['Pioviggine gelata', '🌧️'],
  61: ['Pioggia debole', '🌦️'], 63: ['Pioggia', '🌧️'], 65: ['Pioggia intensa', '🌧️'],
  66: ['Pioggia gelata', '🌧️'], 67: ['Pioggia gelata', '🌧️'],
  71: ['Neve', '🌨️'], 73: ['Neve', '🌨️'], 75: ['Neve', '🌨️'], 77: ['Neve', '🌨️'],
  80: ['Rovesci deboli', '🌦️'], 81: ['Rovesci', '🌧️'], 82: ['Rovesci violenti', '⛈️'],
  85: ['Rovesci di neve', '🌨️'], 86: ['Rovesci di neve', '🌨️'],
  95: ['Temporale', '⛈️'], 96: ['Temporale con grandine', '⛈️'], 99: ['Temporale con grandine', '⛈️'],
};

export function descrizioneMeteo(codice) {
  return (DESCRIZIONI[codice] || ['Variabile', '🌥️'])[0];
}

export function emojiMeteo(codice) {
  return (DESCRIZIONI[codice] || ['Variabile', '🌥️'])[1];
}

export function consiglioMeteo({ percepita, pioggia, vento, codice }) {
  const parti = [];
  const t = percepita;
  if (t < 4) parti.push('Fa molto freddo: cappotto pesante, sciarpa, guanti e cappello.');
  else if (t < 9) parti.push('Freddo: giacca imbottita, sciarpa e cappello.');
  else if (t < 14) parti.push('Fresco: giacca e strati a cipolla.');
  else if (t < 20) parti.push('Mite: maglione leggero o felpa.');
  else parti.push('Piacevole: abiti leggeri, porta una felpa per la sera.');
  if (pioggia >= 50 || (codice >= 51 && codice <= 67) || (codice >= 80 && codice <= 82) || codice >= 95) {
    parti.push("Porta impermeabile o ombrello e scarpe che reggano l'acqua.");
  } else if (pioggia >= 30) {
    parti.push("Possibile pioggia: un k-way in tasca.");
  }
  if (vento >= 35) parti.push('Vento forte: meglio un cappuccio ben fissato.');
  if ((codice >= 71 && codice <= 77) || codice === 85 || codice === 86) parti.push('Possibile neve: scarpe con buona suola.');
  return parti.join(' ');
}

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

/** Parti data/ora locali (nel fuso) di un istante. */
function partiLocali(quando, fuso) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: fuso, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    }).formatToParts(quando).map((x) => [x.type, x.value]),
  );
  return { giorno: `${p.year}-${p.month}-${p.day}`, ora: p.hour };
}

function costruisciOra(h, i) {
  const n = (k) => {
    const v = h[k] && h[k][i];
    return typeof v === 'number' && isFinite(v) ? v : 0;
  };
  const codice = Math.round(n('weather_code'));
  const o = {
    temperatura: n('temperature_2m'),
    percepita: n('apparent_temperature'),
    pioggia: Math.round(n('precipitation_probability')),
    vento: n('wind_speed_10m'),
    nuvole: Math.round(n('cloud_cover')),
    codice,
  };
  o.descrizione = descrizioneMeteo(codice);
  o.emoji = emojiMeteo(codice);
  o.consiglio = consiglioMeteo(o);
  return o;
}

function daCacheOk(c, daCache) {
  return { stato: 'ok', ora: c.ora, aggiornato: new Date(c.aggiornato), daCache };
}

export async function meteoEvento(ev, quando) {
  try {
    quando = quando instanceof Date && !isNaN(quando) ? quando : new Date();
    const chiave = 'meteo_' + ev.id;
    const cache = leggiCache(chiave);
    const ora0 = Date.now();

    const giorniMancanti = (quando.getTime() - ora0) / 86400000;
    if (giorniMancanti > GIORNI_MAX) {
      // fuori dall'orizzonte della previsione: se c'è una cache la mostriamo comunque
      if (cache && cache.ora) return daCacheOk(cache, true);
      return { stato: 'lontano', giorni: Math.ceil(giorniMancanti) };
    }

    const cacheValida = cache && cache.ora && typeof cache.aggiornato === 'number'
      && Math.abs(cache.quando - quando.getTime()) < 30 * 60000;
    if (cacheValida && ora0 - cache.aggiornato < TTL_CACHE_MS) return daCacheOk(cache, true);

    const fuso = ev.fuso || 'Europe/Dublin';
    const lat = ev.luogo && ev.luogo.lat;
    const lon = ev.luogo && ev.luogo.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') return { stato: 'errore' };

    try {
      const { giorno, ora } = partiLocali(new Date(quando.getTime() + 30 * 60000), fuso);
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(4)
        + '&longitude=' + lon.toFixed(4)
        + '&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,cloud_cover'
        + '&timezone=auto&start_date=' + giorno + '&end_date=' + giorno;
      const json = await scarica(url);
      const h = json.hourly;
      if (!h || !h.time) throw new Error('Risposta senza dati orari');
      const i = h.time.indexOf(`${giorno}T${ora}:00`);
      if (i < 0) throw new Error('Ora non disponibile');
      const o = costruisciOra(h, i);
      const aggiornato = Date.now();
      scriviCache(chiave, { quando: quando.getTime(), aggiornato, ora: o });
      return { stato: 'ok', ora: o, aggiornato: new Date(aggiornato), daCache: false };
    } catch (e) {
      if (cache && cache.ora) return daCacheOk(cache, true);
      return { stato: 'errore' };
    }
  } catch (e) {
    return { stato: 'errore' };
  }
}
