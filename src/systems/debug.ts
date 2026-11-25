import { Engine, UiTicks } from "../engine";
import * as THREE from 'three';

export class DebugSystem implements UiTicks {
  private lines?: THREE.LineSegments;

    constructor(private engine : Engine){
        engine.miscTicksUi.add(this);
    }
    dontTick: boolean;

    private updateVisuals(){
if(this.dontTick){
            return;
        }
        if (!this.lines) return;
        const v = this.engine.physics.world.debugRender().vertices;
        const pos = new Float32Array((v.length / 2) * 3);
        for (let i = 0, j = 0; i < v.length; i += 2, j += 3) {
            pos[j] = v[i];
            pos[j + 1] = v[i + 1];
        }
        this.lines.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    }

    private updateInputs(){
        if (this.engine.inputs.justPressed('p')) {
        this.toggleDebug();
      }
    }
    update(dt: number): void {
        this.updateInputs();
        this.updateVisuals();
    }
    private toggleDebug() {
    if (this.lines) {
      this.engine.scene.remove(this.lines);
      this.lines = undefined;
      return;
    }
    this.lines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x00ff88, depthTest: false }),
    );
    this.lines.position.z = 5;
    this.lines.frustumCulled = false;
    this.engine.scene.add(this.lines);
  }
}