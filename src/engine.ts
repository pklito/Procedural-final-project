import * as THREE from 'three';
import { Physics, FIXED_DT } from './physics';
import { DragSystem, ShakeSystem } from './systems/drag';
import type { Entity } from './entity';
import type { Creature } from './creature';
import { InputManager } from './inputs';
import { SnapSystem } from './systems/snap';
import { Segment } from './segment';

export interface Ticks {
  fixedUpdate(dt: number): void;
  dontTick: boolean;
}
export interface UiTicks {
  update(dt: number): void;
  dontTick: boolean;
}

const VIEW_HEIGHT = 10;
const MAX_FRAME = 0.1; // cap to avoid spiral-of-death after tab switch

export class Engine {
  // 3JS components
  readonly canvas = document.getElementById('canvas') as HTMLCanvasElement;
  readonly renderer = new THREE.WebGLRenderer({
    canvas: this.canvas,
    antialias: true,
  });
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private KILL_FLOOR = -10;

  // Drag subsystem
  readonly snap: SnapSystem;
  readonly drag: DragSystem;
  readonly shake: ShakeSystem;
  readonly inputs: InputManager;

  // engine stuff
  private readonly clock = new THREE.Clock();
  private readonly entities = new Set<Entity>();
  private readonly creatures = new Set<Creature>();
  readonly miscTicks = new Set<Ticks>();
  readonly miscTicksUi = new Set<UiTicks>();
  private accumulator = 0;
  private debug?: THREE.LineSegments;

  static async create() {
    return new Engine(await Physics.create());
  }

  private constructor(readonly physics: Physics) {
    this.inputs = new InputManager(this);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x1a1c1f);
    this.camera.position.z = 10;

    window.addEventListener('resize', () => this.resize());

    this.drag = new DragSystem(this);
    this.snap = new SnapSystem(this);
    this.shake = new ShakeSystem(this);
    this.resize();
  }

  //Entity
  add<T extends Entity>(entity: T): T {
    this.entities.add(entity);
    this.scene.add(entity.graphics);
    return entity;
  }

  remove(entity: Entity) : boolean {
    if (entity instanceof Segment && entity.creature){
      console.warn("Cannot destroy segments of a creature yet TODO");
      return false;
    }
    if (!this.entities.delete(entity)) return false;
    this.scene.remove(entity.graphics);
    entity.dispose();
    return true;
  }

  //Creature
  addCreature(creature: Creature): Creature {
    this.creatures.add(creature);
    return creature;
  }

  removeCreature(creature: Creature) {
    if (!this.creatures.delete(creature)) return;
    creature.dispose(); // also removes its segments from this.entities
  }

  //window
  resize() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = (-VIEW_HEIGHT * aspect) / 2;
    this.camera.right = (VIEW_HEIGHT * aspect) / 2;
    this.camera.top = VIEW_HEIGHT / 2;
    this.camera.bottom = -VIEW_HEIGHT / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  //physics loop
  start() {
    this.renderer.setAnimationLoop(() => {
      const dt = this.clock.getDelta();
      this.accumulator += Math.min(dt, MAX_FRAME);

      // Fixed-rate physics ticks
      while (this.accumulator >= FIXED_DT) {
        for (const t of this.miscTicks) t.fixedUpdate(FIXED_DT);
        for (const e of this.entities) e.fixedUpdate(FIXED_DT);
        for (const c of this.creatures) c.fixedUpdate(FIXED_DT);

        for (const e of this.entities)
          if (e.rigidBody.translation().y < this.KILL_FLOOR){
            this.remove(e);
          }
        this.physics.step();
        this.accumulator -= FIXED_DT;
      }

      // Render
      for (const e of this.entities) e.sync();
      this.updateDebug();
      this.renderer.render(this.scene, this.camera);

      if (this.inputs.justPressed('p')) {
        this.toggleDebug();
      }

      for (const u of this.miscTicksUi) u.update(dt);
      this.inputs.frameTick();
    });
  }

  private toggleDebug() {
    if (this.debug) {
      this.scene.remove(this.debug);
      this.debug = undefined;
      return;
    }
    this.debug = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x00ff88, depthTest: false }),
    );
    this.debug.position.z = 5;
    this.debug.frustumCulled = false;
    this.scene.add(this.debug);
  }

  private updateDebug() {
    if (!this.debug) return;
    const v = this.physics.world.debugRender().vertices;
    const pos = new Float32Array((v.length / 2) * 3);
    for (let i = 0, j = 0; i < v.length; i += 2, j += 3) {
      pos[j] = v[i];
      pos[j + 1] = v[i + 1];
    }
    this.debug.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }
}
