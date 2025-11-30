import React, { memo, useState, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { INodeSchema, IParam, IPort, IColumn, INodeData } from '../types';
import { ParamInput } from '../ParamInput';

export const GenericNode = memo(
  ({ id, data, selected }: NodeProps<INodeData>) => {
    const { onFileChange, onValuesChange } = data;
    const schema = data.schema as INodeSchema;

    // Local state for parameter values, initialized from data.values
    const [values, setValues] = useState<Record<string, any>>(
      data.values || {}
    );

    // Sync local state if data.values changes externally (e.g. load)
    useEffect(() => {
      if (data.values) {
        setValues(data.values);
      }
    }, [data.values]);

    // Extract available columns from metadata
    const inputColumns = useMemo(() => {
      if (!data.metadata?.inputColumns) {
        return [];
      }
      // Flatten all input port columns
      // Use Set to remove duplicates if any (though same name from different ports is possible)
      const allCols: IColumn[] = [];
      const seen = new Set<string>();

      const colsArrays = Object.values(
        data.metadata.inputColumns
      ) as IColumn[][];
      colsArrays.flat().forEach((col: IColumn) => {
        if (!seen.has(col.name)) {
          seen.add(col.name);
          allCols.push(col);
        }
      });
      return allCols;
    }, [data.metadata]);

    const handleParamChange = (name: string, value: any) => {
      const newValues = { ...values, [name]: value };
      setValues(newValues);

      // Update node data reference
      data.values = newValues;

      // Notify parent to trigger ReactFlow update (essential for propagation hook)
      if (onValuesChange) {
        onValuesChange(id, newValues);
      }

      // Specific logic for CSV Loader to trigger column detection (Legacy? Kept for safety)
      if (schema.id === 'load_csv' && name === 'filepath') {
        if (onFileChange) {
          onFileChange(id, value);
        }
      }
    };

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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          position: 'relative', // Ensure absolute children are relative to this
          overflow: 'visible',
          color: 'var(--jp-ui-font-color1)',
          cursor: 'move'
        }}
      >
        {/* Inputs (Top Edge) */}
        {schema.inputs && schema.inputs.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              display: 'flex',
              justifyContent: 'space-around',
              zIndex: 10
            }}
          >
            {schema.inputs.map((port: IPort, idx: number) => (
              <div
                key={`in-${idx}`}
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
                  id={port.name}
                  style={{
                    background: 'var(--jp-brand-color1)',
                    width: '10px',
                    height: '10px',
                    top: '-6px', // Center on the top border (approx half of 10px + border width)
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
                  {port.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
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
          {schema.name}
        </div>

        <div style={{ padding: '12px' }}>
          {/* Parameters */}
          <div style={{ marginBottom: '4px' }}>
            {schema.args?.map((arg: IParam) => (
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
                  onChange={val => handleParamChange(arg.name, val)}
                  serviceManager={data.serviceManager}
                  columns={inputColumns}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Outputs (Bottom Edge) */}
        {schema.outputs && schema.outputs.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              display: 'flex',
              justifyContent: 'space-around',
              zIndex: 10
            }}
          >
            {schema.outputs.map((port: IPort, idx: number) => (
              <div
                key={`out-${idx}`}
                style={{
                  position: 'relative',
                  width: '1px',
                  height: '1px',
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    bottom: '-22px',
                    color: 'var(--jp-ui-font-color2)',
                    fontSize: '10px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none'
                  }}
                >
                  {port.name}
                </span>
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={port.name}
                  style={{
                    background: 'var(--jp-brand-color1)',
                    width: '10px',
                    height: '10px',
                    bottom: '-6px', // Center on the bottom border
                    left: '50%',
                    transform: 'translateX(-50%)',
                    border: '2px solid var(--jp-layout-color1)',
                    zIndex: 10
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);
