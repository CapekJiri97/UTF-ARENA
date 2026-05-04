import { game } from './State.js';

export class Particle {
  constructor(x, y, color, opts={}) {
    this.pos = {x, y};
    this.angle = opts.angle !== undefined ? opts.angle : Math.random() * Math.PI * 2; 
    const spd = opts.speed !== undefined ? opts.speed : 50 + Math.random() * 100;
    this.vel = {x: Math.cos(this.angle)*spd, y: Math.sin(this.angle)*spd};
    this.life = opts.life || (0.3 + Math.random() * 0.3); this.maxLife = this.life; this.color = color;
    this.glyph = opts.glyph || '.'; this.size = opts.size || 10;
    this.grow = opts.grow || 0;
    this.rotate = opts.rotate || false;
    this.shape = opts.shape || 'text';
    this.radius = opts.radius || 0;
    this.lineWidth = opts.lineWidth || 2;
    this.cone = opts.cone || Math.PI/2;
    this.stretchX = opts.stretchX || 1;
    this.stretchY = opts.stretchY || 1;
  }
  update(dt) { this.pos.x += this.vel.x*dt; this.pos.y += this.vel.y*dt; this.life -= dt; this.size = Math.max(1, this.size + this.grow * dt); }
  draw(ctx) { 
    ctx.save(); ctx.globalAlpha = Math.max(0, this.life/this.maxLife); 
    if(this.shape === 'ring') {
      ctx.strokeStyle = this.color; ctx.lineWidth = this.lineWidth;
      ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI*2); ctx.stroke();
    } else if (this.shape === 'arc') {
      ctx.strokeStyle = this.color; ctx.lineWidth = this.lineWidth;
      ctx.beginPath(); 
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.arc(this.pos.x, this.pos.y, this.radius, this.angle - this.cone/2, this.angle + this.cone/2); 
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color; ctx.font = this.size+'px monospace'; 
      ctx.translate(this.pos.x, this.pos.y);
      if(this.rotate) ctx.rotate(this.angle);
      if(this.stretchX !== 1 || this.stretchY !== 1) ctx.scale(this.stretchX, this.stretchY);
      ctx.fillText(this.glyph, 0, 0);
    }
    ctx.restore(); 
  }
}

export function spawnParticles(x, y, count, color, opts={}) {
  for(let i=0; i<count; i++) game.particles.push(new Particle(x, y, color, opts));
}

export class DamageNumber { 
    constructor(x, y, val, color = '#ffc83c') { 
        this.pos = { x, y }; 
        this.val = val; 
        this.life = 0.8; 
        this.color = color;
        let num = parseFloat(val.toString().replace('+', ''));
        this.size = isNaN(num) ? 14 : Math.min(36, Math.max(12, 10 + (num / 15)));
    } 
    update(dt) { this.pos.y -= 20 * dt; this.life -= dt; } 
    draw(ctx) { 
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life / 0.8); 
        ctx.fillStyle = this.color; ctx.font = `bold ${Math.round(this.size)}px monospace`; ctx.textAlign = 'center'; 
        ctx.fillText(this.val, this.pos.x, this.pos.y); 
        ctx.restore(); 
    } 
}

export class EffectText {
  constructor(x, y, text, color, opts = {}) {
    this.pos = { x, y };
    this.text = text;
    this.life = opts.life || 1.5;
    this.maxLife = this.life;
    this.color = color || '#ffcc00';
    this.size = opts.size || 20;
  }
  update(dt) {
    this.pos.y -= 25 * dt;
    this.life -= dt;
  }
  draw(ctx) {
    ctx.save();
    const alpha = Math.sin(Math.max(0, this.life / this.maxLife) * Math.PI); // Fade in and out smoothly
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color; ctx.font = `bold ${this.size}px monospace`; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 5;
    ctx.fillText(this.text, this.pos.x, this.pos.y); ctx.restore();
  }
}