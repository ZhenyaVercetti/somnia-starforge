// HUD design system for 1920x1080.
// Sizes follow native asset aspect ratios so chrome is not squashed.

export const HUD = {
  W: 1920,
  H: 1080,
  SAFE: 56,
  GAP: 16,
  COL_GAP: 28,

  // button_base.png is 770x300 (2.567:1)
  BTN_W: 256,
  BTN_H: 100,
  BTN_FONT: '20px',

  // Compact tab / speed control, same aspect
  TAB_W: 180,
  TAB_H: 70,
  SPEED_W: 128,
  SPEED_H: 50,

  // button_start.png is 757x249 (3.04:1)
  START_W: 400,
  START_H: 132,
  START_FONT: '30px',

  // profile_frame.png is 1061x536 (1.98:1)
  PROFILE_W: 440,
  PROFILE_H: 222,

  // Square slots (team 320x322, shop 130x130, equipped 280x280, ai 280x282)
  TEAM: 116,
  SHOP: 108,
  RELIC: 108,
  AI: 80,

  TITLE: '18px',
  BODY: '16px',
  SMALL: '15px',

  color: {
    text: '#eaf6ff',
    accent: '#7ef3ff',
    good: '#6dffc0',
    warn: '#ffe566',
    bad: '#ff7b8a',
    muted: '#9bb0c4'
  }
};

export const PREPARE_LAYOUT = {
  profileX: HUD.SAFE,
  profileY: 28,
  leftX: 244,
  shopY: 338,
  teamCenterX: 930,
  teamStartY: 360,
  relicY: 684,
  aiCenterX: 1640,
  aiStartY: 336,
  startX: 960,
  startY: 988
};
