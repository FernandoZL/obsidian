'use strict';
const COLORS = { root: '#a6e8c4', project: '#e7c88f', source: '#9ab9ef', decision: '#e9bc71', learning: '#c3a1e9', profile: '#ed9fae', session: '#77b9a8' };
function buildGraph(records, { project = '', limit = 120 } = {}) {
  const selected = records.filter(r => !project || r.project === project).slice(0, limit);
  const nodes = [{ id: 'root', kind: 'root', label: 'Mi memoria', x: 0, y: 0, path: '09 - Memoria IA/Inicio.md' }], edges = [], index = new Map(nodes.map(n => [n.id, n]));
  const projectNames = [...new Set(selected.map(r => r.project || 'General'))];
  const sources = [...new Set(selected.map(r => r.source || 'manual'))];
  for (const [i, name] of projectNames.entries()) {
    const angle = i * Math.PI * 2 / projectNames.length;
    const node = { id: 'project:' + name, kind: 'project', label: name, x: 180 * Math.cos(angle), y: 160 * Math.sin(angle) };
    nodes.push(node); index.set(node.id, node); edges.push({ source: node.id, target: 'root', kind: 'contains' });
  }
  for (const [i, name] of sources.entries()) {
    const node = { id: 'source:' + name, kind: 'source', label: name, x: -300, y: (i - (sources.length - 1) / 2) * 85 };
    nodes.push(node); index.set(node.id, node);
  }
  for (const [i, record] of selected.entries()) {
    const p = index.get('project:' + (record.project || 'General')), angle = i * 2.399963;
    const node = { ...record, id: 'memory:' + record.id, kind: 'memory', label: record.title || record.type, x: p.x + Math.cos(angle) * (70 + i % 4 * 15), y: p.y + Math.sin(angle) * (70 + i % 4 * 15) };
    nodes.push(node); index.set(node.id, node);
    edges.push({ source: node.id, target: p.id, kind: 'project' }, { source: node.id, target: 'source:' + (record.source || 'manual'), kind: 'source' });
  }
  // Deterministic local layout, no server, model or external visualization library.
  for (let step = 0; step < 60; step++) {
    const moves = new Map(nodes.map(n => [n.id, { x: 0, y: 0 }]));
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j], dx = a.x - b.x || .1, dy = a.y - b.y || .1;
      const square = Math.max(150, dx * dx + dy * dy), scale = 2200 / (square * Math.sqrt(square)), mx = dx * scale, my = dy * scale;
      moves.get(a.id).x += mx; moves.get(a.id).y += my; moves.get(b.id).x -= mx; moves.get(b.id).y -= my;
    }
    for (const edge of edges) {
      const a = index.get(edge.source), b = index.get(edge.target), dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 1, pull = (distance - (edge.kind === 'source' ? 210 : 85)) * .014;
      const mx = dx / distance * pull, my = dy / distance * pull;
      moves.get(a.id).x += mx; moves.get(a.id).y += my; moves.get(b.id).x -= mx; moves.get(b.id).y -= my;
    }
    for (const node of nodes) if (node.kind !== 'root') {
      const m = moves.get(node.id); node.x = Math.max(-440, Math.min(440, (node.x + Math.max(-8, Math.min(8, m.x))) * .998)); node.y = Math.max(-275, Math.min(275, (node.y + Math.max(-8, Math.min(8, m.y))) * .998));
    }
  }
  return { nodes, edges, total: records.filter(r => !project || r.project === project).length };
}
function renderGraph(container, graph, onSelect) {
  const doc = container.ownerDocument, ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '-500 -330 1000 660'); svg.setAttribute('class', 'nn-neural-map'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Mapa neuronal interactivo: recuerdos conectados con proyectos y asistentes'); container.appendChild(svg);
  const index = new Map(graph.nodes.map(n => [n.id, n])), edgeElements = [], nodeElements = [];
  for (const edge of graph.edges) {
    const line = doc.createElementNS(ns, 'line'); line.setAttribute('class', 'nn-neural-edge ' + edge.kind); svg.appendChild(line); edgeElements.push({ edge, line });
  }
  for (const node of graph.nodes) {
    const group = doc.createElementNS(ns, 'g'); group.setAttribute('class', 'nn-neural-node'); group.setAttribute('tabindex', '0'); group.setAttribute('role', 'button'); group.setAttribute('aria-label', node.label || node.type);
    const circle = doc.createElementNS(ns, 'circle'), color = COLORS[node.type] || COLORS[node.kind] || COLORS.session;
    circle.setAttribute('r', node.kind === 'root' ? 18 : node.kind === 'memory' ? node.type === 'session' ? 5 : 8 : 11); circle.setAttribute('fill', color); group.appendChild(circle);
    const title = doc.createElementNS(ns, 'title'); title.textContent = `${node.label || node.type} · ${node.project || node.kind}`; group.appendChild(title);
    if (node.kind !== 'memory' || node.type !== 'session') {
      const label = doc.createElementNS(ns, 'text'); label.setAttribute('y', node.kind === 'root' ? 36 : 24); label.setAttribute('text-anchor', 'middle'); label.textContent = String(node.label || '').slice(0, 26); group.appendChild(label);
    }
    group.onclick = () => {
      for (const { edge, line } of edgeElements) line.style.opacity = edge.source === node.id || edge.target === node.id ? '1' : '.12';
      onSelect(node);
    };
    group.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); group.onclick(); } };
    let dragged = false;
    group.onpointerdown = event => {
      event.stopPropagation(); dragged = false; group.setPointerCapture(event.pointerId); const start = { x: event.clientX, y: event.clientY, nx: node.x, ny: node.y };
      group.onpointermove = move => { const box = svg.getBoundingClientRect(), scale = view[2] / box.width; const dx = move.clientX - start.x, dy = move.clientY - start.y; dragged ||= Math.abs(dx) + Math.abs(dy) > 4; node.x = start.nx + dx * scale; node.y = start.ny + dy * scale; draw(); };
      group.onpointerup = () => { group.onpointermove = null; if (dragged) onSelect(node); };
    };
    svg.appendChild(group); nodeElements.push({ node, group });
  }
  function draw() {
    for (const { edge, line } of edgeElements) { const a = index.get(edge.source), b = index.get(edge.target); for (const [key, value] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })) line.setAttribute(key, String(value)); }
    for (const { node, group } of nodeElements) group.setAttribute('transform', `translate(${node.x},${node.y})`);
  }
  let view = [-500, -330, 1000, 660]; const setView = () => svg.setAttribute('viewBox', view.join(' '));
  const zoom = factor => { const width = Math.max(250, Math.min(2400, view[2] * factor)), height = width * .66; view = [view[0] + (view[2] - width) / 2, view[1] + (view[3] - height) / 2, width, height]; setView(); };
  svg.onwheel = event => { event.preventDefault(); zoom(event.deltaY > 0 ? 1.12 : .88); };
  svg.onpointerdown = event => {
    if (event.target !== svg) return; svg.setPointerCapture(event.pointerId); const start = { x: event.clientX, y: event.clientY, view: [...view] };
    svg.onpointermove = move => { const scale = view[2] / svg.getBoundingClientRect().width; view[0] = start.view[0] - (move.clientX - start.x) * scale; view[1] = start.view[1] - (move.clientY - start.y) * scale; setView(); };
    svg.onpointerup = () => svg.onpointermove = null;
  };
  draw(); return { zoomIn: () => zoom(.8), zoomOut: () => zoom(1.25), reset: () => { view = [-500, -330, 1000, 660]; setView(); } };
}
module.exports = { buildGraph, renderGraph, COLORS };
