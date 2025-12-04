import { ServiceManager } from '@jupyterlab/services';

export interface IPort {
  name: string;
  type: string;
}

export interface IParam {
  name: string;
  type: string;
  label: string;
  description?: string;
  default?: any;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  widget?: string;
  priority?: string;
  role?: 'input' | 'output' | 'parameter';
}

export interface INodeSchema {
  id: string;
  name: string;
  description?: string;
  category: string;
  inputs: IPort[];
  outputs: IPort[];
  args: IParam[];
  template?: string;
  nodeType?: string;
  imports?: string[];
}

export interface IColumn {
  name: string;
  type?: string;
}

export interface INodeMetadata {
  inputColumns: Record<string, IColumn[]>;
  outputColumns: Record<string, IColumn[]>;
  status: 'unconfigured' | 'configured' | 'running' | 'success' | 'failed';
  error?: string;
}

export interface INodeData {
  id?: string;
  schema: INodeSchema;
  values?: Record<string, any>;
  parameters?: Record<string, any>;
  inputVariables?: Record<string, string>;
  outputVariables?: Record<string, string>;
  number?: number;
  metadata?: INodeMetadata;
  onFileChange?: (nodeId: string, filepath: string) => void;
  onValuesChange?: (nodeId: string, values: Record<string, any>) => void;
  onSelectAlgorithm?: (nodeId: string, schema: INodeSchema) => void;
  onSelectFreeCell?: (nodeId: string) => void;
  onRunNode?: (nodeId: string) => void;
  serviceManager?: ServiceManager;
}
