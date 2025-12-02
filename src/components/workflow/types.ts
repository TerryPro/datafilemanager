export interface IPort {
  name: string;
  type: string;
}

export interface IParam {
  name: string;
  type: string; // 'int' | 'float' | 'str' | 'bool'
  label: string;
  description?: string;
  default?: any;
  options?: string[]; // For select
  min?: number;
  max?: number;
  step?: number;
  widget?: string; // e.g., 'file-selector'
  priority?: string; // 'critical' or 'non-critical', default is 'non-critical'
}

export interface INodeSchema {
  id: string;
  name: string;
  description?: string;
  category: string;
  inputs: IPort[];
  outputs: IPort[];
  args: IParam[];
  template: string;
  nodeType?: string; // 'generic' | 'csv_loader' | 'plot', default is 'generic'
  imports?: string[]; // Array of import statements, e.g., ["import pandas as pd"]
}

export interface IColumn {
  name: string;
  type?: string; // 'int64', 'object', 'float64', etc.
}

export interface INodeMetadata {
  inputColumns: Record<string, IColumn[]>; // portName -> columns
  outputColumns: Record<string, IColumn[]>; // portName -> columns
  status: 'pending' | 'calculating' | 'ready' | 'error';
  error?: string;
}

export interface INodeData {
  id?: string; // ReactFlow node id
  schema: INodeSchema;
  values?: Record<string, any>; // Changed from parameters to values to match usage
  parameters?: Record<string, any>; // Keep for backward compatibility if needed
  // Runtime variables
  inputVariables?: Record<string, string>; // portName -> variableName
  outputVariables?: Record<string, string>; // portName -> variableName

  // Metadata for column propagation
  metadata?: INodeMetadata;

  // Callbacks and Services
  onFileChange?: (nodeId: string, filepath: string) => void;
  onValuesChange?: (nodeId: string, values: Record<string, any>) => void;
  serviceManager?: any; // Jupyter ServiceManager
}
