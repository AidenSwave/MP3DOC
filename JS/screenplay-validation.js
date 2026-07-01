(function () {
  "use strict";

  var modules = setup.newFormatModules = setup.newFormatModules || {};

modules.newFormatComparableName = function newFormatComparableName(name) {
      return String(name || "").trim().toLowerCase();
    };

    modules.newFormatLooseName = function newFormatLooseName(name) {
      return modules.newFormatComparableName(name).replace(/[^a-z0-9]+/g, "");
    };

    modules.newFormatNameDistance = function newFormatNameDistance(left, right) {
      var a = modules.newFormatComparableName(left);
      var b = modules.newFormatComparableName(right);
      var previous = [];

      for (var j = 0; j <= b.length; j++) {
        previous[j] = j;
      }

      for (var i = 1; i <= a.length; i++) {
        var current = [i];

        for (j = 1; j <= b.length; j++) {
          current[j] = Math.min(
            current[j - 1] + 1,
            previous[j] + 1,
            previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
          );
        }

        previous = current;
      }

      return previous[b.length];
    };

    modules.newFormatNameSuggestion = function newFormatNameSuggestion(requested, registered) {
      var looseRequested = modules.newFormatLooseName(requested);
      var looseMatch = registered.find(function (name) {
        return modules.newFormatLooseName(name) === looseRequested;
      });

      if (looseMatch) {
        return looseMatch;
      }

      var nearest = registered.slice().sort(function (left, right) {
        return modules.newFormatNameDistance(requested, left) - modules.newFormatNameDistance(requested, right);
      })[0] || "";
      var maximumDistance = Math.max(2, Math.floor(String(requested || "").length * 0.35));

      return nearest && modules.newFormatNameDistance(requested, nearest) <= maximumDistance
        ? nearest
        : "";
    };

    modules.isRecognisedNewFormatDirective = function isRecognisedNewFormatDirective(trimmed) {
      // Keep directive recognition separate from strict validation.
      return /^@(stage|scene|sequence|video|audio|add)\b/i.test(trimmed);
    };

    modules.validateNewFormatSyntax = function validateNewFormatSyntax(text, parsed) {
      var errors = [];
      var lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");

      if (!parsed.stage) {
        errors.push({ message: "No @stage Has Been Set" });
      }

      if (!parsed.scene) {
        errors.push({ message: "No Opening @scene Has Been Set" });
      }

      lines.forEach(function (line) {
        var trimmed = line.trim();

        if (!trimmed || modules.isNewFormatIgnoredLine(line)) {
          return;
        }

        if (modules.parseNewFormatVariableDirective(trimmed) ||
            modules.parseNewFormatConditionDirective(trimmed) ||
            modules.newFormatShotInfo(trimmed) ||
            /^\s*}\s*$/.test(trimmed) ||
            modules.parseNewFormatChoiceHeader(line)) {
          return;
        }

        if (/^@/.test(trimmed) &&
            !modules.isRecognisedNewFormatDirective(trimmed)) {
          errors.push({ message: "Invalid Directive: " + trimmed });
        }

        if (/^@audio\b/i.test(trimmed) && !modules.parseNewFormatAudioDirective(trimmed)) {
          errors.push({ message: "Invalid Audio Directive: " + trimmed });
        }

        if (/^@add\b/i.test(trimmed) && !modules.parseNewFormatAddDirective(trimmed)) {
          errors.push({ message: "Invalid Character Add Directive: " + trimmed });
        }

        if (/^@scene\b/i.test(trimmed) && !modules.parseNewFormatSceneDirective(trimmed)) {
          errors.push({ message: "Invalid Scene Directive: " + trimmed });
        }

        if (/^Continue\s*:/i.test(trimmed) &&
            !/^Continue\s*:\s*\[\[[^\]]+\]\]\s*$/i.test(trimmed)) {
          errors.push({ message: "Invalid Continue Link: " + trimmed });
        }

        if (/^\[Delay\b/i.test(trimmed) && modules.newFormatDelay(trimmed) === null) {
          errors.push({ message: "Invalid Delay: " + trimmed });
        } else if (/^\[[^\]]+\](?:\s*\{\s*[^{}]+\s*\})?$/.test(trimmed) &&
            !/^\[(OPTION|Solo|Wide|Closeup|CUT TO BLACK|NoFade|\.\.\.)\](?:\s*\{\s*[^{}]+\s*\})?$/i.test(trimmed) &&
            modules.newFormatFadeIn(trimmed) === null &&
            modules.newFormatBlurOut(trimmed) === null &&
            modules.newFormatDelay(trimmed) === null) {
          errors.push({ message: "Invalid Shot: " + trimmed });
        }
      });

      if (/^\s*\[OPTION\]\s*$/im.test(text) && !parsed.option) {
        errors.push({ message: "[OPTION] Is Missing A Valid -> [Continue] Line" });
      }

      var staticOpenCount = (String(text).match(/\{static\}/gi) || []).length;
      var staticCloseCount = (String(text).match(/\{\/static\}/gi) || []).length;

      if (staticOpenCount !== staticCloseCount) {
        errors.push({ message: "Unclosed {static} Text Effect" });
      }

      modules.forEachNewFormatStep(parsed.steps, function (step) {
        if (step.type === "dialogue" && !step.lines.length) {
          errors.push({ message: "No Dialogue Written For " + step.speaker });
        }
      });

      return errors;
    };

    modules.newFormatReferencedStages = function newFormatReferencedStages(parsed) {
      var stages = [];

      function add(stage) {
        var cleanStage = modules.cleanAssetPath(stage);
        if (cleanStage && !stages.some(function (existing) {
          return existing.toLowerCase() === cleanStage.toLowerCase();
        })) {
          stages.push(cleanStage);
        }
      }

      add(parsed.stage);
      modules.forEachNewFormatStep(parsed.steps, function (step) {
        if (step.stage) {
          add(step.stage);
        }

        if (step.type === "scenes") {
          step.assets.forEach(function (asset) {
            add(modules.cleanAssetPath(asset).split("/")[0]);
          });
        }
      });

      return stages;
    };

    modules.validateNewFormatAssets = function validateNewFormatAssets(parsed, registries) {
      var errors = [];

      function registryFor(stage) {
        return registries.find(function (registry) {
          return registry.stage.toLowerCase() === modules.cleanAssetPath(stage).toLowerCase();
        });
      }

      function validateName(type, requested, stage, names) {
        var exact = names.some(function (name) {
          return modules.newFormatComparableName(name) === modules.newFormatComparableName(requested);
        });

        if (exact) {
          return;
        }

        errors.push({
          message: "No " + type + " Named " + requested,
          suggestion: modules.newFormatNameSuggestion(requested, names),
          stage: stage
        });
      }

      registries.forEach(function (registry) {
        if (!registry.paths.length) {
          errors.push({ message: "No Assets Registered For Stage " + registry.stage });
        }
      });

      var openingRegistry = registryFor(parsed.stage);
      if (openingRegistry && parsed.scene) {
        validateName("Scene", parsed.scene, parsed.stage, openingRegistry.scenes);
      }

      modules.forEachNewFormatStep(parsed.steps, function (step) {
        if (step.type === "scenes") {
          step.assets.forEach(function (asset) {
            var parts = modules.cleanAssetPath(asset).split("/");
            var sceneIndex = parts.findIndex(function (part) {
              return part.toLowerCase() === "scenes";
            });
            var stage = sceneIndex > 0 ? parts.slice(0, sceneIndex).join("/") : parsed.stage;
            var requested = sceneIndex >= 0 ? parts.slice(sceneIndex + 1).join("/") : parts.pop();
            var registry = registryFor(stage);

            if (registry) {
              validateName("Scene", requested, stage, registry.scenes);
            }
          });
        } else if (step.type === "addCharacter") {
          var addedCharacterRegistry = registryFor(step.stage);
          if (addedCharacterRegistry) {
            validateName("Character", step.speaker, step.stage, addedCharacterRegistry.characters);
          }
        } else if (step.type === "dialogue") {
          var characterRegistry = registryFor(step.stage);
          if (characterRegistry) {
            validateName("Character", step.speaker, step.stage, characterRegistry.characters);

            if (step.dialogue) {
              var dialogueExists = characterRegistry.dialogues.some(function (name) {
                return modules.newFormatComparableName(name) ===
                  modules.newFormatComparableName(step.dialogue);
              });

              validateName(
                "Dialogue",
                step.dialogue,
                step.stage,
                characterRegistry.dialogues
              );

              if (dialogueExists) {
                step.audioUrls = step.lines.map(function (_, lineIndex) {
                  var audioLineIndex = (step.dialogueLineOffset || 0) + lineIndex;
                  var audioPath = modules.newFormatDialogueAudioMatch(
                    characterRegistry.audioPaths,
                    step.stage,
                    step.dialogue,
                    audioLineIndex
                  );

                  if (!audioPath) {
                    errors.push({
                      message: "No Dialogue Audio Named " + step.dialogue + "_" +
                        audioLineIndex + ".wav",
                      stage: step.stage
                    });
                    return "";
                  }

                  return modules.githubRawAssetUrl(audioPath);
                });
              }
            }
          }
        } else if (step.type === "sequence") {
          var sequenceRegistry = registryFor(step.stage);
          if (sequenceRegistry) {
            validateName("Sequence", step.name, step.stage, sequenceRegistry.sequences);
          }
        } else if (step.type === "video") {
          var videoRegistry = registryFor(step.stage);
          if (videoRegistry) {
            validateName("Video", step.name, step.stage, videoRegistry.videos);
          }
        } else if (step.type === "audio") {
          var audioRegistry = registryFor(step.stage);
          if (audioRegistry) {
            validateName("Audio", step.name, step.stage, audioRegistry.sounds);
            var soundPath = modules.newFormatSoundMatch(
              audioRegistry.soundPaths,
              step.stage,
              step.name
            );

            if (soundPath) {
              step.url = modules.githubRawAssetUrl(soundPath);
            }
          }
        }
      });

      return errors;
    };

    modules.newFormatRegistryList = function newFormatRegistryList(title, names) {
      var items = names.length
        ? names.map(function (name) {
            return "<li>" + modules.escapeHtml(name) + "</li>";
          }).join("")
        : "<li>None</li>";

      return '<section class="new-format-registry-group">' +
        '<h4>' + modules.escapeHtml(title) + '</h4><ul>' + items + '</ul></section>';
    };

    modules.renderNewFormatErrors = function renderNewFormatErrors($flow, errors, registries) {
      var errorItems = errors.map(function (error) {
        var suggestion = error.suggestion
          ? '<div class="new-format-error-suggestion">Did you mean ' +
            modules.escapeHtml(error.suggestion) + '?</div>'
          : "";

        return '<li><strong>' + modules.escapeHtml(error.message) + '</strong>' + suggestion + '</li>';
      }).join("");
      var registryHtml = registries.map(function (registry) {
        return '<div class="new-format-registry-stage">' +
          '<h3>@stage ' + modules.escapeHtml(registry.stage) + '</h3>' +
          '<div class="new-format-registry-columns">' +
          modules.newFormatRegistryList("Registered Characters", registry.characters) +
          modules.newFormatRegistryList("Registered Scenes", registry.scenes) +
          modules.newFormatRegistryList("Registered Sequences", registry.sequences) +
          modules.newFormatRegistryList("Registered Videos", registry.videos) +
          modules.newFormatRegistryList("Registered Dialogue", registry.dialogues) +
          modules.newFormatRegistryList("Registered Audio", registry.sounds) +
          '</div></div>';
      }).join("");

      $flow.find(".new-format-prestage").html(
        '<div class="new-format-validation-error" role="alert">' +
        '<h2>Pre-Stage Validation Failed</h2>' +
        '<ul class="new-format-error-list">' + errorItems + '</ul>' +
        registryHtml + '</div>'
      );
    };

    modules.renderNewFormatScreenplay = function renderNewFormatScreenplay(passage) {
      var parsed = modules.parseNewFormatScreenplay(passage.text);
      var id = "new-format-" + passage.title.replace(/[^a-z0-9_-]/gi, "-") + "-" +
        (++setup.newFormatPassageCounter);
      var sceneAsset = modules.newFormatAssetPath(parsed.stage, "Scenes", parsed.scene);
      var output = '<div id="' + id + '" class="new-format-flow" data-new-format-stage="' +
        modules.escapeHtml(parsed.stage) + '">' +
        '<div class="new-format-prestage" role="status">' +
        '<div class="new-format-prestage-title">Preparing @stage ' +
        modules.escapeHtml(parsed.stage || "Unknown") + '</div>' +
        '<div class="new-format-prestage-status">Reading the story asset library…</div>' +
        '<div class="new-format-load-row"><div class="new-format-load-meter" role="progressbar"' +
        ' aria-label="Loading story assets" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<div class="new-format-load-bar"></div></div><div class="new-format-load-count">0%</div></div>' +
        '</div>' +
        '<div class="new-format-stage" hidden data-new-format-scene-path="' +
        modules.escapeHtml(sceneAsset) + '" data-new-format-scene-scale="' +
        parsed.sceneScale + '">';

      if (sceneAsset) {
        output += '<img class="new-format-scene is-loading" data-new-format-pending-asset="' +
          modules.escapeHtml(sceneAsset) + '" alt="Loading scene: ' + modules.escapeHtml(sceneAsset) +
          '" aria-busy="true" style="transform:scale(' + (parsed.sceneScale / 100) + ')' +
          (parsed.sceneReveal ? ';opacity:0' : '') + '">';
      }

      output += '<div class="new-format-content">';


      output += '<div class="new-format-runtime"></div>';
      setup.newFormatPassages[id] = {
        steps: parsed.steps,
        source: passage.text,
        parsed: parsed,
        autoStart: !parsed.option,
        ready: false
      };

      if (parsed.option) {
        output += '<div class="dialogue-options-stack new-format-options">' +
          '<div class="dialogue-choices is-visible is-instant">' +
          '<a href="#" class="new-format-option link-internal" role="button" data-new-format-id="' +
          id + '">' + modules.escapeHtml(parsed.option.label) + '</a></div></div>';
      }

      return output + '</div><div class="new-format-black-fade' +
        (parsed.sceneStartBlack ? ' is-active' : '') + '" aria-hidden="true"></div></div></div>' +
        '<<done>><<run setup.prepareNewFormatPassage(' +
        JSON.stringify(id) + ')>><</done>>';
    };
}());
