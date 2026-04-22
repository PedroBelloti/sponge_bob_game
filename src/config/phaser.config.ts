import * as Phaser from 'phaser';
import { CONSTANTS } from './constants';
import { BootScene } from '../scenes/BootScene';
import { PrologoScene } from '../scenes/PrologoScene';
import { DialogScene } from '../scenes/DialogScene';
import { Phase1Scene } from '../scenes/phases/Phase1Scene';
import { Phase2Scene } from '../scenes/phases/Phase2Scene';

export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CONSTANTS.GAME_WIDTH,
  height: CONSTANTS.GAME_HEIGHT,
  backgroundColor: '#0a1628',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 800 },
      debug: false,
    },
  },
  // DialogScene deve vir DEPOIS das Phase scenes para renderizar por cima delas
  scene: [BootScene, PrologoScene, Phase1Scene, Phase2Scene, DialogScene],
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
