// --- Configuration & State ---
const API_URL_ISS = 'https://api.wheretheiss.at/v1/satellites/25544';
const API_URL_CREW = 'https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json';
const UPDATE_INTERVAL = 2000; // 2 seconds

let map;
let issMarker;
let isFirstLoad = true;
let flightPath = []; // store latlngs
let polyline;

// Custom SVG Icon for the ISS
const svgIcon = `
<svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Solar Panels -->
  <rect x="5" y="30" width="35" height="40" fill="#4299e1" stroke="#00f2fe" stroke-width="2" rx="2" />
  <rect x="60" y="30" width="35" height="40" fill="#4299e1" stroke="#00f2fe" stroke-width="2" rx="2" />
  
  <!-- Central Truss & Modules -->
  <rect x="40" y="45" width="20" height="10" fill="#e2e8f0" stroke="#a0aec0" stroke-width="1" />
  <rect x="45" y="20" width="10" height="60" fill="#cbd5e1" stroke="#a0aec0" stroke-width="1" rx="2"/>
  
  <!-- Indicator Light -->
  <circle cx="50" cy="50" r="5" fill="#f56565">
    <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite"/>
  </circle>
</svg>
`;

const issIcon = L.divIcon({
  className: 'iss-icon',
  html: svgIcon,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  startClock();
  fetchCrewData();
  fetchIssData();
  
  // Start polling
  setInterval(fetchIssData, UPDATE_INTERVAL);
});

// --- Map Logic ---
function initMap() {
  map = L.map('map', {
    zoomControl: false,
    maxZoom: 10,
    minZoom: 2,
    worldCopyJump: true // enables continuous panning across date line
  }).setView([0, 0], 3);

  // Add Esri World Imagery (Satellite) Map
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  }).addTo(map);

  // Add zoom control manually to bottom right
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  issMarker = L.marker([0, 0], { icon: issIcon, zIndexOffset: 1000 }).addTo(map);
  
  // Orbit trail
  polyline = L.polyline([], {color: '#00f2fe', weight: 2, opacity: 0.6, dashArray: '5, 10'}).addTo(map);
}

// --- Data Fetching ---
async function fetchIssData() {
  try {
    const response = await fetch(API_URL_ISS);
    if (!response.ok) throw new Error('Failed to fetch ISS data');
    const data = await response.json();
    updateDashboard(data);
  } catch (error) {
    console.error('Error fetching ISS data:', error);
  }
}

async function fetchCrewData() {
  try {
    const response = await fetch(API_URL_CREW);
    if (!response.ok) throw new Error('Failed to fetch crew data');
    const data = await response.json();
    
    // Filter out people not on the ISS
    const issCrew = data.people.filter(person => person.iss === true);
    renderCrewManifest(issCrew);
  } catch (error) {
    console.error('Error fetching crew data:', error);
    document.getElementById('crew-list').innerHTML = 
      '<div class="loading-text" style="color:var(--accent-red)">Error loading crew data.</div>';
  }
}

// --- UI Updates ---
function updateDashboard(data) {
  const lat = data.latitude;
  const lon = data.longitude;
  const alt = data.altitude.toFixed(2);
  const vel = data.velocity.toFixed(2);

  // Update map marker
  issMarker.setLatLng([lat, lon]);
  
  // Update flight path
  flightPath.push([lat, lon]);
  // Maintain only recent points so it doesn't wrap awkwardly over the whole map after long time
  if (flightPath.length > 2000) flightPath.shift();
  polyline.setLatLngs(flightPath);
  
  if (isFirstLoad) {
    map.setView([lat, lon], 4);
    isFirstLoad = false;
  }

  // Update Telemetry Panel
  document.getElementById('lat-val').innerText = lat.toFixed(4);
  document.getElementById('lon-val').innerText = lon.toFixed(4);
  document.getElementById('alt-val').innerText = alt;
  // Make numbers look nice with commas
  document.getElementById('vel-val').innerText = parseFloat(vel).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function renderCrewManifest(crew) {
  document.getElementById('crew-count').innerText = crew.length;
  
  const container = document.getElementById('crew-list');
  container.innerHTML = ''; // clear loading text

  crew.forEach(member => {
    // Use Flag CDN for flags, fallback to empty string
    const flagUrl = member.flag_code ? `https://flagcdn.com/w40/${member.flag_code}.png` : '';
    const flagHtml = flagUrl ? `<img src="${flagUrl}" class="crew-flag" alt="${member.country}" title="${member.country}">` : '';

    // Fix missing images
    const imageUrl = member.image || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="%232d3748"/></svg>';

    // Create Card
    const card = document.createElement('div');
    card.className = 'crew-card';
    card.innerHTML = `
      <img src="${imageUrl}" class="crew-avatar" alt="${member.name}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'">
      <div class="crew-info">
        <div class="crew-name">${member.name}</div>
        <div class="crew-role">${member.agency || 'Unknown'} • ${member.position || 'Unknown'}</div>
      </div>
      ${flagHtml}
    `;
    container.appendChild(card);
  });
}

// --- Utility: UTC Clock ---
function startClock() {
  const clockElement = document.getElementById('utc-clock');
  
  function updateClock() {
    const now = new Date();
    // Format to HH:MM:SS UTC
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    clockElement.innerText = `${hh}:${mm}:${ss} UTC`;
  }
  
  updateClock();
  setInterval(updateClock, 1000);
}
