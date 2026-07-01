(function () {
  "use strict";

  var modules = setup.newFormatModules = setup.newFormatModules || {};

modules.isNewFormatIgnoredLine = function isNewFormatIgnoredLine(line) {
      return /^\s*;/.test(line);
    }

    modules.newFormatShotInfo = function newFormatShotInfo(line) {
      var match = String(line || "").trim().match(
        /^\[\s*(?:Shot\s*:\s*)?(Solo|Wide|Closeup)\s*\]$/i
      );
      return match ? { shot: match[1].toLowerCase() } : null;
    };;

    modules.newFormatShot = function newFormatShot(line) {
      var info = modules.newFormatShotInfo(line);
      return info ? info.shot : "";
    };

    modules.newFormatDelay = function newFormatDelay(line) {
      var match = String(line || "").trim().match(
        /^\[Delay\s+(\d+(?:\.\d+)?)\s*(ms|s)\]$/i
      );

      if (!match) {
        return null;
      }

      return Number(match[1]) * (match[2].toLowerCase() === "s" ? 1000 : 1);
    };

    modules.parseNewFormatVariableDirective = function parseNewFormatVariableDirective(line) {
      var match = String(line || "").trim().match(
        /^\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+|-)\s*(-?\d+(?:\.\d+)?)\s*\]$/
      );
      return match ? { name: match[1], operator: match[2], value: Number(match[3]) } : null;
    };

    modules.parseNewFormatConditionDirective = function parseNewFormatConditionDirective(line) {
      var match = String(line || "").trim().match(
        /^\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*(>|<)\s*(-?\d+(?:\.\d+)?)\s*\]$/
      );
      return match ? { name: match[1], operator: match[2], value: Number(match[3]) } : null;
    };

    modules.isNewFormatVariableOrConditionLine = function isNewFormatVariableOrConditionLine(line) {
      return Boolean(
        modules.parseNewFormatVariableDirective(line) ||
        modules.parseNewFormatConditionDirective(line)
      );
    };

    modules.newFormatLineIndent = function newFormatLineIndent(line) {
      var match = String(line || "").match(/^\s*/);
      return match ? match[0].replace(/\t/g, "    ").length : 0;
    };

    modules.parseNewFormatChoiceHeader = function parseNewFormatChoiceHeader(line) {
      var match = String(line || "").match(/^(\s*)[*-]\s*(.+?)\s*$/);
      var label;
      var hasBlock = false;
      var inlineBody = "";
      var openIndex;

      if (!match) {
        return null;
      }

      label = match[2].trim();
      openIndex = label.indexOf("{");

      if (openIndex >= 0) {
        hasBlock = true;
        inlineBody = label.slice(openIndex + 1).trim();
        label = label.slice(0, openIndex).trim();

        if (/}\s*$/.test(inlineBody)) {
          inlineBody = inlineBody.replace(/}\s*$/, "").trim();
          hasBlock = false;
        }
      }

      return label ? {
        indent: modules.newFormatLineIndent(line),
        label: label,
        hasBlock: hasBlock,
        inlineBody: inlineBody
      } : null;
    };

    modules.forEachNewFormatStep = function forEachNewFormatStep(steps, callback) {
      (steps || []).forEach(function (step) {
        callback(step);

        if (step.type === "choices") {
          (step.choices || []).forEach(function (choice) {
            modules.forEachNewFormatStep(choice.steps || [], callback);
          });
        }
      });
    };

    modules.cloneNewFormatSteps = function cloneNewFormatSteps(steps) {
      return JSON.parse(JSON.stringify(steps || []));
    };

    modules.newFormatTimedEffect = function newFormatTimedEffect(line, name) {
      var match = String(line || "").trim().match(
        new RegExp("^\\[" + name + "\\s*,?\\s*(\\d+(?:\\.\\d+)?)\\s*(ms|s)\\]$", "i")
      );
      return match ? Number(match[1]) * (match[2].toLowerCase() === "s" ? 1000 : 1) : null;
    };

    modules.newFormatFadeIn = function newFormatFadeIn(line) {
      return modules.newFormatTimedEffect(line, "Fade In");
    };

    modules.newFormatBlurOut = function newFormatBlurOut(line) {
      return modules.newFormatTimedEffect(line, "Blur Out");
    };

    modules.parseNewFormatSceneDirective = function parseNewFormatSceneDirective(line) {
      var match = String(line || "").trim().match(/^@scene\s+(.+?)\s*$/i);

      if (!match) {
        return null;
      }

      var value = match[1].trim();
      var modifiers = [];
      var modifierMatch;
      var scale = 100;
      var reveal = false;
      var revealDuration = 0;
      var startBlack = false;

      while ((modifierMatch = value.match(/\s+\[\s*([^\]]+?)\s*\]\s*$/))) {
        modifiers.unshift(modifierMatch[1]);
        value = value.slice(0, modifierMatch.index).trim();
      }

      for (var i = 0; i < modifiers.length; i++) {
        var scaleMatch = modifiers[i].match(/^scale\s*(\d+(?:\.\d+)?)$/i);
        var revealMatch = modifiers[i].match(
          /^Reveal(?:\s+(\d+(?:\.\d+)?)\s*(ms|s))?$/i
        );

        if (scaleMatch) {
          scale = Math.max(1, Number(scaleMatch[1]));
        } else if (/^Start\s+Black$/i.test(modifiers[i])) {
          startBlack = true;
        } else if (revealMatch) {
          reveal = true;
          revealDuration = revealMatch[1]
            ? Number(revealMatch[1]) * (revealMatch[2].toLowerCase() === "s" ? 1000 : 1)
            : 0;
        } else {
          return null;
        }
      }

      if (!value) {
        return null;
      }

      return {
        name: modules.cleanAssetPath(value),
        scale: scale,
        reveal: reveal,
        revealDuration: revealDuration,
        startBlack: startBlack
      };
    };

    modules.parseNewFormatCharacterTransformValues = function parseNewFormatCharacterTransformValues(text) {
      var values = {};
      var found = false;

      String(text || "").split(",").forEach(function (part) {
        var valueMatch = part.match(/^\s*([xys])\s*:?\s*(-?\d+(?:\.\d+)?)\s*$/i);

        if (!valueMatch) {
          return;
        }

        found = true;
        var key = valueMatch[1].toLowerCase();
        var value = Number(valueMatch[2]);

        if (key === "s") {
          values.scale = value;
        } else {
          values[key] = value;
        }
      });

      return found ? modules.normalizeCharacterTransform(values) : null;
    };

    modules.parseNewFormatAddDirective = function parseNewFormatAddDirective(line) {
      var match = String(line || "").trim().match(/^@add\s+(.+?)\s*\{\s*([^{}]+)\s*\}\s*$/i);
      var transform;

      if (!match) {
        return null;
      }

      transform = modules.parseNewFormatCharacterTransformValues(match[2]);

      if (!transform) {
        return null;
      }

      return {
        speaker: match[1].trim(),
        transform: transform
      };
    };

    modules.parseNewFormatAudioDirective = function parseNewFormatAudioDirective(line) {
      var match = String(line || "").trim().match(/^@audio\s+(.+?)\s*$/i);
      var value;
      var modifiers = [];
      var modifierMatch;
      var result = {
        name: "",
        offset: 0,
        fadeDuration: 0,
        lowpassDuration: 0,
        continueAcrossPassages: false
      };

      if (!match) {
        return null;
      }
      value = match[1].trim();

      while ((modifierMatch = value.match(/\s+\[\s*([^\]]+?)\s*\]\s*$/))) {
        modifiers.unshift(modifierMatch[1].trim());
        value = value.slice(0, modifierMatch.index).trim();
      }
      if (!value) {
        return null;
      }

      for (var i = 0; i < modifiers.length; i++) {
        var modifier = modifiers[i];
        var timed = modifier.match(/^(fade|lowpass)\s+(\d+(?:\.\d+)?)\s*(ms|s)$/i);
        var offset = modifier.match(/^\+?(\d+(?:\.\d+)?)\s*(ms|s)$/i);
        var duration;

        if (/^cont$/i.test(modifier)) {
          result.continueAcrossPassages = true;
        } else if (timed) {
          duration = Number(timed[2]) * (timed[3].toLowerCase() === "s" ? 1000 : 1);
          result[timed[1].toLowerCase() + "Duration"] = duration;
        } else if (offset) {
          result.offset = Number(offset[1]) * (offset[2].toLowerCase() === "s" ? 1000 : 1);
        } else {
          return null;
        }
      }

      result.name = modules.cleanAssetPath(value);
      return result;
    };

    modules.parseNewFormatDialogueSpeaker = function parseNewFormatDialogueSpeaker(line) {
      var value = String(line || "").trim();
      var match = value.match(/^(.*?)\s*\[\s*([a-z0-9][a-z0-9_-]*)\s*\]\s*$/i);

      return match ? {
        speaker: match[1].trim(),
        dialogue: match[2].trim()
      } : {
        speaker: value,
        dialogue: ""
      };
    };


    modules.isLikelyNewFormatSpeakerLine = function isLikelyNewFormatSpeakerLine(line) {
      var speakerParts = modules.parseNewFormatDialogueSpeaker(line);
      var speaker = String(speakerParts.speaker || "").trim();
      var words;

      if (!speaker) {
        return false;
      }

      if (/^[@*[\]{}]/.test(speaker) || /^Continue\s*:/i.test(speaker)) {
        return false;
      }

      // Dialogue text should never become a character just because a shot is active.
      // Speaker labels are short names; spoken lines often contain sentence punctuation
      // or read like full phrases.
      if (/[.!?,:;]/.test(speaker)) {
        return false;
      }

      if (!/^[A-Za-z0-9_ '\-]+$/.test(speaker)) {
        return false;
      }

      words = speaker.split(/\s+/).filter(Boolean);

      if (words.length > 4 || speaker.length > 42) {
        return false;
      }

      if (/^(?:okay|ok|yes|yeah|no|please|feel|where|what|how|why|when|if|you|your|they|we|i|im|i'm|one|now)\b/i.test(speaker)) {
        return false;
      }

      return true;
    };

    modules.newFormatDialogueAudioMatch = function newFormatDialogueAudioMatch(paths, stage, dialogue, lineIndex) {
      var folderKeys = [
        modules.assetKey(modules.newFormatAssetPath(stage, "Dialogue", dialogue)),
        modules.assetKey(modules.newFormatAssetPath(stage, "Dialogues", dialogue))
      ];
      var expectedFilename = String(dialogue) + "_" + lineIndex + ".wav";

      return paths.find(function (path) {
        var cleanPath = modules.cleanAssetPath(path);
        var slash = cleanPath.lastIndexOf("/");
        var directory = slash >= 0 ? cleanPath.slice(0, slash) : "";
        var filename = slash >= 0 ? cleanPath.slice(slash + 1) : cleanPath;
        var directoryKey = modules.assetKey(directory);

        return filename.toLowerCase() === expectedFilename.toLowerCase() &&
          folderKeys.some(function (folderKey) {
            return directoryKey === folderKey || directoryKey.endsWith("/" + folderKey);
          });
      }) || "";
    };

    modules.newFormatSoundMatch = function newFormatSoundMatch(paths, stage, sound) {
      return modules.newFormatAssetMatch(paths, modules.newFormatAssetPath(stage, "Audio", sound)) ||
        modules.newFormatAssetMatch(paths, modules.newFormatAssetPath(stage, "Audios", sound));
    };

    modules.nextNewFormatContentLine = function nextNewFormatContentLine(lines, start) {
      for (var i = start; i < lines.length; i++) {
        if (lines[i].trim() && !modules.isNewFormatIgnoredLine(lines[i])) {
          return i;
        }
      }

      return -1;
    };

    modules.collectNewFormatDialogueLines = function collectNewFormatDialogueLines(lines, start) {
      var dialogueLines = [];
      var persistent = false;
      var i = start;

      while (i < lines.length) {
        var trimmed = lines[i].trim();

        if (!trimmed) {
          i++;
          continue;
        }

        if (/^(?:@stage|@scene|@sequence|@video|@audio|@add)\b/i.test(trimmed) ||
            /^\[(?:CUT TO BLACK|NoFade|\.\.\.)\]$/i.test(trimmed) ||
            /^\s*}\s*$/.test(trimmed) ||
            modules.newFormatShotInfo(trimmed) ||
            modules.isNewFormatVariableOrConditionLine(trimmed) ||
            modules.newFormatFadeIn(trimmed) !== null ||
            modules.newFormatBlurOut(trimmed) !== null ||
            /^Continue\s*:\s*\[\[[^\]]+\]\]\s*$/i.test(trimmed) ||
            modules.parseNewFormatChoiceHeader(lines[i])) {
          break;
        }

        var possibleSpeaker = modules.parseNewFormatDialogueSpeaker(trimmed);
        var possibleShotIndex = modules.nextNewFormatContentLine(lines, i + 1);
        var possibleNextContent = possibleShotIndex >= 0
          ? lines[possibleShotIndex].trim()
          : "";

        if (possibleSpeaker.dialogue &&
            possibleSpeaker.dialogue.toLowerCase() !== "p" &&
            modules.isLikelyNewFormatSpeakerLine(trimmed)) {
          break;
        }

        // A bare speaker followed by a condition/shot starts a new dialogue block.
        // Without this, lines like "Nurse" + "[Trust < 60]" were eaten as dialogue,
        // then "Okay. Thats fine!" was misread as a character name.
        if (!possibleSpeaker.dialogue &&
            modules.isLikelyNewFormatSpeakerLine(trimmed) &&
            (modules.parseNewFormatConditionDirective(possibleNextContent) || modules.newFormatShotInfo(possibleNextContent))) {
          break;
        }

        if (possibleShotIndex >= 0 && modules.newFormatShot(lines[possibleShotIndex])) {
          break;
        }

        var persistentLine = trimmed.match(/^(.*?)\s*\[p\]\s*$/i);
        if (persistentLine) {
          persistent = true;
          trimmed = persistentLine[1].trim();
        }

        if (trimmed) {
          dialogueLines.push(trimmed);
        }
        i++;
      }

      return {
        lines: dialogueLines,
        persistent: persistent,
        nextIndex: i
      };
    };

    modules.parseNewFormatSteps = function parseNewFormatSteps(rawLines, startingStage, startingState) {
      var lines = rawLines.filter(function (line) {
        return !modules.isNewFormatIgnoredLine(line);
      });
      var steps = [];
      var stage = modules.cleanAssetPath(startingStage);
      var inheritedState = startingState || {};
      var lastDialogueSpeaker = inheritedState.speaker || "";
      var lastDialogueShot = inheritedState.shot || "";
      var lastDialogueTag = inheritedState.tag || "";
      var currentShot = inheritedState.shot || "";
      var pendingCondition = inheritedState.condition || null;
      var dialogueLineCounts = inheritedState.dialogueLineCounts || {};

      function attachCondition(step, condition) {
        var activeCondition = condition || pendingCondition;

        if (activeCondition) {
          step.condition = activeCondition;
        }

        pendingCondition = null;
        return step;
      }

      function pushStep(step, condition) {
        steps.push(attachCondition(step, condition));
      }

      function parserState() {
        return {
          speaker: lastDialogueSpeaker,
          shot: currentShot || lastDialogueShot,
          tag: lastDialogueTag,
          dialogueLineCounts: dialogueLineCounts
        };
      }

      function pushDialogueStep(speaker, dialogue, shot, block, condition) {
        var dialogueKey = dialogue
          ? [stage, dialogue].join("/").toLowerCase()
          : "";
        var lineOffset = dialogueKey ? (dialogueLineCounts[dialogueKey] || 0) : 0;

        pushStep({
          type: "dialogue",
          stage: stage,
          speaker: speaker,
          dialogue: dialogue,
          dialogueLineOffset: lineOffset,
          shot: shot,
          lines: block.lines,
          persistent: block.persistent
        }, condition);

        if (dialogueKey) {
          dialogueLineCounts[dialogueKey] = lineOffset + block.lines.length;
        }
        lastDialogueSpeaker = speaker;
        lastDialogueShot = shot;
        lastDialogueTag = dialogue;
        currentShot = shot;
      }

      function collectChoiceBody(startIndex, header) {
        var bodyLines = [];
        var i = startIndex + 1;

        if (header.inlineBody) {
          bodyLines.push(header.inlineBody);
        }

        if (header.hasBlock) {
          while (i < lines.length) {
            var raw = lines[i];
            var trimmed = raw.trim();
            var inlineClose = raw.match(/^(.*?)\s*}\s*$/);

            if (/^}\s*$/.test(trimmed)) {
              i++;
              break;
            }

            if (inlineClose) {
              if (inlineClose[1].trim()) {
                bodyLines.push(inlineClose[1]);
              }
              i++;
              break;
            }

            bodyLines.push(raw);
            i++;
          }

          return {
            lines: bodyLines,
            nextIndex: i
          };
        }

        var bodyStarted = false;

        while (i < lines.length) {
          var rawChild = lines[i];
          var trimmedChild = String(rawChild || "").trim();
          var childHeader = modules.parseNewFormatChoiceHeader(rawChild);
          var childIndent = modules.newFormatLineIndent(rawChild);

          if (!trimmedChild) {
            if (bodyStarted) {
              bodyLines.push(rawChild);
            }
            i++;
            continue;
          }

          if ((childHeader && childIndent <= header.indent) ||
              childIndent <= header.indent) {
            break;
          }

          bodyStarted = true;
          bodyLines.push(rawChild);
          i++;
        }

        return {
          lines: bodyLines,
          nextIndex: i
        };
      }

      function collectChoiceGroup(startIndex) {
        var choices = [];
        var i = startIndex;
        var header;
        var body;
        var choiceSteps;

        while (i < lines.length) {
          while (i < lines.length && !String(lines[i] || "").trim()) {
            i++;
          }

          header = modules.parseNewFormatChoiceHeader(lines[i]);

          if (!header) {
            break;
          }

          body = collectChoiceBody(i, header);
          choiceSteps = modules.parseNewFormatSteps(
            body.lines,
            stage,
            parserState()
          );

          choices.push({
            label: header.label,
            steps: choiceSteps
          });
          i = body.nextIndex;
        }

        return {
          choices: choices,
          nextIndex: i
        };
      }

      for (var i = 0; i < lines.length;) {
        var trimmed = lines[i].trim();
        var stageMatch;
        var sceneMatch;
        var sequenceMatch;
        var videoMatch;
        var audioMatch;
        var addMatch;
        var continueMatch;
        var variableMatch;
        var conditionMatch;
        var shotInfo;

        if (!trimmed) {
          i++;
          continue;
        }

        if (/^}\s*$/.test(trimmed)) {
          i++;
          continue;
        }

        variableMatch = modules.parseNewFormatVariableDirective(trimmed);
        if (variableMatch) {
          pushStep({
            type: "variable",
            name: variableMatch.name,
            operator: variableMatch.operator,
            value: variableMatch.value
          });
          i++;
          continue;
        }

        conditionMatch = modules.parseNewFormatConditionDirective(trimmed);
        if (conditionMatch) {
          pendingCondition = conditionMatch;
          i++;
          continue;
        }

        shotInfo = modules.newFormatShotInfo(trimmed);
        if (shotInfo) {
          currentShot = shotInfo.shot;
          i++;
          continue;
        }

        if (/^\[CUT TO BLACK\]$/i.test(trimmed)) {
          pushStep({ type: "cutToBlack" });
          lastDialogueSpeaker = "";
          lastDialogueShot = "";
          lastDialogueTag = "";
          currentShot = "";
          i++;
          continue;
        }

        var fadeInDuration = modules.newFormatFadeIn(trimmed);
        if (fadeInDuration !== null) {
          pushStep({ type: "fadeIn", duration: fadeInDuration });
          i++;
          continue;
        }

        var blurOutDuration = modules.newFormatBlurOut(trimmed);
        if (blurOutDuration !== null) {
          pushStep({ type: "blurOut", duration: blurOutDuration });
          i++;
          continue;
        }

        if (/^\[NoFade\]$/i.test(trimmed)) {
          pushStep({ type: "noFade" });
          i++;
          continue;
        }

        continueMatch = trimmed.match(/^Continue\s*:\s*\[\[([^\]]+?)\]\]\s*$/i);
        if (continueMatch) {
          pushStep({
            type: "goto",
            target: continueMatch[1].trim()
          });
          i++;
          continue;
        }

        var delay = modules.newFormatDelay(trimmed);
        if (delay !== null) {
          pushStep({ type: "delay", duration: delay });
          i++;
          continue;
        }

        stageMatch = trimmed.match(/^@stage\s+(.+?)\s*$/i);
        if (stageMatch) {
          stage = modules.cleanAssetPath(stageMatch[1]);
          lastDialogueSpeaker = "";
          lastDialogueShot = "";
          lastDialogueTag = "";
          currentShot = "";
          i++;
          continue;
        }

        sceneMatch = modules.parseNewFormatSceneDirective(trimmed);
        if (sceneMatch) {
          var scenes = [];
          var sceneScales = [];
          var sceneReveals = [];
          var sceneRevealDurations = [];
          var sceneStartsBlack = [];

          while (i < lines.length) {
            trimmed = lines[i].trim();

            if (!trimmed) {
              i++;
              continue;
            }

            stageMatch = trimmed.match(/^@stage\s+(.+?)\s*$/i);
            if (stageMatch) {
              stage = modules.cleanAssetPath(stageMatch[1]);
              i++;
              continue;
            }

            sceneMatch = modules.parseNewFormatSceneDirective(trimmed);
            if (!sceneMatch) {
              break;
            }

            scenes.push(modules.newFormatAssetPath(stage, "Scenes", sceneMatch.name));
            sceneScales.push(sceneMatch.scale);
            sceneReveals.push(sceneMatch.reveal);
            sceneRevealDurations.push(sceneMatch.revealDuration);
            sceneStartsBlack.push(sceneMatch.startBlack);
            i++;
          }

          pushStep({
            type: "scenes",
            assets: scenes,
            scales: sceneScales,
            reveals: sceneReveals,
            revealDurations: sceneRevealDurations,
            startsBlack: sceneStartsBlack
          });
          lastDialogueSpeaker = "";
          lastDialogueShot = "";
          lastDialogueTag = "";
          continue;
        }

        sequenceMatch = trimmed.match(/^@sequence\s+(.+?)\s*$/i);
        if (sequenceMatch) {
          pushStep({
            type: "sequence",
            stage: stage,
            name: modules.cleanAssetPath(sequenceMatch[1])
          });
          lastDialogueSpeaker = "";
          lastDialogueShot = "";
          lastDialogueTag = "";
          i++;
          continue;
        }

        videoMatch = trimmed.match(/^@video\s+(.+?)\s*$/i);
        if (videoMatch) {
          pushStep({
            type: "video",
            stage: stage,
            name: modules.cleanAssetPath(videoMatch[1])
          });
          lastDialogueSpeaker = "";
          lastDialogueShot = "";
          lastDialogueTag = "";
          i++;
          continue;
        }

        audioMatch = modules.parseNewFormatAudioDirective(trimmed);
        if (audioMatch) {
          pushStep({
            type: "audio",
            stage: stage,
            name: audioMatch.name,
            offset: audioMatch.offset,
            fadeDuration: audioMatch.fadeDuration,
            lowpassDuration: audioMatch.lowpassDuration,
            continueAcrossPassages: audioMatch.continueAcrossPassages
          });
          i++;
          continue;
        }

        addMatch = modules.parseNewFormatAddDirective(trimmed);
        if (addMatch) {
          pushStep({
            type: "addCharacter",
            stage: stage,
            speaker: addMatch.speaker,
            transform: addMatch.transform
          });
          i++;
          continue;
        }

        if (/^\[\.\.\.\]$/.test(trimmed)) {
          i++;

          if (lastDialogueSpeaker && lastDialogueShot && lastDialogueTag) {
            var continuationStart = modules.nextNewFormatContentLine(lines, i);

            if (continuationStart >= 0) {
              var continuationBlock = modules.collectNewFormatDialogueLines(
                lines,
                continuationStart
              );

              if (continuationBlock.lines.length) {
                pushDialogueStep(
                  lastDialogueSpeaker,
                  lastDialogueTag,
                  lastDialogueShot,
                  continuationBlock
                );
                i = continuationBlock.nextIndex;
              }
            }
          }
          continue;
        }

        if (modules.parseNewFormatChoiceHeader(lines[i])) {
          var choiceGroup = collectChoiceGroup(i);
          pushStep({
            type: "choices",
            choices: choiceGroup.choices
          });
          i = choiceGroup.nextIndex;
          continue;
        }

        var shotLineIndex = modules.nextNewFormatContentLine(lines, i + 1);
        var nextShotInfo = shotLineIndex >= 0 ? modules.newFormatShotInfo(lines[shotLineIndex]) : null;
        var shot = nextShotInfo ? nextShotInfo.shot : "";
        var speakerParts = modules.parseNewFormatDialogueSpeaker(trimmed);
        var inheritedShot = !shot && speakerParts.dialogue && lastDialogueShot &&
          modules.newFormatComparableName(speakerParts.speaker) ===
            modules.newFormatComparableName(lastDialogueSpeaker)
          ? lastDialogueShot
          : "";

        if ((shot || inheritedShot || currentShot) && modules.isLikelyNewFormatSpeakerLine(trimmed)) {
          var speaker = speakerParts.speaker;
          var dialogueShot = shot || inheritedShot || currentShot;
          var dialogueStart = shot ? shotLineIndex + 1 : i + 1;
          var dialogueCondition = pendingCondition;
          var conditionLineIndex = modules.nextNewFormatContentLine(lines, dialogueStart);

          pendingCondition = null;

          if (conditionLineIndex >= 0) {
            var inlineCondition = modules.parseNewFormatConditionDirective(lines[conditionLineIndex]);

            if (inlineCondition) {
              dialogueCondition = inlineCondition;
              dialogueStart = conditionLineIndex + 1;
            }
          }

          var dialogueBlock = modules.collectNewFormatDialogueLines(lines, dialogueStart);
          i = dialogueBlock.nextIndex;
          pushDialogueStep(speaker, speakerParts.dialogue, dialogueShot, dialogueBlock, dialogueCondition);
          continue;
        }

        i++;
      }

      return steps;
    };

    modules.parseNewFormatScreenplay = function parseNewFormatScreenplay(text) {
      var lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
      var optionMarker = lines.findIndex(function (line) {
        return /^\s*\[OPTION\]\s*$/i.test(line);
      });
      var stage = "";
      var scene = "";
      var sceneScale = 100;
      var sceneReveal = false;
      var sceneRevealDuration = 0;
      var sceneStartBlack = false;
      var option = null;
      var optionLine = -1;
      var initialEnd = optionMarker >= 0 ? optionMarker : lines.length;

      for (var i = 0; i < initialEnd; i++) {
        var trimmed = lines[i].trim();
        var stageMatch = trimmed.match(/^@stage\s+(.+?)\s*$/i);
        var sceneMatch = modules.parseNewFormatSceneDirective(trimmed);

        if (!trimmed || modules.isNewFormatIgnoredLine(lines[i])) {
          continue;
        }

        if (stageMatch) {
          if (optionMarker >= 0 || !stage) {
            stage = modules.cleanAssetPath(stageMatch[1]);
          }
        } else if (sceneMatch) {
          if (optionMarker >= 0 || !scene) {
            scene = sceneMatch.name;
            sceneScale = sceneMatch.scale;
            sceneReveal = sceneMatch.reveal;
            sceneRevealDuration = sceneMatch.revealDuration;
            sceneStartBlack = sceneMatch.startBlack;
          }
        }
      }

      if (optionMarker >= 0) {
        optionLine = modules.nextNewFormatContentLine(lines, optionMarker + 1);

        if (optionLine >= 0) {
          var optionMatch = lines[optionLine].match(/^\s*(.+?)\s*->\s*\[\s*([^\]]+?)\s*\]\s*$/);

          if (optionMatch) {
            if (optionMatch[2].trim().toLowerCase() === "continue") {
              option = { label: optionMatch[1].trim() };
            }
          }
        }
      }

      return {
        stage: stage,
        scene: scene,
        sceneScale: sceneScale,
        sceneReveal: sceneReveal,
        sceneRevealDuration: sceneRevealDuration,
        sceneStartBlack: sceneStartBlack,
        option: option,
        steps: modules.parseNewFormatSteps(
          option ? lines.slice(optionLine + 1) : lines,
          stage
        )
      };
    };
}());
