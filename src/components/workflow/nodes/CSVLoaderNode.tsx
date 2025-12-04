import React, { memo, useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { ServiceManager, Contents } from '@jupyterlab/services';

import { INodeSchema } from '../types';

interface ICSVLoaderNodeData {
  id: string;
  filepath: string;
  timeIndex: string;
  serviceManager?: ServiceManager;
  onFileChange?: (nodeId: string, filepath: string) => void;
  onTimeIndexChange?: (nodeId: string, timeIndex: string) => void;
  values?: Record<string, any>;
  schema?: INodeSchema;
  columns?: string[];
}

export const CSVLoaderNode = memo(
  ({ data, selected }: { data: ICSVLoaderNodeData; selected?: boolean }) => {
    const [files, setFiles] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [columns, setColumns] = useState<string[]>([]);
    const [loadingColumns, setLoadingColumns] = useState(false);
    // Force update to ensure UI reflects data changes if needed
    const [, forceUpdate] = useState({});

    useEffect(() => {
      const fetchFiles = async () => {
        if (!data.serviceManager) {
          return;
        }

        try {
          setLoading(true);
          // List files in the 'dataset' directory
          const model = await data.serviceManager.contents.get('dataset');
          if (model.content && Array.isArray(model.content)) {
            const csvFiles = model.content
              .filter((item: Contents.IModel) => item.name.endsWith('.csv'))
              .map((item: Contents.IModel) => `dataset/${item.name}`);
            setFiles(csvFiles);
          }
        } catch (error) {
          console.error('Failed to list files in dataset directory:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchFiles();
    }, [data.serviceManager]);

    const fetchColumns = async (filepath: string) => {
      if (!data.serviceManager || !filepath) {
        return;
      }

      try {
        setLoadingColumns(true);
        // Use the server API to get columns from CSV file
        const fileResponse = await fetch(
          `/api/contents/${filepath}?content=1&format=text`
        );
        if (fileResponse.ok) {
          const jsonData = await fileResponse.json();
          // Extract the content from the JSON response
          const content = jsonData.content;
          if (content) {
            const firstLine = content.split('\n')[0];
            const csvColumns = firstLine
              .split(',')
              .map((col: string) => col.trim());
            setColumns(csvColumns);
            // Update data.columns for external use
            data.columns = csvColumns;
          }
        }
      } catch (error) {
        console.error('Failed to fetch columns:', error);
      } finally {
        setLoadingColumns(false);
      }
    };

    // Fetch columns when filepath changes
    useEffect(() => {
      if (data.filepath) {
        fetchColumns(data.filepath);
      }
    }, [data.filepath, data.serviceManager]);

    // Sync timeIndex and filepath to values whenever they change, including initial load
    useEffect(() => {
      if (!data.values) {
        data.values = {};
      }

      // Ensure bidirectional sync between data.timeIndex and data.values['timeIndex']
      // If data.timeIndex is set but values['timeIndex'] is not, sync to values
      if (
        data.timeIndex !== undefined &&
        data.values['timeIndex'] !== data.timeIndex
      ) {
        data.values['timeIndex'] = data.timeIndex;
      }
      // If values['timeIndex'] is set but data.timeIndex is not, sync to data
      else if (
        data.values['timeIndex'] !== undefined &&
        data.timeIndex !== data.values['timeIndex']
      ) {
        data.timeIndex = data.values['timeIndex'];
      }

      // Ensure bidirectional sync between data.filepath and data.values['filepath']
      if (
        data.filepath !== undefined &&
        data.values['filepath'] !== data.filepath
      ) {
        data.values['filepath'] = data.filepath;
      } else if (
        data.values['filepath'] !== undefined &&
        data.filepath !== data.values['filepath']
      ) {
        data.filepath = data.values['filepath'];
      }
    }, [data.timeIndex, data.filepath, data.values]);

    const handleFileChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newVal = event.target.value;
      data.filepath = newVal;
      // Sync to values for CodeGenerator
      if (!data.values) {
        data.values = {};
      }
      data.values['filepath'] = newVal;

      if (data.onFileChange) {
        data.onFileChange(data.id, newVal);
      }
      forceUpdate({});
    };

    const handleTimeIndexChange = (
      event: React.ChangeEvent<HTMLSelectElement>
    ) => {
      const newVal = event.target.value;
      data.timeIndex = newVal;
      // Sync to values for CodeGenerator
      if (!data.values) {
        data.values = {};
      }
      data.values['timeIndex'] = newVal;

      if (data.onTimeIndexChange) {
        data.onTimeIndexChange(data.id, newVal);
      }
      forceUpdate({});
    };

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
          maxWidth: '300px',
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
          CSV加载器
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
            文件:
          </label>
          {loading ? (
            <div style={{ color: 'var(--jp-ui-font-color2)' }}>加载中...</div>
          ) : (
            <select
              className="nodrag"
              defaultValue={data.filepath || ''}
              onChange={handleFileChange}
              style={inputStyle}
            >
              <option value="" disabled>
                请选择...
              </option>
              {files.map(file => (
                <option key={file} value={file}>
                  {file.split('/').pop()}
                </option>
              ))}
            </select>
          )}

          <label
            style={{
              display: 'block',
              marginTop: '12px',
              marginBottom: '2px',
              color: 'var(--jp-ui-font-color2)',
              fontSize: '10px'
            }}
          >
            时间索引列:
          </label>
          {loadingColumns ? (
            <div style={{ color: 'var(--jp-ui-font-color2)' }}>加载列中...</div>
          ) : (
            <select
              className="nodrag"
              defaultValue={data.timeIndex || ''}
              onChange={handleTimeIndexChange}
              style={inputStyle}
            >
              <option value="">无（普通DataFrame）</option>
              {columns.map(col => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Output Handle (Bottom Edge) */}
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
          <div
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
  }
);
