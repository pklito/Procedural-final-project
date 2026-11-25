import RAPIER, { RigidBody } from '@dimforge/rapier2d-compat';
import type { Engine, Ticks, UiTicks } from '../engine';
import { Vector3 } from 'three';
import { Vec2, worldToLocal } from '../physics';

type ConnectionResult = { a: Vec2; b: Vec2; collA: RAPIER.Collider; collB: RAPIER.Collider };

export class SnapSystem implements UiTicks {
  dontTick: boolean = false;
  private static readonly MAX_LINK_DIST = 1000;
  private line: LinkLine;
  private connection: ConnectionResult;
  constructor(protected engine: Engine) {
    this.line = new LinkLine(engine);
    this.engine.miscTicksUi.add(this);
  }

  private connectSegments() {
    const a = Entity.from(this.connection.collA.parent());
    const b = Entity.from(this.connection.collB.parent());
    if (!(a instanceof Segment && b instanceof Segment)) {
      console.log(a instanceof Segment, b instanceof Segment);
      console.error('Attempting to connect a non segment, ', a, b);
      return;
    }
    console.log('CONNECTING', a, b);
    if (b.creature && a.creature) {
      console.error('Two creatures being connected');
      return;
    }
    let creature = a.creature;
    let segment = b;
    if (b.creature) {
      creature = b.creature;
      segment = a;
    }
    if (!creature) {
      console.error('No creatures!');
      return;
    }
    creature.addSegment(segment);
    creature.connect(
      a,
      b,
      worldToLocal(a.rigidBody, this.connection.a),
      worldToLocal(b.rigidBody, this.connection.b),
      -a.rigidBody.rotation() + b.rigidBody.rotation()
    );
  }
  private queryMouse(ignore: RAPIER.Collider | null): RAPIER.Collider | null {
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

  private static readonly INSET = 0.2;
  getLink(a: RAPIER.RigidBody, b: RAPIER.Collider): ConnectionResult | null {
    const m = this.engine.inputs.mouseWorld();
    const mouse = { x: m.x, y: m.y };

    let bestDist = Infinity;
    let bestIdx = -1;
    let bestPoint: Vec2 | null = null;
    let bestInside = false;

    for (let i = 0; i < a.numColliders(); i++) {
      const proj = a.collider(i).projectPoint(mouse, false);
      const dist = Math.hypot(proj.point.x - mouse.x, proj.point.y - mouse.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        bestPoint = { x: proj.point.x, y: proj.point.y };
        bestInside = proj.isInside;
      }
    }
    if (!bestPoint) return null;

    let nx = bestInside ? bestPoint.x - mouse.x : mouse.x - bestPoint.x;
    let ny = bestInside ? bestPoint.y - mouse.y : mouse.y - bestPoint.y;
    let len = Math.hypot(nx, ny);

    if (len < 1e-6) {
      const c = a.translation();
      nx = bestPoint.x - c.x;
      ny = bestPoint.y - c.y;
      len = Math.hypot(nx, ny) || 1;
    }
    nx /= len;
    ny /= len;

    const d = SnapSystem.INSET;
    return {
      a: { x: bestPoint.x - nx * d, y: bestPoint.y - ny * d },
      b: mouse,
      collA: a.collider(bestIdx),
      collB: b,
    };
  }
  getSingleLink(a: RAPIER.Collider, b: RAPIER.Collider): RAPIER.ShapeContact | null {
    return a.contactCollider(b, SnapSystem.MAX_LINK_DIST);
  }

  private noConnection() {
    this.line.sync(null);
    this.connection = null;
  }

  update(dt: number): void {
    if (this.engine.inputs.justReleased('mouse')) {
      if (this.connection) {
        this.connectSegments();
      }
    }
    if (this.isSnapping() && this.engine.drag.draggedRigidBody) {
      const newCollider = this.queryMouse(this.engine.drag.draggedRigidBody.collider(0));
      if (!newCollider) {
        this.noConnection();
        return;
      }
      const connection = this.getLink(this.engine.drag.draggedRigidBody, newCollider);
      this.line.sync(connection);
      this.connection = connection;
    } else {
      this.noConnection();
    }
  }

  isSnapping(): boolean {
    return this.engine.inputs.down('c') || this.engine.inputs.down('shift');
  }
}

//Visuals:

import * as THREE from 'three';
import { Entity } from '../entity';
import { Segment } from '../segment';
import { Creature } from '../creature';

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

  sync(link: { a: Vec2; b: Vec2 } | null) {
    this.line.visible = !!link;

    if (!link) return;
    const p = this.positions;
    p[0] = link.a.x;
    p[1] = link.a.y;
    p[2] = 0.5; // z in front of the bodies
    p[3] = link.b.x;
    p[4] = link.b.y;
    p[5] = 0.5;
    this.line.geometry.attributes.position.needsUpdate = true;
  }
}
