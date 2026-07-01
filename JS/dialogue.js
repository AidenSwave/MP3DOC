(function () {
  "use strict";

  var modules = setup.newFormatModules = setup.newFormatModules || {};

modules.showNewFormatDialogue = function showNewFormatDialogue($flow, step) {
      var $stage = $flow.find(".new-format-stage");
      var $scene = $stage.find(".new-format-scene");
      var $runtime = $flow.find(".new-format-runtime");
      var runtime = Object.keys(setup.newFormatRuntime || {}).map(function (id) {
        return setup.newFormatRuntime[id];
      }).find(function (candidate) {
        return candidate && candidate.$flow && candidate.$flow.get(0) === $flow.get(0);
      }) || {};
      var shot = modules.newFormatShot("[" + step.shot + "]") || "wide";
      var closeupView = shot === "closeup" || shot === "solo";
      var cardClass = "dialogue-card" + (shot === "wide" ? " dialogue-card-wide" : "");
      var nameOutput = '<div class="dialogue-name">' +
        modules.escapeHtml(step.speaker) + '</div>';
      var speakerKey = modules.newFormatCharacterKey(step.stage, step.speaker);
      var speakerCharacter = runtime.characters && runtime.characters[speakerKey]
        ? runtime.characters[speakerKey]
        : {
            stage: step.stage,
            speaker: step.speaker,
            transform: modules.defaultCharacterTransform()
          };
      var speakerTransform = modules.normalizeCharacterTransform(speakerCharacter.transform);
      var sceneScale = Number($stage.attr("data-new-format-scene-scale") || 100);
      var baseSceneScale = (isFinite(sceneScale) && sceneScale > 0 ? sceneScale : 100) / 100;
      var closeupBackgroundScale = baseSceneScale * 2.35;
      var backgroundFocus = modules.newFormatCloseupBackgroundFocus(speakerTransform, {
        width: $stage.innerWidth(),
        height: $stage.innerHeight()
      });
      var backgroundPanX = backgroundFocus.x;
      var backgroundPanY = backgroundFocus.y;
      var cardStyle = shot === "wide"
        ? ' style="--speaker-x:' + speakerTransform.x + 'px;--speaker-y:' + speakerTransform.y + 'px;"'
        : "";

      $stage.find(".new-format-character-stage:not(.is-persistent-character)").remove();
      $stage
        .removeClass("shot-solo shot-wide shot-closeup is-cut-to-black")
        .addClass("shot-" + shot)
        .attr("data-new-format-shot", shot);

      if (shot === "solo") {
        $scene.attr("hidden", "hidden");
      } else {
        $scene.removeAttr("hidden");
      }

      if (shot === "closeup") {
        $scene.css({
          filter: "blur(1.55px)",
          transform: "translate3d(" + backgroundPanX.toFixed(2) + "px, " + backgroundPanY.toFixed(2) + "px, 0) scale(" + closeupBackgroundScale + ")",
          transformOrigin: backgroundFocus.originX.toFixed(2) + "% " + backgroundFocus.originY.toFixed(2) + "%",
          willChange: "transform, filter"
        });
      } else if (shot === "wide") {
        $scene.css({
          filter: "none",
          transform: "scale(" + baseSceneScale + ")",
          transformOrigin: "50% 50%",
          willChange: "transform"
        });
      }

      modules.newFormatRuntimeCharacters(runtime).forEach(function (character) {
        modules.upsertNewFormatCharacter($flow, character, true);
      });

      if (closeupView) {
        $stage.find(".new-format-character-stage.is-persistent-character").attr("hidden", "hidden");

        var $characterStage = $('<div class="new-format-character-stage is-dialogue-focus-character"></div>');
        var $character = $('<img class="new-format-character is-loading" aria-busy="true">')
          .addClass("new-format-character-" + shot);
        $characterStage.append($character);
        $stage.prepend($characterStage);
        modules.setNewFormatImage($character,
          shot === "solo"
            ? modules.newFormatSoloAsset(step.stage, step.speaker)
            : modules.newFormatCloseupAsset(step.stage, step.speaker)
        );
      } else {
        $stage.find(".new-format-character-stage.is-persistent-character").removeAttr("hidden");
        modules.upsertNewFormatCharacter($flow, speakerCharacter, Boolean(runtime.characters && runtime.characters[speakerKey]));
      }

      $runtime.html(
        '<div class="new-format-dialogue-view new-format-dialogue-' + shot + '">' +
        '<div class="' + cardClass + '"' + cardStyle + '>' +
        (closeupView ? "" : nameOutput) +
        '<div class="dialogue-line"></div></div>' +
        (closeupView ? nameOutput : "") +
        '</div>'
      );

      return $runtime.find(".dialogue-line");
    };

    modules.stopNewFormatDialogueAudio = function stopNewFormatDialogueAudio() {
      setup.newFormatDialogueAudioPlayers.forEach(function (audio) {
        if (audio.newFormatOverlapTimer) {
          clearTimeout(audio.newFormatOverlapTimer);
        }
        audio.newFormatOverlapTimer = null;
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        audio.onloadedmetadata = null;
        audio.pause();
      });
      };

    modules.playNewFormatDialogue = function playNewFormatDialogue(id, step, complete, skipFade) {
      var runtime = setup.newFormatRuntime[id];
      var $line;
      var lineIndex = 0;
      var previousDialogue = runtime.currentDialogue;
      var continuesDialogueContext = previousDialogue &&
        modules.newFormatComparableName(runtime.currentDialogue.stage) ===
          modules.newFormatComparableName(step.stage) &&
        modules.newFormatComparableName(runtime.currentDialogue.speaker) ===
          modules.newFormatComparableName(step.speaker) &&
        runtime.currentDialogue.shot === step.shot;
      var continuesDialogueVisual = runtime.dialogueVisible && continuesDialogueContext;
      var eventName = ":typingcomplete.new-format-" +
        String(id).replace(/[^a-z0-9_-]/gi, "-");

      function showNextLine() {
        if (setup.newFormatRuntime[id] !== runtime) {
          return;
        }
        if (lineIndex >= step.lines.length) {
          setup.newFormatDialogueTypingEvent = "";
          runtime.persistentDialogue = Boolean(step.persistent);
          if (runtime.persistentDialogue) {
            runtime.$flow.addClass("has-persistent-dialogue");
            runtime.$flow.find(".new-format-character-stage.is-dialogue-focus-character")
              .addClass("is-persistent-character");
            runtime.$flow.find(".new-format-character-stage[data-new-format-character-key=\"" +
              modules.newFormatCharacterKey(step.stage, step.speaker).replace(/\"/g, "\\\"") + "\"]")
              .addClass("is-persistent-character");
          }
          complete();
          return;
        }

        var currentLineIndex = lineIndex++;
        var line = step.lines[currentLineIndex];
        var audioUrl = step.audioUrls && step.audioUrls[currentLineIndex]
          ? step.audioUrls[currentLineIndex]
          : "";
        var isVoiced = Boolean(step.dialogue && audioUrl);
        var typingFinished = false;
        var audioFinished = !isVoiced;
        var advanceQueued = false;
        var audio;

        function advanceWhenReady() {
          if (advanceQueued || !typingFinished || !audioFinished ||
              setup.newFormatRuntime[id] !== runtime) {
            return;
          }
          advanceQueued = true;
          if (isVoiced) {
            showNextLine();
          } else {
            modules.queueNewFormatFlowTimer(showNextLine, setup.newFormatDialoguePause);
          }
        }

        function finishAudio() {
          if (!audioFinished) {
            audioFinished = true;
            advanceWhenReady();
          }
        }

        function releaseAudio() {
          if (!audio) {
            return;
          }
          if (audio.newFormatOverlapTimer) {
            clearTimeout(audio.newFormatOverlapTimer);
          }
          audio.newFormatOverlapTimer = null;
          audio.onplaying = null;
          audio.onended = null;
          audio.onerror = null;
          audio.pause();
        }

        setup.newFormatDialogueTypingEvent = eventName;
        $(document).off(eventName).one(eventName, function () {
          setup.newFormatDialogueTypingEvent = "";
          typingFinished = true;
          advanceWhenReady();
        });

        if (isVoiced) {
          audio = setup.newFormatDialogueAudioPlayers[
            setup.newFormatDialogueAudioIndex++ % setup.newFormatDialogueAudioPlayers.length
          ];
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1;
          audio.src = audioUrl;
          audio.load();

          function scheduleDialogueOverlap() {
            var remainingMs;
            var overlapMs;
            if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
              return;
            }
            if (audio.newFormatOverlapTimer) {
              clearTimeout(audio.newFormatOverlapTimer);
            }
            remainingMs = Math.max(0, (audio.duration - audio.currentTime) * 1000);
            overlapMs = Math.min(setup.newFormatDialogueOverlap, remainingMs * 0.2);
            audio.newFormatOverlapTimer = setTimeout(function () {
              audio.newFormatOverlapTimer = null;
              finishAudio();
            }, Math.max(0, remainingMs - overlapMs));
          }

          audio.onplaying = scheduleDialogueOverlap;
          audio.onended = function () {
            finishAudio();
            releaseAudio();
          };
          audio.onerror = function () {
            console.warn("Could not play dialogue audio " + audioUrl);
            finishAudio();
            releaseAudio();
          };
          var playResult = audio.play();
          if (playResult && typeof playResult.catch === "function") {
            playResult.catch(function (error) {
              console.warn("Dialogue audio playback was blocked:", error);
              finishAudio();
              releaseAudio();
            });
          }
        }

        $line.empty().wiki(
          '<<type ' + (step.dialogue ? setup.newFormatVoicedTypeDelay : 24) +
          'ms start ' + (step.dialogue ? setup.newFormatVoicedTextDelay : 0) +
          'ms none>>' + modules.renderStaticMarkup(line) + '<</type>>'
        );
        modules.initStaticFlicker($line.get(0));
      }

      function prepareDialogue() {
        $line = continuesDialogueVisual
          ? runtime.$flow.find(".new-format-runtime .dialogue-line")
          : modules.showNewFormatDialogue(runtime.$flow, step);
        if (!$line.length) {
          $line = modules.showNewFormatDialogue(runtime.$flow, step);
        }
        runtime.dialogueVisible = true;
        runtime.persistentDialogue = false;
        runtime.currentDialogue = {
          stage: step.stage,
          speaker: step.speaker,
          shot: step.shot
        };
      }

      var dialogueShot = modules.newFormatShot("[" + step.shot + "]") || "wide";
      var previousShot = previousDialogue
        ? (modules.newFormatShot("[" + previousDialogue.shot + "]") || previousDialogue.shot)
        : "";
      var dialogueIsClose = dialogueShot === "closeup" || dialogueShot === "solo";
      var previousWasClose = previousShot === "closeup" || previousShot === "solo";
      var shouldFadeDialogue = previousDialogue
        ? dialogueIsClose !== previousWasClose
        : dialogueIsClose;

      if (skipFade || !shouldFadeDialogue) {
        prepareDialogue();
        showNextLine();
      } else {
        modules.transitionNewFormatThroughBlack(runtime.$flow, prepareDialogue, showNextLine);
      }
    };

    modules.showNewFormatChoices = function showNewFormatChoices($flow, id, choices) {
      var runtime = setup.newFormatRuntime[id];
      var visibleChoices = choices || [];
      var buttons = visibleChoices.map(function (choice, index) {
        var label = choice.label;

        return '<a href="#" class="new-format-character-option link-internal" role="button"' +
          ' data-new-format-runtime-id="' + modules.escapeHtml(id) + '"' +
          ' data-new-format-choice-index="' + index + '">' +
          modules.escapeHtml(label) + '</a>';
      }).join("");

      if (runtime) {
        runtime.currentChoices = visibleChoices;
      }

      if (!buttons) {
        modules.runNextNewFormatStep(id);
        return;
      }

      var $runtime = $flow.find(".new-format-runtime");

      if (!runtime || !runtime.persistentDialogue) {
        if (runtime) {
          runtime.dialogueVisible = false;
        }
        $runtime.empty();
      }

      $runtime.append(
        '<div class="dialogue-options-stack new-format-character-options-wrap">' +
        '<div class="dialogue-choices is-visible is-instant new-format-character-options">' +
        buttons + '</div></div>'
      );
    };
}());
