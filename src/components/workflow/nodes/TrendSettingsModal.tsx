import React, { useState, useEffect } from 'react';
import { IParam } from '../types';

interface ITrendSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: Record<string, any>) => void;
  initialValues: Record<string, any>;
  params: IParam[];
}

export const TrendSettingsModal: React.FC<ITrendSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialValues,
  params
}) => {
  const [values, setValues] = useState<Record<string, any>>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues, isOpen]);

  if (!isOpen) return null;

  const handleChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(values);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--jp-layout-color1)',
          color: 'var(--jp-ui-font-color1)',
          padding: '20px',
          borderRadius: '8px',
          width: '400px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--jp-border-color2)'
        }}
      >
        <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--jp-border-color2)', paddingBottom: '10px' }}>
          趋势图配置
        </h3>
        
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {params.map(param => (
            <div key={param.name} style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                {param.label}
              </label>
              {param.type === 'bool' ? (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                    type="checkbox"
                    checked={!!values[param.name]}
                    onChange={e => handleChange(param.name, e.target.checked)}
                    style={{ marginRight: '8px' }}
                    />
                    <span style={{ fontSize: '12px' }}>{param.description}</span>
                </div>
              ) : (
                <>
                    <input
                    type="text"
                    className="jp-mod-styled"
                    style={{ width: '100%', padding: '6px', boxSizing: 'border-box', border: '1px solid var(--jp-border-color2)', borderRadius: '4px', background: 'var(--jp-input-active-background)' }}
                    value={values[param.name] || ''}
                    onChange={e => handleChange(param.name, e.target.value)}
                    placeholder={param.description}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--jp-ui-font-color2)', marginTop: '2px' }}>
                        {param.description}
                    </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--jp-border-color2)', paddingTop: '10px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              background: 'var(--jp-layout-color2)',
              border: '1px solid var(--jp-border-color2)',
              borderRadius: '4px',
              cursor: 'pointer',
              color: 'var(--jp-ui-font-color1)'
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 12px',
              background: 'var(--jp-brand-color1)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
