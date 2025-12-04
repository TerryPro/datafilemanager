import React, { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Node,
  Edge,
  MarkerType,
  NodeChange,
  applyNodeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ICellModel } from '@jupyterlab/cells';
import { UUID } from '@lumino/coreutils';
import * as nbformat from '@jupyterlab/nbformat';
import { GenericNode } from '../components/workflow/nodes/GenericNode';
import { WorkflowSidebar } from '../components/workflow/WorkflowSidebar';

const nodeTypes = {
  generic: GenericNode,
  code: GenericNode,
  markdown: GenericNode
};

interface IFlowNotePanelProps {
  notebook: NotebookPanel;
}

export const FlowNotePanel: React.FC<IFlowNotePanelProps> = ({ notebook }) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Helper to generate node from cell
  const createNodeFromCell = (cellModel: ICellModel, index: number): Node => {
    // Ensure node_id exists using sharedModel for consistency
    let nodeId = (cellModel.sharedModel.getMetadata('node_id') as string) || '';

    if (!nodeId) {
      nodeId = UUID.uuid4();
      cellModel.sharedModel.setMetadata('node_id', nodeId);
    }

    // Get position from metadata if available
    const metaPos = cellModel.sharedModel.getMetadata('flow_position') as any;
    const position = metaPos
      ? JSON.parse(JSON.stringify(metaPos))
      : { x: 100, y: index * 150 + 50 };

    // Infer label
    let label = '(Unnamed Step)';
    const source = cellModel.sharedModel.getSource();
    if (source.trim() === '') {
      // empty
    } else {
      const lines = source.split('\n');
      const firstLine = lines[0].trim();
      if (firstLine.startsWith('#')) {
        label = firstLine.replace(/^#+\s*/, '');
      } else {
        label =
          firstLine.substring(0, 20) + (firstLine.length > 20 ? '...' : '');
      }
    }

    const schema = {
      id: 'cell_step',
      name: label,
      category: 'step',
      inputs: index > 0 ? [{ name: 'in', type: 'any' }] : [],
      outputs: [{ name: 'out', type: 'any' }]
    };

    return {
      id: nodeId,
      type: 'generic',
      position: position,
      data: {
        label: label,
        schema: schema,
        index: index
      }
    };
  };

  const refreshFlow = useCallback(() => {
    if (!notebook || !notebook.model || notebook.isDisposed) {
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const cells = notebook.model.cells;
    let prevNodeId: string | null = null;

    for (let i = 0; i < cells.length; i++) {
      const cellModel = cells.get(i);
      const node = createNodeFromCell(cellModel, i);
      newNodes.push(node);

      if (prevNodeId) {
        newEdges.push({
          id: `e-${prevNodeId}-${node.id}`,
          source: prevNodeId,
          target: node.id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed }
        });
      }
      prevNodeId = node.id;
    }

    // Use setNodes with function to preserve node state if needed, but here we do full refresh
    // However, full refresh might jitter if we are dragging.
    // Ideally we should only update data/labels, not positions if they are being dragged.
    // For now, simple refresh.
    setNodes(newNodes);
    setEdges(newEdges);
  }, [notebook.model, setNodes, setEdges]);

  // Handle node changes (dragging)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(nds => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  // Save position on drag stop
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!notebook.model) {
        return;
      }
      const cells = notebook.model.cells;
      // Find cell by node id
      for (let i = 0; i < cells.length; i++) {
        const cell = cells.get(i);
        if ((cell.sharedModel.getMetadata('node_id') as string) === node.id) {
          // Update metadata
          cell.sharedModel.setMetadata('flow_position', node.position as any);
          break;
        }
      }
    },
    [notebook]
  );

  // Initial load and subscriptions
  useEffect(() => {
    refreshFlow();

    const onCellsChanged = () => {
      refreshFlow();
    };

    const onContentChanged = () => {
      // Cell content changed (e.g. text edit), need to update labels
      refreshFlow();
    };

    if (notebook.model) {
      notebook.model.cells.changed.connect(onCellsChanged);
      notebook.model.contentChanged.connect(onContentChanged);
    }

    return () => {
      if (notebook && notebook.model) {
        notebook.model.cells.changed.disconnect(onCellsChanged);
        notebook.model.contentChanged.disconnect(onContentChanged);
      }
    };
  }, [notebook, refreshFlow]);

  // Handle node click -> Scroll to cell
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!notebook.model) {
        return;
      }
      const cells = notebook.model.cells;
      for (let i = 0; i < cells.length; i++) {
        const cellModel = cells.get(i);
        const nid = cellModel.sharedModel.getMetadata('node_id') as string;
        if (nid === node.id) {
          notebook.content.activeCellIndex = i;

          const widget = notebook.content.widgets[i];
          if (widget) {
            notebook.content.node.scrollTo({
              top: widget.node.offsetTop,
              behavior: 'smooth'
            });
          }
          break;
        }
      }
    },
    [notebook]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');
      const schemaStr = event.dataTransfer.getData(
        'application/reactflow-schema'
      );

      if (
        typeof type === 'undefined' ||
        !type ||
        !reactFlowBounds ||
        !notebook.model
      ) {
        return;
      }

      let schema: any = {};
      try {
        schema = JSON.parse(schemaStr);
      } catch (e) {
        console.error('Invalid schema', e);
      }

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top
      };

      const nodeId = UUID.uuid4();

      // Create a new Code Cell
      // We can inject some default code based on the schema if needed
      const defaultCode = `# ${
        schema.name || 'New Step'
      }\n# Add your code here\n`;

      const cellData: nbformat.ICodeCell = {
        cell_type: 'code',
        source: defaultCode,
        metadata: {
          node_id: nodeId,
          flow_position: position
        },
        outputs: [],
        execution_count: null
      };

      // Insert at the end
      notebook.model.sharedModel.insertCell(
        notebook.model.cells.length,
        cellData
      );

      // The refreshFlow will pick this up and create the node
    },
    [notebook]
  );

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div
        style={{
          width: '250px',
          borderRight: '1px solid var(--jp-border-color2)'
        }}
      >
        <WorkflowSidebar />
      </div>
      <div
        className="reactflow-wrapper"
        style={{ flex: 1, height: '100%', position: 'relative' }}
        ref={reactFlowWrapper}
      >
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            onDragOver={onDragOver}
            onDrop={onDrop}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
};
