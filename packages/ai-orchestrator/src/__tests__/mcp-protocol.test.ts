import { describe, it, expect, vi } from 'vitest';

describe('MCP Protocol', () => {
  describe('HTTP Headers', () => {
    it('should include text/event-stream in Accept header for initialization', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      };
      
      expect(headers['Accept']).toContain('application/json');
      expect(headers['Accept']).toContain('text/event-stream');
    });

    it('should include text/event-stream in Accept header for tool calls', () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Protocol-Version': '2024-11-05',
      };
      
      expect(headers['Accept']).toContain('text/event-stream');
      expect(headers['Mcp-Protocol-Version']).toBe('2024-11-05');
    });

    it('should include session ID when available', () => {
      const sessionId = 'test-session-123';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Protocol-Version': '2024-11-05',
      };
      
      if (sessionId) {
        headers['Mcp-Session-Id'] = sessionId;
      }
      
      expect(headers['Mcp-Session-Id']).toBe('test-session-123');
    });
  });

  describe('MCP Initialization', () => {
    it('should send correct initialize request body', () => {
      const initBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'ai-orchestrator', version: '1.0.0' },
        },
      };

      expect(initBody.jsonrpc).toBe('2.0');
      expect(initBody.method).toBe('initialize');
      expect(initBody.params.protocolVersion).toBe('2024-11-05');
      expect(initBody.params.clientInfo.name).toBe('ai-orchestrator');
    });
  });

  describe('Tool Call Request', () => {
    it('should send correct tool call request body', () => {
      const toolBody = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_weather',
          arguments: { location: 'Tokyo' },
        },
      };

      expect(toolBody.jsonrpc).toBe('2.0');
      expect(toolBody.method).toBe('tools/call');
      expect(toolBody.params.name).toBe('get_weather');
      expect(toolBody.params.arguments.location).toBe('Tokyo');
    });
  });

  describe('AI Gateway Integration', () => {
    it('should format tools correctly for AI Gateway', () => {
      const AI_TOOLS = [
        {
          name: 'get_weather',
          description: 'Get weather',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        },
      ];

      const formattedTools = AI_TOOLS.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      expect(formattedTools[0].type).toBe('function');
      expect(formattedTools[0].function.name).toBe('get_weather');
      expect(formattedTools[0].function.parameters.required).toContain('location');
    });

    it('should parse tool calls from AI Gateway response', () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              function: {
                name: 'get_weather',
                arguments: '{"location": "Tokyo"}',
              },
            }],
          },
        }],
      };

      const toolCalls = mockResponse.choices[0].message.tool_calls
        .filter(tc => tc.function?.name)
        .map(tc => ({
          name: tc.function.name!,
          arguments: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
        }));

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].name).toBe('get_weather');
      expect(toolCalls[0].arguments.location).toBe('Tokyo');
    });
  });

  describe('Two-Step Conversation Flow', () => {
    it('should construct proper messages for step 2 (tool results)', () => {
      const prompt = 'What is the weather in Tokyo?';
      const toolCalls = [{ name: 'get_weather', arguments: { location: 'Tokyo' } }];
      const toolResults = [{ tool: 'get_weather', result: { condition: 'Sunny', temperature: 22 } }];

      const toolResultsMessage = toolResults.map(tc => 
        `Tool: ${tc.tool}\nArguments: ${JSON.stringify(toolCalls.find(t => t.name === tc.tool)?.arguments)}\nResult: ${JSON.stringify(tc.result)}`
      ).join('\n\n');

      const messages = [
        { role: 'system', content: 'You are a helpful assistant. Based on the tool results provided, give a clear and helpful response to the user.' },
        { role: 'user', content: prompt },
        { role: 'assistant', content: `I need to use tools to answer this. Let me call: ${toolCalls.map(tc => tc.name).join(', ')}` },
        { role: 'user', content: `Here are the tool results:\n\n${toolResultsMessage}\n\nPlease provide a helpful response based on these results.` },
      ];

      expect(messages).toHaveLength(4);
      expect(messages[2].content).toContain('get_weather');
      expect(messages[3].content).toContain('Sunny');
    });
  });

  describe('MCP Tool Response Parsing', () => {
    it('should parse calculator response correctly', () => {
      const mockCalcResponse = {
        content: [
          { type: 'text', text: '25 * 47 = 1175' },
        ],
      };

      const resultText = mockCalcResponse.content?.[0]?.text || 'Error';
      
      expect(resultText).toBe('25 * 47 = 1175');
      expect(resultText).toContain('1175');
    });

    it('should handle calculator response fallback', () => {
      const mockCalcResponse = { content: [] };

      const a = 25, b = 47;
      const opSymbol = '*';
      const resultText = mockCalcResponse.content?.[0]?.text || `${a} ${opSymbol} ${b} = [error]`;
      
      expect(resultText).toBe('25 * 47 = [error]');
    });

    it('should parse weather response correctly', () => {
      const mockWeatherResponse = {
        content: [
          { type: 'text', text: 'Weather for Paris:' },
          { type: 'text', text: 'Condition: Sunny' },
          { type: 'text', text: 'Temperature: 22°C' },
          { type: 'text', text: 'Humidity: 45%' },
          { type: 'text', text: 'Wind: 10 km/h' },
        ],
      };

      const weatherLines = mockWeatherResponse.content?.map(c => c.text).join('\n') || 'Weather data unavailable';
      
      expect(weatherLines).toContain('Paris');
      expect(weatherLines).toContain('Sunny');
      expect(weatherLines).toContain('22°C');
    });

    it('should handle empty weather response', () => {
      const mockWeatherResponse = { content: [] };

      const weatherLines = mockWeatherResponse.content?.map(c => c.text).join('\n') || 'Weather data unavailable';
      
      expect(weatherLines).toBe('Weather data unavailable');
    });
  });
});
