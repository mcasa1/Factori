import { BaseAgent } from './BaseAgent';
import { AgentRole, Task, TaskPriority, Project, Agent } from '@agent-platform/shared';
import { prisma } from '../index';
import { logger } from '../utils/logger';

export class ExecutiveAgent extends BaseAgent {
  constructor(id: string, name: string, projectId?: string, teamId?: string) {
    super(
      id,
      name,
      AgentRole.EXECUTIVE,
      [
        'strategic planning',
        'project oversight',
        'decision making',
        'resource allocation',
        'risk management',
        'stakeholder communication',
        'performance evaluation',
        'budget management'
      ],
      'You are a strategic executive with strong leadership skills. You focus on high-level project oversight, making critical decisions, and ensuring project success. You communicate clearly with stakeholders and provide guidance to project managers.',
      projectId,
      teamId
    );
  }

  protected async executeTask(task: Task): Promise<any> {
    await this.logActivity(`Starting executive task: ${task.title}`);

    switch (task.title.toLowerCase()) {
      case 'project review':
        return await this.reviewProject(task);
      case 'strategic planning':
        return await this.createStrategicPlan(task);
      case 'resource allocation':
        return await this.allocateResources(task);
      case 'risk assessment':
        return await this.assessRisks(task);
      case 'stakeholder communication':
        return await this.communicateWithStakeholders(task);
      case 'performance evaluation':
        return await this.evaluatePerformance(task);
      case 'budget review':
        return await this.reviewBudget(task);
      default:
        return await this.handleGenericTask(task);
    }
  }

  protected canHandleTask(task: Task): boolean {
    const executiveKeywords = [
      'strategy', 'planning', 'oversight', 'decision', 'review',
      'budget', 'resource', 'risk', 'stakeholder', 'performance',
      'executive', 'management', 'leadership'
    ];

    const taskText = `${task.title} ${task.description}`.toLowerCase();
    return executiveKeywords.some(keyword => taskText.includes(keyword));
  }

  private async reviewProject(task: Task): Promise<any> {
    const project = await this.getProjectContext();
    if (!project) {
      throw new Error('Project context not available');
    }

    // Analyze project status
    const analysis = await this.llmService.analyzeTask(task, {
      project: project,
      currentStatus: project.status,
      teamSize: project.agents.length,
      taskCount: project.tasks.length
    });

    // Generate project review report
    const reviewPrompt = `
      As an executive, provide a comprehensive project review for:
      
      Project: ${project.name}
      Status: ${project.status}
      Team Size: ${project.agents.length}
      Total Tasks: ${project.tasks.length}
      Budget: $${project.budget}
      
      Analysis: ${analysis.analysis}
      
      Please provide:
      1. Executive Summary
      2. Key Achievements
      3. Current Challenges
      4. Risk Assessment
      5. Recommendations
      6. Next Steps
    `;

    const review = await this.llmService.generateResponse({
      prompt: reviewPrompt,
      systemPrompt: 'You are a senior executive providing strategic project oversight.',
      model: 'gpt-4',
      temperature: 0.3
    });

    // Communicate findings to project team
    await this.communicate(
      `Project Review Complete: ${review.content.substring(0, 200)}...`,
      undefined,
      project.channels.find(c => c.type === 'GENERAL')?.id
    );

    return {
      review: review.content,
      analysis: analysis.analysis,
      recommendations: review.content,
      timestamp: new Date().toISOString()
    };
  }

  private async createStrategicPlan(task: Task): Promise<any> {
    const project = await this.getProjectContext();
    if (!project) {
      throw new Error('Project context not available');
    }

    const strategicPrompt = `
      Create a strategic plan for project: ${project.name}
      
      Project Details:
      - Description: ${project.description}
      - Budget: $${project.budget}
      - Team Size: ${project.agents.length}
      - Current Status: ${project.status}
      
      Please develop:
      1. Strategic Objectives
      2. Key Performance Indicators
      3. Timeline and Milestones
      4. Resource Requirements
      5. Risk Mitigation Strategies
      6. Success Criteria
    `;

    const strategicPlan = await this.llmService.generateResponse({
      prompt: strategicPrompt,
      systemPrompt: 'You are a strategic planning expert with executive-level thinking.',
      model: 'gpt-4',
      temperature: 0.4,
      maxTokens: 2000
    });

    // Store strategic plan in long-term memory
    await this.updateMemory('strategicPlan', strategicPlan.content, 'longTerm');

    return {
      strategicPlan: strategicPlan.content,
      objectives: strategicPlan.content,
      timestamp: new Date().toISOString()
    };
  }

  private async allocateResources(task: Task): Promise<any> {
    const project = await this.getProjectContext();
    if (!project) {
      throw new Error('Project context not available');
    }

    const teamMembers = await this.getTeamMembers();
    const availableAgents = teamMembers.filter(agent => agent.status === 'IDLE');

    const allocationPrompt = `
      Allocate resources for project: ${project.name}
      
      Available Agents: ${availableAgents.map(a => `${a.name} (${a.role})`).join(', ')}
      Project Budget: $${project.budget}
      Current Tasks: ${project.tasks.length}
      
      Provide optimal resource allocation considering:
      1. Agent capabilities and expertise
      2. Task requirements and priorities
      3. Budget constraints
      4. Timeline requirements
    `;

    const allocation = await this.llmService.generateResponse({
      prompt: allocationPrompt,
      systemPrompt: 'You are an expert in resource allocation and project management.',
      model: 'gpt-4',
      temperature: 0.3
    });

    // Implement resource allocation
    const allocationPlan = JSON.parse(allocation.content);
    
    // Update agent assignments based on allocation
    for (const assignment of allocationPlan.assignments || []) {
      await prisma.task.updateMany({
        where: {
          id: assignment.taskId,
          projectId: project.id
        },
        data: {
          assignedAgentId: assignment.agentId
        }
      });
    }

    return {
      allocationPlan: allocation.content,
      assignments: allocationPlan.assignments || [],
      timestamp: new Date().toISOString()
    };
  }

  private async assessRisks(task: Task): Promise<any> {
    const project = await this.getProjectContext();
    if (!project) {
      throw new Error('Project context not available');
    }

    const riskPrompt = `
      Conduct a comprehensive risk assessment for project: ${project.name}
      
      Project Context:
      - Status: ${project.status}
      - Budget: $${project.budget}
      - Team Size: ${project.agents.length}
      - Tasks: ${project.tasks.length}
      
      Identify and assess:
      1. Technical Risks
      2. Schedule Risks
      3. Budget Risks
      4. Resource Risks
      5. External Risks
      6. Mitigation Strategies
    `;

    const riskAssessment = await this.llmService.generateResponse({
      prompt: riskPrompt,
      systemPrompt: 'You are a risk management expert with executive-level perspective.',
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 2000
    });

    // Store risk assessment in memory
    await this.updateMemory('riskAssessment', riskAssessment.content, 'longTerm');

    // Create risk mitigation tasks if needed
    const risks = JSON.parse(riskAssessment.content);
    for (const risk of risks.highPriority || []) {
      await prisma.task.create({
        data: {
          title: `Mitigate Risk: ${risk.name}`,
          description: risk.mitigation,
          priority: 'HIGH',
          projectId: project.id,
          estimatedDuration: 120, // 2 hours
          metadata: {
            riskType: risk.type,
            severity: risk.severity
          }
        }
      });
    }

    return {
      riskAssessment: riskAssessment.content,
      highPriorityRisks: risks.highPriority || [],
      mitigationTasks: risks.highPriority?.length || 0,
      timestamp: new Date().toISOString()
    };
  }

  private async communicateWithStakeholders(task: Task): Promise<any> {
    const project = await this.getProjectContext();
    if (!project) {
      throw new Error('Project context not available');
    }

    const communicationPrompt = `
      Prepare stakeholder communication for project: ${project.name}
      
      Project Status: ${project.status}
      Progress: ${project.tasks.filter(t => t.status === 'COMPLETED').length}/${project.tasks.length} tasks completed
      Budget Status: $${project.budget} allocated
      
      Create:
      1. Executive Summary
      2. Key Updates
      3. Challenges and Solutions
      4. Next Steps
      5. Timeline Updates
    `;

    const communication = await this.llmService.generateResponse({
      prompt: communicationPrompt,
      systemPrompt: 'You are an executive communication expert.',
      model: 'gpt-4',
      temperature: 0.4
    });

    // Send communication to client channel
    const clientChannel = project.channels.find(c => c.type === 'CLIENT_COMMUNICATION');
    if (clientChannel) {
      await this.communicate(
        `Executive Update: ${communication.content.substring(0, 300)}...`,
        undefined,
        clientChannel.id
      );
    }

    return {
      communication: communication.content,
      sentToChannel: clientChannel?.id,
      timestamp: new Date().toISOString()
    };
  }

  private async evaluatePerformance(task: Task): Promise<any> {
    const project = await this.getProjectContext();
    if (!project) {
      throw new Error('Project context not available');
    }

    const teamMembers = await this.getTeamMembers();
    
    const performancePrompt = `
      Evaluate team performance for project: ${project.name}
      
      Team Members: ${teamMembers.map(a => `${a.name} (${a.role})`).join(', ')}
      Completed Tasks: ${project.tasks.filter(t => t.status === 'COMPLETED').length}
      Total Tasks: ${project.tasks.length}
      Project Status: ${project.status}
      
      Provide:
      1. Individual Performance Assessment
      2. Team Performance Metrics
      3. Areas for Improvement
      4. Recognition and Rewards
      5. Development Recommendations
    `;

    const performanceEvaluation = await this.llmService.generateResponse({
      prompt: performancePrompt,
      systemPrompt: 'You are an expert in performance evaluation and team management.',
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 2000
    });

    // Store evaluation in memory
    await this.updateMemory('performanceEvaluation', performanceEvaluation.content, 'longTerm');

    return {
      evaluation: performanceEvaluation.content,
      teamSize: teamMembers.length,
      completionRate: (project.tasks.filter(t => t.status === 'COMPLETED').length / project.tasks.length) * 100,
      timestamp: new Date().toISOString()
    };
  }

  private async reviewBudget(task: Task): Promise<any> {
    const project = await this.getProjectContext();
    if (!project) {
      throw new Error('Project context not available');
    }

    const budgetPrompt = `
      Review budget for project: ${project.name}
      
      Allocated Budget: $${project.budget}
      Project Status: ${project.status}
      Team Size: ${project.agents.length}
      Task Count: ${project.tasks.length}
      
      Analyze:
      1. Budget Utilization
      2. Cost Efficiency
      3. Resource Allocation
      4. Budget Risks
      5. Recommendations
    `;

    const budgetReview = await this.llmService.generateResponse({
      prompt: budgetPrompt,
      systemPrompt: 'You are a financial expert with project management expertise.',
      model: 'gpt-4',
      temperature: 0.3
    });

    return {
      budgetReview: budgetReview.content,
      allocatedBudget: project.budget,
      teamSize: project.agents.length,
      timestamp: new Date().toISOString()
    };
  }

  private async handleGenericTask(task: Task): Promise<any> {
    const genericPrompt = `
      As an executive, handle the following task:
      
      Task: ${task.title}
      Description: ${task.description}
      Priority: ${task.priority}
      
      Provide executive-level guidance and action plan.
    `;

    const response = await this.llmService.generateResponse({
      prompt: genericPrompt,
      systemPrompt: 'You are a senior executive providing strategic guidance.',
      model: 'gpt-4',
      temperature: 0.4
    });

    return {
      guidance: response.content,
      taskType: 'generic',
      timestamp: new Date().toISOString()
    };
  }
}