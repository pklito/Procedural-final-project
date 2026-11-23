import * as THREE from 'three';
import RAPIER from '@dimforge/rapier2d-compat';
import type {Engine} from './engine';

export const flat = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({color});

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

  //Physics loop
  fixedUpdate(_dt: number): void {}

  //Graphics sync up
  sync(): void {}

  //delete
  dispose(): void {
    for (const b of this.ownedBodies) this.world.removeRigidBody(b);
    this.ownedBodies = [];
  }
}
