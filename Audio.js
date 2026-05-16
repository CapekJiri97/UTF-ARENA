import { player } from './main.js';
import { camera } from './State.js';

let audioCtx = null;

export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// ── Spatial helpers ───────────────────────────────────────────────────────────

function getSpatial(pos) {
    if (!pos) return { volumeMult: 1.0, panVal: 0.0 };
    let lx = 0, ly = 0;
    if (player && player.alive) {
        lx = player.pos.x; ly = player.pos.y;
    } else {
        const viewW = window.innerWidth / camera.scale;
        const viewH = window.innerHeight / camera.scale;
        lx = camera.x + viewW / 2;
        ly = camera.y + viewH / 2;
    }
    const dx = pos.x - lx;
    const dy = pos.y - ly;
    const d = Math.hypot(dx, dy);
    const maxDist = 500;
    if (d > maxDist) return null;
    const volumeMult = Math.pow(Math.max(0, 1 - d / maxDist), 1.5);
    const panVal = Math.max(-1, Math.min(1, dx / (window.innerWidth / camera.scale / 2)));
    return { volumeMult, panVal };
}

function makeChain(ctx) {
    const gain = ctx.createGain();
    let panner = null;
    if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        gain.connect(panner);
        panner.connect(ctx.destination);
    } else {
        gain.connect(ctx.destination);
    }
    return { gain, panner };
}

function connectOsc(osc, gain) {
    osc.connect(gain);
}

function applyPan(panner, val) {
    if (panner) panner.pan.value = val;
}

// ── Zvukové profily dle role/dmgType ─────────────────────────────────────────
//
// Melee TANK/FIGHTER physical → hluboký, těžký úder
// Melee TANK magical         → temný rezonující hum
// Melee SLAYER physical      → ostrý, rychlý sekač
// Melee SLAYER magical       → energetický švih
// Ranged physical            → střední prásk
// Ranged magical/MAGE        → vysoký magický ping
// SUPPORT magical/physical   → jemný, tichý click

const ATTACK_PROFILES = {
    tank_physical:    { baseFreq: 80,  endFreq: 30,  dur: 0.18, oscType: 'sawtooth', gain: 0.18, pitchRand: 0.08 },
    tank_magical:     { baseFreq: 60,  endFreq: 25,  dur: 0.22, oscType: 'sine',     gain: 0.15, pitchRand: 0.06 },
    fighter_physical: { baseFreq: 150, endFreq: 55,  dur: 0.13, oscType: 'sawtooth', gain: 0.14, pitchRand: 0.10 },
    fighter_magical:  { baseFreq: 110, endFreq: 40,  dur: 0.15, oscType: 'triangle', gain: 0.12, pitchRand: 0.10 },
    slayer_physical:  { baseFreq: 280, endFreq: 100, dur: 0.10, oscType: 'square',   gain: 0.10, pitchRand: 0.12 },
    slayer_magical:   { baseFreq: 420, endFreq: 160, dur: 0.10, oscType: 'triangle', gain: 0.10, pitchRand: 0.12 },
    splitpusher_phys: { baseFreq: 200, endFreq: 70,  dur: 0.12, oscType: 'sawtooth', gain: 0.11, pitchRand: 0.10 },
    splitpusher_mag:  { baseFreq: 350, endFreq: 130, dur: 0.12, oscType: 'triangle', gain: 0.10, pitchRand: 0.10 },
    ranged_physical:  { baseFreq: 340, endFreq: 130, dur: 0.09, oscType: 'square',   gain: 0.08, pitchRand: 0.14 },
    ranged_magical:   { baseFreq: 680, endFreq: 300, dur: 0.09, oscType: 'sine',     gain: 0.08, pitchRand: 0.14 },
    mage_magical:     { baseFreq: 900, endFreq: 420, dur: 0.08, oscType: 'sine',     gain: 0.07, pitchRand: 0.16 },
    support_physical: { baseFreq: 300, endFreq: 120, dur: 0.08, oscType: 'triangle', gain: 0.06, pitchRand: 0.12 },
    support_magical:  { baseFreq: 550, endFreq: 260, dur: 0.08, oscType: 'sine',     gain: 0.06, pitchRand: 0.14 },
    default:          { baseFreq: 800, endFreq: 300, dur: 0.10, oscType: 'square',   gain: 0.05, pitchRand: 0.15 },
};

function getAttackProfile(opts) {
    const role = (opts.role || '').toLowerCase();
    const dmg  = (opts.dmgType || 'physical').toLowerCase();
    const ranged = !!opts.ranged;

    if (role === 'tank'        && !ranged && dmg === 'physical') return ATTACK_PROFILES.tank_physical;
    if (role === 'tank'        && !ranged && dmg === 'magical')  return ATTACK_PROFILES.tank_magical;
    if (role === 'fighter'     && !ranged && dmg === 'physical') return ATTACK_PROFILES.fighter_physical;
    if (role === 'fighter'     && !ranged && dmg === 'magical')  return ATTACK_PROFILES.fighter_magical;
    if (role === 'slayer'      && !ranged && dmg === 'physical') return ATTACK_PROFILES.slayer_physical;
    if (role === 'slayer'      && !ranged && dmg === 'magical')  return ATTACK_PROFILES.slayer_magical;
    if (role === 'slayer'      &&  ranged && dmg === 'physical') return ATTACK_PROFILES.ranged_physical;
    if (role === 'slayer'      &&  ranged && dmg === 'magical')  return ATTACK_PROFILES.ranged_magical;
    if (role === 'splitpusher' && dmg === 'physical')            return ATTACK_PROFILES.splitpusher_phys;
    if (role === 'splitpusher' && dmg === 'magical')             return ATTACK_PROFILES.splitpusher_mag;
    if (role === 'mage')                                         return ATTACK_PROFILES.mage_magical;
    if (role === 'support' && dmg === 'physical')                return ATTACK_PROFILES.support_physical;
    if (role === 'support' && dmg === 'magical')                 return ATTACK_PROFILES.support_magical;
    if (ranged && dmg === 'magical')                             return ATTACK_PROFILES.ranged_magical;
    if (ranged)                                                  return ATTACK_PROFILES.ranged_physical;
    return ATTACK_PROFILES.default;
}

// ── TTS nexus warnings ────────────────────────────────────────────────────────

const _ttsSpoken = { 0: {}, 1: {} }; // { teamIdx: { '250': bool, '100': bool } }

export function speakNexusWarning(team, hp) {
    if (typeof speechSynthesis === 'undefined') return;
    const key = hp <= 100 ? '100' : hp <= 250 ? '250' : null;
    if (!key) return;
    if (_ttsSpoken[team][key]) return;
    _ttsSpoken[team][key] = true;

    const teamName = team === 0 ? 'Blue' : 'Red';
    const msg = new SpeechSynthesisUtterance(
        `${teamName} nexus at ${key} HP!`
    );
    msg.lang   = 'en-US';
    msg.volume = 1.0;
    msg.rate   = 1.1;
    msg.pitch  = team === 0 ? 1.2 : 0.85;
    speechSynthesis.speak(msg);
}

export function resetNexusWarnings() {
    _ttsSpoken[0] = {}; _ttsSpoken[1] = {};
}

// ── Hlavní funkce ─────────────────────────────────────────────────────────────

export function playSound(type, pos = null, opts = {}) {
    if (window._simSoundMuted) return;
    if (!audioCtx || audioCtx.state === 'suspended') return;

    const spatial = getSpatial(pos);
    if (spatial === null) return;
    const { volumeMult, panVal } = spatial;

    const now = audioCtx.currentTime;
    const { gain, panner } = makeChain(audioCtx);
    applyPan(panner, panVal);

    // ── attack: variabilní dle role/dmgType/ranged ────────────────────────────
    if (type === 'attack') {
        const prof = getAttackProfile(opts);
        const pitch = (opts.pitch || 1.0) * (1.0 + (Math.random() - 0.5) * prof.pitchRand);
        const osc = audioCtx.createOscillator();
        osc.type = prof.oscType;
        osc.frequency.setValueAtTime(prof.baseFreq * pitch, now);
        osc.frequency.exponentialRampToValueAtTime(prof.endFreq * pitch, now + prof.dur);
        gain.gain.setValueAtTime(prof.gain * volumeMult, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + prof.dur);
        connectOsc(osc, gain);
        osc.start(now); osc.stop(now + prof.dur);

        // Tank: přidej druhý hluboký sub-bass layer
        if (opts.role === 'TANK' || opts.role === 'tank') {
            const sub = audioCtx.createOscillator();
            const subGain = audioCtx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(40 * pitch, now);
            sub.frequency.exponentialRampToValueAtTime(15 * pitch, now + prof.dur * 1.4);
            subGain.gain.setValueAtTime(prof.gain * 0.6 * volumeMult, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + prof.dur * 1.4);
            sub.connect(subGain); subGain.connect(audioCtx.destination);
            sub.start(now); sub.stop(now + prof.dur * 1.4);
        }
        return;
    }

    // ── shoot (staré volání — zachováno pro zpětnou kompatibilitu) ────────────
    if (type === 'shoot') {
        const pitch = (opts.pitch || 1.0) * (1.0 + (Math.random() - 0.5) * 0.15);
        const osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800 * pitch, now);
        osc.frequency.exponentialRampToValueAtTime(300 * pitch, now + 0.1);
        gain.gain.setValueAtTime(0.05 * volumeMult, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        connectOsc(osc, gain);
        osc.start(now); osc.stop(now + 0.1);
        return;
    }

    // ── hit ───────────────────────────────────────────────────────────────────
    if (type === 'hit') {
        const pitch = (opts.pitch || 1.0) * (1.0 + (Math.random() - 0.5) * 0.18);
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200 * pitch, now);
        osc.frequency.exponentialRampToValueAtTime(50 * pitch, now + 0.1);
        gain.gain.setValueAtTime(0.10 * volumeMult, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        connectOsc(osc, gain);
        osc.start(now); osc.stop(now + 0.1);
        return;
    }

    // ── capture_tower: fanfáre trojzvuk stoupá ────────────────────────────────
    if (type === 'capture_tower') {
        const teamPitch = opts.team === 0 ? 1.0 : 0.88;
        const notes = [440, 554, 740, 880];
        notes.forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'triangle';
            const t0 = now + i * 0.10;
            o.frequency.setValueAtTime(freq * teamPitch, t0);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.13 * volumeMult, t0 + 0.04);
            g.gain.linearRampToValueAtTime(0.001, t0 + 0.18);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(t0); o.stop(t0 + 0.20);
        });
        return;
    }

    // ── lose_tower: klesající trojzvuk ───────────────────────────────────────
    if (type === 'lose_tower') {
        const notes = [440, 330, 220];
        notes.forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'sawtooth';
            const t0 = now + i * 0.10;
            o.frequency.setValueAtTime(freq, t0);
            g.gain.setValueAtTime(0.10 * volumeMult, t0);
            g.gain.linearRampToValueAtTime(0.001, t0 + 0.18);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(t0); o.stop(t0 + 0.20);
        });
        return;
    }

    // ── heal_pickup: rychlý pozitivní ping ───────────────────────────────────
    if (type === 'heal_pickup') {
        const freqs = [523, 659, 784]; // C5 E5 G5
        freqs.forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'sine';
            const t0 = now + i * 0.07;
            o.frequency.setValueAtTime(freq, t0);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.12 * volumeMult, t0 + 0.03);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(t0); o.stop(t0 + 0.20);
        });
        return;
    }

    // ── levelup ───────────────────────────────────────────────────────────────
    if (type === 'levelup') {
        const pitch = (opts.pitch || 1.0) * (1.0 + (Math.random() - 0.5) * 0.08);
        const osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440 * pitch, now);
        osc.frequency.setValueAtTime(554 * pitch, now + 0.10);
        osc.frequency.setValueAtTime(659 * pitch, now + 0.20);
        osc.frequency.setValueAtTime(880 * pitch, now + 0.30);
        gain.gain.setValueAtTime(0.05 * volumeMult, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
        connectOsc(osc, gain);
        osc.start(now); osc.stop(now + 0.5);
        return;
    }

    // ── kill ──────────────────────────────────────────────────────────────────
    if (type === 'kill') {
        const pitch = (opts.pitch || 1.0) * (1.0 + (Math.random() - 0.5) * 0.10);
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150 * pitch, now);
        osc.frequency.exponentialRampToValueAtTime(20 * pitch, now + 0.4);
        gain.gain.setValueAtTime(0.15 * volumeMult, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        connectOsc(osc, gain);
        osc.start(now); osc.stop(now + 0.4);
        return;
    }

    // ── capture (původní generický fallback) ─────────────────────────────────
    if (type === 'capture') {
        const pitch = (opts.pitch || 1.0) * (1.0 + (Math.random() - 0.5) * 0.15);
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400 * pitch, now);
        osc.frequency.linearRampToValueAtTime(600 * pitch, now + 0.1);
        osc.frequency.linearRampToValueAtTime(800 * pitch, now + 0.2);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.10 * volumeMult, now + 0.1);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
        connectOsc(osc, gain);
        osc.start(now); osc.stop(now + 0.5);
        return;
    }
}
