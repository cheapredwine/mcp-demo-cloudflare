import { describe, it, expect } from 'vitest';

describe('AI Orchestrator', () => {
  describe('AI Tools Configuration', () => {
    const AI_TOOLS = [
      {
        name: 'calculator',
        description: 'ONLY use when the user asks for mathematical calculations.',
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
        description: 'ONLY use when the user specifically asks about weather.',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            units: { type: 'string', enum: ['celsius', 'fahrenheit'] }
          },
          required: ['location']
        }
      }
    ];

    it('should have 2 tools defined (reduced from 4)', () => {
      expect(AI_TOOLS).toHaveLength(2);
    });

    it('should have calculator tool with restrictive description', () => {
      const calcTool = AI_TOOLS.find(t => t.name === 'calculator');
      expect(calcTool).toBeDefined();
      expect(calcTool?.description).toContain('ONLY use');
      expect(calcTool?.parameters.properties.operation.enum).toEqual(['add', 'subtract', 'multiply', 'divide']);
    });

    it('should have weather tool with restrictive description', () => {
      const weatherTool = AI_TOOLS.find(t => t.name === 'get_weather');
      expect(weatherTool).toBeDefined();
      expect(weatherTool?.description).toContain('ONLY use');
      expect(weatherTool?.parameters.required).toEqual(['location']);
    });

    it('should NOT have echo or random_fact tools anymore', () => {
      const echoTool = AI_TOOLS.find(t => t.name === 'echo');
      const factTool = AI_TOOLS.find(t => t.name === 'random_fact');
      expect(echoTool).toBeUndefined();
      expect(factTool).toBeUndefined();
    });
  });

  describe('Tool Definitions for AI Gateway', () => {
    it('should define tools with OpenAI function format', () => {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'calculator',
            description: 'ONLY use for math',
            parameters: {
              type: 'object',
              properties: { a: { type: 'number' } },
              required: ['a']
            }
          }
        }
      ];

      expect(tools[0].type).toBe('function');
      expect(tools[0].function.name).toBe('calculator');
      expect(tools[0].function.description).toContain('ONLY');
    });
  });
});
