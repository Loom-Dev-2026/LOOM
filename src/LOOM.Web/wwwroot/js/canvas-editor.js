/**
 * LOOM canvas editor — full visual demo app logic.
 */

export function disposeCanvasEditor() {
  window.__loomCanvasInitialized = false;
  if (window.__libraryObserver) {
    window.__libraryObserver.disconnect();
    window.__libraryObserver = null;
  }
}

export async function initCanvasEditor(dotNetRef, apiStatus, nodeTypesJson) {
  'use strict';
  if (window.__loomCanvasInitialized) return;
  window.__loomCanvasInitialized = true;

  const apiBridge = dotNetRef ?? null;
  const apiConnected = apiStatus === 'connected';
  let sessionId = null;

  if (apiBridge) {
    try {
      sessionId = await apiBridge.invokeMethodAsync('GetSessionIdAsync');
    } catch (e) {
      console.warn('LOOM: could not read session id', e);
    }
  }

  function requireApi() {
    if (!apiBridge || !apiConnected) {
      toast('Loom backend is required. Run the solution via LOOM.AppHost or LOOM.Web.', 'error');
      return false;
    }
    return true;
  }

  function getFileNameEl() {
    return document.querySelector('#fileName .file-name-text');
  }

  function getWorkflowFileName() {
    const el = getFileNameEl();
    let name = el?.textContent?.trim() || 'untitled.loom';
    if (!name.toLowerCase().endsWith('.loom')) name += '.loom';
    return name;
  }

  function setWorkflowFileName(name) {
    const el = getFileNameEl();
    if (el && name) el.textContent = name;
  }

  /* Node metadata mirrors server catalog (NumberInput → MathOp → Result). */
  let NODE_TYPES = {
    NumberInput: {
      category: 'Input', color: 'data', desc: 'Enter a number',
      outputs: [{ name: 'Value', dataType: 'double' }],
      fields: [{ key: 'value', label: 'Number', default: '0' }],
    },
    StringInput: {
      category: 'Input', color: 'data', desc: 'Enter a text value',
      outputs: [{ name: 'Value', dataType: 'string' }],
      fields: [{ key: 'value', label: 'Text', default: 'Hello World' }],
    },
    MathOp: {
      category: 'Math', color: 'logic', desc: 'Arithmetic on A and B',
      inputs: [{ name: 'A', dataType: 'double' }, { name: 'B', dataType: 'double' }],
      outputs: [{ name: 'Result', dataType: 'double' }],
      fields: [{ key: 'op', label: 'Operation', default: 'Add' }],
    },
    Result: {
      category: 'Output', color: 'output', desc: 'Final answer (chainable)',
      inputs: [{ name: 'Value', dataType: 'double' }],
      outputs: [{ name: 'Value', dataType: 'double' }],
      fields: [{ key: 'label', label: 'Label', default: 'Answer' }],
    },
    MathN: {
      category: 'Math', color: 'logic', desc: 'Combine many numbers',
      inputs: ['In1', 'In2', 'In3', 'In4', 'In5', 'In6'].map((n) => ({ name: n, dataType: 'double' })),
      outputs: [{ name: 'Result', dataType: 'double' }],
      fields: [{ key: 'op', label: 'Operation', default: 'Add' }],
    },
    Compare: {
      category: 'Logic', color: 'logic', desc: 'Compare two numbers',
      inputs: [{ name: 'A', dataType: 'double' }, { name: 'B', dataType: 'double' }],
      outputs: [{ name: 'Result', dataType: 'bool' }],
      fields: [{ key: 'predicate', label: 'Predicate', default: '==' }],
    },
    CustomScript: {
      category: 'Script', color: 'script', desc: 'Custom C# snippet',
      inputs: [{ name: 'A', dataType: 'double' }, { name: 'B', dataType: 'double' }],
      outputs: [{ name: 'Value', dataType: 'object' }, { name: 'Result', dataType: 'object' }],
      fields: [{ key: 'script', label: 'Script', default: 'var a = (double)inputs["A"];\nvar b = (double)inputs["B"];\nreturn a + b;' }],
    },
    StringOp: {
      category: 'Text', color: 'data', desc: 'ToUpper, ToLower, Trim, Length, Reverse',
      inputs: [{ name: 'Value', dataType: 'string' }],
      outputs: [{ name: 'Result', dataType: 'object' }],
      fields: [{ key: 'op', label: 'Operation', default: 'ToUpper' }],
    },
    StringTransform: {
      category: 'Text', color: 'data', desc: 'Concat, Replace, Contains, StartsWith, EndsWith, IndexOf',
      inputs: [{ name: 'A', dataType: 'string' }, { name: 'B', dataType: 'string' }],
      outputs: [{ name: 'Result', dataType: 'object' }],
      fields: [{ key: 'op', label: 'Operation', default: 'Concat' }],
    },
    UnaryMath: {
      category: 'Math', color: 'logic', desc: 'Sqrt, Abs, Ceiling, Floor, Round, Log, Log10, Exp, Sin, Cos, Tan, Square, Cube',
      inputs: [{ name: 'Value', dataType: 'double' }],
      outputs: [{ name: 'Result', dataType: 'double' }],
      fields: [{ key: 'op', label: 'Operation', default: 'Sqrt' }],
    },
  };

  const NODE_DISPLAY_NAMES = {
    Compare: 'Compare',
    StringInput: 'String input',
    MathN: 'Math (N inputs)',
    CustomScript: 'Custom script',
    ApiWeather: 'Weather API',
    ApiGeocode: 'Geocode (Map)',
    ApiLocation: 'My location (IP)',
    StringOp: 'String op',
    StringTransform: 'String transform',
    UnaryMath: 'Unary math',
  };

  const API_NODE_TYPES = new Set(['ApiWeather', 'ApiGeocode', 'ApiLocation']);

  const API_FIELD_SELECTS = {
    location: [
      { value: 'London', label: 'London, UK' },
      { value: 'NewYork', label: 'New York, US' },
      { value: 'Paris', label: 'Paris, France' },
      { value: 'Tokyo', label: 'Tokyo, Japan' },
      { value: 'Sydney', label: 'Sydney, Australia' },
      { value: 'Dubai', label: 'Dubai, UAE' },
      { value: 'Cairo', label: 'Cairo, Egypt' },
      { value: 'SãoPaulo', label: 'São Paulo, Brazil' },
    ],
    tag: [
      { value: 'inspirational', label: 'Inspirational' },
      { value: 'wisdom', label: 'Wisdom' },
      { value: 'humor', label: 'Humor' },
      { value: 'life', label: 'Life' },
      { value: 'success', label: 'Success' },
    ],
    place: [
      { value: 'London, UK', label: 'London, UK' },
      { value: 'New York, US', label: 'New York, US' },
      { value: 'Paris, France', label: 'Paris, France' },
      { value: 'Tokyo, Japan', label: 'Tokyo, Japan' },
      { value: 'Sydney, Australia', label: 'Sydney, Australia' },
    ],
  };

  function applyNodeTypesFromJson(json) {
    if (!json) return;
    try {
      const defs = typeof json === 'string' ? JSON.parse(json) : json;
      if (!Array.isArray(defs) || defs.length === 0) return;
      const merged = {};
      defs.forEach((d) => {
        const type = d.type ?? d.Type;
        if (!type) return;
        merged[type] = {
          category: d.category ?? d.Category ?? 'Other',
          color: d.color ?? d.Color ?? 'logic',
          desc: d.description ?? d.Description ?? '',
          inputs: (d.inputs ?? d.Inputs ?? []).map((p) => ({
            name: p.name ?? p.Name,
            dataType: p.dataType ?? p.DataType ?? 'object',
          })),
          outputs: (d.outputs ?? d.Outputs ?? []).map((p) => ({
            name: p.name ?? p.Name,
            dataType: p.dataType ?? p.DataType ?? 'object',
          })),
          fields: (d.fields ?? d.Fields ?? []).map((f) => ({
            key: f.key ?? f.Key,
            label: f.label ?? f.Label,
            default: f.default ?? f.Default ?? '',
          })),
        };
      });
      if (Object.keys(merged).length > 0) NODE_TYPES = merged;
    } catch (e) {
      console.warn('LOOM: could not parse node types from server, using defaults', e);
    }
  }

  function parseWorkflowDto(json) {
    return typeof json === 'string' ? JSON.parse(json) : json;
  }

  function clearStage() {
    if (!stage) return;
    stage.querySelectorAll('.node, .port-rail, .port').forEach((el) => el.remove());
    if (svg) {
      svg.querySelectorAll('.edge-group, .edge-preview').forEach((el) => el.remove());
    }
    edgePathCache.clear();
  }

  function nodeFromDto(n) {
    const status = (n.executionStatus ?? n.ExecutionStatus ?? 'idle').toLowerCase();
    return {
      id: String(n.id ?? n.Id),
      type: n.type ?? n.Type,
      x: Number(n.x ?? n.X ?? 0),
      y: Number(n.y ?? n.Y ?? 0),
      fields: { ...(n.fields || n.Fields || {}) },
      result: n.lastOutput ?? n.LastOutput ?? null,
      errorMessage: n.errorMessage ?? n.ErrorMessage ?? null,
      executed: status === 'done' || status === 'error' || status === 'skipped',
      executionStatus: status,
      executing: false,
    };
  }

  function nodesOverlap() {
    const list = [...state.nodes.values()];
    const w = 220;
    const h = 130;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.x < b.x + w && a.x + w > b.x && a.y < b.y + h && a.y + h > b.y) return true;
      }
    }
    return false;
  }

  function layoutGraphTidy() {
    const nodeIds = [...state.nodes.keys()];
    if (nodeIds.length === 0) return;

    const inDeg = new Map(nodeIds.map((id) => [id, 0]));
    state.edges.forEach((e) => {
      if (inDeg.has(e.to)) inDeg.set(e.to, inDeg.get(e.to) + 1);
    });

    const level = new Map(nodeIds.map((id) => [id, 0]));
    const queue = nodeIds.filter((id) => inDeg.get(id) === 0);

    while (queue.length) {
      const id = queue.shift();
      const lv = level.get(id) ?? 0;
      state.edges.forEach((e) => {
        if (e.from !== id || !inDeg.has(e.to)) return;
        level.set(e.to, Math.max(level.get(e.to) ?? 0, lv + 1));
        const next = inDeg.get(e.to) - 1;
        inDeg.set(e.to, next);
        if (next === 0) queue.push(e.to);
      });
    }

    const groups = new Map();
    level.forEach((lv, id) => {
      if (!groups.has(lv)) groups.set(lv, []);
      groups.get(lv).push(id);
    });

    const colW = 300;
    const rowH = 155;
    [...groups.keys()].sort((a, b) => a - b).forEach((lv) => {
      groups.get(lv).sort().forEach((id, i) => {
        const n = state.nodes.get(id);
        if (!n) return;
        n.x = 80 + lv * colW;
        n.y = 100 + i * rowH;
        const el = document.querySelector(`[data-node-id="${id}"]`);
        if (el) {
          el.style.left = `${n.x}px`;
          el.style.top = `${n.y}px`;
        }
      });
    });
    redrawEdges();
    updateStats();
  }

  const MAX_HISTORY = 50;
  let historyRestoring = false;

  function captureHistorySnapshot() {
    return JSON.stringify(buildWorkflowDto());
  }

  function updateUndoRedoButtons() {
    const undoBtn = $('btnUndo');
    const redoBtn = $('btnRedo');
    if (undoBtn) undoBtn.disabled = state.historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = state.historyIndex < 0 || state.historyIndex >= state.history.length - 1;
  }

  function pushHistorySnapshot(snapshot) {
    if (historyRestoring || !snapshot) return;
    if (state.historyIndex >= 0 && state.history[state.historyIndex] === snapshot) return;
    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }
    state.history.push(snapshot);
    if (state.history.length > MAX_HISTORY) {
      state.history.shift();
      state.historyIndex = state.history.length - 1;
    } else {
      state.historyIndex = state.history.length - 1;
    }
    updateUndoRedoButtons();
  }

  function pushHistory() {
    pushHistorySnapshot(captureHistorySnapshot());
  }

  function resetHistory() {
    state.history = [captureHistorySnapshot()];
    state.historyIndex = 0;
    updateUndoRedoButtons();
  }

  async function restoreHistorySnapshot(snapshot) {
    if (!requireApi() || !snapshot) return false;
    historyRestoring = true;
    try {
      const json = await apiBridge.invokeMethodAsync('ReplaceWorkflowJsonAsync', snapshot);
      const ok = await applyGraphFromServer(json, { autoLayout: false });
      if (ok) {
        state.isDirty = true;
        $('fileName')?.classList.add('unsaved');
      }
      return ok;
    } catch (e) {
      toast(e.message || 'Could not restore state', 'error');
      return false;
    } finally {
      historyRestoring = false;
      updateUndoRedoButtons();
    }
  }

  async function undo() {
    if (!requireApi() || state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    const ok = await restoreHistorySnapshot(state.history[state.historyIndex]);
    if (!ok) state.historyIndex += 1;
    updateUndoRedoButtons();
  }

  async function redo() {
    if (!requireApi() || state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    const ok = await restoreHistorySnapshot(state.history[state.historyIndex]);
    if (!ok) state.historyIndex -= 1;
    updateUndoRedoButtons();
  }

  function buildWorkflowDto() {
    return {
      sessionId,
      name: getWorkflowFileName(),
      nodes: [...state.nodes.values()].map((n) => ({
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        fields: n.fields,
        lastOutput: n.result,
        executionStatus: n.executed ? 'done' : 'idle',
      })),
      edges: [...state.edges.values()].map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        fromPort: e.fromPort,
        toPort: e.toPort,
      })),
    };
  }

  function patchNodeDom(node) {
    const el = document.querySelector(`[data-node-id="${node.id}"]`);
    if (!el) return;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.classList.toggle('executed', !!node.executed);
    const status = el.querySelector('.node-head .status');
    if (status) status.textContent = node.executed ? 'done' : 'idle';
    const nameEl = el.querySelector('.node-head .name');
    const def = NODE_TYPES[node.type] || { fields: [] };
    if (nameEl) nameEl.textContent = nodeDisplayName(node, def);
    const sink = el.querySelector('.node-value-sink');
    if (sink) {
      const hasError = !!node.errorMessage;
      const hasResult = !hasError && node.result != null && node.result !== '';
      sink.textContent = hasError
        ? String(node.errorMessage)
        : hasResult ? String(node.result) : 'Waiting for input…';
      sink.classList.toggle('has-value', hasResult);
      sink.classList.toggle('has-error', hasError);
    }
    el.classList.toggle('node-error', node.executionStatus === 'error');
    el.classList.toggle('node-skipped', node.executionStatus === 'skipped');
    const apiSink = el.querySelector('.api-output-sink');
    if (apiSink) {
      const preview = apiPreviewText(node);
      apiSink.textContent = preview.text;
      apiSink.className = `api-output-sink ${preview.mode}`;
    }
    (def.fields || []).forEach((f) => {
      const val = el.querySelector(`.node-value[data-key="${f.key}"]`);
      if (!val) return;
      if (f.key === 'script') val.textContent = formatScriptPreview(node.fields[f.key] ?? f.default ?? '');
      else val.textContent = node.fields[f.key] ?? '';
    });
    let resultEl = el.querySelector('.node-result');
    if (node.result && !sink) {
      if (!resultEl) {
        const body = el.querySelector('.node-body');
        if (body) {
          resultEl = document.createElement('div');
          resultEl.className = 'node-result';
          body.appendChild(resultEl);
        }
      }
      if (resultEl) resultEl.textContent = `→ ${node.result}`;
    } else if (resultEl) {
      resultEl.remove();
    }
    markConnectedPorts();
  }

  function markNodeConnectedStatus() {
    const connectedNodeIds = new Set();
    state.edges.forEach((edge) => {
      connectedNodeIds.add(edge.from);
      connectedNodeIds.add(edge.to);
    });
    state.nodes.forEach((node) => {
      const el = document.querySelector(`[data-node-id="${node.id}"]`);
      if (!el) return;
      const isConnected = connectedNodeIds.has(node.id);
      const status = el.querySelector('.node-head .status');
      if (status) {
        if (isConnected && !node.executing && node.executionStatus !== 'done' && node.executionStatus !== 'error' && node.executionStatus !== 'skipped') {
          status.textContent = 'active';
        } else if (!node.executing && node.executionStatus !== 'done' && node.executionStatus !== 'error' && node.executionStatus !== 'skipped') {
          status.textContent = 'idle';
        }
      }
      el.classList.toggle('node-connected', isConnected && !node.executed && !node.executing);
    });
  }

  function markConnectedPorts() {
    document.querySelectorAll('.port').forEach((p) => p.classList.remove('connected'));
    state.edges.forEach((edge) => {
      const { fromPort, toPort } = resolveEdgePorts(edge);
      if (fromPort) findPortEl(edge.from, 'out', fromPort)?.classList.add('connected');
      if (toPort) findPortEl(edge.to, 'in', toPort)?.classList.add('connected');
    });
    markNodeConnectedStatus();
  }

  function mergeGraphFromServer(json) {
    const dto = parseWorkflowDto(json);
    if (dto.error) {
      toast(dto.error, 'error');
      return false;
    }

    const nodes = dto.nodes || dto.Nodes || [];
    const edges = dto.edges || dto.Edges || [];
    const serverIds = new Set();

    nodes.forEach((raw) => {
      const n = nodeFromDto(raw);
      serverIds.add(n.id);
      const existing = state.nodes.get(n.id);
      if (existing) {
        Object.assign(existing, n);
        patchNodeDom(existing);
      } else {
        state.nodes.set(n.id, n);
        renderNode(n);
      }
    });

    [...state.nodes.keys()].forEach((id) => {
      if (!serverIds.has(id)) {
        document.querySelector(`[data-node-id="${id}"]`)?.remove();
        state.nodes.delete(id);
        [...state.portAnchors.keys()].forEach((key) => {
          if (key.startsWith(`${id}:`)) state.portAnchors.delete(key);
        });
      }
    });

    state.edges.clear();
    let maxEdge = 1;
    edges.forEach((e) => {
      const id = e.id ?? e.Id;
      const num = parseInt(String(id).replace('e', ''), 10);
      if (!isNaN(num) && num >= maxEdge) maxEdge = num + 1;
      state.edges.set(id, {
        id,
        from: String(e.from ?? e.From),
        to: String(e.to ?? e.To),
        fromPort: e.fromPort ?? e.FromPort ?? '',
        toPort: e.toPort ?? e.ToPort ?? '',
      });
    });
    state.nextEdgeId = maxEdge;

    let maxNode = 1;
    state.nodes.forEach((_, id) => {
      const num = parseInt(id, 10);
      if (!isNaN(num) && num >= maxNode) maxNode = num + 1;
    });
    state.nextId = maxNode;

    const wfName = dto.name ?? dto.Name;
    if (wfName) setWorkflowFileName(wfName);

    state.nodes.forEach((_, id) => applyPortAnchorsForNode(id));
    redrawEdges();
    markConnectedPorts();
    updateStats();
    return true;
  }

  async function applyGraphFromServer(json, options = {}) {
    const dto = parseWorkflowDto(json);
    if (dto.error) {
      toast(dto.error, 'error');
      return false;
    }

    const selectedId = state.selectedNode?.id;
    state.nodes.clear();
    state.edges.clear();
    clearStage();

    let maxNode = 1;
    let maxEdge = 1;
    const nodes = dto.nodes || dto.Nodes || [];
    const edges = dto.edges || dto.Edges || [];

    stage.classList.add('batch-load');
    nodes.forEach((raw) => {
      const n = nodeFromDto(raw);
      const num = parseInt(n.id, 10);
      if (!isNaN(num) && num >= maxNode) maxNode = num + 1;
      state.nodes.set(n.id, n);
      renderNode(n);
    });

    edges.forEach((e) => {
      const id = e.id ?? e.Id;
      const num = parseInt(String(id).replace('e', ''), 10);
      if (!isNaN(num) && num >= maxEdge) maxEdge = num + 1;
      state.edges.set(id, {
        id,
        from: String(e.from ?? e.From),
        to: String(e.to ?? e.To),
        fromPort: e.fromPort ?? e.FromPort ?? '',
        toPort: e.toPort ?? e.ToPort ?? '',
      });
    });
    stage.classList.remove('batch-load');

    state.nextId = maxNode;
    state.nextEdgeId = maxEdge;
    state.isDirty = false;

    const wfName = dto.name ?? dto.Name;
    if (wfName) setWorkflowFileName(wfName);

    if (options.autoLayout !== false && nodesOverlap()) {
      layoutGraphTidy();
    }

    redrawEdges();
    markConnectedPorts();
    updateStats();
    if (state.nodes.size === 0) emptyState.classList.remove('hidden');
    else emptyState.classList.add('hidden');

    if (selectedId && state.nodes.has(selectedId)) select(state.nodes.get(selectedId));
    else deselect();
    return true;
  }

  async function persistLayoutToServer() {
    if (!requireApi()) return false;
    const json = await apiBridge.invokeMethodAsync(
      'ReplaceWorkflowJsonAsync',
      JSON.stringify(buildWorkflowDto()));
    return applyGraphFromServer(json, { autoLayout: false });
  }

  /* ---------- App state ---------- */
  const state = {
    nodes: new Map(),
    edges: new Map(),
    selectedNode: null,
    selectedEdge: null,
    nextId: 1,
    nextEdgeId: 1,
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStart: null,
    draggingNode: null,
    dragStart: null,
    connecting: null,
    portDrag: null,
    portAnchors: new Map(),
    history: [],
    historyIndex: -1,
    isDirty: false,
    isRunning: false,
  };

  /* ---------- DOM refs ---------- */
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');
  const stage = $('canvasStage');
  const grid = $('canvasGrid');
  const svg = $('canvasSvg');
  const inspectorBody = $('inspectorBody');
  const emptyState = $('emptyState');
  const toastTray = $('toastTray');
  const minimap = $('minimap');
  const minimapCanvas = $('minimapCanvas');
  const ctxMenu = $('ctxMenu');

/* Theme toggle handled by Blazor ThemeToggle (theme.js). */

  /* ---------- Toast ---------- */
  const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };
  function toast(msg, kind = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[kind]}</span><span>${msg}</span>`;
    toastTray.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  /* ---------- Library drag-and-drop ---------- */
  function attachLibraryDragHandlers() {
    const body = document.getElementById('libraryBody');
    if (!body) return;

    body.querySelectorAll('.library-item').forEach(item => {
      if (item.dataset.loomDragAttached) return;
      item.dataset.loomDragAttached = 'true';

      item.addEventListener('dragstart', (e) => {
        const type = item.dataset.type;
        if (!type) return;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', type);
        const img = new Image();
        img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        e.dataTransfer.setDragImage(img, 0, 0);
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
      });
    });
  }

  window.__libraryObserver = new MutationObserver(() => attachLibraryDragHandlers());
  const libraryBodyEl = document.getElementById('libraryBody');
  if (libraryBodyEl) {
    window.__libraryObserver.observe(libraryBodyEl, { childList: true, subtree: true });
    attachLibraryDragHandlers();
  }

  /* ---------- Canvas pan & zoom ---------- */
  let minimapRaf = null;
  let edgesRaf = null;
  let transformRaf = null;
  const edgePathCache = new Map();

  function scheduleMinimap() {
    if (minimapRaf) return;
    minimapRaf = requestAnimationFrame(() => {
      minimapRaf = null;
      renderMinimap();
    });
  }

  function scheduleRedrawEdges() {
    if (edgesRaf) return;
    edgesRaf = requestAnimationFrame(() => {
      edgesRaf = null;
      redrawEdges();
    });
  }

  function applyTransformNow() {
    stage.style.setProperty('--cx', state.panX + 'px');
    stage.style.setProperty('--cy', state.panY + 'px');
    stage.style.setProperty('--cz', state.zoom);
    grid.style.setProperty('--gx', (state.panX % 24) + 'px');
    grid.style.setProperty('--gy', (state.panY % 24) + 'px');
    $('zoomDisplay').textContent = Math.round(state.zoom * 100) + '%';
  }

  function updateTransform(immediate = false) {
    if (immediate) {
      if (transformRaf) {
        cancelAnimationFrame(transformRaf);
        transformRaf = null;
      }
      applyTransformNow();
      scheduleMinimap();
      return;
    }
    if (transformRaf) return;
    transformRaf = requestAnimationFrame(() => {
      transformRaf = null;
      applyTransformNow();
      scheduleMinimap();
    });
  }
  function setZoom(z, cx, cy) {
    z = Math.max(0.25, Math.min(2.5, z));
    // zoom toward cx,cy (canvas-space pivot)
    const rect = canvas.getBoundingClientRect();
    cx = cx ?? rect.width / 2;
    cy = cy ?? rect.height / 2;
    const wx = (cx - state.panX) / state.zoom;
    const wy = (cy - state.panY) / state.zoom;
    state.zoom = z;
    state.panX = cx - wx * z;
    state.panY = cy - wy * z;
    updateTransform(true);
  }
  $('btnZoomIn').addEventListener('click', () => setZoom(state.zoom * 1.2));
  $('btnZoomOut').addEventListener('click', () => setZoom(state.zoom / 1.2));
  $('zoomDisplay').addEventListener('click', () => { state.zoom = 1; state.panX = 0; state.panY = 0; updateTransform(true); });
  $('btnFit').addEventListener('click', fitToView);

  function fitToView() {
    if (state.nodes.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 200);
      maxY = Math.max(maxY, n.y + 120);
    });
    const w = maxX - minX, h = maxY - minY;
    const rect = canvas.getBoundingClientRect();
    const pad = 80;
    const z = Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h, 1.4);
    state.zoom = z;
    state.panX = pad - minX * z + ((rect.width - pad * 2) - w * z) / 2;
    state.panY = pad - minY * z + ((rect.height - pad * 2) - h * z) / 2;
    updateTransform(true);
  }

  // Wheel: zoom on cmd/ctrl, pan otherwise
  canvas.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const delta = -e.deltaY * 0.0025;
      setZoom(state.zoom * (1 + delta), e.clientX - rect.left, e.clientY - rect.top);
    } else {
      e.preventDefault();
      state.panX -= e.deltaX;
      state.panY -= e.deltaY;
      updateTransform();
    }
  }, { passive: false });

  // Mouse pan (middle button or empty space drag)
  canvas.addEventListener('mousedown', (e) => {
    if (e.target === canvas || e.target === grid || e.target === stage) {
      if (e.button === 0 || e.button === 1) {
        if (state.draggingNode) return;
        state.isPanning = true;
        state.panStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
        canvas.classList.add('panning');
        deselect();
      }
    }
  });

  function getClientX(e) { return e.clientX ?? e.touches?.[0]?.clientX ?? 0; }
  function getClientY(e) { return e.clientY ?? e.touches?.[0]?.clientY ?? 0; }

  function handlePointerMove(e) {
    const cx = getClientX(e);
    const cy = getClientY(e);
    if (state.isPanning) {
      state.panX = cx - state.panStart.x;
      state.panY = cy - state.panStart.y;
      updateTransform();
    } else if (state.draggingNode) {
      const dx = (cx - state.dragStart.x) / state.zoom;
      const dy = (cy - state.dragStart.y) / state.zoom;
      const n = state.draggingNode;
      n.x = state.dragStart.nx + dx;
      n.y = state.dragStart.ny + dy;
      const el = document.querySelector(`[data-node-id="${n.id}"]`);
      if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
      scheduleRedrawEdges();
      state.isDirty = true;
    }
    if (state.portDrag) {
      const drag = state.portDrag;
      const dx = cx - drag.startX;
      const dy = cy - drag.startY;
      if (!drag.mode) {
        if (Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx) * 0.85) {
          drag.mode = 'slide';
          canvas.classList.add('sliding-port');
          drag.portEl.classList.add('sliding');
        } else if (Math.hypot(dx, dy) > 8) {
          drag.mode = 'wire';
          beginPortRewire(drag.node, drag.portEl, drag.direction);
          state.portDrag = null;
        }
      }
      if (drag.mode === 'slide') {
        const y = clampPortYAlongEdge(
          drag.node.id,
          drag.portName,
          portYFromPointer(drag.portEl, cy),
          drag.direction);
        drag.portEl.style.setProperty('--port-y', y);
        drag.pendingY = y;
        scheduleRedrawEdges();
      }
    }
    if (state.connecting) {
      drawConnectionPreview(e);
      highlightConnectionTarget(e);
    }
  }

  function handlePointerUp(e) {
    if (state.isPanning) {
      state.isPanning = false;
      canvas.classList.remove('panning');
      updateTransform(true);
      renderMinimap();
    }
    if (state.draggingNode) {
      const dragged = state.draggingNode;
      const moved = dragged.x !== state.dragStart.nx || dragged.y !== state.dragStart.ny;
      const draggedEl = document.querySelector(`[data-node-id="${dragged.id}"]`);
      if (draggedEl) draggedEl.classList.remove('is-dragging');
      state.draggingNode = null;
      renderMinimap();
      if (requireApi() && moved) {
        apiBridge
          .invokeMethodAsync('UpdateNodeAsync', String(dragged.id), dragged.x, dragged.y, null)
          .then((json) => {
            const dto = parseWorkflowDto(json);
            if (dto.error) {
              toast(dto.error, 'error');
              return;
            }
            mergeGraphFromServer(json);
            state.isDirty = false;
            pushHistory();
          })
          .catch((e) => toast(e.message, 'error'));
      }
    }
    if (state.portDrag) {
      if (state.portDrag.mode === 'slide') {
        const drag = state.portDrag;
        if (drag.pendingY != null) {
          setPortAnchorY(drag.node.id, drag.portName, drag.pendingY);
        }
        drag.portEl.classList.remove('sliding');
      }
      state.portDrag = null;
      canvas.classList.remove('sliding-port');
    }
    if (state.connecting) {
      if (!tryFinishConnection(e)) cancelConnection();
    }
  }

  document.addEventListener('mousemove', handlePointerMove);
  document.addEventListener('mouseup', handlePointerUp);

  /* ---------- Drop nodes from library ---------- */
  let dropCounter = 0;
  function handleCanvasDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function handleCanvasDrop(e) {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    if (!type || !NODE_TYPES[type]) {
      console.warn('LOOM: drop ignored - type:', type, 'known types:', Object.keys(NODE_TYPES));
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.panX) / state.zoom - 90;
    const y = (e.clientY - rect.top - state.panY) / state.zoom - 40;
    dropCounter++;
    addNode(type, x, y);
  }
  canvas.addEventListener('dragover', handleCanvasDragOver);
  canvas.addEventListener('drop', handleCanvasDrop);

  /* ---------- Node CRUD (backend authoritative) ---------- */
  async function addNode(type, x, y, options = {}) {
    if (!requireApi()) return null;
    try {
      const json = await apiBridge.invokeMethodAsync('AddNodeAsync', type, x, y);
      const ok = await applyGraphFromServer(json);
      if (!ok) return null;
      if (!options.skipHistory) pushHistory();
      toast(`Added ${type}`, 'success');
      const last = [...state.nodes.values()].pop();
      return last ?? null;
    } catch (e) {
      toast(e.message || 'Failed to add node', 'error');
      return null;
    }
  }
  function portOffsetY(index, count) {
    if (count <= 1) return 50;
    return ((index + 1) / (count + 1)) * 100;
  }

  function portAnchorKey(nodeId, portName) {
    return `${nodeId}:${portName}`;
  }

  function getPortAnchorY(nodeId, portName, fallbackY) {
    const stored = state.portAnchors.get(portAnchorKey(nodeId, portName));
    return stored != null ? stored : fallbackY;
  }

  function setPortAnchorY(nodeId, portName, y) {
    state.portAnchors.set(portAnchorKey(nodeId, portName), y);
    savePortAnchors();
  }

  function savePortAnchors() {
    if (!sessionId) return;
    try {
      localStorage.setItem(
        `loom-port-anchors-${sessionId}`,
        JSON.stringify([...state.portAnchors.entries()]));
    } catch { /* ignore quota */ }
  }

  function loadPortAnchors() {
    if (!sessionId) return;
    try {
      const raw = localStorage.getItem(`loom-port-anchors-${sessionId}`);
      if (!raw) return;
      JSON.parse(raw).forEach(([k, v]) => state.portAnchors.set(k, Number(v)));
    } catch { /* ignore */ }
  }

  function clampPortYAlongEdge(nodeId, portName, y, direction) {
    const node = state.nodes.get(String(nodeId));
    const def = node ? NODE_TYPES[node.type] : null;
    const ports = direction === 'in' ? (def?.inputs ?? []) : (def?.outputs ?? []);
    let clamped = Math.max(12, Math.min(88, y));
    const minGap = 15;
    ports.forEach((p, i) => {
      if (p.name === portName) return;
      const otherY = getPortAnchorY(nodeId, p.name, portOffsetY(i, ports.length));
      if (Math.abs(clamped - otherY) < minGap) {
        clamped = clamped >= otherY ? otherY + minGap : otherY - minGap;
      }
    });
    return Math.max(12, Math.min(88, clamped));
  }

  function applyPortAnchorsForNode(nodeId) {
    const id = String(nodeId);
    state.portAnchors.forEach((y, key) => {
      if (!key.startsWith(`${id}:`)) return;
      const portName = key.slice(id.length + 1);
      const el = findPortEl(id, 'in', portName) || findPortEl(id, 'out', portName);
      if (el) el.style.setProperty('--port-y', y);
    });
  }

  function portYFromPointer(portEl, clientY) {
    const core = portEl.closest('.node-core');
    if (!core) return 50;
    const rect = core.getBoundingClientRect();
    return ((clientY - rect.top) / rect.height) * 100;
  }

  function renderPortList(nodeId, ports, cls, nodeType) {
    if (!ports?.length) return '';
    const side = cls === 'port-in' ? 'in' : 'out';
    const count = ports.length;
    return `<div class="port-rail port-rail-${side}">${ports.map((p, i) => {
      const defaultY = portOffsetY(i, count);
      const y = getPortAnchorY(nodeId, p.name, defaultY);
      return `
      <div class="port ${cls}" data-port="${p.name}" style="--port-y:${y}"
        title="${p.name} (${p.dataType})">
        <span class="port-label-tag">${p.name}</span>
      </div>`;
    }).join('')}</div>`;
  }

  function beginPortRewire(node, portEl, direction) {
    const portName = portEl.dataset.port;
    if (direction === 'out') {
      const existing = findEdgeFromPort(node.id, portName);
      startConnection(node, portName, existing?.id);
      return;
    }
    const existing = findEdgeToPort(node.id, portName);
    if (existing) {
      const fromNode = state.nodes.get(existing.from);
      if (fromNode) startConnection(fromNode, existing.fromPort, existing.id);
    }
  }

  function bindPortInteractions(node, el) {
    el.querySelectorAll('.port').forEach((port) => {
      const direction = port.classList.contains('port-in') ? 'in' : 'out';

      port.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || state.connecting) return;
        e.stopPropagation();
        e.preventDefault();

        const connected = port.classList.contains('connected');

        if (e.shiftKey) {
          beginPortRewire(node, port, direction);
          return;
        }

        if (connected) {
          state.portDrag = {
            node,
            portEl: port,
            portName: port.dataset.port,
            direction,
            startX: e.clientX,
            startY: e.clientY,
            mode: null,
          };
          return;
        }

        if (direction === 'out') {
          startConnection(node, port.dataset.port);
          return;
        }

        const existingIn = findEdgeToPort(node.id, port.dataset.port);
        startReverseConnection(node, port.dataset.port, existingIn?.id);
      });

      port.addEventListener('mouseup', (e) => {
        if (!state.connecting) return;
        e.stopPropagation();
        if (state.connecting.reverse && direction === 'out') {
          completeWire(state.connecting.toNode, state.connecting.toPort, node, port.dataset.port);
        } else if (!state.connecting.reverse && direction === 'in') {
          completeWire(node, port.dataset.port, state.connecting.fromNode, state.connecting.fromPort);
        }
      });

      port.addEventListener('mouseenter', () => {
        if (!state.connecting) return;
        const wantIn = !state.connecting.reverse;
        if ((wantIn && direction === 'in') || (!wantIn && direction === 'out')) {
          port.classList.add('targetable');
        }
      });
      port.addEventListener('mouseleave', () => port.classList.remove('targetable'));
    });
  }

  const COMPARE_TYPES = new Set([
    'Compare', 'Equal', 'CompareEq', 'CompareNe', 'CompareGt', 'CompareGte', 'CompareLt', 'CompareLte',
  ]);

  function nodeDisplayName(node, def) {
    if (node.type === 'Result' && node.fields?.label) return String(node.fields.label);
    if (COMPARE_TYPES.has(node.type)) {
      const pred = node.fields?.predicate
        || { CompareEq: '==', Equal: '==', CompareNe: '!=', CompareGt: '>', CompareGte: '>=', CompareLt: '<', CompareLte: '<=' }[node.type]
        || '==';
      return `Compare (${pred})`;
    }
    if (node.type === 'MathOp' || node.type === 'MathN') {
      return node.fields?.op || 'Add';
    }
    if (node.type === 'StringOp') {
      return `String op (${node.fields?.op || 'ToUpper'})`;
    }
    if (node.type === 'StringTransform') {
      return `String (${node.fields?.op || 'Concat'})`;
    }
    if (node.type === 'UnaryMath') {
      return node.fields?.op || 'Sqrt';
    }
    if (node.type === 'CustomScript') return 'Custom script';
    if (API_NODE_TYPES.has(node.type)) return NODE_DISPLAY_NAMES[node.type] || node.type;
    return NODE_DISPLAY_NAMES[node.type] || node.type;
  }

  function formatScriptPreview(script) {
    if (!script) return '—';
    const oneLine = script.replace(/\s+/g, ' ').trim();
    return oneLine.length > 42 ? `${oneLine.slice(0, 42)}…` : oneLine;
  }

  function visibleApiPorts(nodeType, ports, direction) {
    if (!API_NODE_TYPES.has(nodeType)) return ports;
    if (direction === 'out') {
      const primary = ports.find((p) => p.name === 'Result');
      return primary ? [primary] : ports.slice(0, 1);
    }
    if (nodeType === 'ApiWeather') {
      return ports.filter((p) => p.name === 'Latitude' || p.name === 'Longitude');
    }
    return [];
  }

  function apiPreviewText(node) {
    if (node.errorMessage) return { text: String(node.errorMessage), mode: 'error' };
    if (node.result != null && node.result !== '') return { text: String(node.result), mode: 'ok' };
    return { text: 'Run to fetch live data…', mode: 'idle' };
  }

  function renderApiFieldControl(node, f) {
    const v = node.fields[f.key] ?? f.default ?? '';
    const opts = API_FIELD_SELECTS[f.key];
    if (opts) {
      return `<select class="api-field-input" data-api-field="${f.key}" title="${escapeHtml(f.label)}">
        ${opts.map((o) => `<option value="${o.value}"${o.value === v ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
      </select>`;
    }
    return `<input type="text" class="api-field-input" data-api-field="${f.key}" value="${escapeHtml(v)}" placeholder="${escapeHtml(f.label)}" />`;
  }

  function renderApiNodeBody(node, def) {
    const preview = apiPreviewText(node);
    const fieldsHtml = (def.fields || []).map((f) => `
      <div class="api-config-row">
        <label>${escapeHtml(f.label)}</label>
        ${renderApiFieldControl(node, f)}
      </div>`).join('');
    return `
      ${fieldsHtml}
      <div class="api-output-sink ${preview.mode}">${escapeHtml(preview.text)}</div>
      <div class="api-hint">Connect <strong>Result</strong> → Answer</div>`;
  }

  function bindApiFieldControls(node, el) {
    let timer = null;
    el.querySelectorAll('[data-api-field]').forEach((control) => {
      const sync = () => {
        node.fields[control.dataset.apiField] = control.value;
        const preview = el.querySelector('.api-output-sink');
        if (preview && !node.result) {
          preview.textContent = 'Run to fetch live data…';
          preview.className = 'api-output-sink idle';
        }
        clearTimeout(timer);
        timer = setTimeout(async () => {
          if (!requireApi()) return;
          try {
            const json = await apiBridge.invokeMethodAsync(
              'UpdateNodeAsync', String(node.id), node.x, node.y, JSON.stringify(node.fields));
            mergeGraphFromServer(json);
          } catch (err) {
            toast(err.message || 'Update failed', 'error');
          }
        }, 450);
      };
      control.addEventListener('input', sync);
      control.addEventListener('change', sync);
    });
  }

  function renderNode(node) {
    const def = NODE_TYPES[node.type] || { color: 'logic', fields: [], inputs: [], outputs: [] };
    const inputs = visibleApiPorts(node.type, def.inputs ?? [], 'in');
    const outputs = visibleApiPorts(node.type, def.outputs ?? [], 'out');
    const isOutput = def.color === 'output' || node.type === 'Result';
    const isScript = node.type === 'CustomScript';
    const isApi = API_NODE_TYPES.has(node.type) || def.color === 'api';
    const displayName = nodeDisplayName(node, def);
    const el = document.createElement('div');
    el.className = `node ${def.color}${isScript ? ' script-node' : ''}${isApi ? ' api-node' : ''}`;
    el.dataset.nodeId = String(node.id);
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    el.innerHTML = `
      <div class="node-core">
        ${renderPortList(node.id, inputs, 'port-in', node.type)}
        <div class="node-head">
          <span class="badge"></span>
          <span class="name">${escapeHtml(displayName)}</span>
          <span class="status">idle</span>
        </div>
        <div class="node-body">
          ${isOutput ? '' : isScript ? `
            <div class="node-field">
              <span class="node-field-label">Script</span>
              <span class="node-value node-value-script" data-key="script">${escapeHtml(formatScriptPreview(node.fields.script ?? def.fields?.[0]?.default ?? ''))}</span>
            </div>` : isApi ? renderApiNodeBody(node, def) : (def.fields || []).map(f => `
            <div class="node-field">
              <span class="node-field-label">${f.label}</span>
              <span class="node-value" data-key="${f.key}">${escapeHtml(node.fields[f.key] ?? f.default ?? '')}</span>
            </div>
          `).join('')}
          ${isOutput ? `
            <div class="node-value-sink">${node.result != null && node.result !== ''
              ? escapeHtml(node.result) : 'Waiting for input…'}</div>
          ` : ''}
          ${!isOutput && !isApi && node.result ? `<div class="node-result">→ ${escapeHtml(node.result)}</div>` : ''}
        </div>
        ${renderPortList(node.id, outputs, 'port-out', node.type)}
      </div>
    `;
    bindPortInteractions(node, el);
    if (isApi) bindApiFieldControls(node, el);
    // node drag
    function startNodeDrag(e) {
      if (state.isPanning) return;
      const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      if (!clientX && !clientY) return;
      if (e.target.closest('.port')) return;
      if (e.button !== 0 && e.button !== undefined) return;
      e.stopPropagation();
      e.preventDefault();
      state.draggingNode = node;
      state.dragStart = { x: clientX, y: clientY, nx: node.x, ny: node.y };
      el.classList.add('is-dragging');
      select(node);
    }
    el.addEventListener('mousedown', startNodeDrag);
    el.addEventListener('click', (e) => {
      if (e.target.closest('.port')) return;
      e.stopPropagation();
      select(node);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Duplicate', kbd: '⌘D', fn: () => duplicateNode(node) },
        { label: 'Delete', kbd: 'Del', danger: true, fn: () => deleteNode(node.id) },
      ]);
    });
    stage.appendChild(el);
    if (emptyState) emptyState.classList.add('hidden');
  }
  async function deleteNode(id) {
    if (!requireApi()) return;
    try {
      const json = await apiBridge.invokeMethodAsync('DeleteNodeAsync', String(id));
      await applyGraphFromServer(json);
      pushHistory();
      toast('Node deleted', 'info');
    } catch (e) {
      toast(e.message || 'Delete failed', 'error');
    }
  }
  async function duplicateNode(node) {
    const created = await addNode(node.type, node.x + 40, node.y + 40, { skipHistory: true });
    if (!created || !requireApi()) return;
    try {
      const fieldsJson = JSON.stringify(node.fields);
      const json = await apiBridge.invokeMethodAsync('UpdateNodeAsync', String(created.id), created.x, created.y, fieldsJson);
      await applyGraphFromServer(json);
      pushHistory();
    } catch (e) {
      toast(e.message || 'Duplicate failed', 'error');
    }
  }
  function rerenderNode(node) {
    const old = document.querySelector(`[data-node-id="${node.id}"]`);
    if (old) old.remove();
    renderNode(node);
  }

  function select(node) {
    deselect();
    state.selectedNode = node;
    const el = document.querySelector(`[data-node-id="${node.id}"]`);
    if (el) el.classList.add('selected');
    renderInspector();
  }
  function deselect() {
    if (state.selectedNode) {
      const el = document.querySelector(`[data-node-id="${state.selectedNode.id}"]`);
      if (el) el.classList.remove('selected');
    }
    state.selectedNode = null;
    state.selectedEdge = null;
    document.querySelectorAll('.edge-group.selected').forEach((g) => g.classList.remove('selected'));
    renderInspector();
  }
  canvas.addEventListener('click', (e) => {
    if (e.target === canvas || e.target === grid || e.target === stage) deselect();
  });

  /* ---------- Connections (edges) ---------- */
  function findEdgeToPort(nodeId, portName) {
    for (const edge of state.edges.values()) {
      if (String(edge.to) === String(nodeId) && edge.toPort === portName) return edge;
    }
    return null;
  }

  function findEdgeFromPort(nodeId, portName) {
    for (const edge of state.edges.values()) {
      if (String(edge.from) === String(nodeId) && edge.fromPort === portName) return edge;
    }
    return null;
  }

  function startConnection(fromNode, portName, replaceEdgeId = null) {
    if (!portName || !fromNode) return;
    state.connecting = { fromNode, fromPort: portName, replaceEdgeId, reverse: false };
    canvas.classList.add('connecting');
  }

  function startReverseConnection(toNode, portName, replaceEdgeId = null) {
    if (!portName || !toNode) return;
    state.connecting = { toNode, toPort: portName, replaceEdgeId, reverse: true };
    canvas.classList.add('connecting');
  }

  function cancelConnection() {
    const prev = svg.querySelector('.edge-preview');
    if (prev) prev.remove();
    state.connecting = null;
    canvas.classList.remove('connecting');
    document.querySelectorAll('.port.targetable').forEach((p) => p.classList.remove('targetable'));
  }

  function findNearestPort(clientX, clientY, direction, maxDist = 52) {
    const cls = direction === 'in' ? 'port-in' : 'port-out';
    let best = null;
    let bestDist = maxDist;
    document.querySelectorAll(`.${cls}`).forEach((port) => {
      const rect = port.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const d = Math.hypot(clientX - cx, clientY - cy);
      if (d < bestDist) {
        bestDist = d;
        best = port;
      }
    });
    return best;
  }

  function highlightConnectionTarget(e) {
    document.querySelectorAll('.port.targetable').forEach((p) => p.classList.remove('targetable'));
    const wantIn = !state.connecting?.reverse;
    const cls = wantIn ? '.port-in' : '.port-out';
    let hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(cls);
    if (!hit) hit = findNearestPort(e.clientX, e.clientY, wantIn ? 'in' : 'out');
    if (hit) hit.classList.add('targetable');
  }

  function tryFinishConnection(e) {
    if (!state.connecting) return false;
    if (state.connecting.reverse) {
      let fromPortEl = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.port-out');
      if (!fromPortEl) fromPortEl = findNearestPort(e.clientX, e.clientY, 'out');
      if (!fromPortEl) return false;
      const nodeEl = fromPortEl.closest('[data-node-id]');
      const fromNode = nodeEl ? state.nodes.get(nodeEl.dataset.nodeId) : null;
      if (!fromNode) return false;
      completeWire(state.connecting.toNode, state.connecting.toPort, fromNode, fromPortEl.dataset.port);
      return true;
    }
    let toPortEl = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.port-in');
    if (!toPortEl) toPortEl = findNearestPort(e.clientX, e.clientY, 'in');
    if (!toPortEl) return false;
    const nodeEl = toPortEl.closest('[data-node-id]');
    const toNode = nodeEl ? state.nodes.get(nodeEl.dataset.nodeId) : null;
    if (!toNode) return false;
    completeWire(toNode, toPortEl.dataset.port, state.connecting.fromNode, state.connecting.fromPort);
    return true;
  }

  async function completeWire(toNode, toPort, fromNode, fromPort) {
    if (!toNode || !fromNode) { cancelConnection(); return; }
    if (API_NODE_TYPES.has(fromNode.type) && !fromPort) fromPort = 'Result';
    if (toNode.type === 'Result' && !toPort) toPort = 'Value';
    if (!fromPort || !toPort) { cancelConnection(); return; }
    if (toNode.id === fromNode.id) { toast('Cannot connect to self', 'error'); cancelConnection(); return; }
    const fromDef = NODE_TYPES[fromNode.type];
    const toDef = NODE_TYPES[toNode.type];
    const fromPortExists = fromDef?.outputs?.some(p => p.name === fromPort);
    const toPortExists = toDef?.inputs?.some(p => p.name === toPort);
    if (!fromPortExists) { toast(`Node "${fromNode.type}" has no output port "${fromPort}"`, 'error'); cancelConnection(); return; }
    if (!toPortExists) { toast(`Node "${toNode.type}" has no input port "${toPort}"`, 'error'); cancelConnection(); return; }
    const fromType = fromDef?.outputs?.find(p => p.name === fromPort)?.dataType;
    const toType = toDef?.inputs?.find(p => p.name === toPort)?.dataType;
    if (fromType && toType && fromType !== 'object' && toType !== 'object' && fromType !== toType) {
      toast(`Type mismatch: "${fromType}" → "${toType}"`, 'error'); cancelConnection(); return;
    }
    const fromId = fromNode.id;
    const toId = toNode.id;
    const replaceEdgeId =
      state.connecting?.replaceEdgeId || findEdgeToPort(toId, toPort)?.id;
    cancelConnection();
    if (!requireApi()) return;
    try {
      if (replaceEdgeId) {
        const disconnectJson = await apiBridge.invokeMethodAsync(
          'DisconnectEdgeAsync', String(replaceEdgeId));
        await applyGraphFromServer(disconnectJson);
      }
      const json = await apiBridge.invokeMethodAsync(
        'ConnectNodesAsync', String(fromId), String(toId), fromPort, toPort);
      const dto = parseWorkflowDto(json);
      if (dto.error) {
        toast(dto.error, 'error');
        return;
      }
      await applyGraphFromServer(json);
      pushHistory();
    } catch (e) {
      toast(e.message || 'Connection failed', 'error');
    }
  }
  function drawConnectionPreview(e) {
    if (!state.connecting) return;
    const rect = canvas.getBoundingClientRect();
    const cursor = {
      x: (e.clientX - rect.left - state.panX) / state.zoom,
      y: (e.clientY - rect.top - state.panY) / state.zoom,
    };
    let a;
    let b;
    if (state.connecting.reverse) {
      const toPort = findPortEl(state.connecting.toNode.id, 'in', state.connecting.toPort);
      if (!toPort) return;
      a = portCenter(toPort);
      b = cursor;
    } else {
      const fromPort = findPortEl(
        state.connecting.fromNode.id, 'out', state.connecting.fromPort);
      if (!fromPort) return;
      a = portCenter(fromPort);
      b = cursor;
    }
    let preview = svg.querySelector('.edge-preview');
    if (!preview) {
      preview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      preview.setAttribute('class', 'edge-preview');
      svg.appendChild(preview);
    }
    preview.setAttribute('d', bezierPath(a, b));
  }
  function portCenter(portEl) {
    if (!portEl) return null;
    const rect = portEl.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2 - canvasRect.left - state.panX) / state.zoom,
      y: (rect.top + rect.height / 2 - canvasRect.top - state.panY) / state.zoom,
    };
  }

  function findPortEl(nodeId, direction, portName) {
    if (!nodeId) return null;
    const root = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!root) return null;
    const cls = direction === 'out' ? 'port-out' : 'port-in';
    if (portName) {
      let el = root.querySelector(`.${cls}[data-port="${portName}"]`);
      if (!el) {
        el = [...root.querySelectorAll(`.${cls}`)].find(
          (p) => p.dataset.port?.toLowerCase() === String(portName).toLowerCase());
      }
      if (el) return el;
    }
    return root.querySelector(`.${cls}`);
  }

  function nodeSideAnchor(nodeId, side) {
    if (!nodeId) return null;
    const core = document.querySelector(`[data-node-id="${nodeId}"] .node-core`);
    if (!core) return null;
    const rect = core.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const y = rect.top + rect.height * 0.5;
    const x = side === 'out' ? rect.right : rect.left;
    return {
      x: (x - canvasRect.left - state.panX) / state.zoom,
      y: (y - canvasRect.top - state.panY) / state.zoom,
    };
  }

  function resolveEdgePorts(edge) {
    if (!edge) return { fromPort: null, toPort: null };
    const fromNode = state.nodes.get(edge.from);
    const toNode = state.nodes.get(edge.to);
    if (!fromNode || !toNode) return { fromPort: null, toPort: null };
    const fromDef = NODE_TYPES[fromNode.type] || null;
    const toDef = NODE_TYPES[toNode.type] || null;
    let fromPort = edge.fromPort;
    let toPort = edge.toPort;
    if (!fromPort && fromDef?.outputs?.length) fromPort = fromDef.outputs[0].name;
    if (!toPort && toDef?.inputs?.length) toPort = toDef.inputs[0].name;
    return { fromPort, toPort };
  }
  function bezierPath(a, b) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = Math.max(48, Math.min(dist * 0.42, 160));
    return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${(a.x + dx).toFixed(1)} ${a.y.toFixed(1)}, ${(b.x - dx).toFixed(1)} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  function createEdgeGroup(edgeId) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'edge-group');
    g.dataset.edgeId = edgeId;

    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hit.setAttribute('class', 'edge-hit');

    const base = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    base.setAttribute('class', 'edge-path');

    const flow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    flow.setAttribute('class', 'edge-flow');

    g.appendChild(hit);
    g.appendChild(base);
    g.appendChild(flow);

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      selectEdge(edgeId);
    });
    g.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectEdge(edgeId);
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Disconnect wire', kbd: 'Del', danger: true, fn: () => disconnectEdge(edgeId) },
      ]);
    });

    svg.appendChild(g);
    return { g, hit, base, flow };
  }

  function redrawEdges() {
    const active = new Set();
    state.edges.forEach((edge) => {
      const { fromPort, toPort } = resolveEdgePorts(edge);
      if (!fromPort || !toPort) return;
      const fromEl = findPortEl(edge.from, 'out', fromPort);
      const toEl = findPortEl(edge.to, 'in', toPort);
      const a = fromEl ? portCenter(fromEl) : nodeSideAnchor(edge.from, 'out');
      const b = toEl ? portCenter(toEl) : nodeSideAnchor(edge.to, 'in');
      if (!a || !b) return;
      const d = bezierPath(a, b);
      const edgeKey = String(edge.id);
      active.add(edgeKey);

      let paths = edgePathCache.get(edgeKey);
      if (!paths) {
        paths = createEdgeGroup(edgeKey);
        edgePathCache.set(edgeKey, paths);
      }
      paths.hit.setAttribute('d', d);
      paths.base.setAttribute('d', d);
      paths.flow.setAttribute('d', d);
      if (String(state.selectedEdge) === edgeKey) {
        paths.g.classList.add('selected');
      } else {
        paths.g.classList.remove('selected');
      }
    });

    edgePathCache.forEach((paths, id) => {
      if (active.has(id)) return;
      paths.g.remove();
      edgePathCache.delete(id);
    });
  }

  function selectEdge(id) {
    deselect();
    const edgeKey = String(id);
    document.querySelectorAll('.edge-group.selected').forEach((g) => g.classList.remove('selected'));
    const paths = edgePathCache.get(edgeKey);
    if (paths) paths.g.classList.add('selected');
    state.selectedEdge = edgeKey;
  }

  async function disconnectEdge(edgeId, quiet = false) {
    if (!requireApi() || !edgeId) return;
    try {
      const json = await apiBridge.invokeMethodAsync('DisconnectEdgeAsync', String(edgeId));
      await applyGraphFromServer(json);
      pushHistory();
      state.selectedEdge = null;
      if (!quiet) toast('Connection removed', 'info');
    } catch (e) {
      toast(e.message || 'Disconnect failed', 'error');
    }
  }

  /* ---------- Inspector ---------- */
  function renderInspector() {
    const n = state.selectedNode;
    $('inspectorCount').textContent = n ? `#${n.id}` : '—';
    if (!n) {
      inspectorBody.innerHTML = `
        <div class="inspector-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          <h4>No node selected</h4>
          <p>Click a node on the canvas to view and edit its configuration.</p>
        </div>`;
      return;
    }
    const def = NODE_TYPES[n.type] || { fields: [] };
    inspectorBody.innerHTML = `
      <div class="field-group">
        <label class="field-group-label">Type</label>
        <input class="field-input" value="${n.type}" disabled />
      </div>
      ${(def.fields || []).map(f => {
        const v = n.fields[f.key] ?? f.default ?? '';
        if (f.key === 'op') {
          let ops;
          if (n.type === 'StringOp') {
            ops = ['ToUpper', 'ToLower', 'Trim', 'Length', 'Reverse'];
          } else if (n.type === 'StringTransform') {
            ops = ['Concat', 'Replace', 'Contains', 'StartsWith', 'EndsWith', 'IndexOf'];
          } else if (n.type === 'UnaryMath') {
            ops = ['Sqrt', 'Abs', 'Ceiling', 'Floor', 'Round', 'Log', 'Log10', 'Exp', 'Sin', 'Cos', 'Tan', 'Asin', 'Acos', 'Atan', 'Square', 'Cube'];
          } else {
            ops = ['Add', 'Subtract', 'Multiply', 'Divide'];
          }
          return `
          <div class="field-group">
            <label class="field-group-label">${f.label}</label>
            <select class="field-input" data-field="op">
              ${ops.map((o) => `<option value="${o}"${o === v ? ' selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>`;
        }
        if (f.key === 'script') {
          return `
          <div class="field-group field-group-script">
            <label class="field-group-label">${f.label}</label>
            <textarea class="field-input field-textarea" data-field="script" rows="8" spellcheck="false">${escapeHtml(v)}</textarea>
            <p class="field-hint">Use <code>inputs["A"]</code> and <code>inputs["B"]</code>. Return a <code>bool</code> for If, or a number for math.</p>
          </div>`;
        }
        if (API_FIELD_SELECTS[f.key]) {
          const opts = API_FIELD_SELECTS[f.key];
          return `
          <div class="field-group">
            <label class="field-group-label">${f.label}</label>
            <select class="field-input" data-field="${f.key}">
              ${opts.map((o) => `<option value="${o.value}"${o.value === v ? ' selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>`;
        }
        if (f.key === 'predicate') {
          const preds = [
            { value: '==', label: 'Equal (==)' },
            { value: '!=', label: 'Not equal (!=)' },
            { value: '>', label: 'Greater (>)' },
            { value: '>=', label: 'Greater or equal (>=)' },
            { value: '<', label: 'Less (<)' },
            { value: '<=', label: 'Less or equal (<=)' },
          ];
          return `
          <div class="field-group">
            <label class="field-group-label">${f.label}</label>
            <select class="field-input" data-field="predicate">
              ${preds.map((p) => `<option value="${p.value}"${p.value === v ? ' selected' : ''}>${p.label}</option>`).join('')}
            </select>
          </div>`;
        }
        const isNumber = n.type === 'NumberInput' && f.key === 'value';
        return `
          <div class="field-group">
            <label class="field-group-label">${f.label}</label>
            <input class="field-input" data-field="${f.key}" type="${isNumber ? 'number' : 'text'}" step="${isNumber ? 'any' : ''}" value="${escapeHtml(v)}" />
          </div>`;
      }).join('')}
      ${n.result ? `
        <div class="inspector-result">
          <div class="inspector-result-label">Last Output</div>
          <div class="inspector-result-value">${escapeHtml(n.result)}</div>
        </div>` : ''}
      <div class="field-meta">
        <div class="meta-item"><span>Position</span><span>${Math.round(n.x)}, ${Math.round(n.y)}</span></div>
        <div class="meta-item"><span>Status</span><span>${n.executed ? 'executed' : 'idle'}</span></div>
      </div>
      <button class="delete-btn" id="inspDelete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1-3h10l1 3"/><path d="M7 7v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7"/></svg>
        Delete node
      </button>
    `;
    // wire field changes
    let fieldTimer = null;
    inspectorBody.querySelectorAll('[data-field]').forEach(el => {
      const sync = () => {
        n.fields[el.dataset.field] = el.value;
        patchNodeDom(n);
        const newEl = document.querySelector(`[data-node-id="${n.id}"]`);
        if (newEl) newEl.classList.add('selected');
        state.isDirty = true;
        clearTimeout(fieldTimer);
        fieldTimer = setTimeout(async () => {
          if (!requireApi()) return;
          try {
            const json = await apiBridge.invokeMethodAsync(
              'UpdateNodeAsync', String(n.id), n.x, n.y, JSON.stringify(n.fields));
            mergeGraphFromServer(json);
            state.isDirty = false;
            pushHistory();
          } catch (err) {
            toast(err.message || 'Update failed', 'error');
          }
        }, 500);
      };
      el.addEventListener('input', sync);
      el.addEventListener('change', sync);
    });
    const del = $('inspDelete');
    if (del) del.addEventListener('click', () => deleteNode(n.id));
  }

  /* ---------- Run / execute (backend only) ---------- */
  $('btnRun').addEventListener('click', runWorkflow);

  async function runWorkflow() {
    if (!requireApi()) return;
    if (state.isRunning || state.nodes.size === 0) return;
    state.isRunning = true;
    const btn = $('btnRun');
    btn.classList.add('running');
    btn.querySelector('.run-label').textContent = 'Running...';
    document.querySelectorAll('.node.executing, .node.executed').forEach((el) => {
      el.classList.remove('executing', 'executed');
    });

    try {
      const syncJson = await apiBridge.invokeMethodAsync(
        'ReplaceWorkflowJsonAsync',
        JSON.stringify(buildWorkflowDto()));
      if (!mergeGraphFromServer(syncJson)) return;

      const responseJson = await apiBridge.invokeMethodAsync('ExecuteWorkflowAsync');
      const response = JSON.parse(responseJson);
      const success = response.success ?? response.Success;
      await animateExecutionFlow();
      const wfPayload = response.workflow ?? response.Workflow;
      if (wfPayload) mergeGraphFromServer(wfPayload);
      else markConnectedPorts();
      const elapsed = response.elapsedMs ?? response.ElapsedMs ?? 0;
      $('statRuntime').querySelector('.value').textContent = elapsed + 'ms';

      const results = response.results ?? response.Results ?? [];
      const failed = results.filter((r) =>
        String(r.status ?? r.Status).toLowerCase() === 'error');
      if (!success) {
        const firstErr = failed[0]?.errorMessage ?? failed[0]?.ErrorMessage
          ?? response.error ?? response.Error ?? 'Workflow execution failed';
        toast(firstErr, 'error');
        return;
      }
      toast(`Workflow completed in ${elapsed}ms`, 'success');
    } catch (e) {
      toast(e.message || 'Execution error', 'error');
    } finally {
      document.querySelectorAll('.node.executing').forEach((el) => el.classList.remove('executing'));
      btn.classList.remove('running');
      btn.querySelector('.run-label').textContent = 'Run';
      state.isRunning = false;
    }
  }

  function topoSort() {
    const inDeg = new Map();
    state.nodes.forEach((_, id) => inDeg.set(id, 0));
    state.edges.forEach(e => inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1));
    const queue = [];
    inDeg.forEach((d, id) => { if (d === 0) queue.push(id); });
    const order = [];
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      state.edges.forEach(e => {
        if (e.from === id) {
          const d = inDeg.get(e.to) - 1;
          inDeg.set(e.to, d);
          if (d === 0) queue.push(e.to);
        }
      });
    }
    return order.length === state.nodes.size ? order : null;
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function animateExecutionFlow() {
    const order = topoSort();
    if (!order?.length) return;
    document.querySelectorAll('.node.executing, .node.executed').forEach((el) => {
      el.classList.remove('executing', 'executed');
    });
    for (const nodeId of order) {
      if (!state.nodes.has(nodeId)) continue;
      const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
      if (nodeEl) {
        nodeEl.classList.add('executing');
        const status = nodeEl.querySelector('.node-head .status');
        if (status) status.textContent = 'running';
      }
      state.edges.forEach((edge) => {
        if (String(edge.from) !== String(nodeId)) return;
        const paths = edgePathCache.get(String(edge.id));
        if (!paths?.flow) return;
        paths.flow.classList.add('executing');
      });
      await sleep(380);
      if (nodeEl) {
        nodeEl.classList.remove('executing');
        nodeEl.classList.add('executed');
        const status = nodeEl.querySelector('.node-head .status');
        if (status) status.textContent = 'done';
      }
      state.edges.forEach((edge) => {
        if (String(edge.from) !== String(nodeId)) return;
        const paths = edgePathCache.get(String(edge.id));
        if (paths?.flow) paths.flow.classList.remove('executing');
      });
    }
  }

  /* ---------- Modal save/load ---------- */
  const modalOverlay = $('modalOverlay');
  const modalDialog = $('modalDialog');
  const modalTitle = $('modalTitle');
  const modalBody = $('modalBody');
  const modalFooter = $('modalFooter');
  const modalClose = $('modalClose');

  function hideModal() {
    if (modalOverlay) modalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  let modalResolve = null;

  function showModal(title, bodyHtml, footerHtml) {
    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) modalBody.innerHTML = bodyHtml;
    if (modalFooter) modalFooter.innerHTML = footerHtml || '';
    if (modalOverlay) modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    if (modalClose) {
      modalClose.onclick = () => { hideModal(); if (modalResolve) modalResolve(null); };
    }
    return new Promise((resolve) => { modalResolve = resolve; });
  }

  modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) { hideModal(); if (modalResolve) modalResolve(null); }
  });

  async function listWorkflows() {
    if (!requireApi()) return [];
    try {
      const json = await apiBridge.invokeMethodAsync('ListSavedWorkflowsJsonAsync');
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('LOOM: could not list saved workflows', e);
      return [];
    }
  }

  async function doLoadWorkflow(path) {
    if (!requireApi()) return;
    if (state.isDirty && !confirm('Discard unsaved changes and open this workflow?')) return;
    hideModal();
    try {
      const json = await apiBridge.invokeMethodAsync('LoadWorkflowFromPathAsync', path);
      const dto = parseWorkflowDto(json);
      if (dto.error) { toast(dto.error, 'error'); return; }
      await applyGraphFromServer(json);
      const fileName = String(path).split(/[/\\]/).pop();
      if (fileName) setWorkflowFileName(fileName);
      state.isDirty = false;
      $('fileName')?.classList.remove('unsaved');
      resetHistory();
      fitToView();
      redrawEdges();
      toast('Workflow opened', 'success');
    } catch (e) {
      toast(e.message || 'Could not open workflow', 'error');
    }
  }

  async function doDeleteWorkflow(path, fileName) {
    if (!requireApi()) return;
    if (!confirm(`Delete saved workflow "${fileName}"? This cannot be undone.`)) return;
    try {
      const resultJson = await apiBridge.invokeMethodAsync('DeleteSavedWorkflowAsync', path);
      const result = JSON.parse(resultJson);
      if (!result.deleted) { toast(result.error || 'Delete failed', 'error'); return; }
      if (getWorkflowFileName() === fileName) {
        toast(`Deleted ${fileName} (canvas unchanged)`, 'info');
      } else {
        toast(`Deleted ${fileName}`, 'success');
      }
      hideModal();
      showLoadModal();
    } catch (e) {
      toast(e.message || 'Delete failed', 'error');
    }
  }

  async function doActualSave(name) {
    if (!requireApi()) return;
    const path = name.endsWith('.loom') ? name : name + '.loom';
    try {
      const syncJson = await apiBridge.invokeMethodAsync(
        'ReplaceWorkflowJsonAsync',
        JSON.stringify(buildWorkflowDto()));
      if (!mergeGraphFromServer(syncJson)) return;

      const resultJson = await apiBridge.invokeMethodAsync('SaveWorkflowAsync', path);
      const result = JSON.parse(resultJson);
      if (!result.saved) { toast(result.error || 'Save failed', 'error'); return; }
      state.isDirty = false;
      $('fileName')?.classList.remove('unsaved');
      setWorkflowFileName(path);
      hideModal();
      toast('Workflow saved', 'success');
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  }

  function showSaveModal() {
    const currentName = getWorkflowFileName().replace(/\.loom$/i, '');
    const bodyHtml = `
      <label style="display:block;margin-bottom:6px;color:var(--text-dim);font-size:12px;font-family:var(--font-mono);">Workflow name</label>
      <input type="text" class="modal-input" id="saveNameInput" value="${escapeHtml(currentName)}" placeholder="My workflow" autofocus />
      <p style="margin-top:8px;color:var(--text-faint);font-size:11.5px;">Saved workflows are stored per user and can be opened from the Open dialog.</p>`;
    const footerHtml = `
      <button type="button" class="modal-btn" id="saveCancelBtn">Cancel</button>
      <button type="button" class="modal-btn primary" id="saveConfirmBtn">Save</button>`;
    showModal('Save workflow', bodyHtml, footerHtml).then((result) => {
      if (result === null) return;
      doActualSave(result);
    });
    setTimeout(() => {
      const input = document.getElementById('saveNameInput');
      if (input) {
        input.focus();
        input.select();
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); document.getElementById('saveConfirmBtn')?.click(); }
          if (e.key === 'Escape') { e.preventDefault(); document.getElementById('saveCancelBtn')?.click(); }
        });
      }
      const confirmBtn = document.getElementById('saveConfirmBtn');
      if (confirmBtn) confirmBtn.addEventListener('click', () => {
        const name = document.getElementById('saveNameInput')?.value?.trim();
        if (!name) { toast('Please enter a name', 'error'); return; }
        if (modalResolve) { const r = modalResolve; modalResolve = null; r(name); }
      });
      const cancelBtn = document.getElementById('saveCancelBtn');
      if (cancelBtn) cancelBtn.addEventListener('click', () => hideModal());
    }, 0);
  }

  async function showLoadModal() {
    const paths = await listWorkflows();
    const empty = paths.length === 0;
    const listHtml = empty
      ? '<div class="modal-empty">No saved workflows yet.<br>Save a workflow to see it here.</div>'
      : `<ul class="modal-workflow-list">${paths.map((fullPath) => {
          const fileName = String(fullPath).split(/[/\\]/).pop() || fullPath;
          return `<li>
            <button type="button" class="modal-workflow-btn" data-path="${escapeHtml(fullPath)}">${escapeHtml(fileName)}</button>
            <button type="button" class="modal-workflow-delete" data-path="${escapeHtml(fullPath)}" data-name="${escapeHtml(fileName)}" title="Delete ${escapeHtml(fileName)}" aria-label="Delete ${escapeHtml(fileName)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1-3h10l1 3"/><path d="M7 7v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7"/></svg>
            </button>
          </li>`;
        }).join('')}</ul>`;
    const footerHtml = `<button type="button" class="modal-btn" id="loadCancelBtn">Cancel</button>`;
    showModal('Open workflow', listHtml, footerHtml);
    setTimeout(() => {
      document.querySelectorAll('.modal-workflow-btn').forEach((btn) => {
        btn.addEventListener('click', () => doLoadWorkflow(btn.dataset.path));
      });
      document.querySelectorAll('.modal-workflow-delete').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          doDeleteWorkflow(btn.dataset.path, btn.dataset.name);
        });
      });
      const cancelBtn = document.getElementById('loadCancelBtn');
      if (cancelBtn) cancelBtn.addEventListener('click', () => hideModal());
    }, 0);
  }

  const fileNameText = getFileNameEl();
  if (fileNameText) {
    fileNameText.addEventListener('input', () => $('fileName')?.classList.add('unsaved'));
    fileNameText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fileNameText.blur();
      }
    });
    fileNameText.addEventListener('blur', () => {
      const normalized = getWorkflowFileName();
      setWorkflowFileName(normalized);
    });
  }

  /* ---------- Toolbar ---------- */
  $('btnSave').addEventListener('click', () => {
    if (!requireApi()) return;
    showSaveModal();
  });

  $('btnOpen').addEventListener('click', () => {
    if (!requireApi()) return;
    showLoadModal();
  });

  $('btnExport').addEventListener('click', async () => {
    if (!requireApi()) return;
    try {
      const json = await apiBridge.invokeMethodAsync('ExportCSharpAsync');
      const result = JSON.parse(json);
      if (result.error) {
        toast(result.error, 'error');
        return;
      }
      const blob = new Blob([result.sourceCode], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = result.fileName || 'WorkflowRunner.cs';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('C# source downloaded', 'success');
    } catch (e) {
      toast(e.message || 'Export failed', 'error');
    }
  });

  $('btnClear').addEventListener('click', async () => {
    if (!requireApi() || state.nodes.size === 0) return;
    if (!confirm('Clear all nodes and connections?')) return;
    const ids = [...state.nodes.keys()];
    try {
      let lastJson = null;
      for (const id of ids) {
        lastJson = await apiBridge.invokeMethodAsync('DeleteNodeAsync', String(id));
      }
      if (lastJson) {
        await applyGraphFromServer(lastJson);
        pushHistory();
      }
      toast('Canvas cleared', 'info');
    } catch (e) {
      toast(e.message || 'Clear failed', 'error');
    }
  });

  $('btnUndo').addEventListener('click', () => undo());
  $('btnRedo').addEventListener('click', () => redo());
  document.querySelector('.topbar')?.addEventListener('click', (e) => {
    if (e.target.closest('#btnUndo')) undo();
    if (e.target.closest('#btnRedo')) redo();
  });

  const btnTidy = $('btnTidy');
  if (btnTidy) {
    btnTidy.addEventListener('click', async () => {
      if (state.nodes.size === 0) return;
      layoutGraphTidy();
      const ok = await persistLayoutToServer();
      if (ok) {
        pushHistory();
        fitToView();
        toast('Layout tidied', 'success');
      }
    });
  }

  /* ---------- Status bar ---------- */
  function updateStats() {
    $('statNodes').textContent = state.nodes.size;
    $('statEdges').textContent = state.edges.size;
    if (state.isDirty) $('fileName').classList.add('unsaved');
    scheduleMinimap();
  }

  /* ---------- Minimap ---------- */
  function renderMinimap() {
    if (!minimapCanvas) return;
    minimapCanvas.innerHTML = '';
    if (state.nodes.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 200);
      maxY = Math.max(maxY, n.y + 120);
    });
    const pad = 50;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const w = maxX - minX, h = maxY - minY;
    const mw = minimap.clientWidth, mh = minimap.clientHeight;
    const s = Math.min(mw / w, mh / h);
    const ox = (mw - w * s) / 2;
    const oy = (mh - h * s) / 2;
    state.nodes.forEach(n => {
      const m = document.createElement('div');
      m.className = 'minimap-node';
      m.style.left = (ox + (n.x - minX) * s) + 'px';
      m.style.top = (oy + (n.y - minY) * s) + 'px';
      m.style.width = (200 * s) + 'px';
      m.style.height = (90 * s) + 'px';
      minimapCanvas.appendChild(m);
    });
    // viewport rectangle
    const rect = canvas.getBoundingClientRect();
    const vpX = -state.panX / state.zoom;
    const vpY = -state.panY / state.zoom;
    const vpW = rect.width / state.zoom;
    const vpH = rect.height / state.zoom;
    const vp = document.createElement('div');
    vp.className = 'minimap-viewport';
    vp.style.left = (ox + (vpX - minX) * s) + 'px';
    vp.style.top = (oy + (vpY - minY) * s) + 'px';
    vp.style.width = (vpW * s) + 'px';
    vp.style.height = (vpH * s) + 'px';
    minimapCanvas.appendChild(vp);
  }

  /* ---------- Context menu ---------- */
  function showContextMenu(x, y, items) {
    ctxMenu.innerHTML = items.map((it, i) =>
      it.sep ? `<div class="ctx-sep"></div>` :
      `<div class="ctx-item ${it.danger ? 'danger' : ''}" data-i="${i}"><span>${it.label}</span>${it.kbd ? `<kbd>${it.kbd}</kbd>` : ''}</div>`
    ).join('');
    ctxMenu.style.display = 'block';
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top = y + 'px';
    ctxMenu.querySelectorAll('.ctx-item').forEach(el => {
      el.addEventListener('click', () => {
        const it = items[parseInt(el.dataset.i)];
        if (it && it.fn) it.fn();
        hideContextMenu();
      });
    });
    setTimeout(() => {
      window.addEventListener('click', hideContextMenu, { once: true });
    }, 0);
  }
  function hideContextMenu() { ctxMenu.style.display = 'none'; }

  /* ---------- Keyboard ---------- */
  window.addEventListener('keydown', (e) => {
    const inField = e.target.matches('input, textarea');
    if (inField) return;
    const cmd = e.metaKey || e.ctrlKey;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedEdge) {
        disconnectEdge(state.selectedEdge);
        e.preventDefault();
      } else if (state.selectedNode) {
        deleteNode(state.selectedNode.id);
        e.preventDefault();
      }
    } else if (cmd && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (cmd && (e.key === 'y' || e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    } else if (cmd && e.key === 's') {
      e.preventDefault(); $('btnSave').click();
    } else if (cmd && e.key === 'o') {
      e.preventDefault(); $('btnOpen').click();
    } else if (cmd && e.key === 'Enter') {
      e.preventDefault(); $('btnRun').click();
    } else if (cmd && e.key === 'e') {
      e.preventDefault(); $('btnExport').click();
    } else if (cmd && e.key === '=') {
      e.preventDefault(); setZoom(state.zoom * 1.2);
    } else if (cmd && e.key === '-') {
      e.preventDefault(); setZoom(state.zoom / 1.2);
    } else if (cmd && e.key === '0') {
      e.preventDefault(); state.zoom = 1; state.panX = 0; state.panY = 0; updateTransform(true);
    } else if (cmd && e.key === 'f') {
      e.preventDefault(); fitToView();
    } else if (cmd && e.key === 'd' && state.selectedNode) {
      e.preventDefault(); duplicateNode(state.selectedNode);
    } else if (e.key === 'Escape') {
      deselect();
      if (state.connecting) cancelConnection();
    }
  });

  /* ---------- Helpers ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- Bootstrap ---------- */
  clearStage();
  applyNodeTypesFromJson(nodeTypesJson);
  loadPortAnchors();
  updateTransform(true);

  if (requireApi()) {
    try {
      const json = await apiBridge.invokeMethodAsync('LoadWorkflowJsonAsync');
      await applyGraphFromServer(json);
      resetHistory();
      if (state.nodes.size > 0) {
        if (nodesOverlap()) {
          layoutGraphTidy();
          await persistLayoutToServer();
        }
        fitToView();
      }
      redrawEdges();
    } catch (e) {
      toast('Failed to load workflow — ' + (e.message || 'error'), 'error');
    }
  }
}
