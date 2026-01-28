import type { Environment } from './environment';
import type { VmInfo } from './vm';

// Node status - matches actual usage in the codebase
export type NodeStatus = 'healthy' | 'unhealthy';

// Base type for ReactFlow compatibility - allows additional properties
// while maintaining type safety for known fields
type NodeDataBase = Record<string, unknown>;

// JavaProcess node data - properly typed with ReactFlow compatibility
export interface JavaProcessNodeData extends NodeDataBase {
  service: string;
  businessOwner: string;
  environment: Environment;
  resourceGroup: string;
  port?: string;
  vms: VmInfo[];
  status?: NodeStatus;
}

// Group node data for businessOwner containers
export interface GroupNodeData extends NodeDataBase {
  businessOwner: string;
  label: string;
  childCount: number;
}
