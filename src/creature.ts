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

//should be in physics but im lazy
function invInertia(body: RAPIER.RigidBody): number {
  if (!body.isDynamic()) return 0;
  const I = body.effectiveAngularInertia();
  return I > 1e-9 ? 1 / I : 0;
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

  straightenStiffness = 2000.0;
  straightenDamping = 25.0;

  // joint limits
  maxJointTorque = 5000.0;
  maxRelAngVel = 300.0;
  bodyAngularDamping = 0.5;

  constructor(private engine: Engine) {
    this.collisionBit = engine.physics.allocateCreatureGroup();
  }

  addSegment(seg: Segment): Segment {
    this.segments.add(seg);
    seg.creature = this;
    seg.setCollisionGroup(this.collisionBit, 0xffff & ~this.collisionBit);
    seg.rigidBody.setAngularDamping(this.bodyAngularDamping);
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
    if (this.dontTick || dt <= 0) return;

    for (const { segA, segB, targetAngle } of this.joints) {
      const a = segA.rigidBody;
      const b = segB.rigidBody;

      const inertiaInvSums = invInertia(a) + invInertia(b);
      if (inertiaInvSums === 0) continue;
      const jointInnertia = 1 / inertiaInvSums;

      const error = targetAngle - (b.rotation() - a.rotation());
      const closestError = Math.atan2(Math.sin(error), Math.cos(error));

      //clamp 
      let jointAngvel = b.angvel() - a.angvel();
      const clampedAngvel = Math.max(-this.maxRelAngVel, Math.min(this.maxRelAngVel, jointAngvel));
      const excess = jointAngvel - clampedAngvel;
      jointAngvel = clampedAngvel;

      
      const s = this.straightenStiffness;
      const c = this.straightenDamping;
      const w = jointAngvel;
      const e = closestError;
      //better solution than the previous J = (s*closestError - w*c)*dt;
      let J = (jointInnertia * dt * (s * e - (c + dt * s) * w)) / (1 + dt * c + dt * dt * s);

      // Remove the part of velocity above the cap too
      J -= jointInnertia * excess;

      //torque clamp
      const maxJ = this.maxJointTorque * dt;
      J = Math.max(-maxJ, Math.min(maxJ, J));

      if (!Number.isFinite(J)) continue;

      b.applyTorqueImpulse(J, true);
      a.applyTorqueImpulse(-J, true);
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
