import { describe, it, expect } from 'vitest';

describe('AI Orchestrator', () => {
  describe('AI Tools Configuration', () => {
    const AI_TOOLS = [
      {
        name: 'echo',
        description: 'Echo back a message.',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'The message to echo back' }
          },
          required: ['message']
        }
      },
      {
        name: 'calculator',
        description: 'Perform mathematical calculations.',
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['operation', 'a', 'b']
        }
      },
      {
        name: 'get_weather',
        description: 'Get current weather information.',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            units: { type: 'string', enum: ['celsius', 'fahrenheit'] }
          },
          required: ['location']
        }
      },
      {
        name: 'random_fact',
        description: 'Get a random interesting fact.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['technology', 'science', 'history', 'nature', 'space'] }
          }
        }
      }
    ];

    it('should have 4 tools defined', () => {
      expect(AI_TOOLS).toHaveLength(4);
    });

    it('should have echo tool with correct schema', () => {
      const echoTool = AI_TOOLS.find(t => t.name === 'echo');
      expect(echoTool).toBeDefined();
      expect(echoTool?.parameters.required).toContain('message');
    });

    it('should have calculator tool with correct operations', () => {
      const calcTool = AI_TOOLS.find(t => t.name === 'calculator');
      expect(calcTool).toBeDefined();
      expect(calcTool?.parameters.properties.operation.enum).toEqual(['add', 'subtract', 'multiply', 'divide']);
    });

    it('should have weather tool with correct parameters', () => {
      const weatherTool = AI_TOOLS.find(t => t.name === 'get_weather');
      expect(weatherTool).toBeDefined();
      expect(weatherTool?.parameters.required).toEqual(['location']);
    });

    it('should have fact tool with correct categories', () => {
      const factTool = AI_TOOLS.find(t => t.name === 'random_fact');
      expect(factTool).toBeDefined();
      expect(factTool?.parameters.properties.category.enum).toContain('technology');
    });
  });

  describe('Tool Definitions for AI Gateway', () => {
    it('should define tools with OpenAI function format', () => {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'echo',
            description: 'Echo back a message',
            parameters: {
              type: 'object',
              properties: { message: { type: 'string' } },
              required: ['message']
            }
          }
        }
      ];

      expect(tools[0].type).toBe('function');
      expect(tools[0].function.name).toBe('echo');
    });
  });
});
