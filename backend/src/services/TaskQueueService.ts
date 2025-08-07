import Redis from 'redis';
import { Task, Agent, AgentRole, TaskPriority, TaskStatus } from '@agent-platform/shared';
import { prisma } from '../index';
import { logger } from '../utils/logger';

export interface QueuedTask {
  id: string;
  task: Task;
  priority: number;
  timestamp: Date;
  retries: number;
  maxRetries: number;
}

export class TaskQueueService {
  private redis: Redis.RedisClientType;
  private queueName: string;
  private processingName: string;
  private failedName: string;

  constructor() {
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.queueName = 'task_queue';
    this.processingName = 'task_processing';
    this.failedName = 'task_failed';

    this.redis.connect().catch(err => {
      logger.error('Failed to connect to Redis:', err);
    });
  }

  public async addTask(task: Task, priority: number = 1): Promise<void> {
    try {
      const queuedTask: QueuedTask = {
        id: task.id,
        task,
        priority,
        timestamp: new Date(),
        retries: 0,
        maxRetries: 3
      };

      // Add to Redis sorted set with priority as score
      await this.redis.zAdd(this.queueName, {
        score: priority,
        value: JSON.stringify(queuedTask)
      });

      logger.info(`Task ${task.id} added to queue with priority ${priority}`);
    } catch (error) {
      logger.error('Failed to add task to queue:', error);
      throw error;
    }
  }

  public async getNextTask(): Promise<QueuedTask | null> {
    try {
      // Get the highest priority task (lowest score = highest priority)
      const result = await this.redis.zPopMin(this.queueName);
      
      if (!result || result.length === 0) {
        return null;
      }

      const queuedTask: QueuedTask = JSON.parse(result[0].value);
      
      // Move to processing queue
      await this.redis.hSet(this.processingName, queuedTask.id, JSON.stringify(queuedTask));
      
      logger.info(`Task ${queuedTask.id} moved to processing queue`);
      return queuedTask;
    } catch (error) {
      logger.error('Failed to get next task from queue:', error);
      throw error;
    }
  }

  public async completeTask(taskId: string): Promise<void> {
    try {
      // Remove from processing queue
      await this.redis.hDel(this.processingName, taskId);
      
      // Update task status in database
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      logger.info(`Task ${taskId} completed and removed from processing queue`);
    } catch (error) {
      logger.error('Failed to complete task:', error);
      throw error;
    }
  }

  public async failTask(taskId: string, error: string): Promise<void> {
    try {
      // Get task from processing queue
      const processingTask = await this.redis.hGet(this.processingName, taskId);
      
      if (processingTask) {
        const queuedTask: QueuedTask = JSON.parse(processingTask);
        
        // Remove from processing queue
        await this.redis.hDel(this.processingName, taskId);
        
        // Check if we should retry
        if (queuedTask.retries < queuedTask.maxRetries) {
          queuedTask.retries++;
          queuedTask.timestamp = new Date();
          
          // Add back to queue with lower priority
          await this.redis.zAdd(this.queueName, {
            score: queuedTask.priority + queuedTask.retries,
            value: JSON.stringify(queuedTask)
          });
          
          logger.info(`Task ${taskId} retry ${queuedTask.retries}/${queuedTask.maxRetries}`);
        } else {
          // Move to failed queue
          await this.redis.hSet(this.failedName, taskId, JSON.stringify({
            ...queuedTask,
            error,
            failedAt: new Date()
          }));
          
          // Update task status in database
          await prisma.task.update({
            where: { id: taskId },
            data: {
              status: 'FAILED',
              metadata: {
                error,
                failedAt: new Date().toISOString(),
                retries: queuedTask.retries
              }
            }
          });
          
          logger.error(`Task ${taskId} failed permanently after ${queuedTask.retries} retries`);
        }
      }
    } catch (error) {
      logger.error('Failed to handle task failure:', error);
      throw error;
    }
  }

  public async assignTaskToAgent(task: Task, agentId: string): Promise<void> {
    try {
      // Update task in database
      await prisma.task.update({
        where: { id: task.id },
        data: {
          assignedAgentId: agentId,
          status: 'IN_PROGRESS'
        }
      });

      logger.info(`Task ${task.id} assigned to agent ${agentId}`);
    } catch (error) {
      logger.error('Failed to assign task to agent:', error);
      throw error;
    }
  }

  public async findAvailableAgent(task: Task): Promise<Agent | null> {
    try {
      // Get all agents that can handle this task type
      const agents = await prisma.agent.findMany({
        where: {
          status: 'IDLE',
          projectId: task.projectId
        }
      });

      // Filter agents by capabilities
      const capableAgents = agents.filter(agent => {
        const capabilities = agent.capabilities as string[];
        return this.canAgentHandleTask(agent, task);
      });

      if (capableAgents.length === 0) {
        return null;
      }

      // Sort by priority (executive > project_manager > others)
      const priorityOrder = {
        'EXECUTIVE': 1,
        'PROJECT_MANAGER': 2,
        'DEVELOPER': 3,
        'TESTER': 4,
        'CREATIVE': 5,
        'ANALYST': 6,
        'COMMUNICATIONS': 7,
        'HACKER': 8,
        'RESEARCHER': 9,
        'DESIGNER': 10
      };

      capableAgents.sort((a, b) => {
        return (priorityOrder[a.role] || 999) - (priorityOrder[b.role] || 999);
      });

      return capableAgents[0] as any;
    } catch (error) {
      logger.error('Failed to find available agent:', error);
      return null;
    }
  }

  private canAgentHandleTask(agent: any, task: Task): boolean {
    const capabilities = agent.capabilities as string[];
    const taskTitle = task.title.toLowerCase();
    const taskDescription = task.description.toLowerCase();

    // Check if agent has relevant capabilities
    const relevantCapabilities = capabilities.filter(cap => 
      taskTitle.includes(cap.toLowerCase()) || 
      taskDescription.includes(cap.toLowerCase())
    );

    if (relevantCapabilities.length > 0) {
      return true;
    }

    // Role-based task matching
    const roleTaskMapping = {
      'EXECUTIVE': ['strategy', 'planning', 'oversight', 'decision'],
      'PROJECT_MANAGER': ['coordination', 'planning', 'management', 'timeline'],
      'DEVELOPER': ['code', 'programming', 'development', 'implementation'],
      'TESTER': ['test', 'quality', 'validation', 'verification'],
      'CREATIVE': ['design', 'creative', 'visual', 'artwork'],
      'ANALYST': ['analysis', 'data', 'research', 'insights'],
      'COMMUNICATIONS': ['communication', 'writing', 'content', 'marketing'],
      'HACKER': ['security', 'penetration', 'vulnerability', 'testing'],
      'RESEARCHER': ['research', 'investigation', 'analysis', 'discovery'],
      'DESIGNER': ['design', 'ui', 'ux', 'interface', 'user experience']
    };

    const roleKeywords = roleTaskMapping[agent.role] || [];
    const hasRoleMatch = roleKeywords.some(keyword => 
      taskTitle.includes(keyword) || taskDescription.includes(keyword)
    );

    return hasRoleMatch;
  }

  public async getQueueStatus(): Promise<any> {
    try {
      const queueSize = await this.redis.zCard(this.queueName);
      const processingSize = await this.redis.hLen(this.processingName);
      const failedSize = await this.redis.hLen(this.failedName);

      return {
        queued: queueSize,
        processing: processingSize,
        failed: failedSize,
        total: queueSize + processingSize + failedSize
      };
    } catch (error) {
      logger.error('Failed to get queue status:', error);
      return { queued: 0, processing: 0, failed: 0, total: 0 };
    }
  }

  public async clearFailedTasks(): Promise<void> {
    try {
      await this.redis.del(this.failedName);
      logger.info('Failed tasks queue cleared');
    } catch (error) {
      logger.error('Failed to clear failed tasks:', error);
      throw error;
    }
  }

  public async getFailedTasks(): Promise<any[]> {
    try {
      const failedTasks = await this.redis.hGetAll(this.failedName);
      return Object.values(failedTasks).map(task => JSON.parse(task));
    } catch (error) {
      logger.error('Failed to get failed tasks:', error);
      return [];
    }
  }

  public async retryFailedTask(taskId: string): Promise<void> {
    try {
      const failedTask = await this.redis.hGet(this.failedName, taskId);
      
      if (failedTask) {
        const queuedTask: QueuedTask = JSON.parse(failedTask);
        
        // Remove from failed queue
        await this.redis.hDel(this.failedName, taskId);
        
        // Reset retries and add back to main queue
        queuedTask.retries = 0;
        queuedTask.timestamp = new Date();
        
        await this.redis.zAdd(this.queueName, {
          score: queuedTask.priority,
          value: JSON.stringify(queuedTask)
        });
        
        logger.info(`Failed task ${taskId} retried`);
      }
    } catch (error) {
      logger.error('Failed to retry failed task:', error);
      throw error;
    }
  }
}