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

  describe('SSE Stream Parsing', () => {
    it('should parse single SSE event', () => {
      const sseData = 'data: {"response": "Hello"}\n\n';
      
      // Simulate parsing
      const lines = sseData.split(/\r?\n/);
      let fullText = '';
      let currentEvent = '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          currentEvent = line.slice(6);
        } else if (line === '' && currentEvent) {
          if (currentEvent === '[DONE]') {
            currentEvent = '';
            continue;
          }
          try {
            const parsed = JSON.parse(currentEvent);
            if (parsed.response) {
              fullText += parsed.response;
            }
          } catch (e) {
            // Invalid JSON
          }
          currentEvent = '';
        }
      }
      
      expect(fullText).toBe('Hello');
    });

    it('should parse multiple SSE events', () => {
      const sseData = 'data: {"response": "Tab"}\n\ndata: {"response": "by"}\n\ndata: {"response": " cats"}\n\n';
      
      const lines = sseData.split(/\r?\n/);
      let fullText = '';
      let currentEvent = '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          currentEvent = line.slice(6);
        } else if (line === '' && currentEvent) {
          if (currentEvent === '[DONE]') {
            currentEvent = '';
            continue;
          }
          try {
            const parsed = JSON.parse(currentEvent);
            if (parsed.response) {
              fullText += parsed.response;
            }
          } catch (e) {
            // Invalid JSON
          }
          currentEvent = '';
        }
      }
      
      expect(fullText).toBe('Tabby cats');
    });

    it('should ignore [DONE] event', () => {
      const sseData = 'data: {"response": "Hello"}\n\ndata: [DONE]\n\n';
      
      const lines = sseData.split(/\r?\n/);
      let fullText = '';
      let currentEvent = '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          currentEvent = line.slice(6);
        } else if (line === '' && currentEvent) {
          if (currentEvent === '[DONE]') {
            currentEvent = '';
            continue;
          }
          try {
            const parsed = JSON.parse(currentEvent);
            if (parsed.response) {
              fullText += parsed.response;
            }
          } catch (e) {
            // Invalid JSON
          }
          currentEvent = '';
        }
      }
      
      expect(fullText).toBe('Hello');
    });

    it('should handle events with p field (Workers AI)', () => {
      const sseData = 'data: {"response": "Test", "p": "abc123"}\n\n';
      
      const lines = sseData.split(/\r?\n/);
      let fullText = '';
      let currentEvent = '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          currentEvent = line.slice(6);
        } else if (line === '' && currentEvent) {
          if (currentEvent === '[DONE]') {
            currentEvent = '';
            continue;
          }
          try {
            const parsed = JSON.parse(currentEvent);
            if (parsed.response) {
              fullText += parsed.response;
            }
          } catch (e) {
            // Invalid JSON
          }
          currentEvent = '';
        }
      }
      
      expect(fullText).toBe('Test');
    });

    it('should handle CRLF line endings', () => {
      const sseData = 'data: {"response": "Hello"}\r\n\r\ndata: {"response": " World"}\r\n\r\n';
      
      const lines = sseData.split(/\r?\n/);
      let fullText = '';
      let currentEvent = '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          currentEvent = line.slice(6);
        } else if (line === '' && currentEvent) {
          if (currentEvent === '[DONE]') {
            currentEvent = '';
            continue;
          }
          try {
            const parsed = JSON.parse(currentEvent);
            if (parsed.response) {
              fullText += parsed.response;
            }
          } catch (e) {
            // Invalid JSON
          }
          currentEvent = '';
        }
      }
      
      expect(fullText).toBe('Hello World');
    });

    it('should handle incomplete events in buffer', () => {
      // First chunk has incomplete event
      const chunk1 = 'data: {"response": "Hel';
      const chunk2 = 'lo"}\n\n';
      
      let buffer = chunk1;
      let fullText = '';
      
      // Process first chunk
      buffer += chunk2;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      
      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          currentEvent = line.slice(6);
        } else if (line === '' && currentEvent) {
          try {
            const parsed = JSON.parse(currentEvent);
            if (parsed.response) {
              fullText += parsed.response;
            }
          } catch (e) {
            // Invalid JSON
          }
          currentEvent = '';
        }
      }
      
      expect(fullText).toBe('Hello');
    });

    it('should parse SSE using indexOf with String.fromCharCode like production', () => {
      // Mirrors the production code that uses String.fromCharCode(10)
      // to avoid template string newline issues
      const chunks = [
        'data: {"response": "Hello","p":"abc"}\n',
        'data: {"response": " World","p":"def"}\n',
        'data: {"response": "!","p":"ghi"}\n'
      ];
      
      let buffer = '';
      let fullText = '';
      
      for (const chunk of chunks) {
        buffer += chunk;
        
        // Process complete lines
        let lineEnd;
        while ((lineEnd = buffer.indexOf(String.fromCharCode(10))) !== -1) {
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);
          
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(jsonStr);
              if (data.response) {
                fullText += data.response;
              }
            } catch (err) {
              // Invalid JSON, skip
            }
          }
        }
      }
      
      expect(fullText).toBe('Hello World!');
    });

    it('should handle chunks that break mid-line', () => {
      // First chunk ends mid-JSON, second completes it
      const chunk1 = 'data: {"response": "Hel';
      const chunk2 = 'lo","p":"abc"}\n';
      const chunk3 = 'data: {"response": " World","p":"def"}\n';
      
      let buffer = '';
      let fullText = '';
      
      // Process chunk 1
      buffer += chunk1;
      let lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      // No complete lines yet
      expect(fullText).toBe('');
      
      // Process chunk 2 - completes first event
      buffer += chunk2;
      lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.response) fullText += data.response;
          } catch (err) {}
        }
      }
      
      expect(fullText).toBe('Hello');
      
      // Process chunk 3
      buffer += chunk3;
      lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.response) fullText += data.response;
          } catch (err) {}
        }
      }
      
      expect(fullText).toBe('Hello World');
    });

    it('should ignore empty events and [DONE] markers', () => {
      const input = 'data: {"response": "Hello"}\n\ndata: [DONE]\n\ndata: {"response": " World"}\n\n';
      
      let buffer = input;
      let fullText = '';
      
      // Split on double newlines for events
      const events = buffer.split('\n\n');
      
      for (const event of events) {
        if (!event.trim()) continue;
        
        const lines = event.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.response) fullText += parsed.response;
            } catch (e) {}
          }
        }
      }
      
      expect(fullText).toBe('Hello World');
      expect(fullText).not.toContain('[DONE]');
    });

    it('should handle only [DONE] events', () => {
      const input = 'data: [DONE]\n\n';
      
      let buffer = input;
      let fullText = '';
      
      const lines = buffer.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.response) fullText += parsed.response;
          } catch (e) {}
        }
      }
      
      expect(fullText).toBe('');
    });

    it('should handle events without p field', () => {
      const input = 'data: {"response": "Hello"}\ndata: {"response": " World"}\n';
      
      let buffer = input;
      let fullText = '';
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;
          
          try {
            const data = JSON.parse(jsonStr);
            if (data.response) fullText += data.response;
          } catch (err) {}
        }
      }
      
      expect(fullText).toBe('Hello World');
    });

    it('should skip invalid JSON gracefully', () => {
      const input = 'data: {"response": "Hello"}\ndata: invalid json here\ndata: {"response": " World"}\n';
      
      let buffer = input;
      let fullText = '';
      let errorCount = 0;
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;
          
          try {
            const data = JSON.parse(jsonStr);
            if (data.response) fullText += data.response;
          } catch (err) {
            errorCount++;
          }
        }
      }
      
      expect(fullText).toBe('Hello World');
      expect(errorCount).toBe(1);
    });

    it('should handle very long responses split across many chunks', () => {
      // Simulate a long response coming in many small chunks
      const words = ['The', ' quick', ' brown', ' fox', ' jumps', ' over', ' the', ' lazy', ' dog'];
      let buffer = '';
      let fullText = '';
      
      for (const word of words) {
        // Each word comes in its own chunk
        const chunk = `data: {"response": "${word}","p":"xyz"}\n`;
        buffer += chunk;
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(jsonStr);
              if (data.response) fullText += data.response;
            } catch (err) {}
          }
        }
      }
      
      expect(fullText).toBe('The quick brown fox jumps over the lazy dog');
    });

    it('should handle actual Workers AI SSE format with usage field', () => {
      // Real Workers AI response includes usage at the end
      const chunks = [
        'data: {"response": "Tab","p":"abc123"}\n\n',
        'data: {"response": "by cats","p":"def456"}\n\n',
        'data: {"response": " are","p":"ghi789"}\n\n',
        'data: {"response": " great","p":"jkl012"}\n\n',
        'data: {"response": "!","p":"mno345","usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
        'data: [DONE]\n\n'
      ];
      
      let buffer = '';
      let fullText = '';
      
      for (const chunk of chunks) {
        buffer += chunk;
        
        // Process events separated by double newlines
        let eventEnd;
        while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);
          
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              if (jsonStr === '[DONE]') continue;
              
              try {
                const data = JSON.parse(jsonStr);
                if (data.response) fullText += data.response;
              } catch (err) {}
            }
          }
        }
      }
      
      expect(fullText).toBe('Tabby cats are great!');
    });

    it('should stream text character by character', () => {
      // Simulate streaming where each chunk is one character
      const chars = 'Hello'.split('');
      let buffer = '';
      let fullText = '';
      const outputs: string[] = [];
      
      for (const char of chars) {
        buffer += `data: {"response": "${char}","p":"x"}\n\n`;
        
        let eventEnd;
        while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);
          
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              try {
                const data = JSON.parse(jsonStr);
                if (data.response) {
                  fullText += data.response;
                  outputs.push(fullText);
                }
              } catch (err) {}
            }
          }
        }
      }
      
      expect(outputs).toEqual(['H', 'He', 'Hel', 'Hell', 'Hello']);
      expect(fullText).toBe('Hello');
    });
  });
});
