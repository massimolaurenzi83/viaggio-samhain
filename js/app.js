// Viaggio di Halloween & Samhain 2026 - web app di sola consultazione (gemella dell'app Android).
// Router a hash + tutte le schermate. Vanilla JS, nessuna libreria, percorsi sempre relativi.
import { istanteEvento, etichettaFuso, contoAllaRovescia, linkNaviga } from './tempo.js';
import * as Audio from './audio.js';

/* =====================================================================
   Utilita'
   ===================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const num = (v, dec = 1) => Number(v).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const f1 = (n) => (Math.round(n * 10) / 10).toString();

/** Testo con a-capo -> paragrafi. */
const paragrafi = (t, cls = '') => String(t ?? '').split(/\n{2,}/).filter((p) => p.trim())
  .map((p) => `<p${cls ? ` class="${cls}"` : ''}>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');

const dataUTC = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const fmtData = (iso, opz) => new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', ...opz }).format(dataUTC(iso));
const giornoLungo = (iso) => cap(fmtData(iso, { weekday: 'long', day: 'numeric', month: 'long' }));
const giornoCorto = (iso) => cap(fmtData(iso, { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', ''));
const meseBreve = (iso) => fmtData(iso, { month: 'short' }).replace('.', '');
const meseLungo = (iso) => fmtData(iso, { month: 'long' });
const giornoMese = (iso) => `${dataUTC(iso).getUTCDate()} ${meseBreve(iso)}`;

/** "AAAA-MM-GG" di adesso nel fuso indicato. */
const dataIn = (fuso, quando = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(quando);
const giorniTra = (a, b) => Math.round((dataUTC(b) - dataUTC(a)) / 86400000);
const oraHM = (quando, fuso) => new Intl.DateTimeFormat('it-IT', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(quando);
const dataOra = (quando) => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(quando).replace(',', '');

const FUSO_NOME = { 'Europe/Rome': 'ora italiana (ITA)', 'Europe/Dublin': 'ora irlandese (IRL)', 'Europe/London': 'ora di Manchester (UK)' };

/* =====================================================================
   Forme: foglia d'acero, triskele, nodo celtico, treccia
   ===================================================================== */

const LOBI = [[0, 1.0, 29], [60, 0.92, 28], [-60, 0.92, 28], [118, 0.70, 24], [-118, 0.70, 24]];
const R0 = 0.34;
function raggioFoglia(deg) {
  let r = R0;
  for (const l of LOBI) {
    const d = Math.abs((((deg - l[0] + 180) % 360) + 360) % 360 - 180);
    if (d < l[2]) {
      const x = 1 - d / l[2];
      r = Math.max(r, R0 + (l[1] - R0) * Math.pow(x, 0.9) * (1 + 0.10 * Math.cos((d / l[2]) * Math.PI * 3)));
    }
  }
  const ad = Math.abs(deg);
  if (ad > 140) r *= 0.45 + 0.55 * (180 - ad) / 40;
  return r;
}
const grezzo = (deg, r) => { const a = (deg * Math.PI) / 180; return [r * Math.sin(a), -r * Math.cos(a)]; };
const FOGLIA = (() => {
  const raw = Array.from({ length: 360 }, (_, i) => { const deg = -180 + i; return grezzo(deg, raggioFoglia(deg)); });
  const xs = raw.map((p) => p[0]); const ys = raw.map((p) => p[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const sc = 1 / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
  const n = (p) => [(p[0] - cx) * sc * 100, (p[1] - cy) * sc * 100];
  return {
    d: `M${raw.map((p) => n(p).map(f1).join(' ')).join('L')}Z`,
    origine: n([0, 0]),
    punte: LOBI.map((l) => n(grezzo(l[0], l[1] * 0.82))),
  };
})();

/** Foglia d'acero come SVG (usata come puntino elenco). */
const fogliaSvg = (cls = '') => `<svg class="foglia ${cls}" viewBox="-54 -54 108 108" aria-hidden="true"><path d="${FOGLIA.d}"/></svg>`;

/** Triskele: tre spirali in coordinate unitarie. */
const TRISKELE = (() => {
  const braccio = (phiDeg) => {
    const phi = (phiDeg * Math.PI) / 180;
    const d = 0.5; const rho0 = 0.5; const giri = 1.15;
    const cx = d * Math.cos(phi); const cy = d * Math.sin(phi);
    const a0 = phi + Math.PI;
    const sx = cx + rho0 * Math.cos(a0); const sy = cy + rho0 * Math.sin(a0);
    const tx = -Math.sin(a0); const ty = Math.cos(a0);
    const p1x = 0.55 * Math.cos(phi - 1.0) * d * 0.9; const p1y = 0.55 * Math.sin(phi - 1.0) * d * 0.9;
    const p2x = sx - tx * 0.35; const p2y = sy - ty * 0.35;
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const t = i / 14; const u = 1 - t;
      pts.push([3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * sx, 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t * sy]);
    }
    for (let i = 0; i <= 40; i++) {
      const t = i / 40; const rho = rho0 * (1 - 0.82 * t); const a = a0 + t * giri * 2 * Math.PI;
      pts.push([cx + rho * Math.cos(a), cy + rho * Math.sin(a)]);
    }
    return pts;
  };
  return [0, 1, 2].map((i) => braccio(-90 + i * 120));
})();
const triskelePercorsi = (cx, cy, r) => TRISKELE.map((arm) => `M${arm.map((p) => `${f1(cx + p[0] * r)} ${f1(cy + p[1] * r)}`).join('L')}`);

/** Nodo a trifoglio con intreccio sopra/sotto (tratto per tratto come nell'app Android). */
const NODO = (() => {
  const N = 220;
  const punti = Array.from({ length: N }, (_, i) => {
    const t = (2 * Math.PI * i) / N;
    return [(Math.sin(t) + 2 * Math.sin(2 * t)) / 3.05, (Math.cos(t) - 2 * Math.cos(2 * t)) / 3.05];
  });
  const z = Array.from({ length: N }, (_, i) => -Math.sin((3 * 2 * Math.PI * i) / N));
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const interseca = (p1, p2, p3, p4) => {
    const d1 = cross(p3, p4, p1); const d2 = cross(p3, p4, p2); const d3 = cross(p1, p2, p3); const d4 = cross(p1, p2, p4);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  const sopra = [];
  for (let i = 0; i < N; i++) {
    const a1 = punti[i]; const a2 = punti[(i + 1) % N];
    for (let j = i + 2; j < N; j++) {
      if (i === 0 && j === N - 1) continue;
      if (interseca(a1, a2, punti[j], punti[(j + 1) % N])) {
        const over = z[i] > z[j] ? i : j;
        const pezzo = [];
        for (let k = -12; k <= 12; k++) pezzo.push((over + k + N) % N);
        sopra.push(pezzo);
      }
    }
  }
  return { punti, sopra };
})();

const COL_NODO = { fill: '#E8B04B', outline: '#4A2E12', shine: 'rgba(255,239,184,.8)' };

function nodoSvg(rotDeg, lato = 30) {
  const c = lato / 2; const raggio = lato * 0.42; const nastro = 3.0;
  const rad = (rotDeg * Math.PI) / 180; const cr = Math.cos(rad); const sr = Math.sin(rad);
  const pts = NODO.punti.map((p) => [c + (p[0] * cr - p[1] * sr) * raggio, c + (p[0] * sr + p[1] * cr) * raggio]);
  const P = (a) => a.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join('');
  const intero = `${P(pts)}Z`;
  const sopra = NODO.sopra.map((pz) => P(pz.map((k) => pts[k]))).join('');
  const strati = (d, cap) => `<path d="${d}" stroke="${COL_NODO.outline}" stroke-width="${f1(nastro * 1.76)}"/><path d="${d}" stroke="${COL_NODO.fill}" stroke-width="${nastro}"/><path d="${d}" stroke="${COL_NODO.shine}" stroke-width="${f1(nastro * 0.26)}"/>`.replace(/<path /g, `<path stroke-linecap="${cap}" `);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lato} ${lato}" width="${lato}" height="${lato}"><g fill="none" stroke-linejoin="round">${strati(intero, 'round')}${strati(sopra, 'butt')}</g></svg>`;
}

/** Treccia celtica con triskele centrale, come divisore (viewBox fisso, scalato in larghezza). */
function divisoreSvg(scuro) {
  const W = 320; const H = 26; const cy = H / 2;
  const fill = scuro ? '#E8B04B' : '#D59A32';
  const outline = scuro ? '#4A2E12' : '#3A2414';
  const shine = 'rgba(255,239,184,.67)';
  const amp = H * 0.26; const period = amp * 2.3; const nastro = 2.4; const ow = nastro * 0.38;
  const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  const treccia = (xa, xb) => {
    if (xb - xa < period) return '';
    const ampAt = (x) => amp * smooth(Math.min(x - xa, xb - x) / (period * 1.6));
    const yy = (x, s) => cy + s * ampAt(x) * Math.sin((Math.PI * (x - xa)) / period);
    const percorso = (x0, x1, s) => { let d = `M${f1(x0)} ${f1(yy(x0, s))}`; let x = x0; while (x < x1) { x = Math.min(x + 2, x1); d += `L${f1(x)} ${f1(yy(x, s))}`; } return d; };
    const strati = (d, cap) => `<path stroke-linecap="${cap}" d="${d}" stroke="${outline}" stroke-width="${f1(nastro + 2 * ow)}"/><path stroke-linecap="${cap}" d="${d}" stroke="${fill}" stroke-width="${nastro}"/><path stroke-linecap="${cap}" d="${d}" stroke="${shine}" stroke-width="${f1(nastro * 0.26)}"/>`;
    let out = strati(percorso(xa, xb, 1), 'round') + strati(percorso(xa, xb, -1), 'round');
    for (let k = 1; xa + k * period < xb - period * 0.5; k++) {
      const xc = xa + k * period; const s = k % 2 === 0 ? 1 : -1;
      out += strati(percorso(Math.max(xa, xc - period * 0.42), Math.min(xb, xc + period * 0.42), s), 'butt');
    }
    return out;
  };
  const saltoCentro = 15;
  const r = H * 0.46; const w = 2.3;
  const tris = triskelePercorsi(W / 2, cy, r).map((d) => `<path d="${d}" stroke="${outline}" stroke-width="${f1(w * 1.9)}"/>`).join('')
    + triskelePercorsi(W / 2, cy, r).map((d) => `<path d="${d}" stroke="${fill}" stroke-width="${w}"/>`).join('');
  return `<svg class="divisore" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g fill="none" stroke-linejoin="round" stroke-linecap="round">${treccia(8, W / 2 - saltoCentro)}${treccia(W / 2 + saltoCentro, W - 8)}${tris}</g></svg>`;
}
const divisore = (scuro = true, cls = '') => `<div class="div-celtico ${cls}">${divisoreSvg(scuro)}</div>`;

/* =====================================================================
   Glifi disegnati (porting di Icons.kt): viewBox 100x100, colore = currentColor,
   accento = --acc. Nessuna icona esterna.
   ===================================================================== */

const T = (w) => `fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const stella5 = (cx, cy, R, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rad = i % 2 ? r : R; d += `${i ? 'L' : 'M'}${f1(cx + rad * Math.cos(a))} ${f1(cy + rad * Math.sin(a))}`; } return `${d}Z`; };
const spirale = (giri, n, r0, r1, cx = 50, cy = 50) => { let d = ''; for (let i = 0; i <= n; i++) { const t = i / n; const a = t * giri * 2 * Math.PI; const r = r0 + (r1 - r0) * t; d += `${i ? 'L' : 'M'}${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}`; } return d; };
const nuvola = (dx = 0, dy = 0) => `<circle cx="${33 + dx}" cy="${56 + dy}" r="17"/><circle cx="${53 + dx}" cy="${44 + dy}" r="22"/><circle cx="${74 + dx}" cy="${56 + dy}" r="16"/><rect x="${18 + dx}" y="${54 + dy}" width="72" height="20" rx="10"/>`;
const orma = (x, y, rot) => `<g transform="rotate(${rot} ${x} ${y})"><ellipse cx="${x}" cy="${y + 13}" rx="11" ry="16"/><ellipse cx="${x}" cy="${y + 41}" rx="9" ry="7"/>${[-9, -3, 3, 9].map((dx, i) => `<circle cx="${x + dx}" cy="${y - 10 + (i === 0 || i === 3 ? 3 : 0)}" r="${f1(3.6 - i * 0.2)}"/>`).join('')}</g>`;
const PENT = (() => { let d = ''; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; d += `${i ? 'L' : 'M'}${f1(50 + 15 * Math.cos(a))} ${f1(50 + 15 * Math.sin(a))}`; } return `${d}Z`; })();
const RAGGI_PALLONE = [0, 1, 2, 3, 4].map((i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return `<line x1="${f1(50 + 15 * Math.cos(a))}" y1="${f1(50 + 15 * Math.sin(a))}" x2="${f1(50 + 40 * Math.cos(a))}" y2="${f1(50 + 40 * Math.sin(a))}" stroke="currentColor" stroke-width="4.5"/>`; }).join('');
const RAGGI_SOLE = [...Array(12).keys()].map((i) => { const a = (i * Math.PI) / 6; return `<line x1="${f1(50 + 32 * Math.cos(a))}" y1="${f1(50 + 32 * Math.sin(a))}" x2="${f1(50 + 45 * Math.cos(a))}" y2="${f1(50 + 45 * Math.sin(a))}"/>`; }).join('');
const DENTI = [...Array(8).keys()].map((i) => { const a = (i * Math.PI) / 4; return `<line x1="${f1(50 + 30 * Math.cos(a))}" y1="${f1(50 + 30 * Math.sin(a))}" x2="${f1(50 + 44 * Math.cos(a))}" y2="${f1(50 + 44 * Math.sin(a))}" stroke="currentColor" stroke-width="12"/>`; }).join('');
const CUORE = 'M0 0C-24 -14 -16 -40 0 -26C16 -40 24 -14 0 0Z';
const FIAMMA = 'M50 4C56 22 82 34 82 62C82 82 68 96 50 96C32 96 18 82 18 62C18 48 26 40 32 32C33 42 38 48 42 48C42 34 44 18 50 4Z';
const FIAMMA_INT = 'M50 44C54 56 68 62 68 76C68 86 60 92 50 92C40 92 32 86 32 76C32 68 38 64 42 58C44 62 46 64 48 64C48 56 48 50 50 44Z';
const CORVO = 'M4 24C10 21 16 18 22 15C25 7 34 4 40 9C45 13 47 18 51 22C63 24 79 35 92 58L104 80L95 76L94 85L85 77L80 81L74 70C66 68 56 64 50 56C45 50 43 44 41 37C38 32 34 30 28 30C22 29 16 27 11 26Z';
const stella4 = (cx, cy, r) => `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;
const MI = (x, y, w, h, r, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${extra}/>`;
const ACC = (inner, op) => `<g class="acc"${op ? ` opacity="${op}"` : ''}>${inner}</g>`;
const ACCS = (inner, w, op) => `<g class="accs" stroke-width="${w}" stroke-linecap="round"${op ? ` opacity="${op}"` : ''}>${inner}</g>`;

const GL = {
  aereo: () => `<g transform="rotate(40 50 50)"><path d="M50 6C55 6 57 14 57 24L57 38L94 60L94 70L57 59L57 80L70 90L70 96L50 90L30 96L30 90L43 80L43 59L6 70L6 60L43 38L43 24C43 14 45 6 50 6Z"/></g>`,
  auto: () => `<path fill-rule="evenodd" d="M8 66L8 54Q8 47 16 45L28 43L38 28Q41 24 46 24L66 24Q71 24 74 28L84 43L88 45Q96 47 96 54L96 66Z M40 41L46 31L54 31L54 41Z M60 41L60 31L66 31L73 41Z"/><circle cx="28" cy="68" r="11"/><circle cx="76" cy="68" r="11"/>`,
  mercato: () => `<path d="M6 42L50 10L94 42Z"/>${[0, 1, 2, 3, 4].map((i) => `<circle cx="${15 + i * 17.5}" cy="43" r="8.8"/>`).join('')}<path ${T(4)} d="M18 50L18 92M82 50L82 92"/>${MI(12, 70, 76, 8, 3)}`,
  stella: () => `<path d="${stella5(50, 53, 46, 19)}"/>`,
  casa: () => '<path fill-rule="evenodd" d="M50 8L94 48L82 48L82 90L18 90L18 48L6 48Z M42 90L42 62L58 62L58 90Z"/>',
  castello: () => '<path fill-rule="evenodd" d="M8 92L8 26L20 26L20 34L30 34L30 26L36 26L36 46L64 46L64 26L70 26L70 34L80 34L80 26L92 26L92 92Z M42 92L42 68Q50 56 58 68L58 92Z M16 46L16 56L24 56L24 46Z M76 46L76 56L84 56L84 46Z"/>',
  triskele: () => triskelePercorsi(50, 52, 44).map((d) => `<path ${T(8)} d="${d}"/>`).join(''),
  fuoco: () => `<g transform="translate(14 2) scale(.72)"><path d="${FIAMMA}"/><path class="acc" d="${FIAMMA_INT}"/></g>`,
  rombo: () => `<path ${T(9)} d="M50 8L90 50L50 92L10 50Z"/><path d="M50 30L70 50L50 70L30 50Z"/>`,
  valigia: () => `<path ${T(7)} d="M36 30L36 18L64 18L64 30"/>${MI(10, 30, 80, 58, 9)}${ACCS('<path d="M10 54L90 54"/>', 3.5, '.55')}${ACC(MI(44, 49, 12, 10, 2), '.75')}`,
  spirale: () => `<path ${T(7.5)} d="${spirale(2.6, 140, 5, 46)}"/>`,
  bus: () => `<path fill-rule="evenodd" d="M20 14H80Q90 14 90 24V70Q90 80 80 80H20Q10 80 10 70V24Q10 14 20 14Z M18 24L46 24L46 46L18 46Z M54 24L82 24L82 46L54 46Z"/><circle cx="28" cy="84" r="9"/><circle cx="72" cy="84" r="9"/>${ACC('<rect x="14" y="60" width="72" height="4"/>', '.6')}`,
  chiesa: () => '<path fill-rule="evenodd" d="M50 4L58 28L58 46L94 56L94 94L6 94L6 56L42 46L42 28Z M44 94L44 70Q50 56 56 70L56 94Z M14 70L14 80Q18 72 22 80L22 70Q18 64 14 70Z M78 70L78 80Q82 72 86 80L86 70Q82 64 78 70Z"/>',
  cappello: () => `<path d="M26 62L30 26Q34 14 50 20Q66 14 70 26L74 62Z"/><ellipse cx="50" cy="68" rx="46" ry="12"/>${ACC('<rect x="27" y="50" width="46" height="8"/>', '.55')}`,
  libro: () => `<path d="M50 24C38 14 20 14 6 20L6 80C20 74 38 74 50 84C62 74 80 74 94 80L94 20C80 14 62 14 50 24Z"/>${ACCS('<path d="M50 26L50 82"/>', 3, '.6')}`,
  passi: () => orma(34, 40, -12) + orma(68, 44, 12),
  stadio: () => `<ellipse cx="50" cy="50" rx="44" ry="30" ${T(7)}/><ellipse cx="50" cy="50" rx="26" ry="16" ${T(4)}/><path ${T(3.5)} d="M50 34L50 66M6 50L22 50M78 50L94 50M20 14L20 4M80 14L80 4"/>`,
  pallone: () => `<circle cx="50" cy="50" r="42" ${T(6)}/><path d="${PENT}"/>${RAGGI_PALLONE}`,
  trifoglio: () => `${[0, 1, 2].map((k) => `<path transform="translate(50 52) rotate(${k * 120})" d="${CUORE}"/>`).join('')}<path ${T(6)} d="M50 52Q56 78 72 92"/>`,
  luna: () => '<path d="M43.3 10.6A40 40 0 1 0 83.3 72.2A37 37 0 0 1 43.3 10.6Z"/><circle cx="76" cy="72" r="6"/>',
  sole: () => `<circle cx="50" cy="50" r="22" ${T(7)}/><g ${T(5)}>${RAGGI_SOLE}</g><path ${T(4)} d="${spirale(2.4, 40, 3, 17)}"/>`,
  corvo: () => `<g transform="translate(0 8)"><path d="${CORVO}"/>${ACC('<circle cx="31" cy="14" r="1.6"/>')}</g>`,
  libri: () => `${MI(8, 30, 18, 60, 3)}${MI(30, 18, 20, 72, 3)}${MI(54, 26, 16, 64, 3)}<g transform="rotate(14 80 90)">${MI(72, 28, 18, 62, 3)}</g>${ACCS('<path d="M30 34L50 34"/>', 3, '.6')}`,
  // interfaccia
  home: () => GL.casa(),
  pin: () => '<path fill-rule="evenodd" d="M50 94C20 58 16 46 16 36C16 18 31 6 50 6C69 6 84 18 84 36C84 46 80 58 50 94Z M36 36a14 14 0 1 0 28 0a14 14 0 1 0 -28 0Z"/>',
  naviga: () => '<path d="M50 6L88 92L50 72L12 92Z"/>',
  audio: () => `<path d="M10 38L30 38L56 14L56 86L30 62L10 62Z"/><path ${T(6)} d="M69.6 36.2A18 18 0 0 1 69.6 63.8M82.7 24A26 34 0 0 1 82.7 76"/>`,
  pausa: () => `${MI(22, 14, 20, 72, 4)}${MI(58, 14, 20, 72, 4)}`,
  play: () => '<path d="M26 10L88 50L26 90Z"/>',
  stop: () => MI(18, 18, 64, 64, 8),
  orologio: () => `<circle cx="50" cy="50" r="42" ${T(7)}/><path ${T(7)} d="M50 24L50 52L70 62"/>`,
  biglietto: () => '<path fill-rule="evenodd" d="M12 22H88Q94 22 94 28V40a10 10 0 0 0 0 20V72Q94 78 88 78H12Q6 78 6 72V60a10 10 0 0 0 0 -20V28Q6 22 12 22Z M60 30L66 30L66 70L60 70Z"/>',
  lampada: () => `<circle cx="50" cy="38" r="26"/>${MI(36, 66, 28, 22, 6)}${ACCS('<path d="M38 74L62 74"/>', 3, '.6')}`,
  pergamena: () => `${MI(20, 12, 60, 76, 8)}<circle cx="20" cy="14" r="9"/><circle cx="80" cy="86" r="9"/>${ACCS([0, 1, 2, 3].map((i) => `<path d="M32 ${30 + i * 14}L68 ${30 + i * 14}"/>`).join(''), 3.5, '.7')}`,
  link: () => `<rect x="6" y="34" width="48" height="32" rx="16" ${T(8)}/><rect x="46" y="34" width="48" height="32" rx="16" ${T(8)}/>`,
  aurora: () => `${[0, 1, 2, 3].map((k) => { const x = 14 + k * 24; return `<path ${T(9)} opacity="${f1(1 - k * 0.1)}" d="M${x} 80C${x - 16} 62 ${x + 16} 46 ${x - 6} 28C${x - 14} 20 ${x + 4} 12 ${x + 2} 4"/>`; }).join('')}${ACC('<path d="M0 100C25 76 55 92 100 74L100 100Z" opacity=".9"/>')}${ACC(`<path d="${stella4(90, 16, 8)}"/>`)}`,
  ingranaggio: () => `${DENTI}<circle cx="50" cy="50" r="31" ${T(11)}/><circle cx="50" cy="50" r="9"/>`,
  campana: () => '<path d="M50 10C26 10 24 34 24 50L14 72L86 72L76 50C76 34 74 10 50 10Z"/><circle cx="50" cy="84" r="9"/>',
  spunta: () => `<path ${T(12)} d="M16 54L40 78L86 24"/>`,
  freccia: () => `<path ${T(12)} d="M60 16L26 50L60 84"/>`,
  info: () => `<circle cx="50" cy="50" r="40" ${T(7)}/><circle cx="50" cy="28" r="6"/><path ${T(9)} d="M50 44L50 72"/>`,
  letto: () => `${MI(6, 22, 10, 62, 3)}${MI(6, 54, 88, 20, 4)}${MI(20, 36, 26, 16, 7)}${MI(50, 42, 44, 10, 4)}<rect x="84" y="72" width="10" height="14"/>`,
  aggiorna: () => `<path ${T(9)} d="M82 46A32 32 0 1 0 78 68"/><path d="M90 20L90 52L58 48Z"/>`,
  // meteo
  meteo_sereno: () => GL.sole(),
  meteo_nuvoloso: () => nuvola(),
  meteo_poco: () => `${ACC('<circle cx="34" cy="34" r="18"/>')}${nuvola(6, 8)}`,
  meteo_pioggia: () => `${nuvola(0, -12)}${ACCS([0, 1, 2, 3].map((i) => `<path d="M${30 + i * 15} 76L${24 + i * 15} 92"/>`).join(''), 5)}`,
  meteo_neve: () => `${nuvola(0, -12)}${ACC([0, 1, 2, 3].map((i) => `<circle cx="${28 + i * 15}" cy="${82 + (i % 2 ? 7 : 0)}" r="4.5"/>`).join(''))}`,
  meteo_temporale: () => `${nuvola(0, -14)}${ACC('<path d="M54 66L38 86L50 86L44 100L66 78L54 78L60 66Z"/>')}`,
  meteo_nebbia: () => `<g ${T(7)}>${[0, 1, 2, 3].map((i) => `<path d="M${14 + (i % 2) * 8} ${28 + i * 17}L${86 - (i % 2) * 8} ${28 + i * 17}"/>`).join('')}</g>`,
  vento: () => `<g ${T(7)}><path d="M8 36L62 36C80 36 80 14 64 14"/><path d="M8 54L80 54C96 54 96 76 80 76"/><path d="M8 72L44 72"/></g>`,
  goccia: () => '<path d="M50 8C70 36 80 50 80 64C80 82 66 92 50 92C34 92 20 82 20 64C20 50 30 36 50 8Z"/>',
  mappa: () => `<path ${T(7)} d="M10 22L36 12L64 22L90 12L90 78L64 88L36 78L10 88Z"/><path ${T(6)} d="M36 12L36 78M64 22L64 88"/>`,
};

/** Glifo come SVG inline. */
const glifo = (nome, cls = '') => `<svg class="g ${cls}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${(GL[nome] || GL.stella)()}</svg>`;

const nomeGlifoMeteo = (c) => {
  if (c === 0 || c === 1) return 'meteo_sereno';
  if (c === 2) return 'meteo_poco';
  if (c === 3) return 'meteo_nuvoloso';
  if (c === 45 || c === 48) return 'meteo_nebbia';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'meteo_pioggia';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'meteo_neve';
  if (c >= 95 && c <= 99) return 'meteo_temporale';
  return 'meteo_nuvoloso';
};

const NOME_SIMBOLO = { prenotare: 'Da prenotare', imperdibile: 'Imperdibile', facoltativo: 'Facoltativo' };
const GLIFO_SIMBOLO = { prenotare: 'stella', imperdibile: 'fuoco', facoltativo: 'rombo' };
const simbolo = (k, cls = '') => `<span class="sim sim-${k} ${cls}" title="${esc(NOME_SIMBOLO[k] || k)}">${glifo(GLIFO_SIMBOLO[k] || 'stella')}<span class="solo-lettori">${esc(NOME_SIMBOLO[k] || k)}</span></span>`;
const medaglione = (icona, cls = '') => `<span class="medaglione ${cls}">${glifo(icona)}</span>`;

/* Ornamenti CSS generati: nodi celtici agli angoli delle pergamene, texture della carta. */
function installaOrnamenti() {
  const rad = document.documentElement.style;
  [0, 40, 80, 20].forEach((rot, i) => {
    rad.setProperty(`--nodo${i}`, `url("data:image/svg+xml,${encodeURIComponent(nodoSvg(rot, 30))}")`);
  });
}

/* =====================================================================
   Componenti
   ===================================================================== */

const perg = (inner, { cls = '', orn = true, href = '', attr = '' } = {}) => {
  const classe = `perg${orn ? ' orn' : ''}${cls ? ` ${cls}` : ''}`;
  const nodi = orn ? '<i class="nodi" aria-hidden="true"></i>' : '';
  return href
    ? `<a class="${classe}" href="${href}" ${attr}>${inner}${nodi}</a>`
    : `<div class="${classe}" ${attr}>${inner}${nodi}</div>`;
};
const notte = (inner, { cls = '', attr = '', href = '' } = {}) => (href
  ? `<a class="pannello ${cls}" href="${href}" ${attr}>${inner}</a>`
  : `<div class="pannello ${cls}" ${attr}>${inner}</div>`);
const titoloSez = (testo) => `<h3 class="tit-sez"><svg class="tit-tris" viewBox="0 0 24 24" aria-hidden="true">${triskelePercorsi(12, 12, 10.5).map((d) => `<path d="${d}" fill="none" stroke="#3A2414" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}${triskelePercorsi(12, 12, 10.5).map((d) => `<path d="${d}" fill="none" stroke="#D9661F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg><span>${esc(testo)}</span></h3>`;
const titoloHome = (testo) => `<h2 class="tit-home">${esc(testo)}</h2>${divisore(true, 'stretto')}`;
const bottone = ({ testo, icona = '', stile = '', cls = '', href = '', az = '', attr = '' }) => {
  const dentro = `${icona ? glifo(icona) : ''}<span>${esc(testo)}</span>`;
  const classe = `bott ${stile} ${cls}`.trim();
  if (href) return `<a class="${classe}" href="${esc(href)}" target="_blank" rel="noopener noreferrer" ${attr}>${dentro}</a>`;
  return `<button type="button" class="${classe}" ${az ? `data-az="${az}"` : ''} ${attr}>${dentro}</button>`;
};
const etichetta = (testo, tipo) => `<span class="eti eti-${tipo}">${esc(testo)}</span>`;

/* =====================================================================
   Dati e moduli opzionali (meteo e aurora li scrive un altro modulo: degradiamo se mancano)
   ===================================================================== */

let IT = null;          // itinerario.json
let EVENTI = [];        // eventi in ordine cronologico
const PER_ID = new Map();
let _meteo = null;
let _aurora = null;
const modMeteo = () => (_meteo ??= import('./meteo.js').catch(() => null));
const modAurora = () => (_aurora ??= import('./aurora.js').catch(() => null));

const eventoPerId = (id) => PER_ID.get(id);
const eventiDelGiorno = (data) => EVENTI.filter((e) => e.giorno === data);
const giornoPerData = (data) => IT.giorni.find((g) => g.data === data);
const haAudioVera = (ev) => !!(ev.audioguida && ev.audioguida.trim());
function testoGuida(ev) {
  if (haAudioVera(ev)) return ev.audioguida;
  return [ev.titolo, ev.sottotitolo, ev.luogo && ev.luogo.nome ? `Luogo: ${ev.luogo.nome}` : ''].filter(Boolean).join('. ') + '.';
}

const ESPERIENZE = [
  ['puca-trail', 'locandina/esp_1.webp'],
  ['ancestral-traditions', 'locandina/esp_2.webp'],
  ['tlachtga', 'locandina/esp_3.webp'],
  ['bru-na-boinne', 'locandina/esp_4.webp'],
];

const LIVELLI = {
  nulla: { n: 0, nome: 'Nulla', col: '#9aa3b5' },
  bassa: { n: 1, nome: 'Bassa', col: '#8FA3C7' },
  media: { n: 2, nome: 'Media', col: '#E8B04B' },
  alta: { n: 3, nome: 'Alta', col: '#58E0A8' },
};

/* =====================================================================
   Struttura comune delle schermate
   ===================================================================== */

const barraTitolo = (titolo) => `
  <div class="barra-titolo">
    <button type="button" class="indietro" data-az="indietro" aria-label="Indietro">${glifo('freccia')}</button>
    <div class="bt-testo">${esc(String(titolo).toUpperCase())}</div>
    <span class="bt-sp"></span>
  </div>`;

/** Elenco di funzioni di pulizia da eseguire quando si lascia la schermata. */
let pulizia = [];
const alla_chiusura = (f) => pulizia.push(f);
let rotaId = 0; // per scartare le risposte asincrone arrivate dopo aver cambiato schermata

/* =====================================================================
   HOME - la "locandina"
   ===================================================================== */

function trovaProssimo(adesso) {
  let corrente = null;
  for (const ev of EVENTI) {
    const t = istanteEvento(ev);
    const fine = new Date(t.getTime() + (ev.durata_min || 60) * 60000);
    if (t <= adesso && adesso < fine) corrente = ev;
    else if (t > adesso) return corrente ? { ev: corrente, inCorso: true } : { ev, inCorso: false };
  }
  return corrente ? { ev: corrente, inCorso: true } : null;
}

/** "2 giorni e 3 ore", "3 ore e 10 min", "12 min" (la funzione di tempo.js resta per i testi brevi). */
function conto(da, a) {
  const breve = contoAllaRovescia(da, a); // es. "2 g 3 h"
  const m = breve.match(/^(\d+) g (\d+) h$/);
  if (m) return `${m[1]} ${m[1] === '1' ? 'giorno' : 'giorni'} e ${m[2]} ${m[2] === '1' ? 'ora' : 'ore'}`;
  const n = breve.match(/^(\d+) h (\d+) min$/);
  if (n) return `${n[1]} ${n[1] === '1' ? 'ora' : 'ore'} e ${n[2]} min`;
  return breve;
}

function htmlProssimo() {
  const adesso = new Date();
  const p = trovaProssimo(adesso);
  if (!p) {
    return perg(`<p class="vuoto">${EVENTI.length && adesso < istanteEvento(EVENTI[0]) ? 'Il viaggio sta per cominciare.' : 'Nessun altro evento in programma. Buon rientro!'}</p>`);
  }
  const { ev, inCorso } = p;
  const t = istanteEvento(ev);
  const grande = inCorso ? `Cominciato alle ${esc(ev.ora)}` : `Tra ${conto(adesso, t)}`;
  const s = Audio.stato();
  const mio = s.id === ev.id && (s.stato === 'lettura' || s.stato === 'pausa');
  const inLettura = mio && s.stato === 'lettura';
  const testoAsc = inLettura ? 'Pausa' : (mio ? 'Riprendi' : 'Ascolta');
  const iconaAsc = inLettura ? 'pausa' : (mio ? 'play' : 'audio');
  const luogo = ev.luogo && ev.luogo.nome ? ` · ${esc(ev.luogo.nome)}` : '';
  return perg(`
    <p class="et-sez ${inCorso ? 'fuoco' : ''}">${inCorso ? 'In corso adesso' : 'Prossimo evento'}</p>
    <p class="pr-grande">${grande}</p>
    <a class="pr-riga" href="#/evento/${esc(ev.id)}">
      ${medaglione(ev.icona, 'm52')}
      <span class="pr-testi">
        <b class="pr-titolo">${esc(ev.titolo)}</b>
        <span class="pr-meta">${esc(giornoCorto(ev.giorno))} · ${esc(ev.ora)} ${etichettaFuso(ev.fuso)}${luogo}</span>
      </span>
    </a>
    <div class="riga-bott">
      ${ev.luogo ? bottone({ testo: 'Naviga', icona: 'naviga', href: linkNaviga(ev.luogo.lat, ev.luogo.lon) }) : ''}
      ${haAudioVera(ev) ? bottone({ testo: testoAsc, icona: iconaAsc, stile: 'contorno su-perg', az: 'ascolta', attr: `data-id="${esc(ev.id)}"` }) : ''}
    </div>`);
}

function htmlInfoBar() {
  const notti = (dal, al) => {
    const n = giorniTra(dal, al);
    const d1 = dataUTC(dal).getUTCDate(); const m = dataUTC(dal).getUTCMonth() + 1;
    if (n <= 1) return `Notte ${d1}/${m}`;
    return `Notti ${d1}–${dataUTC(al).getUTCDate() - 1}/${m}`;
  };
  const cella = (g, titolo, r1, r2) => `
    <div class="cella">${glifo(g, 'cella-g')}
      <div><h4>${esc(titolo)}</h4><p>${esc(r1)}</p>${r2 ? `<p class="sotto">${esc(r2)}</p>` : ''}</div>
    </div>`;
  const [base, dub, man] = IT.alloggi;
  const righe = [];
  if (base) righe.push(cella('casa', 'Base irlandese', base.nome, `${giornoMese(base.dal)} – ${giornoMese(base.al)}`));
  if (IT.auto) righe.push(cella('auto', 'Auto', `Ritiro: ${IT.auto.ritiro}`, `Riconsegna: ${IT.auto.riconsegna}`));
  if (dub) righe.push(cella('letto', 'Dublino', notti(dub.dal, dub.al), dub.indirizzo.split(',')[0]));
  if (man) righe.push(cella('letto', 'Manchester', notti(man.dal, man.al), man.indirizzo.split(',')[0]));
  return perg(righe.join('<hr class="filo">'), { cls: 'info-bar' });
}

function serataDiOggi() {
  const l = IT.serate_aurora || [];
  const oggi = dataIn('Europe/Dublin');
  return l.find((s) => s.data === oggi) || l.find((s) => s.data > oggi) || l[l.length - 1] || null;
}

function htmlAuroraStasera(serata, r) {
  let titolo; let sub = '';
  if (r && r.disponibile) {
    const lv = LIVELLI[r.probabilita] || LIVELLI.nulla;
    titolo = `Probabilità ${lv.nome.toLowerCase()}`;
    const kp = r.kpMax != null ? `Kp ${num(r.kpMax)}` : '';
    const nu = r.nuvole != null ? `nuvole ${Math.round(r.nuvole)}%` : '';
    sub = [kp, nu].filter(Boolean).join(' · ');
  } else {
    titolo = 'Previsione in arrivo';
    sub = 'I dati NOAA si fanno vedere circa 3 giorni prima.';
  }
  return `
    <div class="aur-onde" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="aur-riga">
      ${glifo('aurora', 'aur-g')}
      <div class="aur-testi">
        <p class="et-sez aur">Aurora stasera</p>
        <p class="aur-titolo">${esc(titolo)}</p>
        ${sub ? `<p class="aur-sub">${esc(sub)}</p>` : ''}
        ${serata ? `<p class="aur-punto">Punto buio: ${esc(serata.nome)}</p>` : ''}
      </div>
    </div>`;
}

function cardGiorno(g) {
  const n = eventiDelGiorno(g.data).length;
  const gg = dataUTC(g.data).getUTCDate();
  return perg(`
    <div class="gc-testa">
      <div><span class="gc-num">${gg}</span><span class="gc-mese">${esc(meseBreve(g.data).toUpperCase())}</span></div>
      ${glifo(g.icona, 'gc-ico')}
    </div>
    <div class="gc-nome">${esc(g.nome.toUpperCase())}</div>
    <div class="gc-img">${g.ritaglio ? `<img class="foto" src="${esc(g.ritaglio)}" alt="" loading="lazy" decoding="async">` : ''}<span class="gc-ico-fondo">${glifo(g.icona)}</span></div>
    <div class="gc-titolo">${esc(g.titolo)}</div>
    <div class="gc-tappe">${n} ${n === 1 ? 'tappa' : 'tappe'}</div>`,
  { href: `#/giorno/${g.data}`, orn: false, cls: 'gc', attr: `role="listitem" aria-label="${esc(giornoLungo(g.data))}: ${esc(g.titolo)}"` });
}

function cardEsperienza(id, img) {
  const ev = eventoPerId(id);
  if (!ev) return '';
  return perg(`
    <div class="ex-img"><img class="foto" src="${esc(img)}" alt="" loading="lazy" decoding="async"><span class="ex-stella">${simbolo('prenotare', 'su-scuro')}</span></div>
    <b class="ex-titolo">${esc(ev.titolo.split(' – ')[0].split(' - ')[0])}</b>
    <span class="ex-sub">${esc(ev.sottotitolo || (ev.luogo && ev.luogo.nome) || '')}</span>`,
  { href: `#/evento/${id}`, orn: false, cls: 'ex' });
}

function vistaHome() {
  const oggiR = dataIn('Europe/Rome');
  const g0 = IT.giorni[0].data; const gN = IT.giorni[IT.giorni.length - 1].data;
  let frase;
  if (oggiR < g0) { const n = giorniTra(oggiR, g0); frase = n === 1 ? 'Domani si parte!' : `Mancano ${n} giorni alla partenza`; }
  else if (oggiR <= gN) frase = `Giorno ${giorniTra(g0, oggiR) + 1} di ${IT.giorni.length}`;
  else frase = 'Il viaggio è concluso. Bentornato a casa!';
  const serata = serataDiOggi();

  const html = `
    <header class="testata">
      <img class="testata-img" src="locandina/header.webp" width="1024" height="318" alt="Viaggio di Halloween e Samhain 2026: Roma, Meath, Dublino, Manchester" fetchpriority="high">
      <div class="testata-sfuma"></div>
    </header>
    <div class="pagina">
      <p class="frase">${esc(frase.toUpperCase())}</p>
      ${divisore(true, 'stretto')}
      <section class="blocco" id="prossimo">${htmlProssimo()}</section>
      <section class="blocco">${htmlInfoBar()}</section>
      <section class="blocco">${notte(htmlAuroraStasera(serata, null), { href: '#/aurora', cls: 'aur-card', attr: 'id="aurora-stasera" aria-label="Aurora stasera: apri le previsioni"' })}</section>
      <section class="blocco largo">
        ${titoloHome('I sette giorni')}
        <div class="giorni" role="list">${IT.giorni.map(cardGiorno).join('')}</div>
      </section>
      <section class="blocco">
        ${titoloHome('4 esperienze da prenotare')}
        <div class="esperienze">${ESPERIENZE.map(([id, img]) => cardEsperienza(id, img)).join('')}</div>
      </section>
      <section class="blocco">
        ${notte(`
          <p class="et-sez">Legenda</p>
          <ul class="legenda">
            <li>${simbolo('imperdibile', 'su-scuro')}<span>imperdibile</span></li>
            <li>${simbolo('prenotare', 'su-scuro')}<span>da prenotare</span></li>
            <li>${simbolo('facoltativo', 'su-scuro')}<span>facoltativo</span></li>
          </ul>
          <p class="et-sez sep">Link utili</p>
          <ul class="legenda link">
            <li><a href="https://pucafestival.com" target="_blank" rel="noopener noreferrer">${glifo('link')}<span>pucafestival.com</span></a></li>
            <li><a href="https://heritageireland.ie" target="_blank" rel="noopener noreferrer">${glifo('link')}<span>heritageireland.ie</span></a></li>
          </ul>`)}
      </section>
      <footer class="piede">
        ${divisore(true)}
        <p class="piede-frase">Un viaggio tra antichi miti, paesaggi leggendari e atmosfere senza tempo</p>
        <p class="piede-nota">Orari soggetti a variazione · esperienze con la stella non ancora confermate</p>
        <svg class="piede-corvo" viewBox="0 0 104 90" aria-hidden="true"><path d="${CORVO}" fill="#05070C"/><circle cx="31" cy="14" r="1.5" fill="#E8B04B"/></svg>
      </footer>
    </div>`;

  const dopo = () => {
    const id = rotaId;
    // conto alla rovescia e stato dei tasti: aggiorna ogni 20 secondi e quando cambia l'audio
    const aggiorna = () => { const el = $('#prossimo'); if (el) el.innerHTML = htmlProssimo(); };
    const iv = setInterval(aggiorna, 20000);
    const off = Audio.osserva(() => { if (!Audio.stato().silenzioso) aggiorna(); });
    alla_chiusura(() => { clearInterval(iv); off(); });

    // aurora di stasera (se il modulo c'e')
    if (serata) {
      modAurora().then(async (m) => {
        if (!m || !m.auroraSerata) return;
        let r = null;
        try { r = await m.auroraSerata(serata); } catch (e) { r = null; }
        const el = $('#aurora-stasera');
        if (id === rotaId && el) el.innerHTML = htmlAuroraStasera(serata, r);
      });
    }
  };
  return { html, dopo, tab: 'viaggio' };
}

/* =====================================================================
   GIORNO - timeline
   ===================================================================== */

function statoBiglietto(b, breve = true) {
  if (!b) return '';
  switch (b.stato) {
    case 'pagato': return `<span class="tk tk-pagato">${glifo('spunta')}Pagato</span>`;
    case 'da_comprare': return `<span class="tk tk-comprare">${glifo('biglietto')}Da comprare</span>`;
    case 'gratis': return breve ? '<span class="tk tk-gratis">Gratis</span>' : '';
    default: return '';
  }
}

function rigaTimeline(ev, primo, ultimo) {
  const sim = (ev.simboli || []).map((s) => simbolo(s)).join('');
  return `
    <div class="tl-riga${primo ? ' primo' : ''}${ultimo ? ' ultimo' : ''}">
      <div class="tl-ora"><b>${esc(ev.ora)}</b><small>${etichettaFuso(ev.fuso)}</small></div>
      ${perg(`
        <div class="tl-corpo">
          ${medaglione(ev.icona, 'm44')}
          <div class="tl-testi">
            <b class="tl-titolo">${esc(ev.titolo)}</b>
            ${ev.sottotitolo ? `<span class="tl-sub">${esc(ev.sottotitolo)}</span>` : ''}
            ${ev.luogo && ev.luogo.nome ? `<span class="tl-luogo">${glifo('pin')}<span>${esc(ev.luogo.nome)}</span></span>` : ''}
            <span class="tl-note">
              ${ev.orario_da_verificare ? '<span class="da-verificare">Orario da verificare</span>' : ''}
              ${statoBiglietto(ev.biglietti)}
            </span>
          </div>
          ${sim ? `<div class="tl-sim">${sim}</div>` : ''}
        </div>`, { href: `#/evento/${esc(ev.id)}`, orn: false, cls: 'tl-card' })}
    </div>`;
}

function vistaGiorno(data) {
  const g = giornoPerData(data);
  if (!g) return vistaNonTrovata('Giorno non trovato.');
  const eventi = eventiDelGiorno(data);
  const gg = dataUTC(data).getUTCDate();
  const html = `
    ${barraTitolo(giornoLungo(data))}
    <div class="pagina">
      ${perg(`
        <div class="gd">
          <div class="gd-testi">
            <div class="gd-riga"><span class="gd-num">${gg}</span>${glifo(g.icona, 'gd-ico')}</div>
            <div class="gd-mese">${esc(meseLungo(data).toUpperCase())}</div>
            <div class="gd-nome">${esc(g.nome.toUpperCase())}</div>
            <h1 class="gd-titolo">${esc(g.titolo)}</h1>
            <div class="gd-tappe">${eventi.length} ${eventi.length === 1 ? 'tappa' : 'tappe'}</div>
          </div>
          <div class="gd-img">${g.ritaglio ? `<img class="foto" src="${esc(g.ritaglio)}" alt="" decoding="async">` : ''}<span class="gc-ico-fondo">${glifo(g.icona)}</span></div>
        </div>`, { cls: 'gd-card' })}
      ${divisore(true, 'stretto')}
      <div class="timeline">${eventi.map((e, i) => rigaTimeline(e, i === 0, i === eventi.length - 1)).join('')}</div>
    </div>`;
  return { html, tab: 'viaggio' };
}

/* =====================================================================
   EVENTO - il cuore
   ===================================================================== */

function scenaEvento(ev) {
  const stelle = [[29, 25], [72, 62], [122, 21], [180, 45], [223, 16], [324, 29], [342, 103], [162, 82], [43, 107]];
  const sv = stelle.map(([x, y], i) => (i % 3 === 0
    ? `<path d="${stella4(x, y, 5)}" fill="#F1E3C4" opacity=".8"/>`
    : `<circle cx="${x}" cy="${y}" r="1.2" fill="#F1E3C4" opacity=".55"/>`)).join('');
  const foglie = [[108, 181, 22, 20, '#D9661F'], [223, 192, 17, -35, '#B8321E'], [324, 185, 20, 70, '#E8B04B']]
    .map(([x, y, s, r, c]) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s / 100})" d="${FOGLIA.d}" fill="${c}" opacity=".9"/>`).join('');
  return `
    <div class="hero scena">
      <svg viewBox="0 0 360 206" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="360" height="206" fill="url(#gScena)"/>
        ${sv}
        <circle cx="288" cy="74" r="82" fill="url(#gAlone)" class="luna-alone"/>
        <circle cx="288" cy="74" r="31" fill="url(#gLuna)"/>
        <circle cx="297" cy="83" r="6.5" fill="#A04010" opacity=".16"/><circle cx="276" cy="86" r="4" fill="#A04010" opacity=".16"/><circle cx="299" cy="65" r="3" fill="#A04010" opacity=".16"/>
        <path d="M0 144C72 113 137 128 198 136C270 148 324 120 360 128L360 206L0 206Z" fill="#1A1D2C"/>
        <path d="M0 169C54 152 108 173 180 169C252 165 306 181 360 165L360 206L0 206Z" fill="#0A0D14"/>
        <g transform="translate(14 124) scale(.56)"><path d="${CORVO}" fill="#04060A"/></g>
        ${foglie}
      </svg>
      <span class="scena-med">${glifo(ev.icona)}</span>
    </div>`;
}

function heroEvento(ev) {
  const foto = (ev.foto || []).filter((f) => f.file);
  if (!foto.length) return scenaEvento(ev);
  return `
    <div class="hero" data-hero>
      <div class="hero-pista" tabindex="0" role="group" aria-label="Foto: ${esc(ev.titolo)}">
        ${foto.map((f, i) => `
          <figure class="hero-foto">
            <img class="foto" src="${esc(f.file)}" alt="${esc(ev.titolo)}${foto.length > 1 ? ` (foto ${i + 1} di ${foto.length})` : ''}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async" draggable="false">
            ${f.credito ? `<figcaption>${esc(f.credito)}</figcaption>` : ''}
          </figure>`).join('')}
      </div>
      ${foto.length > 1 ? `
        <button type="button" class="hero-fr prec" data-az="foto-prec" aria-label="Foto precedente">${glifo('freccia')}</button>
        <button type="button" class="hero-fr succ" data-az="foto-succ" aria-label="Foto successiva">${glifo('freccia')}</button>
        <div class="hero-punti" aria-hidden="true">${foto.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>` : ''}
    </div>`;
}

function htmlAudio(ev) {
  const s = Audio.stato();
  const mia = s.id === ev.id;
  const st = mia ? s.stato : 'fermo';
  let blocchi = `<p class="testo-soft">${haAudioVera(ev)
    ? 'Racconto parlato di questo luogo, in italiano.'
    : "L'audioguida completa non è ancora stata aggiunta: per ora ti leggo un riepilogo della tappa."}</p>`;

  if (st === 'errore') return blocchi + guidaVoce(s.errore);

  if (st === 'lettura' || st === 'pausa') {
    blocchi += `
      <div class="riga-bott due">
        ${st === 'lettura'
    ? bottone({ testo: 'Pausa', icona: 'pausa', az: 'pausa' })
    : bottone({ testo: 'Riprendi', icona: 'play', az: 'riprendi' })}
        ${bottone({ testo: 'Stop', icona: 'stop', stile: 'contorno su-perg', az: 'ferma' })}
      </div>
      <div class="avanz su-perg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(s.avanzamento * 100)}"><i style="width:${Math.max(3, Math.round(s.avanzamento * 100))}%"></i></div>
      <p class="audio-stato">${st === 'lettura' ? 'In lettura' : (s.interrotta ? 'Interrotta: premi Riprendi' : 'In pausa')} · parte ${s.parte} di ${s.totale}</p>`;
  } else {
    blocchi += `<div class="riga-bott">${bottone({ testo: 'Ascolta', icona: 'audio', az: 'ascolta', attr: `data-id="${esc(ev.id)}"`, cls: 'largo' })}</div>`;
  }
  blocchi += '<p class="audio-nota">La lettura si ferma se spegni lo schermo o cambi app.</p>';
  return blocchi;
}

/** Istruzioni quando manca la voce italiana. */
function guidaVoce(errore) {
  const titolo = {
    'non-supportata': 'Questo browser non ha la sintesi vocale.',
    'nessuna-voce': 'Manca la voce italiana sul dispositivo.',
    bloccato: "Il browser ha bloccato l'audio.",
    motore: 'La sintesi vocale del dispositivo non risponde.',
  }[errore] || 'Non riesco a leggere ad alta voce.';
  const passi = {
    'non-supportata': 'Apri la pagina con Chrome (Android) o Safari (iPhone): sono i browser che leggono ad alta voce.',
    bloccato: 'Tocca di nuovo «Ascolta»: la lettura deve partire da un tuo tocco.',
    motore: 'Chiudi e riapri il browser, poi riprova. Controlla che il volume del telefono sia alzato e che non sia in modalità silenziosa.',
  }[errore];
  const voce = (errore === 'nessuna-voce' || !passi) ? `
    <p>Come installarla (serve internet, una volta sola):</p>
    <ol>
      <li><b>Android:</b> Impostazioni → Sistema → Lingue → Sintesi vocale (o «Output sintesi vocale»). Come motore scegli «Servizi vocali di Google», tocca l'ingranaggio, poi «Installa dati vocali» e scegli Italiano (Italia).</li>
      <li><b>iPhone:</b> Impostazioni → Accessibilità → Contenuto parlato → Voci → Italiano: scarica una voce (meglio «Avanzata» o «Premium»).</li>
      <li><b>Computer:</b> installa le voci italiane dalle impostazioni di lingua e voce del sistema.</li>
      <li>Torna qui e premi Ascolta.</li>
    </ol>` : `<p>${esc(passi)}</p>`;
  return `
    <div class="guida-voce">
      <p class="gv-titolo">${esc(titolo)}</p>
      ${voce}
      <div class="riga-bott">${bottone({ testo: 'Ho fatto, riprova', stile: 'contorno su-perg', az: 'azzera-errore' })}</div>
    </div>`;
}

function htmlMeteoDati(ev, r) {
  const o = r.ora;
  const agg = r.aggiornato ? dataOra(new Date(r.aggiornato)) : '';
  return `
    <div class="mt-testa">
      ${glifo(nomeGlifoMeteo(o.codice), 'mt-g')}
      <div>
        <div class="mt-temp">${Math.round(o.temperatura)}°C</div>
        <div class="mt-desc">${esc(o.descrizione || '')}</div>
      </div>
    </div>
    <div class="mt-dati">
      <div><small>Percepita</small><b>${Math.round(o.percepita)}°C</b></div>
      <div><small>Pioggia</small><b>${glifo('goccia')}${Math.round(o.pioggia)}%</b></div>
      <div><small>Vento</small><b>${glifo('vento')}${Math.round(o.vento)} km/h</b></div>
      <div><small>Nuvole</small><b>${Math.round(o.nuvole)}%</b></div>
    </div>
    ${o.consiglio ? `<p class="mt-consiglio">${esc(o.consiglio)}</p>` : ''}
    <p class="mt-nota">Previsione per le ${esc(ev.ora)} (${etichettaFuso(ev.fuso)})${agg ? ` · aggiornata il ${esc(agg)}` : ''}${r.daCache ? ' · dato salvato' : ''}</p>`;
}

function vistaEvento(id) {
  const ev = eventoPerId(id);
  if (!ev) return vistaNonTrovata('Evento non trovato.');
  const t = istanteEvento(ev);
  const sim = (ev.simboli || []).map((k) => `<span class="chip-sim">${simbolo(k, 'su-scuro')}<span>${esc(NOME_SIMBOLO[k] || k)}</span></span>`).join('');
  const b = ev.biglietti;
  const mostraBiglietti = b && (['pagato', 'da_comprare', 'gratis'].includes(b.stato) || b.note || b.prezzo || b.link);
  const durata = ev.durata_min ? (ev.durata_min >= 60 ? `circa ${Math.floor(ev.durata_min / 60)} h${ev.durata_min % 60 ? ` ${ev.durata_min % 60} min` : ''}` : `circa ${ev.durata_min} min`) : '';

  const etBigl = { pagato: ['Già pagato', 'ok'], da_comprare: ['Da comprare', 'no'], gratis: ['Ingresso gratuito', 'ok'], non_serve: ['Non serve prenotare', 'neutro'] }[b && b.stato];

  const html = `
    ${barraTitolo(giornoCorto(ev.giorno))}
    <div class="pagina evento">
      ${heroEvento(ev)}
      <div class="ev-testa">
        ${sim ? `<div class="chips">${sim}</div>` : ''}
        <h1 class="ev-titolo">${esc(ev.titolo)}</h1>
        ${ev.sottotitolo ? `<p class="ev-sub">${esc(ev.sottotitolo)}</p>` : ''}
      </div>

      ${perg(`
        ${titoloSez('Quando e dove')}
        <div class="qd-ora">
          ${glifo('orologio', 'qd-g')}
          <div>
            <div class="qd-grande">${esc(ev.ora)}</div>
            <div class="qd-sotto">${esc(giornoLungo(ev.giorno))} · ${esc(FUSO_NOME[ev.fuso] || etichettaFuso(ev.fuso))}${durata ? ` · ${durata}` : ''}</div>
          </div>
        </div>
        ${ev.orario_da_verificare ? `<p class="mt-m">${etichetta('Orario da verificare', 'fuoco')}</p>` : ''}
        <p class="nota-i">Gli orari possono variare: controlla gli avvisi degli organizzatori.</p>
        ${ev.luogo ? `
          ${divisore(false, 'stretto')}
          <div class="qd-luogo">
            ${glifo('pin', 'qd-pin')}
            <div><b>${esc(ev.luogo.nome)}</b>${ev.luogo.indirizzo ? `<span>${esc(ev.luogo.indirizzo)}</span>` : ''}</div>
          </div>
          <div class="riga-bott">${bottone({ testo: 'Naviga in auto', icona: 'naviga', href: linkNaviga(ev.luogo.lat, ev.luogo.lon), cls: 'largo' })}</div>` : ''}
      `, { cls: 'blocco-ev' })}

      ${perg(`
        ${titoloSez("Meteo all'ora della visita")}
        <div id="meteo-corpo"><p class="nota-i">Sto consultando le previsioni…</p></div>
      `, { cls: 'blocco-ev' })}

      ${perg(`
        ${titoloSez('Audioguida')}
        <div id="audio-corpo">${htmlAudio(ev)}</div>
      `, { cls: 'blocco-ev', attr: 'id="card-audio"' })}

      ${mostraBiglietti ? perg(`
        ${titoloSez('Biglietti')}
        <div class="bg-riga">
          ${glifo('biglietto', 'bg-g')}
          <div>${etBigl ? etichetta(etBigl[0], etBigl[1]) : ''}${b.prezzo ? `<p class="bg-prezzo">${esc(b.prezzo)}</p>` : ''}</div>
        </div>
        ${b.note ? `<p class="corpo">${esc(b.note)}</p>` : ''}
        ${b.link ? `<div class="riga-bott">${bottone({ testo: 'Sito ufficiale', icona: 'link', href: b.link, cls: 'largo' })}</div>` : ''}
      `, { cls: 'blocco-ev' }) : ''}

      ${(ev.consigli || []).length ? perg(`
        ${titoloSez('Consigli utili')}
        <ul class="consigli">${ev.consigli.map((c) => `<li>${fogliaSvg()}<span>${esc(c)}</span></li>`).join('')}</ul>
      `, { cls: 'blocco-ev' }) : ''}

      ${(ev.da_sapere || []).length ? perg(`
        ${titoloSez('Da sapere: miti, leggende, storia')}
        ${ev.da_sapere.map((v, i) => `
          ${i ? divisore(false, 'stretto') : ''}
          <article class="voce">
            ${etichetta(NOME_TIPO[v.tipo] || 'Curiosità', `tipo-${NOME_TIPO[v.tipo] ? v.tipo : 'curiosita'}`)}
            ${v.titolo ? `<h4>${esc(v.titolo)}</h4>` : ''}
            ${paragrafi(v.testo, 'corpo')}
          </article>`).join('')}
      `, { cls: 'blocco-ev' }) : ''}

      ${(ev.link || []).length ? perg(`
        ${titoloSez('Link utili')}
        <div class="elenco-bott">${ev.link.map((l) => bottone({ testo: l.titolo || l.url, icona: 'link', stile: 'contorno su-perg', href: l.url })).join('')}</div>
      `, { cls: 'blocco-ev' }) : ''}

      ${divisore(true)}
    </div>`;

  const dopo = () => {
    const id_ = rotaId;
    // carosello: puntini e frecce
    const hero = $('[data-hero]');
    if (hero) {
      const pista = $('.hero-pista', hero); const punti = [...hero.querySelectorAll('.hero-punti i')];
      const su = () => {
        const i = Math.round(pista.scrollLeft / Math.max(1, pista.clientWidth));
        punti.forEach((p, k) => p.classList.toggle('on', k === i));
      };
      pista.addEventListener('scroll', su, { passive: true });
    }
    // audio: l'interfaccia segue lo stato globale
    const off = Audio.osserva(() => {
      const el = $('#audio-corpo');
      if (el) el.innerHTML = htmlAudio(ev);
    });
    alla_chiusura(off);

    // meteo all'ora della visita
    const corpo = $('#meteo-corpo');
    const carica = async () => {
      if (corpo) corpo.innerHTML = '<p class="nota-i">Sto consultando le previsioni…</p>';
      const m = await modMeteo();
      let r = null;
      if (m && m.meteoEvento) { try { r = await m.meteoEvento(ev, t); } catch (e) { r = { stato: 'errore' }; } } else r = { stato: 'errore' };
      if (id_ !== rotaId || !corpo) return;
      if (r && r.stato === 'ok') corpo.innerHTML = htmlMeteoDati(ev, r);
      else if (r && r.stato === 'lontano') {
        corpo.innerHTML = `<p class="corpo">Le previsioni compaiono pochi giorni prima della data (circa due settimane prima).${r.giorni != null ? ` Mancano ancora ${r.giorni} giorni.` : ''}</p>`;
      } else {
        corpo.innerHTML = `<p class="corpo">Previsioni non disponibili adesso (serve internet). Riprova più tardi: l'ultimo dato resta salvato.</p>
          <div class="riga-bott">${bottone({ testo: 'Riprova', icona: 'aggiorna', stile: 'contorno su-perg', az: 'meteo-riprova' })}</div>`;
      }
    };
    meteoRiprova = carica;
    carica();
  };
  return { html, dopo, tab: 'viaggio' };
}
let meteoRiprova = () => {};

const NOME_TIPO = { mito: 'Mito', leggenda: 'Leggenda', storia: 'Storia', aneddoto: 'Aneddoto', curiosita: 'Curiosità' };

function vistaNonTrovata(msg) {
  return {
    html: `${barraTitolo('Ops')}<div class="pagina"><p class="vuoto chiaro">${esc(msg)}</p><div class="riga-bott">${bottone({ testo: 'Torna al viaggio', icona: 'casa', href: '', az: 'home' })}</div></div>`,
    tab: 'viaggio',
  };
}

/* =====================================================================
   AURORA
   ===================================================================== */

function htmlSerata(s, r) {
  const disp = !!(r && r.disponibile);
  const lv = disp ? (LIVELLI[r.probabilita] || LIVELLI.nulla) : null;
  const col = lv ? lv.col : 'rgba(230,210,168,.65)';
  const n = lv ? lv.n : 0;
  const [principale, alternativa] = String(s.note || '').split(/\n\s*\n\s*Alternativa:\s*/);
  const kp = disp && r.kpMax != null ? num(r.kpMax) : '—';
  const nu = disp && r.nuvole != null ? `${Math.round(r.nuvole)}%` : '—';
  const dett = (r && r.testo) ? r.testo : 'Previsione non ancora disponibile';
  return `
    <p class="et-sez">${esc(giornoLungo(s.data).toUpperCase())}</p>
    <p class="sr-luogo">${glifo('pin')}<span>${esc(s.nome)}</span></p>
    <div class="sr-prob">
      <div>
        <p class="sr-eti">${disp ? 'Probabilità' : 'Previsione'}</p>
        <p class="sr-valore" style="color:${col}">${disp ? esc(lv.nome) : 'In arrivo'}</p>
        <p class="sr-det">${esc(dett)}</p>
      </div>
      <div class="sr-num">
        <b>KP ${kp}</b>
        <span>NUVOLE ${nu}</span>
      </div>
    </div>
    <div class="meter" role="img" aria-label="${disp ? `Probabilità ${esc(lv.nome.toLowerCase())}` : 'Probabilità non disponibile'}">${[0, 1, 2].map((i) => `<i${i < n ? ` style="background:${col}"` : ''}></i>`).join('')}</div>
    <div class="meter-et"><span>Bassa</span><span>Media</span><span>Alta</span></div>
    ${principale ? paragrafi(principale, 'sr-note') : ''}
    ${alternativa ? `<div class="sr-alt"><b>Alternativa</b>${paragrafi(alternativa, 'sr-note')}</div>` : ''}
    <div class="riga-bott">${bottone({ testo: 'Naviga al punto buio', icona: 'naviga', href: linkNaviga(s.lat, s.lon), cls: 'largo' })}</div>`;
}

function vistaAurora() {
  const serate = IT.serate_aurora || [];
  const html = `
    <div class="pagina">
      <div class="aur-testa">
        ${glifo('aurora', 'aur-grande')}
        <h1>Aurora boreale</h1>
        <p>Previsioni sera per sera, nel punto più buio</p>
        ${divisore(true, 'stretto')}
      </div>
      ${notte(`
        <div class="kp-riga">
          <div><p class="et-sez aur">Kp adesso</p><p class="kp-valore" id="kp-valore">—</p><p class="kp-quando" id="kp-quando"></p></div>
          ${bottone({ testo: 'Aggiorna', icona: 'aggiorna', stile: 'contorno', az: 'aurora-agg', attr: 'id="aurora-agg"' })}
        </div>
        ${paragrafi(IT.aurora_intro || '', 'aur-intro')}
        <p class="aur-intro">I dati NOAA della previsione escono circa tre giorni prima: per le sere più lontane vedrai «In arrivo» finché non vengono pubblicati.</p>
      `, { cls: 'aur-kp' })}
      ${serate.map((s) => notte(`<div id="serata-${esc(s.data)}">${htmlSerata(s, null)}</div>`, { cls: 'serata' })).join('')}
      <p class="fonti">Fonti: NOAA SWPC (Kp previsto) e previsioni meteo per le nuvole. I dati si aggiornano quando la pagina ha internet; senza rete restano gli ultimi salvati.</p>
    </div>`;

  const dopo = () => { riempiAurora(); };
  return { html, dopo, tab: 'aurora' };
}

async function riempiAurora() {
  const id = rotaId;
  const m = await modAurora();
  const bott = $('#aurora-agg');
  if (bott) { bott.disabled = true; bott.classList.add('attesa'); }
  if (!m) {
    if (bott) { bott.disabled = false; bott.classList.remove('attesa'); }
    return;
  }
  const kpP = (async () => { try { return m.kpAttuale ? await m.kpAttuale() : null; } catch (e) { return null; } })();
  const sP = (IT.serate_aurora || []).map(async (s) => {
    let r = null;
    try { r = m.auroraSerata ? await m.auroraSerata(s) : null; } catch (e) { r = null; }
    const el = document.getElementById(`serata-${s.data}`);
    if (id === rotaId && el) el.innerHTML = htmlSerata(s, r);
  });
  const kp = await kpP;
  if (id === rotaId) {
    const v = $('#kp-valore'); const q = $('#kp-quando');
    if (v) v.textContent = kp && kp.kp != null ? num(kp.kp) : '—';
    if (q) q.textContent = kp && kp.quando ? `misurato alle ${oraHM(new Date(kp.quando), 'Europe/Dublin')} (ora irlandese)` : 'dato non disponibile adesso';
  }
  await Promise.all(sP);
  if (id === rotaId && bott) { bott.disabled = false; bott.classList.remove('attesa'); }
}

/* =====================================================================
   INFO
   ===================================================================== */

let promptInstall = null;
const inModoApp = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

function htmlProva() {
  const s = Audio.stato();
  const mia = s.id === '__prova__';
  if (mia && s.stato === 'errore') return guidaVoce(s.errore);
  const inCorso = mia && (s.stato === 'lettura' || s.stato === 'pausa');
  return `<div class="riga-bott">${inCorso
    ? bottone({ testo: 'Ferma la prova', icona: 'stop', az: 'ferma' })
    : bottone({ testo: 'Prova la voce', icona: 'audio', az: 'prova-voce' })}</div>`;
}

function vistaInfo() {
  const lista = (voci) => `<ul class="info-lista">${voci.map((v) => `<li>${fogliaSvg()}<span>${v}</span></li>`).join('')}</ul>`;
  const html = `
    <div class="pagina">
      <div class="aur-testa">
        ${glifo('lampada', 'info-grande')}
        <h1>Info</h1>
        <p>Come usare questa web app</p>
        ${divisore(true, 'stretto')}
      </div>

      ${perg(`
        ${titoloSez('Mettila sulla schermata Home')}
        ${inModoApp() ? '<p class="corpo">Stai già usando la web app installata.</p>' : ''}
        ${lista([
    '<b>Chrome su Android:</b> tocca il menu ⋮ in alto a destra, poi «Aggiungi a schermata Home» (o «Installa app») e conferma.',
    '<b>Safari su iPhone:</b> tocca Condividi (il quadrato con la freccia in su), scorri e scegli «Aggiungi alla schermata Home».',
  ])}
        <div id="installa-wrap">${promptInstall ? `<div class="riga-bott">${bottone({ testo: 'Installa ora', icona: 'casa', az: 'installa' })}</div>` : ''}</div>
      `)}

      ${perg(`
        ${titoloSez('Funziona anche offline')}
        <p class="corpo">Dopo la prima apertura con internet, itinerario, foto e audioguide restano salvati sul telefono: durante il viaggio puoi consultarli anche senza rete. Meteo e aurora hanno bisogno di internet e, se manca la rete, mostrano l'ultimo dato salvato.</p>
        <p class="corpo">Se qualcosa non si aggiorna, chiudi e riapri la web app una volta con internet acceso.</p>
      `)}

      ${perg(`
        ${titoloSez('Notifiche')}
        <p class="corpo">Questa versione web è solo da consultare: non manda notifiche. Promemoria degli eventi e avvisi aurora sono nell'app Android del viaggio.</p>
      `)}

      ${perg(`
        ${titoloSez('Prova la voce')}
        <p class="corpo">Le audioguide sono lette dalla voce italiana del tuo dispositivo. Premi il tasto e controlla che parli in italiano e si senta bene.</p>
        <p class="corpo voce-stato" id="voce-stato">Controllo le voci del dispositivo…</p>
        <div id="prova-corpo">${htmlProva()}</div>
        <p class="audio-nota">La lettura si ferma se spegni lo schermo o cambi app.</p>
      `)}

      ${perg(`
        ${titoloSez('Il viaggio')}
        <p class="corpo">Halloween &amp; Samhain 2026: Roma, Meath, Dublino, Manchester. Dal 29 ottobre al 4 novembre 2026.</p>
        <p class="corpo">Gli orari possono variare: ricontrolla gli avvisi degli organizzatori. Le foto vengono da Wikimedia Commons, con il credito sotto ciascuna. Meteo e aurora arrivano da servizi pubblici online (NOAA SWPC per l'indice Kp).</p>
      `)}
      ${divisore(true)}
    </div>`;

  const dopo = () => {
    const id = rotaId;
    Audio.voceItaliana().then((info) => {
      const el = $('#voce-stato');
      if (id !== rotaId || !el) return;
      el.className = 'corpo voce-stato';
      if (info.stato === 'ok') { el.classList.add('ok'); el.textContent = `Voce italiana trovata: ${info.nome}.`; }
      else if (info.stato === 'nessuna') { el.classList.add('no'); el.textContent = `Nessuna voce italiana: il dispositivo ha ${info.totali} voci ma nessuna in italiano. Le audioguide non possono partire finché non ne installi una.`; }
      else if (info.stato === 'sconosciuta') el.textContent = 'Il browser non elenca le voci: premi «Prova la voce» e senti se parla in italiano.';
      else { el.classList.add('no'); el.textContent = 'Questo browser non ha la sintesi vocale: le audioguide non funzioneranno. Usa Chrome (Android) o Safari (iPhone).'; }
    });
    const off = Audio.osserva(() => { const el = $('#prova-corpo'); if (el) el.innerHTML = htmlProva(); });
    alla_chiusura(off);
  };
  return { html, dopo, tab: 'info' };
}

/* =====================================================================
   Mini-player dell'audioguida (su tutte le schermate)
   ===================================================================== */

function renderMini(s) {
  const mp = $('#miniplayer');
  if (!mp) return;
  const visibile = (s.stato === 'lettura' || s.stato === 'pausa') && !s.silenzioso;
  mp.hidden = !visibile;
  document.body.classList.toggle('con-player', visibile);
  if (!visibile) { mp.innerHTML = ''; return; }
  const inLettura = s.stato === 'lettura';
  mp.innerHTML = `
    <div class="mp-corpo">
      <button type="button" class="mp-titolo" data-az="apri-guida" aria-label="Apri la tappa: ${esc(s.titolo)}">
        ${glifo('audio', 'mp-g')}
        <span><b>${esc(s.titolo)}</b><small>${inLettura ? 'In lettura' : (s.interrotta ? 'Interrotta · premi Riprendi' : 'In pausa')} · parte ${s.parte} di ${s.totale}</small></span>
      </button>
      <button type="button" class="mp-bott" data-az="pausa-riprendi" aria-label="${inLettura ? 'Pausa' : 'Riprendi'}">${glifo(inLettura ? 'pausa' : 'play')}</button>
      <button type="button" class="mp-bott" data-az="ferma" aria-label="Ferma l'audioguida">${glifo('stop')}</button>
    </div>
    <div class="avanz"><i style="width:${Math.max(3, Math.round(s.avanzamento * 100))}%"></i></div>`;
}

/* =====================================================================
   Barra inferiore
   ===================================================================== */

const SCHEDE = [
  { id: 'viaggio', href: '#/', nome: 'Viaggio', icona: 'pergamena' },
  { id: 'aurora', href: '#/aurora', nome: 'Aurora', icona: 'aurora' },
  { id: 'info', href: '#/info', nome: 'Info', icona: 'info' },
];
function costruisciBarra() {
  const nav = $('#barra');
  nav.innerHTML = `<div class="barra-in">${SCHEDE.map((s) => `
    <a class="scheda" data-scheda="${s.id}" href="${s.href}">${glifo(s.icona)}<span>${s.nome}</span></a>`).join('')}</div>`;
}
function aggiornaBarra(tab) {
  document.querySelectorAll('.scheda').forEach((a) => {
    const on = a.dataset.scheda === tab;
    a.classList.toggle('attiva', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

/* =====================================================================
   Cielo: stelle e foglie d'acero che cadono (canvas leggero, rispetta prefers-reduced-motion)
   ===================================================================== */

function avviaCielo() {
  const cv = $('#sfondo');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const ridotto = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const rnd = (seme) => () => { seme |= 0; seme = (seme + 0x6D2B79F5) | 0; let t = Math.imul(seme ^ (seme >>> 15), 1 | seme); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const r1 = rnd(11);
  const stelle = Array.from({ length: 70 }, () => ({ x: r1(), y: r1() * 0.85, r: 0.5 + r1() * 1.4, a: 0.25 + r1() * 0.6, f: r1(), croce: r1() < 0.12 }));
  const r2 = rnd(5);
  const colori = ['#D9661F', '#B8321E', '#E8B04B', '#A8481A', '#8C3B12', '#E0872B'];
  const foglie = Array.from({ length: 14 }, () => ({
    x0: r2(), fase: r2(), k: r2() < 0.7 ? 1 : 2, size: 13 + r2() * 17, sway: 8 + r2() * 26, swayK: 2 + Math.floor(r2() * 3),
    swayFase: r2(), rotBase: r2() * 360, rotAmp: 25 + r2() * 50, col: colori[Math.floor(r2() * colori.length)], alfa: 0.45 + r2() * 0.4,
  }));
  const pFoglia = new Path2D(FOGLIA.d);
  const pCroce = new Path2D(stella4(0, 0, 1));
  const pVena = FOGLIA.punte.map((p) => { const q = new Path2D(); q.moveTo(FOGLIA.origine[0], FOGLIA.origine[1]); q.lineTo(p[0], p[1]); return q; });

  let W = 0; let H = 0; let dpr = 1;
  const misura = () => {
    const w = document.documentElement.clientWidth; const h = window.innerHeight;
    if (W && Math.abs(w - W) < 2 && Math.abs(h - H) < 160) return false; // la barra del browser che si nasconde non deve ridimensionare
    W = w; H = h; dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    return true;
  };

  const disegna = (ms) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const tw = (ms / 6000) % 1;
    for (const s of stelle) {
      const a = s.a * (0.65 + 0.35 * Math.sin(2 * Math.PI * (tw + s.f)));
      ctx.fillStyle = `rgba(241,227,196,${a.toFixed(3)})`;
      const px = s.x * W; const py = s.y * H;
      if (s.croce) { ctx.save(); ctx.translate(px, py); ctx.scale(s.r * 3.2, s.r * 3.2); ctx.fill(pCroce); ctx.restore(); } else { ctx.beginPath(); ctx.arc(px, py, s.r * 0.8, 0, 6.2832); ctx.fill(); }
    }
    const t = (ms / 110000) % 1;
    const margine = 40;
    for (const f of foglie) {
      const y = (((f.fase + t * f.k) % 1) * (H + 2 * margine)) - margine;
      const ang = 2 * Math.PI * (t * f.swayK * f.k + f.swayFase);
      const x = f.x0 * W + Math.sin(ang) * f.sway;
      const rot = f.rotBase + Math.sin(ang + 1.3) * f.rotAmp;
      ctx.save();
      ctx.translate(x, y); ctx.rotate((rot * Math.PI) / 180); ctx.scale(f.size / 100, f.size / 100);
      ctx.globalAlpha = f.alfa;
      ctx.fillStyle = f.col;
      ctx.fill(pFoglia);
      ctx.beginPath(); ctx.moveTo(FOGLIA.origine[0], FOGLIA.origine[1]); ctx.lineTo(FOGLIA.origine[0], FOGLIA.origine[1] + 34);
      ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.strokeStyle = f.col; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1.4;
      for (const v of pVena) ctx.stroke(v);
      ctx.restore();
    }
  };

  let attivo = false; let ultimo = 0;
  const ciclo = (ms) => {
    if (!attivo) return;
    if (ms - ultimo > 33) { ultimo = ms; disegna(ms); }
    requestAnimationFrame(ciclo);
  };
  const parti = () => {
    if (ridotto.matches) { attivo = false; disegna(30000); return; } // fermo: una sola immagine
    if (!attivo) { attivo = true; requestAnimationFrame(ciclo); }
  };
  misura();
  parti();
  window.addEventListener('resize', () => { if (misura() && !attivo) disegna(30000); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) attivo = false; else parti(); });
  if (ridotto.addEventListener) ridotto.addEventListener('change', () => { attivo = false; parti(); });
}

/* =====================================================================
   Router a hash
   ===================================================================== */

const vista = $('#vista');
let hashPrec = '';
let profondita = 0;
let avanti = false;
const posizioni = new Map();

function rotta() {
  const p = (location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean).map(decodeURIComponent);
  if (p[0] === 'giorno' && p[1]) return { tipo: 'giorno', arg: p[1] };
  if (p[0] === 'evento' && p[1]) return { tipo: 'evento', arg: p[1] };
  if (p[0] === 'aurora') return { tipo: 'aurora' };
  if (p[0] === 'info') return { tipo: 'info' };
  return { tipo: 'home' };
}

const TITOLI = { home: 'Viaggio di Halloween & Samhain 2026', aurora: 'Aurora · Samhain 2026', info: 'Info · Samhain 2026' };

function mostra() {
  for (const f of pulizia) { try { f(); } catch (e) { /* pulizia */ } }
  pulizia = [];
  rotaId++;
  const r = rotta();
  let v;
  try {
    if (!IT) v = { html: '', tab: 'viaggio' };
    else if (r.tipo === 'giorno') v = vistaGiorno(r.arg);
    else if (r.tipo === 'evento') v = vistaEvento(r.arg);
    else if (r.tipo === 'aurora') v = vistaAurora();
    else if (r.tipo === 'info') v = vistaInfo();
    else v = vistaHome();
  } catch (e) {
    console.error(e);
    v = { html: `<div class="pagina"><p class="vuoto chiaro">Qualcosa è andato storto nel mostrare questa pagina.</p><div class="riga-bott">${bottone({ testo: 'Torna al viaggio', az: 'home' })}</div></div>`, tab: 'viaggio' };
  }
  vista.innerHTML = v.html;
  vista.classList.remove('entra'); void vista.offsetWidth; vista.classList.add('entra');
  aggiornaBarra(v.tab);

  if (r.tipo === 'evento' && eventoPerId(r.arg)) document.title = `${eventoPerId(r.arg).titolo} · Samhain 2026`;
  else if (r.tipo === 'giorno' && giornoPerData(r.arg)) document.title = `${giornoLungo(r.arg)} · Samhain 2026`;
  else document.title = TITOLI[r.tipo] || TITOLI.home;

  const h = location.hash || '#/';
  const salvata = posizioni.get(h);
  window.scrollTo(0, !avanti && salvata != null ? salvata : 0);
  avanti = false;
  if (v.dopo) { try { v.dopo(); } catch (e) { console.error(e); } }
}

function tornaIndietro() {
  if (profondita > 0) { history.back(); return; }
  const r = rotta();
  if (r.tipo === 'evento' && eventoPerId(r.arg)) location.hash = `#/giorno/${eventoPerId(r.arg).giorno}`;
  else location.hash = '#/';
}

/* =====================================================================
   Azioni (clic delegati)
   ===================================================================== */

function alternaAudio() {
  const s = Audio.stato();
  if (s.stato === 'lettura') Audio.pausa(); else if (s.stato === 'pausa') Audio.riprendi();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (a) avanti = true;

  const el = e.target.closest('[data-az]');
  if (!el) return;
  const az = el.dataset.az; const id = el.dataset.id;
  switch (az) {
    case 'indietro': tornaIndietro(); break;
    case 'home': location.hash = '#/'; break;
    case 'ascolta': {
      const ev = eventoPerId(id); if (!ev) break;
      const s = Audio.stato();
      if (s.id === id && (s.stato === 'lettura' || s.stato === 'pausa')) alternaAudio();
      else Audio.leggi(id, ev.titolo, testoGuida(ev));
      break;
    }
    case 'pausa': Audio.pausa(); break;
    case 'riprendi': Audio.riprendi(); break;
    case 'pausa-riprendi': alternaAudio(); break;
    case 'ferma': Audio.ferma(); break;
    case 'apri-guida': { const s = Audio.stato(); if (s.id && s.id !== '__prova__') { avanti = true; location.hash = `#/evento/${s.id}`; } break; }
    case 'azzera-errore': Audio.azzeraErrore(); break;
    case 'prova-voce': Audio.prova("Questa è la voce dell'audioguida. Se la senti bene, e in italiano, è tutto a posto: buon viaggio tra miti e leggende!"); break;
    case 'meteo-riprova': meteoRiprova(); break;
    case 'aurora-agg': riempiAurora(); break;
    case 'foto-prec':
    case 'foto-succ': {
      const pista = el.closest('[data-hero]').querySelector('.hero-pista');
      pista.scrollBy({ left: (az === 'foto-succ' ? 1 : -1) * pista.clientWidth, behavior: 'smooth' });
      break;
    }
    case 'installa':
      if (promptInstall) { promptInstall.prompt(); promptInstall.userChoice.finally(() => { promptInstall = null; const w = $('#installa-wrap'); if (w) w.innerHTML = ''; }); }
      break;
    case 'riprova-carico': avvia(); break;
    default: break;
  }
});

window.addEventListener('hashchange', (e) => {
  if (avanti) profondita++; else profondita = Math.max(0, profondita - 1);
  try {
    const vecchio = e.oldURL ? new URL(e.oldURL).hash || '#/' : hashPrec;
    posizioni.set(vecchio, window.scrollY);
  } catch (err) { /* niente */ }
  mostra();
});

// un'immagine che non si carica non deve lasciare un buco: resta la tinta di fondo
document.addEventListener('error', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.target.classList.add('rotta');
}, true);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  promptInstall = e;
  const w = $('#installa-wrap');
  if (w) w.innerHTML = `<div class="riga-bott">${bottone({ testo: 'Installa ora', icona: 'casa', az: 'installa' })}</div>`;
});

/* =====================================================================
   Avvio
   ===================================================================== */

async function avvia() {
  try {
    const r = await fetch('data/itinerario.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    IT = await r.json();
  } catch (e) {
    vista.innerHTML = `<div class="pagina"><div class="caricamento"><p>Non riesco a caricare l'itinerario.<br>Controlla la connessione e riprova.</p>
      <div class="riga-bott">${bottone({ testo: 'Riprova', icona: 'aggiorna', az: 'riprova-carico' })}</div></div></div>`;
    return;
  }
  EVENTI = [...IT.eventi].sort((a, b) => istanteEvento(a) - istanteEvento(b));
  PER_ID.clear();
  EVENTI.forEach((ev) => PER_ID.set(ev.id, ev));
  mostra();
}

try { history.scrollRestoration = 'manual'; } catch (e) { /* niente */ }
installaOrnamenti();
costruisciBarra();
avviaCielo();
Audio.osserva(renderMini);
avvia();
