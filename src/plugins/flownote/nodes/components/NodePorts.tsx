import React from 'react';
import { Handle, Position } from 'reactflow';
import { IPort } from '../../types';

interface IPortProps {
  port: IPort;
  index: number;
  variableName?: string;
}

interface INodePortsProps {
  ports: IPort[];
  type: 'input' | 'output';
  variables?: Record<string, string>;
}

/**
 * 单个端口组件
 */
const Port: React.FC<IPortProps & { type: 'input' | 'output' }> = ({
  port,
  index,
  variableName,
  type
}) => {
  const isInput = type === 'input';
  const position = isInput ? Position.Top : Position.Bottom;
  const handleType = isInput ? 'target' : 'source';
  const verticalOffset = isInput ? '-6px' : '-6px';
  const labelOffset = isInput ? '-22px' : '-22px';
  const labelPosition = isInput ? 'top' : 'bottom';

  const displayLabel = variableName
    ? `${port.name} (${variableName})`
    : port.name;

  return (
    <div
      key={`${type}-${index}`}
      style={{
        position: 'relative',
        width: '1px',
        height: '1px',
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      <Handle
        type={handleType}
        position={position}
        id={port.name}
        style={{
          background: 'var(--jp-brand-color1)',
          width: '10px',
          height: '10px',
          [labelPosition]: verticalOffset,
          left: '50%',
          transform: 'translateX(-50%)',
          border: '2px solid var(--jp-layout-color1)',
          zIndex: 10
        }}
      />
      <span
        style={{
          position: 'absolute',
          [labelPosition]: labelOffset,
          color: 'var(--jp-ui-font-color2)',
          fontSize: '10px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none'
        }}
      >
        {displayLabel}
      </span>
    </div>
  );
};

/**
 * 节点端口组件
 * 渲染输入或输出端口列表
 */
export const NodePorts: React.FC<INodePortsProps> = ({
  ports,
  type,
  variables = {}
}) => {
  if (!ports || ports.length === 0) {
    return null;
  }

  const isInput = type === 'input';
  const verticalPosition = isInput ? 'top' : 'bottom';

  return (
    <div
      style={{
        position: 'absolute',
        [verticalPosition]: 0,
        left: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'space-around',
        zIndex: 10
      }}
    >
      {ports.map((port, idx) => (
        <Port
          key={`${type}-${idx}`}
          port={port}
          index={idx}
          variableName={variables[port.name]}
          type={type}
        />
      ))}
    </div>
  );
};
