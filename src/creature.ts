import RAPIER from '@dimforge/rapier2d-compat';
import type { Engine, Ticks } from './engine';
import type { Segment } from './segment';
import type { Vec2 } from './physics';
import { Layer, groups } from './physics';

export interface CreatureJoint {
  joint: RAPIER.ImpulseJoint;
  segA: Segment;
  segB: Segment;
  targetAngle: number;
}

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
  readonly joints: CreatureJoint[] = [];
  readonly collisionBit: number;

  straightenStiffness = 3.0;
  straightenDamping = 0.5;

  constructor(private engine: Engine) {
    this.collisionBit = engine.physics.allocateCreatureGroup();
  }

  addSegment(seg: Segment): Segment {
    this.segments.add(seg);
    seg.creature = this;
    seg.setCollisionGroup(this.collisionBit, 0xffff & ~this.collisionBit);
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
  }
  connect(a: Segment, b: Segment, anchorA: Vec2, anchorB: Vec2, targetAngle = 0): CreatureJoint {
    const joint = this.engine.physics.revolute(a.rigidBody, b.rigidBody, anchorA, anchorB);
    const cj: CreatureJoint = { joint, segA: a, segB: b, targetAngle };
    this.joints.push(cj);
    return cj;
  }

  fixedUpdate(dt: number) {
    if (this.dontTick) return;
    for (const { segA, segB, targetAngle } of this.joints) {
      const relAngle = segB.rigidBody.rotation() - segA.rigidBody.rotation();
      const error = targetAngle - relAngle;

      const normErr = Math.atan2(Math.sin(error), Math.cos(error));
      const relVel = segB.rigidBody.angvel() - segA.rigidBody.angvel();

      const torque = (this.straightenStiffness * normErr - this.straightenDamping * relVel) * dt;

      segA.rigidBody.applyTorqueImpulse(-torque, true);
      segB.rigidBody.applyTorqueImpulse(torque, true);
    }
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
  }
}
