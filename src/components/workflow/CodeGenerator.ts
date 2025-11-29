import { Node, Edge } from 'reactflow';
import { INodeSchema } from './types';

export const generateCode = (nodes: Node[], edges: Edge[]): string => {
  // 1. Build Adjacency List and In-Degree map for Topological Sort
  const adjList: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  const nodeMap: Record<string, Node> = {};

  nodes.forEach(node => {
    adjList[node.id] = [];
    inDegree[node.id] = 0;
    nodeMap[node.id] = node;
  });

  edges.forEach(edge => {
    if (adjList[edge.source]) {
      adjList[edge.source].push(edge.target);
    }
    inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
  });

  // 2. Topological Sort (Kahn's Algorithm)
  const queue: string[] = [];
  nodes.forEach(node => {
    if (inDegree[node.id] === 0) {
      queue.push(node.id);
    }
  });

  const sortedNodes: Node[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sortedNodes.push(nodeMap[nodeId]);

    const neighbors = adjList[nodeId] || [];
    neighbors.forEach(neighborId => {
      inDegree[neighborId]--;
      if (inDegree[neighborId] === 0) {
        queue.push(neighborId);
      }
    });
  }

  if (sortedNodes.length !== nodes.length) {
    return '# Error: Cycle detected in workflow!';
  }

  // 3. Generate Code
  const lines: string[] = [];
  lines.push('import pandas as pd');
  lines.push('import matplotlib.pyplot as plt');
  lines.push('import numpy as np');
  lines.push('');

  // Track variable names for outputs
  const outputVars: Record<string, string> = {}; // nodeId -> varName

  sortedNodes.forEach(node => {
    const nodeId = node.id;
    // const type = node.type;
    const data = node.data || {};
    const schema: INodeSchema | undefined = data.schema;

    const outputVarName = `df_${nodeId.replace(/-/g, '_')}`;

    if (schema) {
      lines.push(`# ${schema.name}`);

      // Determine Input Variable
      let inputVarName = 'None';
      const inputEdge = edges.find(e => e.target === nodeId);
      if (inputEdge) {
        inputVarName = outputVars[inputEdge.source];
      }

      // Always register Output Variable
      outputVars[nodeId] = outputVarName;

      // Prepare Template Replacement
      let code = schema.template;

      // Replace {OUTPUT_VAR} with the unique output variable name
      code = code.replace(/\{OUTPUT_VAR\}/g, outputVarName);

      // Replace {VAR_NAME}
      if (inputEdge) {
        // Process/Sink Node: {VAR_NAME} is the Input Variable
        code = code.replace(/\{VAR_NAME\}/g, inputVarName);
      } else {
        // Source Node: {VAR_NAME} might be used as Output in legacy templates
        // But modern templates should use {OUTPUT_VAR}
        code = code.replace(/\{VAR_NAME\}/g, outputVarName);
      }

      // Replace Parameters
      const values = data.values || {};
      schema.args?.forEach(arg => {
        let val = values[arg.name];
        if (val === undefined) {
          val = arg.default;
        }
        // Wrap strings in quotes if needed, but template might expect raw value
        // Usually param replacement is raw.
        // e.g. window_length={window_length} -> window_length=11
        // filepath='{filepath}' -> filepath='data.csv'

        // Handle boolean python style
        if (val === true) {
          val = 'True';
        }
        if (val === false) {
          val = 'False';
        }

        code = code.replace(new RegExp(`\\{${arg.name}\\}`, 'g'), String(val));
      });

      lines.push(code);
    }

    lines.push('');
  });

  return lines.join('\n');
};
