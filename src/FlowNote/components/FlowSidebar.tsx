import React, { useEffect, useState } from 'react';
import { INodeSchema } from '../types';
import { caretDownIcon, caretRightIcon } from '@jupyterlab/ui-components';

/**
 * FlowNote 独立的算法库侧栏组件
 * - 从后端获取算法库并支持拖拽到画布
 */
export const FlowSidebar = () => {
  const [library, setLibrary] = useState<Record<string, INodeSchema[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const response = await fetch('/aiserver/function-library');
        if (response.ok) {
          const data = await response.json();
          setLibrary(data);
          setExpandedCategories(new Set(Object.keys(data)));
        } else {
          console.error('Failed to fetch library:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching library:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLibrary();
  }, []);

  /**
   * 触发拖拽，附带节点类型与 schema JSON
   */
  const onDragStart = (event: React.DragEvent, schema: INodeSchema) => {
    const type = schema.nodeType || 'generic';
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.setData(
      'application/reactflow-schema',
      JSON.stringify(schema)
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const filteredLibrary = Object.entries(library).reduce(
    (acc, [category, nodes]) => {
      const filteredNodes = nodes.filter(
        node =>
          node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (node.description &&
            node.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      if (filteredNodes.length > 0) {
        acc[category] = filteredNodes;
      }
      return acc;
    },
    {} as Record<string, INodeSchema[]>
  );

  return (
    <aside
      style={{
        width: '100%',
        background: 'var(--jp-layout-color1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '8px',
          borderBottom: '1px solid var(--jp-border-color2)',
          background: 'var(--jp-layout-color1)'
        }}
      >
        <div
          className="jp-InputGroup"
          style={{
            display: 'flex',
            alignItems: 'center',
            position: 'relative'
          }}
        >
          <input
            type="text"
            className="jp-mod-styled"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '4px 8px',
              borderRadius: 'var(--jp-border-radius)',
              border: '1px solid var(--jp-border-color1)'
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '10px', color: 'var(--jp-ui-font-color2)' }}>
            Loading library...
          </div>
        ) : (
          Object.entries(filteredLibrary).map(([category, nodes]) => (
            <div key={category} className="jp-AlgorithmLibrary-section">
              <div
                onClick={() => toggleCategory(category)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--jp-layout-color2)',
                  borderBottom: '1px solid var(--jp-border-color2)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--jp-ui-font-color1)',
                  userSelect: 'none'
                }}
              >
                <span
                  style={{
                    marginRight: '8px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {expandedCategories.has(category) || searchTerm ? (
                    <caretDownIcon.react
                      tag="span"
                      width="16px"
                      height="16px"
                    />
                  ) : (
                    <caretRightIcon.react
                      tag="span"
                      width="16px"
                      height="16px"
                    />
                  )}
                </span>
                {category}
              </div>

              {(expandedCategories.has(category) || searchTerm) && (
                <div style={{ backgroundColor: 'var(--jp-layout-color1)' }}>
                  {nodes.map(node => (
                    <div
                      key={node.id}
                      className="dndnode"
                      onDragStart={event => onDragStart(event, node)}
                      draggable
                      style={{
                        padding: '8px 12px 8px 36px',
                        cursor: 'grab',
                        borderBottom: '1px solid var(--jp-border-color3)',
                        fontSize: '13px',
                        color: 'var(--jp-ui-font-color1)',
                        transition: 'background-color 0.2s'
                      }}
                      title={node.description}
                      onMouseEnter={e =>
                        (e.currentTarget.style.backgroundColor =
                          'var(--jp-layout-color2)')
                      }
                      onMouseLeave={e =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
                    >
                      <div style={{ fontWeight: 500 }}>{node.name}</div>
                      {node.description && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--jp-ui-font-color2)',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {node.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
