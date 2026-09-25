/**
 * player.js — přehrávání animace (časování).
 *
 * Drží aktuální čas a stav přehrávání, každý snímek spočítá stav scény přes
 * phases.stateAtTime a předá ho callbacku `onFrame`. Nekreslí nic sám —
 * o vykreslení se stará ten, kdo Player vytvořil (main.js, později export).
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});

  class Player {
    /**
     * @param {Object} options
     * @param {() => Object} options.getScene   vrací aktuální scénu (může se měnit)
     * @param {(state, timeMs) => void} options.onFrame
     * @param {() => void} [options.onEnd]
     * @param {() => void} [options.onStateChange]  play/pause/stop — pro UI
     */
    constructor(options) {
      this.getScene = options.getScene;
      this.onFrame = options.onFrame;
      this.onEnd = options.onEnd || function () {};
      this.onStateChange = options.onStateChange || function () {};

      this.speed = 1;
      this.loop = false;
      this.time = 0;
      this.playing = false;
      this._raf = null;
      this._lastNow = 0;
      this._tick = this._tick.bind(this);
    }

    duration() {
      return FB.scene.totalDuration(this.getScene());
    }

    play() {
      if (this.playing) return;
      if (this.duration() <= 0) return;           // jedna fáze → není co přehrát
      if (this.time >= this.duration()) this.time = 0;
      this.playing = true;
      this._lastNow = global.performance.now();
      this._raf = global.requestAnimationFrame(this._tick);
      this.onStateChange();
    }

    pause() {
      if (!this.playing) return;
      this.playing = false;
      if (this._raf) global.cancelAnimationFrame(this._raf);
      this._raf = null;
      this.onStateChange();
    }

    stop() {
      this.pause();
      this.time = 0;
      this._emit();
      this.onStateChange();
    }

    toggle() {
      if (this.playing) this.pause();
      else this.play();
    }

    seek(timeMs) {
      this.time = Math.max(0, Math.min(this.duration(), timeMs));
      this._emit();
    }

    /** Stav v aktuálním čase — bez posunu času, např. pro export snímek po snímku. */
    stateAt(timeMs) {
      return FB.phases.stateAtTime(this.getScene(), timeMs);
    }

    _tick(now) {
      if (!this.playing) return;
      const dt = (now - this._lastNow) * this.speed;
      this._lastNow = now;
      this.time += dt;

      const total = this.duration();
      if (this.time >= total) {
        if (this.loop) {
          this.time = this.time % total;
        } else {
          this.time = total;
          this._emit();
          this.playing = false;
          this._raf = null;
          this.onStateChange();
          this.onEnd();
          return;
        }
      }
      this._emit();
      this._raf = global.requestAnimationFrame(this._tick);
    }

    _emit() {
      this.onFrame(this.stateAt(this.time), this.time);
    }
  }

  FB.Player = Player;
})(window);
