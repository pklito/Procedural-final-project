import { Engine, UiTicks } from '../engine';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Creature } from '../creature';
import { Vector2 } from '@dimforge/rapier2d-compat';

export class DebugSystem implements UiTicks {
  private lines?: THREE.LineSegments;
  private jointDebug: JointDebug;
  private showCreatureNames: boolean = true;
  private labels = new Map<Creature, CSS2DObject>();
  private textRenderer: CSS2DRenderer;

  constructor(private engine: Engine) {
    engine.miscTicksUi.add(this);
    this.textRenderer = new CSS2DRenderer();
    this.textRenderer.domElement.style.cssText =
      'position: absolute; top: 0; left: 0; pointer-events: none;';
    document.body.appendChild(this.textRenderer.domElement);
    this.resize();
    this.jointDebug = new JointDebug(this.engine.scene);
  }
  dontTick: boolean;

  // ------------ COLLIDER ----------------
  private colliderTick() {
    if (!this.lines) return;
    const v = this.engine.physics.world.debugRender().vertices;
    const pos = new Float32Array((v.length / 2) * 3);
    for (let i = 0, j = 0; i < v.length; i += 2, j += 3) {
      pos[j] = v[i];
      pos[j + 1] = v[i + 1];
    }
    this.lines.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }

  private colliderEnable() {
    this.lines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x00ff88, depthTest: false }),
    );
    this.lines.position.z = 5;
    this.lines.frustumCulled = false;
    this.engine.scene.add(this.lines);
  }

  private colliderDisable() {
    this.engine.scene.remove(this.lines);
    this.lines = undefined;
  }
  private colliderToggle() {
    if (this.lines) {
      this.colliderDisable();
      return;
    }
    this.colliderEnable();
  }

  //  ---------- CREATURE NAMES ------------
  private creatureTick() {
    if (!this.showCreatureNames) return;
    for (const [creature, label] of this.labels) {
      if (!this.engine.creatures.has(creature)) {
        this.engine.scene.remove(label);
        label.element.remove(); // CSS2DObject doesn't clean up its DOM element
        this.labels.delete(creature);
      }
    }

    this.engine.creatures.forEach((c: Creature) => {
      let label = this.labels.get(c);
      if (!label) {
        const div = document.createElement('div');
        div.textContent = `Creature #${Math.log2(c.collisionBit) - 1}`;
        div.style.cssText =
          'color: white; font: 12px monospace; white-space: nowrap; text-shadow: 0 0 3px black;';
        label = new CSS2DObject(div);
        this.engine.scene.add(label);
        this.labels.set(c, label);
      }

      let a = new Vector2(0, 0);
      c.segments.forEach((p, p2, s) => {
        a.x += p.rigidBody.translation().x / s.size;
        a.y += p.rigidBody.translation().y / s.size;
      });
      label.position.set(a.x, a.y + 0.5, 0);
    });
  }

  setShowCreatures(b: boolean) {
    this.showCreatureNames = b;
    this.textRenderer.domElement.style.display = this.showCreatureNames ? '' : 'none';
  }

  //  ---------- SHARED ---------------
  private updateInputs() {
    if (this.engine.inputs.justPressed('p')) {
      this.colliderToggle();
    }
  }
  update(dt: number): void {
    if (this.dontTick) return;
    this.updateInputs();
    this.colliderTick();
    this.creatureTick();
    this.textRenderer.render(this.engine.scene, this.engine.camera);
    this.jointDebug.update(this.engine.creatures);
  }

  resize() {
    this.textRenderer.setSize(window.innerWidth, window.innerHeight);
  }
}

const AXIS_TARGET = [0.4, 0.6];
const AXIS_CURRENT = [0., 0.3];
const AXIS_LEN = 0.35;
const ARC_RADIUS = 0.35;
const ARC_SEGMENTS = 12;
const CROSS = 0.06;

// per joint: cross (4 verts) + ref (2) + current (2) + target (2) + arc (ARC_SEGMENTS * 2)
const VERTS_PER_JOINT = 4 + 2 + 2 + 2 + ARC_SEGMENTS * 2;

const GREY: [number, number, number] = [0.5, 0.5, 0.5];
const GREEN: [number, number, number] = [0.2, 0.7, 0.1];
const YELLOW: [number, number, number] = [1.0, 0.85, 0.1];
const RED: [number, number, number] = [1.0, 0.25, 0.2];

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class JointDebug {
  readonly lines: THREE.LineSegments;
  private capacityJoints = 0;
  private pos = new Float32Array(0);
  private col = new Float32Array(0);
  private v = 0;

  constructor(private scene: THREE.Scene) {
    this.lines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false }),
    );
    this.lines.position.z = 5;
    this.lines.renderOrder = 999;
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  private ensureCapacity(joints: number) {
    if (joints <= this.capacityJoints) return;
    this.capacityJoints = Math.max(16, joints * 2);
    const verts = this.capacityJoints * VERTS_PER_JOINT;
    this.pos = new Float32Array(verts * 3);
    this.col = new Float32Array(verts * 3);
    this.lines.geometry.dispose();
    this.lines.geometry = new THREE.BufferGeometry();
    this.lines.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines.geometry.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
  }

  private seg(
    x1: number, y1: number, x2: number, y2: number,
    c: [number, number, number],
  ) {
    let i = this.v * 3;
    this.pos[i] = x1; this.pos[i + 1] = y1; this.pos[i + 2] = 0;
    this.col[i] = c[0]; this.col[i + 1] = c[1]; this.col[i + 2] = c[2];
    i += 3;
    this.pos[i] = x2; this.pos[i + 1] = y2; this.pos[i + 2] = 0;
    this.col[i] = c[0]; this.col[i + 1] = c[1]; this.col[i + 2] = c[2];
    this.v += 2;
  }

  update(creatures: Iterable<Creature>) {
    let count = 0;
    for (const c of creatures) count += c.joints.length;
    this.ensureCapacity(count);
    this.v = 0;

    for (const creature of creatures) {
      for (const { segA, segB, anchorA, targetAngle } of creature.joints) {
        const a = segA.rigidBody;
        const b = segB.rigidBody;

        // Pivot in world space
        const t = a.translation();
        const ra = a.rotation();
        const cs = Math.cos(ra);
        const sn = Math.sin(ra);
        const px = t.x + anchorA.x * cs - anchorA.y * sn;
        const py = t.y + anchorA.x * sn + anchorA.y * cs;

        const rel = b.rotation() - ra;
        const err = wrap(targetAngle - rel);

        // Angles as world-space headings
        const refAng = ra;
        const curAng = ra + rel; // == b.rotation()
        const tgtAng = ra + targetAngle;

        // Pivot cross
        this.seg(px - CROSS, py, px + CROSS, py, GREY);
        this.seg(px, py - CROSS, px, py + CROSS, GREY);

        // Reference (segA heading), current (segB), target
        this.seg(px, py, px + Math.cos(refAng) * AXIS_LEN, py + Math.sin(refAng) * AXIS_LEN, GREY);
        this.seg(px + Math.cos(curAng) * AXIS_CURRENT[0], py + Math.sin(curAng) * AXIS_CURRENT[0],
                 px + Math.cos(curAng) * AXIS_CURRENT[1], py + Math.sin(curAng) * AXIS_CURRENT[1], GREEN);
        this.seg(px + Math.cos(tgtAng) * AXIS_TARGET[0], py + Math.sin(tgtAng) * AXIS_TARGET[0],
                 px + Math.cos(tgtAng) * AXIS_TARGET[1], py + Math.sin(tgtAng) * AXIS_TARGET[1], YELLOW);

        // Error arc from current -> target (short way round)
        for (let i = 0; i < ARC_SEGMENTS; i++) {
          const a0 = curAng + (err * i) / ARC_SEGMENTS;
          const a1 = curAng + (err * (i + 1)) / ARC_SEGMENTS;
          this.seg(
            px + Math.cos(a0) * ARC_RADIUS, py + Math.sin(a0) * ARC_RADIUS,
            px + Math.cos(a1) * ARC_RADIUS, py + Math.sin(a1) * ARC_RADIUS,
            RED,
          );
        }
      }
    }

    const g = this.lines.geometry;
    g.setDrawRange(0, this.v);
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.lines);
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}