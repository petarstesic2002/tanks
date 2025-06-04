let light = { x: 100, y: 100 };
let powerups = [];
const shieldDuration = 300;

const explosions = [];

function createExplosion(x, y) {
    explosions.push({ x, y, radius: 0, alpha: 1 });
}

function updateExplosions() {
    for (let e of explosions) {
        e.radius += 2;
        e.alpha -= 0.05;
    }
    explosions = explosions.filter(e => e.alpha > 0);
}

function drawExplosions() {
    for (let e of explosions) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 150, 0, ${e.alpha})`;
        ctx.fill();
    }
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gameStarted = false;

const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

let walls = [
    { x: 250, y: 150, width: 300, height: 10 },
    { x: 250, y: 440, width: 300, height: 10 },
    { x: 100, y: 250, width: 10, height: 100 },
    { x: 690, y: 250, width: 10, height: 100 }
];

function generateRandomWalls() {
    walls = [];
    const wallCount = 8;
    for (let i = 0; i < wallCount; i++) {
        const width = 60 + Math.random() * 120;
        const height = 20 + Math.random() * 100;
        const x = Math.random() * (canvas.width - width);
        const y = Math.random() * (canvas.height - height);
        walls.push({ x, y, width, height });
    }
}

function getSafeSpawn(size) {
    let tries = 100;
    while (tries-- > 0) {
        const x = size + Math.random() * (canvas.width - 2 * size);
        const y = size + Math.random() * (canvas.height - 2 * size);

        const tankRect = {
        x: x - size / 2,
        y: y - size / 2,
        width: size,
        height: size
        };

        // Check against walls
        const collides = walls.some(w => rectIntersect(tankRect, w));

        if (!collides) return { x, y };
    }

    console.warn("Couldn't find safe spawn, using fallback.");
    return { x: canvas.width / 2, y: canvas.height / 2 };
}

function rectIntersect(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

class Tank {
    constructor(x, y, color, controlScheme) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.speed = 2;
        this.size = 30;
        this.color = color;
        this.bullets = [];
        this.fireCooldown = 0;
        this.controls = controlScheme;
        this.health = 100;
        this.shield = 0;
    }
    drawShadow() {
        const dx = this.x - light.x;
        const dy = this.y - light.y;
        const length = 40;
        const angle = Math.atan2(dy, dx);

        const shadowOffsetX = Math.cos(angle) * length;
        const shadowOffsetY = Math.sin(angle) * length;

        const w = this.size;
        const h = this.size * 0.6;

        ctx.save();
        ctx.translate(this.x + shadowOffsetX, this.y + shadowOffsetY);
        ctx.rotate(this.angle);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(5, 10, w / 2, h / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    draw() {
        const w = this.size;
        const h = this.size * 0.6;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Tank body
        ctx.fillStyle = this.color;
        ctx.fillRect(-w / 2, -h / 2, w, h);

        // Turret
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(0, 0, w / 4, 0, Math.PI * 2);
        ctx.fill();

        // Barrel
        ctx.fillStyle = '#111';
        ctx.fillRect(w / 4, -2, 18, 4);

        // Shield
        if (this.shield > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.8, 0, Math.PI * 2);
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();

        this.drawHealthBar();

        // Draw bullets
        for (let bullet of this.bullets) {
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Helper for shading color
    shadeColor(color, percent) {
        const f = parseInt(color.slice(1), 16);
        const t = percent < 0 ? 0 : 255;
        const p = Math.abs(percent) / 100;
        const R = f >> 16;
        const G = f >> 8 & 0x00FF;
        const B = f & 0x0000FF;
        return "#" + (
            0x1000000 +
            (Math.round((t - R) * p) + R) * 0x10000 +
            (Math.round((t - G) * p) + G) * 0x100 +
            (Math.round((t - B) * p) + B)
        ).toString(16).slice(1);
    }


    drawHealthBar() {
        const barWidth = 40;
        const barHeight = 6;
        const healthPercent = this.health / 100;
        const x = this.x - barWidth / 2;
        const y = this.y - this.size / 2 - 10;

        ctx.fillStyle = 'red';
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = 'lime';
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        ctx.strokeStyle = 'black';
        ctx.strokeRect(x, y, barWidth, barHeight);
    }

    update() {
        this.handleInput();
        this.updateBullets();
        if (this.fireCooldown > 0) this.fireCooldown--;
        if (this.shield > 0) this.shield--;
        this.checkPowerups();
        if (this.shield > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.8, 0, Math.PI * 2);
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    handleInput() {
        let newX = this.x;
        let newY = this.y;

        if (keys[this.controls.forward]) {
        newX += this.speed * Math.cos(this.angle);
        newY += this.speed * Math.sin(this.angle);
        }
        if (keys[this.controls.backward]) {
        newX -= this.speed * Math.cos(this.angle);
        newY -= this.speed * Math.sin(this.angle);
        }

        // Wall collision
        if (!this.collidesWithWall(newX, newY)) {
        this.x = newX;
        this.y = newY;
        }

        if (keys[this.controls.left]) this.angle -= 0.05;
        if (keys[this.controls.right]) this.angle += 0.05;
        if (keys[this.controls.fire] && this.fireCooldown <= 0) {
        this.fireBullet();
        this.fireCooldown = 30;
        }
    }

    collidesWithWall(x, y) {
        const half = this.size / 2;
        const rect = { x: x - half, y: y - half, width: this.size, height: this.size };
        return walls.some(w => rectIntersect(rect, w));
    }

    fireBullet() {
        const speed = 5;
        const bullet = {
            x: this.x + Math.cos(this.angle) * this.size / 2,
            y: this.y + Math.sin(this.angle) * this.size / 2,
            dx: Math.cos(this.angle) * speed,
            dy: Math.sin(this.angle) * speed,
            radius: 5,
            bounceCount: 0
        };
        this.bullets.push(bullet);
    }
    checkPowerups() {
        for (let i = powerups.length - 1; i >= 0; i--) {
            const p = powerups[i];
            const dx = p.x - this.x;
            const dy = p.y - this.y;
            if (Math.sqrt(dx*dx + dy*dy) < 20) {
                if (p.type === 'shield') this.shield = shieldDuration;
                    powerups.splice(i, 1);
            }
        }
    }
    updateBullets() {
        for (let bullet of this.bullets) {
            bullet.x += bullet.dx;
            bullet.y += bullet.dy;

            for (let wall of walls) {
                if (
                    bullet.x + bullet.radius > wall.x &&
                    bullet.x - bullet.radius < wall.x + wall.width &&
                    bullet.y + bullet.radius > wall.y &&
                    bullet.y - bullet.radius < wall.y + wall.height
                ) {
                    // Determine axis of bounce
                    const overlapX = Math.min(
                    bullet.x + bullet.radius - wall.x,
                    wall.x + wall.width - (bullet.x - bullet.radius)
                    );
                    const overlapY = Math.min(
                    bullet.y + bullet.radius - wall.y,
                    wall.y + wall.height - (bullet.y - bullet.radius)
                    );

                    if (overlapX < overlapY) {
                    bullet.dx *= -1; // Horizontal bounce
                    } else {
                    bullet.dy *= -1; // Vertical bounce
                    }

                    bullet.bounceCount++;
                    if (bullet.bounceCount > 4)
                        bullet.hit = true;
                }
            }
        }
        this.bullets = this.bullets.filter(
            b => !b.hit &&
                b.x > 0 && b.x < canvas.width &&
                b.y > 0 && b.y < canvas.height
        );
    }

}

// Control schemes
const controls1 = {
  forward: 'ArrowUp',
  backward: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  fire: ' '
};

const controls2 = {
  forward: 'w',
  backward: 's',
  left: 'a',
  right: 'd',
  fire: 'f'
};

const spawn1 = getSafeSpawn(30);
const spawn2 = getSafeSpawn(30);

const player1 = new Tank(spawn1.x, spawn1.y, '#0077cc', controls1);
const player2 = new Tank(spawn2.x, spawn2.y, '#22aa22', controls2);


function drawWalls() {
  for (let wall of walls) {
    const depth = 6;

    // Main wall top
    ctx.fillStyle = '#888';
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);

    // Right face
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(wall.x + wall.width, wall.y);
    ctx.lineTo(wall.x + wall.width + depth, wall.y + depth);
    ctx.lineTo(wall.x + wall.width + depth, wall.y + wall.height + depth);
    ctx.lineTo(wall.x + wall.width, wall.y + wall.height);
    ctx.closePath();
    ctx.fill();

    // Front face
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(wall.x, wall.y + wall.height);
    ctx.lineTo(wall.x + wall.width, wall.y + wall.height);
    ctx.lineTo(wall.x + wall.width + depth, wall.y + wall.height + depth);
    ctx.lineTo(wall.x + depth, wall.y + wall.height + depth);
    ctx.closePath();
    ctx.fill();
  }
}

function checkBulletHits() {
  for (let bullet of player1.bullets) {
    const dx = bullet.x - player2.x;
    const dy = bullet.y - player2.y;
    if (Math.sqrt(dx * dx + dy * dy) < player2.size / 2) {
      bullet.hit = true;
      createExplosion(bullet.x, bullet.y);
      if (player2.shield <= 0) {
        player2.health -= 20;
        if (player2.health <= 0) {
          alert('Player 1 wins!');
          location.reload();
        }
      }
    }
  }

  for (let bullet of player2.bullets) {
    const dx = bullet.x - player1.x;
    const dy = bullet.y - player1.y;
    if (Math.sqrt(dx * dx + dy * dy) < player1.size / 2) {
      bullet.hit = true;
      createExplosion(bullet.x, bullet.y);
      if (player1.shield <= 0) {
        player1.health -= 20;
        if (player1.health <= 0) {
          alert('Player 2 wins!');
          location.reload();
        }
      }
    }
  }
}

function gameLoop() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!gameStarted) return;
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 50,
        canvas.width / 2, canvas.height / 2, 400
    );
    gradient.addColorStop(0, '#222');
    gradient.addColorStop(1, '#111');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawWalls();

    player1.update();
    player2.update();

    player1.draw();
    player2.draw();

    checkBulletHits();

    requestAnimationFrame(gameLoop);

    updateExplosions();
    drawExplosions();
    drawPowerups();
}

function startGame() {
    generateRandomWalls();
    setInterval(() => {
        const x = 100 + Math.random() * 600;
        const y = 100 + Math.random() * 400;
        powerups.push({ x, y, type: 'shield' });
    }, 10000);
    document.getElementById('menu').style.display = 'none';
    gameStarted = true;
    gameLoop();
}

function drawPowerups() {
  for (let p of powerups) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'cyan';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.stroke();
  }
}
