import RAPIER from '@dimforge/rapier2d-compat';
import { CreatureJoint } from './creature';

export const FIXED_DT = 1 / 60;

export type Vec2 = { x: number; y: number };

export const Layer = {
  GROUND: 0x0001,
  PROP: 0x0002,
  // Bits 0x0004 … 0x8000 are dynamically allocated for creature groups
} as const;

/** Pack a 16-bit membership mask and a 16-bit filter mask into one u32. */
export const groups = (membership: number, filter: number) =>
  (((membership & 0xffff) << 16) | (filter & 0xffff)) >>> 0;


function invInertia(body: RAPIER.RigidBody): number {
  if (!body.isDynamic()) return 0;
  const I = body.effectiveAngularInertia();
  return I > 1e-9 ? 1 / I : 0;
}


export class Physics {
  readonly world: RAPIER.World;

  private availableCreatureBits = 0xfffc; // Bits 2–15 available

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.8 });
    this.world.timestep = FIXED_DT;
  }

  static async create() {
    await RAPIER.init();
    return new Physics();
  }

  step() {
    this.world.step();
  }

  /** Allocate a unique collision-group bit for a new creature (up to 14 creatures). */

  allocateCreatureGroup(): number {
    if (this.availableCreatureBits === 0)
      throw new Error('No more creature collision-group bits available');

    const bit = this.availableCreatureBits & -this.availableCreatureBits; //gets lowest bit (according to)
    this.availableCreatureBits &= ~bit;
    return bit;
  }

  deallocateCreatureGroup(group: number): void {
    if (group === 0 || (group & (group - 1)) !== 0 || (group & 0xfffc) !== group) {
      throw new Error(`Invalid creature collision group: ${group}`);
    }
    if (this.availableCreatureBits & group)
      throw new Error(`Creature collision group already freed: ${group}`);

    this.availableCreatureBits |= group;
  }

  // getters

  castRay(origin: Vec2, dir: Vec2, maxDist: number, filterGroups?: number): number | null {
    const hit = this.world.castRay(
      new RAPIER.Ray(origin, dir),
      maxDist,
      true,
      undefined,
      filterGroups,
    );
    return hit ? hit.timeOfImpact : null;
  }

  // joint builders

  revolute(a: RAPIER.RigidBody, b: RAPIER.RigidBody, anchorA: Vec2, anchorB: Vec2) {
    return this.world.createImpulseJoint(RAPIER.JointData.revolute(anchorA, anchorB), a, b, true);
  }

  spring(
    a: RAPIER.RigidBody,
    b: RAPIER.RigidBody,
    rest: number,
    stiffness: number,
    damping: number,
    anchorA: Vec2 = { x: 0, y: 0 },
    anchorB: Vec2 = { x: 0, y: 0 },
  ) {
    return this.world.createImpulseJoint(
      RAPIER.JointData.spring(rest, stiffness, damping, anchorA, anchorB),
      a,
      b,
      true,
    );
  }

  removeJoint(joint: RAPIER.ImpulseJoint) {
    this.world.removeImpulseJoint(joint, true);
  }

  iterations = 8;

  private iEff: number[] = [];
  private wTarget: number[] = [];
  private accJ: number[] = [];

  solveJoints(dt: number, joints : CreatureJoint[], maxTorque: number = 500.0, maxRelAngVel = 300.0){
    let i = 0;
    // Target angular velocities
    for (const { segA, segB, targetAngle, stiffness, damping } of joints) {
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
      this.wTarget[i] = Math.max(-maxRelAngVel, Math.min(maxRelAngVel, targetAngVel));
      i++;
    }
    //Find the best impulses to match the computed angvels
    for (let it = 0; it < this.iterations; it++) {
      for (let i = 0; i < joints.length; i++) {
      if (this.iEff[i] === 0) continue;

      const { segA, segB } = joints[i];
      const a = segA.rigidBody;
      const b = segB.rigidBody;

      const jointInnertia = this.iEff[i];
      const w = b.angvel() - a.angvel();

      let J = jointInnertia * (this.wTarget[i] - w);

      //Impulse
      const oldJ = this.accJ[i];
      const maxJ = maxTorque * dt;
      this.accJ[i] = Math.max(-maxJ, Math.min(maxJ, oldJ + J));
      J = this.accJ[i] - oldJ;

      if (!Number.isFinite(J)) continue;

      b.applyTorqueImpulse(J, true);
      a.applyTorqueImpulse(-J, true);
      }
    }
  }
}

export function worldToLocal(body: RAPIER.RigidBody, p: Vec2): Vec2 {
  const t = body.translation();
  const angle = body.rotation(); // radians in rapier 2D
  const dx = p.x - t.x;
  const dy = p.y - t.y;
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}
export function localToWorld(body: RAPIER.RigidBody, p: Vec2): Vec2 {
  const t = body.translation();
  const angle = body.rotation(); // radians in rapier 2D
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: (c*p.x - s*p.y) + t.x, y: (s*p.x + c*p.y) + t.y };
}
