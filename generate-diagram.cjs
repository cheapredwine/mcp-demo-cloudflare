const { createCanvas } = require('canvas');
const fs = require('fs');

// Canvas setup
const width = 1200;
const height = 900;
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
function drawArrow(fromX, fromY, toX, toY, color, label) {
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
    ctx.font = '11px Arial';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    ctx.fillText(label, midX, midY - 5);
  }
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
  ctx.font = '12px Arial';
  ctx.fillStyle = '#666';
  ctx.fillText(subtitle, x + 70, y + 52);
}

// Draw inner box for nested components
function drawInnerBox(x, y, w, h, title, subtitle, color) {
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  
  // Title
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = DARK;
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 10, y + 22);
  
  // Subtitle
  ctx.font = '11px Arial';
  ctx.fillStyle = '#666';
  ctx.fillText(subtitle, x + 10, y + 38);
}

// Title
ctx.font = 'bold 32px Arial';
ctx.fillStyle = DARK;
ctx.textAlign = 'center';
ctx.fillText('MCP Demo Architecture', width/2, 45);

ctx.font = '16px Arial';
ctx.fillStyle = '#444';
ctx.fillText('Cloudflare Workers + Workers AI + AI Gateway + MCP', width/2, 70);

// User/Browser with 3-Panel UI
ctx.beginPath();
ctx.arc(100, 180, 40, 0, Math.PI * 2);
ctx.fillStyle = '#4CAF50';
ctx.fill();
ctx.font = '30px Arial';
ctx.fillStyle = WHITE;
ctx.textAlign = 'center';
ctx.fillText('👤', 100, 190);
ctx.font = 'bold 14px Arial';
ctx.fillStyle = DARK;
ctx.fillText('User', 100, 240);

// 3-Panel UI label
ctx.font = '12px Arial';
ctx.fillStyle = '#666';
ctx.fillText('3-Panel Web UI', 100, 260);

// AI Orchestrator Worker (main box)
drawBox(350, 120, 500, 400, 'AI Orchestrator (Worker)', 'mcp-demo.jsherron.com', '🤖', ORANGE);

// Workers AI inside AI Orchestrator
drawInnerBox(370, 180, 200, 100, 'Workers AI', '@cf/mistralai/mistral-small-3.1', PURPLE);

// AI Gateway inside AI Orchestrator
drawInnerBox(590, 180, 240, 120, 'AI Gateway', 'Caching + Analytics + Rate Limiting', '#FF6B35');

// Guardrails badge inside AI Gateway
ctx.fillStyle = '#DC2626';
ctx.fillRect(600, 235, 100, 22);
ctx.font = 'bold 10px Arial';
ctx.fillStyle = WHITE;
ctx.textAlign = 'center';
ctx.fillText('🛡️ Guardrails', 650, 250);

// Firewall for AI badge inside AI Gateway
ctx.fillStyle = '#2563EB';
ctx.fillRect(710, 235, 110, 22);
ctx.font = 'bold 10px Arial';
ctx.fillStyle = WHITE;
ctx.textAlign = 'center';
ctx.fillText('🔥 Firewall for AI', 765, 250);

// 3-Panel UI inside AI Orchestrator
drawInnerBox(370, 300, 460, 200, '3-Panel Web UI', 'Prompt | MCP Status | AI Response', GREEN);

// Arrow: Workers AI -> AI Gateway
drawArrow(570, 230, 590, 230, PURPLE, '');

// MCP Server (private, right side)
drawBox(900, 250, 260, 150, 'MCP Server (Worker)', 'Private - No Public URL', '🔧', BLUE);

// Arrow: AI Orchestrator -> MCP Server (Service Binding)
drawArrow(850, 325, 900, 325, BLUE, 'Service Binding');

// HTTP Log Panel (bottom)
drawInnerBox(350, 540, 500, 80, 'HTTP Call Log', 'Workers AI calls + MCP interactions', DARK);

// Legend
ctx.font = 'bold 14px Arial';
ctx.fillStyle = DARK;
ctx.textAlign = 'left';
ctx.fillText('Legend:', 50, 700);

// Legend items
let legendY = 725;

ctx.fillStyle = ORANGE;
ctx.fillRect(50, legendY, 20, 20);
ctx.font = '12px Arial';
ctx.fillStyle = DARK;
ctx.fillText('Cloudflare Workers', 80, legendY + 14);

ctx.fillStyle = PURPLE;
ctx.fillRect(250, legendY, 20, 20);
ctx.fillText('Workers AI', 280, legendY + 14);

ctx.fillStyle = '#FF6B35';
ctx.fillRect(400, legendY, 20, 20);
ctx.fillText('AI Gateway', 430, legendY + 14);

ctx.fillStyle = BLUE;
ctx.fillRect(550, legendY, 20, 20);
ctx.fillText('MCP Server (Private)', 580, legendY + 14);

ctx.fillStyle = GREEN;
ctx.fillRect(750, legendY, 20, 20);
ctx.fillText('3-Panel UI', 780, legendY + 14);

ctx.fillStyle = '#DC2626';
ctx.fillRect(900, legendY, 20, 20);
ctx.fillText('Guardrails', 930, legendY + 14);

ctx.fillStyle = '#2563EB';
ctx.fillRect(1050, legendY, 20, 20);
ctx.fillText('Firewall for AI', 1080, legendY + 14);

// Features box
ctx.font = 'bold 14px Arial';
ctx.fillStyle = DARK;
ctx.fillText('Key Features:', 50, 760);

ctx.font = '11px Arial';
ctx.fillStyle = '#444';
ctx.fillText('• Enter to submit, Shift+Enter for newline', 50, 780);
ctx.fillText('• HTTP Log shows all internal API calls', 50, 795);
ctx.fillText('• MCP Server accessible only via Service Binding (secure)', 50, 810);
ctx.fillText('• AI Gateway provides caching, analytics, rate limiting', 50, 825);

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('mcp-demo-architecture.png', buffer);
console.log('✅ Architecture diagram saved to mcp-demo-architecture.png');
