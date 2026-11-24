import RAPIER, { RigidBody } from '@dimforge/rapier2d-compat';
import type { Engine, Ticks, UiTicks } from './engine';
import { Vector3 } from 'three';
import { Vec2 } from './physics';

type ConnectionResult = { a: Vec2; b: Vec2, collA : RAPIER.Collider, collB : RAPIER.Collider }

export class SnapSystem implements UiTicks{
    dontTick: boolean = false;
private static readonly MAX_LINK_DIST = 1000;
private line : LinkLine;
private connection : ConnectionResult;
constructor(protected engine: Engine){

    this.line = new LinkLine(engine);
    this.engine.miscTicksUi.add(this);
}

private connect(){

}
private queryMouse(ignore : RAPIER.Collider | null): RAPIER.Collider | null {
  const { x, y } = this.engine.inputs.mouseWorld();
  let found = null as RAPIER.Collider | null;
  this.engine.physics.world.intersectionsWithPoint({ x, y }, (collider) => {
    const parent = collider.parent();
    if (parent && ignore && parent.handle === ignore.handle) {
      return true; // skip the dragged body itself
    }
    found = collider;
    return false;
  });

  return found;
}
    /**a is a rigidBody (several colliders) b is one collider.*/
  getLink(a : RAPIER.RigidBody, b : RAPIER.Collider): ConnectionResult | null {
    let best: RAPIER.ShapeContact | null = null;
    let best_i : number;
    for (let i = 0; i < a.numColliders(); i++) {
      const contact = a.collider(i)
        .contactCollider(b, SnapSystem.MAX_LINK_DIST);
      if (contact && (!best || contact.distance < best.distance)) {best = contact; best_i = i;};
    }
    if (!best) return null;
    return {
      a: { x: best.point1.x, y: best.point1.y },
      b: { x: best.point2.x, y: best.point2.y },
      collA : a.collider(best_i),
      collB : b
    };
  }
  getSingleLink(a: RAPIER.Collider, b : RAPIER.Collider): RAPIER.ShapeContact | null{
    return a.contactCollider(b, SnapSystem.MAX_LINK_DIST);
  }

  private noConnection(){
    this.line.sync(null);
    this.connection = null;
  }

  update(dt: number): void {
    if(this.isSnapping() && this.engine.drag.draggedRigidBody){
    const newCollider = this.queryMouse(this.engine.drag.draggedRigidBody.collider(0));
    if(!newCollider){
        this.noConnection();
        return;
    }
    const connection = this.getLink(this.engine.drag.draggedRigidBody, newCollider);
    this.line.sync(connection);
    this.connection = connection;
    }
    else{
    this.noConnection();
    }
  }

  isSnapping():boolean{
    return this.engine.inputs.down('c') || this.engine.inputs.down('shift');
  }
}

import * as THREE from 'three';

export class LinkLine {
  public dontTick = false;
  private line: THREE.Line;
  private positions = new Float32Array(6);

  constructor(private engine: Engine) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.line.frustumCulled = false; // bounds don't auto-update with position edits
    this.line.visible = false;
    engine.scene.add(this.line);
  }

  sync(link : { a: Vec2; b: Vec2 } | null) {
    this.line.visible = !!link;

    if (!link) return;
    const p = this.positions;
    p[0] = link.a.x; p[1] = link.a.y; p[2] = 0.5; // z in front of the bodies
    p[3] = link.b.x; p[4] = link.b.y; p[5] = 0.5;
    this.line.geometry.attributes.position.needsUpdate = true;
  }

}