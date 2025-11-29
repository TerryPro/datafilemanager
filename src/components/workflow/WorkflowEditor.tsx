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
  Node,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ServiceManager } from '@jupyterlab/services';

import { WorkflowSidebar } from './WorkflowSidebar';
import { CSVLoaderNode } from './nodes/CSVLoaderNode';
import { PlotNode } from './nodes/PlotNode';
import { GenericNode } from './nodes/GenericNode';
import { generateCode } from './CodeGenerator';

const nodeTypes = {
  csv_loader: CSVLoaderNode,
  plot: PlotNode,
  generic: GenericNode,
};

interface WorkflowEditorProps {
  onInjectCode: (code: string, workflowData: any) => void;
  serviceManager: ServiceManager;
  initialData?: any;
}

const initialNodes: Node[] = [];

const WorkflowEditorContent = ({ onInjectCode, serviceManager, initialData }: WorkflowEditorProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [library, setLibrary] = useState<any>(null);
  const { getEdges } = useReactFlow();
  
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

  // Helper function to update node data
  const updateNodeData = (nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  };

  // Handle file selection changes from CSV Loader
  // Use getEdges() to avoid dependency on edges state, making this callback stable
  const handleFileChange = useCallback(async (nodeId: string, filepath: string) => {
    console.log(`File changed in node ${nodeId}: ${filepath}`);
    
    // 1. Fetch columns from the file
    try {
      const fileContent = await serviceManager.contents.get(filepath);
      if (fileContent.content) {
        const content = fileContent.content as string;
        const lines = content.split('\n');
        if (lines.length > 0) {
          // Assume first line is header
          const header = lines[0].trim();
          const columns = header.split(',').map(c => c.trim());
          console.log('Detected columns:', columns);

          // 2. Propagate columns to downstream nodes
          // Get current edges directly
          const currentEdges = getEdges();
          // Find all edges starting from this node
          const connectedEdges = currentEdges.filter(e => e.source === nodeId);
          connectedEdges.forEach(edge => {
            const targetNodeId = edge.target;
            console.log(`Propagating columns to target node: ${targetNodeId}`);
            updateNodeData(targetNodeId, { columns: columns });
          });
        }
      }
    } catch (error) {
      console.error('Error reading file columns:', error);
    }
  }, [serviceManager, getEdges, setNodes]);

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
          console.log("Loading workflow data...", initialData);
          
          // Reset ID counter based on loaded nodes
          let maxId = -1;
          initialData.nodes.forEach((n: any) => {
              const match = n.id.match(/node_(\d+)/);
              if (match) {
                  const idNum = parseInt(match[1], 10);
                  if (idNum > maxId) maxId = idNum;
              }
          });
          nodeIdCounter.current = maxId + 1;

          const hydratedNodes = initialData.nodes.map((node: any) => {
              const baseData = {
                  ...node.data,
                  serviceManager,
                  onFileChange: handleFileChange
              };

              if (node.type === 'generic' && node.data.algorithm_id) {
                  let schema: any = null;
                  // Search in library
                  Object.values(library).forEach((nodes: any) => {
                      if (Array.isArray(nodes)) {
                          const found = nodes.find((algo: any) => algo.id === node.data.algorithm_id);
                          if (found) schema = found;
                      }
                  });
                  
                  if (schema) {
                      baseData.schema = schema;
                      baseData.label = schema.name;
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
  }, [initialData, library, serviceManager, handleFileChange, setNodes, setEdges, reactFlowInstance]);

  // Re-propagate when edges change (e.g. new connection made)
  useEffect(() => {
    edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode && sourceNode.type === 'csv_loader' && sourceNode.data.filepath) {
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
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
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
      const schemaStr = event.dataTransfer.getData('application/reactflow-schema');
      let schema;
      if (schemaStr) {
          try {
              schema = JSON.parse(schemaStr);
          } catch (e) {
              console.error("Invalid schema", e);
          }
      }

      if (typeof type === 'undefined' || !type || !reactFlowBounds) {
        return;
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
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
        },
      };

      // Add ID to data for the node to reference itself
      newNode.data.id = newNode.id;

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, serviceManager, handleFileChange]
  );

  const handleGenerateCode = () => {
    const code = generateCode(nodes, edges);
    console.log('Generated Code:', code);
    
    // Prepare workflow data for persistence
    // We must remove non-serializable objects from data (serviceManager, callbacks)
    const cleanNodes = nodes.map(node => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { serviceManager, onFileChange, schema, label, ...restData } = node.data;
        
        const simplifiedData: any = { ...restData };

        // For generic nodes, we only need the algorithm ID and the parameter values
        if (node.type === 'generic' && schema) {
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
        viewport: reactFlowInstance ? reactFlowInstance.getViewport() : { x: 0, y: 0, zoom: 1 }
    };

    onInjectCode(code, workflowData);
  };

  return (
    <div className="workflow-editor" style={{ display: 'flex', height: '100%', width: '100%' }}>
      <WorkflowSidebar />
      <div className="reactflow-wrapper" ref={reactFlowWrapper} style={{ flex: 1, height: '100%', position: 'relative' }}>
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
          <MiniMap />
        </ReactFlow>
        
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100, display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => {
                const selectedNodes = nodes.filter(n => n.selected);
                const selectedEdges = edges.filter(e => e.selected);
                if (selectedNodes.length > 0 || selectedEdges.length > 0) {
                   // React Flow doesn't expose a simple delete function on the instance directly for state managed via hooks?
                   // Actually we can just update the state.
                   // Or use deleteElements from useReactFlow if we used it.
                   // Since we manage state locally with useNodesState, we should update it.
                   const nodesToDelete = new Set(selectedNodes.map(n => n.id));
                   const edgesToDelete = new Set(selectedEdges.map(e => e.id));
                   
                   setNodes((nds) => nds.filter(n => !nodesToDelete.has(n.id)));
                   setEdges((eds) => eds.filter(e => !edgesToDelete.has(e.id)));
                }
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#F44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            }}
            title="Delete selected nodes/edges (or press Backspace)"
          >
            Delete Selected
          </button>
          <button 
            onClick={handleGenerateCode}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            }}
          >
            Generate & Inject Code
          </button>
        </div>
      </div>
    </div>
  );
};

export const WorkflowEditor = (props: WorkflowEditorProps) => {
  return (
    <ReactFlowProvider>
      <WorkflowEditorContent {...props} />
    </ReactFlowProvider>
  );
};
