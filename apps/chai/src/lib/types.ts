export type ExternalLink = {
  provider: string;
  url: string;
  embedUrl?: string;
  fileId?: string;
  connectedAt: string;
};

export type FlowNode = {
  id: string;
  label: string;
  type?: string;
  x?: number;
  y?: number;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export type RoadmapTask = {
  id: string;
  title: string;
  phase: string;
  startWeek: number;
  durationWeeks: number;
  owner?: string;
  status?: string;
};

export type MockupSpec = {
  title: string;
  width: number;
  height: number;
  background: string;
  frames: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fill?: string;
    text?: string;
    fontSize?: number;
    children?: MockupSpec["frames"];
  }>;
  previewImageUrl?: string;
};

export const INTEGRATION_PROVIDERS = [
  "google",
  "microsoft",
  "figma",
  "lucidchart",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];
