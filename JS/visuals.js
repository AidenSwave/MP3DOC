(function () {
  "use strict";

  var modules = setup.newFormatModules = setup.newFormatModules || {};

modules.preparedNewFormatAssetUrl = function preparedNewFormatAssetUrl(reference) {
      var requestedKey = modules.assetKey(reference);
      var keys = Object.keys(setup.newFormatPreparedAssetUrls);
      var match = keys.find(function (key) {
        return key === requestedKey || key.endsWith("/" + requestedKey);
      });

      return match ? setup.newFormatPreparedAssetUrls[match] : "";
    };

    modules.setNewFormatImage = function setNewFormatImage($image, reference) {
      var cleanReference = modules.cleanAssetPath(reference);
      var preparedUrl = modules.preparedNewFormatAssetUrl(cleanReference);

      if (!cleanReference || !$image.length) {
        return;
      }

      if (preparedUrl) {
        $image.attr({
          src: preparedUrl,
          "data-new-format-asset": cleanReference,
          "data-new-format-state": "loaded",
          alt: cleanReference
        }).removeAttr("aria-busy")
          .removeClass("is-loading is-error");
        return;
      }

      $image
        .removeAttr("data-new-format-state")
        .removeClass("is-error")
        .addClass("is-loading")
        .attr({
          "data-new-format-asset": cleanReference,
          "alt": "Loading asset: " + cleanReference,
          "aria-busy": "true"
        });

      setup.hydrateNewFormatImages($image.get(0));
    };

    modules.showNewFormatScene = function showNewFormatScene($flow, reference, scale, reveal, startBlack) {
      var $stage = $flow.find(".new-format-stage");
      var $scene = $stage.find(".new-format-scene");
      var sceneScale = Number(scale || 100);

      if (!$scene.length) {
        $scene = $('<img class="new-format-scene is-loading" aria-busy="true">');
        $stage.prepend($scene);
      }

      $stage
        .removeClass("shot-solo shot-wide shot-closeup is-cut-to-black")
        .removeAttr("data-new-format-shot")
        .attr({
          "data-new-format-scene-path": modules.cleanAssetPath(reference),
          "data-new-format-scene-scale": sceneScale
        });
      $stage.find(".new-format-character-stage:not(.is-persistent-character), .new-format-sequence-frame").remove();
      $stage.find(".new-format-character-stage.is-persistent-character").removeAttr("hidden");
      $scene.removeAttr("hidden").css({
        transition: "none",
        transform: "scale(" + (sceneScale / 100) + ")",
        filter: "none",
        opacity: reveal ? 0 : 1,
        willChange: "transform"
      });
      modules.setNewFormatImage($scene, reference);
      if (startBlack) {
        $stage.find(".new-format-black-fade")
          .css("transition", "none")
          .addClass("is-active");
      }
    };

    modules.fadeInNewFormatScene = function fadeInNewFormatScene($flow, requestedDuration) {
      var $overlay = $flow.find(".new-format-black-fade");
      var duration = Number(requestedDuration);

      $overlay.addClass("is-active").css("transition", "none");
      if ($overlay.get(0)) {
        $overlay.get(0).offsetWidth;
      }
      $overlay.css(
        "transition",
        "opacity " + duration + "ms ease"
      );

      modules.queueNewFormatAnimationFrame(function () {
        $overlay.removeClass("is-active");
      });
      modules.queueNewFormatFlowTimer(function () {
        $overlay.css("transition", "");
      }, duration);
    };

    modules.blurOutNewFormatScene = function blurOutNewFormatScene($flow, requestedDuration, complete) {
      var $scene = $flow.find(".new-format-stage .new-format-scene");
      var duration = Number(requestedDuration);
      var blurAmount = Number(setup.newFormatSceneBlurAmount || 18);

      if (!$scene.length) {
        if (typeof complete === "function") {
          complete();
        }
        return;
      }

      $scene.css({
        transition: "none",
        filter: "blur(" + blurAmount + "px)",
        willChange: "filter"
      });
      if ($scene.get(0)) {
        $scene.get(0).offsetWidth;
      }

      modules.queueNewFormatAnimationFrame(function () {
        $scene.css({
          transition: "filter " + duration + "ms linear",
          filter: "blur(0px)"
        });
      });

      modules.queueNewFormatFlowTimer(function () {
        $scene.css({
          transition: "",
          filter: ""
        });
        if (typeof complete === "function") {
          complete();
        }
      }, duration);
    };

    modules.revealNewFormatScene = function revealNewFormatScene($flow, complete, requestedDuration) {
      var $stage = $flow.find(".new-format-stage");
      var $scene = $stage.find(".new-format-scene");
      var startScale = Number($stage.attr("data-new-format-scene-scale") || 100);
      var endScale = startScale * (1 + setup.newFormatRevealZoomAmount / 100);
      var defaultDuration = setup.newFormatRevealZoomDuration +
        setup.newFormatRevealFadeDuration;
      var motionDuration = Number(requestedDuration || defaultDuration);
      var durationRatio = motionDuration / defaultDuration;
      var fadeDuration = setup.newFormatRevealFadeDuration * durationRatio;
      var zoomDuration = motionDuration - fadeDuration;
      var motionLead = setup.newFormatRevealMotionLead * durationRatio;

      if (!$scene.length) {
        complete();
        return;
      }

      $scene.css({
        transition: "none",
        opacity: 0,
        transform: "scale(" + (startScale / 100) + ")",
        willChange: "opacity, transform"
      });
      if ($scene.get(0)) {
        $scene.get(0).offsetWidth;
      }

      modules.queueNewFormatAnimationFrame(function () {
        $scene.css({
          transition: "transform " + motionDuration + "ms linear, opacity " +
            fadeDuration + "ms linear",
          transform: "scale(" + (endScale / 100) + ")"
        });
        $stage.attr("data-new-format-scene-scale", endScale);
      });

      modules.queueNewFormatFlowTimer(function () {
        $scene.css("opacity", 1);
      }, motionLead);

      modules.queueNewFormatFlowTimer(function () {
        $scene.css("opacity", 0);
      }, zoomDuration);

      modules.queueNewFormatFlowTimer(complete, motionDuration);
    };

    modules.newFormatCharacterAsset = function newFormatCharacterAsset(stage, speaker, filename) {
      return modules.newFormatAssetPath(
        stage,
        "Characters",
        modules.cleanAssetPath([speaker, filename].filter(Boolean).join("/"))
      );
    };

    modules.newFormatFullBodyAsset = function newFormatFullBodyAsset(stage, speaker) {
      return modules.newFormatCharacterAsset(stage, speaker, "FullBody.png");
    };

    modules.newFormatSoloAsset = function newFormatSoloAsset(stage, speaker) {
      return modules.newFormatAssetPath(stage, "Characters", speaker + ".png");
    };

    modules.newFormatCloseupAsset = function newFormatCloseupAsset(stage, speaker) {
      return modules.newFormatCharacterAsset(stage, speaker, "CloseUp.png");
    };

    modules.newFormatCharacterKey = function newFormatCharacterKey(stage, speaker) {
      return modules.newFormatComparableName(modules.cleanAssetPath(stage)) + "::" +
        modules.newFormatComparableName(speaker);
    };

    modules.upsertNewFormatCharacter = function upsertNewFormatCharacter($flow, character, persistent) {
      var $stage = $flow.find(".new-format-stage");
      var key = modules.newFormatCharacterKey(character.stage, character.speaker);
      var transform = modules.normalizeCharacterTransform(character.transform);
      var selector = '.new-format-character-stage[data-new-format-character-key="' +
        key.replace(/"/g, '\\"') + '"]';
      var $characterStage = $stage.find(selector).first();
      var $character;

      if (!$characterStage.length) {
        $characterStage = $('<div class="new-format-character-stage"></div>')
          .attr("data-new-format-character-key", key);
        $character = $('<img class="new-format-character new-format-character-wide is-loading" aria-busy="true">');
        $characterStage.append($character);
        $stage.prepend($characterStage);
      } else {
        $character = $characterStage.find("img.new-format-character").first();
      }

      if (persistent) {
        $characterStage.addClass("is-persistent-character");
      }

      $characterStage.css({
        "--character-x": transform.x + "px",
        "--character-y": transform.y + "px",
        "--character-scale": transform.scale / 100,
        "transition": "none",
        "transform": modules.newFormatCharacterTransformCss(transform)
      }).removeAttr("hidden");

      $character
        .removeClass("new-format-character-solo new-format-character-closeup")
        .addClass("new-format-character-wide");
      modules.setNewFormatImage($character, modules.newFormatFullBodyAsset(character.stage, character.speaker));

      return $characterStage;
    };

    modules.applyNewFormatAddedCharacter = function applyNewFormatAddedCharacter(runtime, step) {
      var key = modules.newFormatCharacterKey(step.stage, step.speaker);
      var character = {
        stage: step.stage,
        speaker: step.speaker,
        transform: modules.normalizeCharacterTransform(step.transform)
      };

      runtime.characters = runtime.characters || {};
      runtime.characterOrder = runtime.characterOrder || [];
      if (!runtime.characters[key]) {
        runtime.characterOrder.push(key);
      }
      runtime.characters[key] = character;
      modules.upsertNewFormatCharacter(runtime.$flow, character, true);
    };

    modules.newFormatRuntimeCharacters = function newFormatRuntimeCharacters(runtime) {
      runtime.characters = runtime.characters || {};
      runtime.characterOrder = runtime.characterOrder || [];

      return runtime.characterOrder.map(function (key) {
        return runtime.characters[key];
      }).filter(Boolean);
    };


    modules.showNewFormatSequenceFrame = function showNewFormatSequenceFrame($flow, frame, sequence) {
      var $stage = $flow.find(".new-format-stage");
      var $frame = $stage.find(".new-format-sequence-frame");

      $stage.find(".new-format-character-stage:not(.is-persistent-character)").remove();
      $stage.find(".new-format-scene").attr("hidden", "hidden");
      $stage
        .removeClass("shot-solo shot-wide shot-closeup is-cut-to-black")
        .removeAttr("data-new-format-shot");

      if (!$frame.length) {
        $frame = $('<img class="new-format-sequence-frame" alt="">');
        $stage.prepend($frame);
      }

      $frame.attr({
        src: frame.url,
        alt: sequence + " frame " + frame.number
      });
      setup.preloadImage(frame.url);
    };

    modules.prepareNewFormatVideoFrames = function prepareNewFormatVideoFrames($flow, frames, video) {
      var $stage = $flow.find(".new-format-stage");
      var fragment = document.createDocumentFragment();

      $stage.removeClass("is-cut-to-black");
      $stage.find(".new-format-sequence-frame").remove();

      frames.forEach(function (frame, index) {
        var image = document.createElement("img");

        image.className = "new-format-sequence-frame new-format-video-frame";
        image.src = frame.url;
        image.alt = video + " frame " + String(frame.number).padStart(2, "0");
        image.setAttribute("data-new-format-video-index", index);
        image.setAttribute("aria-hidden", "true");
        fragment.appendChild(image);
      });

      $stage.prepend(fragment);
    };

    modules.showNewFormatVideoFrame = function showNewFormatVideoFrame($flow, index) {
      var $frames = $flow.find(".new-format-video-frame");

      $frames.removeClass("is-active").attr("aria-hidden", "true");
      $frames.eq(index).addClass("is-active").attr("aria-hidden", "false");
      $flow.find(".new-format-black-fade").removeClass("is-active");
    };

    modules.queueNewFormatAnimationFrame = function queueNewFormatAnimationFrame(callback) {
      if (window.requestAnimationFrame) {
        var frameId = window.requestAnimationFrame(callback);
        setup.newFormatAnimationFrames.push(frameId);
        return frameId;
      }

      return modules.queueNewFormatFlowTimer(function () {
        callback(Date.now());
      }, 1000 / 60);
    };

    modules.playNewFormatVideoFrames = function playNewFormatVideoFrames(id, runtime, $flow, frames, video) {
      var frameDuration = setup.newFormatVideoFrameDelay;
      var startedAt = window.performance && typeof window.performance.now === "function"
        ? window.performance.now()
        : Date.now();
      var displayedIndex = 0;
      var nextFrameAt = startedAt + frameDuration;

      modules.prepareNewFormatVideoFrames($flow, frames, video);
      modules.showNewFormatVideoFrame($flow, 0);

      function drawFrame(now) {
        if (setup.newFormatRuntime[id] !== runtime) {
          return;
        }

        if (now >= nextFrameAt) {
          if (displayedIndex >= frames.length - 1) {
            modules.runNextNewFormatStep(id);
            return;
          }

          displayedIndex++;
          modules.showNewFormatVideoFrame($flow, displayedIndex);
          nextFrameAt += frameDuration;

          if (now > nextFrameAt) {
            nextFrameAt = now + frameDuration;
          }
        }

        modules.queueNewFormatAnimationFrame(drawFrame);
      }

      modules.queueNewFormatAnimationFrame(drawFrame);
    };

    modules.cutNewFormatToBlack = function cutNewFormatToBlack($flow) {
      var $stage = $flow.find(".new-format-stage");
      var $content = $stage.find(".new-format-content");

      $stage
        .addClass("is-cut-to-black")
        .removeClass("shot-solo shot-wide shot-closeup")
        .removeAttr("data-new-format-shot data-new-format-scene-path");
      $stage.children().not(".new-format-content").remove();
      $content.empty().append('<div class="new-format-runtime"></div>');
    };

    modules.queueNewFormatFlowTimer = function queueNewFormatFlowTimer(callback, delay) {
      var timer = setTimeout(callback, delay);
      setup.newFormatFlowTimers.push(timer);
      return timer;
    };

    modules.queueNewFormatAudioTimer = function queueNewFormatAudioTimer(step, callback, delay) {
      return step.continueAcrossPassages
        ? setTimeout(callback, delay)
        : modules.queueNewFormatFlowTimer(callback, delay);
    };

    modules.waitForNewFormatVisibleImages = function waitForNewFormatVisibleImages($flow) {
      var waits = [];

      $flow.find(".new-format-stage img").each(function () {
        var image = this;

        if (image.hidden || $(image).css("display") === "none" || !image.src) {
          return;
        }

        waits.push(new Promise(function (resolve) {
          function decoded() {
            if (typeof image.decode === "function") {
              image.decode().then(resolve, resolve);
            } else {
              resolve();
            }
          }

          if (image.complete) {
            decoded();
            return;
          }

          $(image).one("load error", decoded);
        }));
      });

      return Promise.all(waits);
    };

    modules.transitionNewFormatThroughBlack = function transitionNewFormatThroughBlack($flow, swap, complete) {
      var $stage = $flow.find(".new-format-stage");
      var $overlay = $stage.find(".new-format-black-fade");

      if (!$overlay.length) {
        $overlay = $('<div class="new-format-black-fade" aria-hidden="true"></div>');
        $stage.append($overlay);
      }

      $overlay.removeClass("is-active");
      if ($overlay.get(0)) {
        $overlay.get(0).offsetWidth;
      }
      $overlay.addClass("is-active");

      modules.queueNewFormatFlowTimer(function () {
        var swapResult = typeof swap === "function" ? swap() : null;

        Promise.resolve(swapResult).then(function () {
          return modules.waitForNewFormatVisibleImages($flow);
        }).catch(function (error) {
          console.warn("New-format transition readiness warning:", error);
        }).then(function () {
          if ($overlay.get(0)) {
            $overlay.get(0).offsetWidth;
          }
          $overlay.removeClass("is-active");

          modules.queueNewFormatFlowTimer(function () {
            if (typeof complete === "function") {
              complete();
            }
          }, setup.newFormatFadeDuration);
        });
      }, setup.newFormatFadeDuration);
    };
}());
