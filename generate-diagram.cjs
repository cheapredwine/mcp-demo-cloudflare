const { createCanvas } = require('canvas');
const fs = require('fs');

// Canvas setup
const width = 1400;
const height = 1100;
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
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.fillText(icon, x + 35, y + 36);
  
  // Title
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = DARK;
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 65, y + 26);
  
  // Subtitle
  ctx.font = '13px Arial';
  ctx.fillStyle = '#666';
  ctx.fillText(subtitle, x + 65, y + 44);
}

// Draw inner component box
function drawComponentBox(x, y, w, h, title, lines, borderColor) {
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  
  // Title
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = DARK;
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 12, y + 24);
  
  // Lines
  ctx.font = '12px Arial';
  ctx.fillStyle = '#555';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + 12, y + 44 + (i * 16));
  });
}

// Draw badge
function drawBadge(x, y, w, h, text, bgColor) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);
  ctx.font = 'bold 11px Arial';
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w/2, y + h/2 + 4);
}

// Title
ctx.font = 'bold 36px Arial';
ctx.fillStyle = DARK;
ctx.textAlign = 'center';
ctx.fillText('MCP Demo Architecture', width/2, 45);

ctx.font = '18px Arial';
ctx.fillStyle = '#444';
ctx.fillText('Cloudflare Workers + Workers AI + AI Gateway + MCP', width/2, 72);

// User (top) - moved down to avoid overlap
ctx.beginPath();
ctx.arc(width/2, 130, 35, 0, Math.PI * 2);
ctx.fillStyle = '#4CAF50';
ctx.fill();
ctx.font = 'bold 24px Arial';
ctx.fillStyle = WHITE;
ctx.textAlign = 'center';
ctx.fillText('👤', width/2, 138);
ctx.font = 'bold 14px Arial';
ctx.fillStyle = DARK;
ctx.fillText('User', width/2, 180);

// Web browser label to the side
ctx.font = '12px Arial';
ctx.fillStyle = '#666';
ctx.textAlign = 'left';
ctx.fillText('🌐 Web browser with 3-Panel UI', width/2 + 60, 160);

// AI Orchestrator (below user) - moved down
drawBox(350, 230, 700, 180, 'AI Orchestrator (Worker)', 'mcp-demo.jsherron.com', '🤖', ORANGE);

// 3-Panel Web UI inside AI Orchestrator
drawComponentBox(370, 290, 660, 110, '3-Panel Web UI', [
  '• Prompt | MCP Status | AI Response',
  '• Enter to submit, Shift+Enter for newline',
  '• HTTP Log panel shows all internal calls'
], GREEN);

// Arrow: User -> AI Orchestrator
drawArrow(width/2, 185, width/2, 230, DARK, 'HTTP');

// Arrow: AI Orchestrator -> Cloudflare AI Platform - moved to avoid overlap
drawArrow(width/2, 410, width/2, 450, PURPLE, 'Workers AI Binding', 'right');

// Cloudflare AI Platform (middle layer) - moved down
drawRoundedRect(200, 460, 1000, 240, 12, '#E8F4FD');
ctx.font = 'bold 16px Arial';
ctx.fillStyle = DARK;
ctx.textAlign = 'center';
ctx.fillText('Cloudflare AI Platform', width/2, 488);

// Workers AI box (left side of platform)
drawComponentBox(240, 510, 440, 170, 'Workers AI', [
  '• Workers AI LLM model instance',
  '• Natural language understanding',
  '• Intelligent tool selection',
  '• Tool calling capability'
], PURPLE);

// AI Gateway box (right side of platform)
drawComponentBox(720, 510, 460, 170, 'AI Gateway + Security', [
  '• Caching + Analytics + Rate limiting',
  '• Guardrails: Blocks prompt injection attacks',
  '• Firewall for AI: PII detection & blocking',
  '• Content filtering for safe responses'
], '#FF6B35');

// Badges for AI Gateway
drawBadge(900, 605, 110, 24, '🛡️ Guardrails', RED);
drawBadge(1020, 605, 140, 24, '🔥 Firewall for AI', BLUE);

// Bidirectional arrow between Workers AI and AI Gateway
drawArrow(680, 595, 720, 595, '#666', '', '');
drawArrow(720, 615, 680, 615, '#666', '', '');

// Arrow: Cloudflare AI Platform -> MCP Server - moved to avoid overlap
drawArrow(width/2, 700, width/2, 760, BLUE, 'Service Binding', 'right');

// MCP Server (bottom) - moved down
drawBox(400, 760, 600, 160, 'MCP Server (Worker)', 'Private - No Public URL', '🔧', BLUE);

// MCP Server content
drawComponentBox(420, 820, 560, 90, 'MCP Protocol Handler', [
  '• Exposes 2 tools: calculator, get_weather',
  '• Only accessible via Service Binding (secure)'
], BLUE);

// Legend (bottom left) - moved down
let legendY = 980;
ctx.font = 'bold 16px Arial';
ctx.fillStyle = DARK;
ctx.textAlign = 'left';
ctx.fillText('Legend:', 50, legendY);

legendY += 32;
const legendItems = [
  { color: ORANGE, text: 'Cloudflare Workers' },
  { color: GREEN, text: 'Web UI' },
  { color: PURPLE, text: 'Workers AI' },
  { color: '#FF6B35', text: 'AI Gateway + WAF' },
  { color: BLUE, text: 'MCP Server (Private)' },
  { color: RED, text: 'Guardrails + PII' }
];

let legendX = 50;
legendItems.forEach((item, i) => {
  ctx.fillStyle = item.color;
  ctx.fillRect(legendX, legendY, 24, 24);
  ctx.font = '14px Arial';
  ctx.fillStyle = DARK;
  ctx.fillText(item.text, legendX + 30, legendY + 17);
  legendX += 200;
  if (i === 2) {
    legendX = 50;
    legendY += 32;
  }
});

// Note (bottom) - moved down
ctx.font = '13px Arial';
ctx.fillStyle = '#666';
ctx.textAlign = 'left';
ctx.fillText('Security: Firewall for AI blocks prompt injection. PII detection protects sensitive data.', 50, 1060);
ctx.fillText('Guardrails provide additional content filtering. Custom domain enables WAF rules.', 50, 1080);
ctx.fillText('Note: Workers AI is a platform service. In this demo we use the Workers AI binding.', 50, 1100);

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('mcp-demo-architecture.png', buffer);
console.log('✅ Architecture diagram saved to mcp-demo-architecture.png');
