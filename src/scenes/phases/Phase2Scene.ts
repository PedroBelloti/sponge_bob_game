import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { LulaMolusco } from '../../entities/bosses/LulaMolusco';
import type { BaseBoss } from '../../entities/bosses/BaseBoss';
import type { DialogConfig } from '../DialogScene';
import { DIALOG_LULA } from '../../data/dialogs';
import { BossPhaseScene } from './BossPhaseScene';
import {
  ATTACK_PALETTES,
  COLORS,
  COLORS_CSS,
  caption,
  display,
  impactBurst,
} from '../../config/theme';
import type { AttackPalette } from '../../config/theme';

interface Statue {
  container: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  hp: number;
  spawnedAt: number;
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

    this.add.image(width / 2, height / 2, 'bg-lula');

    this.add
      .text(16, 76, '◆ CASA DO LULA MOLUSCO', caption(12, COLORS_CSS.text))
      .setShadow(1, 1, '#000000', 2);

    // Chão
    this.ground = this.physics.add.staticGroup();
    // Invisível: o gramado da imagem faz o papel de piso
    const ground = this.ground.create(width / 2, height - 25, 'phase2-ground') as Phaser.Physics.Arcade.Sprite;
    ground.refreshBody();
    ground.setVisible(false);

    // Caixas de som como plataformas — one-way e em alturas alcançáveis
    // (as antigas a 200px do chão eram impossíveis para o pulo de 144px).
    // Central mais alta dá rota de fuga das estátuas explosivas no chão.
    this.platforms = this.physics.add.staticGroup();
    this.addOneWayPlatform(330, 558, 'phase2-platform');
    this.addOneWayPlatform(950, 558, 'phase2-platform');
    this.addOneWayPlatform(640, 445, 'phase2-platform');
  }

  protected createBoss(_width: number, height: number): BaseBoss {
    // Lula: corpo 130 de altura, pés no palco (height-50) → centro em height-115
    this.lula = new LulaMolusco(this, 1020, height - 131);
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
    // Violeta das notas — o teal do corpo destoava dos ataques dele
    return ATTACK_PALETTES.lula.mid;
  }

  protected getBossPalette(): AttackPalette {
    return ATTACK_PALETTES.lula;
  }

  protected getBossName(): string {
    return 'LULA MOLUSCO';
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
      .text(width / 2, height / 2, 'Lula perdeu a compostura!', display(24, '#b388ff'))
      .setOrigin(0.5)
      .setDepth(20)
      .setScale(0.6);
    this.tweens.add({ targets: msg, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: msg, alpha: 0, duration: 2000, onComplete: () => msg.destroy() });
  }

  // ── Holofotes ─────────────────────────────────────────────────

  private spawnSpotlight(startX: number, dir: 1 | -1): void {
    const { width, height } = this.scale;
    const beam = this.add
      .rectangle(startX, height / 2, CONSTANTS.SPOTLIGHT_WIDTH, height, 0xfff59d, 0.20)
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

    // Feedback visual: feixes esquentam para o gold do tema quando travados
    // (alphas maiores que na sala escura original — o cenário agora é claro)
    const alpha = locked ? 0.38 : 0.20;
    this.spotlights.forEach((beam) => beam.setFillStyle(locked ? COLORS.gold : 0xfff59d, alpha));
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

      // Anel de countdown acima da estátua — encolhe e esquenta até o estouro
      const ring = this.add.graphics().setDepth(6);

      this.statues.push({
        container: c,
        ring,
        hp: CONSTANTS.LULA_STATUE_HP,
        spawnedAt: time,
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
      this.drawStatueRing(statue, time);
      return true;
    });
  }

  /** Anel que encolhe (âmbar→vermelho) — leitura clara do tempo restante. */
  private drawStatueRing(statue: Statue, time: number): void {
    const remaining = Phaser.Math.Clamp(
      (statue.explodeAt - time) / (statue.explodeAt - statue.spawnedAt),
      0,
      1,
    );
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xff1744),
      Phaser.Display.Color.ValueToColor(0xffab40),
      100,
      remaining * 100,
    );
    const tint = Phaser.Display.Color.GetColor(color.r, color.g, color.b);

    statue.ring.clear();
    statue.ring.lineStyle(3, tint, 0.95);
    statue.ring.beginPath();
    statue.ring.arc(
      statue.x,
      statue.y - 70,
      12,
      Phaser.Math.DegToRad(-90),
      Phaser.Math.DegToRad(-90 + 360 * remaining),
      false,
    );
    statue.ring.strokePath();
  }

  private poofStatue(statue: Statue): void {
    statue.container.destroy();
    statue.ring.destroy();
    const poof = this.add.ellipse(statue.x, statue.y, 70, 70, 0xb0bec5, 0.6).setDepth(6);
    this.tweens.add({
      targets: poof, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 300,
      onComplete: () => poof.destroy(),
    });
  }

  private explodeStatue(statue: Statue): void {
    statue.container.destroy();
    statue.ring.destroy();
    this.cameras.main.shake(180, 0.008);

    // Estágio 1: flash branco curto no epicentro
    const flash = this.add
      .ellipse(statue.x, statue.y, 70, 70, 0xffffff, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(7);
    this.tweens.add({ targets: flash, alpha: 0, duration: 80, onComplete: () => flash.destroy() });

    // Estágio 2: onda âmbar expandindo até o raio de dano
    const blast = this.add
      .ellipse(statue.x, statue.y, 60, 60, 0xffab40, 0.7)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(6);
    this.tweens.add({
      targets: blast,
      scaleX: CONSTANTS.LULA_STATUE_EXPLOSION_RADIUS / 30,
      scaleY: CONSTANTS.LULA_STATUE_EXPLOSION_RADIUS / 30,
      alpha: 0,
      duration: 350,
      onComplete: () => blast.destroy(),
    });

    impactBurst(this, statue.x, statue.y, { core: 0xffffff, mid: 0xffab40, halo: 0xe65100 }, {
      particles: 16,
      scale: 1.6,
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

    // Caixa de som de palco: gabinete escuro, dois alto-falantes, LED e
    // friso superior iluminado marcando a superfície pisável
    if (!this.textures.exists('phase2-platform')) {
      const w = 230;
      const h = 30;
      const g = this.add.graphics();

      // Gabinete
      g.fillStyle(0x1c262e, 1);
      g.fillRoundedRect(0, 2, w, h - 2, 6);
      g.lineStyle(1.5, 0x37474f, 1);
      g.strokeRoundedRect(0, 2, w, h - 2, 6);

      // Friso superior — borda de palco iluminada
      g.fillStyle(0x4dd0e1, 0.9);
      g.fillRoundedRect(0, 0, w, 5, { tl: 6, tr: 6, bl: 0, br: 0 });

      // Alto-falantes (aro + cone + centro)
      [0.28, 0.72].forEach((fx) => {
        const cx = w * fx;
        g.fillStyle(0x0d1318, 1);
        g.fillCircle(cx, 18, 9);
        g.lineStyle(1.5, 0x546e7a, 1);
        g.strokeCircle(cx, 18, 9);
        g.fillStyle(0x37474f, 1);
        g.fillCircle(cx, 18, 4);
      });

      // LED de energia
      g.fillStyle(0x69f0ae, 1);
      g.fillCircle(w / 2, 18, 2.5);

      g.generateTexture('phase2-platform', w, h);
      g.destroy();
    }

    // Nota musical com glow violeta assado: halo + cabeça + haste + core
    if (!this.textures.exists('lula-note')) {
      const p = ATTACK_PALETTES.lula;
      const g = this.add.graphics();
      g.fillStyle(p.halo, 0.3);
      g.fillCircle(10, 10, 10);
      g.fillStyle(p.mid, 0.95);
      g.fillEllipse(8, 13, 10, 8);
      g.fillRect(12, 3, 2, 10);
      g.fillStyle(p.core, 1);
      g.fillEllipse(8, 13, 5, 4);
      g.generateTexture('lula-note', 20, 20);
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
