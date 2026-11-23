import * as THREE from 'three';
import RAPIER from '@dimforge/rapier2d-compat';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {Entity, flat} from '../entity';
import type {Engine} from '../engine';
import {Layer, groups} from '../physics';

export function starPoints(tips: number, outer: number, inner: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < tips * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / tips;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

export class Star extends Entity {
  readonly body: RAPIER.RigidBody;

  constructor(engine: Engine, points: [number, number][], x: number, y: number,
              fillColor: THREE.ColorRepresentation = 0xf2991f,
              strokeColor: THREE.ColorRepresentation = 0xffffff) {
    super(engine);
    const fill = new THREE.Mesh(
      new THREE.ShapeGeometry(new THREE.Shape(points.map(([px, py]) => new THREE.Vector2(px, py)))),
      flat(fillColor));
    fill.position.z = 0.1;

    const strokeGeo = new LineGeometry();
    strokeGeo.setPositions([...points, points[0]].flatMap(([px, py]) => [px, py, 0]));
    const stroke = new Line2(strokeGeo, new LineMaterial({color: strokeColor, linewidth: 0.12, worldUnits: true}));
    stroke.position.z = 0.2;
    this.object.add(fill, stroke);

    this.body = this.addBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y));
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      this.world.createCollider(
        RAPIER.ColliderDesc.triangle({x: 0, y: 0}, {x: a[0], y: a[1]}, {x: b[0], y: b[1]})
          .setRestitution(0.3).setFriction(0.6)
          .setCollisionGroups(groups(Layer.PROP, Layer.ALL)),
        this.body);
    }
    this.sync();
  }

  sync() {
    const t = this.body.translation();
    this.object.position.set(t.x, t.y, 0);
    this.object.rotation.z = this.body.rotation();
  }
}
