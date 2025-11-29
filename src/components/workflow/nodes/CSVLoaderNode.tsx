import React, { memo, useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { ServiceManager, Contents } from '@jupyterlab/services';

import { INodeSchema } from '../types';

interface ICSVLoaderNodeData {
  id: string;
  filepath: string;
  serviceManager?: ServiceManager;
  onFileChange?: (nodeId: string, filepath: string) => void;
  values?: Record<string, any>;
  schema?: INodeSchema;
}

export const CSVLoaderNode = memo(
  ({ data, selected }: { data: ICSVLoaderNodeData; selected?: boolean }) => {
    const [files, setFiles] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
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

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
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
          fontSize: '12px',
          boxShadow: selected
            ? '0 0 0 2px rgba(33, 150, 243, 0.3)'
            : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          position: 'relative',
          overflow: 'visible',
          color: 'var(--jp-ui-font-color1)'
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
          CSV Loader
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
            File:
          </label>
          {loading ? (
            <div style={{ color: 'var(--jp-ui-font-color2)' }}>Loading...</div>
          ) : (
            <select
              className="nodrag"
              defaultValue={data.filepath || ''}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="" disabled>
                Select...
              </option>
              {files.map(file => (
                <option key={file} value={file}>
                  {file.split('/').pop()}
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
              DF
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
