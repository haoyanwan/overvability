import { ReactFlow, ReactFlowProvider, Background, Controls, applyEdgeChanges, applyNodeChanges, addEdge, MarkerType, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { LoadingOverlay } from './components/LoadingOverlay';
import { LeftNavPanel } from './components/LeftNavPanel';
import { useEnvironment } from './context/EnvironmentContext';
import { nodeComponents } from './nodes';
import {
  NODE_TYPES,
  isGroupNode,
  getEnvironment,
  type VmMetrics,
  type VmInfo,
  type GroupNodeData,
  type SavedLayout,
  type ServiceFromApi,
} from './types';

const API_BASE = '';
const VM_POLL_INTERVAL = 30 * 60 * 1000;
const METRICS_POLL_INTERVAL = 30 * 1000;

function createNodesWithGroups(services: ServiceFromApi[], savedLayout?: SavedLayout): Node[] {
  const servicesByOwner: Record<string, ServiceFromApi[]> = {};
  for (const service of services) {
    const owner = service.businessOwner || 'default';
    if (!servicesByOwner[owner]) {
      servicesByOwner[owner] = [];
    }
    servicesByOwner[owner].push(service);
  }

  const allNodes: Node[] = [];
  // loop through for each owner group 
  for (const owner of Object.keys(servicesByOwner)) {
    // get the services under this owner
    const ownerServices = servicesByOwner[owner];
    const groupId = `group-${owner}`;
    const savedGroup = savedLayout?.nodes?.find(n => n.id === groupId);

    // creates the group node
    allNodes.push({
      id: groupId,
      type: NODE_TYPES.GROUP,
      position: savedGroup?.position || { x: 0, y: 0 },
      data: {
        businessOwner: owner,
        label: owner,
        childCount: ownerServices.length,
      } as GroupNodeData,
      style: {
        width: savedGroup?.width,
        height: savedGroup?.height,
      },
      draggable: true,
    });

    // creates service nodes within the group
    for (const service of ownerServices) {
      const nodeId = service.service;
      const savedNode = savedLayout?.nodes?.find(n => n.id === nodeId);

      allNodes.push({
        id: nodeId,
        type: NODE_TYPES.JAVA_PROCESS,
        position: savedNode?.position || { x: 0, y: 0 },
        parentId: groupId,
        extent: 'parent',
        data: {
          service: service.service,
          businessOwner: service.businessOwner,
          resourceGroup: service.resourceGroup || '',
          environment: getEnvironment(service.resourceGroup || ''),
          status: service.vms.every(vm => vm.status === 'running') ? 'healthy' : 'unhealthy',
          vms: service.vms,
        },
        draggable: true,
      });
    }
  }

  return allNodes;
}

function applyMetricsToNodes(nodes: Node[], metricsMap: Record<string, VmMetrics>): Node[] {
  return nodes.map(node => {
    // Group nodes don't have VMs, skip them
    if (isGroupNode(node.type)) {
      return node;
    }

    const vms = (node.data?.vms as VmInfo[]) || [];
    const vmsWithMetrics = vms.map(vm => {
      const metricsForVm = metricsMap[vm.ip];
      if (!metricsForVm) {
        return vm;
      }
      return { ...vm, metrics: metricsForVm };
    });

    return {
      ...node,
      data: { ...node.data, vms: vmsWithMetrics },
    };
  });
}

export default function App() {
  const { environment } = useEnvironment();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<{ id: string; source: string; target: string }[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const prevEnvironmentRef = useRef(environment);

  const onNodesChange = useCallback(
    (changes: any) => setNodes(nds => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange = useCallback(
    (changes: any) => setEdges(eds => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect = useCallback(
    (params: any) => setEdges(eds => addEdge(params, eds)),
    [],
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (!isGroupNode(node.type)) {
      setSelectedNode(node);
    }
  }, []);

  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const saveLayout = useCallback(async () => {
    const layout = {
      nodes: nodes.map(node => ({
        id: node.id,
        position: node.position,
        ...(isGroupNode(node.type) ? {
          width: node.measured?.width ?? node.width ?? node.style?.width,
          height: node.measured?.height ?? node.height ?? node.style?.height,
        } : {}),
      })),
      edges,
    };
    await fetch(`${API_BASE}/api/${environment}/layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout),
    });
  }, [nodes, edges, environment]);

  const resetLayout = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/${environment}/layout`);
      const savedLayout: SavedLayout = await res.json();

      if (savedLayout.nodes) {
        setNodes(currentNodes => currentNodes.map(node => {
          const saved = savedLayout.nodes!.find(n => n.id === node.id);
          if (!saved) return node;
          return {
            ...node,
            position: saved.position,
            ...(isGroupNode(node.type) && saved.width && saved.height ? {
              style: { ...node.style, width: saved.width, height: saved.height },
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
  }, [environment]);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/${environment}/metrics`);
      if (!response.ok) return;
      const metricsMap: Record<string, VmMetrics> = await response.json();

      setNodes(currentNodes => applyMetricsToNodes(currentNodes, metricsMap));
      setSelectedNode(current => {
        if (!current || isGroupNode(current.type)) return current;
        const vms = (current.data?.vms as VmInfo[]) || [];
        const updatedVms = vms.map(vm => metricsMap[vm.ip] ? { ...vm, metrics: metricsMap[vm.ip] } : vm);
        return { ...current, data: { ...current.data, vms: updatedVms } };
      });
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  }, [environment]);

  const refreshData = useCallback(async () => {
    try {
      const [layoutRes, vmsRes] = await Promise.all([
        fetch(`${API_BASE}/api/${environment}/layout`),
        fetch(`${API_BASE}/api/${environment}/vms`),
      ]);

      const savedLayout: SavedLayout = layoutRes.ok ? await layoutRes.json() : {};
      const vmsData = vmsRes.ok ? await vmsRes.json() : { services: [] };

      setNodes(createNodesWithGroups(vmsData.services, savedLayout));
      if (savedLayout.edges) {
        setEdges(savedLayout.edges);
      }

      await fetchMetrics();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [fetchMetrics, environment]);

  // Initialize and poll data
  useEffect(() => {
    let vmPollTimer: ReturnType<typeof setInterval> | null = null;
    let metricsPollTimer: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const init = async () => {
      // Reset state when environment changes
      if (prevEnvironmentRef.current !== environment) {
        setNodes([]);
        setEdges([]);
        setSelectedNode(null);
        setIsLoading(true);
        prevEnvironmentRef.current = environment;
      }

      try {
        const [layoutRes, vmsRes, metricsRes] = await Promise.all([
          fetch(`${API_BASE}/api/${environment}/layout`),
          fetch(`${API_BASE}/api/${environment}/vms`),
          fetch(`${API_BASE}/api/${environment}/metrics`),
        ]);

        if (!isMounted) return;

        const savedLayout: SavedLayout = layoutRes.ok ? await layoutRes.json() : {};
        const vmsData = vmsRes.ok ? await vmsRes.json() : { services: [] };
        const metricsMap: Record<string, VmMetrics> = metricsRes.ok ? await metricsRes.json() : {};

        let newNodes = createNodesWithGroups(vmsData.services, savedLayout);
        newNodes = applyMetricsToNodes(newNodes, metricsMap);

        setNodes(newNodes);
        if (savedLayout.edges) {
          setEdges(savedLayout.edges);
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }

      vmPollTimer = setInterval(async () => {
        if (!isMounted) return;
        try {
          const [layoutRes, vmsRes] = await Promise.all([
            fetch(`${API_BASE}/api/${environment}/layout`),
            fetch(`${API_BASE}/api/${environment}/vms`),
          ]);
          const savedLayout: SavedLayout = layoutRes.ok ? await layoutRes.json() : {};
          const vmsData = vmsRes.ok ? await vmsRes.json() : { services: [] };
          setNodes(createNodesWithGroups(vmsData.services, savedLayout));
        } catch (error) {
          console.error('Failed to poll VM data:', error);
        }
      }, VM_POLL_INTERVAL);

      metricsPollTimer = setInterval(async () => {
        if (!isMounted) return;
        try {
          const response = await fetch(`${API_BASE}/api/${environment}/metrics`);
          if (!response.ok) return;
          const metricsMap: Record<string, VmMetrics> = await response.json();
          setNodes(currentNodes => applyMetricsToNodes(currentNodes, metricsMap));
          setSelectedNode(current => {
            if (!current || isGroupNode(current.type)) return current;
            const vms = (current.data?.vms as VmInfo[]) || [];
            const updatedVms = vms.map(vm => metricsMap[vm.ip] ? { ...vm, metrics: metricsMap[vm.ip] } : vm);
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
  }, [environment]);

  const businessOwners = useMemo(() => {
    return nodes
      .filter(node => isGroupNode(node.type))
      .map(node => (node.data as GroupNodeData).businessOwner);
  }, [nodes]);

  return (
    <ReactFlowProvider>
      <div className="app-layout">
        {isLoading && <LoadingOverlay />}
        <LeftNavPanel
          owners={businessOwners}
          onSave={saveLayout}
          onReset={resetLayout}
          onRefresh={refreshData}
        />
        <div className="react-flow-container">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeComponents}
            defaultEdgeOptions={{
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
          <Sidebar node={selectedNode} onClose={() => setSelectedNode(null)} />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
