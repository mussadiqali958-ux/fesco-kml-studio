import './style.css';

const $ = (selector) => document.querySelector(selector);
let headers = [], rows = [], map, markers = [], web, mis, missing = [];

function note(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('on');
  clearTimeout(note.timer);
  note.timer = setTimeout(() => toast.classList.remove('on'), 2800);
}

function parseCSV(source) {
  const records = [];
  let record = [], value = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"' && quoted && source[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { record.push(value.trim()); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++;
      record.push(value.trim());
      if (record.some(cell => cell !== '')) records.push(record);
      record = []; value = '';
    } else value += char;
  }
  record.push(value.trim());
  if (record.some(cell => cell !== '')) records.push(record);
  const columns = (records.shift() || []).map((cell, index) => cell || `Column ${index + 1}`);
  return {
    headers: columns,
    rows: records.map(record => Object.fromEntries(columns.map((column, index) => [column, record[index] ?? ''])))
  };
}

function readFile(file, callback) {
  if (!file || !/\.(csv|txt)$/i.test(file.name)) return note('Please choose a CSV or TXT file.');
  const reader = new FileReader();
  reader.onload = () => {
    try { callback(parseCSV(String(reader.result || '')), file.name); }
    catch { note('Could not read this file. Check its CSV formatting.'); }
  };
  reader.onerror = () => note('File could not be read.');
  reader.readAsText(file);
}

function detectColumn(columns, candidates) {
  return columns.find(column => candidates.includes(column.toLowerCase().replace(/[^a-z0-9]/g, '')))
    || columns[0];
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function loadDataset(dataset, filename) {
  headers = dataset.headers;
  rows = dataset.rows;
  if (!headers.length || !rows.length) return note('No data rows found in this file.');
  const mappings = [
    ['#x', ['longitude', 'lon', 'long', 'easting', 'east', 'xcoord', 'x']],
    ['#y', ['latitude', 'lat', 'northing', 'north', 'ycoord', 'y']],
    ['#id', ['polenumber', 'assetid', 'transformerid', 'equipmentid', 'assetno', 'id']],
    ['#type', ['equipmenttype', 'assettype', 'transformertype', 'type']]
  ];
  mappings.forEach(([selector, candidates]) => {
    $(selector).innerHTML = headers.map(header => `<option value="${escapeHTML(header)}">${escapeHTML(header)}</option>`).join('');
    $(selector).value = detectColumn(headers, candidates);
  });
  $('#mapping').hidden = false;
  $('#count').textContent = `${rows.length.toLocaleString()} records · ${filename}`;
  $('#kml').disabled = $('#kmz').disabled = false;
  render();
}

function coordinate(row) {
  const rawLongitude = String(row[$('#x').value] ?? '').replace(/,/g, '').trim();
  const rawLatitude = String(row[$('#y').value] ?? '').replace(/,/g, '').trim();
  const longitude = Number(rawLongitude);
  const latitude = Number(rawLatitude);
  const valid = rawLongitude !== '' && rawLatitude !== ''
    && Number.isFinite(longitude) && Number.isFinite(latitude)
    && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
  return { longitude, latitude, valid };
}

function render() {
  const validRows = rows.filter(row => coordinate(row).valid);
  const invalidCount = rows.length - validRows.length;
  $('#tbody').innerHTML = rows.slice(0, 150).map((row, index) => {
    const point = coordinate(row);
    return `<tr><td>${index + 1}</td><td>${escapeHTML(row[$('#id').value])}</td>
      <td>${escapeHTML(row[$('#x').value])}</td><td>${escapeHTML(row[$('#y').value])}</td>
      <td><i class="${point.valid ? 'good' : 'bad'}">${point.valid ? 'VALID' : 'CHECK CRS'}</i></td></tr>`;
  }).join('');
  $('#points').textContent = `${validRows.length} VALID POINTS`;
  $('#count').textContent = `${rows.length.toLocaleString()} records · ${invalidCount} need coordinate review`;
  if (!window.L) return;
  if (!map) {
    map = L.map('map').setView([31.4, 73.1], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
  }
  markers.forEach(marker => marker.remove());
  markers = validRows.map(row => {
    const point = coordinate(row);
    const title = row[$('#id').value] || 'Unnamed asset';
    const kind = row[$('#type').value] || 'Asset';
    return L.circleMarker([point.latitude, point.longitude], {
      radius: 6, color: '#83e0b2', fillColor: '#24865c', fillOpacity: .9, weight: 2
    }).bindPopup(`<b>${escapeHTML(title)}</b><br>${escapeHTML(kind)}`).addTo(map);
  });
  if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(.15));
  setTimeout(() => map.invalidateSize(), 100);
}

function xmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[char]);
}

function createKML() {
  const placemarks = rows.map(row => {
    const point = coordinate(row);
    if (!point.valid) return '';
    const name = xmlEscape(row[$('#id').value] || 'Asset');
    const type = xmlEscape(row[$('#type').value] || 'Transformer');
    return `<Placemark><name>${name}</name><description>${type}</description><Point><coordinates>${point.longitude},${point.latitude},0</coordinates></Point></Placemark>`;
  }).join('');
  if (!placemarks) throw new Error('No valid WGS84 coordinates. Review your coordinate columns.');
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>FESCO Transformer Assets</name>${placemarks}</Document></kml>`;
}

function download(data, filename, mimeType) {
  const anchor = document.createElement('a');
  const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

$('#browse').onclick = () => $('#file').click();
$('#file').onchange = event => readFile(event.target.files[0], loadDataset);
$('#drop').ondragover = event => { event.preventDefault(); $('#drop').classList.add('drag'); };
$('#drop').ondragleave = () => $('#drop').classList.remove('drag');
$('#drop').ondrop = event => {
  event.preventDefault();
  $('#drop').classList.remove('drag');
  readFile(event.dataTransfer.files[0], loadDataset);
};

$('#sample').onclick = () => {
  const columns = ['PoleNumber', 'Longitude', 'Latitude', 'EquipmentType'];
  const values = [
    ['TR-001', '73.0472', '31.4186', 'Transformer'],
    ['TR-002', '73.0611', '31.4250', 'Transformer'],
    ['TR-003', '73.0835', '31.4012', 'Transformer'],
    ['TR-004', '73.1020', '31.4380', 'Transformer']
  ];
  loadDataset({
    headers: columns,
    rows: values.map(value => Object.fromEntries(columns.map((column, index) => [column, value[index]])))
  }, 'sample-survey.csv');
};

['#x', '#y', '#id', '#type'].forEach(selector => $(selector).onchange = render);
$('#kml').onclick = () => {
  try { download(createKML(), 'fesco-transformers.kml', 'application/vnd.google-earth.kml+xml'); note('KML export generated.'); }
  catch (error) { note(error.message); }
};
$('#kmz').onclick = async () => {
  try {
    if (!window.JSZip) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = resolve; script.onerror = reject; document.head.append(script);
    });
    const archive = new JSZip();
    archive.file('doc.kml', createKML());
    const blob = await archive.generateAsync({ type: 'blob' });
    download(blob, 'fesco-transformers.kmz', 'application/vnd.google-earth.kmz');
    note('KMZ export generated.');
  } catch (error) { note(error.message || 'KMZ export failed.'); }
};

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(element => element.classList.toggle('shown', element.id === tab));
  document.querySelectorAll('.nav').forEach(element => element.classList.toggle('active', element.dataset.tab === tab));
  const copy = {
    convert: ['TRANSFORMER CONVERTER', 'Transformer <em>converter.</em>', 'Turn survey spreadsheets into clean, map-ready KML and KMZ files.'],
    audit: ['MIS RECONCILIATION', 'Asset <em>reconciliation.</em>', 'Find asset gaps between WebGIS and MIS exports.'],
    privacy: ['DATA & PRIVACY', 'Data <em>privacy.</em>', 'Understand how your survey data is handled.']
  }[tab];
  $('#crumb').textContent = copy[0];
  $('#heading').innerHTML = copy[1];
  $('#sub').textContent = copy[2];
  if (tab === 'convert' && map) setTimeout(() => map.invalidateSize(), 100);
}
document.querySelectorAll('.nav').forEach(button => button.onclick = () => switchTab(button.dataset.tab));
$('#theme').onclick = () => {
  document.body.classList.toggle('light');
  $('#theme').setAttribute('aria-label', document.body.classList.contains('light') ? 'Switch to dark theme' : 'Switch to light theme');
};

$('#webfile').onchange = event => readFile(event.target.files[0], dataset => {
  web = dataset; $('#compare').disabled = !(web && mis);
});
$('#misfile').onchange = event => readFile(event.target.files[0], dataset => {
  mis = dataset; $('#compare').disabled = !(web && mis);
});

$('#compare').onclick = () => {
  const key = $('#key').value.trim().toLowerCase();
  const webKey = web.headers.find(header => header.trim().toLowerCase() === key);
  const misKey = mis.headers.find(header => header.trim().toLowerCase() === key);
  if (!key || !webKey || !misKey) return note('The matching key must exist in both CSV files.');
  const normalize = value => String(value ?? '').trim().toLowerCase();
  const webIds = new Set(web.rows.map(row => normalize(row[webKey])).filter(Boolean));
  const misIds = new Set(mis.rows.map(row => normalize(row[misKey])).filter(Boolean));
  const matched = [...webIds].filter(id => misIds.has(id)).length;
  missing = [
    ...web.rows.filter(row => normalize(row[webKey]) && !misIds.has(normalize(row[webKey]))).map(row => ({ ...row, __source: 'WebGIS only' })),
    ...mis.rows.filter(row => normalize(row[misKey]) && !webIds.has(normalize(row[misKey]))).map(row => ({ ...row, __source: 'MIS only' }))
  ];
  $('#auditresult').hidden = false;
  $('#auditresult').innerHTML = `<h3>${missing.length.toLocaleString()} unmatched rows</h3>
    <p>${matched.toLocaleString()} matching IDs · ${webIds.size.toLocaleString()} unique WebGIS IDs · ${misIds.size.toLocaleString()} unique MIS IDs</p>
    <button id="download">Export unmatched CSV ↓</button>
    <div class="tablewrap"><table><thead><tr><th>ASSET ID</th><th>SOURCE</th></tr></thead><tbody>
    ${missing.slice(0, 100).map(row => `<tr><td>${escapeHTML(row[webKey] || row[misKey])}</td><td>${escapeHTML(row.__source)}</td></tr>`).join('')}
    </tbody></table></div>`;
  $('#download').onclick = () => {
    const columns = [...new Set(missing.flatMap(Object.keys))];
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [columns.map(quote).join(','), ...missing.map(row => columns.map(column => quote(row[column])).join(','))].join('\r\n');
    download(csv, 'fesco-unmatched.csv', 'text/csv');
  };
  note('Comparison complete.');
};
