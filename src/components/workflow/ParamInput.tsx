import React, { useState, useEffect } from 'react';
import { ServiceManager, Contents } from '@jupyterlab/services';
import { IParam, IColumn } from './types';
import { ColumnSelector } from './ColumnSelector';

interface IParamInputProps {
  param: IParam;
  value: any;
  onChange: (val: any) => void;
  serviceManager?: ServiceManager;
  columns?: IColumn[]; // Available input columns
}

export const ParamInput: React.FC<IParamInputProps> = ({
  param,
  value,
  onChange,
  serviceManager,
  columns
}) => {
  const [files, setFiles] = useState<string[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Detect if this param should use ColumnSelector
  const isColumnParam =
    param.widget === 'column-selector' ||
    ['columns', 'by', 'on', 'subset', 'index', 'values'].includes(param.name);

  if (isColumnParam) {
    const isMultiple = param.type === 'list' || Array.isArray(param.default);
    return (
      <ColumnSelector
        value={value}
        onChange={onChange}
        columns={columns || []}
        multiple={isMultiple}
        placeholder={param.label || param.name}
      />
    );
  }

  useEffect(() => {
    if (param.widget === 'file-selector' && serviceManager) {
      // Fetch files from dataset directory
      serviceManager.contents
        .get('dataset')
        .then(model => {
          if (model.content && Array.isArray(model.content)) {
            const csvFiles = model.content
              .filter((item: Contents.IModel) => item.name.endsWith('.csv'))
              .map((item: Contents.IModel) => `dataset/${item.name}`);
            setFiles(csvFiles);
          }
        })
        .catch(err => console.error('Error fetching files:', err));
    }
  }, [param.widget, serviceManager]);

  // Fetch variables from Kernel
  useEffect(() => {
    const fetchVariables = async () => {
      if (param.widget === 'variable-selector' && serviceManager) {
        setLoading(true);
        try {
          // Find an active session
          const sessions = Array.from(serviceManager.sessions.running());
          // Prefer the most recently started or used session if possible, or just the first one
          const sessionModel = sessions[0];

          if (sessionModel) {
            const sessionConnection = serviceManager.sessions.connectTo({
              model: sessionModel
            });

            if (sessionConnection.kernel) {
              const code = `
import pandas as pd
import json
print(json.dumps([v for v in globals().keys() if not v.startswith('_') and isinstance(globals()[v], pd.DataFrame)]))
`;
              const future = sessionConnection.kernel.requestExecute({ code });

              future.onIOPub = (msg: any) => {
                if (
                  msg.header.msg_type === 'stream' &&
                  msg.content.name === 'stdout'
                ) {
                  try {
                    const vars = JSON.parse(msg.content.text);
                    setVariables(vars);
                  } catch (e) {
                    console.error('Failed to parse variables list', e);
                  }
                }
              };
              await future.done;
            }
          } else {
            console.warn('No active kernel session found to fetch variables.');
          }
        } catch (err) {
          console.error('Error fetching variables:', err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchVariables();
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

  if (param.type === 'bool') {
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          style={{ marginRight: '8px' }}
        />
        <span style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
          {param.description}
        </span>
      </div>
    );
  }

  if (param.widget === 'file-selector') {
    return (
      <select
        className="nodrag"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      >
        <option value="" disabled>
          Select file...
        </option>
        {files.map(f => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    );
  }

  if (param.widget === 'variable-selector') {
    return (
      <div style={{ position: 'relative' }}>
        <select
          className="nodrag"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={inputStyle}
          disabled={loading}
        >
          <option value="" disabled>
            {loading ? 'Loading...' : 'Select variable...'}
          </option>
          {variables.map(v => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        {!loading && variables.length === 0 && (
          <div style={{ fontSize: '10px', color: 'orange' }}>
            No DataFrame vars found
          </div>
        )}
      </div>
    );
  }

  if (param.options) {
    return (
      <select
        className="nodrag"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      >
        {param.options.map((opt: string) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
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
        onChange={e =>
          onChange(
            param.type === 'int'
              ? parseInt(e.target.value)
              : parseFloat(e.target.value)
          )
        }
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
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={inputStyle}
      placeholder={param.description}
    />
  );
};
