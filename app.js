{
'use strict';
/* ---------- Daten ---------- */
const CATS = [
  {k:'essen', n:'Essen', d:'Restaurants, Imbiss, Cafés'},
  {k:'freizeit', n:'Freizeit', d:'Kino, Bars, Museen, Bowling'},
  {k:'sport', n:'Sport', d:'Bolzplätze, Gym, Bouldern, Schwimmen'},
  {k:'park', n:'Parks & Bänke', d:'Sitzen, chillen, Aussicht'},
  {k:'shop', n:'Einkaufen', d:'Supermarkt, Kiosk, Bäcker'}
];
const CUISINES = [
  {k:'italian', n:'Italienisch', m:['italian','pizza','pasta'], rx:/pizz|trattoria|osteria|pasta/i},
  {k:'asian', n:'Asiatisch', m:['asian','chinese','japanese','sushi','thai','vietnamese','korean','ramen','noodle','dumpling','poke'], rx:/sushi|ramen|wok|pho|thai|asia/i},
  {k:'turkish', n:'Türkisch / Döner', m:['turkish','kebab','doner','döner','lahmacun'], rx:/d[öo]ner|keba[bp]|lahmacun/i},
  {k:'burger', n:'Burger', m:['burger','american'], rx:/burger/i},
  {k:'indian', n:'Indisch', m:['indian','pakistani','nepalese'], rx:/india|curry/i},
  {k:'greek', n:'Griechisch', m:['greek'], rx:/gyros|taverna/i},
  {k:'mexican', n:'Mexikanisch', m:['mexican','tex-mex','burrito','tacos'], rx:/taco|burrito|mexi/i},
  {k:'bavarian', n:'Bayerisch / Deutsch', m:['regional','bavarian','german'], rx:/wirtshaus|bräu|brauhaus/i},
  {k:'arab', n:'Arabisch / Falafel', m:['arab','lebanese','falafel','syrian','middle_eastern'], rx:/falafel|shawarma/i},
  {k:'sweet', n:'Café & Süßes', m:['coffee_shop','cake','dessert','ice_cream','crepe','waffle','donut','bubble_tea'], amen:['cafe','ice_cream']},
  {k:'vegan', n:'Vegan', diet:true}
];
const LABELS = {
  amenity:{restaurant:'Restaurant',fast_food:'Imbiss',cafe:'Café',ice_cream:'Eisdiele',biergarten:'Biergarten',food_court:'Food Court',cinema:'Kino',theatre:'Theater',bar:'Bar',pub:'Kneipe',nightclub:'Club',hookah_lounge:'Shisha-Bar',arts_centre:'Kulturzentrum',casino:'Casino',bench:'Bank'},
  leisure:{escape_game:'Escape Room',amusement_arcade:'Arcade',adult_gaming_centre:'Spielhalle',miniature_golf:'Minigolf',water_park:'Freizeitbad',bowling_alley:'Bowling',trampoline_park:'Trampolinpark',sports_centre:'Sportzentrum',fitness_centre:'Fitnessstudio',swimming_pool:'Schwimmbad',ice_rink:'Eisbahn',climbing:'Klettern / Bouldern',track:'Laufbahn',pitch:'Sportplatz',park:'Park',garden:'Garten',picnic_table:'Picknicktisch'},
  tourism:{museum:'Museum',zoo:'Zoo',aquarium:'Aquarium',theme_park:'Freizeitpark',gallery:'Galerie',attraction:'Sehenswürdigkeit',viewpoint:'Aussichtspunkt'},
  shop:{supermarket:'Supermarkt',convenience:'Späti / Laden',kiosk:'Kiosk',mall:'Einkaufszentrum',department_store:'Kaufhaus',bakery:'Bäckerei',beverages:'Getränkemarkt'}
};
const PITCH = {soccer:'Fußballplatz',basketball:'Basketballplatz',table_tennis:'Tischtennisplatte',beachvolleyball:'Beachvolleyball',tennis:'Tennisplatz',volleyball:'Volleyballfeld',skateboard:'Skatepark',multi:'Bolzplatz'};
const CUISINE_DE = {italian:'italienisch',pizza:'Pizza',asian:'asiatisch',chinese:'chinesisch',japanese:'japanisch',sushi:'Sushi',thai:'thailändisch',vietnamese:'vietnamesisch',korean:'koreanisch',ramen:'Ramen',turkish:'türkisch',kebab:'Döner/Kebab',burger:'Burger',american:'amerikanisch',indian:'indisch',greek:'griechisch',mexican:'mexikanisch',regional:'regional',bavarian:'bayerisch',german:'deutsch',arab:'arabisch',lebanese:'libanesisch',falafel:'Falafel',coffee_shop:'Kaffee',cake:'Kuchen',ice_cream:'Eis',vegan:'vegan',vegetarian:'vegetarisch',sandwich:'Sandwich',bubble_tea:'Bubble Tea',chicken:'Chicken',steak_house:'Steak',seafood:'Fisch',spanish:'spanisch',french:'französisch',persian:'persisch',african:'afrikanisch'};
/* Grobe Tempo-Modelle (Luftlinie x Umwegfaktor), alles kostenlos ohne Routing-API */
const TRAVEL = {
  walk:{n:'zu Fuß', g:'walking', t:d=>d*1.3/4.8*60},
  bike:{n:'mit dem Rad', g:'bicycling', t:d=>d*1.3/15*60},
  transit:{n:'mit Bahn + zu Fuß', g:'transit', t:d=>Math.min(d*1.3/4.8*60, 9 + d*1.25/24*60)},
  car:{n:'mit dem Auto', g:'driving', t:d=>6 + d*1.35/28*60}
};
const OVERPASS = ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const MUC = [48.13743, 11.57549];

/* ---------- Zustand ---------- */
const S = {mode:'out', loc:null, locName:'', travel:'walk', rangeType:'min', range:15, cats:new Set(['essen']), cuisine:{}, budget:'any', openNow:true, all:[], shown:10, poll:null};
try { const saved = JSON.parse(localStorage.getItem('wohin') || 'null');
  if (saved) { Object.assign(S, saved, {cats:new Set(saved.cats || ['essen'])}); } } catch(e) {}
const save = () => { try { localStorage.setItem('wohin', JSON.stringify({travel:S.travel, rangeType:S.rangeType, range:S.range, cats:[...S.cats], cuisine:S.cuisine, budget:S.budget, openNow:S.openNow})); } catch(e) {} };

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const show = (id, on) => { $(id).hidden = !on; };
let toastT;
const toast = msg => { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); };
const loading = (on, txt) => { show('loading', on); if (txt) $('loadText').textContent = txt; };
const fmtMin = m => m < 1.5 ? '1 Min.' : (m < 60 ? Math.round(m) + ' Min.' : Math.floor(m/60) + ' Std. ' + Math.round(m%60) + ' Min.');
const fmtKm = d => d < 1 ? Math.round(d*1000/10)*10 + ' m' : d.toFixed(1).replace('.', ',') + ' km';
function distKm(a, b, c, d) { const R = 6371, r = Math.PI/180; const x = Math.sin((c-a)*r/2)**2 + Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2; return 2*R*Math.asin(Math.sqrt(x)); }

/* ---------- Karte ---------- */
const tiles = () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'© OpenStreetMap'});
let setupMap, resMap, meMarker, setupCircle, resLayer;
function initSetupMap() {
  if (typeof L === 'undefined') { $('setupMap').hidden = true; return; }
  setupMap = L.map('setupMap', {zoomControl:false}).setView(S.loc || MUC, S.loc ? 15 : 12);
  tiles().addTo(setupMap);
  setupMap.on('click', e => setLoc(e.latlng.lat, e.latlng.lng, 'Gewählter Punkt auf der Karte'));
}
const meIcon = () => L.divIcon({className:'pin me', html:'', iconSize:[18,18]});
function drawSetup() {
  if (!setupMap || !S.loc) return;
  if (meMarker) meMarker.remove(); if (setupCircle) setupCircle.remove();
  meMarker = L.marker(S.loc, {icon:meIcon()}).addTo(setupMap);
  setupCircle = L.circle(S.loc, {radius:radiusKm()*1000, color:'#1a3fd6', weight:2, fillOpacity:.08}).addTo(setupMap);
  setupMap.fitBounds(setupCircle.getBounds(), {padding:[10,10]});
}

/* ---------- Standort ---------- */
function setLoc(lat, lon, name) {
  S.loc = [lat, lon]; S.locName = name || 'Dein Standort';
  const el = $('locText'); el.textContent = S.locName; el.classList.add('ok');
  if (distKm(lat, lon, MUC[0], MUC[1]) > 40) toast('Hinweis: Die App ist aktuell auf München ausgelegt.');
  drawSetup();
}
async function reverseName(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=17&accept-language=de`);
    const j = await r.json(); const a = j.address || {};
    return [a.road, a.suburb || a.city_district || a.neighbourhood].filter(Boolean).join(', ') || 'Dein Standort';
  } catch(e) { return 'Dein Standort'; }
}
function locate() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { $('err').textContent = 'Dein Browser kann keinen Standort liefern. Gib bitte eine Adresse ein.'; show('err', true); return resolve(false); }
    loading(true, 'Ermittle deinen Standort …');
    navigator.geolocation.getCurrentPosition(async p => {
      const {latitude:la, longitude:lo, accuracy} = p.coords;
      setLoc(la, lo, 'Dein Standort (±' + Math.round(accuracy) + ' m)');
      loading(false); resolve(true);
      const n = await reverseName(la, lo); setLoc(la, lo, n + ' · ±' + Math.round(accuracy) + ' m');
    }, err => {
      loading(false);
      $('err').textContent = err.code === 1 ? 'Standortzugriff wurde abgelehnt. Erlaube ihn in den Browser-Einstellungen oder gib eine Adresse ein.' : 'Standort konnte nicht ermittelt werden. Gib bitte eine Adresse ein.';
      show('err', true); resolve(false);
    }, {enableHighAccuracy:true, timeout:12000, maximumAge:60000});
  });
}
async function geocode(q) {
  loading(true, 'Suche Adresse …');
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=de&viewbox=11.36,48.25,11.72,48.06&accept-language=de&q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (!j.length) { toast('Nichts gefunden – versuch es genauer.'); return; }
    setLoc(+j[0].lat, +j[0].lon, j[0].display_name.split(',').slice(0, 2).join(','));
  } catch(e) { toast('Adresssuche gerade nicht erreichbar.'); }
  finally { loading(false); }
}

/* ---------- Reichweite ---------- */
function radiusKm() {
  if (S.rangeType === 'km') return Math.min(S.range, 15);
  const m = S.range;
  const r = {walk:m/60*4.8/1.3, bike:m/60*15/1.3, transit:Math.max(m/60*4.8/1.3, (m-9)/60*24/1.25), car:Math.max(0.5,(m-6)/60*28/1.35)}[S.travel];
  return Math.min(Math.max(r, 0.3), 15);
}
function updRange() {
  const inp = $('rangeInput');
  if (S.rangeType === 'km') { inp.min = 0.5; inp.max = 15; inp.step = 0.5; } else { inp.min = 5; inp.max = 60; inp.step = 5; }
  inp.value = S.range;
  $('rangeOut').textContent = S.rangeType === 'km' ? String(S.range).replace('.', ',') + ' km' : S.range + ' Min.';
  drawSetup();
}

/* ---------- Overpass ---------- */
function buildQuery(lat, lon) {
  const r = Math.round(radiusKm()*1000), A = `(around:${r},${lat},${lon})`;
  const p = [];
  if (S.cats.has('essen')) p.push(`nwr["amenity"~"^(restaurant|fast_food|cafe|ice_cream|biergarten|food_court)$"]["name"]${A};`);
  if (S.cats.has('freizeit')) p.push(`nwr["amenity"~"^(cinema|theatre|bar|pub|nightclub|hookah_lounge|arts_centre|casino)$"]["name"]${A};`,
    `nwr["leisure"~"^(escape_game|amusement_arcade|adult_gaming_centre|miniature_golf|water_park|bowling_alley|trampoline_park)$"]${A};`,
    `nwr["tourism"~"^(museum|zoo|aquarium|theme_park|gallery|attraction)$"]["name"]${A};`);
  if (S.cats.has('sport')) p.push(`nwr["leisure"~"^(sports_centre|fitness_centre|swimming_pool|ice_rink|climbing|bowling_alley|trampoline_park)$"]${A};`,
    `nwr["leisure"="pitch"]["sport"~"soccer|basketball|table_tennis|beachvolleyball|tennis|volleyball|skateboard|multi"]${A};`,
    `nwr["sport"="climbing"]["name"]${A};`);
  if (S.cats.has('park')) p.push(`nwr["leisure"~"^(park|garden)$"]["name"]${A};`, `nwr["tourism"="viewpoint"]${A};`,
    `node["amenity"="bench"](around:${Math.min(r, 600)},${lat},${lon});`, `node["leisure"="picnic_table"](around:${Math.min(r, 1200)},${lat},${lon});`);
  if (S.cats.has('shop')) p.push(`nwr["shop"~"^(supermarket|convenience|kiosk|mall|department_store|bakery|beverages)$"]${A};`);
  return `[out:json][timeout:40];(${p.join('')});out center tags 4000;`;
}
async function overpass(q) {
  let last;
  for (const url of OVERPASS) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
    try {
      const r = await fetch(url, {method:'POST', body:'data=' + encodeURIComponent(q), headers:{'Content-Type':'application/x-www-form-urlencoded'}, signal:ctl.signal});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return (await r.json()).elements || [];
    } catch(e) { last = e; } finally { clearTimeout(t); }
  }
  throw last;
}

/* ---------- Auswertung ---------- */
function kindOf(t) {
  if (t.leisure === 'pitch') return PITCH[(t.sport || '').split(';')[0]] || 'Sportplatz';
  if (t.sport === 'climbing') return 'Klettern / Bouldern';
  for (const k of ['amenity','leisure','tourism','shop']) if (t[k] && LABELS[k][t[k]]) return LABELS[k][t[k]];
  return 'Ort';
}
function catOf(t) {
  const sel = S.cats;
  if (sel.has('essen') && /^(restaurant|fast_food|cafe|ice_cream|biergarten|food_court)$/.test(t.amenity || '')) return 'essen';
  if (sel.has('shop') && t.shop) return 'shop';
  if (sel.has('park') && (/^(park|garden|picnic_table)$/.test(t.leisure || '') || t.amenity === 'bench' || t.tourism === 'viewpoint')) return 'park';
  if (sel.has('sport') && (t.leisure === 'pitch' || t.sport === 'climbing' || /^(sports_centre|fitness_centre|swimming_pool|ice_rink|climbing)$/.test(t.leisure || ''))) return 'sport';
  if (sel.has('freizeit')) return 'freizeit';
  return sel.has('sport') ? 'sport' : [...sel][0];
}
function isFree(t) {
  if (t.fee === 'no') return true;
  if (t.fee === 'yes') return false;
  if (/^(park|garden|picnic_table|pitch)$/.test(t.leisure || '') || t.amenity === 'bench' || t.tourism === 'viewpoint') return true;
  if (t.tourism === 'attraction') return null;
  return false;
}
function cuisines(t) { return (t.cuisine || '').toLowerCase().split(/[;,]/).map(s => s.trim()).filter(Boolean); }
function matchC(t, c) {
  if (c.diet) return t['diet:vegan'] === 'yes' || t['diet:vegan'] === 'only' || cuisines(t).includes('vegan');
  if (c.amen && c.amen.includes(t.amenity)) return true;
  if (cuisines(t).some(x => c.m.includes(x))) return true;
  return !!(c.rx && c.rx.test(t.name || ''));
}
function openState(el) {
  const v = el.tags.opening_hours;
  if (!v || typeof opening_hours === 'undefined') return null;
  try { return new opening_hours(v, {lat:el.lat, lon:el.lon, address:{country_code:'de', state:'Bayern'}}, {locale:'de'}).getState(); }
  catch(e) { return null; }
}
function processEls(els) {
  const [la, lo] = S.loc, tr = TRAVEL[S.travel];
  const maxMin = S.rangeType === 'min' ? S.range : tr.t(radiusKm());
  const yes = CUISINES.filter(c => S.cuisine[c.k] === 1), no = CUISINES.filter(c => S.cuisine[c.k] === -1);
  const seen = new Set(), out = [];
  for (const e of els) {
    const t = e.tags || {}, lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (lat == null || t.access === 'private' || t.access === 'no') continue;
    const kind = kindOf(t), cat = catOf(t);
    const name = t.name || kind;
    const key = (t.name ? t.name.toLowerCase() : e.type + e.id) + '|' + kind;
    if (seen.has(key)) continue; seen.add(key);
    const free = isFree(t);
    if (S.budget === 'free' && free !== true) continue;
    if (S.budget === 'paid' && free === true) continue;
    let s = 0;
    if (cat === 'essen') {
      if (no.some(c => matchC(t, c))) continue;
      if (yes.length) { if (!yes.some(c => matchC(t, c))) continue; s += 2; }
    }
    const item = {id:e.type[0] + e.id, name, named:!!t.name, kind, cat, lat, lon, tags:t, free};
    item.open = openState(item);
    if (S.openNow && item.open === false) continue;
    const d = distKm(la, lo, lat, lon); item.d = d; item.min = tr.t(d);
    if (t.wikidata || t.wikipedia) s += 3;
    if (t.website || t['contact:website']) s += 1;
    if (t.opening_hours) s += .8;
    if (t.cuisine) s += .3;
    if (t.phone || t['contact:phone']) s += .2;
    if (item.open === true) s += 1.5;
    if (t.amenity === 'bench') s -= 2.2; if (t.leisure === 'picnic_table') s -= 1.6;
    if (!t.name && t.leisure === 'pitch') s -= .8;
    s -= Math.min(item.min / Math.max(maxMin, 5), 1.6) * 3;
    s += Math.random() * .7;
    item.s = s; out.push(item);
  }
  // Bänke: nur die 3 nächsten behalten
  const benches = out.filter(i => i.tags.amenity === 'bench').sort((a, b) => a.d - b.d).slice(3);
  const drop = new Set(benches.map(b => b.id));
  const kept = out.filter(i => !drop.has(i.id));
  // Kategorien abwechselnd mischen
  const groups = [...S.cats].map(c => kept.filter(i => i.cat === c).sort((a, b) => b.s - a.s)).filter(g => g.length);
  const mixed = [];
  while (groups.some(g => g.length)) for (const g of groups) if (g.length) mixed.push(g.shift());
  return mixed;
}

/* ---------- Suche ---------- */
async function search(surprise) {
  show('err', false);
  if (!S.cats.size) { $('err').textContent = 'Wähle mindestens eine Kategorie.'; show('err', true); return; }
  if (!S.loc) { const ok = await locate(); if (!ok) return; }
  loading(true, 'Suche Orte in der Nähe …');
  try {
    const els = await overpass(buildQuery(S.loc[0], S.loc[1]));
    S.all = processEls(els); S.shown = 10;
    if (!S.all.length) { $('err').textContent = 'Nichts gefunden. Vergrößere die Reichweite oder lockere die Filter.'; show('err', true); return; }
    renderResults();
    if (surprise) { const pick = S.all[Math.floor(Math.random() * Math.min(15, S.all.length))]; openSheet(pick); }
  } catch(e) {
    $('err').textContent = 'Die kostenlose Ortsdatenbank ist gerade überlastet. Probier es in ein paar Sekunden nochmal.'; show('err', true);
  } finally { loading(false); }
}

/* ---------- Ergebnisse ---------- */
function links(i, compact) {
  const t = i.tags, tr = TRAVEL[S.travel], q = encodeURIComponent(i.name + (t['addr:street'] ? ' ' + t['addr:street'] : '') + ' München');
  const menu = t.menu || t['website:menu'], web = t.website || t['contact:website'];
  const a = [`<a class="main" href="https://www.google.com/maps/dir/?api=1&destination=${i.lat},${i.lon}&travelmode=${tr.g}" target="_blank" rel="noopener">Route</a>`];
  if (menu) a.push(`<a href="${esc(menu)}" target="_blank" rel="noopener">Speisekarte</a>`);
  if (web) a.push(`<a href="${esc(web)}" target="_blank" rel="noopener">${i.cat === 'essen' && !menu ? 'Website / Menü' : 'Website'}</a>`);
  if (i.named) {
    a.push(`<a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Bewertungen & Preise</a>`);
    if (!compact) a.push(`<a href="https://www.tiktok.com/search?q=${encodeURIComponent(i.name + ' München')}" target="_blank" rel="noopener">TikTok</a>`,
      `<a href="https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(i.name + ' München')}" target="_blank" rel="noopener">Instagram</a>`);
  }
  return a.join('');
}
function tagRow(i) {
  const t = [];
  if (i.open === true) t.push('<span class="tag open">jetzt offen</span>'); else if (i.open === false) t.push('<span class="tag closed">gerade zu</span>');
  if (i.free === true) t.push('<span class="tag free">kostenlos</span>');
  const cz = cuisines(i.tags).slice(0, 3).map(c => CUISINE_DE[c] || c.replace(/_/g, ' '));
  cz.forEach(c => t.push(`<span class="tag">${esc(c)}</span>`));
  if (i.tags['diet:vegan'] === 'yes' || i.tags['diet:vegan'] === 'only') t.push('<span class="tag">vegane Optionen</span>');
  if (i.tags.outdoor_seating === 'yes') t.push('<span class="tag">draußen sitzen</span>');
  return t.join('');
}
const pinIcon = n => L.divIcon({className:'pin', html:String(n), iconSize:[28,28]});
function renderResults() {
  show('setup', false); show('vote', false); show('results', true); window.scrollTo(0, 0);
  const list = S.all.slice(0, S.shown);
  $('resTitle').textContent = `${S.all.length} Orte · ${S.rangeType === 'min' ? S.range + ' Min. ' + TRAVEL[S.travel].n : String(S.range).replace('.', ',') + ' km Umkreis'}`;
  $('list').innerHTML = list.map((i, n) => `<li class="item" data-i="${n}"><div class="num">${n + 1}</div><div>
    <h3>${esc(i.name)}</h3><div class="meta">${esc(i.named ? i.kind : 'in der Nähe')} · ${fmtKm(i.d)} · ca. ${fmtMin(i.min)} ${TRAVEL[S.travel].n}</div>
    <div class="tags">${tagRow(i)}</div><div class="links">${links(i, true)}</div></div></li>`).join('');
  show('btnMore', S.all.length > S.shown);
  const out = S.mode === 'out';
  $('btnVoteHere').className = out ? 'btn' : 'btn ghost'; $('btnShare').className = out ? 'btn ghost' : 'btn';
  if (typeof L === 'undefined') { $('resMap').hidden = true; return; }
  if (!resMap) { resMap = L.map('resMap'); tiles().addTo(resMap); resLayer = L.layerGroup().addTo(resMap); }
  resLayer.clearLayers();
  L.marker(S.loc, {icon:meIcon()}).addTo(resLayer);
  list.forEach((i, n) => L.marker([i.lat, i.lon], {icon:pinIcon(n + 1)}).on('click', () => openSheet(i)).addTo(resLayer));
  setTimeout(() => { resMap.invalidateSize(); resMap.fitBounds(L.latLngBounds([S.loc, ...list.map(i => [i.lat, i.lon])]), {padding:[30,30], maxZoom:16}); }, 50);
}
function openSheet(i) {
  const t = i.tags, addr = [t['addr:street'] && (t['addr:street'] + ' ' + (t['addr:housenumber'] || '')), t['addr:postcode'] && (t['addr:postcode'] + ' ' + (t['addr:city'] || 'München'))].filter(Boolean).join(', ');
  const rows = [['Art', i.kind], ['Entfernung', `${fmtKm(i.d)} · ca. ${fmtMin(i.min)} ${TRAVEL[S.travel].n}`], ['Adresse', addr], ['Öffnungszeiten', t.opening_hours], ['Telefon', t.phone || t['contact:phone']],
    ['Kosten', i.free === true ? 'kostenlos' : (t.fee === 'yes' ? 'Eintritt' : 'Preise über „Bewertungen & Preise“ prüfen')], ['Barrierefrei', t.wheelchair === 'yes' ? 'ja' : (t.wheelchair === 'limited' ? 'eingeschränkt' : '')]].filter(r => r[1]);
  $('sheetBody').innerHTML = `<h3>${esc(i.name)}</h3><div class="tags">${tagRow(i)}</div>
    <dl class="kv">${rows.map(r => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl><div class="links">${links(i, false)}</div>
    <p class="note">Die Fahrzeit ist geschätzt. Für die genaue Verbindung tippe auf „Route“.</p>`;
  show('sheet', true);
}

/* ---------- Abstimmung ---------- */
const b64e = s => { const b = new TextEncoder().encode(s); let x = ''; b.forEach(c => x += String.fromCharCode(c)); return btoa(x).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const b64d = s => { const x = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(x, c => c.charCodeAt(0))); };
const pollFromList = () => ({t:(S.locName || 'Treffpunkt').split(' · ')[0], m:S.travel, p:S.all.slice(0, Math.min(10, S.shown)).map(i => ({n:i.name, k:i.kind, a:+i.lat.toFixed(5), o:+i.lon.toFixed(5), i:i.id, d:+i.d.toFixed(2), u:i.named ? 1 : 0})), v:{}});
const pollLink = p => location.origin + location.pathname + '#v=' + b64e(JSON.stringify(p));
function parsePolls(text) { const out = []; const rx = /#v=([A-Za-z0-9_-]+)/g; let m; while ((m = rx.exec(text))) { try { out.push(JSON.parse(b64d(m[1]))); } catch(e) {} } return out; }
function mergeInto(p, others) {
  let n = 0; const sig = x => x.p.map(q => q.i).join(',');
  for (const o of others) if (sig(o) === sig(p)) for (const [k, v] of Object.entries(o.v || {})) { if (!p.v[k]) n++; p.v[k] = v; }
  return n;
}
const V = $('vote');
function openVote() { show('setup', false); show('results', false); show('vote', true); window.scrollTo(0, 0); }

// Modus A: Handy rumgeben
function localVoteSetup() {
  S.poll = pollFromList(); openVote();
  V.innerHTML = `<div class="vhead"><h2>Wer stimmt ab?</h2><p class="hint">Jeder swipet die ${S.poll.p.length} Orte durch, dann gebt ihr das Handy weiter.</p></div>
    <div class="people" id="people">${[1,2,3].map(n => `<input placeholder="Name ${n}" maxlength="20">`).join('')}</div>
    <div class="resactions"><button class="btn ghost" id="addP">+ Person</button><button class="btn" id="startV">Los geht's</button></div>
    <button class="btn ghost wide" id="vBack">Zurück zur Liste</button>`;
  $('addP').onclick = () => { const i = document.createElement('input'); i.placeholder = 'Name ' + ($('people').children.length + 1); i.maxLength = 20; $('people').appendChild(i); i.focus(); };
  $('vBack').onclick = renderResults;
  $('startV').onclick = () => {
    const inputs = [...$('people').querySelectorAll('input')];
    const filled = inputs.map(x => x.value.trim()).filter(Boolean);
    const base = filled.length >= 2 ? filled : inputs.map((_, n) => 'Person ' + (n + 1));
    const list = base.map((n, k) => base.indexOf(n) === k ? n : n + ' ' + (k + 1));
    nextPerson(list, 0);
  };
}
function nextPerson(names, k) {
  if (k >= names.length) return voteResults(false);
  V.innerHTML = `<div class="pass"><p class="hint">Gib das Handy an</p><div class="who">${esc(names[k])}</div>
    <button class="btn big" id="go">Ich bin ${esc(names[k])} – los</button><p class="hint">Die anderen nicht spicken lassen.</p></div>`;
  $('go').onclick = () => swipe(names[k], () => nextPerson(names, k + 1));
}
// Swipe-Stapel
function swipe(name, done) {
  const P = S.poll.p, bits = [];
  V.innerHTML = `<div class="vhead"><h2>${esc(name)}</h2><p class="hint" id="prog"></p></div><div class="stack" id="stack"></div>
    <div class="vbtns"><button class="btn nope" id="bn">Nein</button><button class="btn yep" id="by">Ja</button></div>
    <p class="hint" style="text-align:center">Wischen: rechts = Ja, links = Nein</p>`;
  const stack = $('stack');
  const draw = () => {
    if (bits.length >= P.length) { S.poll.v[name] = bits.join(''); return done(); }
    const q = P[bits.length];
    $('prog').textContent = `Ort ${bits.length + 1} von ${P.length}`;
    stack.innerHTML = `<div class="card" id="card"><div class="cnum">${bits.length + 1}</div><span class="stamp y" id="sy">JA</span><span class="stamp n" id="sn">NEIN</span>
      <p class="big">${esc(q.n)}</p><div class="meta">${esc(q.u ? q.k : 'in der Nähe')} · ${fmtKm(q.d)} · ca. ${fmtMin(TRAVEL[S.poll.m || 'walk'].t(q.d))} ${TRAVEL[S.poll.m || 'walk'].n}</div>
      ${q.u ? `<div class="links"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.n + ' München')}" target="_blank" rel="noopener">Ansehen</a></div>` : ''}</div>`;
    attachDrag($('card'));
  };
  const decide = yes => {
    const c = $('card'); if (!c) return;
    c.style.transform = `translateX(${yes ? 130 : -130}%) rotate(${yes ? 18 : -18}deg)`;
    bits.push(yes ? 1 : 0); setTimeout(draw, 220);
  };
  function attachDrag(c) {
    let x0 = null, dx = 0;
    c.addEventListener('pointerdown', e => { if (e.target.closest('a')) return; x0 = e.clientX; c.setPointerCapture(e.pointerId); c.style.transition = 'none'; });
    c.addEventListener('pointermove', e => { if (x0 == null) return; dx = e.clientX - x0; c.style.transform = `translateX(${dx}px) rotate(${dx/18}deg)`;
      $('sy').style.opacity = Math.max(0, dx/100); $('sn').style.opacity = Math.max(0, -dx/100); });
    const end = () => { if (x0 == null) return; x0 = null; c.style.transition = '';
      if (Math.abs(dx) > 90) decide(dx > 0); else { c.style.transform = ''; $('sy').style.opacity = 0; $('sn').style.opacity = 0; } dx = 0; };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  }
  $('by').onclick = () => decide(true); $('bn').onclick = () => decide(false);
  draw();
}
function voteResults(remote) {
  const P = S.poll.p, who = Object.keys(S.poll.v), N = who.length;
  const rows = P.map((q, n) => ({q, n, y:who.filter(w => S.poll.v[w][n] === '1')})).sort((a, b) => b.y.length - a.y.length || a.n - b.n);
  const top = rows[0] && rows[0].y.length ? rows[0].y.length : 0;
  const winners = rows.filter(r => r.y.length === top && top > 0);
  V.innerHTML = `<div class="vhead"><h2>${top ? (winners.length > 1 ? 'Gleichstand!' : 'Ihr geht zu …') : 'Keiner will irgendwo hin'}</h2>
    <p class="hint">${N} ${N === 1 ? 'Stimme' : 'Stimmen'}: ${esc(who.join(', '))}</p></div>
    ${winners.length > 1 ? '<button class="btn wide" id="tie">Zufall entscheidet</button>' : ''}
    <ol class="rank">${rows.map(r => `<li class="${r.y.length === top && top ? 'win' : ''}"><b>${esc(r.q.n)}</b> · ${r.y.length} von ${N}
      <div class="bar"><i style="width:${N ? r.y.length / N * 100 : 0}%"></i></div>${r.y.length ? `<div class="who2">${esc(r.y.join(', '))}</div>` : ''}
      ${r.y.length === top && top ? `<div class="links"><a class="main" href="https://www.google.com/maps/dir/?api=1&destination=${r.q.a},${r.q.o}&travelmode=${TRAVEL[S.poll.m || 'walk'].g}" target="_blank" rel="noopener">Route dorthin</a></div>` : ''}</li>`).join('')}</ol>
    ${remote ? `<div class="block" style="margin-top:14px"><h2>Stimmen teilen</h2><p class="hint">Schick diesen Link in eure Gruppe. Wer ihn öffnet, sieht alle bisherigen Stimmen und kann selbst abstimmen.</p>
      <div class="resactions" style="margin-top:10px"><button class="btn" id="cp">Link kopieren</button><a class="btn ghost" id="wa" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">Per WhatsApp</a></div>
      <p class="hint">Haben mehrere gleichzeitig abgestimmt? Füge ihre Links hier ein, um alles zusammenzuführen:</p>
      <textarea id="mergeTxt" placeholder="Links hier einfügen"></textarea><button class="btn ghost wide" id="mergeBtn">Zusammenführen</button>
      <button class="btn ghost wide" id="again">Ich will (nochmal) abstimmen</button></div>` : `<button class="btn ghost wide" id="vList">Zurück zur Liste</button>`}`;
  if ($('tie')) $('tie').onclick = () => { const w = winners[Math.floor(Math.random() * winners.length)]; toast('Der Zufall sagt: ' + w.q.n); };
  if (remote) {
    const link = pollLink(S.poll);
    try { history.replaceState(null, '', '#v=' + link.split('#v=')[1]); } catch(e) {}
    $('wa').href = 'https://wa.me/?text=' + encodeURIComponent('Wohin jetzt? Stimm hier ab: ' + link);
    $('cp').onclick = () => copy(link);
    $('mergeBtn').onclick = () => { const n = mergeInto(S.poll, parsePolls($('mergeTxt').value)); toast(n ? n + ' neue Stimme(n) übernommen' : 'Keine neuen Stimmen gefunden'); voteResults(true); };
    $('again').onclick = remoteJoin;
  } else $('vList').onclick = renderResults;
}
async function copy(txt) {
  try { await navigator.clipboard.writeText(txt); toast('Link kopiert'); }
  catch(e) { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Link kopiert'); } catch(x) { toast('Kopieren nicht möglich'); } ta.remove(); }
}
// Modus B: per Link
function shareVote() { S.poll = pollFromList(); remoteJoin(true); }
function remoteJoin(isHost) {
  openVote(); const p = S.poll, who = Object.keys(p.v);
  V.innerHTML = `<div class="vhead"><h2>${isHost === true ? 'Abstimmung starten' : 'Ihr habt die Wahl'}</h2>
    <p class="hint">${p.p.length} Orte rund um ${esc(p.t)}${who.length ? ' · schon abgestimmt: ' + esc(who.join(', ')) : ''}</p></div>
    <div class="block"><h2>Dein Name</h2><div class="addr"><input id="myName" placeholder="z. B. Efe" maxlength="20"></div>
    <button class="btn big wide" id="goV" style="margin-top:12px">Abstimmen</button></div>
    ${who.length ? '<button class="btn ghost wide" id="seeR">Nur Ergebnis ansehen</button>' : ''}
    ${isHost === true ? '<button class="btn ghost wide" id="vBack2">Zurück zur Liste</button>' : ''}`;
  try { $('myName').value = localStorage.getItem('wohin-name') || ''; } catch(e) {}
  $('goV').onclick = () => {
    const n = $('myName').value.trim(); if (!n) { toast('Gib kurz deinen Namen ein'); return; }
    try { localStorage.setItem('wohin-name', n); } catch(e) {}
    swipe(n, () => voteResults(true));
  };
  if ($('seeR')) $('seeR').onclick = () => voteResults(true);
  if ($('vBack2')) $('vBack2').onclick = renderResults;
}

/* ---------- Setup-UI ---------- */
function segBind(id, key, after) {
  const el = $(id);
  el.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === String(S[key]));
    b.onclick = () => { S[key] = b.dataset.v; el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); save(); after && after(); }; });
}
function renderCats() {
  $('cats').innerHTML = CATS.map(c => `<button class="cat ${S.cats.has(c.k) ? 'on' : ''}" data-k="${c.k}" aria-pressed="${S.cats.has(c.k)}"><b>${c.n}</b><small>${c.d}</small></button>`).join('');
  $('cats').querySelectorAll('.cat').forEach(b => b.onclick = () => { const k = b.dataset.k; S.cats.has(k) ? S.cats.delete(k) : S.cats.add(k); save(); renderCats(); });
  show('foodPanel', S.cats.has('essen'));
}
function renderCuisines() {
  $('cuisines').innerHTML = CUISINES.map(c => { const v = S.cuisine[c.k] || 0; return `<button class="chip ${v === 1 ? 'yes' : v === -1 ? 'no' : ''}" data-k="${c.k}">${c.n}</button>`; }).join('');
  $('cuisines').querySelectorAll('.chip').forEach(b => b.onclick = () => { const k = b.dataset.k, v = S.cuisine[k] || 0; S.cuisine[k] = v === 0 ? 1 : v === 1 ? -1 : 0; save(); renderCuisines(); });
}
function setMode(m) {
  S.mode = m; document.querySelectorAll('.mode').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  show('planHint', m === 'plan');
  $('btnLocate').textContent = m === 'plan' ? 'Meinen Standort nehmen' : 'Standort verwenden';
  if (!$('results').hidden) renderResults();
  if (!$('vote').hidden) { show('vote', false); show('setup', true); }
}

document.querySelectorAll('.mode').forEach(b => b.onclick = () => { setMode(b.dataset.mode); if ($('setup').hidden && $('results').hidden) show('setup', true); });
$('btnLocate').onclick = () => { show('err', false); locate(); };
$('addrForm').onsubmit = e => { e.preventDefault(); const q = $('addrInput').value.trim(); if (q) geocode(q); };
segBind('travel', 'travel', updRange);
segBind('rangeType', 'rangeType', () => { S.range = S.rangeType === 'km' ? 2 : 15; save(); updRange(); });
segBind('budget', 'budget');
$('rangeInput').oninput = e => { S.range = +e.target.value; save(); updRange(); };
$('openNow').checked = S.openNow; $('openNow').onchange = e => { S.openNow = e.target.checked; save(); };
$('btnSearch').onclick = () => search(false);
$('btnSurprise').onclick = () => search(true);
$('btnBack').onclick = () => { show('results', false); show('setup', true); setTimeout(() => setupMap && setupMap.invalidateSize(), 50); };
$('btnMore').onclick = () => { S.shown += 10; renderResults(); };
$('list').onclick = e => { if (e.target.closest('a')) return; const li = e.target.closest('.item'); if (li) openSheet(S.all[+li.dataset.i]); };
$('btnVoteHere').onclick = localVoteSetup;
$('btnShare').onclick = shareVote;
$('sheetClose').onclick = () => show('sheet', false);
$('sheet').onclick = e => { if (e.target.id === 'sheet') show('sheet', false); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') show('sheet', false); });

renderCats(); renderCuisines(); initSetupMap(); updRange();
// Abstimmungs-Link geöffnet?
const hv = parsePolls(location.hash);
if (hv.length) { S.poll = hv[0]; S.poll.v = S.poll.v || {}; S.mode = 'plan'; setMode('plan'); remoteJoin(false); }
}
