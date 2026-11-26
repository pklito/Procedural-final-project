import * as THREE from 'three';
import RAPIER from '@dimforge/rapier2d-compat';
import { Entity, flat, ColliderShape } from './entity';
import type { Engine } from './engine';
import type { Creature } from './creature';
import { groups, Layer } from './physics';

// ── shape descriptors ───────────────────────────────────────────

export interface SegmentOptions {
  x: number;
  y: number;
  shape: ColliderShape;
  color?: THREE.ColorRepresentation;
  density?: number;
  restitution?: number;
  friction?: number;
  angularDamping?: number;
}

/**
 * body
 */
export class Segment extends Entity {
  readonly shape: ColliderShape;
  creature: Creature | null = null;

  constructor(engine: Engine, o: SegmentOptions) {
    super(engine);
    this.shape = o.shape;
    const color = o.color ?? 0x6699cc;

    const mesh = Segment.buildMesh(o.shape, color);
    mesh.position.z = 0.2;
    this.addMesh(mesh);

    this.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(o.x, o.y)
        .setAngularDamping(o.angularDamping ?? 1.0),
    );

    const cd = Entity.buildCollider(o.shape);
    cd.setDensity(o.density ?? 1);
    cd.setRestitution(o.restitution ?? 0.2);
    cd.setFriction(o.friction ?? 1.0);
    // Default: PROP layer, collides with everything
    cd.setCollisionGroups(groups(Layer.PROP, 0xffff));

    this.createCollider(cd);
  }
}
