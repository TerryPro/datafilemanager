import React, { memo, useState, useEffect, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { INodeSchema, IColumn, INodeData } from '../types';
import {
  useAlgorithmLibrary,
  NodePorts,
  NodeHeader,
  AlgorithmSelector,
  NodeParameters
} from './components';

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
        console.log('FlowGenericNode: No inputColumns in metadata', id);
        return [];
      }
      console.log(
        'FlowGenericNode: inputColumns raw:',
        data.metadata.inputColumns
      );
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
      console.log('FlowGenericNode: inputColumns flattened:', allCols);
      return allCols;
    }, [data.metadata, id]);

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
    const { library, allSchemas, loading } = useAlgorithmLibrary();
    const status = data.metadata?.status || 'unconfigured';
    const isFreeCell = schema.category === 'free';

    const handleAlgorithmSelect = (schema: INodeSchema) => {
      if (typeof (data as any).onSelectAlgorithm === 'function') {
        (data as any).onSelectAlgorithm(id, schema);
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
        {!isFreeCell && (
          <NodePorts
            ports={schema.inputs || []}
            type="input"
            variables={(data as any).inputVariables}
          />
        )}

        <NodeHeader
          nodeNumber={(data as any).number}
          nodeName={schema.name}
          status={status}
          onRun={() => {
            if (typeof (data as any).onRunNode === 'function') {
              (data as any).onRunNode(id);
            }
          }}
          disableRun={
            status === 'running' || isFreeCell || status === 'unconfigured'
          }
        />

        {isFreeCell && (
          <AlgorithmSelector
            library={library}
            allSchemas={allSchemas}
            loading={loading}
            onSelect={handleAlgorithmSelect}
          />
        )}

        <NodeParameters
          args={schema.args || []}
          values={values}
          onChange={handleParamChange}
          serviceManager={data.serviceManager}
          inputColumns={inputColumns}
        />

        {!isFreeCell && (
          <NodePorts
            ports={schema.outputs || []}
            type="output"
            variables={(data as any).outputVariables}
          />
        )}
      </div>
    );
  }
);
