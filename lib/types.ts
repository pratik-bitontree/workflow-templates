export interface WorkflowListItem {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  isPrebuilt?: boolean;
  status?: string;
  updatedAt?: string;
}

export interface SubNodeParam {
  nodeMasterId?: string;
  parameters?: Record<string, unknown>;
  name?: string;
  _id?: string;
}

export interface WorkflowNode {
  _id: string;
  name?: string;
  type?: string;
  parameters?: Record<string, unknown>;
  subNodes?: SubNodeParam[];
  nodeMasterId?: {
    type?: string;
    functionToExecute?: string;
    dynamicParams?: string[];
    metaData?: Record<string, unknown>;
  };
  dependencies?: string[];
}

export interface WorkflowDetail {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  nodes?: WorkflowNode[];
}

export interface CreateExecutionResponse {
  workflowId: string;
  workflowExecutionId: string;
  messageId?: string;
  [key: string]: unknown;
}

export interface ExecutionStatusNode {
  nodeId: string;
  nodeName?: string;
  type?: string;
  status: string;
  result?: unknown;
  startTime?: string;
  endTime?: string;
}

export interface ExecutionStatus {
  status: string;
  workflowExecutionId: string;
  workflowId: string;
  nodes?: ExecutionStatusNode[];
}

export interface NodeExecutionResult {
  nodeId: string;
  nodeName?: string;
  type?: string;
  status: string;
  result?: unknown;
  startTime?: string;
  endTime?: string;
}

export interface ExecutionDetail {
  _id: string;
  status: string;
  workflowId?: { name?: string };
  nodes?: NodeExecutionResult[];
  variables?: Record<string, unknown>;
  startTimestamp?: string;
  endTimestamp?: string;
}

export interface WorkflowRunHistoryItem {
  _id: string;
  workflowRunId: string;
  workflowName: string;
  status: string;
  lastUpdatedAt: string;
  startTimestamp?: string;
}

export interface WorkflowHistoryResponse {
  runs: WorkflowRunHistoryItem[];
  total: number;
}

export interface IntegrationDetail {
  userId?: string;
  category?: string;
  type: string;
  userSecretKey?: string;
  name: string;
  logo?: string;
  status: "connected" | "disconnected" | "attention";
  email?: string | null;
  subCategory?: string;
  description?: string;
  connectionMethods?: { apiKey: boolean; oauth: boolean };
}

export interface ConnectedAccount {
  accountId: string;
  email?: string | null;
  userName?: string | null;
  isPrimary?: boolean;
  api_key?: string;
  name?: string;
}
