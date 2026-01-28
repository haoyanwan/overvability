// Barrel file - re-export all types from domain-specific files

// Node types and type guards
export { NODE_TYPES, isGroupNode, isJavaProcessNode } from './node-types';
export type { NodeType } from './node-types';

// Environment
export {
  VALID_ENVIRONMENTS,
  DEFAULT_ENVIRONMENT,
  environmentMap,
  getEnvironment,
  isValidEnvironment,
} from './environment';
export type { Environment } from './environment';

// VM types
export { getAzurePortalVmUrl } from './vm';
export type { MetricAggregate, StorageMetrics, VmMetrics, VmInfo } from './vm';

// Node data types
export type { NodeStatus, JavaProcessNodeData, GroupNodeData } from './node-data';

// Labels
export { javaProcessLabels, vmLabels, vmMetricsLabels } from './labels';

// Colors
export { businessOwnerColors, environmentColors } from './colors';

// API types
export type { SavedLayout, ServiceFromApi, VmsApiResponse, MetricsApiResponse } from './api';
