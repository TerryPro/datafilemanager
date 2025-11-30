import React from 'react';
import { Node } from 'reactflow';
import { INodeSchema, IParam } from './types';
import { ParamInput } from './ParamInput';
import { ServiceManager } from '@jupyterlab/services';

interface IPropertyPanelProps {
  selectedNode: Node | null;
  onChange: (nodeId: string, values: Record<string, any>) => void;
  serviceManager?: ServiceManager;
}

export const PropertyPanel: React.FC<IPropertyPanelProps> = ({
  selectedNode,
  onChange,
  serviceManager
}) => {
  if (!selectedNode) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--jp-layout-color1)',
          padding: '16px',
          color: 'var(--jp-ui-font-color2)',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          textAlign: 'center'
        }}
      >
        <div style={{ marginBottom: '8px', fontSize: '24px', opacity: 0.3 }}>🖱️</div>
        Select a node to configure its properties
      </div>
    );
  }

  const schema = selectedNode.data.schema as INodeSchema;
  const values = selectedNode.data.values || {};

  const handleParamChange = (name: string, value: any) => {
    const newValues = { ...values, [name]: value };
    onChange(selectedNode.id, newValues);
  };

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: 'var(--jp-layout-color1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--jp-border-color2)',
          backgroundColor: 'var(--jp-layout-color2)',
          fontWeight: 600,
          color: 'var(--jp-ui-font-color0)',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <div style={{ marginRight: '8px' }}>⚙️</div>
        {schema.name || 'Node Properties'}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--jp-ui-font-color2)', marginBottom: '4px' }}>
            NODE ID
          </label>
          <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color1)', fontFamily: 'monospace', background: 'var(--jp-layout-color2)', padding: '4px', borderRadius: '4px' }}>
            {selectedNode.id}
          </div>
        </div>

        {schema.args && schema.args.length > 0 ? (
          schema.args.map((arg: IParam) => (
            <div key={arg.name} style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--jp-ui-font-color1)',
                  marginBottom: '6px'
                }}
              >
                {arg.label}
              </label>
              <ParamInput
                param={arg}
                value={values[arg.name]}
                onChange={val => handleParamChange(arg.name, val)}
                serviceManager={selectedNode.data.serviceManager || serviceManager}
              />
              {arg.description && (
                <div style={{ fontSize: '11px', color: 'var(--jp-ui-font-color2)', marginTop: '4px', lineHeight: '1.4' }}>
                  {arg.description}
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--jp-ui-font-color2)', fontStyle: 'italic' }}>
            No configuration parameters available for this node.
          </div>
        )}
      </div>
    </div>
  );
};
