import RAPIER from '@dimforge/rapier2d-compat';
import type { Engine, Ticks } from './engine';
import type { Segment } from './segment';
import type { Vec2 } from './physics';
import { Layer, groups } from './physics';
import { Skeleton } from './skeleton';

export interface CreatureJoint {
  joint: RAPIER.ImpulseJoint;
  segA: Segment;
  segB: Segment;
  anchorA: Vec2;
  anchorB: Vec2;
  targetAngle: number;
  stiffness: number;
  damping: number;
}

//should be in physics but im lazy

/**
 * Creature class, holds segments and joints.
 * addSegment(Segment):Segment - modifies a segment to be part of this creature(collision)
 * removeSegment(Segment) - re-enables collisions and disconnects all joints.
 * connect(Segment, Segment, Pos1, Pos2, angle) - connect two segments in creature
 * update(dt) - called on loop, applies the torques rn
 * dispose() - destroy
 */
export class Creature implements Ticks {
  public dontTick: boolean = false;
  readonly segments = new Set<Segment>();
  readonly segmentJoints = new Map<Segment, CreatureJoint[]>();
  readonly joints: CreatureJoint[] = [];
  readonly collisionBit: number;
  readonly skeleton : Skeleton;

  straightenStiffness = 200.0;
  straightenDamping = 1.5;

  // joint limits
  maxJointTorque = 500.0;
  maxRelAngVel = 300.0;
  bodyAngularDamping = 10.0;

  constructor(protected engine: Engine) {
    this.collisionBit = engine.physics.allocateCreatureGroup();
    this.skeleton = new Skeleton(this);
  }

  addSegment(seg: Segment): Segment {
    this.segments.add(seg);
    seg.creature = this;
    seg.setCollisionGroup(this.collisionBit, 0xffff & ~this.collisionBit);
    seg.rigidBody.setAngularDamping(this.bodyAngularDamping);
    this.segmentJoints.set(seg, []);
    return seg;
  }

  removeSegment(seg: Segment) {
    this.segments.delete(seg);
    seg.creature = null;

    seg.setCollisionGroup(Layer.PROP, 0xffff);

    for (let i = this.joints.length - 1; i >= 0; i--) {
      const j = this.joints[i];
      if (j.segA === seg || j.segB === seg) {
        this.engine.physics.removeJoint(j.joint);
        this.joints.splice(i, 1);
      }
    }
    this.segmentJoints.delete(seg);
  }
  teleport(target: Vec2) {
    const first = this.segments.values().next().value as Segment | undefined;
    if (!first) return;

    const ref = first.rigidBody.translation();
    const dx = target.x - ref.x;
    const dy = target.y - ref.y;

    for (const seg of this.segments) {
      const rb = seg.rigidBody;
      const p = rb.translation();
      rb.setTranslation({ x: p.x + dx, y: p.y + dy }, true);
      rb.setLinvel({ x: 0, y: 0 }, true);
      rb.setAngvel(0, true);
      rb.resetForces(true);
      rb.resetTorques(true);
    }
  }

  connect(a: Segment, b: Segment, anchorA: Vec2, anchorB: Vec2, targetAngle = 0): CreatureJoint {
    const joint = this.engine.physics.revolute(a.rigidBody, b.rigidBody, anchorA, anchorB);
    const cj: CreatureJoint = { joint, segA: a, segB: b, targetAngle, anchorA: anchorA, anchorB: anchorB, stiffness : this.straightenStiffness, damping: this.straightenDamping };
    this.joints.push(cj);
    this.segmentJoints.get(a).push(cj);
    this.segmentJoints.get(b).push(cj);
    return cj;
  }
  
  fixedUpdate(dt: number) {
    if (this.dontTick || dt <= 0) return;
    this.engine.physics.solveJoints(dt, this.joints, this.maxJointTorque, this.maxRelAngVel);
  }

  dispose() {
    // Joints
    for (const j of this.joints) this.engine.physics.removeJoint(j.joint);
    this.joints.length = 0;

    //Segments
    for (const seg of this.segments) {
      seg.creature = null;
      this.engine.remove(seg);
    }
    this.segments.clear();
    this.engine.physics.deallocateCreatureGroup(this.collisionBit);
  }
}

