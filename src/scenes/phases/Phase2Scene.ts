import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { LulaMolusco } from '../../entities/bosses/LulaMolusco';
import type { BaseBoss } from '../../entities/bosses/BaseBoss';
import type { DialogConfig } from '../DialogScene';
import { DIALOG_LULA } from '../../data/dialogs';
import { BossPhaseScene } from './BossPhaseScene';

interface Statue {
  container: Phaser.GameObjects.Container;
  hp: number;
  explodeAt: number;
  x: number;
  y: number;
}

export class Phase2Scene extends BossPhaseScene {
  private lula!: LulaMolusco;

  // Holofotes — GDD: velocidade constante; segundo entra na fase final
  private spotlights: Phaser.GameObjects.Rectangle[] = [];
  private precisionLockUntil: number = 0;

  // Estátuas explosivas
  private statues: Statue[] = [];

  constructor() {
    super({ key: 'Phase2Scene' });
  }

  // ── BossPhaseScene impl ───────────────────────────────────────

  protected buildArena(width: number, height: number): void {
    this.buildTextures();

    // Sala escura de teatro
    this.add.rectangle(width / 2, height / 2, width, height, 0x140a10);

    // Parede de fundo com quadros do próprio Lula (GDD)
    this.add.rectangle(width / 2, 260, width, 320, 0x1f1218);
    [320, 640, 960].forEach((x) => {
      this.add.rectangle(x, 220, 90, 110, 0x8d6e63);
      this.add.rectangle(x, 220, 70, 90, 0x80cbc4);
      this.add.ellipse(x, 228, 22, 40, 0x6fb3aa); // o nariz inconfundível
    });

    // Cortinas vermelhas + bambolina
    this.add.rectangle(45, height / 2, 90, height, 0x7b1f1f);
    this.add.rectangle(width - 45, height / 2, 90, height, 0x7b1f1f);
    this.add.rectangle(width / 2, 30, width, 60, 0x7b1f1f);
    this.add.rectangle(width / 2, 62, width, 6, 0xc9a227); // friso dourado

    this.add.text(16, 76, 'SALA DE TEATRO', { fontSize: '14px', color: '#C9A227' });

    // Palco
    this.ground = this.physics.add.staticGroup();
    (this.ground.create(width / 2, height - 25, 'phase2-ground') as Phaser.Physics.Arcade.Sprite).refreshBody();

    // Caixas de som como plataformas
    this.platforms = this.physics.add.staticGroup();
    [[330, 480], [950, 480]].forEach(([x, y]) => {
      (this.platforms.create(x, y, 'phase2-platform') as Phaser.Physics.Arcade.Sprite).refreshBody();
    });
  }

  protected createBoss(_width: number, height: number): BaseBoss {
    // Lula: corpo 130 de altura, pés no palco (height-50) → centro em height-115
    this.lula = new LulaMolusco(this, 1020, height - 115);
    return this.lula;
  }

  protected getDialog(): DialogConfig {
    return DIALOG_LULA;
  }

  protected getNextSceneKey(): string {
    return 'Phase3Scene';
  }

  protected getBossProjectileTextureKey(): string {
    return 'lula-note';
  }

  protected getBossBarColor(): number {
    return 0x80cbc4;
  }

  // GDD: A = desestabilizado (fraco com fúrias), B = furioso (rápido sem pausas)
  protected applyMood(optionKey: 'A' | 'B'): void {
    this.lula.setMood(optionKey === 'A' ? 'desestabilizado' : 'furioso');
  }

  protected onArenaCreate(): void {
    this.spotlights = [];
    this.statues = [];
    this.precisionLockUntil = 0;
    this.spawnSpotlight(140, 1);
  }

  protected onArenaUpdate(time: number): void {
    this.updateSpotlights(time);
    this.updateStatues(time);

    // Lula pede novas estátuas quando o cooldown vence
    const count = this.lula.tryRequestStatues(time);
    if (count > 0) this.spawnStatues(count, time);
  }

  protected onBossFinalPhaseHook(): void {
    const { width, height } = this.scale;

    // GDD: segundo holofote entra no cenário, partindo do lado oposto
    this.spawnSpotlight(width - 140, -1);

    const msg = this.add
      .text(width / 2, height / 2, 'Lula perdeu a compostura!', { fontSize: '24px', color: '#80CBC4' })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: msg, alpha: 0, duration: 2000, onComplete: () => msg.destroy() });
  }

  // ── Holofotes ─────────────────────────────────────────────────

  private spawnSpotlight(startX: number, dir: 1 | -1): void {
    const { width, height } = this.scale;
    const beam = this.add
      .rectangle(startX, height / 2, CONSTANTS.SPOTLIGHT_WIDTH, height, 0xfff59d, 0.10)
      .setDepth(4);
    this.spotlights.push(beam);

    // Velocidade constante (GDD): duração derivada da distância percorrida
    const minX = 140;
    const maxX = width - 140;
    const travel = maxX - minX;
    const duration = (travel / CONSTANTS.SPOTLIGHT_TRAVEL_SPEED) * 1000;

    this.tweens.add({
      targets: beam,
      x: dir === 1 ? maxX : minX,
      duration,
      ease: 'Linear',
      yoyo: true,
      repeat: -1,
    });
  }

  private updateSpotlights(time: number): void {
    // Holofote sobre o Plankton → Lula ganha mira precisa por 3s (GDD)
    const caught = this.spotlights.some(
      (beam) => Math.abs(beam.x - this.plankton.x) < CONSTANTS.SPOTLIGHT_WIDTH / 2 + 10,
    );
    if (caught) this.precisionLockUntil = time + CONSTANTS.SPOTLIGHT_PRECISION_DURATION;

    const locked = time < this.precisionLockUntil;
    this.lula.setPrecise(locked);

    // Feedback visual: feixes esquentam enquanto a mira está travada
    const alpha = locked ? 0.22 : 0.10;
    this.spotlights.forEach((beam) => beam.setFillStyle(locked ? 0xffd54f : 0xfff59d, alpha));
  }

  // ── Estátuas explosivas ───────────────────────────────────────

  private spawnStatues(count: number, time: number): void {
    const { width, height } = this.scale;
    const groundY = height - 50;
    const xs = count === 1 ? [width / 2] : [width / 2 - 220, width / 2 + 220];

    xs.forEach((x) => {
      const c = this.add.container(x, groundY - 45).setDepth(5);
      const img = this.add.image(0, 0, 'lula-statue');
      c.add(img);

      // Piscar acelerado conta o tempo até a explosão
      this.tweens.add({
        targets: c, alpha: 0.45, duration: 220, yoyo: true, repeat: -1,
      });

      this.statues.push({
        container: c,
        hp: CONSTANTS.LULA_STATUE_HP,
        explodeAt: time + CONSTANTS.LULA_STATUE_COUNTDOWN_MS,
        x,
        y: groundY - 45,
      });
    });
  }

  private updateStatues(time: number): void {
    if (this.statues.length === 0) return;

    // Lasers do Plankton destroem estátuas (GDD: destruível ou evitável)
    this.plankton.getProjectileGroup().getChildren().forEach((obj) => {
      const laser = obj as Phaser.Physics.Arcade.Sprite;
      if (!laser.active) return;
      for (const statue of this.statues) {
        const bounds = new Phaser.Geom.Rectangle(statue.x - 25, statue.y - 45, 50, 90);
        if (Phaser.Geom.Intersects.RectangleToRectangle(laser.getBounds(), bounds)) {
          laser.setActive(false).setVisible(false);
          (laser.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
          statue.hp -= CONSTANTS.PLANKTON_LASER_DAMAGE;
          this.skillCharge.addFromDamage(CONSTANTS.PLANKTON_LASER_DAMAGE);
          statue.container.setScale(1.06);
          this.time.delayedCall(60, () => statue.container.setScale(1));
          break;
        }
      }
    });

    // Resolve destruições e explosões
    this.statues = this.statues.filter((statue) => {
      if (statue.hp <= 0) {
        this.poofStatue(statue);
        return false;
      }
      if (time >= statue.explodeAt) {
        this.explodeStatue(statue);
        return false;
      }
      return true;
    });
  }

  private poofStatue(statue: Statue): void {
    statue.container.destroy();
    const poof = this.add.ellipse(statue.x, statue.y, 70, 70, 0xb0bec5, 0.6).setDepth(6);
    this.tweens.add({
      targets: poof, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 300,
      onComplete: () => poof.destroy(),
    });
  }

  private explodeStatue(statue: Statue): void {
    statue.container.destroy();
    this.cameras.main.shake(180, 0.008);

    const blast = this.add
      .ellipse(statue.x, statue.y, 60, 60, 0xffab40, 0.7)
      .setDepth(6);
    this.tweens.add({
      targets: blast,
      scaleX: CONSTANTS.LULA_STATUE_EXPLOSION_RADIUS / 30,
      scaleY: CONSTANTS.LULA_STATUE_EXPLOSION_RADIUS / 30,
      alpha: 0,
      duration: 350,
      onComplete: () => blast.destroy(),
    });

    const dist = Phaser.Math.Distance.Between(statue.x, statue.y, this.plankton.x, this.plankton.y);
    if (dist <= CONSTANTS.LULA_STATUE_EXPLOSION_RADIUS) {
      this.plankton.receiveDamage(CONSTANTS.LULA_STATUE_DAMAGE);
    }
  }

  // ── Texturas próprias da arena ────────────────────────────────

  private buildTextures(): void {
    const makeRect = (key: string, color: number, w: number, h: number) => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRect(0, 0, w, h);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    makeRect('phase2-ground', 0x5d4037, CONSTANTS.GAME_WIDTH, 50);
    makeRect('phase2-platform', 0x4e342e, 200, 20);

    // Nota musical: cabeça + haste
    if (!this.textures.exists('lula-note')) {
      const g = this.add.graphics();
      g.fillStyle(0xb39ddb, 1);
      g.fillEllipse(5, 10, 10, 8);
      g.fillRect(9, 0, 2, 10);
      g.generateTexture('lula-note', 14, 14);
      g.destroy();
    }

    // Estátua do Lula: pedestal + busto + nariz
    if (!this.textures.exists('lula-statue')) {
      const g = this.add.graphics();
      g.fillStyle(0x90a4ae, 1);
      g.fillRect(5, 70, 40, 20);            // pedestal
      g.fillStyle(0xb0bec5, 1);
      g.fillRoundedRect(10, 8, 30, 64, 8);  // busto
      g.fillStyle(0x90a4ae, 1);
      g.fillEllipse(25, 34, 10, 22);        // nariz
      g.generateTexture('lula-statue', 50, 90);
      g.destroy();
    }
  }
}
