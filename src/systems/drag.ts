import RAPIER from '@dimforge/rapier2d-compat';
import type { Engine, Ticks, UiTicks } from '../engine';
import { Vector3 } from 'three';
import { Vec2 } from '../physics';
import { Entity } from '../entity';

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
    const mass = this.dragged.mass();

    const fx = this.stiffness * (mx - pos.x) - this.damping * vel.x;
    const fy = this.stiffness * (my - pos.y) - this.damping * vel.y;

    this.dragged.applyImpulse({ x: fx * mass * dt, y: fy * mass * dt }, true);
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
