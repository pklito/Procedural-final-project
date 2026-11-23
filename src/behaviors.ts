import type RAPIER from '@dimforge/rapier2d-compat';
import type {Physics} from './physics';
import {Layer, groups} from './physics';

export interface HoverOptions {
  height: number;     // desired distance from body centre to ground
  stiffness: number;  // spring strength
  damping: number;    // velocity damping along the ray
  reach?: number;     // ray length; no force beyond this (default height * 2)
}

/** Raycast straight down and apply a spring force so the body floats above the ground. */
export class Hover {
  // Ray "belongs" to SNAKE and only sees GROUND, so it ignores the snake's own colliders.
  private static readonly RAY_GROUPS = groups(Layer.SNAKE, Layer.GROUND);
  grounded = false;

  constructor(private physics: Physics, private body: RAPIER.RigidBody, public opts: HoverOptions) {}

  apply(dt: number) {
    const {height, stiffness, damping, reach = height * 2} = this.opts;
    const dist = this.physics.castRay(this.body.translation(), {x: 0, y: -1}, reach, Hover.RAY_GROUPS);
    this.grounded = dist !== null;
    if (dist === null) return;
    const force = stiffness * (height - dist) - damping * this.body.linvel().y;
    this.body.applyImpulse({x: 0, y: force * dt}, true);
  }
}
