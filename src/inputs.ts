import { Vector3 } from 'three';
import { Engine } from './engine';

export class InputManager {
  private mouse = new Vector3();
  private keysHeld: Set<string> = new Set<string>();
  private keysJustPressed: Set<string> = new Set<string>();
  private keysJustReleased: Set<string> = new Set<string>();

  private keyJustPressedFixed: Set<string> = new Set<string>();
  private keyJustReleasedFixed: Set<string> = new Set<string>();

  justPressedFixed(e: string): boolean {
    return this.keyJustPressedFixed.has(e);
  }

  justReleasedFixed(e: string): boolean {
    return this.keyJustReleasedFixed.has(e);
  }

  justPressed(e: string): boolean {
    return this.keysJustPressed.has(e);
  }
  down(e: string): boolean {
    return this.keysHeld.has(e);
  }
  justReleased(e: string): boolean {
    return this.keysJustReleased.has(e);
  }
  mouseWorld(): Vector3 {
    return this.mouse;
  }

  frameTick() {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
  }

  FixedFrameTick() {
    this.keyJustPressedFixed.clear();
    this.keyJustReleasedFixed.clear();
  }

  constructor(private engine: Engine) {
    this.engine.canvas.addEventListener('mousemove', (e) => {
      this.mouse
        .set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1, 0)
        .unproject(this.engine.camera);
    });

    window.addEventListener('keydown', (e) => {
      if (!this.keysHeld.has(e.key.toLowerCase())) {
        this.keysJustPressed.add(e.key.toLowerCase());
        this.keyJustPressedFixed.add(e.key.toLowerCase());
      }
      this.keysHeld.add(e.key.toLowerCase());
    });

    window.addEventListener('keyup', (e) => {
      this.keysHeld.delete(e.key.toLowerCase());
      this.keysJustReleased.add(e.key.toLowerCase());
      this.keyJustReleasedFixed.add(e.key.toLowerCase());
    });

    this.engine.canvas.addEventListener('mousedown', (e) => {
      if (!this.keysHeld.has('mouse')) {
        this.keysJustPressed.add('mouse');
        this.keyJustPressedFixed.add('mouse');
      }
      this.keysHeld.add('mouse');
    });

    this.engine.canvas.addEventListener('mouseup', (e) => {
      this.keysHeld.delete('mouse');
      this.keysJustReleased.add('mouse');
      this.keyJustReleasedFixed.add('mouse');
    });
  }
}

import GUI from 'lil-gui';

export class Gui {
  readonly inputs = {
    gravity: 9.8,
  };
  readonly gui = new GUI();
  constructor(private engine: Engine) {
    this.gui.add(this.inputs, 'gravity', 9.8);
  }
}
