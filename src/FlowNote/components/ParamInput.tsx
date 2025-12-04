import React, { useState, useEffect } from 'react';
import { ServiceManager, Contents } from '@jupyterlab/services';
import { PageConfig } from '@jupyterlab/coreutils';
import { IParam, IColumn } from '../types';
import { ColumnSelector } from './ColumnSelector';

interface IParamInputProps {
  param: IParam;
  value: any;
  onChange: (val: any) => void;
  serviceManager?: ServiceManager;
  columns?: IColumn[];
  nodeValues?: Record<string, any>;
}

/**
 * 渲染节点参数的输入控件
 * - 支持 column-selector、file-selector、variable-selector、数值与文本等
 */
/**
 * 渲染节点参数输入控件
 * - 支持列选择、文件选择、变量选择、数字/文本
 * - 当为时间索引参数时，自动从已选文件解析列名供选择
 */
export const ParamInput: React.FC<IParamInputProps> = ({
  param,
  value,
  onChange,
  serviceManager,
  columns,
  nodeValues
}) => {
  const [files, setFiles] = useState<string[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileColumns, setFileColumns] = useState<string[]>([]);

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
    if (param.widget === 'file-selector') {
      setLoading(true);
      const loadViaServices = async () => {
        try {
          if (!serviceManager) {
            return false;
          }
          const model = await serviceManager.contents.get('dataset');
          if (model.content && Array.isArray(model.content)) {
            const csvFiles = model.content
              .filter((item: Contents.IModel) => item.name.endsWith('.csv'))
              .map((item: Contents.IModel) => `dataset/${item.name}`);
            setFiles(csvFiles);
          }
          return true;
        } catch (err) {
          console.error('ParamInput:file-selector serviceManager error:', err);
          return false;
        }
      };

      const loadViaFetch = async () => {
        try {
          const baseUrl = PageConfig.getBaseUrl();
          const resp = await fetch(`${baseUrl}api/contents/dataset?content=1`);
          if (resp.ok) {
            const model = await resp.json();
            if (model.content && Array.isArray(model.content)) {
              const csvFiles = model.content
                .filter((item: any) => item.name && item.name.endsWith('.csv'))
                .map((item: any) => `dataset/${item.name}`);
              setFiles(csvFiles);
            }
          } else {
            console.error(
              'ParamInput:file-selector fetch error:',
              resp.statusText
            );
          }
        } catch (err) {
          console.error('ParamInput:file-selector fetch exception:', err);
        }
      };

      (async () => {
        const ok = await loadViaServices();
        if (!ok) {
          await loadViaFetch();
        }
        setLoading(false);
      })();
    }
  }, [param.widget, serviceManager]);

  useEffect(() => {
    const isTimeIndexParam =
      param.widget === 'time-index' ||
      param.name === 'timeIndex' ||
      param.name === 'time_index';
    if (!isTimeIndexParam) {
      return;
    }
    const baseUrl = PageConfig.getBaseUrl();
    const filepath = (nodeValues && nodeValues['filepath']) || value;
    if (!filepath) {
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const resp = await fetch(
          `${baseUrl}api/contents/${encodeURIComponent(
            filepath
          )}?content=1&format=text`
        );
        if (resp.ok) {
          const model = await resp.json();
          const content = model.content || '';
          const firstLine = content.split('\n')[0] || '';
          const cols = firstLine
            .split(',')
            .map((c: string) => c.trim())
            .filter((c: string) => c.length > 0);
          setFileColumns(cols);
        }
      } catch (err) {
        console.error('ParamInput:time-index fetch exception:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [param.widget, param.name, nodeValues?.filepath]);

  useEffect(() => {
    const fetchVariables = async () => {
      if (param.widget === 'variable-selector' && serviceManager) {
        setLoading(true);
        try {
          const sessions = Array.from(serviceManager.sessions.running());
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
          {loading ? 'Loading...' : 'Select file...'}
        </option>
        {files.map(f => (
          <option key={f} value={f}>
            {f.split('/').pop()}
          </option>
        ))}
      </select>
    );
  }

  if (
    param.widget === 'time-index' ||
    param.name === 'timeIndex' ||
    param.name === 'time_index'
  ) {
    return (
      <select
        className="nodrag"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
        disabled={loading}
      >
        <option value="">无（普通DataFrame）</option>
        {fileColumns.map(col => (
          <option key={col} value={col}>
            {col}
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
