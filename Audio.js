import { player } from './main.js';
import { camera } from './State.js';

let audioCtx = null;

// Prohlížeče blokují zvuk, dokud hráč neklikne na obrazovku nebo nezmáčkne klávesu.
export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

export function playSound(type, pos = null, opts = {}) {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    
    let volumeMult = 1.0;
    let panVal = 0.0;

    // Výpočet vzdálenosti a prostorového sterea (Panning)
    if (pos) {
        let lx = 0, ly = 0;
        if (player && player.alive) {
            lx = player.pos.x; ly = player.pos.y;
        } else {
            let viewW = window.innerWidth / camera.scale;
            let viewH = window.innerHeight / camera.scale;
            lx = camera.x + viewW/2;
            ly = camera.y + viewH/2;
        }
        let dx = pos.x - lx;
        let dy = pos.y - ly;
        let d = Math.hypot(dx, dy);

        let maxDist = 1400; // Maximální vzdálenost, na kterou je zvuk ještě slyšet
        if (d > maxDist) return; 

        volumeMult = Math.max(0, 1 - (d / maxDist));
        volumeMult = Math.pow(volumeMult, 1.5); // Nelineární pohlcování zvuku do dálky (přirozenější)
        panVal = Math.max(-1, Math.min(1, dx / (window.innerWidth / camera.scale / 2))); // Stereo left/right
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    let finalPitch = (opts.pitch || 1.0) * (1.0 + (Math.random() - 0.5) * 0.15); // +/- 7.5% náhodná odchylka proti monotónnosti
    const now = audioCtx.currentTime;

    let panner = null;
    if (audioCtx.createStereoPanner) {
        panner = audioCtx.createStereoPanner();
        panner.pan.value = panVal;
        osc.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(audioCtx.destination);
    } else {
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    }

    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800 * finalPitch, now);
        osc.frequency.exponentialRampToValueAtTime(300 * finalPitch, now + 0.1);
        gainNode.gain.setValueAtTime(0.05 * volumeMult, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200 * finalPitch, now);
        osc.frequency.exponentialRampToValueAtTime(50 * finalPitch, now + 0.1);
        gainNode.gain.setValueAtTime(0.1 * volumeMult, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'capture') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400 * finalPitch, now);
        osc.frequency.linearRampToValueAtTime(600 * finalPitch, now + 0.1);
        osc.frequency.linearRampToValueAtTime(800 * finalPitch, now + 0.2);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1 * volumeMult, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'levelup') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440 * finalPitch, now);
        osc.frequency.setValueAtTime(554 * finalPitch, now + 0.1);
        osc.frequency.setValueAtTime(659 * finalPitch, now + 0.2);
        osc.frequency.setValueAtTime(880 * finalPitch, now + 0.3);
        gainNode.gain.setValueAtTime(0.05 * volumeMult, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'kill') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150 * finalPitch, now);
        osc.frequency.exponentialRampToValueAtTime(20 * finalPitch, now + 0.4);
        gainNode.gain.setValueAtTime(0.15 * volumeMult, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    }
}