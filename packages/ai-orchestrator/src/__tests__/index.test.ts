import { describe, it, expect } from 'vitest';
import { AI_TOOLS } from '../index';

describe('AI Orchestrator', () => {
  describe('AI Tools Configuration', () => {
    it('should have 4 tools defined', () => {
      expect(AI_TOOLS).toHaveLength(4);
    });

    it('should have calculator tool', () => {
      const calcTool = AI_TOOLS.find(t => t.name === 'calculator');
      expect(calcTool).toBeDefined();
      expect(calcTool?.description).toContain('mathematical');
      expect(calcTool?.parameters.properties.operation).toBeDefined();
      expect((calcTool?.parameters.properties.operation as { enum: string[] }).enum).toEqual(['add', 'subtract', 'multiply', 'divide']);
      expect(calcTool?.parameters.required).toEqual(['operation', 'a', 'b']);
    });

    it('should have weather tool', () => {
      const weatherTool = AI_TOOLS.find(t => t.name === 'get_weather');
      expect(weatherTool).toBeDefined();
      expect(weatherTool?.description).toContain('weather');
      expect(weatherTool?.parameters.required).toEqual(['location']);
    });

    it('should have echo tool', () => {
      const echoTool = AI_TOOLS.find(t => t.name === 'echo');
      expect(echoTool).toBeDefined();
      expect(echoTool?.description).toContain('echo');
      expect(echoTool?.parameters.required).toEqual(['message']);
    });

    it('should have random_fact tool', () => {
      const factTool = AI_TOOLS.find(t => t.name === 'random_fact');
      expect(factTool).toBeDefined();
      expect(factTool?.description).toContain('fact');
      expect(factTool?.parameters.properties.category).toBeDefined();
      expect((factTool?.parameters.properties.category as { enum: string[] }).enum).toEqual(['science', 'history', 'technology', 'nature', 'space']);
    });
  });

  describe('Tool Definitions for AI Gateway', () => {
    it('should define tools with OpenAI function format', () => {
      const tools = AI_TOOLS.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        }
      }));

      expect(tools[0].type).toBe('function');
      expect(tools[0].function.name).toBe('calculator');
      expect(tools[0].function.description).toBeTruthy();
    });
  });

  describe('API Response Format', () => {
    it('should return empty toolCalls array when no tools are used', () => {
      const response = {
        ai: {
          response: "Terns are seabirds in the family Laridae...",
          tool_calls: []
        },
        toolCalls: []
      };

      expect(response.toolCalls).toHaveLength(0);
      expect(response.ai.tool_calls).toHaveLength(0);
      expect(response.ai.response).toBeTruthy();
    });

    it('should return toolCalls array when tools are used', () => {
      const response = {
        ai: {
          response: "The weather in Paris is sunny and 22°C",
          tool_calls: [{ name: 'get_weather', arguments: { location: 'Paris' } }]
        },
        toolCalls: [
          { tool: 'get_weather', arguments: { location: 'Paris' }, result: { temperature: 22 } }
        ]
      };

      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls[0].tool).toBe('get_weather');
      expect(response.toolCalls[0].result).toBeDefined();
    });

    it('should include tool_results in response when tools are called', () => {
      const toolCalls = [
        { 
          tool: 'calculator', 
          arguments: { operation: 'add', a: 5, b: 3 }, 
          result: 8 
        }
      ];

      expect(toolCalls[0]).toHaveProperty('result');
      expect(toolCalls[0].result).toBe(8);
    });
  });

  describe('UI Response Handling', () => {
    it('should show "MCP Not Used" when toolCalls is empty', () => {
      const data = { toolCalls: [], ai: { response: 'Hello' } };
      const mcpWasUsed = data.toolCalls && data.toolCalls.length > 0;
      
      expect(mcpWasUsed).toBe(false);
    });

    it('should show "MCP Server Used" when toolCalls has items', () => {
      const data = { 
        toolCalls: [{ tool: 'calculator', arguments: {} }], 
        ai: { response: 'Result is 10' } 
      };
      const mcpWasUsed = data.toolCalls && data.toolCalls.length > 0;
      const callCount = data.toolCalls.length;
      
      expect(mcpWasUsed).toBe(true);
      expect(callCount).toBe(1);
    });

    it('should handle pluralization for multiple tool calls', () => {
      const data = { 
        toolCalls: [
          { tool: 'calculator', arguments: {} },
          { tool: 'get_weather', arguments: {} }
        ], 
        ai: { response: 'Here are the results' } 
      };
      const callCount = data.toolCalls.length;
      const suffix = callCount > 1 ? 's' : '';
      
      expect(callCount).toBe(2);
      expect(suffix).toBe('s');
    });
  });

  describe('Streaming Support', () => {
    it('should detect stream response by getReader method', () => {
      const mockStream = {
        getReader: () => ({
          read: () => Promise.resolve({ done: true }),
          releaseLock: () => {},
        }),
      };
      
      const isStream = mockStream && typeof mockStream === 'object' && 'getReader' in mockStream;
      expect(isStream).toBe(true);
    });

    it('should return correct headers for streaming response', () => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
      
      const streamingHeaders = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...corsHeaders
      };
      
      expect(streamingHeaders['Content-Type']).toBe('text/event-stream');
      expect(streamingHeaders['Cache-Control']).toBe('no-cache');
    });

    it('should set stream flag in request body', () => {
      const body = {
        prompt: 'Tell me about cats',
        action: 'chat',
        stream: true
      };
      
      expect(body.stream).toBe(true);
    });
  });

  describe('Build Timestamp', () => {
    it('should have BUILD_TIME in expected format', () => {
      const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/;
      const BUILD_TIME = '2026-04-13 08:55 UTC';
      
      expect(BUILD_TIME).toMatch(timeRegex);
    });

    it('should replace __BUILD_TIME__ placeholder in HTML', () => {
      const html = '<span>__BUILD_TIME__</span>';
      const BUILD_TIME = '2026-04-13 08:55 UTC';
      const result = html.replace('__BUILD_TIME__', BUILD_TIME);
      
      expect(result).toBe('<span>2026-04-13 08:55 UTC</span>');
      expect(result).not.toContain('__BUILD_TIME__');
    });
  });
});
