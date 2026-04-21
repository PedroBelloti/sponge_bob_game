import * as Phaser from 'phaser';
import { CONSTANTS } from './constants';
import { BootScene } from '../scenes/BootScene';
import { PrologoScene } from '../scenes/PrologoScene';
import { Phase1Scene } from '../scenes/phases/Phase1Scene';

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
  scene: [BootScene, PrologoScene, Phase1Scene],
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
