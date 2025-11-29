export interface Port {
  name: string;
  type: string;
}

export interface Param {
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

export interface NodeSchema {
  id: string;
  name: string;
  description?: string;
  category: string;
  inputs: Port[];
  outputs: Port[];
  args: Param[];
  template: string;
}

export interface NodeData {
  schema: NodeSchema;
  parameters: Record<string, any>;
  // Runtime variables
  inputVariables?: Record<string, string>; // portName -> variableName
  outputVariables?: Record<string, string>; // portName -> variableName
}
