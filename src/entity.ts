import * as THREE from 'three';
import RAPIER, { RigidBodyDesc } from '@dimforge/rapier2d-compat';
import type { Engine, Ticks } from './engine';

export const flat = (color: THREE.ColorRepresentation) =>
  new THREE.MeshBasicMaterial({ color });

/**
 * object is a group of meshes to render.
 * ownedBodies is th elist of rigidbodies associated.
 * AddBody
 */
export abstract class Entity implements Ticks {
  readonly object = new THREE.Group();
  private ownedBodies: RAPIER.RigidBody[] = [];

  constructor(protected readonly engine: Engine) {}

  protected get world() { return this.engine.physics.world; }

  protected addBody(desc: RAPIER.RigidBodyDesc): RAPIER.RigidBody {
    const body = this.world.createRigidBody(desc);
    this.ownedBodies.push(body);
    return body;
  }

  protected addMesh(mesh: THREE.Object3D){
    this.object.add(mesh);
  }

  fixedUpdate(_dt: number): void {}

  /** syncs 3js visuals to physics */
  sync(): void {}

  /** destroy all rigidbodies */
  dispose(): void {
    this.object.clear();
    for (const b of this.ownedBodies) this.world.removeRigidBody(b);
    this.ownedBodies = [];
  }
}
