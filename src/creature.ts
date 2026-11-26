import RAPIER from '@dimforge/rapier2d-compat';
import type { Engine, Ticks } from './engine';
import type { Segment } from './segment';
import type { Vec2 } from './physics';
import { Layer, groups } from './physics';

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
  readonly segmentJoints = new Map<Creature, CreatureJoint[]>();
  readonly joints: CreatureJoint[] = [];
  readonly collisionBit: number;

  straightenStiffness = 2000.0;
  straightenDamping = 0;

  // joint limits
  maxJointTorque = 500.0;
  maxRelAngVel = 300.0;
  bodyAngularDamping = 10.0;

  constructor(protected engine: Engine) {
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
    return cj;
  }
  iterations = 8;

  private iEff: number[] = [];
  private wTarget: number[] = [];
  private accJ: number[] = [];

  fixedUpdate(dt: number) {
    if (this.dontTick || dt <= 0) return;

    let i = 0;
    // Target angular velocities
    for (const { segA, segB, targetAngle, stiffness, damping } of this.joints) {
      const a = segA.rigidBody;
      const b = segB.rigidBody;

      const inertiaInvSums = invInertia(a) + invInertia(b);
      this.iEff[i] = inertiaInvSums > 0 ? 1 / inertiaInvSums : 0;
      this.accJ[i] = 0;

      const error = targetAngle - (b.rotation() - a.rotation());
      const closestError = Math.atan2(Math.sin(error), Math.cos(error));

      let jointAngvel = b.angvel() - a.angvel();
      
      const s = stiffness;
      const c = damping;
      const w = jointAngvel;
      const e = closestError;

      const targetAngVel = (w + dt * s * e) / (1 + dt * c + dt * dt * s);
      this.wTarget[i] = Math.max(-this.maxRelAngVel, Math.min(this.maxRelAngVel, targetAngVel));
      i++;
    }
    //Find the best impulses to match the computed angvels
    for (let it = 0; it < this.iterations; it++) {
      for (let i = 0; i < this.joints.length; i++) {
      if (this.iEff[i] === 0) continue;

      const { segA, segB } = this.joints[i];
      const a = segA.rigidBody;
      const b = segB.rigidBody;

      const jointInnertia = this.iEff[i];
      const w = b.angvel() - a.angvel();

      let J = jointInnertia * (this.wTarget[i] - w);

      //Impulse
      const oldJ = this.accJ[i];
      const maxJ = this.maxJointTorque * dt;
      this.accJ[i] = Math.max(-maxJ, Math.min(maxJ, oldJ + J));
      J = this.accJ[i] - oldJ;

      if (!Number.isFinite(J)) continue;

      b.applyTorqueImpulse(J, true);
      a.applyTorqueImpulse(-J, true);
      }
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
    this.engine.physics.deallocateCreatureGroup(this.collisionBit);
  }
}

class Tentacle extends Creature {
  constructor(engine: Engine) {
    super(engine);
  }
}
