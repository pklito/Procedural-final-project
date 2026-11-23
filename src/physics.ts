import RAPIER from '@dimforge/rapier2d-compat';

export const FIXED_DT = 1 / 60;

export type Vec2 = { x: number; y: number };

export const Layer = {
  GROUND: 0x0001,
  PROP:   0x0002,
  // Bits 0x0004 … 0x8000 are dynamically allocated for creature groups
} as const;

/** Pack a 16-bit membership mask and a 16-bit filter mask into one u32. */
export const groups = (membership: number, filter: number) =>
  (((membership & 0xffff) << 16) | (filter & 0xffff)) >>> 0;

export class Physics {
  readonly world: RAPIER.World;
  private nextCreatureBit = 2; // bit-index (0x0004 = 1 << 2)

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
    if (this.nextCreatureBit > 15)
      throw new Error('No more creature collision-group bits available (max 14)');
    return 1 << this.nextCreatureBit++;
  }

  // getters

  castRay(origin: Vec2, dir: Vec2, maxDist: number, filterGroups?: number): number | null {
    const hit = this.world.castRay(
      new RAPIER.Ray(origin, dir), maxDist, true, undefined, filterGroups);
    return hit ? hit.timeOfImpact : null;
  }

  // joint builders

  revolute(a: RAPIER.RigidBody, b: RAPIER.RigidBody, anchorA: Vec2, anchorB: Vec2) {
    return this.world.createImpulseJoint(
      RAPIER.JointData.revolute(anchorA, anchorB), a, b, true);
  }

  spring(
    a: RAPIER.RigidBody, b: RAPIER.RigidBody,
    rest: number, stiffness: number, damping: number,
    anchorA: Vec2 = { x: 0, y: 0 }, anchorB: Vec2 = { x: 0, y: 0 },
  ) {
    return this.world.createImpulseJoint(
      RAPIER.JointData.spring(rest, stiffness, damping, anchorA, anchorB), a, b, true);
  }

  removeJoint(joint: RAPIER.ImpulseJoint) {
    this.world.removeImpulseJoint(joint, true);
  }
}
