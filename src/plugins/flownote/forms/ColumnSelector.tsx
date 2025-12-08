import React from 'react';
import { IColumn } from '../types';

interface IColumnSelectorProps {
  value: any;
  onChange: (val: any) => void;
  columns: IColumn[];
  multiple?: boolean;
  placeholder?: string;
}

export const ColumnSelector: React.FC<IColumnSelectorProps> = ({
  value,
  onChange,
  columns,
  multiple = false,
  placeholder = 'Select column(s)...'
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (multiple) {
      const selectedOptions = Array.from(
        e.target.selectedOptions,
        option => option.value
      );
      onChange(selectedOptions);
    } else {
      onChange(e.target.value);
    }
  };

  if (!columns || columns.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <input
          type="text"
          className="nodrag"
          value={Array.isArray(value) ? value.join(', ') : value || ''}
          onChange={e => {
            const val = e.target.value;
            if (multiple) {
              onChange(
                val
                  .split(',')
                  .map(s => s.trim())
                  .filter(s => s)
              );
            } else {
              onChange(val);
            }
          }}
          placeholder={placeholder + ' (manual input)'}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '4px',
            borderRadius: '4px',
            border: '1px solid var(--jp-border-color2)',
            backgroundColor: 'var(--jp-input-active-background)',
            color: 'var(--jp-ui-font-color1)',
            fontSize: '12px'
          }}
        />
        <span style={{ fontSize: '10px', color: 'var(--jp-ui-font-color2)' }}>
          No columns detected. Enter manually.
        </span>
      </div>
    );
  }

  return (
    <select
      className="nodrag"
      multiple={multiple}
      value={value || (multiple ? [] : '')}
      onChange={handleChange}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '4px',
        borderRadius: '4px',
        border: '1px solid var(--jp-border-color2)',
        backgroundColor: 'var(--jp-input-active-background)',
        color: 'var(--jp-ui-font-color1)',
        fontSize: '12px',
        minHeight: multiple ? '60px' : 'auto'
      }}
    >
      {!multiple && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {columns.map(col => (
        <option key={col.name} value={col.name}>
          {col.name} {col.type && col.type !== 'unknown' ? `(${col.type})` : ''}
        </option>
      ))}
    </select>
  );
};
