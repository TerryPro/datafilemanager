import React, { memo, useState, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { INodeSchema, IParam, IPort, IColumn, INodeData } from '../types';
import { ParamInput } from '../components/ParamInput';

/**
 * 状态图标组件
 */
const StatusIcon = ({ status }: { status: string }) => {
  const getStatusColor = (s: string) => {
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
 * 运行按钮组件
 */
const RunButton = ({
  onClick,
  disabled
}: {
  onClick: () => void;
  disabled: boolean;
}) => {
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

/**
 * 通用节点组件：显示端口与参数，并支持属性更新回调
 */
export const FlowGenericNode = memo(
  ({ id, data, selected }: NodeProps<INodeData>) => {
    const { onFileChange, onValuesChange } = data;
    const schema = data.schema as INodeSchema;

    const [values, setValues] = useState<Record<string, any>>(
      data.values || {}
    );

    useEffect(() => {
      if (data.values) {
        setValues(data.values);
      }
    }, [data.values]);

    const inputColumns = useMemo(() => {
      if (!data.metadata?.inputColumns) {
        return [];
      }
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
      data.values = newValues;
      if (onValuesChange) {
        onValuesChange(id, newValues);
      }
      if (schema.id === 'load_csv' && name === 'filepath') {
        if (onFileChange) {
          onFileChange(id, value);
        }
      }
    };

    // 若为自由CELL，提供选择算法的UI
    const [library, setLibrary] = useState<Record<string, INodeSchema[]>>({});
    const [loading, setLoading] = useState(false);
    const [selectedAlgo, setSelectedAlgo] = useState<string>('');

    useEffect(() => {
      if (schema.category === 'free') {
        setLoading(true);
        fetch('/aiserver/function-library')
          .then(r => (r.ok ? r.json() : {}))
          .then(json => setLibrary(json || {}))
          .catch(e => {
            console.error('FlowGenericNode: function-library fetch error', e);
          })
          .finally(() => setLoading(false));
      }
    }, [schema.category]);

    const status = data.metadata?.status || 'unconfigured';

    const statusLabel = (() => {
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
    })();

    return (
      <div
        style={{
          border: selected
            ? '2px solid var(--jp-brand-color1)'
            : '1px solid var(--jp-border-color2)',
          borderRadius: '8px',
          background: 'var(--jp-layout-color1)',
          width: '300px',
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
          cursor: 'move',
          transition: 'all 0.2s ease'
        }}
      >
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
                  {port.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 头部区域：标题与状态栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'var(--jp-layout-color2)',
            borderBottom: '1px solid var(--jp-border-color2)',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            gap: '8px'
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: 'var(--jp-ui-font-color0)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              flex: 1
            }}
          >
            {typeof (data as any).number === 'number'
              ? `N${String((data as any).number).padStart(2, '0')}`
              : ''}
            <span style={{ marginLeft: '4px' }}>{schema.name}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              title={`当前状态: ${statusLabel}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: 'var(--jp-ui-font-color2)'
              }}
            >
              <StatusIcon status={status} />
              <span style={{ display: 'none' }}>{statusLabel}</span>
            </div>
            <RunButton
              disabled={
                status === 'running' ||
                schema.category === 'free' ||
                status === 'unconfigured'
              }
              onClick={() => {
                if (typeof (data as any).onRunNode === 'function') {
                  (data as any).onRunNode(id);
                }
              }}
            />
          </div>
        </div>

        {schema.category === 'free' && (
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--jp-border-color2)'
            }}
          >
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select
                value={selectedAlgo}
                onChange={e => setSelectedAlgo(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: '4px',
                  border: '1px solid var(--jp-border-color2)'
                }}
              >
                <option value="" disabled>
                  {loading ? '加载算法库...' : '选择一个算法...'}
                </option>
                {Object.entries(library).map(([category, nodes]) => (
                  <optgroup key={category} label={category}>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                className="jp-Button"
                onClick={() => {
                  const allSchemas: INodeSchema[] =
                    Object.values(library).flat();
                  const s = allSchemas.find(x => x.id === selectedAlgo);
                  if (
                    s &&
                    typeof (data as any).onSelectAlgorithm === 'function'
                  ) {
                    (data as any).onSelectAlgorithm(id, s);
                  }
                }}
              >
                选择算法
              </button>
            </div>
          </div>
        )}

        <div style={{ padding: '12px' }}>
          <div style={{ marginBottom: '4px' }}>
            {schema.args && schema.args.length > 0 && (
              <>
                {(() => {
                  let displayArgs = schema.args;
                  if (schema.args.length > 3) {
                    displayArgs = schema.args.filter(
                      arg => arg.priority === 'critical'
                    );
                  }
                  return displayArgs;
                })().map((arg: IParam) => (
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
                      nodeValues={values}
                    />
                  </div>
                ))}
                {schema.args.length > 3 && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--jp-ui-font-color2)'
                    }}
                  >
                    仅显示关键参数，其余可在属性面板中配置
                  </div>
                )}
              </>
            )}
          </div>
        </div>

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
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={port.name}
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
                  {(() => {
                    const varName = (data as any).outputVariables?.[port.name];
                    return varName ? `${port.name} (${varName})` : port.name;
                  })()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);
