import type { VmMetrics } from '../types';

const PROMETHEUS_BASE = '/prometheus/api/v1/query';

interface PromResult {
  metric: { instance?: string };
  value: [number, string];
}

interface PromResponse {
  status: string;
  data: { result: PromResult[] };
}

function buildIpPattern(ips: string[]): string {
  return ips.map(ip => `${ip}:.*`).join('|');
}

function parsePromResults(data: PromResponse): Map<string, number> {
  const map = new Map<string, number>();
  if (data.status !== 'success') return map;
  for (const item of data.data.result) {
    const instance = item.metric.instance ?? '';
    const ip = instance.split(':')[0];
    if (ip && item.value[1] != null) {
      map.set(ip, Math.round(parseFloat(item.value[1]) * 10) / 10);
    }
  }
  return map;
}

async function queryProm(query: string): Promise<Map<string, number>> {
  try {
    const res = await fetch(`${PROMETHEUS_BASE}?query=${encodeURIComponent(query)}`);
    if (!res.ok) return new Map();
    const json: PromResponse = await res.json();
    return parsePromResults(json);
  } catch {
    return new Map();
  }
}

export async function fetchBulkMetrics(vmIps: string[]): Promise<Record<string, VmMetrics>> {
  const uniqueIps = [...new Set(vmIps.filter(Boolean))];
  if (uniqueIps.length === 0) return {};

  const pattern = buildIpPattern(uniqueIps);

  // Build the 7 PromQL queries (same as backend prometheus_service.py)
  const cpuBase = `100 - (avg by (instance) (rate(node_cpu_seconds_total{instance=~"${pattern}",mode="idle"}[5m])) * 100)`;
  const memBase = `(1 - (node_memory_MemAvailable_bytes{instance=~"${pattern}"} / node_memory_MemTotal_bytes{instance=~"${pattern}"})) * 100`;
  const rootStorageQuery = `100 - ((node_filesystem_avail_bytes{instance=~"${pattern}",mountpoint="/"} * 100) / node_filesystem_size_bytes{instance=~"${pattern}",mountpoint="/"})`;
  const dataStorageQuery = `100 - ((node_filesystem_avail_bytes{instance=~"${pattern}",mountpoint="/data"} * 100) / node_filesystem_size_bytes{instance=~"${pattern}",mountpoint="/data"})`;

  const [cpuPeak, cpuAvg, cpuLow, memPeak, memAvg, memLow, rootStorage, dataStorage] = await Promise.all([
    queryProm(`max_over_time((${cpuBase})[1h:])`),
    queryProm(`avg_over_time((${cpuBase})[1h:])`),
    queryProm(`min_over_time((${cpuBase})[1h:])`),
    queryProm(`max_over_time((${memBase})[1h:])`),
    queryProm(`avg_over_time((${memBase})[1h:])`),
    queryProm(`min_over_time((${memBase})[1h:])`),
    queryProm(rootStorageQuery),
    queryProm(dataStorageQuery),
  ]);

  const now = new Date().toISOString();
  const metrics: Record<string, VmMetrics> = {};

  for (const ip of uniqueIps) {
    const data: VmMetrics = {
      cpu: { peak: cpuPeak.get(ip) ?? null, avg: cpuAvg.get(ip) ?? null, low: cpuLow.get(ip) ?? null },
      memory: { peak: memPeak.get(ip) ?? null, avg: memAvg.get(ip) ?? null, low: memLow.get(ip) ?? null },
      storage: { rootMount: rootStorage.get(ip) ?? null, dataMount: dataStorage.get(ip) ?? null },
      lastUpdated: null,
    };

    if (data.cpu.peak != null || data.memory.peak != null || data.storage.dataMount != null) {
      data.lastUpdated = now;
    }
    metrics[ip] = data;
  }

  return metrics;
}
