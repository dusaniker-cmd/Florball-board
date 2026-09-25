/**
 * mp4-muxer.js — minimální zápis klasického (nefragmentovaného) MP4 souboru
 * s jednou H.264 video stopou, bez zvuku.
 *
 * Proč vlastní: MediaRecorder v Chromu ukládá fragmentované MP4 (moof),
 * které WhatsApp a některé přehrávače odmítají. Tady vzniká "obyčejné" MP4
 * s tabulkami vzorků v moov (ftyp + moov + mdat, moov na začátku = fast start),
 * jaké vyrábí ffmpeg nebo telefon.
 *
 * Vstup: pole zakódovaných snímků z WebCodecs (VideoEncoder) a
 * AVCDecoderConfigurationRecord (decoderConfig.description).
 * Předpoklad: snímky bez B‑framů (pořadí dekódování = pořadí zobrazení),
 * což platí pro výstup VideoEncoderu s avc.format = 'avc' v Chromu.
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});

  // ---------------------------------------------------------------------------
  // Zápis binárních struktur
  // ---------------------------------------------------------------------------

  function u8(arr) { return new Uint8Array(arr); }

  function u16(v) { return u8([(v >>> 8) & 255, v & 255]); }

  function u32(v) { return u8([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]); }

  function ascii(s) {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
    return out;
  }

  function zeros(n) { return new Uint8Array(n); }

  function concat(parts) {
    let len = 0;
    parts.forEach(function (p) { len += p.length; });
    const out = new Uint8Array(len);
    let off = 0;
    parts.forEach(function (p) { out.set(p, off); off += p.length; });
    return out;
  }

  /** box: size(4) + type(4) + obsah */
  function box(type) {
    const payload = concat(Array.prototype.slice.call(arguments, 1));
    return concat([u32(8 + payload.length), ascii(type), payload]);
  }

  /** full box: box + version(1) + flags(3) */
  function fullBox(type, version, flags) {
    const payload = concat(Array.prototype.slice.call(arguments, 3));
    return box(type, u8([version, (flags >>> 16) & 255, (flags >>> 8) & 255, flags & 255]), payload);
  }

  const UNITY_MATRIX = concat([
    u32(0x00010000), u32(0), u32(0),
    u32(0), u32(0x00010000), u32(0),
    u32(0), u32(0), u32(0x40000000),
  ]);

  // ---------------------------------------------------------------------------
  // Boxy
  // ---------------------------------------------------------------------------

  function ftyp() {
    return box('ftyp', ascii('isom'), u32(0x200), ascii('isom'), ascii('iso2'), ascii('avc1'), ascii('mp41'));
  }

  function mvhd(timescale, duration) {
    return fullBox('mvhd', 0, 0,
      u32(0), u32(0),                 // creation, modification time
      u32(timescale), u32(duration),
      u32(0x00010000),                // rate 1.0
      u16(0x0100),                    // volume 1.0
      zeros(2), zeros(8),             // reserved
      UNITY_MATRIX,
      zeros(24),                      // pre_defined
      u32(2)                          // next_track_ID
    );
  }

  function tkhd(duration, width, height) {
    return fullBox('tkhd', 0, 0x000003,   // enabled + in movie
      u32(0), u32(0),                 // creation, modification
      u32(1),                         // track_ID
      zeros(4),
      u32(duration),
      zeros(8),
      u16(0), u16(0),                 // layer, alternate_group
      u16(0), zeros(2),               // volume (video = 0), reserved
      UNITY_MATRIX,
      u32(width << 16), u32(height << 16)
    );
  }

  function mdhd(timescale, duration) {
    return fullBox('mdhd', 0, 0,
      u32(0), u32(0),
      u32(timescale), u32(duration),
      u16(0x55c4),                    // language 'und'
      u16(0)
    );
  }

  function hdlr() {
    return fullBox('hdlr', 0, 0,
      zeros(4), ascii('vide'), zeros(12), ascii('VideoHandler'), u8([0])
    );
  }

  function vmhd() {
    return fullBox('vmhd', 0, 1, u16(0), zeros(6));
  }

  function dinf() {
    const url = fullBox('url ', 0, 1);   // self-contained
    return box('dinf', fullBox('dref', 0, 0, u32(1), url));
  }

  function avc1(width, height, avcCRecord) {
    const compressor = zeros(32);        // compressorname (prázdné)
    const entry = box('avc1',
      zeros(6), u16(1),                 // reserved, data_reference_index
      zeros(16),                        // pre_defined + reserved
      u16(width), u16(height),
      u32(0x00480000), u32(0x00480000), // 72 dpi
      zeros(4),
      u16(1),                           // frame_count
      compressor,
      u16(0x0018),                      // depth
      u16(0xffff),                      // pre_defined = -1
      box('avcC', avcCRecord)
    );
    return fullBox('stsd', 0, 0, u32(1), entry);
  }

  function stts(sampleCount, sampleDelta) {
    return fullBox('stts', 0, 0, u32(1), u32(sampleCount), u32(sampleDelta));
  }

  function stss(keyIndexes) {
    const parts = [u32(keyIndexes.length)];
    keyIndexes.forEach(function (i) { parts.push(u32(i)); });
    return fullBox('stss', 0, 0, concat(parts));
  }

  function stsc(sampleCount) {
    return fullBox('stsc', 0, 0, u32(1), u32(1), u32(sampleCount), u32(1));
  }

  function stsz(sizes) {
    const parts = [u32(0), u32(sizes.length)];
    sizes.forEach(function (s) { parts.push(u32(s)); });
    return fullBox('stsz', 0, 0, concat(parts));
  }

  function stco(chunkOffset) {
    return fullBox('stco', 0, 0, u32(1), u32(chunkOffset));
  }

  // ---------------------------------------------------------------------------
  // Sestavení souboru
  // ---------------------------------------------------------------------------

  /**
   * @param {Object} opts
   * @param {number} opts.width
   * @param {number} opts.height
   * @param {number} opts.fps
   * @param {Uint8Array} opts.avcC            AVCDecoderConfigurationRecord
   * @param {{ data: Uint8Array, key: boolean }[]} opts.samples  v pořadí zobrazení
   * @returns {Blob} video/mp4
   */
  function mux(opts) {
    const fps = opts.fps || 30;
    const timescale = 90000;
    const delta = Math.round(timescale / fps);
    const samples = opts.samples || [];
    const n = samples.length;
    if (n === 0) throw new Error('mp4: žádné snímky');
    if (!opts.avcC || !opts.avcC.length) throw new Error('mp4: chybí avcC (decoderConfig.description)');
    const duration = n * delta;

    const sizes = samples.map(function (s) { return s.data.length; });
    const keys = [];
    samples.forEach(function (s, i) { if (s.key) keys.push(i + 1); });
    if (keys.length === 0) keys.push(1);

    function buildMoov(chunkOffset) {
      const stbl = box('stbl',
        avc1(opts.width, opts.height, opts.avcC),
        stts(n, delta),
        stss(keys),
        stsc(n),
        stsz(sizes),
        stco(chunkOffset)
      );
      const minf = box('minf', vmhd(), dinf(), stbl);
      const mdia = box('mdia', mdhd(timescale, duration), hdlr(), minf);
      const trak = box('trak', tkhd(duration, opts.width, opts.height), mdia);
      return box('moov', mvhd(timescale, duration), trak);
    }

    const head = ftyp();
    // moov před mdat (fast start); délka moov nezávisí na hodnotě offsetu
    const moovLen = buildMoov(0).length;
    const chunkOffset = head.length + moovLen + 8;   // + hlavička mdat
    const moov = buildMoov(chunkOffset);

    const mdatPayloadLen = sizes.reduce(function (a, b) { return a + b; }, 0);
    const mdatHeader = concat([u32(8 + mdatPayloadLen), ascii('mdat')]);

    const parts = [head, moov, mdatHeader];
    samples.forEach(function (s) { parts.push(s.data); });
    return new Blob(parts, { type: 'video/mp4' });
  }

  FB.mp4 = { mux: mux };
})(window);
