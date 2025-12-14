import { Node, Edge } from 'reactflow';
import { INodeSchema } from './types';

export const generateCode = (
  nodes: Node[],
  edges: Edge[],
  serverRoot?: string
): string => {
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
    const nodeId = queue.shift();
    if (!nodeId) {
      continue;
    }
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

  // 3. Generate Code with Class Wrapper
  const lines: string[] = [];
  const timestamp = Math.floor(Date.now() / 1000);
  const className = `Workflow_${timestamp}`;
  const instanceName = `wf_${timestamp}`;

  // Collect imports from all nodes
  const allImports = new Set<string>();

  // Add essential imports for workflow execution
  allImports.add('from IPython.display import display');

  // For function templates, we need to import from workflow_lib
  // Check if any node uses library (has a schema)
  const useWorkflowLib = sortedNodes.some(node => {
    return !!node.data?.schema;
  });

  // If there are library algorithms, add the workflow_lib import
  if (useWorkflowLib) {
    allImports.add('from algorithm import *');
  }

  // Always add explicit imports from schema if defined
  sortedNodes.forEach(node => {
    const schema: INodeSchema | undefined = node.data?.schema;
    if (schema && schema.imports) {
      schema.imports.forEach(imp => allImports.add(imp));
    }
  });

  // Add sorted unique imports
  if (allImports.size > 0) {
    Array.from(allImports)
      .sort()
      .forEach(imp => lines.push(imp));
    lines.push('');
  }

  // Class Definition
  lines.push(`class ${className}:`);
  lines.push('    """');
  lines.push(`    Workflow Class - Generated at ${new Date().toISOString()}`);
  lines.push('    """');
  lines.push('    def __init__(self):');
  lines.push('        self.results = {}');
  lines.push('');

  // Track variable names for outputs and methods
  // Map: NodeID -> { PortName -> VariableName }
  const nodeOutputs: Record<string, Record<string, string>> = {};
  // Map: NodeID -> MethodName
  const nodeMethods: Record<string, string> = {};

  // Generate Methods for each node
  sortedNodes.forEach(node => {
    const nodeId = node.id;
    const data = node.data || {};
    const schema: INodeSchema | undefined = data.schema;
    const safeNodeId = nodeId.replace(/-/g, '_');
    const methodName = `step_${safeNodeId}`;
    nodeMethods[nodeId] = methodName;

    if (schema) {
      // 1. Determine Input Variables from Incoming Edges
      const inputEdges = edges.filter(e => e.target === nodeId);
      const inputVars: Record<string, string> = {};
      const methodArgs: string[] = [];

      inputEdges.forEach((edge, index) => {
        const sourceNodeId = edge.source;
        const sourceOutputs = nodeOutputs[sourceNodeId];
        if (!sourceOutputs) {
          return;
        }

        // Input argument name for the method signature
        const targetHandle = edge.targetHandle || 'df_in';
        let argName = 'df';

        if (inputEdges.length > 1) {
          if (targetHandle === 'df_in') {
            argName = `df_${index + 1}`;
          } else if (/^df\d+$/.test(targetHandle)) {
            // e.g. df1 -> df_1
            argName = targetHandle.replace('df', 'df_');
          } else {
            argName = `df_${targetHandle}`;
          }
        }

        // Ensure uniqueness in methodArgs
        if (methodArgs.includes(argName)) {
          argName = `${argName}_${index + 1}`;
        }

        if (targetHandle) {
          inputVars[targetHandle] = argName;
        } else {
          inputVars['default'] = argName;
        }

        methodArgs.push(argName);
      });

      // Method Signature
      lines.push(`    # ${schema.name} (ID: ${nodeId})`);
      lines.push(
        `    def ${methodName}(self${
          methodArgs.length > 0 ? ', ' + methodArgs.join(', ') : ''
        }):`
      );

      // 2. Determine Output Variables for Current Node
      const currentOutputs: Record<string, string> = {};

      const outputs = schema.outputs || [];

      if (outputs.length === 0) {
        const defaultVar = `df_${safeNodeId}`;
        currentOutputs['default'] = defaultVar;
      } else {
        outputs.forEach((port, index) => {
          let varName = `df_${safeNodeId}`;
          if (outputs.length > 1) {
            varName = `${varName}_${port.name}`;
          }
          currentOutputs[port.name] = varName;
          if (index === 0) {
            currentOutputs['default'] = varName;
          }
        });
      }

      nodeOutputs[nodeId] = currentOutputs;

      // 3. Generate Function Call Dynamically
      const funcName = schema.id; // Assuming Algorithm ID is the function name
      const callArgs: string[] = [];

      // Handle Input DataFrames (df, df1, df2, left, right, etc.)
      Object.entries(inputVars).forEach(([portName, varName]) => {
        let paramName = portName;
        // Map standard port names to function parameter names
        if (portName === 'default' || portName === 'df_in') {
          paramName = 'df';
        }
        callArgs.push(`${paramName}=${varName}`);
      });

      // Handle Parameters
      const values = data.values || {};
      schema.args?.forEach(arg => {
        // Skip input/output parameters as they are handled separately
        if (arg.role === 'input' || arg.role === 'output') {
          return;
        }

        let val = values[arg.name];
        if (val === undefined) {
          val = arg.default;
        }

        // Handle Booleans
        if (val === true) {
          val = 'True';
        } else if (val === false) {
          val = 'False';
        }
        // Handle Null
        else if (val === null) {
          val = 'None';
        }
        // Handle Arrays
        else if (Array.isArray(val)) {
          const formattedItems = val.map(v => {
            if (typeof v === 'string') {
              return `'${v}'`;
            }
            return String(v);
          });
          val = `[${formattedItems.join(', ')}]`;
        }
        // Handle Strings (based on type or if it's a string value that isn't a variable/number)
        else if (arg.type === 'str' || typeof val === 'string') {
          // Ensure we don't double quote if it's already quoted (though usually val is raw string)
          // Also handle path normalization if it's a filepath
          if (arg.name === 'filepath' && serverRoot) {
            const isWin = serverRoot.includes('\\');
            const sep = isWin ? '\\' : '/';
            let valNorm = val.replace(/\//g, sep).replace(/\\/g, sep);
            const isAbs = isWin
              ? /^[a-zA-Z]:\\/.test(valNorm) || valNorm.startsWith('\\\\')
              : valNorm.startsWith('/');
            if (!isAbs) {
              let root = serverRoot;
              if (root.endsWith(sep)) {
                root = root.substring(0, root.length - 1);
              }
              if (!valNorm.includes(sep)) {
                valNorm = `dataset${sep}${valNorm}`;
              }
              valNorm = `${root}${sep}${valNorm}`;
              if (isWin) {
                valNorm = valNorm.replace(/\\/g, '\\');
              }
            }
            val = valNorm;
          }

          // Check if it looks like a number but is a string? No, type check handles that.
          // Just wrap in quotes.
          val = `'${val}'`;
        }

        callArgs.push(`${arg.name}=${val}`);
      });

      // Handle Output Variable
      // if (currentOutputs['default']) {
      //   callArgs.push(`output_var='${currentOutputs['default']}'`);
      // }

      const code = `${
        currentOutputs['default'] || 'res'
      } = ${funcName}(${callArgs.join(', ')})

# Display results
if ${currentOutputs['default'] || 'res'} is not None:
    display(${currentOutputs['default'] || 'res'}.head())`;

      // Indent code
      const indentedCode = code
        .split('\n')
        .map(l => `        ${l}`)
        .join('\n');
      lines.push(indentedCode);

      // Save results to self.results only if the algorithm has outputs
      if (outputs.length > 0) {
        lines.push(
          `        self.results['${nodeId}'] = ${
            currentOutputs['default'] || 'None'
          }`
        );
        lines.push(`        return ${currentOutputs['default'] || 'None'}`);
      }
      lines.push('');
    }
  });

  // Generate Run Method
  lines.push('    def run(self):');
  const runVars: Record<string, string> = {}; // Map NodeID -> ResultVarName in run() scope

  sortedNodes.forEach(node => {
    const nodeId = node.id;
    const schema: INodeSchema | undefined = node.data?.schema;
    const methodName = nodeMethods[nodeId];
    const methodCallArgs: string[] = [];

    const inputEdges = edges.filter(e => e.target === nodeId);
    // We need to match the order of args in the method definition: inputVars construction order
    // Re-construct logic to find source vars
    // Note: inputEdges might not be in the same order as the forEach above unless we sort or use a consistent iteration.
    // The above iteration was `inputEdges.forEach`. `filter` preserves order if edge list is stable.
    // To be safe, let's assume edges order is stable.

    inputEdges.forEach(edge => {
      const sourceNodeId = edge.source;
      // In run scope, the result of sourceNodeId is stored in runVars
      const sourceVar = runVars[sourceNodeId];
      methodCallArgs.push(sourceVar);
    });

    // Only create result variable if the node has outputs
    const outputs = schema?.outputs || [];
    if (outputs.length > 0) {
      const resultVar = `res_${nodeId.replace(/-/g, '_')}`;
      runVars[nodeId] = resultVar;

      lines.push(
        `        ${resultVar} = self.${methodName}(${methodCallArgs.join(
          ', '
        )})`
      );
    } else {
      // For nodes without outputs (like export_data), call method without capturing return value
      lines.push(`        self.${methodName}(${methodCallArgs.join(', ')})`);
    }
  });

  // Return the last node's result that has outputs
  const nodesWithOutputs = sortedNodes.filter(node => {
    const schema: INodeSchema | undefined = node.data?.schema;
    return schema && (schema.outputs || []).length > 0;
  });

  if (nodesWithOutputs.length > 0) {
    const lastNodeWithOutputs = nodesWithOutputs[nodesWithOutputs.length - 1];
    lines.push(`        return ${runVars[lastNodeWithOutputs.id]}`);
  } else {
    lines.push('        return None');
  }
  lines.push('');

  // Execution Block
  lines.push('# =========================================');
  lines.push('# Execution');
  lines.push('# =========================================');
  lines.push(`${instanceName} = ${className}()`);

  // Check for explicit exports
  const exportNodes = sortedNodes.filter(
    n => n.data?.schema?.id === 'export_data'
  );

  if (exportNodes.length > 0) {
    lines.push(`${instanceName}.run()`);
    lines.push('');
    lines.push('# Export Variables');
    exportNodes.forEach(node => {
      const nodeId = node.id;
      const values = node.data?.values || {};
      const globalName = values['global_name'] || 'exported_data';
      // Note: export_data nodes use globals() directly, not self.results
      lines.push(
        `# Variable '${globalName}' has been exported to global namespace by node '${nodeId}'`
      );
      lines.push(
        `print(f"Variable '${globalName}' exported successfully from node '${nodeId}'")`
      );
    });
  } else {
    // Default behavior: just run
    lines.push(`${instanceName}.run()`);
    lines.push('print("Workflow finished.")');
  }

  lines.push('');
  lines.push(
    `print(f"Intermediate results available in '${instanceName}.results'.")`
  );

  return lines.join('\n');
};
