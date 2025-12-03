import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

import { INodeSchema } from '../types';

interface IPlotNodeData {
  plotType: string;
  column: string;
  columns?: string[]; // Received from upstream
  values?: Record<string, any>;
  schema?: INodeSchema;
}

export const PlotNode = memo(
  ({ data, selected }: { data: IPlotNodeData; selected?: boolean }) => {
    const [, forceUpdate] = React.useState({});

    const inputStyle = {
      width: '100%',
      boxSizing: 'border-box' as const,
      padding: '4px',
      borderRadius: '4px',
      border: '1px solid var(--jp-border-color2)',
      backgroundColor: 'var(--jp-input-active-background)',
      color: 'var(--jp-ui-font-color1)',
      fontSize: '12px',
      marginBottom: '6px'
    };

    return (
      <div
        style={{
          padding: '0',
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          position: 'relative',
          overflow: 'visible',
          color: 'var(--jp-ui-font-color1)',
          cursor: 'move'
        }}
      >
        {/* Input Handle (Top Edge) */}
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
          <div
            style={{
              position: 'relative',
              width: '1px',
              height: '1px',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
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
                pointerEvents: 'none'
              }}
            >
              df
            </span>
          </div>
        </div>

        <div
          style={{
            fontWeight: 600,
            padding: '8px 12px',
            background: 'var(--jp-layout-color2)',
            borderBottom: '1px solid var(--jp-border-color2)',
            textAlign: 'center',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            color: 'var(--jp-ui-font-color0)'
          }}
        >
          Plot
        </div>

        <div style={{ padding: '12px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '2px',
              color: 'var(--jp-ui-font-color2)',
              fontSize: '10px'
            }}
          >
            Type:
          </label>
          <select
            className="nodrag"
            defaultValue={data.plotType || 'line'}
            onChange={evt => {
              const val = evt.target.value;
              data.plotType = val;
              if (!data.values) {
                data.values = {};
              }
              data.values['plot_type'] = val;
              forceUpdate({});
            }}
            style={inputStyle}
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            <option value="scatter">Scatter</option>
          </select>

          <label
            style={{
              display: 'block',
              marginBottom: '2px',
              color: 'var(--jp-ui-font-color2)',
              fontSize: '10px'
            }}
          >
            Column:
          </label>
          {data.columns && data.columns.length > 0 ? (
            <select
              className="nodrag"
              defaultValue={data.column || ''}
              onChange={evt => {
                const val = evt.target.value;
                data.column = val;
                if (!data.values) {
                  data.values = {};
                }
                data.values['column'] = val;
                forceUpdate({});
              }}
              style={{ ...inputStyle, marginBottom: '0' }}
            >
              <option value="" disabled>
                Select...
              </option>
              {data.columns.map(col => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="nodrag"
              type="text"
              placeholder="Wait for input..."
              defaultValue={data.column || ''}
              onChange={evt => {
                const val = evt.target.value;
                data.column = val;
                if (!data.values) {
                  data.values = {};
                }
                data.values['column'] = val;
                forceUpdate({});
              }}
              style={{ ...inputStyle, marginBottom: '0' }}
              title="Connect to a CSV Loader to select columns"
            />
          )}
        </div>
      </div>
    );
  }
);
