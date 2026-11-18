// VERTEX CITY — sound. Everything is synthesized with WebAudio: rain
// ambience, a low synthwave bass pulse, engine hum, gunshots, sirens,
// grapple zips and cash chimes. No audio files, no network.
(function () {
  VC.createAudio = function () {
    var ctx = null;
    var master = null;
    var engineOsc = null, engineGain = null;
    var muted = false;

    function ensure() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume();
        return;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      startRain();
      startBass();
    }

    function noiseBuffer(seconds) {
      var buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    }

    function startRain() {
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer(2);
      src.loop = true;
      var filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 1400;
      filt.Q.value = 0.4;
      var g = ctx.createGain();
      g.gain.value = 0.05;
      src.connect(filt); filt.connect(g); g.connect(master);
      src.start();
      // Slow swell so the rain breathes.
      var lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      var lg = ctx.createGain();
      lg.gain.value = 0.02;
      lfo.connect(lg); lg.connect(g.gain);
      lfo.start();
    }

    function startBass() {
      // Four-note synthwave pulse loop, scheduled ahead.
      var notes = [55, 55, 65.41, 49];
      var step = 0;
      function schedule() {
        if (!ctx) return;
        var t = ctx.currentTime + 0.05;
        var osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = notes[step % notes.length];
        var filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 320;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.11, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(filt); filt.connect(g); g.connect(master);
        osc.start(t);
        osc.stop(t + 0.55);
        step++;
        setTimeout(schedule, 500);
      }
      schedule();
    }

    function blip(freq, dur, type, vol, slideTo) {
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    }

    function noiseBurst(dur, vol, freq) {
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer(dur);
      var filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = freq || 3000;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filt); filt.connect(g); g.connect(master);
      src.start(t);
    }

    return {
      unlock: ensure,
      toggleMute: function () {
        muted = !muted;
        if (master) master.gain.value = muted ? 0 : 0.5;
        return muted;
      },
      shoot: function () { noiseBurst(0.12, 0.4, 2500); blip(180, 0.08, 'square', 0.15, 60); },
      grapple: function () { blip(300, 0.35, 'sine', 0.25, 1200); },
      crash: function () { noiseBurst(0.3, 0.5, 800); },
      pickup: function () { blip(880, 0.12, 'sine', 0.25); setTimeout(function () { blip(1318, 0.18, 'sine', 0.25); }, 110); },
      missionDone: function () {
        [523, 659, 784, 1046].forEach(function (f, i) {
          setTimeout(function () { blip(f, 0.25, 'triangle', 0.28); }, i * 130);
        });
      },
      fail: function () { blip(220, 0.5, 'sawtooth', 0.2, 110); },
      siren: function () { blip(700, 0.4, 'sine', 0.08, 950); },
      engineStart: function () { blip(90, 0.4, 'sawtooth', 0.2, 160); },
      setEngine: function (on, speedNorm) {
        if (!ctx) return;
        if (on && !engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = ctx.createGain();
          engineGain.gain.value = 0.04;
          var filt = ctx.createBiquadFilter();
          filt.type = 'lowpass';
          filt.frequency.value = 500;
          engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
          engineOsc.start();
        }
        if (!on && engineOsc) {
          try { engineOsc.stop(); } catch (e) {}
          engineOsc = null; engineGain = null;
          return;
        }
        if (engineOsc) {
          engineOsc.frequency.value = 60 + speedNorm * 140;
          engineGain.gain.value = 0.03 + speedNorm * 0.05;
        }
      },
    };
  };
})();
