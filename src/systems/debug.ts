import { Engine, UiTicks } from '../engine';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Creature } from '../creature';
import { Vector2 } from '@dimforge/rapier2d-compat';

export class DebugSystem implements UiTicks {
  private lines?: THREE.LineSegments;
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
  }

  resize() {
    this.textRenderer.setSize(window.innerWidth, window.innerHeight);
  }
}
