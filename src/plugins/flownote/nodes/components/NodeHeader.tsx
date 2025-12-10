import React from 'react';
import { StatusIcon, getStatusLabel, NodeStatus } from './StatusIcon';
import { RunButton } from './RunButton';

interface INodeHeaderProps {
  nodeNumber?: number;
  nodeName: string;
  status: NodeStatus;
  onRun: () => void;
  disableRun: boolean;
}

/**
 * 节点头部组件
 * 显示节点编号、名称、状态和运行按钮
 */
export const NodeHeader: React.FC<INodeHeaderProps> = ({
  nodeNumber,
  nodeName,
  status,
  onRun,
  disableRun
}) => {
  const statusLabel = getStatusLabel(status);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'var(--jp-layout-color2)',
        borderBottom: '1px solid var(--jp-border-color2)',
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
        gap: '8px'
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: 'var(--jp-ui-font-color0)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          flex: 1
        }}
      >
        {typeof nodeNumber === 'number' && (
          <span>N{String(nodeNumber).padStart(2, '0')}</span>
        )}
        <span style={{ marginLeft: '4px' }}>{nodeName}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          title={`当前状态: ${statusLabel}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: 'var(--jp-ui-font-color2)'
          }}
        >
          <StatusIcon status={status} />
          <span style={{ display: 'none' }}>{statusLabel}</span>
        </div>
        <RunButton disabled={disableRun} onClick={onRun} />
      </div>
    </div>
  );
};
