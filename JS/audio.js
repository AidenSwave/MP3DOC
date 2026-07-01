(function () {
  "use strict";

  var modules = setup.newFormatModules = setup.newFormatModules || {};

modules.newFormatSilentAudioUrl = function newFormatSilentAudioUrl() {
      if (setup.newFormatSilentAudioUrl) {
        return setup.newFormatSilentAudioUrl;
      }

      var samples = 160;
      var buffer = new ArrayBuffer(44 + samples * 2);
      var view = new DataView(buffer);

      function writeText(offset, text) {
        for (var i = 0; i < text.length; i++) {
          view.setUint8(offset + i, text.charCodeAt(i));
        }
      }

      writeText(0, "RIFF");
      view.setUint32(4, 36 + samples * 2, true);
      writeText(8, "WAVEfmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, 8000, true);
      view.setUint32(28, 16000, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeText(36, "data");
      view.setUint32(40, samples * 2, true);
      setup.newFormatSilentAudioUrl = URL.createObjectURL(
        new Blob([buffer], { type: "audio/wav" })
      );
      return setup.newFormatSilentAudioUrl;
    };

    setup.unlockNewFormatAudio = function () {
      if (setup.newFormatAudioUnlocked) {
        return;
      }

      setup.newFormatAudioUnlocked = true;
      var silentUrl = modules.newFormatSilentAudioUrl();

      setup.newFormatDialogueAudioPlayers.concat(setup.newFormatAudioEffectPlayers)
        .forEach(function (audio) {
          audio.volume = 0;
          audio.src = silentUrl;
          var playResult = audio.play();

          if (playResult && typeof playResult.then === "function") {
            playResult.then(function () {
              if (audio.src === silentUrl) {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 1;
              }
            }).catch(function () {
              audio.volume = 1;
            });
          }
        });
    };

    ["pointerdown", "touchend", "keydown"].forEach(function (eventName) {
      document.addEventListener(eventName, setup.unlockNewFormatAudio, {
        capture: true,
        once: true
      });
    });


    modules.playNewFormatAudio = function playNewFormatAudio(step) {
      var audio = setup.newFormatAudioEffectPlayers.find(function (player) {
        return !player.newFormatInUse;
      }) || new Audio();
      var effectDuration = Math.max(step.fadeDuration || 0, step.lowpassDuration || 0);
      var audioContext;
      var nodes;

      function newFormatAudioFadeInCurve() {
        var curve = new Float32Array(128);

        for (var i = 0; i < curve.length; i++) {
          var progress = i / (curve.length - 1);
          curve[i] = Math.sin(progress * Math.PI / 2);
        }
        return curve;
      }

      function prepareAudioEffects() {
        var AudioContext = window.AudioContext || window.webkitAudioContext;

        if (!effectDuration || !AudioContext) {
          return null;
        }
        try {
          setup.newFormatAudioContext = setup.newFormatAudioContext || new AudioContext();
          audioContext = setup.newFormatAudioContext;

          if (!audio.newFormatAudioNodes) {
            var source = audioContext.createMediaElementSource(audio);
            var filter = audioContext.createBiquadFilter();
            var gain = audioContext.createGain();

            filter.type = "lowpass";
            source.connect(filter);
            filter.connect(gain);
            gain.connect(audioContext.destination);
            audio.newFormatAudioNodes = { source: source, filter: filter, gain: gain };
          }
          nodes = audio.newFormatAudioNodes;
          return nodes;
        } catch (error) {
          console.warn("Audio effects are unavailable; playing the sound normally.", error);
          return null;
        }
      }

      function startAudioEffects() {
        var now;

        if (!nodes || !audioContext) {
          if (step.fadeDuration) {
            var startedAt = Date.now();
            function fadeVolume() {
              var progress = Math.min(1, (Date.now() - startedAt) / step.fadeDuration);
              audio.volume = Math.sin(progress * Math.PI / 2);
              if (progress < 1 && audio.newFormatInUse) {
                audio.newFormatFadeFrame = requestAnimationFrame(fadeVolume);
              }
            }
            audio.newFormatFadeFrame = requestAnimationFrame(fadeVolume);
          }
          return;
        }

        if (audioContext.state === "suspended") {
          audioContext.resume().catch(function () {});
        }
        now = audioContext.currentTime;
        nodes.gain.gain.cancelScheduledValues(now);
        nodes.filter.frequency.cancelScheduledValues(now);
        nodes.gain.gain.setValueAtTime(step.fadeDuration ? 0.0001 : 1, now);
        nodes.filter.frequency.setValueAtTime(step.lowpassDuration ? 80 : 22000, now);

        if (step.fadeDuration) {
          nodes.gain.gain.setValueCurveAtTime(
            newFormatAudioFadeInCurve(),
            now,
            step.fadeDuration / 1000
          );
        }
        if (step.lowpassDuration) {
          nodes.filter.frequency.exponentialRampToValueAtTime(
            22000,
            now + step.lowpassDuration / 1000
          );
        }
      }

      function removeAudio() {
        if (audio.newFormatFadeFrame) {
          cancelAnimationFrame(audio.newFormatFadeFrame);
          audio.newFormatFadeFrame = null;
        }
        audio.volume = 1;
        audio.newFormatInUse = false;
        setup.newFormatAudioEffects = setup.newFormatAudioEffects.filter(function (item) {
          return item !== audio;
        });
      }

      if (effectDuration && (window.AudioContext || window.webkitAudioContext)) {
        var BufferAudioContext = window.AudioContext || window.webkitAudioContext;
        var context = setup.newFormatAudioContext || new BufferAudioContext();

        setup.newFormatAudioContext = context;
        audio.pause();
        audio.currentTime = 0;
        audio.newFormatInUse = true;
        audio.newFormatContinueAcrossPassages = Boolean(step.continueAcrossPassages);
        setup.newFormatAudioEffects.push(audio);

        Promise.resolve(context.resume()).then(function () {
          return fetch(step.url, { cache: "force-cache" });
        }).then(function (response) {
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }
          return response.arrayBuffer();
        }).then(function (data) {
          return context.decodeAudioData(data);
        }).then(function (buffer) {
          var source;
          var filter;
          var gain;
          var now;

          if (!audio.newFormatInUse) {
            return;
          }
          source = context.createBufferSource();
          filter = context.createBiquadFilter();
          gain = context.createGain();
          now = context.currentTime;

          source.buffer = buffer;
          filter.type = "lowpass";
          filter.Q.setValueAtTime(0.7, now);
          filter.frequency.setValueAtTime(step.lowpassDuration ? 80 : 22000, now);
          gain.gain.setValueAtTime(step.fadeDuration ? 0.0001 : 1, now);

          if (step.lowpassDuration) {
            filter.frequency.exponentialRampToValueAtTime(
              22000,
              now + step.lowpassDuration / 1000
            );
          }
          if (step.fadeDuration) {
            gain.gain.setValueCurveAtTime(
              newFormatAudioFadeInCurve(),
              now,
              step.fadeDuration / 1000
            );
          }

          source.connect(filter);
          filter.connect(gain);
          gain.connect(context.destination);
          source.onended = removeAudio;
          audio.newFormatBufferSource = source;
          audio.newFormatEffectNodes = { filter: filter, gain: gain };
          source.start(now);
        }).catch(function (error) {
          console.warn("Could not process audio effects for " + step.name, error);
          removeAudio();
        });
        return;
      }

      audio.newFormatInUse = true;
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audio.volume = step.fadeDuration ? 0 : 1;
      audio.src = step.url;
      audio.load();
      prepareAudioEffects();
      audio.newFormatContinueAcrossPassages = Boolean(step.continueAcrossPassages);
      audio.onended = removeAudio;
      audio.onerror = function () {
        console.warn("Could not play audio " + step.name);
        removeAudio();
      };
      setup.newFormatAudioEffects.push(audio);

      var playResult = audio.play();
      startAudioEffects();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(function (error) {
          console.warn("Audio playback was blocked:", error);
          removeAudio();
        });
      }
    };
}());
