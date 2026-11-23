import * as THREE from 'three';
import RAPIER from '@dimforge/rapier2d-compat';
import { Entity, flat } from './entity';
import type { Engine } from './engine';
import type { Creature } from './creature';
import { groups, Layer } from './physics';

// ── shape descriptors ───────────────────────────────────────────

export type SegmentShape =
  | { type: 'circle'; radius: number }
  | { type: 'rect'; width: number; height: number }
  | { type: 'polygon'; vertices: [number, number][] };

export interface SegmentOptions {
  x: number;
  y: number;
  shape: SegmentShape;
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
  readonly rb: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly shape: SegmentShape;
  creature: Creature | null = null;

  constructor(engine: Engine, o: SegmentOptions) {
    super(engine);
    this.shape = o.shape;
    const color = o.color ?? 0x6699cc;

    const mesh = Segment.buildMesh(o.shape, color);
    mesh.position.z = 0.2;
    this.object.add(mesh);

    this.rb = this.addBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(o.x, o.y)
        .setAngularDamping(o.angularDamping ?? 1.0),
    );

    const cd = Segment.buildCollider(o.shape);
    cd.setDensity(o.density ?? 1);
    cd.setRestitution(o.restitution ?? 0.2);
    cd.setFriction(o.friction ?? 0.5);
    // Default: PROP layer, collides with everything
    cd.setCollisionGroups(groups(Layer.PROP, 0xffff));

    this.collider = this.world.createCollider(cd, this.rb);
  }

  // ── collision group management ──────────────────────────────

  /** Reassign this segment's collision membership and filter mask. */
  setCollisionGroup(memberBit: number, filterMask: number) {
    this.collider.setCollisionGroups(groups(memberBit, filterMask));
  }

  // ── sync ────────────────────────────────────────────────────

  sync() {
    const t = this.rb.translation();
    this.object.position.set(t.x, t.y, this.object.position.z);
    this.object.rotation.z = this.rb.rotation();
  }

  // ── private helpers ─────────────────────────────────────────

  private static buildMesh(
    shape: SegmentShape,
    color: THREE.ColorRepresentation,
  ): THREE.Mesh {
    switch (shape.type) {
      case 'circle':
        return new THREE.Mesh(
          new THREE.CircleGeometry(shape.radius, 32), flat(color));
      case 'rect':
        return new THREE.Mesh(
          new THREE.PlaneGeometry(shape.width, shape.height), flat(color));
      case 'polygon': {
        const s = new THREE.Shape(
          shape.vertices.map(([x, y]) => new THREE.Vector2(x, y)));
        return new THREE.Mesh(new THREE.ShapeGeometry(s), flat(color));
      }
    }
  }

  private static buildCollider(shape: SegmentShape): RAPIER.ColliderDesc {
    switch (shape.type) {
      case 'circle':
        return RAPIER.ColliderDesc.ball(shape.radius);
      case 'rect':
        return RAPIER.ColliderDesc.cuboid(shape.width / 2, shape.height / 2);
      case 'polygon': {
        const pts = new Float32Array(shape.vertices.flat());
        const desc = RAPIER.ColliderDesc.convexHull(pts);
        if (!desc) throw new Error('Failed to build convex hull from vertices');
        return desc;
      }
    }
  }
}
