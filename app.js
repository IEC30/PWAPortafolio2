/* =========================================================
   PWA Unidad 2 — app.js
   Laboratorio de Prácticas:
   - Ejercicio 1: Permissions API & Geolocation con Leaflet
   - Ejercicio 2: MediaDevices API (getUserMedia), Video & Canvas
   - Ejercicio 3: Notificaciones locales con Service Worker
   - Ejercicio 4: Persistencia con IndexedDB (Nativo)
   - Ejercicio 5: Caché Network-First con Fallback a IndexedDB
   ========================================================= */

// Selectores
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* =========================================================
   Navegación por Pestañas (Vistas)
   ========================================================= */
const tabButtons = $$('.tab-btn');
const viewSections = $$('.view-section');

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetViewId = btn.getAttribute('data-view');

    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    viewSections.forEach((sec) => {
      sec.classList.toggle('active', sec.id === targetViewId);
    });

    // Ajuste de mapa si se activa Ejercicio 1
    if (targetViewId === 'view-ejercicio1' && geoMap) {
      setTimeout(() => geoMap.invalidateSize(), 150);
    }
  });
});

/* =========================================================
   Estado de Conectividad & Service Worker
   ========================================================= */
const globalNetBadge = $('#global-net-badge');
function updateNetworkStatus() {
  if (!globalNetBadge) return;
  if (navigator.onLine) {
    globalNetBadge.className = 'badge badge-green';
    globalNetBadge.textContent = 'Online';
  } else {
    globalNetBadge.className = 'badge badge-red';
    globalNetBadge.textContent = 'Offline';
  }
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
    } catch (err) {
      console.error('Error al registrar SW:', err);
    }
  });
}

// Banner de instalación
let deferredPrompt = null;
const installBanner = $('#install-banner');
const btnInstall = $('#btn-install');
const btnDismiss = $('#btn-dismiss-install');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBanner) installBanner.classList.remove('hidden');
});

if (btnInstall) {
  btnInstall.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBanner.classList.add('hidden');
    }
  });
}

if (btnDismiss) {
  btnDismiss.addEventListener('click', () => {
    installBanner.classList.add('hidden');
  });
}

/* =========================================================
   EJERCICIO 1: PERMISOS Y GEOLOCALIZACIÓN
   ========================================================= */
const geoEls = {
  badge: $('#perm-badge'),
  btnLocate: $('#btn-locate'),
  btnCopy: $('#btn-copy-geo'),
  btnClear: $('#btn-clear-geo'),
  result: $('#geo-result'),
  lat: $('#out-lat'),
  lon: $('#out-lon'),
  acc: $('#out-acc'),
  time: $('#out-time'),
  maps: $('#link-maps'),
  osm: $('#link-osm'),
  mapDiv: $('#map'),
  error: $('#geo-error')
};

let geoMap = null;
let geoMarker = null;
let geoCircle = null;

const PERM_LABELS = {
  granted: 'Concedido',
  denied: 'Denegado',
  prompt: 'Pendiente',
  unknown: 'No disponible'
};

async function queryGeoPermission() {
  if (!('permissions' in navigator) || !navigator.permissions?.query) {
    renderGeoPermission('unknown');
    return 'unknown';
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    renderGeoPermission(status.state);
    status.onchange = () => renderGeoPermission(status.state);
    return status.state;
  } catch {
    renderGeoPermission('unknown');
    return 'unknown';
  }
}

function renderGeoPermission(state) {
  if (!geoEls.badge) return;
  geoEls.badge.dataset.state = state;
  geoEls.badge.textContent = PERM_LABELS[state] || PERM_LABELS.unknown;
}

function getPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}

function renderGeoPosition(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  geoEls.lat.textContent = `${latitude.toFixed(6)}°`;
  geoEls.lon.textContent = `${longitude.toFixed(6)}°`;
  geoEls.acc.textContent = `± ${accuracy.toFixed(1)} m`;
  geoEls.time.textContent = new Date(pos.timestamp).toLocaleTimeString();

  geoEls.maps.href = `https://www.google.com/maps?q=${latitude},${longitude}`;
  geoEls.osm.href = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;

  geoEls.result.classList.remove('hidden');
  geoEls.btnCopy.disabled = false;

  renderGeoMap(latitude, longitude, accuracy);
}

function renderGeoMap(lat, lon, accuracy) {
  if (typeof L === 'undefined') return;

  geoEls.mapDiv.classList.add('visible');

  if (!geoMap) {
    geoMap = L.map(geoEls.mapDiv, { scrollWheelZoom: false }).setView([lat, lon], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(geoMap);

    geoMarker = L.marker([lat, lon]).addTo(geoMap);
    geoCircle = L.circle([lat, lon], {
      radius: accuracy,
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.15,
      weight: 1.5
    }).addTo(geoMap);
  } else {
    geoMap.setView([lat, lon], 16);
    geoMarker.setLatLng([lat, lon]);
    geoCircle.setLatLng([lat, lon]).setRadius(accuracy);
  }

  setTimeout(() => geoMap.invalidateSize(), 150);
}

if (geoEls.btnLocate) {
  geoEls.btnLocate.addEventListener('click', async () => {
    geoEls.error.classList.add('hidden');
    geoEls.btnLocate.disabled = true;
    geoEls.btnLocate.innerHTML = '<span class="spinner"></span> Obteniendo...';

    try {
      const pos = await getPosition();
      renderGeoPosition(pos);
      await queryGeoPermission();
    } catch (err) {
      let msg = 'Error al obtener ubicación.';
      if (err.code === 1) msg = 'Permiso de ubicación denegado.';
      else if (err.code === 2) msg = 'Posición GPS no disponible.';
      else if (err.code === 3) msg = 'Tiempo de espera agotado.';
      geoEls.error.textContent = msg;
      geoEls.error.classList.remove('hidden');
    } finally {
      geoEls.btnLocate.disabled = false;
      geoEls.btnLocate.textContent = 'Obtener ubicación';
    }
  });
}

if (geoEls.btnCopy) {
  geoEls.btnCopy.addEventListener('click', async () => {
    const text = `${geoEls.lat.textContent}, ${geoEls.lon.textContent}`;
    try {
      await navigator.clipboard.writeText(text);
      const prev = geoEls.btnCopy.textContent;
      geoEls.btnCopy.textContent = '¡Copiado!';
      setTimeout(() => (geoEls.btnCopy.textContent = prev), 1500);
    } catch {
      alert(`Coordenadas: ${text}`);
    }
  });
}

if (geoEls.btnClear) {
  geoEls.btnClear.addEventListener('click', () => {
    geoEls.result.classList.add('hidden');
    geoEls.error.classList.add('hidden');
    geoEls.btnCopy.disabled = true;
    geoEls.mapDiv.classList.remove('visible');
  });
}

queryGeoPermission();

/* =========================================================
   EJERCICIO 2: CÁMARA Y CANVAS
   ========================================================= */
const camEls = {
  video: $('#camera-stream'),
  canvas: $('#photo-canvas'),
  btnStart: $('#btn-start-camera'),
  btnTake: $('#btn-take-photo'),
  btnSwitch: $('#btn-switch-camera'),
  btnDownload: $('#btn-download-photo'),
  btnStop: $('#btn-stop-camera'),
  badge: $('#camera-badge'),
  infoRes: $('#camera-info-res'),
  error: $('#camera-error'),
  placeholderVid: $('#camera-placeholder'),
  placeholderCanvas: $('#canvas-placeholder')
};

let currentStream = null;
let currentFacingMode = 'user';

async function startCamera() {
  camEls.error.classList.add('hidden');
  camEls.btnStart.disabled = true;

  try {
    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
    }

    const constraints = {
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    camEls.video.srcObject = currentStream;
    await camEls.video.play();

    camEls.placeholderVid.style.display = 'none';
    camEls.badge.className = 'badge badge-green';
    camEls.badge.textContent = currentFacingMode === 'user' ? 'Activa (Frontal)' : 'Activa (Trasera)';

    const track = currentStream.getVideoTracks()[0];
    const s = track?.getSettings ? track.getSettings() : {};
    camEls.infoRes.textContent = s.width && s.height ? `${s.width}x${s.height} px` : '';

    camEls.btnStart.disabled = true;
    camEls.btnTake.disabled = false;
    camEls.btnSwitch.disabled = false;
    camEls.btnStop.disabled = false;
  } catch (err) {
    camEls.error.textContent = `No se pudo acceder a la cámara (${err.message || 'Error'}).`;
    camEls.error.classList.remove('hidden');
    camEls.btnStart.disabled = false;
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
  camEls.video.srcObject = null;
  camEls.placeholderVid.style.display = 'block';
  camEls.badge.className = 'badge badge-yellow';
  camEls.badge.textContent = 'Apagada';
  camEls.infoRes.textContent = '';

  camEls.btnStart.disabled = false;
  camEls.btnTake.disabled = true;
  camEls.btnSwitch.disabled = true;
  camEls.btnStop.disabled = true;
}

function takeSnapshot() {
  if (!currentStream || !camEls.video.videoWidth) return;

  const w = camEls.video.videoWidth;
  const h = camEls.video.videoHeight;
  camEls.canvas.width = w;
  camEls.canvas.height = h;

  const ctx = camEls.canvas.getContext('2d');
  ctx.drawImage(camEls.video, 0, 0, w, h);

  camEls.canvas.classList.remove('flash-effect');
  void camEls.canvas.offsetWidth;
  camEls.canvas.classList.add('flash-effect');

  camEls.placeholderCanvas.style.display = 'none';
  camEls.btnDownload.disabled = false;
}

function downloadSnapshot() {
  if (!camEls.canvas.width) return;
  const link = document.createElement('a');
  link.download = `foto-${Date.now()}.png`;
  link.href = camEls.canvas.toDataURL('image/png');
  link.click();
}

function switchCamera() {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  startCamera();
}

if (camEls.btnStart) camEls.btnStart.addEventListener('click', startCamera);
if (camEls.btnStop) camEls.btnStop.addEventListener('click', stopCamera);
if (camEls.btnTake) camEls.btnTake.addEventListener('click', takeSnapshot);
if (camEls.btnDownload) camEls.btnDownload.addEventListener('click', downloadSnapshot);
if (camEls.btnSwitch) camEls.btnSwitch.addEventListener('click', switchCamera);

/* =========================================================
   EJERCICIO 3: NOTIFICACIONES PUSH LOCALES
   ========================================================= */
const notEls = {
  badge: $('#notify-perm-badge'),
  titleInput: $('#notify-title'),
  bodyInput: $('#notify-body'),
  iconSelect: $('#notify-icon-select'),
  vibrateCheck: $('#notify-vibrate'),
  btnReq: $('#btn-req-notify'),
  btnSend: $('#btn-send-notify'),
  btnDelay: $('#btn-delay-notify'),
  btnReset: $('#btn-reset-notify'),
  error: $('#notify-error'),
  success: $('#notify-success')
};

function updateNotificationBadge() {
  if (!('Notification' in window)) {
    notEls.badge.className = 'badge badge-red';
    notEls.badge.textContent = 'No soportado';
    return;
  }
  const perm = Notification.permission;
  notEls.badge.dataset.state = perm;
  if (perm === 'granted') {
    notEls.badge.textContent = 'Concedido';
    notEls.badge.className = 'badge badge-green';
  } else if (perm === 'denied') {
    notEls.badge.textContent = 'Denegado';
    notEls.badge.className = 'badge badge-red';
  } else {
    notEls.badge.textContent = 'Pendiente';
    notEls.badge.className = 'badge badge-yellow';
  }
}

async function requestNotificationPermission() {
  notEls.error.classList.add('hidden');
  notEls.success.classList.add('hidden');

  if (!('Notification' in window)) {
    notEls.error.textContent = 'API de Notificaciones no soportada.';
    notEls.error.classList.remove('hidden');
    return false;
  }

  const result = await Notification.requestPermission();
  updateNotificationBadge();

  if (result === 'granted') {
    notEls.success.textContent = 'Permiso de notificación concedido.';
    notEls.success.classList.remove('hidden');
    return true;
  } else {
    notEls.error.textContent = 'El permiso fue denegado.';
    notEls.error.classList.remove('hidden');
    return false;
  }
}

async function triggerSWNotification(delaySeconds = 0) {
  notEls.error.classList.add('hidden');
  notEls.success.classList.add('hidden');

  if (!('Notification' in window)) {
    notEls.error.textContent = 'Notificaciones no soportadas.';
    notEls.error.classList.remove('hidden');
    return;
  }

  if (Notification.permission !== 'granted') {
    const granted = await requestNotificationPermission();
    if (!granted) return;
  }

  const title = notEls.titleInput.value.trim() || 'Aviso PWA';
  const body = notEls.bodyInput.value.trim() || 'Notificación local disparada con SW.';
  const icon = notEls.iconSelect.value;
  const vibrate = notEls.vibrateCheck.checked ? [200, 100, 200] : [];

  const options = {
    body,
    icon,
    badge: 'icons/persona5.png',
    vibrate,
    tag: `notify-${Date.now()}`
  };

  if (delaySeconds > 0) {
    notEls.success.textContent = `Notificación programada en ${delaySeconds} segundos...`;
    notEls.success.classList.remove('hidden');
    setTimeout(async () => {
      await executeShowNotification(title, options);
    }, delaySeconds * 1000);
  } else {
    await executeShowNotification(title, options);
  }
}

async function executeShowNotification(title, options) {
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, options);
    notEls.success.textContent = 'Notificación enviada correctamente desde el Service Worker.';
    notEls.success.classList.remove('hidden');
  } catch (err) {
    notEls.error.textContent = `Error al enviar notificación: ${err.message}`;
    notEls.error.classList.remove('hidden');
  }
}

if (notEls.btnReq) notEls.btnReq.addEventListener('click', requestNotificationPermission);
if (notEls.btnSend) notEls.btnSend.addEventListener('click', () => triggerSWNotification(0));
if (notEls.btnDelay) notEls.btnDelay.addEventListener('click', () => triggerSWNotification(3));
if (notEls.btnReset) {
  notEls.btnReset.addEventListener('click', () => {
    notEls.titleInput.value = 'Aviso PWA';
    notEls.bodyInput.value = 'Notificación local desde el Service Worker.';
    notEls.iconSelect.value = 'icons/persona5.png';
    notEls.vibrateCheck.checked = true;
    notEls.error.classList.add('hidden');
    notEls.success.classList.add('hidden');
  });
}

updateNotificationBadge();

/* =========================================================
   EJERCICIO 4: INDEXEDDB NATIVO
   ========================================================= */
const DB_NAME = 'PWA_Alumnos_DB';
const DB_VERSION = 1;
const STORE_ALUMNOS = 'alumnos';
const STORE_CACHE = 'api_cache';

const idbEls = {
  form: $('#idb-form'),
  nombre: $('#idb-nombre'),
  matricula: $('#idb-matricula'),
  carrera: $('#idb-carrera'),
  observaciones: $('#idb-observaciones'),
  btnRefresh: $('#btn-idb-refresh'),
  btnSample: $('#btn-idb-sample'),
  btnClearAll: $('#btn-idb-clear-all'),
  tbody: $('#idb-tbody'),
  counterBadge: $('#idb-counter-badge'),
  alert: $('#idb-alert')
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_ALUMNOS)) {
        db.createObjectStore(STORE_ALUMNOS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function insertAlumno(alumno) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ALUMNOS], 'readwrite');
    const store = tx.objectStore(STORE_ALUMNOS);
    const req = store.add(alumno);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllAlumnos() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ALUMNOS], 'readonly');
    const store = tx.objectStore(STORE_ALUMNOS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteAlumnoById(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ALUMNOS], 'readwrite');
    const store = tx.objectStore(STORE_ALUMNOS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearAllAlumnos() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ALUMNOS], 'readwrite');
    const store = tx.objectStore(STORE_ALUMNOS);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function showIdbAlert(msg, type = 'info') {
  if (!idbEls.alert) return;
  idbEls.alert.className = `alert alert-${type}`;
  idbEls.alert.textContent = msg;
  idbEls.alert.classList.remove('hidden');
  setTimeout(() => idbEls.alert.classList.add('hidden'), 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function renderAlumnosTable() {
  try {
    const alumnos = await getAllAlumnos();
    if (idbEls.counterBadge) {
      idbEls.counterBadge.textContent = `${alumnos.length} registro${alumnos.length === 1 ? '' : 's'}`;
    }

    if (!alumnos.length) {
      idbEls.tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No hay registros guardados.
          </td>
        </tr>
      `;
      return;
    }

    idbEls.tbody.innerHTML = alumnos
      .map((a) => {
        const fechaStr = a.fecha ? new Date(a.fecha).toLocaleDateString() : '—';
        return `
          <tr>
            <td><strong>#${a.id}</strong></td>
            <td>${escapeHtml(a.nombre)}</td>
            <td><code>${escapeHtml(a.matricula)}</code></td>
            <td>${escapeHtml(a.carrera)}</td>
            <td>${escapeHtml(a.observaciones || '—')}</td>
            <td><small style="color:var(--text-muted);">${fechaStr}</small></td>
            <td style="text-align: center;">
              <button class="btn btn-red btn-del" data-id="${a.id}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">
                Eliminar
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    $$('.btn-del').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = Number(b.getAttribute('data-id'));
        await deleteAlumnoById(id);
        showIdbAlert(`Registro #${id} eliminado.`, 'danger');
        renderAlumnosTable();
      });
    });
  } catch (err) {
    showIdbAlert(`Error al leer IndexedDB: ${err.message}`, 'danger');
  }
}

if (idbEls.form) {
  idbEls.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = idbEls.nombre.value.trim();
    const matricula = idbEls.matricula.value.trim();
    const carrera = idbEls.carrera.value.trim();
    const observaciones = idbEls.observaciones.value.trim();

    if (!nombre || !matricula || !carrera) return;

    await insertAlumno({ nombre, matricula, carrera, observaciones, fecha: Date.now() });
    showIdbAlert('Registro guardado.', 'success');
    idbEls.form.reset();
    renderAlumnosTable();
  });
}

if (idbEls.btnRefresh) {
  idbEls.btnRefresh.addEventListener('click', () => {
    renderAlumnosTable();
    showIdbAlert('Lista actualizada.', 'info');
  });
}

if (idbEls.btnSample) {
  idbEls.btnSample.addEventListener('click', async () => {
    const demo = [
      { nombre: 'Sofía Valenzuela', matricula: '2026-PWA-101', carrera: 'Ing. en Software', observaciones: 'Service Workers', fecha: Date.now() },
      { nombre: 'Fernando Ruiz', matricula: '2026-PWA-102', carrera: 'Desarrollo Web', observaciones: 'IndexedDB', fecha: Date.now() - 3600000 },
      { nombre: 'Camila Montes', matricula: '2026-PWA-103', carrera: 'Sistemas', observaciones: 'Network-First', fecha: Date.now() - 7200000 }
    ];
    for (const item of demo) await insertAlumno(item);
    showIdbAlert('Datos demo cargados.', 'success');
    renderAlumnosTable();
  });
}

if (idbEls.btnClearAll) {
  idbEls.btnClearAll.addEventListener('click', async () => {
    if (confirm('¿Eliminar todos los registros?')) {
      await clearAllAlumnos();
      showIdbAlert('Registros eliminados.', 'danger');
      renderAlumnosTable();
    }
  });
}

renderAlumnosTable();

/* =========================================================
   EJERCICIO 5: CACHÉ NETWORK-FIRST CON FALLBACK A INDEXEDDB
   ========================================================= */
const API_URL = 'https://jsonplaceholder.typicode.com/posts?_limit=6';
const CACHE_KEY = 'posts_dataset';

const apiEls = {
  btnFetch: $('#btn-fetch-api'),
  btnLoadCache: $('#btn-load-cache'),
  btnToggleOffline: $('#btn-toggle-offline'),
  btnClearCache: $('#btn-clear-api-cache'),
  sourceBadge: $('#cache-source-badge'),
  mockOfflineBadge: $('#mock-offline-badge'),
  timeInfo: $('#cache-time-info'),
  alert: $('#api-alert'),
  postsContainer: $('#posts-container')
};

let isMockOffline = false;

function showApiAlert(msg, type = 'info') {
  if (!apiEls.alert) return;
  apiEls.alert.className = `alert alert-${type}`;
  apiEls.alert.textContent = msg;
  apiEls.alert.classList.remove('hidden');
  setTimeout(() => apiEls.alert.classList.add('hidden'), 3500);
}

async function saveCacheData(key, data) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_CACHE], 'readwrite');
    const store = tx.objectStore(STORE_CACHE);
    const req = store.put({ key, data, timestamp: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getCacheData(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_CACHE], 'readonly');
    const store = tx.objectStore(STORE_CACHE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function clearCacheData(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_CACHE], 'readwrite');
    const store = tx.objectStore(STORE_CACHE);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function renderPosts(posts, source, timestamp = Date.now()) {
  if (!posts || !posts.length) {
    apiEls.postsContainer.innerHTML = `
      <p style="grid-column: 1 / -1; color: var(--text-muted); text-align: center; padding: 2rem;">
        No hay datos disponibles.
      </p>
    `;
    return;
  }

  const isNetwork = source === 'network';
  apiEls.sourceBadge.className = `badge ${isNetwork ? 'badge-green' : 'badge-yellow'}`;
  apiEls.sourceBadge.textContent = isNetwork ? 'Red (En vivo)' : 'IndexedDB (Offline)';
  apiEls.timeInfo.textContent = `Actualizado: ${new Date(timestamp).toLocaleTimeString()}`;

  apiEls.postsContainer.innerHTML = posts
    .map(
      (post) => `
      <div class="post-card">
        <div>
          <h4>${escapeHtml(post.title)}</h4>
          <p>${escapeHtml(post.body)}</p>
        </div>
        <div class="post-footer">
          <span>#${post.id}</span>
          <span class="badge ${isNetwork ? 'badge-green' : 'badge-yellow'}">${isNetwork ? 'Network' : 'IndexedDB'}</span>
        </div>
      </div>
    `
    )
    .join('');
}

async function fetchNetworkFirst() {
  apiEls.btnFetch.disabled = true;
  apiEls.btnFetch.innerHTML = '<span class="spinner"></span> Cargando...';

  try {
    if (isMockOffline || !navigator.onLine) {
      throw new Error('Sin conexión');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const posts = await res.json();
    await saveCacheData(CACHE_KEY, posts);
    renderPosts(posts, 'network', Date.now());
    showApiAlert('Datos obtenidos desde la red y guardados en IndexedDB.', 'success');
  } catch {
    const cached = await getCacheData(CACHE_KEY);
    if (cached && cached.data && cached.data.length) {
      renderPosts(cached.data, 'indexeddb', cached.timestamp);
      showApiAlert('Sin conexión: Datos cargados desde IndexedDB (Fallback).', 'warning');
    } else {
      apiEls.postsContainer.innerHTML = `
        <p style="grid-column: 1 / -1; text-align: center; color: var(--btn-red); padding: 2rem;">
          Sin red y sin datos previos guardados en IndexedDB.
        </p>
      `;
      showApiAlert('Sin red ni copia en caché.', 'danger');
    }
  } finally {
    apiEls.btnFetch.disabled = false;
    apiEls.btnFetch.textContent = 'Consumir API';
  }
}

async function loadFromIndexedDBCache() {
  const cached = await getCacheData(CACHE_KEY);
  if (cached && cached.data && cached.data.length) {
    renderPosts(cached.data, 'indexeddb', cached.timestamp);
    showApiAlert('Copia local cargada desde IndexedDB.', 'info');
  } else {
    showApiAlert('No hay datos guardados en IndexedDB.', 'warning');
  }
}

function toggleMockOffline() {
  isMockOffline = !isMockOffline;
  if (isMockOffline) {
    apiEls.mockOfflineBadge.classList.remove('hidden');
    apiEls.btnToggleOffline.textContent = 'Desactivar offline';
    showApiAlert('Modo offline activado. Prueba pulsar "Consumir API" para ver el fallback.', 'warning');
  } else {
    apiEls.mockOfflineBadge.classList.add('hidden');
    apiEls.btnToggleOffline.textContent = 'Simular offline';
    showApiAlert('Modo offline desactivado.', 'info');
  }
}

async function clearApiCache() {
  await clearCacheData(CACHE_KEY);
  apiEls.timeInfo.textContent = '';
  apiEls.sourceBadge.className = 'badge badge-yellow';
  apiEls.sourceBadge.textContent = 'Caché vacía';
  showApiAlert('Caché eliminada.', 'danger');
}

if (apiEls.btnFetch) apiEls.btnFetch.addEventListener('click', fetchNetworkFirst);
if (apiEls.btnLoadCache) apiEls.btnLoadCache.addEventListener('click', loadFromIndexedDBCache);
if (apiEls.btnToggleOffline) apiEls.btnToggleOffline.addEventListener('click', toggleMockOffline);
if (apiEls.btnClearCache) apiEls.btnClearCache.addEventListener('click', clearApiCache);

getCacheData(CACHE_KEY).then((cached) => {
  if (cached && cached.timestamp) {
    apiEls.timeInfo.textContent = `Guardado: ${new Date(cached.timestamp).toLocaleTimeString()}`;
  }
});
