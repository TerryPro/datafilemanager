import React, { useState } from 'react';
import { INodeSchema } from '../../types';

interface IAlgorithmSelectorProps {
  library: Record<string, INodeSchema[]>;
  allSchemas: INodeSchema[];
  loading: boolean;
  onSelect: (schema: INodeSchema) => void;
}

/**
 * 算法选择器组件
 * 用于自由 Cell 选择算法
 */
export const AlgorithmSelector: React.FC<IAlgorithmSelectorProps> = ({
  library,
  allSchemas,
  loading,
  onSelect
}) => {
  const [selectedAlgo, setSelectedAlgo] = useState<string>('');

  const handleSelectClick = () => {
    const schema = allSchemas.find(x => x.id === selectedAlgo);
    if (schema) {
      onSelect(schema);
    }
  };

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--jp-border-color2)'
      }}
    >
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <select
          value={selectedAlgo}
          onChange={e => setSelectedAlgo(e.target.value)}
          style={{
            flex: 1,
            padding: '6px',
            borderRadius: '4px',
            border: '1px solid var(--jp-border-color2)'
          }}
        >
          <option value="" disabled>
            {loading ? '加载算法库...' : '选择一个算法...'}
          </option>
          {Object.entries(library).map(([category, nodes]) => (
            <optgroup key={category} label={category}>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          className="jp-Button"
          onClick={handleSelectClick}
          disabled={!selectedAlgo}
        >
          选择算法
        </button>
      </div>
    </div>
  );
};
