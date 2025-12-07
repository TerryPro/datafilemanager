/**
 * Helper functions for creating and managing FlowNote nodes
 * These functions are extracted from createNodeFromCell to improve maintainability
 */

import { ICellModel } from '@jupyterlab/cells';
import { NotebookPanel } from '@jupyterlab/notebook';
import { UUID } from '@lumino/coreutils';
import { INodeSchema } from '../types';

/**
 * Position interface for node placement
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Ensures that a cell has a node_id, generating one if it doesn't exist
 * @param cellModel - The cell model to check/update
 * @returns The node_id (existing or newly generated)
 */
export function ensureNodeId(cellModel: ICellModel): string {
  let nodeId = cellModel.sharedModel.getMetadata('node_id') as string;
  if (!nodeId) {
    nodeId = UUID.uuid4();
    cellModel.sharedModel.setMetadata('node_id', nodeId);
  }
  return nodeId;
}

/**
 * Gets the position for a node, either from metadata or calculated default
 * @param cellModel - The cell model
 * @param index - The cell index in the notebook
 * @returns The position object with x and y coordinates
 */
export function getNodePosition(cellModel: ICellModel, index: number): Position {
  const metaPos = cellModel.sharedModel.getMetadata('flow_position') as any;
  return metaPos
    ? { x: metaPos.x || 100, y: metaPos.y || 50 }
    : { x: 100, y: index * 150 + 50 };
}

/**
 * Gets the node parameter values from metadata
 * @param cellModel - The cell model
 * @returns The values object (empty object if no values exist)
 */
export function getNodeValues(cellModel: ICellModel): Record<string, any> {
  const metaValues = cellModel.sharedModel.getMetadata('flow_values') as any;
  return metaValues ? JSON.parse(JSON.stringify(metaValues)) : {};
}

/**
 * Ensures that a cell has a node number, assigning one if it doesn't exist
 * @param cellModel - The cell model to check/update
 * @param notebook - The notebook panel for accessing the sequence counter
 * @returns The node number (existing or newly assigned)
 */
export function ensureNodeNumber(
  cellModel: ICellModel,
  notebook: NotebookPanel
): number {
  let nodeNumber = cellModel.sharedModel.getMetadata('flow_node_number') as number;
  if (!nodeNumber || typeof nodeNumber !== 'number') {
    const seqRaw = notebook.model
      ? (notebook.model.sharedModel.getMetadata('flow_number_seq') as any)
      : undefined;
    const seq = typeof seqRaw === 'number' ? seqRaw : 1;
    nodeNumber = seq;
    cellModel.sharedModel.setMetadata('flow_node_number', nodeNumber);
    if (notebook.model) {
      notebook.model.sharedModel.setMetadata('flow_number_seq', seq + 1);
    }
  }
  return nodeNumber;
}

/**
 * Gets the node schema from metadata or returns a default free cell schema
 * @param cellModel - The cell model
 * @param index - The cell index in the notebook
 * @returns The node schema
 */
export function getNodeSchema(cellModel: ICellModel, index: number): INodeSchema {
  const metaSchema = cellModel.sharedModel.getMetadata('flow_schema') as any;
  if (metaSchema) {
    return JSON.parse(JSON.stringify(metaSchema));
  }

  // Default free cell schema
  return {
    id: 'free_cell',
    name: '自由CELL',
    category: 'free',
    inputs: index > 0 ? [{ name: 'in', type: 'any' }] : [],
    outputs: [{ name: 'out', type: 'any' }],
    args: []
  };
}

/**
 * Infers a label for the node based on schema name or cell content
 * @param cellModel - The cell model
 * @param schema - The node schema
 * @returns The inferred label
 */
export function inferNodeLabel(cellModel: ICellModel, schema: INodeSchema): string {
  // Use schema name if available and not default
  if (schema.name && schema.name !== '自由CELL') {
    return schema.name;
  }

  const source = cellModel.sharedModel.getSource();
  if (source.trim() === '') {
    return '(Unnamed Step)';
  }

  const lines = source.split('\n');
  const firstLine = lines[0].trim();

  // Extract from markdown heading
  if (firstLine.startsWith('#')) {
    return firstLine.replace(/^#+\s*/, '');
  }

  // Truncate long first line
  return firstLine.substring(0, 20) + (firstLine.length > 20 ? '...' : '');
}

/**
 * Ensures that output variables are defined for all output ports
 * @param cellModel - The cell model
 * @param schema - The node schema
 * @param nodeNumber - The node number for generating variable names
 * @returns The output variables mapping (port name -> variable name)
 */
export function ensureOutputVariables(
  cellModel: ICellModel,
  schema: INodeSchema,
  nodeNumber: number
): Record<string, string> {
  let outVars = cellModel.sharedModel.getMetadata('flow_output_vars') as Record<
    string,
    string
  >;

  if (!outVars || typeof outVars !== 'object') {
    outVars = {};
    const ports = (schema.outputs || []).map(p => p.name);
    ports.forEach(port => {
      const safePort = String(port).replace(/[^a-zA-Z0-9_]+/g, '_');
      outVars[port] = `n${String(nodeNumber).padStart(2, '0')}_${safePort}`;
    });
    cellModel.sharedModel.setMetadata('flow_output_vars', outVars);
  }

  return outVars;
}

/**
 * Calculates the node status based on metadata and input connections
 * @param cellModel - The cell model
 * @param schema - The node schema
 * @param nodeId - The node ID
 * @param notebook - The notebook panel for checking connections
 * @returns The node status (unconfigured, configured, running, success, or failed)
 */
export function calculateNodeStatus(
  cellModel: ICellModel,
  schema: INodeSchema,
  nodeId: string,
  notebook: NotebookPanel
): 'unconfigured' | 'configured' | 'running' | 'success' | 'failed' {
  const rawStatus = (cellModel.sharedModel.getMetadata('flow_status') as string) || '';

  // Explicit status values
  if (rawStatus === 'running' || rawStatus === 'calculating') {
    return 'running';
  }
  if (rawStatus === 'success' || rawStatus === 'ready') {
    return 'success';
  }
  if (rawStatus === 'failed' || rawStatus === 'error') {
    return 'failed';
  }

  // Free cells are unconfigured by default
  if (schema.category === 'free') {
    return 'unconfigured';
  }

  // Check if all required inputs are connected
  try {
    const metaEdges =
      (notebook.model?.sharedModel.getMetadata('flow_edges') as any[]) || [];
    const needInputs = (schema.inputs || []).map(p => p.name);
    const hasAllInputs = needInputs.every(p =>
      metaEdges.some(e => e.targetId === nodeId && e.targetPort === p)
    );
    return hasAllInputs ? 'configured' : 'unconfigured';
  } catch {
    return 'unconfigured';
  }
}
