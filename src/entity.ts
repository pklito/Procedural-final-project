import * as THREE from 'three';
import RAPIER, { RigidBodyDesc } from '@dimforge/rapier2d-compat';
import type { Engine, Ticks } from './engine';
import { groups, Layer } from './physics';

export type ColliderShape =
  | { type: 'circle'; radius: number }
  | { type: 'rect'; width: number; height: number }
  | { type: 'polygon'; vertices: [number, number][] };


export const flat = (color: THREE.ColorRepresentation) =>
  new THREE.MeshBasicMaterial({ color });

/**
 * object is a group of meshes to render.
 * ownedBodies is th elist of rigidbodies associated.
 * AddBody
 */
export abstract class Entity implements Ticks {
  readonly graphics = new THREE.Group();
  protected rb : RAPIER.RigidBody;
  protected collider: RAPIER.Collider;
  public dontTick: boolean = false;

  constructor(protected readonly engine: Engine) {}

  protected get world() { return this.engine.physics.world; }
  get rigidBody() {return this.rb;}
  protected createRigidBody(desc: RAPIER.RigidBodyDesc) {
    const body = this.world.createRigidBody(desc);
    this.rb = body;
  }

  protected createCollider(desc: RAPIER.ColliderDesc, rbdesc : RAPIER.RigidBodyDesc | null = null){
    if(rbdesc){
      this.createRigidBody(rbdesc);
    }
    if(!this.rb){
      throw new Error("RigidBody not initialized yet!");
    }
    this.collider = this.world.createCollider(desc, this.rb);
  }

  setCollisionGroup(memberBit: number, filterMask: number) {
    this.collider.setCollisionGroups(groups(memberBit, filterMask));
  }

  /** Add a THREE.Object3D to the current graphics of this object. */
  protected addMesh(mesh: THREE.Object3D){
    this.graphics.add(mesh);
  }

  fixedUpdate(_dt: number): void {}

  /** syncs 3js visuals to physics */
  sync() {
    if(this.dontTick){
      return;
    }
    const t = this.rb.translation();
    this.graphics.position.set(t.x, t.y, this.graphics.position.z);
    this.graphics.rotation.z = this.rb.rotation();
  }

  /** destroy all rigidbodies */
  dispose(): void {
    this.dontTick = true;
    this.graphics!.clear();
    if(this.rb){
      this.world.removeRigidBody(this.rb);
      this.rb = null;
    }
  }

  

  protected static buildMesh(
    shape: ColliderShape,
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

  protected static buildCollider(shape: ColliderShape): RAPIER.ColliderDesc {
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
