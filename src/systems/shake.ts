import RAPIER from '@dimforge/rapier2d-compat';
import type { Engine, Ticks } from '../engine';
import { Vec2 } from '../physics';
import { Entity } from '../entity';

export class ShakeSystem implements Ticks {
  private time = 0;
  private refDir: Vec2 | null = null;
  private peakSpeed = 0;
  private reversals: { t: number; peak: number }[] = [];
  private lastShakeLog = -Infinity;
  dontTick: boolean;

  shakeMinSpeed = 3;
  shakeWindow = 0.6;
  shakeMinReversals = 4;
  shakeCooldown = 1;

  constructor(protected engine: Engine) {
    engine.miscTicks.add(this);
  }

  get shakeIntensity(): number {
    let sum = 0;
    for (const r of this.reversals) sum += r.peak;
    return sum / this.shakeWindow;
  }

  get dragged(): RAPIER.RigidBody | null {
    return this.engine.drag.draggedRigidBody;
  }

  private resetShake() {
    this.refDir = null;
    this.peakSpeed = 0;
    this.reversals.length = 0;
  }

  private trackShake(dt: number) {
    this.time += dt;

    if (!this.dragged || !this.dragged.isValid()) {
      this.resetShake();
      return;
    }

    const v = this.dragged.linvel();
    const speed = Math.hypot(v.x, v.y);

    if (speed >= this.shakeMinSpeed) {
      const u = { x: v.x / speed, y: v.y / speed };
      if (this.refDir) {
        const dot = u.x * this.refDir.x + u.y * this.refDir.y;
        if (dot < -0.3) {
          this.reversals.push({ t: this.time, peak: this.peakSpeed });
          this.peakSpeed = 0;
        }
      }
      this.refDir = u;
    }
    this.peakSpeed = Math.max(this.peakSpeed, speed);

    while (this.reversals.length && this.time - this.reversals[0].t > this.shakeWindow) {
      this.reversals.shift();
    }

    if (
      this.reversals.length >= this.shakeMinReversals &&
      this.time - this.lastShakeLog > this.shakeCooldown
    ) {
      this.lastShakeLog = this.time;
      const entity = Entity.from(this.dragged);
      console.log(
        'SHAKE',
        entity,
        'reversals:',
        this.reversals.length,
        'intensity:',
        this.shakeIntensity.toFixed(1),
      );
    }
  }

  fixedUpdate(dt: number): void {
    this.trackShake(dt);
  }
}
