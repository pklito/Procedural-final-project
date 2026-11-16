import * as THREE from 'three';
import RAPIER from '@dimforge/rapier2d-compat';
import {Engine} from './engine';
import {Physics} from './physics';

const flat = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({color});

export class Ground {
    readonly mesh: THREE.Mesh;
    private body: RAPIER.RigidBody;

    constructor(x: number, y: number, width: number, height: number, color: THREE.ColorRepresentation = 0x555b66) {
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), flat(color));
        this.mesh.position.set(x, y, 0.05);
        Engine.engine.scene.add(this.mesh);

        const world = Physics.world;
        this.body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y));
        world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2), this.body);
    }

    destroy() {
        Engine.engine.scene.remove(this.mesh);
        Physics.world.removeRigidBody(this.body);
    }
}

export class Snake {
    private snake: THREE.Mesh[] = [];
    private bodies: RAPIER.RigidBody[] = [];
    private colliders: RAPIER.Collider[] = [];
    private controller: RAPIER.KinematicCharacterController;

    constructor(private segments: number = 14,
        private spacing: number = 0.55,
    ) {
        this.controller = Physics.world.createCharacterController(0.01);
        this.generateGraphics();
        this.generateColliders();
        Engine.engine.onUpdate(this.update);
    }

    destroy() {
        Engine.engine.offUpdate(this.update);
        for (const b of this.bodies) Physics.world.removeRigidBody(b);
        Physics.world.removeCharacterController(this.controller);
        for (const m of this.snake) Engine.engine.scene.remove(m);
    }

    generateGraphics() {
        const circleGeo = new THREE.CircleGeometry(1, 32);
        for (let i = 0; i < this.segments; i++) {
            const f = i / (this.segments - 1);
            const r = 0.5 * (1 - 0.6 * f);
            const seg = new THREE.Mesh(circleGeo, flat(new THREE.Color(0.2 + 0.6 * f, 0.9 - 0.5 * f, 0.3)));
            seg.scale.set(r, r, 1);
            seg.position.set(0, 0, 0.3 - i * 0.01);
            this.snake.push(seg);
            Engine.engine.scene.add(seg);
        }
    }

    generateColliders() {
        const world = Physics.world;
        for (let i = 0; i < this.segments; i++) {
            const p = this.snake[i].position;
            const r = this.snake[i].scale.x;
            const body = world.createRigidBody(
                RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y));
            const collider = world.createCollider(RAPIER.ColliderDesc.ball(r), body);
            this.bodies.push(body);
            this.colliders.push(collider);
        }
    }

    private moveSegment(i: number, tx: number, ty: number) {
        const pos = this.snake[i].position;
        this.controller.computeColliderMovement(
            this.colliders[i],
            {x: tx - pos.x, y: ty - pos.y},
            RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC,
        );
        const m = this.controller.computedMovement();
        pos.x += m.x;
        pos.y += m.y;
        this.bodies[i].setNextKinematicTranslation({x: pos.x, y: pos.y});
    }

    followChain(target: THREE.Vector3, dt: number, speed: number = 8) {
        const head = this.snake[0].position;
        const k = speed <= 0 ? 1 : 1 - Math.exp(-speed * dt);
        this.moveSegment(0, head.x + (target.x - head.x) * k, head.y + (target.y - head.y) * k);

        for (let i = 1; i < this.snake.length; i++) {
            const p = this.snake[i].position, q = this.snake[i - 1].position;
            const dx = p.x - q.x, dy = p.y - q.y;
            const d = Math.hypot(dx, dy);
            if (d > this.spacing) {
                this.moveSegment(i, q.x + (dx / d) * this.spacing, q.y + (dy / d) * this.spacing);
            }
        }
    }

    private update = (dt: number) => {
        this.followChain(Engine.engine.mouse, dt, 8);
    };
}

import {Line2} from 'three/addons/lines/Line2.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';

export class DynamicStar {
    readonly group = new THREE.Group();
    private body: RAPIER.RigidBody;

    constructor(points: [number, number][], x: number, y: number,
        fillColor: THREE.ColorRepresentation = 0xf2991f,
        strokeColor: THREE.ColorRepresentation = 0xffffff,
    ) {
        const fill = new THREE.Mesh(
            new THREE.ShapeGeometry(new THREE.Shape(points.map(([px, py]) => new THREE.Vector2(px, py)))),
            flat(fillColor));
        fill.position.z = 0.1;

        const strokeGeo = new LineGeometry();
        strokeGeo.setPositions([...points, points[0]].flatMap(([px, py]) => [px, py, 0]));
        const stroke = new Line2(strokeGeo, new LineMaterial({color: strokeColor, linewidth: 0.12, worldUnits: true}));
        stroke.position.z = 0.2;

        this.group.add(fill, stroke);
        this.group.position.set(x, y, 0);
        Engine.engine.scene.add(this.group);

        const world = Physics.world;
        this.body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y));
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length];
            const desc = RAPIER.ColliderDesc.triangle(
                {x: 0, y: 0}, {x: a[0], y: a[1]}, {x: b[0], y: b[1]})
                .setRestitution(0.3)
                .setFriction(0.6);
            world.createCollider(desc, this.body);
        }

        Engine.engine.onUpdate(this.update);
    }

    destroy() {
        Engine.engine.offUpdate(this.update);
        Engine.engine.scene.remove(this.group);
        Physics.world.removeRigidBody(this.body);
    }

    private update = () => {
        const t = this.body.translation();
        this.group.position.set(t.x, t.y, 0);
        this.group.rotation.z = this.body.rotation();
    };
}