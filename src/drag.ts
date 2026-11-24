import RAPIER from '@dimforge/rapier2d-compat';
import type { Engine, Ticks, UiTicks } from './engine';
import { Vector3 } from 'three';
import { Vec2 } from './physics';
import { Entity } from './entity';

/**
 * Mouse-drag system.
 *
 * Click a dynamic body to grab it.  While held, a soft spring force
 * pulls the body toward the cursor.  Release to let go.
 */
export class DragSystem implements Ticks {
  public dontTick: boolean;
  private dragged: RAPIER.RigidBody | null = null;
  private held = false;
  private dragPosition: Vector3 = new Vector3();

  stiffness = 100;
  damping = 15;
  torque = 0.5;

  constructor(private engine: Engine) {
    engine.miscTicks.add(this);
    const canvas = engine.canvas;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.held = true;
      this.grab();
    });

    canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      this.held = false;
      this.dragged = null;
    });
  }

  get draggedRigidBody(): RAPIER.RigidBody | null {
    return this.dragged;
  }

  public tryGrab(body: RAPIER.RigidBody) {
    if (this.held && !(this.dragged && this.dragged.isValid())) {
      this.dragged = body;
    }
  }
  /** Find the first dynamic body under the cursor and store it. */
  private grab() {
    const { x, y } = this.engine.inputs.mouseWorld();

    this.engine.physics.world.intersectionsWithPoint({ x, y }, (collider) => {
      const body = collider.parent();
      if (body && body.bodyType() === RAPIER.RigidBodyType.Dynamic) {
        this.dragged = body;
        return false; // stop enumeration
      }
      return true; // keep searching
    });
  }

  /** Called each fixed-step to apply the spring force. */
  applyForces(dt: number) {
    if (!this.dragged || !this.held) {
      this.dragged = null;
      return;
    }

    // Guard against bodies that were removed mid-drag
    if (!this.dragged.isValid()) {
      this.dragged = null;
      return;
    }

    if (!this.engine.snap.isSnapping()) {
      this.dragPosition.x = this.engine.inputs.mouseWorld().x;
      this.dragPosition.y = this.engine.inputs.mouseWorld().y;
      this.dragPosition.z = this.engine.inputs.mouseWorld().z;
    }

    const { x: mx, y: my } = this.dragPosition;
    const pos = this.dragged.translation();
    const vel = this.dragged.linvel();

    const fx = this.stiffness * (mx - pos.x) - this.damping * vel.x;
    const fy = this.stiffness * (my - pos.y) - this.damping * vel.y;

    this.dragged.applyImpulse({ x: fx * dt, y: fy * dt }, true);
    if (this.engine.inputs.down('q')) {
      this.dragged.applyTorqueImpulse(this.torque * dt, true);
    }
    if (this.engine.inputs.down('e')) {
      this.dragged.applyTorqueImpulse(-this.torque * dt, true);
    }
  }

  fixedUpdate(dt: number): void {
    this.applyForces(dt);
  }
}

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
