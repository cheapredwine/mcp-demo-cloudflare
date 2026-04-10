const { createCanvas } = require('canvas');
const fs = require('fs');

// Canvas setup
const width = 1200;
const height = 800;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Cloudflare colors
const ORANGE = '#F48120';
const ORANGE_LIGHT = '#FFAA5C';
const DARK = '#1E1E1E';
const WHITE = '#FFFFFF';
const GRAY = '#F5F5F5';

// Fill background with gradient
const gradient = ctx.createLinearGradient(0, 0, width, height);
gradient.addColorStop(0, ORANGE);
gradient.addColorStop(0.5, ORANGE_LIGHT);
gradient.addColorStop(1, '#FFE4D1');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

// Helper function to draw rounded rectangle
function drawRoundedRect(x, y, w, h, r, color) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  
  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  ctx.stroke();
  ctx.shadowColor = 'transparent';
}

// Helper to draw arrow
function drawArrow(fromX, fromY, toX, toY, color) {
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Arrow head
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const arrowLength = 15;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - arrowLength * Math.cos(angle - Math.PI/6), toY - arrowLength * Math.sin(angle - Math.PI/6));
  ctx.lineTo(toX - arrowLength * Math.cos(angle + Math.PI/6), toY - arrowLength * Math.sin(angle + Math.PI/6));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Draw box helper
function drawBox(x, y, w, h, title, subtitle, icon, color) {
  drawRoundedRect(x, y, w, h, 12, WHITE);
  
  // Icon circle
  ctx.beginPath();
  ctx.arc(x + 35, y + 35, 20, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  
  // Icon text
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.fillText(icon, x + 35, y + 42);
  
  // Title
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = DARK;
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 70, y + 32);
  
  // Subtitle
  ctx.font = '14px Arial';
  ctx.fillStyle = '#666';
  ctx.fillText(subtitle, x + 70, y + 52);
}

// Title
ctx.font = 'bold 36px Arial';
ctx.fillStyle = DARK;
ctx.textAlign = 'center';
ctx.fillText('🤖 MCP Demo Architecture', width/2, 50);

ctx.font = '18px Arial';
ctx.fillStyle = '#444';
ctx.fillText('Cloudflare Workers + AI Gateway + MCP Protocol', width/2, 80);

// User/Browser
ctx.beginPath();
ctx.arc(100, 200, 40, 0, Math.PI * 2);
ctx.fillStyle = '#4CAF50';
ctx.fill();
ctx.font = '30px Arial';
ctx.fillStyle = WHITE;
ctx.textAlign = 'center';
ctx.fillText('👤', 100, 210);
ctx.font = 'bold 14px Arial';
ctx.fillStyle = DARK;
ctx.fillText('User', 100, 260);

// Browser
ctx.font = '14px Arial';
ctx.fillStyle = '#666';
ctx.fillText('Web Browser', 100, 150);

// AI Orchestrator Worker (center)
drawBox(400, 160, 320, 200, 'AI Orchestrator', 'Workers AI + AI Gateway', '🤖', ORANGE);

// MCP Server (right)
drawBox(780, 160, 320, 200, 'MCP Server', 'MCP Protocol Server', '🔧', '#2196F3');

// AI Gateway (below orchestrator)
drawBox(400, 420, 320, 130, 'AI Gateway', 'Caching + Analytics + Rate Limiting', '⚡', '#9C27B0');

// Workers AI Models (below AI Gateway)
drawBox(400, 600, 320, 100, 'Workers AI', '@cf/mistralai/mistral-small-3.1', '🧠', '#FF6B35');

// Service Binding label
drawRoundedRect(750, 220, 160, 40, 6, '#E3F2FD');
ctx.font = '12px Arial';
ctx.fillStyle = '#1565C0';
ctx.textAlign = 'center';
ctx.fillText('Service Binding', 830, 245);

// Draw arrows
// User -> Orchestrator
drawArrow(140, 200, 390, 240, DARK);

// Orchestrator -> MCP
drawArrow(720, 240, 770, 240, '#1565C0');

// Orchestrator -> AI Gateway
drawArrow(560, 360, 560, 415, DARK);

// AI Gateway -> Workers AI
drawArrow(560, 550, 560, 595, '#9C27B0');

// Legend
ctx.font = 'bold 14px Arial';
ctx.fillStyle = DARK;
ctx.textAlign = 'left';
ctx.fillText('Legend:', 50, 700);

// Legend items
const legendY = 730;
drawRoundedRect(50, legendY, 20, 20, 4, ORANGE);
ctx.font = '12px Arial';
ctx.fillStyle = DARK;
ctx.fillText('Cloudflare Workers', 80, legendY + 14);

drawRoundedRect(250, legendY, 20, 20, 4, '#2196F3');
ctx.fillText('MCP Server', 280, legendY + 14);

drawRoundedRect(400, legendY, 20, 20, 4, '#9C27B0');
ctx.fillText('AI Gateway', 430, legendY + 14);

// MCP Not Used indicator
ctx.beginPath();
ctx.arc(600, legendY + 10, 10, 0, Math.PI * 2);
ctx.fillStyle = '#6B7280';
ctx.fill();
ctx.fillStyle = DARK;
ctx.fillText('= MCP Not Used', 620, legendY + 14);

ctx.beginPath();
ctx.arc(750, legendY + 10, 10, 0, Math.PI * 2);
ctx.fillStyle = '#22C55E';
ctx.fill();
ctx.fillStyle = DARK;
ctx.fillText('= MCP Used', 770, legendY + 14);

// Flow description box
drawRoundedRect(50, 480, 280, 140, 8, WHITE);
ctx.font = 'bold 14px Arial';
ctx.fillStyle = DARK;
ctx.fillText('Flow:', 70, 505);
ctx.font = '11px Arial';
ctx.fillStyle = '#666';
ctx.fillText('1. User sends prompt', 70, 525);
ctx.fillText('2. AI decides: tool or direct?', 70, 545);
ctx.fillText('3. If tool: call MCP server', 70, 565);
ctx.fillText('4. Return response + status', 70, 585);
ctx.fillText('5. UI shows MCP used/not used', 70, 605);

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('mcp-demo-architecture.png', buffer);
console.log('✅ Diagram saved to mcp-demo-architecture.png');
