import { Agent, AgentRole, AgentStatus, AgentMemory, Task, Project } from '@agent-platform/shared';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { LLMService } from '../services/LLMService';
import { TaskQueueService } from '../services/TaskQueueService';

export abstract class BaseAgent {
  protected id: string;
  protected name: string;
  protected role: AgentRole;
  protected status: AgentStatus;
  protected capabilities: string[];
  protected personality: string;
  protected memory: AgentMemory;
  protected projectId?: string;
  protected teamId?: string;
  protected llmService: LLMService;
  protected taskQueue: TaskQueueService;

  constructor(
    id: string,
    name: string,
    role: AgentRole,
    capabilities: string[],
    personality: string,
    projectId?: string,
    teamId?: string
  ) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.status = AgentStatus.IDLE;
    this.capabilities = capabilities;
    this.personality = personality;
    this.memory = {
      shortTerm: [],
      longTerm: {},
      context: {}
    };
    this.projectId = projectId;
    this.teamId = teamId;
    this.llmService = new LLMService();
    this.taskQueue = new TaskQueueService();
  }

  // Core agent methods
  public async initialize(): Promise<void> {
    try {
      this.status = AgentStatus.IDLE;
      await this.updateAgentInDatabase();
      logger.info(`Agent ${this.name} (${this.id}) initialized`);
    } catch (error) {
      logger.error(`Failed to initialize agent ${this.name}:`, error);
      this.status = AgentStatus.ERROR;
      throw error;
    }
  }

  public async processTask(task: Task): Promise<void> {
    try {
      this.status = AgentStatus.BUSY;
      await this.updateAgentInDatabase();

      logger.info(`Agent ${this.name} starting task: ${task.title}`);

      // Add task to short-term memory
      this.memory.shortTerm.push(`Processing task: ${task.title}`);
      if (this.memory.shortTerm.length > 10) {
        this.memory.shortTerm.shift();
      }

      // Execute the task
      const result = await this.executeTask(task);

      // Update task status
      await this.updateTaskStatus(task.id, 'completed', result);

      // Update agent status
      this.status = AgentStatus.IDLE;
      await this.updateAgentInDatabase();

      logger.info(`Agent ${this.name} completed task: ${task.title}`);
    } catch (error) {
      logger.error(`Agent ${this.name} failed to process task ${task.title}:`, error);
      this.status = AgentStatus.ERROR;
      await this.updateTaskStatus(task.id, 'failed', { error: error.message });
      await this.updateAgentInDatabase();
      throw error;
    }
  }

  public async communicate(message: string, recipientId?: string, channelId?: string): Promise<void> {
    try {
      const agentMessage = await prisma.agentMessage.create({
        data: {
          senderId: this.id,
          receiverId: recipientId,
          channelId: channelId,
          content: message,
          messageType: 'TEXT',
          metadata: {
            agentName: this.name,
            agentRole: this.role,
            timestamp: new Date().toISOString()
          }
        }
      });

      logger.info(`Agent ${this.name} sent message: ${message.substring(0, 100)}...`);
      
      // Emit WebSocket event for real-time communication
      // This will be implemented in the WebSocket service
    } catch (error) {
      logger.error(`Agent ${this.name} failed to send message:`, error);
      throw error;
    }
  }

  public async getProjectContext(): Promise<Project | null> {
    if (!this.projectId) return null;

    try {
      const project = await prisma.project.findUnique({
        where: { id: this.projectId },
        include: {
          agents: true,
          tasks: true,
          teams: true,
          channels: true
        }
      });

      return project as any;
    } catch (error) {
      logger.error(`Agent ${this.name} failed to get project context:`, error);
      return null;
    }
  }

  public async getTeamMembers(): Promise<Agent[]> {
    if (!this.teamId) return [];

    try {
      const team = await prisma.team.findUnique({
        where: { id: this.teamId },
        include: {
          agents: true
        }
      });

      return team?.agents as any[] || [];
    } catch (error) {
      logger.error(`Agent ${this.name} failed to get team members:`, error);
      return [];
    }
  }

  public async updateMemory(key: string, value: any, type: 'shortTerm' | 'longTerm' | 'context' = 'context'): Promise<void> {
    if (type === 'shortTerm') {
      this.memory.shortTerm.push(`${key}: ${JSON.stringify(value)}`);
      if (this.memory.shortTerm.length > 10) {
        this.memory.shortTerm.shift();
      }
    } else {
      this.memory[type][key] = value;
    }

    await this.updateAgentInDatabase();
  }

  public async getMemory(key: string, type: 'shortTerm' | 'longTerm' | 'context' = 'context'): Promise<any> {
    return this.memory[type][key];
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract executeTask(task: Task): Promise<any>;
  protected abstract canHandleTask(task: Task): boolean;

  // Utility methods
  protected async updateAgentInDatabase(): Promise<void> {
    try {
      await prisma.agent.update({
        where: { id: this.id },
        data: {
          status: this.status,
          memory: this.memory,
          lastActiveAt: new Date()
        }
      });
    } catch (error) {
      logger.error(`Failed to update agent ${this.id} in database:`, error);
    }
  }

  protected async updateTaskStatus(taskId: string, status: string, result?: any): Promise<void> {
    try {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: status.toUpperCase() as any,
          completedAt: status === 'completed' ? new Date() : null,
          metadata: {
            ...result,
            completedBy: this.id,
            completedAt: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      logger.error(`Failed to update task ${taskId} status:`, error);
    }
  }

  protected async requestHumanInput(prompt: string, taskId: string): Promise<string> {
    // This will be implemented to request human input when needed
    // For now, we'll log the request
    logger.info(`Agent ${this.name} requesting human input for task ${taskId}: ${prompt}`);
    
    // Create a feedback entry for human review
    await prisma.feedback.create({
      data: {
        taskId: taskId,
        projectId: this.projectId!,
        fromAgentId: this.id,
        content: `Human input requested: ${prompt}`,
        type: 'GENERAL',
        priority: 'HIGH',
        status: 'OPEN'
      }
    });

    // In a real implementation, this would wait for human response
    // For now, return a placeholder
    return "Human input placeholder - implement actual human interaction";
  }

  protected async logActivity(activity: string, metadata?: any): Promise<void> {
    logger.info(`Agent ${this.name} activity: ${activity}`, metadata);
    
    // Add to short-term memory
    this.memory.shortTerm.push(`${new Date().toISOString()}: ${activity}`);
    if (this.memory.shortTerm.length > 10) {
      this.memory.shortTerm.shift();
    }
  }

  // Getters
  public getId(): string { return this.id; }
  public getName(): string { return this.name; }
  public getRole(): AgentRole { return this.role; }
  public getStatus(): AgentStatus { return this.status; }
  public getCapabilities(): string[] { return this.capabilities; }
  public getPersonality(): string { return this.personality; }
  public getMemory(): AgentMemory { return this.memory; }
}