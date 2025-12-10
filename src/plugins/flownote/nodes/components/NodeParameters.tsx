import React from 'react';
import { IParam, IColumn } from '../../types';
import { ParamInput } from '../../forms/ParamInput';
import { ServiceManager } from '@jupyterlab/services';

interface INodeParametersProps {
  args: IParam[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  serviceManager?: ServiceManager;
  inputColumns?: IColumn[];
}

/**
 * 节点参数表单组件
 * 显示节点的参数输入表单
 */
export const NodeParameters: React.FC<INodeParametersProps> = ({
  args,
  values,
  onChange,
  serviceManager,
  inputColumns = []
}) => {
  if (!args || args.length === 0) {
    return null;
  }

  // 如果参数超过 3 个，只显示关键参数
  const displayArgs =
    args.length > 3 ? args.filter(arg => arg.priority === 'critical') : args;

  const showHint = args.length > 3;

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ marginBottom: '4px' }}>
        {displayArgs.map((arg: IParam) => (
          <div key={arg.name} style={{ marginBottom: '8px' }}>
            <label
              style={{
                display: 'block',
                color: 'var(--jp-ui-font-color2)',
                fontSize: '10px',
                marginBottom: '2px'
              }}
            >
              {arg.label}
            </label>
            <ParamInput
              param={arg}
              value={values[arg.name]}
              onChange={val => onChange(arg.name, val)}
              serviceManager={serviceManager}
              columns={inputColumns}
              nodeValues={values}
            />
          </div>
        ))}
        {showHint && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--jp-ui-font-color2)'
            }}
          >
            仅显示关键参数，其余可在属性面板中配置
          </div>
        )}
      </div>
    </div>
  );
};
