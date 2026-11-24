import RAPIER from '@dimforge/rapier2d-compat';
import type { Engine, Ticks, UiTicks } from './engine';

/**
 * Mouse-drag system.
 *
 * Click a dynamic body to grab it.  While held, a soft spring force
 * pulls the body toward the cursor.  Release to let go.
 */
export class DragSystem implements Ticks{
  public dontTick: boolean;
  private dragged: RAPIER.RigidBody | null = null;
  private held = false;

  stiffness = 20;
  damping = 5;

  constructor(private engine: Engine) {
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
  public tryGrab(body: RAPIER.RigidBody){
    if(this.held && !(this.dragged && this.dragged.isValid())){
      this.dragged = body;
    }
  }
  /** Find the first dynamic body under the cursor and store it. */
  private grab() {
    const { x, y } = this.engine.inputs.mouseWorld();

    this.engine.physics.world.intersectionsWithPoint(
      { x, y },
      (collider) => {
        const body = collider.parent();
        if (body && body.bodyType() === RAPIER.RigidBodyType.Dynamic) {
          this.dragged = body;
          return false; // stop enumeration
        }
        return true; // keep searching
      },
    );
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

    const { x: mx, y: my } = this.engine.inputs.mouseWorld();
    const pos = this.dragged.translation();
    const vel = this.dragged.linvel();

    const fx = this.stiffness * (mx - pos.x) - this.damping * vel.x;
    const fy = this.stiffness * (my - pos.y) - this.damping * vel.y;

    this.dragged.applyImpulse({ x: fx * dt, y: fy * dt }, true);
    if(this.engine.inputs.down('q')){
      this.dragged.applyTorqueImpulse(0.25 * dt, true);
    }
    if(this.engine.inputs.down('e')){
      this.dragged.applyTorqueImpulse(-0.25 * dt, true);
    }
  }

  fixedUpdate(dt: number): void {
    this.applyForces(dt);
  }
}
