import * as THREE from 'three';
import RAPIER from '@dimforge/rapier2d-compat';
import { Entity, flat } from './entity';
import type { Engine } from './engine';
import { Layer, groups } from './physics';

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
    mesh.position.set(0, 0, 0.05);
    this.dontTick=true;
    this.addMesh(mesh);
    this.graphics.position.set(x, y, 0);
    this.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y));
    this.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2)
        .setCollisionGroups(groups(Layer.GROUND, 0xffff)));
  }
  
  lifeTime = 0;
  fixedUpdate(_dt: number): void {
    this.lifeTime += _dt;
    if(this.engine.inputs.justPressed('f')){
      this.dispose();
    }
  }
  
}
