import * as THREE from 'three';
import RAPIER from '@dimforge/rapier2d-compat';
import {Entity, flat} from '../entity';
import type {Engine} from '../engine';
import {Layer, groups} from '../physics';
import {Hover} from '../behaviors';
import type {Ball} from './ball';

export interface SnakeOptions {
  x: number; y: number;
  segments?: number;
  spacing?: number;
  headRadius?: number;
  hoverHeight?: number;
}

/** A chain of ball bodies pinned together with revolute joints. The head is driven by forces. */
export class Snake extends Entity {
  private static readonly GROUPS = groups(Layer.SNAKE, Layer.ALL & ~Layer.SNAKE); // no self-collision

  readonly bodies: RAPIER.RigidBody[] = [];
  private readonly meshes: THREE.Mesh[] = [];
  readonly spacing: number;
  readonly hover: Hover;

  // tuning knobs
  steerStiffness = 40;
  steerDamping = 8;

  constructor(engine: Engine, o: SnakeOptions) {
    super(engine);
    const n = o.segments ?? 14;
    this.spacing = o.spacing ?? 0.55;
    const headR = o.headRadius ?? 0.5;
    const circle = new THREE.CircleGeometry(1, 32);

    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const r = headR * (1 - 0.6 * f);

      const mesh = new THREE.Mesh(circle, flat(new THREE.Color(0.2 + 0.6 * f, 0.9 - 0.5 * f, 0.3)));
      mesh.scale.set(r, r, 1);
      mesh.position.z = 0.3 - i * 0.01;
      this.object.add(mesh);
      this.meshes.push(mesh);

      const body = this.addBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(o.x - i * this.spacing, o.y)
        .setAngularDamping(2));
      this.world.createCollider(RAPIER.ColliderDesc.ball(r).setCollisionGroups(Snake.GROUPS), body);
      this.bodies.push(body);

      if (i > 0) {
        const h = this.spacing / 2;
        this.engine.physics.revolute(this.bodies[i - 1], body, {x: -h, y: 0}, {x: h, y: 0});
      }
    }

    this.hover = new Hover(engine.physics, this.head, {
      height: o.hoverHeight ?? 1.5, stiffness: 80, damping: 12,
    });
  }

  get head() { return this.bodies[0]; }
  get tail() { return this.bodies[this.bodies.length - 1]; }

  /** Pin a ball to the end of the tail. */
  attachToTail(ball: Ball) {
    const t = this.tail.translation();
    const h = this.spacing / 2;
    ball.body.setTranslation({x: t.x - h - ball.radius, y: t.y}, true);
    this.engine.physics.revolute(this.tail, ball.body, {x: -h, y: 0}, {x: ball.radius, y: 0});
  }

  fixedUpdate(dt: number) {
    this.hover.apply(dt);

    // horizontal steering toward the mouse: spring + damper, as a force (not a teleport)
    const p = this.head.translation(), v = this.head.linvel();
    const fx = this.steerStiffness * (this.engine.mouse.x - p.x) - this.steerDamping * v.x;
    this.head.applyImpulse({x: fx * dt, y: 0}, true);
  }

  sync() {
    for (let i = 0; i < this.bodies.length; i++) {
      const t = this.bodies[i].translation();
      this.meshes[i].position.x = t.x;
      this.meshes[i].position.y = t.y;
    }
  }
}
