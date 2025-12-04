import React, { memo, useEffect, useState } from 'react';
import { NodeProps } from 'reactflow';
import { INodeData, INodeSchema } from '../types';

/**
 * 空节点组件：用于表示 Notebook 中的空 Cell
 * - 显示占位卡片与算法选择框
 * - 选择算法后触发回调以将 Cell 转换为具体算法节点
 */
export const FlowEmptyNode = memo(({ id, data }: NodeProps<INodeData>) => {
  const [library, setLibrary] = useState<Record<string, INodeSchema[]>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const response = await fetch('/aiserver/function-library');
        if (response.ok) {
          const json = await response.json();
          setLibrary(json);
        } else {
          console.error(
            'FlowEmptyNode: fetch library failed',
            response.statusText
          );
        }
      } catch (e) {
        console.error('FlowEmptyNode: error fetching library', e);
      } finally {
        setLoading(false);
      }
    };
    fetchLibrary();
  }, []);

  const allSchemas: INodeSchema[] = Object.values(library).flat();

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelected(val);
    const schema = allSchemas.find(s => s.id === val);
    if (schema && typeof data.onSelectAlgorithm === 'function') {
      data.onSelectAlgorithm(id, schema);
    }
  };

  return (
    <div
      style={{
        border: '1px dashed var(--jp-border-color2)',
        borderRadius: '8px',
        background: 'var(--jp-layout-color1)',
        width: '300px',
        color: 'var(--jp-ui-font-color1)'
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--jp-layout-color2)',
          borderBottom: '1px solid var(--jp-border-color2)',
          fontWeight: 600
        }}
      >
        空步骤（请选择算法）
      </div>
      <div style={{ padding: '12px' }}>
        {loading ? (
          <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
            加载算法库...
          </div>
        ) : (
          <>
            <select
              value={selected}
              onChange={handleSelect}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid var(--jp-border-color2)'
              }}
            >
              <option value="" disabled>
                选择一个算法...
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
            <div style={{ marginTop: '10px' }}>
              <button
                className="jp-Button"
                onClick={() => {
                  if (typeof (data as any).onSelectFreeCell === 'function') {
                    (data as any).onSelectFreeCell(id);
                  }
                }}
                style={{ width: '100%' }}
              >
                转为自由CELL（可自由编辑代码）
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
