import * as THREE from 'three';
import RAPIER from '@dimforge/rapier2d-compat';
import {Entity, flat} from '../entity';
import type {Engine} from '../engine';
import {Layer, groups} from '../physics';

export interface BallOptions {
  x: number; y: number; radius: number;
  density?: number;
  color?: THREE.ColorRepresentation;
  layer?: number; // which Layer it belongs to
}

export class Ball extends Entity {
  readonly body: RAPIER.RigidBody;
  readonly radius: number;

  constructor(engine: Engine, o: BallOptions) {
    super(engine);
    this.radius = o.radius;
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(o.radius, 32), flat(o.color ?? 0xd9534f));
    // small marker so you can see it rotate
    const dot = new THREE.Mesh(new THREE.CircleGeometry(o.radius * 0.25, 16), flat(0xffffff));
    dot.position.set(o.radius * 0.6, 0, 0.01);
    this.object.add(mesh, dot);
    this.object.position.z = 0.25;

    this.body = this.addBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(o.x, o.y).setAngularDamping(0.5));
    const layer = o.layer ?? Layer.PROP;
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(o.radius)
        .setDensity(o.density ?? 2)
        .setRestitution(0.2)
        .setCollisionGroups(groups(layer, Layer.ALL & ~(layer === Layer.SNAKE ? Layer.SNAKE : 0))),
      this.body);
  }

  sync() {
    const t = this.body.translation();
    this.object.position.set(t.x, t.y, 0.25);
    this.object.rotation.z = this.body.rotation();
  }
}
