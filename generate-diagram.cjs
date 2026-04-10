const { createCanvas } = require('canvas');
const fs = require('fs');

// Canvas setup
const width = 1200;
const height = 950;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Cloudflare colors
const ORANGE = '#F48120';
const ORANGE_LIGHT = '#FFAA5C';
const DARK = '#1E1E1E';
const WHITE = '#FFFFFF';
const GRAY = '#F5F5F5';
const PURPLE = '#9C27B0';
const BLUE = '#2196F3';
const GREEN = '#22C55E';
const RED = '#DC2626';

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

// Helper to draw arrow with label
function drawArrow(fromX, fromY, toX, toY, color, label, labelPos = 'top') {
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
  
  // Label
  if (label) {
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = DARK;
    ctx.textAlign = 'center';
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    if (labelPos === 'top') {
      ctx.fillText(label, midX, midY - 8);
    } else if (labelPos === 'bottom') {
      ctx.fillText(label, midX, midY + 15);
    } else if (labelPos === 'left') {
      ctx.fillText(label, midX - 60, midY + 4);
    } else if (labelPos === 'right') {
      ctx.fillText(label, midX + 60, midY + 4);
    }
  }
}

// Draw main box
function drawBox(x, y, w, h, title, subtitle, icon, color) {
  drawRoundedRect(x, y, w, h, 12, WHITE);
  
  // Icon circle
  ctx.beginPath();
  ctx.arc(x + 35, y + 30, 18, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  
  // Icon text
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.fillText(icon, x + 35, y + 36);
  
  // Title
  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = DARK;
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 65, y + 26);
  
  // Subtitle
  ctx.font = '11px Arial';
  ctx.fillStyle = '#666';
  ctx.fillText(subtitle, x + 65, y + 42);
}

// Draw inner component box
function drawComponentBox(x, y, w, h, title, lines, borderColor) {
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  
  // Title
  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = DARK;
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 10, y + 22);
  
  // Lines
  ctx.font = '11px Arial';
  ctx.fillStyle = '#666';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + 10, y + 40 + (i * 14));
  });
}

// Draw badge
function drawBadge(x, y, w, h, text, bgColor) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);
  ctx.font = 'bold 10px Arial';
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w/2, y + h/2 + 3);
}

// Title
ctx.font = 'bold 32px Arial';
ctx.fillStyle = DARK;
ctx.textAlign = 'center';
ctx.fillText('MCP Demo Architecture', width/2, 45);

ctx.font = '16px Arial';
ctx.fillStyle = '#444';
ctx.fillText('Cloudflare Workers + Workers AI + AI Gateway + MCP', width/2, 70);

// User (top)
ctx.beginPath();
ctx.arc(width/2, 110, 35, 0, Math.PI * 2);
ctx.fillStyle = '#4CAF50';
ctx.fill();
ctx.font = 'bold 24px Arial';
ctx.fillStyle = WHITE;
ctx.textAlign = 'center';
ctx.fillText('👤', width/2, 118);
ctx.font = 'bold 13px Arial';
ctx.fillStyle = DARK;
ctx.fillText('User', width/2, 160);
ctx.font = '11px Arial';
ctx.fillStyle = '#666';
ctx.fillText('Web browser with 3-Panel UI', width/2, 175);

// AI Orchestrator (below user)
drawBox(300, 200, 600, 180, 'AI Orchestrator (Worker)', 'mcp-demo.jsherron.com', '🤖', ORANGE);

// 3-Panel Web UI inside AI Orchestrator
drawComponentBox(320, 260, 560, 110, '3-Panel Web UI', [
  '• Prompt | MCP Status | AI Response',
  '• Enter to submit, Shift+Enter for newline',
  '• HTTP Log panel shows all internal calls'
], GREEN);

// Arrow: User -> AI Orchestrator
drawArrow(width/2, 175, width/2, 200, DARK, 'HTTP');

// Arrow: AI Orchestrator -> Cloudflare AI Platform
drawArrow(width/2, 380, width/2, 420, PURPLE, 'Workers AI Binding', 'left');

// Cloudflare AI Platform (middle layer)
drawRoundedRect(150, 420, 900, 220, 12, '#E8F4FD');
ctx.font = 'bold 14px Arial';
ctx.fillStyle = DARK;
ctx.textAlign = 'center';
ctx.fillText('Cloudflare AI Platform', width/2, 445);

// Workers AI box (left side of platform)
drawComponentBox(180, 460, 380, 160, 'Workers AI', [
  '• Workers AI LLM model instance',
  '• Natural language understanding',
  '• Intelligent tool selection',
  '• Tool calling capability'
], PURPLE);

// AI Gateway box (right side of platform)
drawComponentBox(590, 460, 430, 160, 'AI Gateway', [
  '• Caching + Analytics',
  '• Rate limiting',
  '• Guardrails (prompt injection protection)',
  '• Firewall for AI (content filtering)'
], '#FF6B35');

// Badges for AI Gateway
drawBadge(750, 545, 100, 20, '🛡️ Guardrails', RED);
drawBadge(870, 545, 130, 20, '🔥 Firewall for AI', BLUE);

// Bidirectional arrow between Workers AI and AI Gateway
drawArrow(560, 540, 590, 540, '#666', '', '');
drawArrow(590, 560, 560, 560, '#666', '', '');

// Arrow: Cloudflare AI Platform -> MCP Server
drawArrow(width/2, 640, width/2, 680, BLUE, 'Service Binding', 'left');

// MCP Server (bottom)
drawBox(350, 680, 500, 140, 'MCP Server (Worker)', 'Private - No Public URL', '🔧', BLUE);

// MCP Server content
drawComponentBox(370, 730, 460, 80, 'MCP Protocol Handler', [
  '• Exposes 2 tools: calculator, get_weather',
  '• Only accessible via Service Binding (secure)'
], BLUE);

// Legend (bottom left)
let legendY = 850;
ctx.font = 'bold 14px Arial';
ctx.fillStyle = DARK;
ctx.textAlign = 'left';
ctx.fillText('Legend:', 50, legendY);

legendY += 25;
const legendItems = [
  { color: ORANGE, text: 'Cloudflare Workers' },
  { color: GREEN, text: 'Web UI' },
  { color: PURPLE, text: 'Workers AI' },
  { color: '#FF6B35', text: 'AI Gateway' },
  { color: BLUE, text: 'MCP Server (Private)' },
  { color: RED, text: 'Guardrails' }
];

let legendX = 50;
legendItems.forEach((item, i) => {
  ctx.fillStyle = item.color;
  ctx.fillRect(legendX, legendY, 18, 18);
  ctx.font = '11px Arial';
  ctx.fillStyle = DARK;
  ctx.fillText(item.text, legendX + 24, legendY + 13);
  legendX += 140;
  if (i === 2) {
    legendX = 50;
    legendY += 25;
  }
});

// Note (bottom right)
ctx.font = '10px Arial';
ctx.fillStyle = '#666';
ctx.textAlign = 'left';
ctx.fillText('Note: In this demo, Workers AI is accessed via binding. In production, you might deploy Workers AI', 50, 935);
ctx.fillText('as a separate service or use the HTTP API directly.', 50, 948);

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('mcp-demo-architecture.png', buffer);
console.log('✅ Architecture diagram saved to mcp-demo-architecture.png');
