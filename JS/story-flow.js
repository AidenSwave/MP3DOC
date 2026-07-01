(function () {
  "use strict";

  var modules = setup.newFormatModules = setup.newFormatModules || {};

setup.clearNewFormatFlow = function () {
      setup.newFormatFlowTimers.forEach(function (timer) {
        clearTimeout(timer);
      });

      setup.newFormatFlowTimers = [];
      modules.stopNewFormatDialogueAudio();
      setup.newFormatAudioEffects = setup.newFormatAudioEffects.filter(function (audio) {
        if (audio.newFormatContinueAcrossPassages && !audio.ended) {
          return true;
        }

        audio.onended = null;
        audio.onerror = null;
        if (audio.newFormatFadeFrame) {
          cancelAnimationFrame(audio.newFormatFadeFrame);
          audio.newFormatFadeFrame = null;
        }
        if (audio.newFormatBufferSource) {
          try {
            audio.newFormatBufferSource.stop();
          } catch (error) {}
          audio.newFormatBufferSource = null;
          audio.newFormatEffectNodes = null;
        }
        audio.pause();
        audio.volume = 1;
        audio.newFormatInUse = false;
        return false;
      });

      if (window.cancelAnimationFrame) {
        setup.newFormatAnimationFrames.forEach(function (frameId) {
          window.cancelAnimationFrame(frameId);
        });
      }
      setup.newFormatAnimationFrames = [];
      setup.newFormatRuntime = {};

      if (setup.newFormatDialogueTypingEvent) {
        $(document).off(setup.newFormatDialogueTypingEvent);
        setup.newFormatDialogueTypingEvent = "";
      }
    };

    modules.clearNewFormatDialogueVisual = function clearNewFormatDialogueVisual($flow) {
      var $stage = $flow.find(".new-format-stage");

      $flow.find(".new-format-runtime").empty();
      $stage.find(".new-format-character-stage:not(.is-persistent-character)").remove();
      $stage.find(".new-format-scene").removeAttr("hidden");
      $stage.find(".new-format-character-stage.is-persistent-character").removeAttr("hidden");
      $stage.removeClass("shot-solo shot-wide shot-closeup");
    };

    modules.setNewFormatStoryVariable = function setNewFormatStoryVariable(name, value) {
      if (!State.variables) {
        State.variables = {};
      }

      State.variables[name] = value;
    };

    modules.applyNewFormatVariableStep = function applyNewFormatVariableStep(step) {
      var current = modules.storyVariable(step.name);
      var value = step.value;
      var operator = step.operator;
      var numericCurrent;
      var numericValue;

      if (operator === "+" || operator === "-") {
        numericCurrent = Number(current || 0);
        numericValue = Number(value || 0);
        modules.setNewFormatStoryVariable(
          step.name,
          (isFinite(numericCurrent) ? numericCurrent : 0) +
            (operator === "-" ? -1 : 1) *
            (isFinite(numericValue) ? numericValue : 0)
        );
        return;
      }

      modules.setNewFormatStoryVariable(step.name, value);
    };

    modules.evaluateNewFormatCondition = function evaluateNewFormatCondition(condition) {
      if (!condition) {
        return true;
      }

      var left = modules.storyVariable(condition.name);
      var right = condition.value;
      var leftNumber = Number(left);
      var rightNumber = Number(right);
      var compareAsNumbers = isFinite(leftNumber) && isFinite(rightNumber) &&
        left !== "" && right !== "";

      if (compareAsNumbers) {
        left = leftNumber;
        right = rightNumber;
      }

      return condition.operator === ">" ? left > right : left < right;
    };

    modules.runNextNewFormatStep = function runNextNewFormatStep(id) {
      var runtime = setup.newFormatRuntime[id];

      if (!runtime || runtime.index >= runtime.steps.length) {
        return;
      }

      var step = runtime.steps[runtime.index++];

      if (step.condition && !modules.evaluateNewFormatCondition(step.condition)) {
        modules.runNextNewFormatStep(id);
        return;
      }

      if (step.type === "variable") {
        modules.applyNewFormatVariableStep(step);
        modules.runNextNewFormatStep(id);
        return;
      }

      var $flow = runtime.$flow;
      var leavesDialogue = runtime.dialogueVisible && !runtime.persistentDialogue &&
        ["scenes", "sequence", "video"].includes(step.type);
      var fadeTarget = ["dialogue", "scenes", "sequence", "video", "cutToBlack"]
        .includes(step.type);
      var skipFade = Boolean(runtime.skipNextFade && fadeTarget);

      if (step.type === "noFade") {
        runtime.skipNextFade = true;
        modules.runNextNewFormatStep(id);
        return;
      }

      if (skipFade) {
        runtime.skipNextFade = false;
      }

      var currentDialogueShot = runtime.currentDialogue && runtime.currentDialogue.shot
        ? (modules.newFormatShot("[" + runtime.currentDialogue.shot + "]") || runtime.currentDialogue.shot)
        : "";
      var shouldFadeLeavingDialogue = currentDialogueShot === "closeup" || currentDialogueShot === "solo";

      if (leavesDialogue && !skipFade && shouldFadeLeavingDialogue) {
        runtime.index--;
        runtime.dialogueVisible = false;

        modules.transitionNewFormatThroughBlack($flow, function () {
          runtime.currentDialogue = null;
          modules.clearNewFormatDialogueVisual($flow);
          return modules.runNextNewFormatStep(id);
        });
        return;
      }

      if (leavesDialogue && (skipFade || !shouldFadeLeavingDialogue)) {
        runtime.dialogueVisible = false;
        runtime.currentDialogue = null;
        modules.clearNewFormatDialogueVisual($flow);
      }

      if (["scenes", "sequence", "video", "cutToBlack"].includes(step.type)) {
        runtime.currentDialogue = null;
      }

      if (step.type === "goto") {
        Engine.play(step.target);
        return;
      }

      if (step.type === "delay") {
        modules.queueNewFormatFlowTimer(function () {
          modules.runNextNewFormatStep(id);
        }, step.duration);
        return;
      }

      if (step.type === "fadeIn") {
        modules.fadeInNewFormatScene($flow, step.duration);
        modules.runNextNewFormatStep(id);
        return;
      }

      if (step.type === "blurOut") {
        modules.blurOutNewFormatScene($flow, step.duration, function () {
          modules.runNextNewFormatStep(id);
        });
        return;
      }

      if (step.type === "audio") {
        if (step.offset > 0) {
          modules.queueNewFormatAudioTimer(step, function () { modules.playNewFormatAudio(step); }, step.offset);
        } else {
          modules.playNewFormatAudio(step);
        }
        modules.runNextNewFormatStep(id);
        return;
      }

      if (step.type === "scenes") {
        if (!step.assets.length) {
          modules.runNextNewFormatStep(id);
          return;
        }

        function showSceneAt(index) {
          var asset = step.assets[index];
          var sceneScale = step.scales ? step.scales[index] : 100;
          var reveal = step.reveals ? step.reveals[index] : false;
          var revealDuration = step.revealDurations
            ? step.revealDurations[index]
            : 0;
          var startBlack = step.startsBlack ? step.startsBlack[index] : false;

          function continueScenes() {
            if (index < step.assets.length - 1) {
              modules.queueNewFormatFlowTimer(function () {
                showSceneAt(index + 1);
              }, setup.newFormatSceneDelay);
            } else {
              modules.queueNewFormatFlowTimer(function () {
                modules.runNextNewFormatStep(id);
              }, 50);
            }
          }

          modules.showNewFormatScene($flow, asset, sceneScale, reveal, startBlack);

          if (reveal) {
            modules.revealNewFormatScene($flow, continueScenes, revealDuration);
          } else {
            continueScenes();
          }
        }

        showSceneAt(0);
        return;
      }

      if (step.type === "addCharacter") {
        modules.applyNewFormatAddedCharacter(runtime, step);
        modules.runNextNewFormatStep(id);
        return;
      }

      if (step.type === "dialogue") {
        modules.playNewFormatDialogue(id, step, function () {
          modules.runNextNewFormatStep(id);
        }, skipFade);
        return;
      }

      if (step.type === "choices") {
        modules.showNewFormatChoices($flow, id, step.choices);
        return;
      }

      if (step.type === "video") {
        if (!runtime.persistentDialogue) {
          runtime.dialogueVisible = false;
          $flow.find(".new-format-runtime").empty().append(
            '<div class="new-format-sequence-loading">Loading video...</div>'
          );
        }
        $flow.find(".new-format-character-stage:not(.is-persistent-character)").remove();
        $flow.find(".new-format-sequence-frame:not(.new-format-video-frame)").remove();
        $flow.find(".new-format-scene").attr("hidden", "hidden");
        $flow.find(".new-format-stage").removeClass("shot-solo shot-wide shot-closeup");

        return setup.loadNewFormatVideo(step.stage, step.name).then(function (frames) {
          if (setup.newFormatRuntime[id] !== runtime) {
            return;
          }

          if (!runtime.persistentDialogue) {
            $flow.find(".new-format-runtime").empty();
          }

          modules.playNewFormatVideoFrames(id, runtime, $flow, frames, step.name);
        }).catch(function (error) {
          console.warn(error);
          $flow.find(".new-format-runtime").html(
            '<div class="new-format-asset-error">' + modules.escapeHtml(error.message || String(error)) + '</div>'
          );
        });
      }

      if (step.type === "cutToBlack") {
        runtime.persistentDialogue = false;
        modules.cutNewFormatToBlack($flow);
        modules.runNextNewFormatStep(id);
        return;
      }

      if (step.type === "sequence") {
        if (!runtime.persistentDialogue) {
          $flow.find(".new-format-runtime").empty().append(
            '<div class="new-format-sequence-loading">Loading sequence...</div>'
          );
        }

        return setup.loadNewFormatSequence(step.stage, step.name).then(function (frames) {
          if (setup.newFormatRuntime[id] !== runtime) {
            return;
          }

          if (!runtime.persistentDialogue) {
            $flow.find(".new-format-runtime").empty();
          }
          frames.forEach(function (frame, index) {
            if (index === 0) {
              modules.showNewFormatSequenceFrame($flow, frame, step.name);
              return;
            }

            modules.queueNewFormatFlowTimer(function () {
              modules.showNewFormatSequenceFrame($flow, frame, step.name);
            }, setup.newFormatSequenceFrameDelay * index);
          });

          modules.queueNewFormatFlowTimer(function () {
            modules.runNextNewFormatStep(id);
          }, setup.newFormatSequenceFrameDelay * frames.length);
        }).catch(function (error) {
          console.warn(error);
          $flow.find(".new-format-runtime").html(
            '<div class="new-format-asset-error">' + modules.escapeHtml(error.message || String(error)) + '</div>'
          );
          modules.runNextNewFormatStep(id);
        });
      }

    };

    setup.prepareNewFormatPassage = function (id) {
      var passage = setup.newFormatPassages[id];
      var $flow = $("#" + id);

      if (!passage || !$flow.length) {
        return;
      }

      var syntaxErrors = modules.validateNewFormatSyntax(passage.source, passage.parsed);
      var stages = modules.newFormatReferencedStages(passage.parsed);

      if (!stages.length) {
        modules.renderNewFormatErrors($flow, syntaxErrors, []);
        return;
      }

      Promise.all(stages.map(function (stage) {
        return setup.prepareNewFormatStage(stage);
      })).then(function (registries) {
        if (!document.documentElement.contains($flow.get(0)) ||
            setup.newFormatPassages[id] !== passage) {
          return;
        }

        var errors = syntaxErrors.concat(
          modules.validateNewFormatAssets(passage.parsed, registries)
        );

        if (errors.length) {
          modules.renderNewFormatErrors($flow, errors, registries);
          return;
        }

        var openingAsset = modules.newFormatAssetPath(
          passage.parsed.stage,
          "Scenes",
          passage.parsed.scene
        );
        var openingRegistry = registries.find(function (registry) {
          return registry.stage.toLowerCase() === passage.parsed.stage.toLowerCase();
        });
        var openingPath = openingRegistry
          ? modules.newFormatAssetMatch(openingRegistry.paths, openingAsset)
          : "";
        var $scene = $flow.find(".new-format-scene");

        if (openingPath && $scene.length) {
          $scene.attr({
            src: modules.githubRawAssetUrl(openingPath),
            "data-new-format-asset": openingAsset,
            "data-new-format-state": "loaded",
            alt: openingAsset
          }).removeAttr("data-new-format-pending-asset aria-busy")
            .removeClass("is-loading is-error");
        }

        passage.ready = true;
        $flow.find(".new-format-prestage").remove();
        $flow.find(".new-format-stage").removeAttr("hidden");

        if (passage.autoStart) {
          setup.startNewFormatPassage(id);
        }
      }).catch(function (error) {
        if (!document.documentElement.contains($flow.get(0))) {
          return;
        }

        modules.renderNewFormatErrors($flow, [{
          message: error.message || String(error)
        }], []);
      });
    };

    setup.startNewFormatPassage = function (id) {
      var passage = setup.newFormatPassages[id];
      var $flow = $("#" + id);

      if (!passage || !passage.ready || !$flow.length) {
        return;
      }

      $flow.find(".new-format-options").remove();
      setup.newFormatRuntime[id] = {
        $flow: $flow,
        steps: passage.steps,
        index: 0
      };
      delete setup.newFormatPassages[id];
      modules.runNextNewFormatStep(id);
    };
}());
