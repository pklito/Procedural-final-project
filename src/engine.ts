import * as THREE from 'three';
import { Physics, FIXED_DT } from './physics';
import { DragSystem } from './systems/drag';
import type { Entity } from './entity';
import type { Creature } from './creature';
import { ShakeSystem } from './systems/shake';
import { Gui, InputManager } from './inputs';
import { SnapSystem } from './systems/snap';
import { Segment } from './segment';
import { DebugSystem } from './systems/debug';

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

  // Drag subsystem
  readonly snap: SnapSystem;
  readonly drag: DragSystem;
  readonly shake: ShakeSystem;
  readonly debug: DebugSystem;
  readonly inputs: InputManager;
  readonly gui: Gui;

  // engine stuff
  private TP_RESET = { x: 0, y: 8 };
  private KILL_FLOOR = -10;
  private readonly clock = new THREE.Clock();
  private readonly entities = new Set<Entity>();
  readonly creatures = new Set<Creature>();
  readonly miscTicks = new Set<Ticks>();
  readonly miscTicksUi = new Set<UiTicks>();
  private accumulator = 0;

  static async create() {
    return new Engine(await Physics.create());
  }

  private constructor(readonly physics: Physics) {
    this.inputs = new InputManager(this);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x1a1c1f);
    this.camera.position.z = 10;

    window.addEventListener('resize', () => this.resize());

    this.gui = new Gui(this);
    this.drag = new DragSystem(this);
    this.snap = new SnapSystem(this);
    this.shake = new ShakeSystem(this);
    this.debug = new DebugSystem(this);
    this.resize();
  }

  //Entity
  add<T extends Entity>(entity: T): T {
    this.entities.add(entity);
    this.scene.add(entity.graphics);
    return entity;
  }

  remove(entity: Entity): boolean {
    if (entity instanceof Segment && entity.creature) {
      entity.creature.teleport(this.TP_RESET);
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
    this.debug.resize();
  }

  //physics loop
  start() {
    this.renderer.setAnimationLoop(() => {
      const dt = this.gui.inputs.simulationSpeed*this.clock.getDelta();
      this.accumulator += Math.min(dt, MAX_FRAME);

      // Fixed-rate physics ticks
      while (this.accumulator >= FIXED_DT) {
        for (const t of this.miscTicks) t.fixedUpdate(FIXED_DT);
        for (const e of this.entities) e.fixedUpdate(FIXED_DT);
        for (const c of this.creatures) c.fixedUpdate(FIXED_DT);

        for (const e of this.entities)
          if (e.rigidBody.translation().y < this.KILL_FLOOR) {
            this.remove(e);
          }
        this.physics.step();
        this.accumulator -= FIXED_DT;
      }

      // Render
      for (const e of this.entities) e.sync();
      this.renderer.render(this.scene, this.camera);

      for (const u of this.miscTicksUi) u.update(dt);
      this.inputs.frameTick();
    });
  }
}
