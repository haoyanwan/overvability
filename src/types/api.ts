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
  jenkinsJob?: string | null;
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

// Jenkins build information
export interface JenkinsBuild {
  number: number;
  url: string;
  result?: string;
  timestamp: number;
  duration?: number;
}

export interface JenkinsJob {
  name: string;
  url: string;
  color: string;
  lastBuild: JenkinsBuild | null;
  lastSuccessfulBuild: JenkinsBuild | null;
  lastFailedBuild: JenkinsBuild | null;
}

export interface JenkinsJobResponse {
  job: JenkinsJob;
  last_updated?: string;
}
