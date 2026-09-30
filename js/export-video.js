/**
 * export-video.js — export animace do videa přímo v prohlížeči.
 *
 * Dvě cesty, obě kreslí snímky stejně jako přehrávání
 * (phases.stateAtTime + renderer.render), takže tu není duplicitní kreslení:
 *
 * 1. WebCodecs (výchozí pro MP4): H.264 přes VideoEncoder, snímky se kreslí
 *    v pevném kroku (přesné časování, rychleji než v reálném čase, karta
 *    nemusí být vidět) a balí se do klasického MP4 vlastním zapisovačem
 *    (mp4-muxer.js). Tohle MP4 bere WhatsApp, telefony i PowerPoint.
 *
 * 2. MediaRecorder (záloha): canvas.captureStream() → nahrávání v reálném
 *    čase. WebM ve všech prohlížečích, MP4 jen fragmentované (Chrome/Edge),
 *    které WhatsApp odmítá. Používá se pro WebM a když WebCodecs chybí.
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});
  const S = FB.scene;

  const MIME_BY_FORMAT = {
    mp4: [
      'video/mp4;codecs=avc1.4D401F',
      'video/mp4;codecs=avc1.42E01F',
      'video/mp4;codecs=avc1',
      'video/mp4',
    ],
    webm: [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ],
  };

  /** H.264 profily pro WebCodecs: Main 3.1, Baseline 3.1 (1280×720 @ 30). */
  const H264_CODECS = ['avc1.4D401F', 'avc1.42E01F', 'avc1.640028'];

  function hasMediaRecorder() {
    return !!(global.MediaRecorder &&
      global.HTMLCanvasElement &&
      global.HTMLCanvasElement.prototype.captureStream);
  }

  function hasWebCodecs() {
    return typeof global.VideoEncoder !== 'undefined' && typeof global.VideoFrame !== 'undefined';
  }

  function isSupported() {
    return hasMediaRecorder() || hasWebCodecs();
  }

  function firstSupported(list) {
    if (!global.MediaRecorder || !global.MediaRecorder.isTypeSupported) return '';
    return (list || []).find(function (m) {
      return global.MediaRecorder.isTypeSupported(m);
    }) || '';
  }

  /** Formáty, které tento prohlížeč umí: podmnožina ['mp4', 'webm']. */
  function supportedFormats() {
    const out = [];
    if (hasWebCodecs() || firstSupported(MIME_BY_FORMAT.mp4)) out.push('mp4');
    if (firstSupported(MIME_BY_FORMAT.webm)) out.push('webm');
    return out;
  }

  function pickMimeType(format) {
    const order = format === 'webm' ? ['webm', 'mp4'] : ['mp4', 'webm'];
    for (const f of order) {
      const m = firstSupported(MIME_BY_FORMAT[f]);
      if (m) return m;
    }
    return '';
  }

  function extensionFor(mimeType) {
    return /mp4/.test(mimeType || '') ? 'mp4' : 'webm';
  }

  /** Společná příprava: skrytý canvas, renderer a funkce draw(timeMs). */
  function makeDrawer(scene, opts) {
    const width = opts.width || 1280;
    const height = opts.height || 720;
    const canvas = global.document.createElement('canvas');
    const renderer = new FB.CanvasRenderer(canvas, { pixelRatio: 1, view: opts.view });
    renderer.resize(width, height);
    const labelFor = function (obj) { return S.resolvePlayerLabel(scene, obj); };
    return {
      canvas: canvas,
      width: width,
      height: height,
      draw: function (timeMs) {
        const st = FB.phases.stateAtTime(scene, timeMs);
        const from = scene.phases[st.phaseIndex];
        const to = scene.phases[st.phaseIndex + 1];
        renderer.render(st.objects, {
          labelFor: labelFor,
          // šipky pohybu ve videu, když jsou zapnuté (přepínač Dráhy)
          movement: from && to ? { from: from.objects, to: to.objects } : null,
        });
      },
    };
  }

  function timing(scene, opts) {
    const total = S.totalDuration(scene);
    const leadMs = typeof opts.leadMs === 'number' ? opts.leadMs : 400;
    const tailMs = typeof opts.tailMs === 'number' ? opts.tailMs : 800;
    return { total: total, leadMs: leadMs, tailMs: tailMs, full: leadMs + total + tailMs };
  }

  // ---------------------------------------------------------------------------
  // Cesta 1: WebCodecs + vlastní MP4
  // ---------------------------------------------------------------------------

  async function pickH264Config(width, height, fps, bitrate) {
    for (const codec of H264_CODECS) {
      const config = {
        codec: codec,
        width: width,
        height: height,
        bitrate: bitrate,
        framerate: fps,
        avc: { format: 'avc' },          // avcC v decoderConfig.description, NAL s délkami
        latencyMode: 'quality',
      };
      try {
        const res = await global.VideoEncoder.isConfigSupported(config);
        if (res && res.supported) return config;
      } catch (e) { /* zkusit další */ }
    }
    return null;
  }

  function exportWithWebCodecs(scene, opts) {
    return new Promise(function (resolve, reject) {
      (async function () {
        const fps = opts.fps || 30;
        const d = makeDrawer(scene, opts);
        const t = timing(scene, opts);
        const onProgress = opts.onProgress || function () {};
        const config = await pickH264Config(d.width, d.height, fps, opts.bitrate || 5000000);
        if (!config) throw new Error('Prohlížeč neumí kódovat H.264 přes WebCodecs.');

        const frameCount = Math.max(1, Math.ceil(t.full / 1000 * fps));
        const samples = [];
        let avcC = null;
        let cancelled = false;
        let failed = null;

        const encoder = new global.VideoEncoder({
          output: function (chunk, meta) {
            if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcC) {
              avcC = new Uint8Array(meta.decoderConfig.description);
            }
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            samples.push({ data: data, key: chunk.type === 'key', timestamp: chunk.timestamp });
          },
          error: function (e) { failed = e || new Error('Chyba VideoEncoderu'); },
        });
        encoder.configure(config);

        if (opts.onStart) opts.onStart({ cancel: function () { cancelled = true; } });

        const frameUs = Math.round(1000000 / fps);
        const keyEvery = fps * 2;
        for (let i = 0; i < frameCount; i++) {
          if (cancelled) break;
          if (failed) break;
          const timeMs = Math.max(0, Math.min(t.total, i * 1000 / fps - t.leadMs));
          d.draw(timeMs);
          const frame = new global.VideoFrame(d.canvas, { timestamp: i * frameUs, duration: frameUs });
          encoder.encode(frame, { keyFrame: i % keyEvery === 0 });
          frame.close();
          onProgress((i + 1) / frameCount);
          // nenechat frontu enkodéru přetéct a dát prohlížeči nadechnout
          while (encoder.encodeQueueSize > 8 && !failed) {
            await new Promise(function (r) { global.setTimeout(r, 5); });
          }
          if (i % 15 === 0) await new Promise(function (r) { global.setTimeout(r, 0); });
        }

        if (!failed) await encoder.flush();
        try { encoder.close(); } catch (e) { /* už zavřeno */ }

        if (failed) throw failed;
        if (cancelled) throw new Error('Export zrušen');
        if (!avcC) throw new Error('Enkodér nevrátil konfiguraci H.264 (avcC).');

        // Bez B‑framů musí být pořadí monotónní; jinak by MP4 potřebovalo ctts
        samples.sort(function (a, b) { return a.timestamp - b.timestamp; });

        const blob = FB.mp4.mux({
          width: d.width, height: d.height, fps: fps,
          avcC: avcC, samples: samples,
        });
        return {
          blob: blob,
          mimeType: 'video/mp4',
          width: d.width,
          height: d.height,
          durationMs: t.full,
          method: 'webcodecs',
        };
      })().then(resolve, reject);
    });
  }

  // ---------------------------------------------------------------------------
  // Cesta 2: MediaRecorder (reálný čas)
  // ---------------------------------------------------------------------------

  function exportWithMediaRecorder(scene, opts) {
    return new Promise(function (resolve, reject) {
      const fps = opts.fps || 30;
      const d = makeDrawer(scene, opts);
      const t = timing(scene, opts);
      const onProgress = opts.onProgress || function () {};
      d.draw(0);

      const mimeType = opts.mimeType || pickMimeType(opts.format);
      const stream = d.canvas.captureStream(fps);
      let recorder;
      try {
        const recOpts = { videoBitsPerSecond: opts.bitrate || 6000000 };
        if (mimeType) recOpts.mimeType = mimeType;
        recorder = new global.MediaRecorder(stream, recOpts);
      } catch (e) {
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        reject(e);
        return;
      }

      const chunks = [];
      let cancelled = false;
      let failed = null;

      recorder.ondataavailable = function (ev) {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onerror = function (ev) {
        failed = (ev && ev.error) || new Error('Chyba MediaRecorderu');
      };
      recorder.onstop = function () {
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        if (failed) { reject(failed); return; }
        if (cancelled) { reject(new Error('Export zrušen')); return; }
        const type = recorder.mimeType || mimeType || 'video/webm';
        resolve({
          blob: new Blob(chunks, { type: type }),
          mimeType: type,
          width: d.width,
          height: d.height,
          durationMs: t.full,
          method: 'mediarecorder',
        });
      };

      if (opts.onStart) opts.onStart({ cancel: function () { cancelled = true; } });

      recorder.start(200);
      const startedAt = global.performance.now();

      function frame(now) {
        if (cancelled || failed) {
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        const elapsed = now - startedAt;
        d.draw(Math.max(0, Math.min(t.total, elapsed - t.leadMs)));
        onProgress(Math.min(1, elapsed / t.full));
        if (elapsed >= t.full) {
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        global.requestAnimationFrame(frame);
      }
      global.requestAnimationFrame(frame);
    });
  }

  // ---------------------------------------------------------------------------

  /**
   * Spustí export. Vrací Promise s { blob, mimeType, width, height, durationMs, method }.
   *
   * @param {Object} scene
   * @param {Object} [options]
   * @param {'mp4'|'webm'} [options.format='mp4']
   * @param {number} [options.width=1280]
   * @param {number} [options.height=720]
   * @param {number} [options.fps=30]
   * @param {number} [options.leadMs=400]   klid na začátku
   * @param {number} [options.tailMs=800]   klid na konci
   * @param {number} [options.bitrate]
   * @param {Object} [options.view]         zobrazovací volby rendereru (hole, směr)
   * @param {(progress: number) => void} [options.onProgress]
   * @param {(handle: { cancel: () => void }) => void} [options.onStart]
   */
  function exportVideo(scene, options) {
    const opts = options || {};
    if (!isSupported()) {
      return Promise.reject(new Error('Prohlížeč nepodporuje nahrávání videa.'));
    }
    if (S.totalDuration(scene) <= 0) {
      return Promise.reject(new Error('Animace potřebuje alespoň dvě fáze.'));
    }
    const format = opts.format === 'webm' ? 'webm' : 'mp4';
    if (format === 'mp4' && hasWebCodecs() && FB.mp4) {
      return exportWithWebCodecs(scene, opts).catch(function (e) {
        // WebCodecs selhalo (např. chybí H.264): zkusit MediaRecorder, pokud je
        if (!hasMediaRecorder() || /zrušen/.test(String(e && e.message))) throw e;
        console.warn('export: WebCodecs selhalo, používám MediaRecorder', e);
        return exportWithMediaRecorder(scene, opts);
      });
    }
    if (!hasMediaRecorder()) {
      return Promise.reject(new Error('Prohlížeč neumí nahrát ' + format.toUpperCase() + '.'));
    }
    return exportWithMediaRecorder(scene, opts);
  }

  FB.exportVideo = {
    isSupported: isSupported,
    hasWebCodecs: hasWebCodecs,
    supportedFormats: supportedFormats,
    pickMimeType: pickMimeType,
    extensionFor: extensionFor,
    exportVideo: exportVideo,
  };
})(window);
