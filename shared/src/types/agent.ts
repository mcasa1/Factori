export enum AgentRole {
  EXECUTIVE = 'executive',
  PROJECT_MANAGER = 'project_manager',
  DEVELOPER = 'developer',
  TESTER = 'tester',
  CREATIVE = 'creative',
  ANALYST = 'analyst',
  COMMUNICATIONS = 'communications',
  HACKER = 'hacker',
  RESEARCHER = 'researcher',
  DESIGNER = 'designer'
}

export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  OFFLINE = 'offline',
  ERROR = 'error'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  capabilities: string[];
  personality: string;
  memory: AgentMemory;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
  projectId?: string;
  teamId?: string;
}

export interface AgentMemory {
  shortTerm: string[];
  longTerm: Record<string, any>;
  context: Record<string, any>;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgentId?: string;
  projectId: string;
  dependencies: string[];
  estimatedDuration: number; // in minutes
  actualDuration?: number;
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  clientId: string;
  status: ProjectStatus;
  agents: Agent[];
  tasks: Task[];
  budget: number;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface Team {
  id: string;
  name: string;
  projectId: string;
  agents: Agent[];
  leaderId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  projects: Project[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMessage {
  id: string;
  senderId: string;
  receiverId?: string;
  channelId?: string;
  content: string;
  messageType: MessageType;
  timestamp: Date;
  metadata: Record<string, any>;
}

export enum MessageType {
  TEXT = 'text',
  TASK_UPDATE = 'task_update',
  STATUS_UPDATE = 'status_update',
  FILE = 'file',
  SYSTEM = 'system'
}

export interface Channel {
  id: string;
  name: string;
  projectId: string;
  type: ChannelType;
  members: string[];
  messages: AgentMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export enum ChannelType {
  GENERAL = 'general',
  TASK_DISCUSSION = 'task_discussion',
  CLIENT_COMMUNICATION = 'client_communication',
  AGENT_COLLABORATION = 'agent_collaboration'
}

export interface Workflow {
  id: string;
  name: string;
  projectId: string;
  steps: WorkflowStep[];
  currentStep: number;
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  agentRole: AgentRole;
  dependencies: string[];
  gateChecks: GateCheck[];
  estimatedDuration: number;
  actualDuration?: number;
  status: WorkflowStepStatus;
  metadata: Record<string, any>;
}

export enum WorkflowStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}

export enum WorkflowStepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface GateCheck {
  id: string;
  name: string;
  description: string;
  type: GateCheckType;
  criteria: string[];
  automated: boolean;
  required: boolean;
  status: GateCheckStatus;
  reviewerId?: string;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export enum GateCheckType {
  QUALITY = 'quality',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  COMPLIANCE = 'compliance',
  USER_ACCEPTANCE = 'user_acceptance'
}

export enum GateCheckStatus {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface Feedback {
  id: string;
  taskId?: string;
  workflowStepId?: string;
  projectId: string;
  fromAgentId?: string;
  fromUserId?: string;
  toAgentId?: string;
  content: string;
  type: FeedbackType;
  priority: TaskPriority;
  status: FeedbackStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export enum FeedbackType {
  BUG_REPORT = 'bug_report',
  FEATURE_REQUEST = 'feature_request',
  IMPROVEMENT = 'improvement',
  CRITICAL_ISSUE = 'critical_issue',
  GENERAL = 'general'
}

export enum FeedbackStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}