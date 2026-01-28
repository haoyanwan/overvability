import type { VmMetrics } from './vm';

// Saved layout structure from API
export interface SavedLayout {
  nodes?: { id: string; position: { x: number; y: number }; width?: number; height?: number }[];
  edges?: { id: string; source: string; target: string }[];
}

// Service data from API
export interface ServiceFromApi {
  service: string;
  businessOwner: string;
  resourceGroup?: string;
  port?: string;
  vms: {
    name: string;
    ip: string;
    coreCount: number;
    memory: string;
    os: string;
    status?: string;
    subscriptionId?: string;
    resourceGroup?: string;
  }[];
}

// VMs API response
export interface VmsApiResponse {
  services: ServiceFromApi[];
}

// Metrics API response - map of IP to metrics
export type MetricsApiResponse = Record<string, VmMetrics>;
