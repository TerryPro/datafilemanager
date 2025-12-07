import React from 'react';

export type NodeStatus =
  | 'unconfigured'
  | 'configured'
  | 'running'
  | 'success'
  | 'failed';

interface StatusIconProps {
  status: NodeStatus;
}

/**
 * 节点状态图标组件
 * 根据节点状态显示不同的图标和颜色
 */
export const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  const getStatusColor = (s: NodeStatus): string => {
    switch (s) {
      case 'running':
        return '#2196f3';
      case 'success':
        return '#4caf50';
      case 'failed':
        return '#f44336';
      case 'configured':
        return '#2196f3';
      default:
        return '#9e9e9e';
    }
  };

  const color = getStatusColor(status);
  const commonProps = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  switch (status) {
    case 'running':
      return (
        <svg {...commonProps} className="jp-icon-spin">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          <style>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
            .jp-icon-spin { animation: spin 1s linear infinite; }
          `}</style>
        </svg>
      );
    case 'success':
      return (
        <svg {...commonProps}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'failed':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case 'configured':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
    default:
      // unconfigured
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
};

/**
 * 获取状态的中文标签
 */
export const getStatusLabel = (status: NodeStatus): string => {
  switch (status) {
    case 'running':
      return '运行中';
    case 'success':
      return '成功';
    case 'failed':
      return '失败';
    case 'configured':
      return '已配置';
    default:
      return '未配置';
  }
};
