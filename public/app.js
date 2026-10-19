(() => {
  'use strict';

  const form = document.querySelector('#scan-form');
  const fileInput = document.querySelector('#project-file');
  const fileDrop = document.querySelector('#file-drop');
  const fileName = document.querySelector('#file-name');
  const scanButton = document.querySelector('#scan-button');
  const status = document.querySelector('#status');
  const historyList = document.querySelector('#history-list');
  const historyCount = document.querySelector('#history-count');
  const emptyResults = document.querySelector('#empty-results');
  const documentResults = document.querySelector('#document-results');
  const readmeContent = document.querySelector('#readme-content');
  const explainerContent = document.querySelector('#explainer-content');
  const downloadButton = document.querySelector('#download-button');
  const selectedLabel = document.querySelector('#selected-scan-label');
  let scans = [];
  let selectedScanId = null;

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error', isError);
    status.hidden = !message;
  }

  function valueOf(scan, keys) {
    for (const key of keys) if (scan && scan[key] != null) return scan[key];
    return '';
  }

  function normalizeScan(item) {
    const scan = item?.scan || item;
    return {
      ...scan,
      id: valueOf(scan, ['id', 'scanId', '_id']),
      name: valueOf(scan, ['fileName', 'filename', 'name', 'projectName', 'title']) || 'Project scan',
      readme: valueOf(scan, ['readme', 'readmeContent', 'generatedReadme']),
      explainer: valueOf(scan, ['explainer', 'projectExplainer', 'explanation', 'project_explainer']),
      createdAt: valueOf(scan, ['createdAt', 'created_at', 'date'])
    };
  }

  function displayScan(scan) {
    selectedScanId = scan.id;
    readmeContent.textContent = scan.readme || 'No README was returned for this scan.';
    explainerContent.textContent = scan.explainer || 'No project explainer was returned for this scan.';
    selectedLabel.textContent = scan.name;
    emptyResults.hidden = true;
    documentResults.hidden = false;
    downloadButton.href = scan.id ? `/api/scans/${encodeURIComponent(scan.id)}/readme` : '#';
    downloadButton.setAttribute('aria-disabled', scan.id ? 'false' : 'true');
    renderHistory();
  }

  function dateLabel(value) {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function renderHistory() {
    historyCount.textContent = String(scans.length);
    historyList.replaceChildren();
    if (!scans.length) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = 'No scans yet.';
      historyList.append(empty);
      return;
    }
    scans.forEach((scan, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `history-item${scan.id === selectedScanId ? ' selected' : ''}`;
      item.innerHTML = `<strong></strong><span></span>`;
      item.querySelector('strong').textContent = scan.name || `Scan ${index + 1}`;
      item.querySelector('span').textContent = dateLabel(scan.createdAt);
      item.addEventListener('click', () => displayScan(scan));
      historyList.append(item);
    });
  }

  async function readJson(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
  }

  async function loadHistory() {
    try {
      const data = await readJson(await fetch('/api/scans'));
      const list = Array.isArray(data) ? data : (data.scans || data.items || []);
      scans = list.map(normalizeScan);
      renderHistory();
    } catch (error) {
      historyList.replaceChildren();
      const message = document.createElement('p');
      message.className = 'history-empty';
      message.textContent = 'Scan history is unavailable right now.';
      historyList.append(message);
      showStatus(error.message, true);
    }
  }

  fileInput.addEventListener('change', () => { fileName.textContent = fileInput.files[0]?.name || 'No file selected'; });
  ['dragenter', 'dragover'].forEach(eventName => fileDrop.addEventListener(eventName, event => { event.preventDefault(); fileDrop.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(eventName => fileDrop.addEventListener(eventName, event => { event.preventDefault(); fileDrop.classList.remove('dragging'); }));
  fileDrop.addEventListener('drop', event => { const file = event.dataTransfer.files[0]; if (file) { fileInput.files = event.dataTransfer.files; fileName.textContent = file.name; } });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const file = fileInput.files[0];
    if (!file || (!file.name.toLowerCase().endsWith('.zip') && file.type !== 'application/zip')) { showStatus('Please choose a ZIP file first.', true); return; }
    scanButton.disabled = true;
    scanButton.textContent = 'Generating…';
    showStatus('Scanning your project. This may take a moment.');
    try {
      const body = new FormData();
      body.append('project', file);
      const data = await readJson(await fetch('/api/scan', { method: 'POST', body }));
      const scan = normalizeScan(data);
      if (!scan.id) scan.id = valueOf(data, ['id', 'scanId']);
      scans = [scan, ...scans.filter(item => item.id !== scan.id)];
      displayScan(scan);
      showStatus('Documentation generated successfully.');
    } catch (error) { showStatus(error.message || 'Unable to scan that file.', true); }
    finally { scanButton.disabled = false; scanButton.textContent = 'Generate documentation'; }
  });

  renderHistory();
  loadHistory();
})();
