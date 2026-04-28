'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const ZONE_COLORS = [
  '#6366f1','#22d3ee','#10b981','#f59e0b','#ef4444',
  '#a855f7','#ec4899','#14b8a6','#f97316','#84cc16',
  '#06b6d4','#8b5cf6','#e11d48','#0ea5e9','#65a30d'
];

const REQUIRED_COLS = ['CLIENTE','RAZON SOCIAL','NOMBRE CLIENTE','ZONA','DESCRIPCION','LATITUDE','LONGITUDE'];
const BLOCK_SIZE = 10;

// ============================================================
// APP STATE
// ============================================================
const APP = {
  rawClients: [],
  zones: {},
  startLat: -25.374708,
  startLon: -55.719584,
  numDrivers: 2,
  fuelL100: 8,
  fuelPrice: 7500,
  startTime: '06:00',
  serviceTime: 20,
  workHours: 8.5,
  lunchMin: 60,
  drivers: [],
  zoneResults: {},
  configMap: null,
  resultsMap: null,
  configMapMarker: null,
  currentStep: 1,
  mapLayers: { straightLines:{}, straightReturns:{}, roadRoutes:{}, markers:{} },
  routeMode: 'straight',
  mapStyle: 'dark',
  visibleZones: {},
  selectedDayFilter: 0, 
  tileLayers: {},
  configTileLayers: {},
  charts: {},
  // Zone Editing State
  selectedIndices: new Set(),
  isEditingZones: false,
  drawnItems: null,
  drawControl: null
};

// ============================================================
// UTILS
// ============================================================
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function rd(n, d) { return Math.round(n * 10**d) / 10**d; }

function fmtKm(km) { return km != null ? `${rd(km,1)} km` : '—'; }

function fmtMin(min) {
  if (min == null || isNaN(min)) return '—';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtGs(val) {
  return val.toLocaleString('es-PY', { maximumFractionDigits: 0 }) + ' Gs.';
}

function getColor(zoneName) {
  const idx = Object.keys(APP.zones).indexOf(zoneName);
  return ZONE_COLORS[idx % ZONE_COLORS.length];
}

function makeNumMarker(num, color, isSelected = false) {
  const selectedClass = isSelected ? 'marker-selected' : '';
  return L.divIcon({
    className: selectedClass,
    html: `<div style="background:${color};color:#fff;border:2px solid rgba(255,255,255,0.8);border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.5);font-family:Inter,sans-serif;">${num}</div>`,
    iconSize: [26,26], iconAnchor: [13,13]
  });
}

function makeStartMarker() {
  return L.divIcon({
    className: '',
    html: `<div style="background:#f59e0b;color:#000;border:2px solid rgba(255,255,255,0.9);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 12px rgba(245,158,11,0.6);">🏁</div>`,
    iconSize: [36,36], iconAnchor: [18,18]
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// NAVIGATION
// ============================================================
function goToStep(n) {
  [1,2,3].forEach(i => {
    document.getElementById(`panelStep${i}`).classList.toggle('active', i === n);
    const si = document.getElementById(`si${i}`);
    si.classList.remove('active','done');
    if (i === n) si.classList.add('active');
    else if (i < n) si.classList.add('done');
    if (i < 3) {
      const sl = document.getElementById(`sl${i}`);
      sl.classList.toggle('done', i < n);
    }
  });
  APP.currentStep = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// STEP 1 — UPLOAD
// ============================================================
function initUpload() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  document.getElementById('btnToStep2').addEventListener('click', () => {
    document.getElementById('inputLat').value = APP.startLat;
    document.getElementById('inputLon').value = APP.startLon;
    goToStep(2);
    setTimeout(() => {
      initConfigMap();
      updateDriverAssignment();
      renderZonesTable();
      initZoneEditor();
    }, 200);
  });
}

function handleFile(file) {
  if (!/\.xlsx?$/i.test(file.name)) { alert('Seleccioná un archivo .xlsx o .xls'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!raw.length) { alert('El archivo está vacío.'); return; }

      // Normalize column keys
      const data = raw.map(row => {
        const nr = {};
        Object.keys(row).forEach(k => { nr[k.trim().toUpperCase().replace(/_/g,' ')] = row[k]; });
        return nr;
      });

      const keys = Object.keys(data[0]);
      const missing = REQUIRED_COLS.filter(c => !keys.includes(c));
      if (missing.length) {
        alert(`Faltan columnas: ${missing.join(', ')}\n\nEncontradas: ${keys.join(', ')}`);
        return;
      }

      APP.rawClients = data
        .filter(r => r['LATITUDE'] !== '' && r['LONGITUDE'] !== '')
        .map(r => ({
          CLIENTE: String(r['CLIENTE'] || ''),
          RAZON_SOCIAL: String(r['RAZON SOCIAL'] || ''),
          NOMBRE_CLIENTE: String(r['NOMBRE CLIENTE'] || ''),
          ZONA: String(r['ZONA'] || 'SIN ZONA').trim(),
          DESCRIPCION: String(r['DESCRIPCION'] || ''),
          LATITUDE: parseFloat(r['LATITUDE']),
          LONGITUDE: parseFloat(r['LONGITUDE']),
        }))
        .filter(r => !isNaN(r.LATITUDE) && !isNaN(r.LONGITUDE));

      if (!APP.rawClients.length) { alert('No se encontraron clientes con coordenadas válidas.'); return; }

      APP.zones = {};
      APP.rawClients.forEach(c => {
        if (!APP.zones[c.ZONA]) APP.zones[c.ZONA] = [];
        APP.zones[c.ZONA].push(c);
      });

      showUploadPreview(file.name);
    } catch (err) {
      alert('Error leyendo el archivo: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function showUploadPreview(filename) {
  document.getElementById('previewFilename').textContent = filename;
  document.getElementById('previewClientes').textContent = APP.rawClients.length;
  document.getElementById('previewZonas').textContent = Object.keys(APP.zones).length;

  const grid = document.getElementById('zonesGrid');
  grid.innerHTML = Object.entries(APP.zones).map(([zone, clients], i) => {
    const color = ZONE_COLORS[i % ZONE_COLORS.length];
    return `<div class="zone-card" style="border-color:${color}30;background:${color}10">
      <div class="zone-dot" style="background:${color}"></div>
      <div class="zone-card-name">${zone}</div>
      <div class="zone-card-count">${clients.length} clientes</div>
    </div>`;
  }).join('');

  document.getElementById('previewSection').style.display = 'block';
  document.getElementById('uploadZone').style.display = 'none';

  document.getElementById('headerPills').style.display = 'flex';
  document.getElementById('pilClientes').textContent = `${APP.rawClients.length} clientes`;
  document.getElementById('pilZonas').textContent = `${Object.keys(APP.zones).length} zonas`;
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const wsData = [REQUIRED_COLS];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Planilla Base');
  XLSX.writeFile(wb, 'rutaspro_planilla_base.xlsx');
  if (typeof showToast === 'function') showToast('✓ Planilla base descargada');
}

// ============================================================
// STEP 2 — CONFIG MAP
// ============================================================
function initConfigMap() {
  if (APP.configMap) { APP.configMap.invalidateSize(); return; }

  APP.configMap = L.map('configMap').setView([APP.startLat, APP.startLon], 12);
  
  APP.configTileLayers = {
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB', crossOrigin: 'Anonymous' }),
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB', crossOrigin: 'Anonymous' }),
    streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }),
    satellite: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { attribution: '&copy; Google' }),
    terrain: L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', { attribution: '&copy; Google' })
  };

  APP.configTileLayers.dark.addTo(APP.configMap);

  APP.configMapMarker = L.marker([APP.startLat, APP.startLon], { icon: makeStartMarker() })
    .addTo(APP.configMap).bindPopup('Punto de partida').openPopup();

  APP.configMap.on('click', e => {
    APP.startLat = rd(e.latlng.lat,6);
    APP.startLon = rd(e.latlng.lng,6);
    document.getElementById('inputLat').value = APP.startLat;
    document.getElementById('inputLon').value = APP.startLon;
    APP.configMapMarker.setLatLng([APP.startLat, APP.startLon]);
  });

  Object.entries(APP.zones).forEach(([zone, clients], i) => {
    const color = ZONE_COLORS[i % ZONE_COLORS.length];
    clients.forEach(c => {
      L.circleMarker([c.LATITUDE, c.LONGITUDE], {
        radius:5, fillColor:color, color:'rgba(255,255,255,0.3)', weight:1, fillOpacity:0.7
      }).addTo(APP.configMap).bindPopup(`<strong>${c.CLIENTE}</strong><br>${c.NOMBRE_CLIENTE}<br><small>Zona: ${zone}</small>`);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnUpdateMap').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('inputLat').value);
    const lon = parseFloat(document.getElementById('inputLon').value);
    if (!isNaN(lat) && !isNaN(lon)) {
      APP.startLat = lat; APP.startLon = lon;
      if (APP.configMapMarker) {
        APP.configMapMarker.setLatLng([lat, lon]);
        APP.configMap.setView([lat, lon]);
      }
    }
  });
});

// ============================================================
// DRIVER ASSIGNMENT
// ============================================================
function autoAssignDrivers() {
  const sorted = Object.entries(APP.zones).sort((a,b) => b[1].length - a[1].length);
  const drivers = Array.from({ length: APP.numDrivers }, (_,i) => ({
    name: `Repartidor ${i+1}`,
    zones: [],
    totalClients: 0,
    totalKm: 0,
    startLat: APP.startLat,
    startLon: APP.startLon
  }));
  sorted.forEach(([zone, clients]) => {
    const d = drivers.reduce((min,d) => d.totalClients < min.totalClients ? d : min);
    d.zones.push(zone);
    d.totalClients += clients.length;
  });
  APP.drivers = drivers;
  return drivers;
}

function updateDriverAssignment() {
  const drivers = autoAssignDrivers();
  const preview = document.getElementById('driverPreview');
  preview.innerHTML = drivers.map((d,i) => {
    const color = ZONE_COLORS[i % ZONE_COLORS.length];
    return `<div class="driver-preview-row">
      <div class="driver-preview-icon" style="background:${color}20;border-color:${color}50;color:${color}">${i+1}</div>
      <div>
        <div class="driver-preview-name">${d.name}</div>
        <div class="driver-preview-zones">${d.zones.join(' · ')} &mdash; ${d.totalClients} clientes</div>
      </div>
    </div>`;
  }).join('');

  const zoneCount = Object.keys(APP.zones).length;
  const emptyDrivers = drivers.filter(d => d.zones.length === 0).length;

  // Warning: more drivers than zones
  const warningEl = document.getElementById('driverWarning');
  if (warningEl) {
    if (emptyDrivers > 0) {
      warningEl.style.display = 'block';
      warningEl.innerHTML = `⚠️ <b>${emptyDrivers} repartidor${emptyDrivers > 1 ? 'es' : ''} sin zona.</b><br>
        Hay ${zoneCount} zonas y ${drivers.length} repartidores — reducí repartidores o creá más zonas.`;
    } else {
      warningEl.style.display = 'none';
    }
  }

  document.getElementById('pilRepartidores').textContent = `${drivers.length} repartidores`;
}

// ============================================================
// NEAREST NEIGHBOR OPTIMIZATION
// ============================================================
function nearestNeighbor(clients, sLat, sLon) {
  let remaining = clients.map(c => ({ ...c }));
  let ordered = [], cumKm = 0;
  let curLat = sLat, curLon = sLon;

  while (remaining.length > 0) {
    let minDist = Infinity, minIdx = -1;
    remaining.forEach((c,i) => {
      const d = haversine(curLat, curLon, c.LATITUDE, c.LONGITUDE);
      if (d < minDist) { minDist = d; minIdx = i; }
    });
    const client = remaining[minIdx];
    cumKm += minDist;
    ordered.push({ ...client, ORDER: ordered.length+1, LEG_KM: rd(minDist,4), CUM_KM: rd(cumKm,4),
      DIST_DIRECT: rd(haversine(sLat, sLon, client.LATITUDE, client.LONGITUDE), 4),
      LEG_KM_REAL: null, LEG_MIN_REAL: null, CUM_KM_REAL: null, CUM_MIN_REAL: null });
    curLat = client.LATITUDE; curLon = client.LONGITUDE;
    remaining.splice(minIdx, 1);
  }

  const returnKm = haversine(curLat, curLon, sLat, sLon);

  // Unoptimized distance (original order)
  let uKm = 0, pLat = sLat, pLon = sLon;
  clients.forEach(c => { uKm += haversine(pLat, pLon, c.LATITUDE, c.LONGITUDE); pLat=c.LATITUDE; pLon=c.LONGITUDE; });

  return { ordered, totalKm: rd(cumKm,4), returnKm: rd(returnKm,4), unoptimizedKm: rd(uKm,4) };
}

function optimizeAllZones() {
  APP.zoneResults = {};
  Object.entries(APP.zones).forEach(([zone, clients]) => {
    APP.zoneResults[zone] = nearestNeighbor(clients, APP.startLat, APP.startLon);
  });
  APP.drivers.forEach(d => {
    d.totalKm = d.zones.reduce((s,z) => s + (APP.zoneResults[z]?.totalKm || 0), 0);
  });
}

function renameZone(oldName) {
  const newName = prompt(`Cambiar nombre de la zona "${oldName}":`, oldName);
  if (newName && newName.trim() && newName.trim() !== oldName) {
    const trimmed = newName.trim();
    
    // 1. Update master list
    APP.rawClients.forEach(c => {
      if (c.ZONA === oldName) c.ZONA = trimmed;
    });

    // 2. Re-group zones in APP.zones
    APP.zones = {};
    APP.rawClients.forEach(c => {
      const zone = (c.ZONA || '').trim();
      if (!zone || zone === 'SIN ZONA') return;
      if (!APP.zones[zone]) APP.zones[zone] = [];
      APP.zones[zone].push(c);
    });

    // 3. Update Results and Drivers (if calculated)
    if (APP.zoneResults && APP.zoneResults[oldName]) {
      APP.zoneResults[trimmed] = APP.zoneResults[oldName];
      delete APP.zoneResults[oldName];
      
      // Update the clients within the result object
      if (APP.zoneResults[trimmed].ordered) {
        APP.zoneResults[trimmed].ordered.forEach(oc => oc.ZONA = trimmed);
      }
      
      // Update driver assignments
      APP.drivers.forEach(d => {
        if (d.zones) {
          d.zones = d.zones.map(z => z === oldName ? trimmed : z);
        }
      });

      // Update visibility state
      if (APP.visibleZones && APP.visibleZones[oldName] !== undefined) {
        APP.visibleZones[trimmed] = APP.visibleZones[oldName];
        delete APP.visibleZones[oldName];
      }
    }

    // 4. Force UI refresh everywhere
    renderZonesTable();
    refreshConfigMapMarkers();
    if (APP.currentStep === 3) showResults(); 
    
    showToast(`✅ Zona renombrada a "${trimmed}"`);
  }
}

function renderZonesTable() {
  const container = document.getElementById('zonesTableContainer');
  if (container) {
    const zones = Object.keys(APP.zones);
    if (zones.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:12px">No se detectaron zonas.</p>';
    } else {
      container.innerHTML = zones.map(z => {
        const color = getColor(z);
        const count = APP.zones[z].length;
        return `
          <div class="zone-tag" onclick="renameZone('${z.replace(/'/g,"\\'")}')" style="cursor:pointer" title="Click para renombrar">
            <span class="zone-tag-color" style="background:${color}"></span>
            <span>${z}</span>
            <span class="zone-tag-count">${count} pts</span>
            <span style="font-size:10px; margin-left:4px; opacity:0.5">✎</span>
          </div>
        `;
      }).join('');
    }
  }
  refreshMapZonePanel();
}

// ============================================================
// ZONE INTERACTIVE EDITOR
// ============================================================
function initZoneEditor() {
  if (!APP.configMap) return;
  
  // Cleanup previous markers/draw
  if (APP.drawnItems) APP.configMap.removeLayer(APP.drawnItems);
  
  APP.drawnItems = new L.FeatureGroup();
  APP.configMap.addLayer(APP.drawnItems);

  APP.drawControl = new L.Control.Draw({
    draw: {
      polyline: false, circle: false, circlemarker: false, marker: false,
      rectangle: { shapeOptions: { color: '#6366f1' } },
      polygon: { shapeOptions: { color: '#6366f1' } }
    },
    edit: { featureGroup: APP.drawnItems, remove: true }
  });

  APP.configMap.on(L.Draw.Event.CREATED, (e) => {
    const layer = e.layer;
    APP.drawnItems.addLayer(layer);
    selectPointsInPoly(layer);
  });

  // Render all points as simple dots for selection
  refreshConfigMapMarkers();
  // Refresh the floating zone summary panel
  refreshMapZonePanel();
}

function refreshConfigMapMarkers() {
  if (!APP.configMap) return;
  // Clear existing
  APP.configMap.eachLayer(l => { if(l instanceof L.Marker && l !== APP.configMapMarker) APP.configMap.removeLayer(l); });

  APP.rawClients.forEach((c, idx) => {
    const color = c.ZONA ? getColor(c.ZONA) : '#94a3b8';
    const isSelected = APP.selectedIndices.has(idx);
    const marker = L.marker([c.LATITUDE, c.LONGITUDE], { 
      icon: makeNumMarker('', color, isSelected) 
    }).addTo(APP.configMap);

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      if (APP.isEditingZones) {
        handleMarkerClick(idx);
      } else {
        marker.bindPopup(`<b>${c.CLIENTE}</b><br>Zona: ${c.ZONA || 'Ninguna'}`).openPopup();
      }
    });
  });
}

function toggleSelectionMode() {
  APP.isEditingZones = !APP.isEditingZones;
  const btn = document.getElementById('btnToggleSelection');
  btn.classList.toggle('active', APP.isEditingZones);
  showToast(APP.isEditingZones ? '📍 Modo selección manual activado' : 'Modo información activado');
}

function startPolygonDraw() {
  new L.Draw.Polygon(APP.configMap, APP.drawControl.options.draw.polygon).enable();
}

function startRectDraw() {
  new L.Draw.Rectangle(APP.configMap, APP.drawControl.options.draw.rectangle).enable();
}

function toggleConfigMapFullscreen() {
  const wrap = document.getElementById('configMapWrap');
  const btn = document.getElementById('btnConfigFullscreen');
  const isFull = wrap.classList.toggle('config-fullscreen');
  btn.textContent = isFull ? '✕ Salir' : '⛶';
  btn.title = isFull ? 'Salir de pantalla completa' : 'Pantalla completa';
  setTimeout(() => APP.configMap?.invalidateSize(), 300);
}

function toggleZonePanelMinimize() {
  const panel = document.getElementById('mapZonePanel');
  const btn = document.getElementById('btnZonePanelMinimize');
  const isMin = panel.classList.toggle('minimized');
  btn.textContent = isMin ? '+' : '−';
  btn.title = isMin ? 'Expandir' : 'Minimizar';
}

function refreshMapZonePanel() {
  const zones = Object.keys(APP.zones);
  const badge = document.getElementById('mapZonePanelCount');
  const list = document.getElementById('mapZoneList');
  if (!badge || !list) return;

  badge.textContent = `${zones.length} zona${zones.length !== 1 ? 's' : ''}`;

  if (zones.length === 0) {
    list.innerHTML = '<span style="color:rgba(255,255,255,0.35);font-size:12px">Sin zonas aún</span>';
    return;
  }

  list.innerHTML = zones.map(z => {
    const color = getColor(z);
    const count = APP.zones[z].length;
    return `
      <div class="map-zone-row" onclick="renameZone('${z.replace(/'/g,"\\'")}')" style="cursor:pointer" title="Click para renombrar">
        <span class="map-zone-row-dot" style="background:${color}"></span>
        <span class="map-zone-row-name">${z}</span>
        <span class="map-zone-row-count">${count} <small style="opacity:0.5;margin-left:2px">✎</small></span>
      </div>`;
  }).join('');
}

function openZoneModal() {
  const zones = Object.keys(APP.zones);
  const sub = document.getElementById('zoneModalSub');
  const grid = document.getElementById('zoneModalGrid');
  sub.textContent = `${APP.selectedIndices.size} puntos seleccionados · Elegí la zona destino`;

  if (zones.length === 0) {
    grid.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:12px 0">No hay zonas creadas aún.<br>Usá el botón de abajo para crear la primera.</p>';
  } else {
    grid.innerHTML = zones.map(z => {
      const color = getColor(z);
      const count = APP.zones[z].length;
      const letter = z.replace(/\D/g,'') || z[0].toUpperCase();
      return `
        <div class="zone-modal-card" onclick="assignSelectionTo('${z.replace(/'/g,"\\'")}');document.getElementById('zoneModal').style.display='none'">
          <div class="zone-modal-card-dot" style="background:${color}">${letter}</div>
          <div class="zone-modal-card-name">${z}</div>
          <div class="zone-modal-card-count">${count} cliente${count !== 1 ? 's' : ''}</div>
        </div>`;
    }).join('');
  }

  document.getElementById('zoneModal').style.display = 'flex';
}

function closeZoneModal(e) {
  if (e.target === document.getElementById('zoneModal')) {
    document.getElementById('zoneModal').style.display = 'none';
  }
}

function selectPointsInPoly(layer) {
  const polyCoords = layer.getLatLngs()[0];
  APP.rawClients.forEach((c, idx) => {
    if (isPointInPoly({lat: c.LATITUDE, lng: c.LONGITUDE}, polyCoords)) {
      APP.selectedIndices.add(idx);
    }
  });
  updateSelectionUI();
  refreshConfigMapMarkers();
}

function isPointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lat, yi = poly[i].lng;
    const xj = poly[j].lat, yj = poly[j].lng;
    const intersect = ((yi > pt.lng) !== (yj > pt.lng)) && (pt.lat < (xj - xi) * (pt.lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function handleMarkerClick(idx) {
  if (APP.selectedIndices.has(idx)) APP.selectedIndices.delete(idx);
  else APP.selectedIndices.add(idx);
  updateSelectionUI();
  refreshConfigMapMarkers();
}

function updateSelectionUI() {
  const pill = document.getElementById('selectionPill');
  const count = document.getElementById('selectionCount');
  if (APP.selectedIndices.size > 0) {
    pill.style.display = 'flex';
    count.textContent = `${APP.selectedIndices.size} seleccionados`;
  } else {
    pill.style.display = 'none';
  }
}

function clearMapSelection() {
  APP.selectedIndices.clear();
  if (APP.drawnItems) APP.drawnItems.clearLayers();
  updateSelectionUI();
  refreshConfigMapMarkers();
}

function assignToNewZone() {
  const nextNum = Object.keys(APP.zones).length + 1;
  const defaultName = `Zona ${nextNum}`;
  const zoneName = prompt('Ingresá el nombre para la nueva zona:', defaultName);
  if (zoneName && zoneName.trim()) {
    assignSelectionTo(zoneName.trim());
  }
}

function assignToExistingZone() {
  const zones = Object.keys(APP.zones);
  if (zones.length === 0) return assignToNewZone();
  const zoneName = prompt(`Escribí el nombre de la zona:\n(${zones.join(', ')})`, zones[0]);
  if (zoneName) assignSelectionTo(zoneName);
}

function assignSelectionTo(zoneName) {
  APP.selectedIndices.forEach(idx => {
    APP.rawClients[idx].ZONA = zoneName;
  });
  
  // Re-group ALL clients (including those with 'SIN ZONA')
  APP.zones = {};
  APP.rawClients.forEach(c => {
    const zone = (c.ZONA || '').trim();
    if (!zone || zone === 'SIN ZONA') return; // Skip unassigned
    if (!APP.zones[zone]) APP.zones[zone] = [];
    APP.zones[zone].push(c);
  });

  clearMapSelection();
  renderZonesTable();   // Updates sidebar
  refreshMapZonePanel(); // Force-update floating panel
  refreshConfigMapMarkers(); // Re-color map markers
  showToast(`✅ ${APP.selectedIndices.size || ''} clientes asignados a "${zoneName}"`);
}

function exportAssignments() {
  const wb = XLSX.utils.book_new();
  const rows = APP.rawClients.map(c => ({
    'CLIENTE': c.CLIENTE,
    'RAZON SOCIAL': c.RAZON_SOCIAL,
    'ZONA': c.ZONA || 'SIN ZONA',
    'LATITUD': c.LATITUDE,
    'LONGITUD': c.LONGITUDE
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Asignaciones');
  XLSX.writeFile(wb, 'rutaspro_asignaciones.xlsx');
}

// ============================================================
// STEP 3 — RESULTS
// ============================================================
function showResults() {
  renderSummaryCards();
  setTimeout(() => {
    initResultsMap();
    renderDriversPanel();
    renderZonesTable();
    renderDashboard();
    initDragDrop();
  }, 100);
}

function renderSummaryCards() {
  let totKm = 0, totUnopt = 0;
  Object.values(APP.zoneResults).forEach(r => {
    totKm += r.totalKm + r.returnKm;
    totUnopt += r.unoptimizedKm;
  });
  const savedKm = Math.max(0, totUnopt - totKm);
  const liters = totKm * APP.fuelL100 / 100;
  const cost = liters * APP.fuelPrice;
  const savedL = savedKm * APP.fuelL100 / 100;
  const savedCost = savedL * APP.fuelPrice;
  const totalMinEst = totKm * 60 / 30; // ~30 km/h city avg

  document.getElementById('sumKm').textContent = fmtKm(totKm);
  document.getElementById('sumTime').textContent = fmtMin(totalMinEst);
  document.getElementById('sumFuel').textContent = `${liters.toFixed(1)}L · ${fmtGs(cost)}`;
  document.getElementById('sumSaving').textContent = `${fmtKm(savedKm)} · ${fmtGs(savedCost)}`;
  document.getElementById('pilKm').textContent = `${rd(totKm,1)} km`;
}

function initResultsMap() {
  if (!APP.resultsMap) {
    APP.resultsMap = L.map('resultsMap').setView([APP.startLat, APP.startLon], 12);
    
    APP.tileLayers = {
      dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB', crossOrigin: 'Anonymous' }),
      light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB', crossOrigin: 'Anonymous' }),
      streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }),
      satellite: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { attribution: '&copy; Google' }),
      terrain: L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', { attribution: '&copy; Google' })
    };
    
    const activeLayer = APP.tileLayers[APP.mapStyle] || APP.tileLayers.dark;
    activeLayer.addTo(APP.resultsMap);
  } else {
    // Deep cleanup of all layers to prevent ghost lines
    Object.values(APP.mapLayers).forEach(group => {
      Object.values(group).forEach(layerOrSubgroup => {
        if (layerOrSubgroup instanceof L.Layer) {
           APP.resultsMap.removeLayer(layerOrSubgroup);
        } else if (typeof layerOrSubgroup === 'object') {
           Object.values(layerOrSubgroup).forEach(subLayer => {
             if (subLayer instanceof L.Layer) APP.resultsMap.removeLayer(subLayer);
           });
        }
      });
    });
    APP.mapLayers = { straightLines:{}, roadRoutes:{}, markers:{} };
    APP.resultsMap.invalidateSize();
  }

  const allLatLons = [];
  L.marker([APP.startLat, APP.startLon], { icon: makeStartMarker() }).addTo(APP.resultsMap);

  Object.entries(APP.zoneResults).forEach(([zone, result]) => {
    const color = getColor(zone);
    APP.mapLayers.straightLines[zone] = {}; 

    // Draw paths per day
    Object.entries(result.dayPaths || {}).forEach(([dayNum, path]) => {
      const isVisible = (APP.selectedDayFilter === 0 || parseInt(dayNum) === APP.selectedDayFilter);
      const line = L.polyline(path, { 
        color, weight: 3, opacity: 0.6, dashArray: '5,5' 
      });
      if (isVisible && APP.visibleZones[zone] !== false) line.addTo(APP.resultsMap);
      APP.mapLayers.straightLines[zone][dayNum] = line;
    });

    // RE-RENDER ROAD ROUTES if available
    if (result.routeGeometry) {
      const roadLine = L.polyline(result.routeGeometry, { color, weight: 4, opacity: 0.9 });
      APP.mapLayers.roadRoutes[zone] = roadLine;
      if (APP.routeMode === 'real' && APP.visibleZones[zone] !== false) roadLine.addTo(APP.resultsMap);
    }

    // Numbered markers
    APP.mapLayers.markers[zone] = [];
    result.ordered.forEach(c => {
      const isVisible = (APP.selectedDayFilter === 0 || c.SCHEDULE_DAY === APP.selectedDayFilter);
      if (!isVisible || APP.visibleZones[zone] === false) return;

      const popup = `<div style="font-family:Inter,sans-serif;min-width:190px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px">${c.CLIENTE}</div>
        <div style="font-size:12px;color:#555">${c.NOMBRE_CLIENTE}</div>
        <div style="font-size:12px">📅 Día: <b>${c.SCHEDULE_DAY}</b> · ⏰ <b>${c.ARRIVAL_TIME_STR}</b></div>
      </div>`;
      const marker = L.marker([c.LATITUDE, c.LONGITUDE], { icon: makeNumMarker(c.ORDER, color) })
        .addTo(APP.resultsMap).bindPopup(popup);
      APP.mapLayers.markers[zone].push(marker);
      allLatLons.push([c.LATITUDE, c.LONGITUDE]);
    });
  });

  if (allLatLons.length > 1) APP.resultsMap.fitBounds(allLatLons, { padding: [30, 30] });
  buildMapControls();
}

function toggleFullScreenMap() {
  const panel = document.getElementById('tabMap');
  const btn = document.getElementById('btnFullScreen');
  const isFull = panel.classList.toggle('full-screen');
  btn.textContent = isFull ? '🇽 Cerrar pantalla completa' : '⛶ Pantalla completa';
  setTimeout(() => APP.resultsMap.invalidateSize(), 300);
}

function setDayFilter(dayNum) {
  APP.selectedDayFilter = dayNum;
  initResultsMap();
}

function highlightDay(zone, dayNum) {
  const dayLines = APP.mapLayers.straightLines[zone];
  const line = dayLines ? dayLines[dayNum] : null;
  if (line) {
    line.setStyle({ weight: 8, opacity: 1, dashArray: null });
    line.bringToFront();
  }
}

function unhighlightDay(zone, dayNum) {
  const dayLines = APP.mapLayers.straightLines[zone];
  const line = dayLines ? dayLines[dayNum] : null;
  if (line) {
    line.setStyle({ weight: 3, opacity: 0.6, dashArray: '5,5' });
  }
}

function renderDriversPanel() {
  const container = document.getElementById('driversPanel');
  container.innerHTML = APP.drivers.map((driver, di) => {
    const dColor = ZONE_COLORS[di % ZONE_COLORS.length];
    const totKm = driver.zones.reduce((s,z) => s + (APP.zoneResults[z]?.totalKm||0) + (APP.zoneResults[z]?.returnKm||0), 0);
    const totClients = driver.zones.reduce((s,z) => s + (APP.zoneResults[z]?.ordered.length||0), 0);
    const totMinEst = totKm * 60 / 30;

    let currentDay = -1;
    const stopsHtml = driver.zones.map(zone => {
      const result = APP.zoneResults[zone];
      if (!result) return '';
      const zcolor = getColor(zone);
      
      return `<div class="driver-zone-section">
        <div class="driver-zone-header" style="color:${zcolor}">
          <div class="zone-dot-sm" style="background:${zcolor}"></div>
          Zona: ${zone} &mdash; ${result.totalKm.toFixed(2)} km · ${result.ordered.length} paradas
        </div>
        <div class="stops-list">
          ${result.ordered.map((c, si) => {
            let dayHeader = '';
            if (c.SCHEDULE_DAY !== currentDay) {
              currentDay = c.SCHEDULE_DAY;
              dayHeader = `<div class="day-divider" 
                onmouseenter="highlightDay('${zone}', ${currentDay})" 
                onmouseleave="unhighlightDay('${zone}', ${currentDay})">
                📅 Día ${currentDay} <small>(Haz hover para ver en mapa)</small>
              </div>
              <div class="stop-row start-stop">
                <div class="stop-num" style="background:#f59e0b;font-size:14px">🏁</div>
                <div class="stop-info"><div class="stop-name">Inicio desde Depósito (${APP.startTime})</div></div>
              </div>`;
            }
            return `${dayHeader}
            <div class="stop-row" draggable="true" data-draggable-stop="1" data-zone="${zone}" data-idx="${si}">
              <div class="stop-drag-handle" title="Arrastrar para reordenar">⠿</div>
              <div class="stop-num" style="background:${zcolor}">${c.ORDER}</div>
              <div class="stop-info">
                <div class="stop-name">${c.CLIENTE} — ${c.NOMBRE_CLIENTE}</div>
                <div class="stop-desc">${c.DESCRIPCION}</div>
                <div class="stop-schedule">⏰ Llegada: <b>${c.ARRIVAL_TIME_STR}</b> · Salida: <b>${c.DEPARTURE_TIME_STR}</b></div>
                <div class="stop-km">${c.LEG_KM} km desde anterior · <b>${c.DIST_DIRECT} km desde origen</b> · Acumulado: ${c.CUM_KM} km${c.LEG_KM_REAL!=null?` · Real: ${c.LEG_KM_REAL}km`:''}</div>
              </div>
            </div>`;
          }).join('')}
          <div class="stop-row return-stop">
            <div class="stop-num" style="background:#64748b;font-size:14px">🔙</div>
            <div class="stop-info">
              <div class="stop-name">Retorno Final Día ${currentDay}</div>
              <div class="stop-km">${result.returnKm.toFixed(2)} km</div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');

    return `<div class="driver-result-card">
      <div class="driver-result-header" style="border-left:4px solid ${dColor}">
        <div class="driver-result-icon" style="background:${dColor}20;font-size:22px" onclick="toggleDriver(${di})">👤</div>
        <div class="driver-result-info" style="flex:1;min-width:0" onclick="toggleDriver(${di})">
          <div class="driver-result-name" id="driverName${di}" style="color:${dColor}" title="Doble clic para editar el nombre" ondblclick="event.stopPropagation();editDriverName(${di})">${driver.name}</div>
          <div class="driver-result-stats">${driver.zones.length} zona${driver.zones.length>1?'s':''} · ${totClients} paradas · ${totKm.toFixed(1)} km · Día Inicio: 6:00 am</div>
          <div class="driver-home-config" onclick="event.stopPropagation()" style="margin-top:4px; font-size:11px; color:var(--text3)">
             🏠 Inicio per: <input type="text" placeholder="Lat, Lon" value="${driver.startLat === APP.startLat ? '' : driver.startLat+','+driver.startLon}" 
             style="background:none; border:none; color:var(--accent); font-size:11px; width:120px; text-decoration:underline"
             onchange="updateDriverHome(${di}, this.value)">
          </div>
        </div>
        <div class="driver-header-actions" onclick="event.stopPropagation()">
          <button class="btn-wa" id="btnWhatsApp${di}" onclick="copyDriverWhatsApp(${di})" title="Copiar ruta para WhatsApp">📲 WhatsApp</button>
          <button class="btn-toggle" id="toggleBtn${di}" onclick="toggleDriver(${di})">▾</button>
        </div>
      </div>
      <div class="driver-result-body" id="driverBody${di}">${stopsHtml}</div>
    </div>`;
  }).join('');
}

function updateDriverHome(di, val) {
  const parts = val.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    APP.drivers[di].startLat = parts[0];
    APP.drivers[di].startLon = parts[1];
    showToast(`✓ Inicio actualizado para ${APP.drivers[di].name}`);
  } else {
    APP.drivers[di].startLat = APP.startLat;
    APP.drivers[di].startLon = APP.startLon;
    if (val.trim()) alert('Formato de coordenadas inválido. Usá: Lat, Lon');
  }
}

function editDriverName(di) {
  const nameEl = document.getElementById(`driverName${di}`);
  if (!nameEl || nameEl.querySelector('input')) return;
  const current = APP.drivers[di].name;
  nameEl.innerHTML = `<input type="text" class="driver-name-input" value="${current}" id="driverNameInput${di}"
    onblur="saveDriverName(${di})"
    onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){APP.drivers[${di}].name='${current}';renderDriversPanel();}">`;
  const inp = document.getElementById(`driverNameInput${di}`);
  inp.focus(); inp.select();
}

function saveDriverName(di) {
  const inp = document.getElementById(`driverNameInput${di}`);
  if (!inp) return;
  const newName = inp.value.trim();
  if (newName) APP.drivers[di].name = newName;
  renderDriversPanel();
  renderZonesTable();
}

function copyDriverWhatsApp(di) {
  const driver = APP.drivers[di];
  let text = `🚚 *${driver.name}*\n`;
  text += `📊 Zonas: ${driver.zones.join(', ')} · ${driver.totalClients} paradas\n`;
  const totKm = driver.zones.reduce((s,z) => s+(APP.zoneResults[z]?.totalKm||0)+(APP.zoneResults[z]?.returnKm||0),0);
  text += `📏 Distancia total: ${totKm.toFixed(1)} km\n`;
  text += `📅 Fecha: ${new Date().toLocaleDateString('es-PY')}\n\n`;

  let globalOrder = 1;
  driver.zones.forEach(zone => {
    const result = APP.zoneResults[zone];
    if (!result) return;
    text += `\n📍 *Zona: ${zone}*\n`;
    result.ordered.forEach(c => {
      text += `${globalOrder}. *${c.CLIENTE}* — ${c.NOMBRE_CLIENTE}\n`;
      if (c.DESCRIPCION) text += `   📋 ${c.DESCRIPCION}\n`;
      text += `   📏 ${c.LEG_KM} km desde anterior (desde origen: ${c.DIST_DIRECT} km)`;
      if (c.LEG_KM_REAL != null) text += ` · Real: ${c.LEG_KM_REAL}km (${c.LEG_MIN_REAL}min)`;
      text += `\n`;
      globalOrder++;
    });
    text += `   🔙 Retorno: ${result.returnKm.toFixed(2)} km\n`;
  });

  // Copy to clipboard
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(`btnWhatsApp${di}`);
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '✅ ¡Copiado!';
      btn.style.background = 'rgba(16,185,129,0.25)';
      btn.style.borderColor = '#10b981';
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; btn.style.borderColor = ''; }, 2500);
    }
    // Attempt to open WhatsApp
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }).catch(() => {
    alert('No se pudo copiar automáticamente. Se abrirá WhatsApp.');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  });
}

function toggleDriver(di) {
  const body = document.getElementById(`driverBody${di}`);
  const btn = document.getElementById(`toggleBtn${di}`);
  const isOpen = body.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
}

// ============================================================
// DRAG & DROP — REORDER STOPS
// ============================================================
let _dragSrcZone = null, _dragSrcIdx = null;

function initDragDrop() {
  const panel = document.getElementById('driversPanel');
  if (!panel || panel._ddInit) return;
  panel._ddInit = true;

  panel.addEventListener('dragstart', e => {
    const row = e.target.closest('[data-draggable-stop]');
    if (!row) { e.preventDefault(); return; }
    _dragSrcZone = row.dataset.zone;
    _dragSrcIdx = parseInt(row.dataset.idx);
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });

  panel.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const row = e.target.closest('[data-draggable-stop]');
    panel.querySelectorAll('.drag-over-target').forEach(el => el.classList.remove('drag-over-target'));
    if (row) row.classList.add('drag-over-target');
  });

  panel.addEventListener('dragleave', e => {
    if (!panel.contains(e.relatedTarget)) {
      panel.querySelectorAll('.drag-over-target').forEach(el => el.classList.remove('drag-over-target'));
    }
  });

  panel.addEventListener('drop', e => {
    e.preventDefault();
    const row = e.target.closest('[data-draggable-stop]');
    panel.querySelectorAll('.drag-over-target, .dragging').forEach(el => {
      el.classList.remove('drag-over-target', 'dragging');
    });
    if (!row) return;
    const dropZone = row.dataset.zone;
    const dropIdx = parseInt(row.dataset.idx);
    if (_dragSrcZone === dropZone && _dragSrcIdx !== dropIdx) {
      reorderStop(_dragSrcZone, _dragSrcIdx, dropIdx);
    }
    _dragSrcZone = null; _dragSrcIdx = null;
  });

  panel.addEventListener('dragend', e => {
    panel.querySelectorAll('.drag-over-target, .dragging').forEach(el => {
      el.classList.remove('drag-over-target', 'dragging');
    });
    _dragSrcZone = null; _dragSrcIdx = null;
  });
}

function reorderStop(zone, fromIdx, toIdx) {
  const ordered = APP.zoneResults[zone].ordered;
  // Check if OSRM was previously calculated BEFORE we clear it
  const hadOSRM = ordered.some(c => c.LEG_KM_REAL != null);

  const [moved] = ordered.splice(fromIdx, 1);
  ordered.splice(toIdx, 0, moved);
  recalcZoneDistances(zone);
  renderDriversPanel();
  renderZonesTable();
  renderSummaryCards();
  updateMapForZone(zone);

  if (hadOSRM) {
    showToast('⏳ Reordenado — recalculando ruta real en segundo plano...');
    recalcSingleZoneOSRM(zone);
  } else {
    showToast('✓ Parada reordenada — KM recalculados');
  }
}

async function recalcSingleZoneOSRM(zone) {
  const result = APP.zoneResults[zone];
  const points = [[APP.startLat, APP.startLon], ...result.ordered.map(c => [c.LATITUDE, c.LONGITUDE])];
  const legs = [], zoneGeom = [];

  for (let i = 0; i < points.length - 1; i += BLOCK_SIZE) {
    const block = points.slice(i, i + BLOCK_SIZE + 1);
    let blockLegs = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const coordStr = block.map(([la,lo]) => `${lo},${la}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false`;
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        const data = await res.json();
        if (data.routes?.[0] && data.routes[0].legs.length === block.length - 1) {
          blockLegs = data.routes[0].legs;
          const geom = data.routes[0].geometry?.coordinates || [];
          const latLons = geom.map(([lo, la]) => [la, lo]);
          zoneGeom.length === 0 ? zoneGeom.push(...latLons) : zoneGeom.push(...latLons.slice(1));
          break;
        }
      } catch { await sleep(1000); }
    }
    if (blockLegs) legs.push(...blockLegs);
    else for (let j = 0; j < block.length - 1; j++) legs.push(null);
    await sleep(400);
  }

  // Assign OSRM data
  let cumKmReal = 0, cumMinReal = 0;
  result.ordered.forEach((c, i) => {
    const leg = legs[i];
    if (leg) {
      c.LEG_KM_REAL  = rd(leg.distance / 1000, 4);
      c.LEG_MIN_REAL = rd(leg.duration / 60, 2);
      cumKmReal  += c.LEG_KM_REAL;
      cumMinReal += c.LEG_MIN_REAL;
      c.CUM_KM_REAL  = rd(cumKmReal, 4);
      c.CUM_MIN_REAL = rd(cumMinReal, 2);
    }
  });
  result.routeGeometry = zoneGeom.length > 1 ? zoneGeom : null;

  // Add road polyline to map
  if (result.routeGeometry && APP.resultsMap) {
    const color = getColor(zone);
    if (APP.mapLayers.roadRoutes[zone]) APP.resultsMap.removeLayer(APP.mapLayers.roadRoutes[zone]);
    APP.mapLayers.roadRoutes[zone] = L.polyline(result.routeGeometry, { color, weight: 4, opacity: 0.9 });
    if (APP.routeMode === 'real') APP.mapLayers.roadRoutes[zone].addTo(APP.resultsMap);
  }

  // Re-enable road route button
  const btnRR = document.getElementById('btnRouteReal');
  if (btnRR) { btnRR.disabled = false; btnRR.title = 'Ver rutas reales por carretera'; }

  renderDriversPanel();
  renderDashboard(); // Refresh charts
  showToast(`✓ Ruta real actualizada: ${zone}`);
}

function recalcZoneDistances(zone) {
  const result = APP.zoneResults[zone];
  let cumKm = 0, curLat = APP.startLat, curLon = APP.startLon;
  result.ordered.forEach((c, i) => {
    c.ORDER = i + 1;
    const legKm = haversine(curLat, curLon, c.LATITUDE, c.LONGITUDE);
    c.LEG_KM = rd(legKm, 4);
    cumKm += legKm;
    c.CUM_KM = rd(cumKm, 4);
    c.DIST_DIRECT = rd(haversine(APP.startLat, APP.startLon, c.LATITUDE, c.LONGITUDE), 4);
    curLat = c.LATITUDE; curLon = c.LONGITUDE;
    // Invalidate OSRM data (order changed)
    c.LEG_KM_REAL = null; c.LEG_MIN_REAL = null;
    c.CUM_KM_REAL = null; c.CUM_MIN_REAL = null;
  });
  result.totalKm = rd(cumKm, 4);
  result.returnKm = rd(haversine(curLat, curLon, APP.startLat, APP.startLon), 4);
  result.routeGeometry = null; // Invalidate road geometry
  const driver = APP.drivers.find(d => d.zones.includes(zone));
  if (driver) driver.totalKm = driver.zones.reduce((s,z) => s + (APP.zoneResults[z]?.totalKm||0), 0);
  renderDashboard(); // Refresh charts
}

function updateMapForZone(zone) {
  if (!APP.resultsMap) return;
  const result = APP.zoneResults[zone];
  const color = getColor(zone);
  const visible = APP.visibleZones[zone] !== false;

  // Remove old layers
  ['straightLines','straightReturns','roadRoutes'].forEach(type => {
    const layer = APP.mapLayers[type]?.[zone];
    if (layer) APP.resultsMap.removeLayer(layer);
  });
  APP.mapLayers.markers[zone]?.forEach(m => APP.resultsMap.removeLayer(m));
  if (APP.mapLayers.roadRoutes) delete APP.mapLayers.roadRoutes[zone];

  // New straight lines
  const latlngs = [[APP.startLat, APP.startLon], ...result.ordered.map(c => [c.LATITUDE, c.LONGITUDE])];
  APP.mapLayers.straightLines[zone] = L.polyline(latlngs, { color, weight: 2.5, opacity: 0.8 });
  if (visible) APP.mapLayers.straightLines[zone].addTo(APP.resultsMap);

  const last = result.ordered[result.ordered.length - 1];
  if (last) {
    APP.mapLayers.straightReturns[zone] = L.polyline(
      [[last.LATITUDE, last.LONGITUDE], [APP.startLat, APP.startLon]],
      { color, weight: 1.5, opacity: 0.35, dashArray: '6,6' }
    );
    if (visible) APP.mapLayers.straightReturns[zone].addTo(APP.resultsMap);
  }

  // New markers
  APP.mapLayers.markers[zone] = [];
  result.ordered.forEach(c => {
    const marker = L.marker([c.LATITUDE, c.LONGITUDE], { icon: makeNumMarker(c.ORDER, color) })
      .bindPopup(`<div style="font-family:Inter,sans-serif;min-width:180px">
        <div style="font-weight:700;font-size:14px">${c.CLIENTE}</div>
        <div style="font-size:12px;color:#555">${c.NOMBRE_CLIENTE}</div>
        <hr style="margin:6px 0">
        <div style="font-size:12px">📍 Zona: <b>${zone}</b> — #${c.ORDER}</div>
        <div style="font-size:12px">📏 Tramo: <b>${c.LEG_KM} km</b> · Origen: <b>${c.DIST_DIRECT} km</b> · Acum: <b>${c.CUM_KM} km</b></div>
      </div>`);
    if (visible) marker.addTo(APP.resultsMap);
    APP.mapLayers.markers[zone].push(marker);
  });

  // If was in road mode, fall back to straight (geometry invalidated)
  if (APP.routeMode === 'real') {
    APP.routeMode = 'straight';
    document.getElementById('btnRouteStraight')?.classList.add('active');
    document.getElementById('btnRouteReal')?.classList.remove('active');
    document.getElementById('btnRouteReal').disabled = true;
    document.getElementById('btnRouteReal').title = 'Reordenaste paradas — recalculá OSRM';
  }
}

// ============================================================
// SCHEDULING LOGIC
// ============================================================
function calculateSchedules() {
  const avgSpeed = 30; // km/h
  const [startH, startM] = APP.startTime.split(':').map(Number);

  APP.drivers.forEach(driver => {
    let day = 1;
    let nextStartTime = (startH * 60) + startM;
    let accumulatedWorkMinutes = 0;
    let lunchTaken = false;

    driver.zones.forEach(zone => {
      const result = APP.zoneResults[zone];
      if (!result) return;
      
      result.dayPaths = {}; // Storage for map polylines per day
      result.dailyStats = []; // Extra info per day
      
      let prevPoint = [driver.startLat, driver.startLon];
      
      // We start day 1 from depot
      let dayStartKm = 0;

      result.ordered.forEach((client, si) => {
        const currentPoint = [client.LATITUDE, client.LONGITUDE];
        const distKm = haversine(prevPoint[0], prevPoint[1], currentPoint[0], currentPoint[1]);
        const travelMin = (distKm / avgSpeed) * 60;
        
        const returnDist = haversine(currentPoint[0], currentPoint[1], driver.startLat, driver.startLon);
        const returnTime = (returnDist / avgSpeed) * 60;

        // Check if we need a new day
        if (accumulatedWorkMinutes + travelMin + APP.serviceTime + returnTime > APP.workHours * 60) {
          // Finish current day: Add return to base
          const lastPoint = prevPoint; 
          // (In truth, the last point of the PREVIOUS loop was the one that should have returned)
          // But our loop is stop-based. Let's fix the logic:
          
          day++;
          nextStartTime = (startH * 60) + startM;
          accumulatedWorkMinutes = 0;
          lunchTaken = false;
          
          const dFromStart = haversine(driver.startLat, driver.startLon, currentPoint[0], currentPoint[1]);
          const tFromStart = (dFromStart / avgSpeed) * 60;
          
          client.SCHEDULE_DAY = day;
          client.ARRIVAL_MIN = nextStartTime + tFromStart;
          client.IS_DAY_START = true;
          client.DIST_FROM_DEPOT = dFromStart;
        } else {
          client.SCHEDULE_DAY = day;
          client.ARRIVAL_MIN = nextStartTime + travelMin;
          client.IS_DAY_START = (si === 0);
          client.DIST_FROM_DEPOT = (si === 0) ? haversine(driver.startLat, driver.startLon, currentPoint[0], currentPoint[1]) : 0;
        }

        if (!lunchTaken && client.ARRIVAL_MIN > 11 * 60 + 30) { 
           client.ARRIVAL_MIN += APP.lunchMin; 
           lunchTaken = true; 
        }

        client.DEPARTURE_MIN = client.ARRIVAL_MIN + APP.serviceTime;
        client.ARRIVAL_TIME_STR = fmtMinToTime(client.ARRIVAL_MIN);
        client.DEPARTURE_TIME_STR = fmtMinToTime(client.DEPARTURE_MIN);

        nextStartTime = client.DEPARTURE_MIN;
        accumulatedWorkMinutes = nextStartTime - ((startH * 60) + startM);
        prevPoint = currentPoint;
      });

      // After splitting stops, calculate total KM including ALL returns
      let totalKmWithLoops = 0;
      const daysInZone = [...new Set(result.ordered.map(c => c.SCHEDULE_DAY))];
      
      daysInZone.forEach(dNum => {
        const dayStops = result.ordered.filter(c => c.SCHEDULE_DAY === dNum);
        if (dayStops.length === 0) return;
        
        const first = dayStops[0];
        const last = dayStops[dayStops.length - 1];
        
        const d_to_first = haversine(driver.startLat, driver.startLon, first.LATITUDE, first.LONGITUDE);
        let inner_dist = 0;
        for(let i=1; i<dayStops.length; i++) {
          inner_dist += haversine(dayStops[i-1].LATITUDE, dayStops[i-1].LONGITUDE, dayStops[i].LATITUDE, dayStops[i].LONGITUDE);
        }
        const last_to_d = haversine(last.LATITUDE, last.LONGITUDE, driver.startLat, driver.startLon);
        
        totalKmWithLoops += d_to_first + inner_dist + last_to_d;
        
        // Save path for map: [Depot, Stop1, ..., StopN, Depot]
        result.dayPaths[dNum] = [
          [driver.startLat, driver.startLon],
          ...dayStops.map(s => [s.LATITUDE, s.LONGITUDE]),
          [driver.startLat, driver.startLon]
        ];
      });
      
      result.totalKm = rd(totalKmWithLoops, 2);
      result.returnKm = 0; // Integrated into totalKm now
    });
  });
}

function fmtMinToTime(min) {
  const h = Math.floor((min / 60) % 24);
  const m = Math.floor(min % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function showToast(msg) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('toast-visible');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('toast-visible'), 2800);
}

function renderZonesTable() {
  const tbody = document.getElementById('zonesTableBody');
  tbody.innerHTML = Object.entries(APP.zoneResults).map(([zone, result]) => {
    const color = getColor(zone);
    const driver = APP.drivers.find(d => d.zones.includes(zone));
    const driverName = driver ? driver.name : '—';
    const totalWithReturn = result.totalKm + result.returnKm;
    const liters = totalWithReturn * APP.fuelL100 / 100;
    const cost = liters * APP.fuelPrice;
    const savedKm = Math.max(0, result.unoptimizedKm - result.totalKm);
    const hasReal = result.ordered[0]?.LEG_KM_REAL != null;
    const realKmTotal = hasReal ? result.ordered.reduce((s,c) => s+(c.LEG_KM_REAL||0),0) : null;
    const realMinTotal = hasReal ? result.ordered.reduce((s,c) => s+(c.LEG_MIN_REAL||0),0) : null;

    const maxDay = result.ordered.length > 0 ? Math.max(...result.ordered.map(c => c.SCHEDULE_DAY || 1)) : 1;
    const startT = result.ordered[0]?.ARRIVAL_TIME_STR || '--:--';
    const endT = result.ordered[result.ordered.length-1]?.DEPARTURE_TIME_STR || '--:--';

    return `<tr>
      <td><span class="td-zone-badge"><div class="zone-dot-sm" style="background:${color}"></div>${zone}</span></td>
      <td>${driverName}</td>
      <td>${result.ordered.length}</td>
      <td><b>${maxDay} día(s)</b></td>
      <td>${startT} - ${endT}</td>
      <td>${result.totalKm.toFixed(2)} km</td>
      <td>${hasReal ? realKmTotal.toFixed(2)+' km' : '<span style="color:var(--text3)">—</span>'}</td>
      <td>${hasReal ? fmtMin(realMinTotal) : `~${fmtMin(result.totalKm*60/30)}`}</td>
      <td>${liters.toFixed(1)}L · ${fmtGs(cost)}</td>
      <td style="color:var(--green)">${fmtKm(savedKm)}</td>
    </tr>`;
  }).join('');
}

// ============================================================
// OSRM — REAL DISTANCES
// ============================================================
async function calculateOSRM() {
  const modal = document.getElementById('osrmModal');
  const progBar = document.getElementById('osrmProg');
  const statusEl = document.getElementById('osrmStatus');
  const logEl = document.getElementById('osrmLog');
  const closeBtn = document.getElementById('btnCloseModal');
  const etaEl = document.getElementById('osrmEta');
  const pillEl = document.getElementById('osrmPill');
  const pillText = document.getElementById('osrmPillText');
  const pillEta = document.getElementById('osrmPillEta');
  const pillProg = document.getElementById('osrmPillProg');

  modal.style.display = 'flex';
  if (pillEl) pillEl.style.display = 'none';
  logEl.innerHTML = '';
  closeBtn.style.display = 'none';
  if (etaEl) etaEl.textContent = '';

  const zones = Object.keys(APP.zoneResults);
  let doneZones = 0;
  const osrmStart = Date.now();
  const LOG_COLORS = { zone:'#22d3ee', block:'#64748b', ok:'#10b981', warn:'#f59e0b', error:'#ef4444', total:'#a78bfa', info:'#94a3b8' };

  function addLog(msg, type = 'info') {
    const color = LOG_COLORS[type] || LOG_COLORS.info;
    const t = new Date().toLocaleTimeString('es-PY', { hour12: false });
    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = `<span class="log-time">${t}</span><span class="log-msg" style="color:${color}">${msg}</span>`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function updateETA() {
    if (doneZones === 0) return;
    const elapsed = Date.now() - osrmStart;
    const avgMs = elapsed / doneZones;
    const remaining = zones.length - doneZones;
    const etaTxt = remaining > 0 ? `~${fmtMin(avgMs * remaining / 60000)} restante` : 'Finalizando...';
    if (etaEl) etaEl.textContent = etaTxt;
    if (pillEta) pillEta.textContent = etaTxt;
    if (pillText) pillText.textContent = `${doneZones}/${zones.length} zonas`;
    if (pillProg) pillProg.style.width = `${(doneZones / zones.length) * 100}%`;
  }

  for (const zone of zones) {
    const result = APP.zoneResults[zone];
    statusEl.textContent = `Procesando: ${zone} (${doneZones + 1}/${zones.length})`;
    addLog(`▶  Zona: ${zone} — ${result.ordered.length} paradas`, 'zone');

    const points = [[APP.startLat, APP.startLon], ...result.ordered.map(c => [c.LATITUDE, c.LONGITUDE])];
    const legs = [];
    const zoneGeom = [];  // Road geometry coords for this zone

    for (let i = 0; i < points.length - 1; i += BLOCK_SIZE) {
      const block = points.slice(i, i + BLOCK_SIZE + 1);
      const bNum = Math.floor(i / BLOCK_SIZE) + 1;
      addLog(`   Bloque ${bNum} — ${block.length} puntos`, 'block');

      let blockLegs = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const coordStr = block.map(([la,lo]) => `${lo},${la}`).join(';');
          const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false`;
          const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
          const data = await res.json();
          if (data.routes?.[0] && data.routes[0].legs.length === block.length - 1) {
            blockLegs = data.routes[0].legs;
            // Extract road geometry (GeoJSON coords are [lon,lat], Leaflet needs [lat,lon])
            const geom = data.routes[0].geometry?.coordinates || [];
            const latLons = geom.map(([lo, la]) => [la, lo]);
            zoneGeom.length === 0 ? zoneGeom.push(...latLons) : zoneGeom.push(...latLons.slice(1));
            break;
          }
        } catch (err) {
          addLog(`   ⚠️ Intento ${attempt+1}/3 — ${err.message}`, 'warn');
          await sleep(1500);
        }
      }

      if (blockLegs) {
        legs.push(...blockLegs);
        addLog(`   ✅ ${blockLegs.length} tramos procesados correctamente`, 'ok');
      } else {
        addLog(`   ❌ Timeout — tramos sin datos en este bloque`, 'error');
        for (let j = 0; j < block.length - 1; j++) legs.push(null);
      }
      await sleep(800);
    }

    // Assign per-client OSRM data
    let cumKmReal = 0, cumMinReal = 0;
    result.ordered.forEach((client, i) => {
      const leg = legs[i];
      if (leg) {
        client.LEG_KM_REAL = rd(leg.distance / 1000, 4);
        client.LEG_MIN_REAL = rd(leg.duration / 60, 2);
        cumKmReal += client.LEG_KM_REAL;
        cumMinReal += client.LEG_MIN_REAL;
        client.CUM_KM_REAL = rd(cumKmReal, 4);
        client.CUM_MIN_REAL = rd(cumMinReal, 2);
      } else {
        client.LEG_KM_REAL = null; client.LEG_MIN_REAL = null;
        client.CUM_KM_REAL = null; client.CUM_MIN_REAL = null;
      }
    });

    // Store road geometry for this zone
    result.routeGeometry = zoneGeom.length > 1 ? zoneGeom : null;

    // Add road polyline to map if available
    if (result.routeGeometry && APP.resultsMap) {
      const color = getColor(zone);
      const roadLine = L.polyline(result.routeGeometry, { color, weight: 4, opacity: 0.9 });
      APP.mapLayers.roadRoutes[zone] = roadLine;
      if (APP.routeMode === 'real') roadLine.addTo(APP.resultsMap);
    }

    doneZones++;
    progBar.style.width = `${(doneZones / zones.length) * 100}%`;
    addLog(`   📊 Total zona: ${rd(cumKmReal, 2)} km · ${fmtMin(cumMinReal)}`, 'total');
    updateETA();
  }

  statusEl.textContent = '✅ Cálculo completado';
  if (etaEl) etaEl.textContent = '';
  if (pillText) pillText.textContent = '✅ Completado';
  if (pillEta) pillEta.textContent = '';
  if (pillProg) pillProg.style.width = '100%';
  closeBtn.style.display = 'inline-flex';

  // Enable road route button
  const btnRR = document.getElementById('btnRouteReal');
  if (btnRR) { btnRR.disabled = false; btnRR.title = 'Ver rutas reales por carretera'; }

  renderSummaryCards();
  renderDriversPanel();
  renderZonesTable();
  renderDashboard(); // Update charts after OSRM
  buildMapControls(); // Refresh zone filters and road button
}

// ============================================================
// MAP CONTROLS
// ============================================================
function buildMapControls() {
  const toolbar = document.getElementById('mapToolbar');
  if (toolbar) toolbar.style.display = 'flex';

  // Zone filter chips
  const zoneFilters = document.getElementById('zoneFilters');
  if (zoneFilters) {
    zoneFilters.innerHTML = Object.entries(APP.zoneResults).map(([zone]) => {
      const color = getColor(zone);
      const isOn = APP.visibleZones[zone] !== false;
      return `<button class="zone-filter-chip ${isOn ? 'on' : 'off'}" id="zfc_${zone.replace(/\s/g,'_')}" onclick="toggleZoneVisibility('${zone}')">
        <span class="zfc-dot" style="background:${color}"></span>${zone}
      </button>`;
    }).join('');
  }

  // Day filter buttons (Contextual to visible zones)
  const dayFilters = document.getElementById('dayFilters');
  if (dayFilters) {
    let maxDays = 1;
    let anyZoneOn = false;

    // Check only which zones are visible
    Object.entries(APP.zoneResults).forEach(([zone, r]) => {
       if (APP.visibleZones[zone] === false) return; // Explicitly hidden
       anyZoneOn = true;
       const days = Object.keys(r.dayPaths || {}).map(Number);
       if (days.length > 0) maxDays = Math.max(maxDays, ...days);
    });

    if (!anyZoneOn) {
       dayFilters.innerHTML = '<span style="color:var(--text3);font-size:11px">Seleccioná una zona</span>';
    } else {
       let buttons = `<button class="btn-df ${APP.selectedDayFilter === 0 ? 'active' : ''}" onclick="setDayFilter(0)">Todos</button>`;
       for (let i = 1; i <= maxDays; i++) {
          buttons += `<button class="btn-df ${APP.selectedDayFilter === i ? 'active' : ''}" onclick="setDayFilter(${i})">Día ${i}</button>`;
       }
       dayFilters.innerHTML = buttons;
    }
  }

  // Enable road route button if geometry available
  const hasRoad = Object.values(APP.zoneResults).some(r => r.routeGeometry);
  const btnRR = document.getElementById('btnRouteReal');
  if (btnRR) {
    btnRR.disabled = !hasRoad;
    if (!hasRoad) btnRR.title = 'Calculá distancias reales (OSRM) primero';
  }
}

function setRouteMode(mode) {
  if (!APP.resultsMap) return;
  APP.routeMode = mode;

  Object.entries(APP.zoneResults).forEach(([zone, result]) => {
    const isVisible = APP.visibleZones[zone] !== false;
    if (!isVisible) return;

    // Handle Straight Lines (Object of Days)
    const dayLines = APP.mapLayers.straightLines[zone] || {};
    Object.entries(dayLines).forEach(([dayNum, line]) => {
       const isDayMatch = (APP.selectedDayFilter === 0 || parseInt(dayNum) === APP.selectedDayFilter);
       if (mode === 'straight' && isDayMatch) line.addTo(APP.resultsMap);
       else APP.resultsMap.removeLayer(line);
    });

    // Handle Road Routes
    const roadLine = APP.mapLayers.roadRoutes[zone];
    if (roadLine) {
       if (mode === 'real') roadLine.addTo(APP.resultsMap);
       else APP.resultsMap.removeLayer(roadLine);
    }
  });

  document.getElementById('btnRouteStraight')?.classList.toggle('active', mode === 'straight');
  document.getElementById('btnRouteReal')?.classList.toggle('active', mode === 'real');
}

function setMapStyle(style) {
  if (!APP.resultsMap) return;
  
  // Quitar todas las capas actuales
  Object.values(APP.tileLayers).forEach(layer => {
    if (APP.resultsMap.hasLayer(layer)) {
      APP.resultsMap.removeLayer(layer);
    }
  });
  
  // Poner la nueva
  APP.mapStyle = style;
  if (APP.tileLayers[style]) {
    APP.tileLayers[style].addTo(APP.resultsMap);
  }
  
  // Actualizar botones UI
  document.getElementById('btnDarkMap')?.classList.toggle('active', style === 'dark');
  document.getElementById('btnStreetMap')?.classList.toggle('active', style === 'streets');
  document.getElementById('btnSatMap')?.classList.toggle('active', style === 'satellite');
  document.getElementById('btnTerrainMap')?.classList.toggle('active', style === 'terrain');
  document.getElementById('btnLightMap')?.classList.toggle('active', style === 'light');
}

function setConfigMapStyle(style) {
  if (!APP.configMap) return;
  Object.values(APP.configTileLayers).forEach(layer => {
    if (APP.configMap.hasLayer(layer)) APP.configMap.removeLayer(layer);
  });
  if (APP.configTileLayers[style]) APP.configTileLayers[style].addTo(APP.configMap);
}

function toggleZoneVisibility(zone) {
  if (!APP.resultsMap) return;
  
  // Toggle current state (default is true)
  const currentState = (APP.visibleZones[zone] === undefined) ? true : APP.visibleZones[zone];
  const nextState = !currentState;
  APP.visibleZones[zone] = nextState;

  // 1. Update chip UI immediately
  const chipId = `zfc_${zone.replace(/\s/g,'_')}`;
  const chip = document.getElementById(chipId);
  if (chip) {
    chip.classList.toggle('on', nextState);
    chip.classList.toggle('off', !nextState);
  }

  // 2. Toggle markers
  const markers = APP.mapLayers.markers[zone] || [];
  markers.forEach(m => {
    nextState ? m.addTo(APP.resultsMap) : APP.resultsMap.removeLayer(m);
  });

  // 3. Toggle polylines (Respecting Route Mode and Day Filter)
  if (APP.routeMode === 'straight') {
    const dayLines = APP.mapLayers.straightLines[zone] || {};
    Object.entries(dayLines).forEach(([dayNum, line]) => {
      const isDayMatch = (APP.selectedDayFilter === 0 || parseInt(dayNum) === APP.selectedDayFilter);
      if (nextState && isDayMatch) line.addTo(APP.resultsMap);
      else APP.resultsMap.removeLayer(line);
    });
  } else {
    const rr = APP.mapLayers.roadRoutes[zone];
    if (rr) nextState ? rr.addTo(APP.resultsMap) : APP.resultsMap.removeLayer(rr);
  }

  // REFINEMENT: Reset day filter when switching zones and refresh controls
  setDayFilter(0); 
  buildMapControls();
}

/**
 * Updates the current day filter (0 = all days)
 */
function setDayFilter(dayNum) {
  APP.selectedDayFilter = dayNum;
  // This requires a full refresh to properly handle layered markers/lines
  initResultsMap();
  // Also highlight the active button
  document.querySelectorAll('.btn-df').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === dayNum);
  });
}

// ============================================================
// SESSION SAVE / LOAD
// ============================================================
function saveSession() {
  try {
    const session = {
      rawClients: APP.rawClients,
      zones: APP.zones,
      startLat: APP.startLat,
      startLon: APP.startLon,
      numDrivers: APP.numDrivers,
      fuelL100: APP.fuelL100,
      fuelPrice: APP.fuelPrice,
      drivers: APP.drivers,
      zoneResults: APP.zoneResults,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('rutaspro_session', JSON.stringify(session));
    const btn = document.getElementById('btnSaveSession');
    if (btn) { const orig = btn.textContent; btn.textContent = '✅ Guardado!'; setTimeout(() => btn.textContent = orig, 2000); }
  } catch (e) { alert('Error al guardar: ' + e.message); }
}

function loadSession() {
  const saved = localStorage.getItem('rutaspro_session');
  if (!saved) { alert('No hay sesión guardada.'); return; }
  try {
    const s = JSON.parse(saved);
    Object.assign(APP, {
      rawClients: s.rawClients || [],
      zones: s.zones || {},
      startLat: s.startLat,
      startLon: s.startLon,
      numDrivers: s.numDrivers || 2,
      fuelL100: s.fuelL100 || 8,
      fuelPrice: s.fuelPrice || 7500,
      drivers: s.drivers || [],
      zoneResults: s.zoneResults || {},
    });
    document.getElementById('headerPills').style.display = 'flex';
    document.getElementById('pilClientes').textContent = `${APP.rawClients.length} clientes`;
    document.getElementById('pilZonas').textContent = `${Object.keys(APP.zones).length} zonas`;
    document.getElementById('pilRepartidores').textContent = `${APP.drivers.length} repartidores`;
    goToStep(3);
    const date = new Date(s.savedAt).toLocaleString('es-PY');
    setTimeout(() => { showResults(); alert(`✅ Sesión cargada del ${date}`); }, 300);
  } catch (e) { alert('Error al cargar la sesión: ' + e.message); }
}

// ============================================================
// EXPORT EXCEL
// ============================================================
function exportExcel() {
  const wb = XLSX.utils.book_new();
  const date = new Date().toISOString().slice(0,10);

  // Sheet 1: Rutas optimizadas
  const routeRows = [];
  APP.drivers.forEach(driver => {
    driver.zones.forEach(zone => {
      const result = APP.zoneResults[zone];
      if (!result) return;
      
      const days = [...new Set(result.ordered.map(c => c.SCHEDULE_DAY))];
      days.forEach(dayNum => {
        const dayStops = result.ordered.filter(c => c.SCHEDULE_DAY === dayNum);
        if (dayStops.length === 0) return;
        
        // Loop Start
        routeRows.push({
          'REPARTIDOR': driver.name,
          'ZONA': zone,
          'DÍA': dayNum,
          'ORDEN': '—',
          'HORA LLEGADA': APP.startTime,
          'HORA SALIDA': APP.startTime,
          'CLIENTE': 'INICIO DESDE DEPÓSITO',
          'DIRECCIÓN': 'DEPÓSITO',
          'KM TRAMO': '0',
          'ACUMULADO': '0'
        });

        dayStops.forEach(c => {
          routeRows.push({
            'REPARTIDOR': driver.name,
            'ZONA': zone,
            'DÍA': c.SCHEDULE_DAY,
            'ORDEN': c.ORDER,
            'HORA LLEGADA': c.ARRIVAL_TIME_STR,
            'HORA SALIDA': c.DEPARTURE_TIME_STR,
            'CLIENTE': c.CLIENTE,
            'RAZON_SOCIAL': c.RAZON_SOCIAL,
            'DIRECCIÓN': c.DIRECCION || '',
            'DESCRIPCIÓN': c.DESCRIPCION || '',
            'KM TRAMO': c.LEG_KM,
            'DIST. DESDE ORIGEN': c.DIST_DIRECT,
            'ACUMULADO': c.CUM_KM,
            'UBICACION': `${c.LATITUDE}, ${c.LONGITUDE}`
          });
        });

        // Loop End
        const last = dayStops[dayStops.length - 1];
        const returnKm = haversine(last.LATITUDE, last.LONGITUDE, driver.startLat, driver.startLon);
        const returnTime = (returnKm / 30) * 60;
        routeRows.push({
          'REPARTIDOR': driver.name,
          'ZONA': zone,
          'DÍA': dayNum,
          'ORDEN': '—',
          'HORA LLEGADA': fmtMinToTime(last.DEPARTURE_MIN + returnTime),
          'HORA SALIDA': '—',
          'CLIENTE': 'REGRESO A DEPÓSITO',
          'DIRECCIÓN': 'DEPÓSITO',
          'KM TRAMO': returnKm.toFixed(2),
          'ACUMULADO': (parseFloat(last.CUM_KM) + returnKm).toFixed(2)
        });
      });
    });
  });
  const ws1 = XLSX.utils.json_to_sheet(routeRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Rutas Optimizadas');

  // Sheet 2: Resumen por zona
  const zoneRows = Object.entries(APP.zoneResults).map(([zone, r]) => {
    const driver = APP.drivers.find(d => d.zones.includes(zone));
    const hasReal = r.ordered[0]?.LEG_KM_REAL != null;
    const realKm = hasReal ? rd(r.ordered.reduce((s,c)=>s+(c.LEG_KM_REAL||0),0),2) : '';
    const realMin = hasReal ? rd(r.ordered.reduce((s,c)=>s+(c.LEG_MIN_REAL||0),0),2) : '';
    const liters = (r.totalKm + r.returnKm) * APP.fuelL100 / 100;
    return {
      'ZONA': zone,
      'REPARTIDOR': driver?.name ?? '—',
      'PARADAS': r.ordered.length,
      'KM_HAVERSINE': r.totalKm,
      'RETORNO_KM': r.returnKm,
      'TOTAL_KM_CON_RETORNO': rd(r.totalKm + r.returnKm, 4),
      'KM_SIN_OPTIMIZAR': r.unoptimizedKm,
      'KM_AHORRADO': rd(Math.max(0, r.unoptimizedKm - r.totalKm), 4),
      'KM_REAL': realKm,
      'MIN_REAL': realMin,
      'LITROS_EST': rd(liters, 2),
      'COSTO_EST_GS': Math.round(liters * APP.fuelPrice),
    };
  });
  const ws2 = XLSX.utils.json_to_sheet(zoneRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por Zona');

  // Sheet 3: Repartidores
  const driverRows = APP.drivers.map(d => {
    const totKm = d.zones.reduce((s,z) => s+(APP.zoneResults[z]?.totalKm||0)+(APP.zoneResults[z]?.returnKm||0),0);
    return {
      'REPARTIDOR': d.name,
      'ZONAS': d.zones.join(', '),
      'TOTAL_CLIENTES': d.totalClients,
      'TOTAL_KM': rd(totKm,2),
      'LITROS_EST': rd(totKm * APP.fuelL100 / 100, 2),
      'COSTO_EST_GS': Math.round(totKm * APP.fuelL100 / 100 * APP.fuelPrice),
    };
  });
  const ws3 = XLSX.utils.json_to_sheet(driverRows);
  XLSX.utils.book_append_sheet(wb, ws3, 'Repartidores');

  // Native SheetJS writer for better stability
  try {
    XLSX.writeFile(wb, `rutas_optimizadas_${date}.xlsx`);
    showToast('✓ Excel exportado correctamente');
  } catch (e) {
    alert('Error al exportar Excel: ' + e.message);
  }
}

// ============================================================
// EXPORT PDF
// ============================================================
async function exportPDF() {
  if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
    alert('Librerías (jsPDF/html2canvas) no cargadas. Verificá tu conexión.');
    return;
  }
  
  showToast('🕒 Preparando reporte y capturando mapa...');
  
  // 1. Capture Map
  let mapImg = null;
  const mapEl = document.getElementById('resultsMap');
  if (mapEl) {
    try {
      const canvas = await html2canvas(mapEl, { useCORS: true, logging: false });
      mapImg = canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) { console.warn('Error capturing map:', e); }
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const date = new Date().toLocaleDateString('es-PY');

  APP.drivers.forEach((driver, di) => {
    if (di > 0) doc.addPage();

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text(`Reporte: ${driver.name}`, 15, 20);

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(10);
    doc.text(`Fecha: ${date} · Planificación Profesional por Días`, 15, 26);

    // Summary block
    const totKm = driver.zones.reduce((s,z) => s+(APP.zoneResults[z]?.totalKm||0)+(APP.zoneResults[z]?.returnKm||0),0);
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text([
      `Distancia Total: ${totKm.toFixed(1)} km`,
      `Zonas: ${driver.zones.join(', ')}`,
      `Carga: ${driver.totalClients} paradas`
    ], 15, 40);

    // Mini Map if captured
    let currentY = 55;
    if (mapImg) {
      const mh = 60; // height in mm
      const mw = 180; // width in mm
      doc.addImage(mapImg, 'JPEG', 15, currentY, mw, mh);
      doc.setDrawColor(200);
      doc.rect(15, currentY, mw, mh, 'S');
      currentY += mh + 10;
    }

    // Days & Tables
    driver.zones.forEach(zone => {
      const result = APP.zoneResults[zone];
      if (!result) return;

      // Group by day for this driver/zone
      const days = [...new Set(result.ordered.map(c => c.SCHEDULE_DAY))].sort((a,b) => a-b);

      days.forEach(dayNum => {
        const dayStops = result.ordered.filter(c => c.SCHEDULE_DAY === dayNum);
        
        doc.setFontSize(14);
        doc.setTextColor(99, 102, 241);
        doc.text(`Día ${dayNum} — Zona: ${zone}`, 15, currentY);
        currentY += 4;

        // Add virtual "Start from Depot" row
        const tableRows = [
           ['—', APP.startTime, 'DEP', 'INICIO DESDE DEPÓSITO', '', '0 km']
        ];
        
        dayStops.forEach(c => {
           tableRows.push([c.ORDER, c.ARRIVAL_TIME_STR, c.CLIENTE, c.RAZON_SOCIAL, c.DESCRIPCION || '', `${c.LEG_KM} km`]);
        });

        // Add virtual "Return to Base" row
        const last = dayStops[dayStops.length - 1];
        const returnKm = haversine(last.LATITUDE, last.LONGITUDE, driver.startLat, driver.startLon);
        const returnTime = (returnKm / 30) * 60;
        tableRows.push(['—', fmtMinToTime(last.DEPARTURE_MIN + returnTime), 'RTN', 'REGRESO A DEPÓSITO', '', `${returnKm.toFixed(1)} km`]);

        doc.autoTable({
          startY: currentY,
          head: [['#', 'Llegada', 'Cod', 'Cliente', 'Descripción', 'Dist.']],
          body: tableRows,
          margin: { left: 15 },
          theme: 'striped',
          headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
          styles: { fontSize: 8, cellPadding: 2 },
          didDrawPage: (data) => {
            currentY = data.cursor.y + 10;
          }
        });
        currentY = doc.previousAutoTable.finalY + 12;

        // Page break if near bottom
        if (currentY > 260 && di < APP.drivers.length - 1) {
           doc.addPage();
           currentY = 20;
        }
      });
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`RutasPro Professional — Generado automáticamente`, 105, 290, { align: 'center' });
  });

  doc.save(`rutas_pro_pro_${new Date().toISOString().slice(0,10)}.pdf`);
  showToast('✓ PDF generado con éxito');
}

// ============================================================
// PRINT
// ============================================================
function printRoutes() {
  const content = document.getElementById('printContent');
  content.innerHTML = APP.drivers.map((driver, di) => {
    const totKm = driver.zones.reduce((s,z) => s+(APP.zoneResults[z]?.totalKm||0)+(APP.zoneResults[z]?.returnKm||0),0);
    const allStops = driver.zones.flatMap(zone => {
      const r = APP.zoneResults[zone];
      return r ? r.ordered.map(c => ({ ...c, zone })) : [];
    });
    return `<div class="print-page">
      <div class="print-header">
        <div class="print-title">🚚 ${driver.name}</div>
        <div class="print-sub">${driver.zones.join(', ')} · ${driver.totalClients} clientes · ${totKm.toFixed(1)} km totales</div>
        <div class="print-sub">Fecha: ${new Date().toLocaleDateString('es-PY')} — RutasPro</div>
      </div>
      ${allStops.map(c => `
        <div class="print-stop">
          <div class="print-num">${c.ORDER}</div>
          <div class="print-info">
            <div class="name">${c.CLIENTE} — ${c.NOMBRE_CLIENTE}</div>
            <div class="desc">${c.DESCRIPCION} · Zona: ${c.zone}</div>
            <div class="km">Distancia tramo: ${c.LEG_KM} km · Acumulado: ${c.CUM_KM} km${c.LEG_KM_REAL!=null?` · Real: ${c.LEG_KM_REAL}km (${c.LEG_MIN_REAL}min)`:''}</div>
          </div>
        </div>`).join('')}
      <div class="print-summary">
        <strong>Resumen:</strong> ${driver.totalClients} paradas · ${totKm.toFixed(1)} km totales (c/retorno)
      </div>
    </div>`;
  }).join('');

  document.getElementById('printView').style.display = 'block';
  window.print();
  setTimeout(() => { document.getElementById('printView').style.display = 'none'; }, 500);
}

// ============================================================
// DASHBOARD KPI
// ============================================================
function renderDashboard() {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded yet. Retrying in 500ms...');
    setTimeout(renderDashboard, 500);
    return;
  }
  const tabDash = document.getElementById('tabDash');
  if (!tabDash || !tabDash.classList.contains('active')) return;

  // 1. Stops by Zone (Doughnut)
  const zoneLabels = Object.keys(APP.zoneResults);
  const zoneData = zoneLabels.map(z => APP.zoneResults[z].ordered.length);
  const zoneColors = zoneLabels.map(z => getColor(z));

  if (APP.charts.zones) APP.charts.zones.destroy();
  const ctxZones = document.getElementById('chartZones').getContext('2d');
  APP.charts.zones = new Chart(ctxZones, {
    type: 'doughnut',
    data: {
      labels: zoneLabels,
      datasets: [{
        data: zoneData,
        backgroundColor: zoneColors,
        borderWidth: 0,
        hoverOffset: 20
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 15 } },
        tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', titleFont: { size: 14 }, bodyFont: { size: 13 }, padding: 12 }
      }
    }
  });

  // 2. Distance by Driver (Bar)
  const driverLabels = APP.drivers.map(d => d.name);
  const driverData = APP.drivers.map(d => {
    return d.zones.reduce((s,z) => s + (APP.zoneResults[z]?.totalKm||0) + (APP.zoneResults[z]?.returnKm||0), 0);
  });
  const driverColors = APP.drivers.map((_, i) => ZONE_COLORS[i % ZONE_COLORS.length]);

  if (APP.charts.drivers) APP.charts.drivers.destroy();
  const ctxDrivers = document.getElementById('chartDrivers').getContext('2d');
  APP.charts.drivers = new Chart(ctxDrivers, {
    type: 'bar',
    data: {
      labels: driverLabels,
      datasets: [{
        label: 'Kilómetros',
        data: driverData,
        backgroundColor: driverColors,
        borderRadius: 6,
        barThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)' }
      }
    }
  });

  // 3. Efficiency Analysis (Horizontal Bar)
  const totKm = Object.values(APP.zoneResults).reduce((s, r) => s + r.totalKm + r.returnKm, 0);
  const estNonOpt = totKm * 1.6; // Logic: usually non-optimized is ~60% longer due to backtracking

  if (APP.charts.efficiency) APP.charts.efficiency.destroy();
  const ctxEff = document.getElementById('chartEfficiency').getContext('2d');
  APP.charts.efficiency = new Chart(ctxEff, {
    type: 'bar',
    data: {
      labels: ['Ruta Optimizada (RutasPro)', 'Ruta Sin Optimización (Est.)'],
      datasets: [{
        label: 'Kilómetros totales',
        data: [totKm, estNonOpt],
        backgroundColor: ['#10b981', '#334155'],
        borderRadius: 8,
        barThickness: 50
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 12, weight: 'bold' } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { 
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          callbacks: {
            afterLabel: (ctx) => {
              if (ctx.dataIndex === 0) {
                const perc = rd(((estNonOpt - totKm) / estNonOpt) * 100, 1);
                return `✨ Ahorro del ${perc}%`;
              }
            }
          }
        }
      }
    }
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initUpload();

  // Counter buttons
  document.getElementById('btnDriverMinus').addEventListener('click', () => {
    if (APP.numDrivers > 1) { APP.numDrivers--; document.getElementById('driverCountVal').textContent = APP.numDrivers; updateDriverAssignment(); }
  });
  document.getElementById('btnDriverPlus').addEventListener('click', () => {
    const max = 50; // Up to 50 drivers, independent of zone count
    if (APP.numDrivers < max) { APP.numDrivers++; document.getElementById('driverCountVal').textContent = APP.numDrivers; updateDriverAssignment(); }
  });

  // Fuel inputs
  document.getElementById('inputFuel').addEventListener('change', e => { APP.fuelL100 = parseFloat(e.target.value) || 8; });
  document.getElementById('inputFuelPrice').addEventListener('change', e => { APP.fuelPrice = parseFloat(e.target.value) || 7500; });

  // Navigation
  document.getElementById('btnBackToStep1').addEventListener('click', () => goToStep(1));

  document.getElementById('btnCalculate').addEventListener('click', () => {
    APP.startLat = parseFloat(document.getElementById('inputLat').value) || APP.startLat;
    APP.startLon = parseFloat(document.getElementById('inputLon').value) || APP.startLon;
    APP.fuelL100 = parseFloat(document.getElementById('inputFuel').value) || 8;
    APP.fuelPrice = parseFloat(document.getElementById('inputFuelPrice').value) || 7500;
    
    // Scheduling inputs
    APP.startTime = document.getElementById('inputStartTime').value || '06:00';
    APP.workHours = parseFloat(document.getElementById('inputWorkHours').value) || 8.5;
    APP.lunchMin = parseFloat(document.getElementById('inputLunchMin').value) || 60;
    APP.serviceTime = parseFloat(document.getElementById('inputServiceTime').value) || 20;

    autoAssignDrivers();
    optimizeAllZones();
    // After optimization, we can calculate the detailed schedule
    calculateSchedules();
    goToStep(3);
    setTimeout(showResults, 300);
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(tab.dataset.tab);
      if (panel) panel.classList.add('active');
      if (tab.dataset.tab === 'tabMap') setTimeout(() => APP.resultsMap?.invalidateSize(), 50);
      if (tab.dataset.tab === 'tabDash') renderDashboard();
    });
  });

  document.getElementById('btnExport').addEventListener('click', exportExcel);
  document.getElementById('btnPDF').addEventListener('click', exportPDF);
  document.getElementById('btnOSRM').addEventListener('click', calculateOSRM);
  document.getElementById('btnPrint').addEventListener('click', printRoutes);
  document.getElementById('btnRestart').addEventListener('click', () => location.reload());
  document.getElementById('btnSaveSession').addEventListener('click', saveSession);
  document.getElementById('btnLoadSession').addEventListener('click', loadSession);
  document.getElementById('btnCloseModal').addEventListener('click', () => {
    document.getElementById('osrmModal').style.display = 'none';
  });
  document.getElementById('btnMinimizeModal').addEventListener('click', () => {
    document.getElementById('osrmModal').style.display = 'none';
    document.getElementById('osrmPill').style.display = 'flex';
  });
  document.getElementById('btnExpandModal').addEventListener('click', () => {
    document.getElementById('osrmPill').style.display = 'none';
    document.getElementById('osrmModal').style.display = 'flex';
  });
});
