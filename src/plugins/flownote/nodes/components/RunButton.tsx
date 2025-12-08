import React, { useState } from 'react';

interface RunButtonProps {
  onClick: () => void;
  disabled: boolean;
}

/**
 * 节点运行按钮组件
 * 带悬停效果的运行按钮
 */
export const RunButton: React.FC<RunButtonProps> = ({ onClick, disabled }) => {
  const [hover, setHover] = useState(false);

  return (
    <button
      className="jp-Button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        fontSize: '11px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled
          ? 'var(--jp-layout-color3)'
          : hover
          ? 'var(--jp-brand-color2)'
          : 'var(--jp-brand-color1)',
        color: disabled ? 'var(--jp-ui-font-color3)' : '#fff',
        border: 'none',
        borderRadius: '4px',
        transition: 'background 0.2s',
        outline: 'none'
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
      >
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      运行
    </button>
  );
};
