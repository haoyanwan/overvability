import { ReactFlow, ReactFlowProvider, Background, Controls, applyEdgeChanges, applyNodeChanges, addEdge, MarkerType, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { JavaProcessNode } from './nodes/JavaProcessNode';
import { GroupNode } from './nodes/GroupNode';
import { Sidebar } from './components/Sidebar';
import { LayoutControls } from './components/LayoutControls';
import { LoadingOverlay } from './components/LoadingOverlay';
import { BusinessOwnerNav } from './components/BusinessOwnerNav';
import type { VmMetrics, VmInfo, GroupNodeData } from './types/nodes';

const nodeTypes = {
  javaProcess: JavaProcessNode,
  group: GroupNode,
};

// Polling intervals
const VM_POLL_INTERVAL = 30 * 60 * 1000; // 30 minutes
const METRICS_POLL_INTERVAL = 30 * 1000; // 30 seconds

// Layout configuration
const GROUP_PADDING = 60;
const HEADER_HEIGHT = 50;
const NODE_WIDTH = 240;
const NODE_HEIGHT = 200;
const NODE_GAP_X = 20;
const NODE_GAP_Y = 20;
const GROUP_GAP_X = 60;
const GROUP_GAP_Y = 60;
const NODES_PER_ROW = 2;
const GROUPS_PER_ROW = 3;

// Saved layout type
interface SavedLayout {
  nodes?: { id: string; position: { x: number; y: number }; width?: number; height?: number }[];
  edges?: any[];
}

// Helper function to create nodes with groups
function createNodesWithGroups(
  services: any[],
  existingNodes: Node[],
  savedLayout?: SavedLayout
): Node[] {
  // Group services by businessOwner
  const servicesByOwner: Record<string, any[]> = {};
  for (const service of services) {
    const owner = service.businessOwner || 'default';
    if (!servicesByOwner[owner]) {
      servicesByOwner[owner] = [];
    }
    servicesByOwner[owner].push(service);
  }

  const allNodes: Node[] = [];
  const owners = Object.keys(servicesByOwner);

  let groupX = 50;
  let groupY = 50;
  let maxGroupHeightInRow = 0;
  let groupsInCurrentRow = 0;

  owners.forEach((owner) => {
    const ownerServices = servicesByOwner[owner];
    const childCount = ownerServices.length;

    // Calculate grid dimensions for children
    const cols = Math.min(childCount, NODES_PER_ROW);
    const rows = Math.ceil(childCount / NODES_PER_ROW);

    // Calculate group dimensions
    const groupWidth = cols * (NODE_WIDTH + NODE_GAP_X) + GROUP_PADDING * 2 - NODE_GAP_X;
    const groupHeight = rows * (NODE_HEIGHT + NODE_GAP_Y) + HEADER_HEIGHT + GROUP_PADDING - NODE_GAP_Y;

    // Group node ID
    const groupId = `group-${owner}`;

    // Check for saved or existing position
    const savedGroupNode = savedLayout?.nodes?.find(n => n.id === groupId);
    const existingGroupNode = existingNodes.find(n => n.id === groupId);

    const groupPosition = savedGroupNode?.position ||
      existingGroupNode?.position ||
      { x: groupX, y: groupY };

    // Create group node
    const groupNode: Node = {
      id: groupId,
      type: 'group',
      position: groupPosition,
      data: {
        businessOwner: owner,
        label: owner,
        childCount,
      } as GroupNodeData,
      style: {
        width: savedGroupNode?.width || existingGroupNode?.style?.width || groupWidth,
        height: savedGroupNode?.height || existingGroupNode?.style?.height || groupHeight,
      },
      draggable: true,
    };

    allNodes.push(groupNode);

    // Create child nodes with relative positions
    ownerServices.forEach((service, serviceIndex) => {
      const col = serviceIndex % NODES_PER_ROW;
      const row = Math.floor(serviceIndex / NODES_PER_ROW);

      // Default relative position within group
      const relativeX = GROUP_PADDING + col * (NODE_WIDTH + NODE_GAP_X);
      const relativeY = HEADER_HEIGHT + row * (NODE_HEIGHT + NODE_GAP_Y);

      const nodeId = service.service;
      const savedNode = savedLayout?.nodes?.find(n => n.id === nodeId);
      const existingNode = existingNodes.find(n => n.id === nodeId);

      // Use saved/existing relative position if available, otherwise calculate
      const childPosition = savedNode?.position ||
        existingNode?.position ||
        { x: relativeX, y: relativeY };

      const childNode: Node = {
        id: nodeId,
        type: 'javaProcess',
        position: childPosition,
        parentId: groupId,
        extent: 'parent',
        data: {
          service: service.service,
          businessOwner: service.businessOwner,
          status: service.vms.every((vm: any) => vm.status === 'running') ? 'healthy' : 'unhealthy',
          vms: service.vms,
        },
        draggable: true,
      };

      allNodes.push(childNode);
    });

    // Update position for next group
    groupsInCurrentRow++;
    maxGroupHeightInRow = Math.max(maxGroupHeightInRow, groupHeight);

    if (groupsInCurrentRow >= GROUPS_PER_ROW) {
      groupX = 50;
      groupY += maxGroupHeightInRow + GROUP_GAP_Y;
      maxGroupHeightInRow = 0;
      groupsInCurrentRow = 0;
    } else {
      groupX += groupWidth + GROUP_GAP_X;
    }
  });

  return allNodes;
}

export default function App() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<{ id: string; source: string; target: string }[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );

  const onEdgesChange = useCallback(
    (changes: any) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );

  const onConnect = useCallback(
    (params: any) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Only show sidebar for service nodes, not group nodes
    if (node.type === 'group') {
      return;
    }
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const saveLayout = useCallback(async () => {
    const layout = {
      nodes: nodes.map(node => ({
        id: node.id,
        position: node.position,
        // Include width/height for group nodes (NodeResizer updates width/height directly)
        ...(node.type === 'group' ? {
          width: node.measured?.width ?? node.width ?? node.style?.width,
          height: node.measured?.height ?? node.height ?? node.style?.height,
        } : {}),
      })),
      edges: edges,
    };
    await fetch('http://localhost:5000/api/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout),
    });
  }, [nodes, edges]);

  const resetLayout = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/layout');
      const savedLayout: SavedLayout = await res.json();

      if (savedLayout.nodes) {
        setNodes(currentNodes => currentNodes.map(node => {
          const savedNode = savedLayout.nodes!.find(n => n.id === node.id);
          if (!savedNode) return node;

          return {
            ...node,
            position: savedNode.position,
            // Restore width/height for group nodes
            ...(node.type === 'group' && savedNode.width && savedNode.height ? {
              style: {
                ...node.style,
                width: savedNode.width,
                height: savedNode.height,
              },
            } : {}),
          };
        }));
      }
      if (savedLayout.edges) {
        setEdges(savedLayout.edges);
      }
    } catch (error) {
      console.error('Failed to load saved layout:', error);
    }
  }, []);

  // Fetch metrics from the backend
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/metrics');
      if (!response.ok) return;
      const metricsMap: Record<string, VmMetrics> = await response.json();

      setNodes(currentNodes => {
        return currentNodes.map(node => {
          // Skip group nodes
          if (node.type === 'group') return node;

          const vms = (node.data?.vms as VmInfo[]) || [];
          const updatedVms = vms.map(vm => {
            const metrics = metricsMap[vm.ip];
            return metrics ? { ...vm, metrics } : vm;
          });
          return {
            ...node,
            data: {
              ...node.data,
              vms: updatedVms,
            },
          };
        });
      });

      setSelectedNode(current => {
        if (!current || current.type === 'group') return current;
        const vms = (current.data?.vms as VmInfo[]) || [];
        const updatedVms = vms.map(vm => {
          const metrics = metricsMap[vm.ip];
          return metrics ? { ...vm, metrics } : vm;
        });
        return {
          ...current,
          data: {
            ...current.data,
            vms: updatedVms,
          },
        };
      });
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  }, []);

  // Fetch VM data from the backend
  const fetchVmData = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/vms');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();

      setNodes(currentNodes => createNodesWithGroups(data.services, currentNodes));
    } catch (error) {
      console.error('Failed to fetch VM data:', error);
    }
  }, []);

  // Manual refresh: fetch both VM data and metrics
  const refreshData = useCallback(async () => {
    await fetchVmData();
    await fetchMetrics();
  }, [fetchVmData, fetchMetrics]);

  useEffect(() => {
    let vmPollTimer: ReturnType<typeof setInterval> | null = null;
    let metricsPollTimer: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const init = async () => {
      // Fetch saved layout first
      let savedLayout: SavedLayout | null = null;
      try {
        const res = await fetch('http://localhost:5000/api/layout');
        const layout = await res.json();
        if (layout.nodes || layout.edges) {
          savedLayout = layout;
        }
      } catch {
        // Ignore errors
      }

      // Initial data fetch
      try {
        const response = await fetch('http://localhost:5000/api/vms');
        if (!response.ok) throw new Error('Failed to fetch VM data');
        const data = await response.json();

        if (!isMounted) return;

        // Create nodes with groups
        const newNodes = createNodesWithGroups(data.services, [], savedLayout || undefined);

        // Restore edges if saved
        if (savedLayout?.edges) {
          setEdges(savedLayout.edges);
        }

        setNodes(newNodes);
      } catch (error) {
        console.error('Failed to fetch initial VM data:', error);
      }

      // Fetch initial metrics
      try {
        const metricsResponse = await fetch('http://localhost:5000/api/metrics');
        if (metricsResponse.ok && isMounted) {
          const metricsMap: Record<string, VmMetrics> = await metricsResponse.json();
          setNodes(currentNodes => {
            return currentNodes.map(node => {
              if (node.type === 'group') return node;
              const vms = (node.data?.vms as VmInfo[]) || [];
              const updatedVms = vms.map(vm => {
                const metrics = metricsMap[vm.ip];
                return metrics ? { ...vm, metrics } : vm;
              });
              return { ...node, data: { ...node.data, vms: updatedVms } };
            });
          });
        }
      } catch (error) {
        console.error('Failed to fetch initial metrics:', error);
      }

      if (isMounted) {
        setIsLoading(false);
      }

      // Start polling timers
      vmPollTimer = setInterval(async () => {
        if (!isMounted) return;
        try {
          const response = await fetch('http://localhost:5000/api/vms');
          if (!response.ok) return;
          const data = await response.json();

          setNodes(currentNodes => createNodesWithGroups(data.services, currentNodes));
        } catch (error) {
          console.error('Failed to poll VM data:', error);
        }
      }, VM_POLL_INTERVAL);

      metricsPollTimer = setInterval(async () => {
        if (!isMounted) return;
        try {
          const response = await fetch('http://localhost:5000/api/metrics');
          if (!response.ok) return;
          const metricsMap: Record<string, VmMetrics> = await response.json();

          setNodes(currentNodes => {
            return currentNodes.map(node => {
              if (node.type === 'group') return node;
              const vms = (node.data?.vms as VmInfo[]) || [];
              const updatedVms = vms.map(vm => {
                const metrics = metricsMap[vm.ip];
                return metrics ? { ...vm, metrics } : vm;
              });
              return { ...node, data: { ...node.data, vms: updatedVms } };
            });
          });

          setSelectedNode(current => {
            if (!current || current.type === 'group') return current;
            const vms = (current.data?.vms as VmInfo[]) || [];
            const updatedVms = vms.map(vm => {
              const metrics = metricsMap[vm.ip];
              return metrics ? { ...vm, metrics } : vm;
            });
            return { ...current, data: { ...current.data, vms: updatedVms } };
          });
        } catch (error) {
          console.error('Failed to poll metrics:', error);
        }
      }, METRICS_POLL_INTERVAL);
    };

    init();

    return () => {
      isMounted = false;
      if (vmPollTimer) clearInterval(vmPollTimer);
      if (metricsPollTimer) clearInterval(metricsPollTimer);
    };
  }, []);

  // Extract unique businessOwners from group nodes
  const businessOwners = useMemo(() => {
    return nodes
      .filter(node => node.type === 'group')
      .map(node => (node.data as GroupNodeData).businessOwner);
  }, [nodes]);

  return (
    <ReactFlowProvider>
      <div className="react-flow-container">
        {isLoading && <LoadingOverlay />}
        <div className="top-nav">
          <BusinessOwnerNav owners={businessOwners} />
          <LayoutControls onSave={saveLayout} onReset={resetLayout} onRefresh={refreshData} />
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          }}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
        <Sidebar node={selectedNode} onClose={() => setSelectedNode(null)} />
      </div>
    </ReactFlowProvider>
  );
}
