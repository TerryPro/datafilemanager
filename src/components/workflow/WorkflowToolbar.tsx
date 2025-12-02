import React from 'react';
import { runIcon, cutIcon, copyIcon, searchIcon } from '@jupyterlab/ui-components';

interface IWorkflowToolbarProps {
  onRun: () => void;
  onDelete: () => void;
  onCopy?: () => void;
  onToggleMiniMap?: () => void;
  showMiniMap?: boolean;
}

const ToolbarButton = ({
  icon,
  onClick,
  title,
  enabled = true
}: {
  icon: any;
  onClick?: () => void;
  title: string;
  enabled?: boolean;
}) => {
  return (
    <button
      className={`jp-ToolbarButtonComponent jp-Button ${
        !enabled ? 'jp-mod-disabled' : ''
      }`}
      onClick={enabled ? onClick : undefined}
      title={title}
      style={{
        border: 'none',
        background: 'none',
        padding: '0 4px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: enabled ? 'pointer' : 'default',
        opacity: enabled ? 1 : 0.5
      }}
    >
      <icon.react
        tag="span"
        className="jp-ToolbarButtonComponent-icon"
        style={{ width: '14px', height: '14px' }}
      />
    </button>
  );
};

export const WorkflowToolbar = ({
  onRun,
  onDelete,
  onCopy,
  onToggleMiniMap,
  showMiniMap = false
}: IWorkflowToolbarProps) => {
  return (
    <div
      className="jp-Toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderBottom: '1px solid var(--jp-border-color2)',
        backgroundColor: 'var(--jp-layout-color1)',
        minHeight: '32px',
        flexShrink: 0
      }}
    >
      <ToolbarButton icon={runIcon} title="Generate Code" onClick={onRun} />
      <ToolbarButton
        icon={cutIcon}
        title="Delete Selected"
        onClick={onDelete}
      />
      <ToolbarButton
        icon={copyIcon}
        title="Copy Selected"
        onClick={onCopy}
        enabled={!!onCopy}
      />
      {onToggleMiniMap && (
        <ToolbarButton
          icon={searchIcon}
          title={showMiniMap ? "隐藏迷你地图" : "显示迷你地图"}
          onClick={onToggleMiniMap}
        />
      )}
    </div>
  );
};
