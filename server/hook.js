'use strict';

/**
 * hook.js — child process ที่รัน global keyboard hook อย่างเดียว
 *
 * แยกออกมาเป็น process ต่างหากเพราะ: ถ้าไม่ได้สิทธิ์ Accessibility (macOS)
 * uiohook จะเรียก abort() ระดับ native ทำให้ process ตายทั้ง process
 * (catch ใน JS ไม่ได้) การแยกมาไว้ที่นี่ทำให้ตัว static/WebSocket server หลัก
 * ยังทำงานต่อได้ และ parent จะ respawn ตัวนี้ใหม่เมื่อผู้ใช้ให้สิทธิ์แล้ว
 *
 * ส่ง event กลับ parent ผ่าน process.send: { type: 'down'|'up', keycode }
 */

const { uIOhook } = require('uiohook-napi');

// กัน key repeat: broadcast "down" ครั้งเดียวต่อการกด 1 ที
const pressed = new Set();

uIOhook.on('keydown', (e) => {
  if (pressed.has(e.keycode)) return;
  pressed.add(e.keycode);
  if (process.send) process.send({ type: 'down', keycode: e.keycode });
});

uIOhook.on('keyup', (e) => {
  pressed.delete(e.keycode);
  if (process.send) process.send({ type: 'up', keycode: e.keycode });
});

uIOhook.start();
if (process.send) process.send({ type: 'ready' });
