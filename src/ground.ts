import * as THREE from 'three';
import RAPIER from '@dimforge/rapier2d-compat';
import { Entity, flat } from './entity';
import type { Engine } from './engine';
import { Layer, groups } from './physics';

/** A static rectangular collider with a flat-colour visual. */
export class Ground extends Entity {
  constructor(
    engine: Engine,
    x: number, y: number,
    width: number, height: number,
    color: THREE.ColorRepresentation = 0x555b66,
  ) {
    super(engine);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height), flat(color));
    mesh.position.set(x, y, 0.05);
    this.object.add(mesh);

    const body = this.addBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y));
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, height / 2)
        .setCollisionGroups(groups(Layer.GROUND, 0xffff)),
      body,
    );
  }
}
