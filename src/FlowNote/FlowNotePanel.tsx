import React, { useEffect, useRef, useState, useMemo } from 'react';
import ReactFlow, { ReactFlowProvider, Controls, Background } from 'reactflow';
import 'reactflow/dist/style.css';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ServiceManager } from '@jupyterlab/services';
import { FlowGenericNode } from './nodes/FlowGenericNode';
import { FlowEmptyNode } from './nodes/FlowEmptyNode';
import { AlgorithmLibrary } from './panels/AlgorithmLibrary';
import { PropertyPanel } from './panels/PropertyPanel';
import { AiService } from '../services/ai-service';
import { useFlowState } from './hooks/useFlowState';
import { useFlowActions } from './hooks/useFlowActions';
import { useNotebookSync } from './hooks/useNotebookSync';
import { useFlowInteractions } from './hooks/useFlowInteractions';

const nodeTypes = {
  generic: FlowGenericNode,
  code: FlowGenericNode,
  markdown: FlowGenericNode,
  empty: FlowEmptyNode
};

interface IFlowNotePanelProps {
  notebook: NotebookPanel;
  serviceManager?: ServiceManager;
}

export const FlowNotePanel: React.FC<IFlowNotePanelProps> = ({
  notebook,
  serviceManager
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [serverRoot, setServerRoot] = useState<string>('');

  useEffect(() => {
    const ai = new AiService();
    ai.getServerRoot().then(root => {
      if (typeof root === 'string') {
        setServerRoot(root);
      }
    });
  }, []);

  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    onNodesChange,
    onNodesDelete,
    onConnect,
    handleEdgesChange,
    onEdgesDelete,
    selectedNodeId,
    setSelectedNodeId
  } = useFlowState(notebook, serverRoot);

  const actionsRef = useRef<any>(null);

  const handleSelectAlgorithm = React.useCallback(
    (nodeId: string, schema: any) => {
      actionsRef.current?.handleSelectAlgorithm(nodeId, schema);
    },
    []
  );

  const handleRunNode = React.useCallback((nodeId: string) => {
    actionsRef.current?.handleRunNode(nodeId);
  }, []);

  const { refreshFlow } = useNotebookSync(
    notebook,
    serverRoot,
    setNodes,
    setEdges,
    handleSelectAlgorithm,
    handleRunNode,
    serviceManager
  );

  const actions = useFlowActions(notebook, serverRoot, setNodes, refreshFlow);
  actionsRef.current = actions;

  const { centerNodeInView, onNodeClick, onDragOver, onDrop, onNodeDragStop } =
    useFlowInteractions(
      notebook,
      reactFlowWrapper,
      reactFlowInstance,
      setReactFlowInstance,
      nodes,
      setNodes,
      setSelectedNodeId,
      serverRoot
    );

  // Sync active cell to selected node
  useEffect(() => {
    const onActiveCellChanged = () => {
      try {
        const idx = notebook.content.activeCellIndex;
        const cells = notebook.model?.cells;
        if (!cells || idx < 0 || idx >= cells.length) {
          return;
        }
        const cellModel = cells.get(idx);
        const nid = cellModel.sharedModel.getMetadata('node_id') as string;
        if (!nid) {
          return;
        }
        setSelectedNodeId(nid);
        setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nid })));
        centerNodeInView(nid);
      } catch (err) {
        // ignore
      }
    };
    notebook.content.activeCellChanged.connect(onActiveCellChanged);
    return () => {
      try {
        notebook.content.activeCellChanged.disconnect(onActiveCellChanged);
      } catch (_) {
        // ignore
      }
    };
  }, [notebook, centerNodeInView, setNodes, setSelectedNodeId]);

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
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
            onEdgesChange={handleEdgesChange}
            onEdgesDelete={onEdgesDelete}
            onNodesDelete={onNodesDelete}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onConnect={onConnect}
            onInit={instance => {
              setReactFlowInstance(instance);
              if (instance && typeof instance.setViewport === 'function') {
                instance.setViewport({ x: 0, y: 0, zoom: 1 });
              }
            }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
      <div
        style={{
          width: '250px',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--jp-border-color2)',
          height: '100%'
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            borderBottom: '1px solid var(--jp-border-color2)'
          }}
        >
          <AlgorithmLibrary />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PropertyPanel
            selectedNode={selectedNode}
            onChange={actions.handlePropertyChange}
            serviceManager={
              serviceManager || (notebook as any).context?.manager
            }
          />
        </div>
      </div>
    </div>
  );
};
