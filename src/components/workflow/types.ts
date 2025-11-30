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

export interface INodeData {
  schema: INodeSchema;
  parameters: Record<string, any>;
  // Runtime variables
  inputVariables?: Record<string, string>; // portName -> variableName
  outputVariables?: Record<string, string>; // portName -> variableName
}
