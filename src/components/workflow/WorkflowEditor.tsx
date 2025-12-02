import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Connection,
  Node
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ServiceManager } from '@jupyterlab/services';

import { WorkflowSidebar } from './WorkflowSidebar';
import { WorkflowToolbar } from './WorkflowToolbar';
import { PropertyPanel } from './PropertyPanel';
import { CSVLoaderNode } from './nodes/CSVLoaderNode';
import { PlotNode } from './nodes/PlotNode';
import { GenericNode } from './nodes/GenericNode';
import { TrendNode } from './nodes/TrendNode';
import { generateCode } from './CodeGenerator';
import { AiService } from '../../services/ai-service';
import { useColumnPropagation } from './hooks/useColumnPropagation';
import { metadataService } from './services/MetadataService';

const nodeTypes = {
  csv_loader: CSVLoaderNode,
  plot: PlotNode,
  generic: GenericNode,
  trend: TrendNode
};

interface IWorkflowEditorProps {
  onInjectCode: (code: string, workflowData: any) => void;
  serviceManager: ServiceManager;
  initialData?: any;
}

const initialNodes: Node[] = [];

const WorkflowEditorContent = ({
  onInjectCode,
  serviceManager,
  initialData
}: IWorkflowEditorProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [library, setLibrary] = useState<any>(null);
  const [showMiniMap, setShowMiniMap] = useState(false); // 默认不显示mini map

  // Use a ref to track the next node ID to avoid duplicates
  const nodeIdCounter = useRef(0);
  const getId = () => `node_${nodeIdCounter.current++}`;

  // Fetch library on mount
  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const response = await fetch('/aiserver/function-library');
        if (response.ok) {
          const data = await response.json();
          setLibrary(data);
        }
      } catch (error) {
        console.error('Error fetching library:', error);
      }
    };
    fetchLibrary();
  }, []);

  // Initialize metadata service
  useEffect(() => {
    if (serviceManager) {
      metadataService.setServiceManager(serviceManager);
    }
  }, [serviceManager]);

  // Enable column name propagation system
  // This hook automatically calculates and propagates column metadata
  // based on node connections and configurations
  useColumnPropagation(nodes, edges, setNodes);

  // Helper function to update node data
  const updateNodeData = (nodeId: string, newData: any) => {
    setNodes(nds =>
      nds.map(node => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  };

  // Handle file selection changes from CSV Loader
  const handleFileChange = useCallback(
    async (nodeId: string, filepath: string) => {
      console.log(`File changed in node ${nodeId}: ${filepath}`);
      // Update the node data with the new file path
      // The useColumnPropagation hook will detect this change and fetch columns automatically
      updateNodeData(nodeId, { filepath, values: { filepath } });
    },
    [setNodes]
  );

  // Track the last loaded data to prevent re-loading same data
  const lastLoadedDataRef = useRef<any>(null);

  // Load initialData when available
  useEffect(() => {
    // If we have data but no library, we can't hydrate yet.
    // So don't mark as loaded, and don't try to load.
    if (initialData && !library) {
      return;
    }

    // Skip if data hasn't changed (by reference)
    if (initialData === lastLoadedDataRef.current) {
      return;
    }

    lastLoadedDataRef.current = initialData;

    if (initialData && library) {
      console.log('Loading workflow data...', initialData);

      // Reset ID counter based on loaded nodes
      let maxId = -1;
      initialData.nodes.forEach((n: any) => {
        const match = n.id.match(/node_(\d+)/);
        if (match) {
          const idNum = parseInt(match[1], 10);
          if (idNum > maxId) {
            maxId = idNum;
          }
        }
      });
      nodeIdCounter.current = maxId + 1;

      const hydratedNodes = initialData.nodes.map((node: any) => {
        const baseData = {
          ...node.data,
          serviceManager,
          onFileChange: handleFileChange
        };

        if (node.data.algorithm_id) {
          let schema: any = null;
          // Search in library
          Object.values(library).forEach((nodes: any) => {
            if (Array.isArray(nodes)) {
              const found = nodes.find(
                (algo: any) => algo.id === node.data.algorithm_id
              );
              if (found) {
                schema = found;
              }
            }
          });

          if (schema) {
            baseData.schema = schema;
            baseData.label = schema.name;
          }
        }

        // Inject schema for built-in nodes if not present (required for column propagation)
        if (!baseData.schema) {
          if (node.type === 'csv_loader') {
            baseData.schema = {
              id: 'load_csv',
              category: 'source',
              name: 'CSV Loader',
              inputs: [],
              outputs: [{ name: 'df_out', type: 'DataFrame' }]
            };
          } else if (node.type === 'plot') {
            baseData.schema = {
              id: 'plot_chart',
              category: 'visualization',
              name: 'Plot',
              inputs: [{ name: 'df_in', type: 'DataFrame' }],
              outputs: []
            };
          }
        }

        return { ...node, data: baseData };
      });

      setNodes(hydratedNodes);
      setEdges(initialData.edges);

      if (initialData.viewport && reactFlowInstance) {
        reactFlowInstance.setViewport(initialData.viewport);
      }
    } else if (!initialData) {
      // Clear if no data provided (empty cell)
      setNodes([]);
      setEdges([]);
      nodeIdCounter.current = 0;
    }
  }, [
    initialData,
    library,
    serviceManager,
    handleFileChange,
    setNodes,
    setEdges,
    reactFlowInstance
  ]);

  // Re-propagate when edges change (e.g. new connection made)
  useEffect(() => {
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (
        sourceNode &&
        sourceNode.type === 'csv_loader' &&
        sourceNode.data.filepath
      ) {
        // If source has file, trigger update for target
        // Note: we need to be careful not to cause infinite loops here.
        // A better way is to just update the target if it doesn't have columns yet
        // or simply rely on the source node triggering the update.
        // But if we just connected a new edge, we need to pull the state.
        handleFileChange(sourceNode.id, sourceNode.data.filepath);
      }
    });
  }, [edges.length]); // Only run when number of edges changes

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
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
      let schema;
      if (schemaStr) {
        try {
          schema = JSON.parse(schemaStr);
        } catch (e) {
          console.error('Invalid schema', e);
        }
      }

      if (typeof type === 'undefined' || !type || !reactFlowBounds) {
        return;
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: {
          label: schema ? schema.name : `${type} node`,
          schema: schema,
          serviceManager: serviceManager, // Pass serviceManager to nodes
          onFileChange: handleFileChange // Pass callback to nodes
        }
      };

      // Add ID to data for the node to reference itself
      newNode.data.id = newNode.id;

      setNodes(nds => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, serviceManager, handleFileChange]
  );

  const handleGenerateCode = async () => {
    const ai = new AiService();
    const serverRoot = await ai.getServerRoot();
    const code = generateCode(nodes, edges, serverRoot);
    console.log('Generated Code:', code);

    // Prepare workflow data for persistence
    // We must remove non-serializable objects from data (serviceManager, callbacks)
    const cleanNodes = nodes.map(node => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { serviceManager, onFileChange, schema, label, ...restData } =
        node.data;

      const simplifiedData: any = { ...restData };

      // For all nodes with schema, we save the algorithm ID
      if (schema) {
        simplifiedData.algorithm_id = schema.id;
        // 'values' should be in restData
      }

      return {
        id: node.id,
        type: node.type,
        position: node.position,
        data: simplifiedData
      };
    });

    const workflowData = {
      nodes: cleanNodes,
      edges: edges,
      viewport: reactFlowInstance
        ? reactFlowInstance.getViewport()
        : { x: 0, y: 0, zoom: 1 }
    };

    onInjectCode(code, workflowData);
  };

  const handleDelete = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    const selectedEdges = edges.filter(e => e.selected);

    if (selectedNodes.length > 0 || selectedEdges.length > 0) {
      const nodesToDelete = new Set(selectedNodes.map(n => n.id));
      const edgesToDelete = new Set(selectedEdges.map(e => e.id));

      setNodes(nds => nds.filter(n => !nodesToDelete.has(n.id)));
      setEdges(eds => eds.filter(e => !edgesToDelete.has(e.id)));
    }
  }, [nodes, edges, setNodes, setEdges]);

  const handlePropertyChange = useCallback(
    (nodeId: string, newValues: Record<string, any>) => {
      setNodes(nds =>
        nds.map(node => {
          if (node.id === nodeId) {
            // Update data.values
            // Note: We need to create a new data object to trigger updates if needed,
            // but for deep properties sometimes we need to be careful.
            // ReactFlow updates node if reference changes.
            return {
              ...node,
              data: {
                ...node.data,
                values: newValues
              }
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const selectedNode = nodes.find(n => n.selected) || null;

  return (
    <div
      className="workflow-editor"
      style={{ display: 'flex', height: '100%', width: '100%' }}
    >
      <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}
        >
          <WorkflowToolbar 
            onRun={handleGenerateCode} 
            onDelete={handleDelete} 
            onToggleMiniMap={() => setShowMiniMap(!showMiniMap)} 
            showMiniMap={showMiniMap} 
          />
          <div
            className="reactflow-wrapper"
            ref={reactFlowWrapper}
            style={{ flex: 1, position: 'relative' }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            >
              <Controls />
              <Background />
              {showMiniMap && <MiniMap />}
            </ReactFlow>
          </div>
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
          <WorkflowSidebar />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PropertyPanel
            selectedNode={selectedNode}
            onChange={handlePropertyChange}
            serviceManager={serviceManager}
          />
        </div>
      </div>
    </div>
  );
};

export const WorkflowEditor = (props: IWorkflowEditorProps) => {
  return (
    <ReactFlowProvider>
      <WorkflowEditorContent {...props} />
    </ReactFlowProvider>
  );
};
