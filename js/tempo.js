// Orari degli eventi: ogni evento ha data, ora e fuso propri (Europe/Rome, Europe/Dublin, Europe/London).

/** Minuti di scarto tra il fuso e UTC nell'istante dato. */
function scarto(fuso, quando) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: fuso, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(quando).map((x) => [x.type, x.value]),
  );
  const comeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((comeUtc - quando.getTime()) / 60000);
}

/** Istante (Date) di "AAAA-MM-GG" + "HH:MM" nell'orario locale del fuso. */
export function istante(data, ora, fuso) {
  const [y, m, d] = data.split('-').map(Number);
  const [h, mi] = (ora || '00:00').split(':').map(Number);
  const ingenuo = Date.UTC(y, m - 1, d, h, mi);
  let t = ingenuo - scarto(fuso, new Date(ingenuo)) * 60000;
  t = ingenuo - scarto(fuso, new Date(t)) * 60000; // ricontrolla a cavallo del cambio d'ora
  return new Date(t);
}

/** Istante d'inizio di un evento dell'itinerario. */
export const istanteEvento = (ev) => istante(ev.giorno, ev.ora, ev.fuso);

/** "HH:MM" dell'istante nel fuso indicato. */
export function oraNelFuso(quando, fuso) {
  return new Intl.DateTimeFormat('it-IT', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(quando);
}

export function etichettaFuso(fuso) {
  return { 'Europe/Rome': 'ITA', 'Europe/Dublin': 'IRL', 'Europe/London': 'UK' }[fuso] || '';
}

/** "tra 2 g 5 h", "tra 3 h 10 min", "tra 12 min". */
export function contoAllaRovescia(da, a) {
  let min = Math.max(0, Math.round((a - da) / 60000));
  const g = Math.floor(min / 1440); min -= g * 1440;
  const h = Math.floor(min / 60); min -= h * 60;
  if (g > 0) return `${g} g ${h} h`;
  if (h > 0) return `${h} h ${min} min`;
  return `${min} min`;
}

/** Link Google Maps con il percorso in auto verso la destinazione (si tocca "Avvia" in Maps). */
export function linkNaviga(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}
