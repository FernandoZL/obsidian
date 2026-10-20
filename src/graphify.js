'use strict';
function exportGraph(records) {
  const nodes = new Map(), links = [];
  for (const record of records) {
    const project = record.project || 'General', source = record.source || 'manual';
    nodes.set('project:' + project, { id: 'project:' + project, label: project, file_type: 'project', source_file: '', _origin: 'neuronas' });
    nodes.set('source:' + source, { id: 'source:' + source, label: source, file_type: 'assistant', source_file: '', _origin: 'neuronas' });
    nodes.set('memory:' + record.id, { id: 'memory:' + record.id, label: record.title || record.type, file_type: 'md', source_file: record.path, source_location: record.path, attribution: record.attribution, memory_type: record.type, _origin: 'neuronas' });
    for (const [target, relation] of [['project:' + project, 'belongs_to'], ['source:' + source, 'recorded_from']]) links.push({ source: 'memory:' + record.id, target, relation, confidence: 1, weight: 1, source_file: record.path, source_location: record.path, _origin: 'neuronas' });
  }
  return { directed: false, input_tokens: 0, output_tokens: 0, nodes: [...nodes.values()], links, hyperedges: [] };
}
module.exports = { exportGraph };
