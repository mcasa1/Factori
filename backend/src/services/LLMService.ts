import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class LLMService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private defaultModel: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.defaultModel = process.env.DEFAULT_LLM_MODEL || 'gpt-4';
  }

  public async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    try {
      const model = request.model || this.defaultModel;

      if (model.startsWith('gpt-')) {
        return await this.generateOpenAIResponse(request);
      } else if (model.startsWith('claude-')) {
        return await this.generateAnthropicResponse(request);
      } else {
        throw new Error(`Unsupported model: ${model}`);
      }
    } catch (error) {
      logger.error('LLM service error:', error);
      throw error;
    }
  }

  private async generateOpenAIResponse(request: LLMRequest): Promise<LLMResponse> {
    const messages = [];
    
    if (request.systemPrompt) {
      messages.push({
        role: 'system' as const,
        content: request.systemPrompt
      });
    }

    messages.push({
      role: 'user' as const,
      content: request.prompt
    });

    const response = await this.openai.chat.completions.create({
      model: request.model || 'gpt-4',
      messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 1000
    });

    return {
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      } : undefined
    };
  }

  private async generateAnthropicResponse(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.anthropic.messages.create({
      model: request.model || 'claude-3-sonnet-20240229',
      max_tokens: request.maxTokens || 1000,
      temperature: request.temperature || 0.7,
      system: request.systemPrompt,
      messages: [
        {
          role: 'user',
          content: request.prompt
        }
      ]
    });

    return {
      content: response.content[0]?.text || '',
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  }

  public async analyzeTask(task: any, context: any): Promise<any> {
    const prompt = `
      Analyze the following task and provide insights:
      
      Task: ${JSON.stringify(task, null, 2)}
      Context: ${JSON.stringify(context, null, 2)}
      
      Please provide:
      1. Task complexity assessment
      2. Required skills and capabilities
      3. Estimated effort (in hours)
      4. Potential risks or challenges
      5. Dependencies and prerequisites
      6. Recommended approach
    `;

    const response = await this.generateResponse({
      prompt,
      systemPrompt: 'You are an expert project manager and task analyst. Provide detailed, actionable insights.',
      model: 'gpt-4',
      temperature: 0.3
    });

    return {
      analysis: response.content,
      model: response.model,
      usage: response.usage
    };
  }

  public async generateCode(prompt: string, language: string, context?: any): Promise<any> {
    const systemPrompt = `You are an expert software developer. Generate clean, well-documented code in ${language}. 
    Follow best practices and include appropriate error handling.`;

    const fullPrompt = context 
      ? `Context: ${JSON.stringify(context, null, 2)}\n\nRequirements: ${prompt}`
      : prompt;

    const response = await this.generateResponse({
      prompt: fullPrompt,
      systemPrompt,
      model: 'gpt-4',
      temperature: 0.2,
      maxTokens: 2000
    });

    return {
      code: response.content,
      language,
      model: response.model,
      usage: response.usage
    };
  }

  public async reviewCode(code: string, language: string, requirements?: string): Promise<any> {
    const prompt = `
      Review the following ${language} code:
      
      Code:
      \`\`\`${language}
      ${code}
      \`\`\`
      
      ${requirements ? `Requirements: ${requirements}` : ''}
      
      Please provide:
      1. Code quality assessment
      2. Potential bugs or issues
      3. Security concerns
      4. Performance considerations
      5. Suggestions for improvement
      6. Overall rating (1-10)
    `;

    const response = await this.generateResponse({
      prompt,
      systemPrompt: 'You are an expert code reviewer with deep knowledge of software engineering best practices.',
      model: 'gpt-4',
      temperature: 0.3
    });

    return {
      review: response.content,
      model: response.model,
      usage: response.usage
    };
  }

  public async generateTestCases(requirements: string, language: string): Promise<any> {
    const prompt = `
      Generate comprehensive test cases for the following requirements:
      
      Requirements: ${requirements}
      Language: ${language}
      
      Please provide:
      1. Unit test cases
      2. Integration test cases
      3. Edge cases
      4. Error scenarios
      5. Performance test considerations
    `;

    const response = await this.generateResponse({
      prompt,
      systemPrompt: 'You are an expert QA engineer and testing specialist.',
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 2000
    });

    return {
      testCases: response.content,
      language,
      model: response.model,
      usage: response.usage
    };
  }

  public async generateDocumentation(code: string, language: string, type: 'api' | 'user' | 'technical' = 'technical'): Promise<any> {
    const prompt = `
      Generate ${type} documentation for the following ${language} code:
      
      Code:
      \`\`\`${language}
      ${code}
      \`\`\`
      
      Please provide comprehensive documentation appropriate for ${type} documentation.
    `;

    const response = await this.generateResponse({
      prompt,
      systemPrompt: `You are an expert technical writer specializing in ${type} documentation.`,
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 2000
    });

    return {
      documentation: response.content,
      type,
      language,
      model: response.model,
      usage: response.usage
    };
  }

  public async summarizeText(text: string, maxLength: number = 500): Promise<any> {
    const prompt = `
      Summarize the following text in ${maxLength} words or less:
      
      ${text}
    `;

    const response = await this.generateResponse({
      prompt,
      systemPrompt: 'You are an expert at creating concise, accurate summaries.',
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: maxLength
    });

    return {
      summary: response.content,
      originalLength: text.length,
      summaryLength: response.content.length,
      model: response.model,
      usage: response.usage
    };
  }
}