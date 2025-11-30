import { IColumn, INodeSchema } from './types';

export type TransformerFunc = (
  inputColumns: Record<string, IColumn[]>,
  params: Record<string, any>,
  schema: INodeSchema
) => Record<string, IColumn[]>;

// Helper to get columns for default input port
const getDefaultInputCols = (inputColumns: Record<string, IColumn[]>): IColumn[] => {
  // Usually 'df_in' or the first key
  const keys = Object.keys(inputColumns);
  if (keys.length === 0) return [];
  if (inputColumns['df_in']) return inputColumns['df_in'];
  return inputColumns[keys[0]];
};

// 1. Pass-through Transformer
export const transformPassThrough: TransformerFunc = (inputs, params, schema) => {
  const cols = getDefaultInputCols(inputs);
  // Assume single output 'df_out'
  const outPort = schema.outputs[0]?.name || 'df_out';
  return { [outPort]: [...cols] };
};

// 2. Select Columns Transformer
export const transformSelectColumns: TransformerFunc = (inputs, params, schema) => {
  const inCols = getDefaultInputCols(inputs);
  const selectedNames: string[] = params['columns'] || [];
  
  const outCols = inCols.filter(c => selectedNames.includes(c.name));
  
  // If no columns selected yet, return empty or all?
  // Usually if selectedNames is empty, return empty.
  
  const outPort = schema.outputs[0]?.name || 'df_out';
  return { [outPort]: outCols };
};

// 3. Rename Columns Transformer
export const transformRenameColumns: TransformerFunc = (inputs, params, schema) => {
  const inCols = getDefaultInputCols(inputs);
  const mapping: Record<string, string> = params['columns_map'] || {};
  
  const outCols = inCols.map(c => ({
    ...c,
    name: mapping[c.name] || c.name
  }));
  
  const outPort = schema.outputs[0]?.name || 'df_out';
  return { [outPort]: outCols };
};

// 4. Merge/Join Transformer
export const transformMerge: TransformerFunc = (inputs, params, schema) => {
  const leftCols = inputs['left'] || inputs['df1'] || [];
  const rightCols = inputs['right'] || inputs['df2'] || [];
  
  // If either input is missing, we can't determine output fully, 
  // but we can try to return what we have if it's an outer join?
  // For simplicity, if either is missing, return empty or wait.
  if (leftCols.length === 0 && rightCols.length === 0) {
    return { df_out: [] };
  }

  const onParam = params['on'];
  const onCols: string[] = Array.isArray(onParam) ? onParam : (onParam ? [onParam] : []);
  
  const suffixes = params['suffixes'] || ['_x', '_y'];
  const suffixLeft = suffixes[0] || '_x';
  const suffixRight = suffixes[1] || '_y';
  
  const output: IColumn[] = [];
  const addedNames = new Set<string>();

  // 1. Add Key columns (preserved)
  // In a real merge, keys must exist in both (for inner) or at least one.
  // We assume keys are preserved.
  onCols.forEach(name => {
    // Try to find type from left, then right
    const original = leftCols.find(c => c.name === name) || rightCols.find(c => c.name === name);
    if (original) {
        output.push(original);
        addedNames.add(name);
    } else {
        // Key specified but not in columns? Add anyway as placeholder
        output.push({ name });
        addedNames.add(name);
    }
  });

  // 2. Process Left
  leftCols.forEach(col => {
    if (addedNames.has(col.name)) return; // Already added (key)
    
    // Check conflict with right
    const conflict = rightCols.some(rc => rc.name === col.name && !onCols.includes(rc.name));
    
    if (conflict) {
        const newName = `${col.name}${suffixLeft}`;
        output.push({ ...col, name: newName });
    } else {
        output.push(col);
    }
  });

  // 3. Process Right
  rightCols.forEach(col => {
    if (addedNames.has(col.name)) return; // Already added (key)
    
    // Check conflict with left
    const conflict = leftCols.some(lc => lc.name === col.name && !onCols.includes(lc.name));
    
    if (conflict) {
        const newName = `${col.name}${suffixRight}`;
        output.push({ ...col, name: newName });
    } else {
        output.push(col);
    }
  });

  const outPort = schema.outputs[0]?.name || 'df_out';
  return { [outPort]: output };
};

// Registry
const transformers: Record<string, TransformerFunc> = {
  'select_columns': transformSelectColumns,
  'rename_columns': transformRenameColumns,
  'merge_dfs': transformMerge,
  'concat_dfs': transformMerge, // Concat usually different, but for now treat similar or implement separate
  'filter_rows': transformPassThrough,
  'sort_values': transformPassThrough,
  'drop_duplicates': transformPassThrough,
  'fill_na': transformPassThrough,
  'astype': transformPassThrough, // Types change, but names usually don't
  'default': transformPassThrough
};

export const getTransformer = (nodeId: string): TransformerFunc => {
  return transformers[nodeId] || transformers['default'];
};
