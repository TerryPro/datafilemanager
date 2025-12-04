import React from 'react';
import { Node } from 'reactflow';
import { INodeSchema, IColumn } from '../types';
import { ParamInput } from './ParamInput';
import { ServiceManager } from '@jupyterlab/services';

interface IPropertyPanelProps {
  selectedNode: Node | null;
  onChange: (nodeId: string, values: Record<string, any>) => void;
  serviceManager?: ServiceManager;
}

/**
 * 属性面板：展示并编辑选中节点的参数
 */
/**
 * 属性面板：展示并编辑选中节点的参数
 * - 接收 ServiceManager 以支持文件/变量选择器的数据源
 */
export const FlowPropertyPanel: React.FC<IPropertyPanelProps> = ({
  selectedNode,
  onChange,
  serviceManager
}) => {
  const inputColumns = React.useMemo(() => {
    if (!selectedNode?.data.metadata?.inputColumns) {
      return [];
    }
    const allCols: IColumn[] = [];
    const seen = new Set<string>();
    const inputCols = selectedNode.data.metadata.inputColumns as Record<
      string,
      IColumn[]
    >;
    Object.values(inputCols)
      .flat()
      .forEach(col => {
        if (!seen.has(col.name)) {
          seen.add(col.name);
          allCols.push(col);
        }
      });
    return allCols;
  }, [selectedNode?.data.metadata]);

  if (!selectedNode) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--jp-layout-color1)',
          padding: '16px',
          color: 'var(--jp-ui-font-color2)',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          textAlign: 'center'
        }}
      >
        <div style={{ marginBottom: '8px', fontSize: '24px', opacity: 0.3 }}>
          🖱️
        </div>
        请选择一个节点以配置其属性
      </div>
    );
  }

  const schema = selectedNode.data.schema as INodeSchema;
  const values = selectedNode.data.values || {};

  const handleParamChange = (name: string, value: any) => {
    const newValues = { ...values, [name]: value };
    onChange(selectedNode.id, newValues);
  };

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: 'var(--jp-layout-color1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--jp-border-color2)',
          backgroundColor: 'var(--jp-layout-color2)',
          fontWeight: 600,
          color: 'var(--jp-ui-font-color0)',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <div style={{ marginRight: '8px' }}>⚙️</div>
        {schema.name || '节点属性'}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          {schema.args && schema.args.length > 0 ? (
            schema.args.map(arg => (
              <div key={arg.name} style={{ marginBottom: '8px' }}>
                <label
                  style={{
                    display: 'block',
                    color: 'var(--jp-ui-font-color2)',
                    fontSize: '10px',
                    marginBottom: '2px'
                  }}
                >
                  {arg.label || arg.name}
                </label>
                <ParamInput
                  param={arg}
                  value={values[arg.name]}
                  onChange={val => handleParamChange(arg.name, val)}
                  columns={inputColumns}
                  serviceManager={
                    serviceManager ||
                    (selectedNode?.data?.serviceManager as any)
                  }
                  nodeValues={values}
                />
              </div>
            ))
          ) : (
            <div
              style={{ color: 'var(--jp-ui-font-color2)', fontSize: '12px' }}
            >
              无可配置参数
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
