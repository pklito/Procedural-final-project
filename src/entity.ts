import * as THREE from 'three';
import RAPIER from '@dimforge/rapier2d-compat';
import type { Engine } from './engine';

/** Shorthand for a flat-coloured MeshBasicMaterial. */
export const flat = (color: THREE.ColorRepresentation) =>
  new THREE.MeshBasicMaterial({ color });

/**
 * Base class for anything that lives in the Engine loop.
 * Owns zero-or-more Rapier rigid bodies and auto-removes them on dispose.
 */
export abstract class Entity {
  readonly object = new THREE.Group();
  private ownedBodies: RAPIER.RigidBody[] = [];

  constructor(protected readonly engine: Engine) {}

  protected get world() { return this.engine.physics.world; }

  protected addBody(desc: RAPIER.RigidBodyDesc): RAPIER.RigidBody {
    const body = this.world.createRigidBody(desc);
    this.ownedBodies.push(body);
    return body;
  }

  /** Called each physics tick (fixed timestep). */
  fixedUpdate(_dt: number): void {}

  /** Called each render frame — sync Three.js transforms from physics. */
  sync(): void {}

  /** Remove all owned rigid bodies from the world. */
  dispose(): void {
    for (const b of this.ownedBodies) this.world.removeRigidBody(b);
    this.ownedBodies = [];
  }
}
