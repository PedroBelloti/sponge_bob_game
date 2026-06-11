export const CONSTANTS = {
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
  SAVE_VERSION: 1,
  SKILL_MAX_CHARGE: 100,
  SKILL_CHARGE_RATE: 0.5,
  BOB_OFFER_MINIMUM: 3,
  EMPATICO_MINIMUM: 3,
  EGOISTA_MAXIMUM: -1,
  PATRICK_FINAL_PHASE: 0.30,
  LULA_FINAL_PHASE: 0.35,
  SANDY_FINAL_PHASE: 0.30,
  BOB_FINAL_PHASE: 0.25,
  FINAL_BOSS_FINAL_PHASE: 0.40,
  PATRICK_HP: 600,
  LULA_HP: 500,
  SANDY_HP: 700,
  BOB_HP: 900,
  FINAL_BOSS_HP: 1200,
  PRIME_HP_MULTIPLIER: 1.5,
  PRIME_SPEED_MULTIPLIER: 1.4,
  PRIME_DAMAGE_MULTIPLIER: 1.3,
  PLANKTON_MAX_HP: 6,
  KAREN_MAX_TOKENS: 150,
  COTTON_SPAWN_INTERVAL: 3000,
  COTTON_SLOW_DURATION: 2000,
  SPOTLIGHT_PRECISION_DURATION: 3000,
  PANEL_SPEED_BOOST_DURATION: 5000,
  VIGA_FALL_INTERVAL: 4000,
  CURRENT_CHANGE_INTERVAL: 15000,
  VULNERABILITY_WINDOW: 2000,

  // Prólogo — RoboPlankton (inimigo)
  PLANKTON_PROLOGO_HP: 50,
  PROLOGO_ROBO_PROJECTILE_SPEED: 300,
  ROBO_PROLOGO_PROJECTILE_DAMAGE: 1,

  // Patrick
  PATRICK_PROJECTILE_DAMAGE: 1,

  // Lula Molusco
  LULA_NOTE_DAMAGE: 1,
  LULA_NOTE_SPEED: 430,
  LULA_NOTES_PER_BURST: 5,           // GDD: cinco notas em linha reta
  LULA_STATUE_HP: 50,                // 2 acertos de laser destroem
  LULA_STATUE_COUNTDOWN_MS: 3000,    // GDD: explode após 3 segundos
  LULA_STATUE_COOLDOWN_MS: 9000,
  LULA_STATUE_EXPLOSION_RADIUS: 160,
  LULA_STATUE_DAMAGE: 1,
  SPOTLIGHT_WIDTH: 110,
  SPOTLIGHT_TRAVEL_SPEED: 150,       // px/s — GDD: velocidade constante

  // Bob jogável — controles e stats de combate
  BOB_SPEED: 220,
  BOB_JUMP_VELOCITY: 520,
  BOB_MAX_HP: 3,
  BOB_DASH_SPEED: 500,
  BOB_DASH_DURATION: 200,
  BOB_DASH_COOLDOWN: 800,
  BOB_PROJECTILE_DAMAGE: 3,
  BOB_PROJECTILE_SPEED: 550,
  BOB_FIRE_COOLDOWN: 380,

  // Sandy Bochechas
  SANDY_LASER_DAMAGE: 1,
  SANDY_LASER_SPEED: 700,
  SANDY_LASER_COUNT: 4,              // GDD: quatro lasers em sequência
  SANDY_LASER_CHARGE_MS: 1000,       // GDD: carregamento visível de 1s
  SANDY_LASER_GAP_MS: 650,           // intervalo entre lasers da sequência
  SANDY_ROBOT_COOLDOWN_MS: 10000,
  SANDY_ROBOT_DURATION_MS: 3000,     // GDD: persegue por 3 segundos
  SANDY_ROBOT_HP: 50,                // 2 acertos de laser destroem
  SANDY_ROBOT_SPEED: 250,
  ICE_GRENADE_DAMAGE: 1,
  ICE_GRENADE_COOLDOWN_MS: 4500,
  ICE_FREEZE_DURATION_MS: 1000,      // GDD: congela por 1 segundo
  PANEL_HP: 75,                      // 3 acertos de laser destroem
  PANEL_CYCLE_MS: 9000,              // intervalo entre boosts do painel

  // Habilidade Suprema — Âncoras Amaldiçoadas (Holandês Voador)
  ANCHOR_COUNT: 4,
  ANCHOR_WARNING_MS: 600,       // aviso no chão antes da queda
  ANCHOR_STAGGER_MS: 140,       // intervalo entre âncoras (padrão diagonal)
  ANCHOR_DAMAGE_DIRECT: 100,    // dano massivo no impacto direto
  ANCHOR_DAMAGE_SPLASH: 40,     // dano indireto reduzido significativamente (GDD)
  ANCHOR_DIRECT_RADIUS: 90,
  ANCHOR_SPLASH_RADIUS: 200,

  // Game feel — pulo (compartilhado por todos os jogáveis)
  COYOTE_TIME_MS: 100,        // janela pós-borda em que o pulo ainda vale
  JUMP_BUFFER_MS: 130,        // pulo apertado um pouco antes de pousar é executado
  JUMP_CUT_MULTIPLIER: 0.45,  // soltar o botão durante a subida corta a velocidade

  // Plankton jogável — stats de combate
  PLANKTON_SPEED: 200,
  PLANKTON_JUMP_VELOCITY: 480,
  PLANKTON_DASH_SPEED: 520,
  PLANKTON_DASH_DURATION: 180,
  PLANKTON_DASH_COOLDOWN: 700,
  PLANKTON_LASER_DAMAGE: 25,
  PLANKTON_LASER_SPEED: 600,
  PLANKTON_LASER_FIRE_INTERVAL: 350,
} as const;
