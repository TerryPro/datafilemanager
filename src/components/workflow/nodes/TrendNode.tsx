import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { INodeSchema } from '../types';
export const TrendNode = memo(({ data, selected }: NodeProps) => {
  const schema = data.schema as INodeSchema;
  const [values] = useState<Record<string, any>>(data.values || {});

  // Initialize defaults if missing
  // Note: We don't force update `data.values` here to avoid loops, just use merged for display
  const mergedValues = { ...values };
  schema.args?.forEach(arg => {
    if (mergedValues[arg.name] === undefined) {
      mergedValues[arg.name] = arg.default;
    }
  });

  return (
    <div
      style={{
        border: selected
          ? '2px solid var(--jp-brand-color1)'
          : '1px solid var(--jp-border-color2)',
        borderRadius: '8px',
        background: 'var(--jp-layout-color1)',
        minWidth: '200px',
        fontSize: '12px',
        boxShadow: selected
          ? '0 0 0 2px rgba(33, 150, 243, 0.3)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        color: 'var(--jp-ui-font-color1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'visible',
        cursor: 'move'
      }}
    >
      {/* Input Handle (Top) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 10
        }}
      >
        <div style={{ position: 'relative', width: '1px', height: '1px' }}>
          <Handle
            type="target"
            position={Position.Top}
            id="df_in"
            style={{
              background: 'var(--jp-brand-color1)',
              width: '10px',
              height: '10px',
              top: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              border: '2px solid var(--jp-layout-color1)',
              zIndex: 10
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: '-22px',
              color: 'var(--jp-ui-font-color2)',
              fontSize: '10px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              left: '-12px'
            }}
          >
            df_in
          </span>
        </div>
      </div>

      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--jp-border-color2)',
          background: 'var(--jp-layout-color2)',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          fontWeight: 600,
          textAlign: 'center',
          color: 'var(--jp-ui-font-color0)'
        }}
      >
        {schema.name}
      </div>

      {/* Content */}
      <div style={{ padding: '12px' }}>
        <div
          style={{
            marginBottom: '6px',
            fontSize: '11px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          <strong>标题:</strong> {mergedValues.title || '未命名'}
        </div>
        <div
          style={{
            marginBottom: '6px',
            fontSize: '11px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          <strong>X轴:</strong> {mergedValues.x_column || '(使用索引)'}
        </div>
        <div
          style={{
            marginBottom: '12px',
            fontSize: '11px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          <strong>Y轴:</strong> {mergedValues.y_columns || '(所有数值列)'}
        </div>
      </div>

      {/* Output Handle (Bottom) - Pass-through */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 10
        }}
      >
        <div style={{ position: 'relative', width: '1px', height: '1px' }}>
          <span
            style={{
              position: 'absolute',
              bottom: '-22px',
              color: 'var(--jp-ui-font-color2)',
              fontSize: '10px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              left: '-15px'
            }}
          >
            df_out
          </span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="df_out"
            style={{
              background: 'var(--jp-brand-color1)',
              width: '10px',
              height: '10px',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              border: '2px solid var(--jp-layout-color1)',
              zIndex: 10
            }}
          />
        </div>
      </div>
    </div>
  );
});
