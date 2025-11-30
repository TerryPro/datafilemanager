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

  // Collect imports from all nodes
  const allImports = new Set<string>();
  sortedNodes.forEach(node => {
    const schema: INodeSchema | undefined = node.data?.schema;
    if (schema && schema.imports) {
      schema.imports.forEach(imp => allImports.add(imp));
    }
  });

  // Add sorted unique imports
  if (allImports.size > 0) {
    Array.from(allImports).sort().forEach(imp => lines.push(imp));
    lines.push('');
  }

  // Track variable names for outputs
  // Map: NodeID -> { PortName -> VariableName }
  const nodeOutputs: Record<string, Record<string, string>> = {};

  sortedNodes.forEach(node => {
    const nodeId = node.id;
    const data = node.data || {};
    const schema: INodeSchema | undefined = data.schema;

    if (schema) {
      lines.push(`# ${schema.name}`);

      // 1. Determine Input Variables from Incoming Edges
      const inputEdges = edges.filter(e => e.target === nodeId);
      const inputVars: Record<string, string> = {};

      inputEdges.forEach(edge => {
        const sourceNodeId = edge.source;
        const sourceOutputs = nodeOutputs[sourceNodeId];
        if (!sourceOutputs) return; 

        // Determine which output of source node to use
        const sourceHandle = edge.sourceHandle;
        let sourceVarName = '';
        
        if (sourceHandle && sourceOutputs[sourceHandle]) {
          sourceVarName = sourceOutputs[sourceHandle];
        } else {
           // Fallback to 'default' or the first key
           sourceVarName = sourceOutputs['default'] || Object.values(sourceOutputs)[0];
        }

        // Determine which input port of current node this maps to
        const targetHandle = edge.targetHandle;
        if (targetHandle) {
          inputVars[targetHandle] = sourceVarName;
        } else {
          // Legacy or Default input
          inputVars['default'] = sourceVarName;
        }
      });

      // 2. Determine Output Variables for Current Node
      const currentOutputs: Record<string, string> = {};
      const safeNodeId = nodeId.replace(/-/g, '_');
      
      // If schema doesn't define outputs explicitly, assume a single default output
      // This handles legacy nodes or implicit single-output nodes
      const outputs = schema.outputs || [];
      
      if (outputs.length === 0) {
         const defaultVar = `df_${safeNodeId}`;
         currentOutputs['default'] = defaultVar;
      } else {
        outputs.forEach((port, index) => {
           // If single output, keep it simple `df_nodeId`
           // If multiple, append port name `df_nodeId_portName`
           let varName = `df_${safeNodeId}`;
           if (outputs.length > 1) {
             varName = `${varName}_${port.name}`;
           }
           currentOutputs[port.name] = varName;
           // Also map 'default' to the first one for legacy compatibility
           if (index === 0) {
             currentOutputs['default'] = varName;
           }
        });
      }
      
      nodeOutputs[nodeId] = currentOutputs;

      // 3. Prepare Template Replacement
      let code = schema.template;

      // Replace Output Placeholders
      // Standard: {portName} -> varName
      Object.entries(currentOutputs).forEach(([portName, varName]) => {
        if (portName !== 'default') {
            code = code.replace(new RegExp(`\\{${portName}\\}`, 'g'), varName);
        }
      });
      // Legacy: {OUTPUT_VAR} -> default output
      if (currentOutputs['default']) {
        code = code.replace(/\{OUTPUT_VAR\}/g, currentOutputs['default']);
      }

      // Replace Input Placeholders
      // Standard: {portName} -> sourceVarName
      Object.entries(inputVars).forEach(([portName, varName]) => {
        if (portName !== 'default') {
           code = code.replace(new RegExp(`\\{${portName}\\}`, 'g'), varName);
        }
      });
      
      // Legacy: {VAR_NAME} -> default input
      let defaultInputVar = inputVars['default'];
      if (!defaultInputVar && Object.keys(inputVars).length > 0) {
         // Use the first available input if no default specific mapping found
         // But prioritize one named 'df_in' if it exists? No, just take first.
         defaultInputVar = Object.values(inputVars)[0];
      }
      
      if (defaultInputVar) {
        code = code.replace(/\{VAR_NAME\}/g, defaultInputVar);
      }

      // Replace Parameters
      const values = data.values || {};
      schema.args?.forEach(arg => {
        let val = values[arg.name];
        if (val === undefined) {
          val = arg.default;
        }

        if (val === true) val = 'True';
        if (val === false) val = 'False';

        code = code.replace(new RegExp(`\\{${arg.name}\\}`, 'g'), String(val));
      });

      lines.push(code);
    }

    lines.push('');
  });

  return lines.join('\n');
};
