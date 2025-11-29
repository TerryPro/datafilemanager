import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeSchema, Param } from '../types';
import { ServiceManager } from '@jupyterlab/services';

// Helper to render parameter inputs
const ParamInput = ({ 
  param, 
  value, 
  onChange, 
  serviceManager 
}: { 
  param: Param; 
  value: any; 
  onChange: (val: any) => void;
  serviceManager?: ServiceManager;
}) => {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    if (param.widget === 'file-selector' && serviceManager) {
      // Fetch files from dataset directory
      serviceManager.contents.get('dataset').then(model => {
         if (model.content && Array.isArray(model.content)) {
            const csvFiles = model.content
              .filter((item: any) => item.name.endsWith('.csv'))
              .map((item: any) => `dataset/${item.name}`);
            setFiles(csvFiles);
         }
      }).catch(err => console.error("Error fetching files:", err));
    }
  }, [param.widget, serviceManager]);

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '4px',
    borderRadius: '4px',
    border: '1px solid var(--jp-border-color2)',
    backgroundColor: 'var(--jp-input-active-background)',
    color: 'var(--jp-ui-font-color1)',
    fontSize: '12px'
  };

  if (param.widget === 'file-selector') {
     return (
        <select 
          className="nodrag"
          value={value || ''} 
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        >
           <option value="" disabled>Select file...</option>
           {files.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
     );
  }

  if (param.options) {
    return (
      <select 
        className="nodrag"
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        {param.options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (param.type === 'int' || param.type === 'float') {
    return (
      <input 
        type="number" 
        className="nodrag"
        value={value}
        onChange={(e) => onChange(param.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))}
        step={param.step || (param.type === 'float' ? 0.1 : 1)}
        min={param.min}
        max={param.max}
        style={inputStyle}
      />
    );
  }

  return (
    <input 
      type="text" 
      className="nodrag"
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    />
  );
};

export const GenericNode = memo(({ data, selected }: NodeProps) => {
  // data contains schema and values
  const schema: NodeSchema = data.schema;
  const [values, setValues] = useState<Record<string, any>>(data.values || {});
  
  // Initialize defaults
  useEffect(() => {
      const newValues = { ...values };
      let changed = false;
      schema.args?.forEach(arg => {
          if (newValues[arg.name] === undefined && arg.default !== undefined) {
              newValues[arg.name] = arg.default;
              changed = true;
          }
      });
      if (changed) {
          setValues(newValues);
          data.values = newValues; // Update data reference
      }
  }, [schema]);

  const handleParamChange = (name: string, val: any) => {
      const newValues = { ...values, [name]: val };
      setValues(newValues);
      data.values = newValues;
  };

  return (
    <div style={{ 
      padding: '0', 
      border: selected ? '2px solid var(--jp-brand-color1)' : '1px solid var(--jp-border-color2)', 
      borderRadius: '8px', 
      background: 'var(--jp-layout-color1)',
      minWidth: '200px',
      fontSize: '12px',
      boxShadow: selected ? '0 0 0 2px rgba(33, 150, 243, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      position: 'relative', // Ensure absolute children are relative to this
      overflow: 'visible',
      color: 'var(--jp-ui-font-color1)'
    }}>
      {/* Inputs (Top Edge) */}
      {schema.inputs && schema.inputs.length > 0 && (
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'space-around',
          zIndex: 10
        }}>
          {schema.inputs.map((port, idx) => (
            <div key={`in-${idx}`} style={{ position: 'relative', width: '1px', height: '1px', display: 'flex', justifyContent: 'center' }}>
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
               <span style={{ 
                 position: 'absolute', 
                 top: '-22px', 
                 color: 'var(--jp-ui-font-color2)', 
                 fontSize: '10px', 
                 whiteSpace: 'nowrap',
                 pointerEvents: 'none'
               }}>
                 {port.name}
               </span>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div style={{ 
        fontWeight: 600, 
        padding: '8px 12px', 
        background: 'var(--jp-layout-color2)',
        borderBottom: '1px solid var(--jp-border-color2)',
        textAlign: 'center',
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
        color: 'var(--jp-ui-font-color0)'
      }}>
        {schema.name}
      </div>

      <div style={{ padding: '12px' }}>
        {/* Parameters */}
        <div style={{ marginBottom: '4px' }}>
            {schema.args?.map(arg => (
                <div key={arg.name} style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', color: 'var(--jp-ui-font-color2)', fontSize: '10px', marginBottom: '2px' }}>{arg.label}</label>
                    <ParamInput 
                        param={arg} 
                        value={values[arg.name]} 
                        onChange={(val) => handleParamChange(arg.name, val)}
                        serviceManager={data.serviceManager}
                    />
                </div>
            ))}
        </div>
      </div>

      {/* Outputs (Bottom Edge) */}
      {schema.outputs && schema.outputs.length > 0 && (
        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'space-around',
          zIndex: 10
        }}>
          {schema.outputs.map((port, idx) => (
            <div key={`out-${idx}`} style={{ position: 'relative', width: '1px', height: '1px', display: 'flex', justifyContent: 'center' }}>
               <span style={{ 
                 position: 'absolute', 
                 bottom: '-22px', 
                 color: 'var(--jp-ui-font-color2)', 
                 fontSize: '10px', 
                 whiteSpace: 'nowrap',
                 pointerEvents: 'none'
               }}>
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
});
