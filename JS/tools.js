(function () {
  "use strict";

  var modules = setup.newFormatModules = setup.newFormatModules || {};

modules.cleanText = function cleanText(text) {
      return String(text)
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    };

    modules.defaultCharacterTransform = function defaultCharacterTransform() {
      return { x: 0, y: 0, scale: 100 };
    };

    modules.normalizeCharacterTransform = function normalizeCharacterTransform(transform) {
      var source = transform || {};
      var x = Number(source.x);
      var y = Number(source.y);
      var scale = Number(source.scale);

      return {
        x: isFinite(x) ? x : 0,
        y: isFinite(y) ? y : 0,
        scale: isFinite(scale) && scale > 0 ? scale : 100
      };
    };

    modules.newFormatCharacterTransformCss = function newFormatCharacterTransformCss(transform) {
      var normalized = modules.normalizeCharacterTransform(transform);
      return "translate3d(" + normalized.x + "px, " +
        normalized.y + "px, 0) scale(" + normalized.scale / 100 + ")";
    };

    modules.clampNumber = function clampNumber(value, min, max) {
      return Math.max(min, Math.min(max, value));
    };

    modules.newFormatCloseupBackgroundFocus = function newFormatCloseupBackgroundFocus(transform, bounds) {
      var normalized = modules.normalizeCharacterTransform(transform);
      var width = bounds && Number(bounds.width) > 0 ? Number(bounds.width) : 1320;
      var height = bounds && Number(bounds.height) > 0 ? Number(bounds.height) : 720;

      return {
        x: modules.clampNumber(normalized.x * -0.12, -70, 70),
        y: modules.clampNumber(normalized.y * -0.07, -38, 38),
        originX: modules.clampNumber(50 + (normalized.x / Math.max(width, 1)) * 100, 16, 84),
        originY: modules.clampNumber(50 + (normalized.y / Math.max(height, 1)) * 82, 18, 82)
      };
    };


    /* Screenplay runtime and stage-aware GitHub routing. */
    setup.newFormatSequenceFrameDelay = 650;
    setup.newFormatSceneDelay = 1000;
    setup.newFormatVideoFrameDelay = 1000 / 24;
    setup.newFormatFadeDuration = 350;
    setup.newFormatSceneBlurAmount = 18;
    setup.newFormatRevealFadeDuration = 2200;
    setup.newFormatRevealZoomDuration = 4500;
    setup.newFormatRevealZoomAmount = 35;
    setup.newFormatRevealMotionLead = 300;
    setup.newFormatDialoguePause = 700;
    setup.newFormatVoicedTypeDelay = 8;
    setup.newFormatVoicedTextDelay = 60;
    setup.newFormatDialogueOverlap = 250;
    setup.newFormatDialogueTypingEvent = "";
    setup.newFormatDialogueAudioPlayers = setup.newFormatDialogueAudioPlayers || [
      new Audio(),
      new Audio()
    ];
    setup.newFormatDialogueAudioIndex = setup.newFormatDialogueAudioIndex || 0;
    setup.newFormatAudioEffectPlayers = setup.newFormatAudioEffectPlayers || [
      new Audio(),
      new Audio(),
      new Audio(),
      new Audio()
    ];
    setup.newFormatDialogueAudioPlayers.concat(setup.newFormatAudioEffectPlayers)
      .forEach(function (audio) {
        audio.preload = "auto";
      });
    setup.newFormatAudioEffects = setup.newFormatAudioEffects || [];
    setup.newFormatFlowTimers = setup.newFormatFlowTimers || [];
    setup.newFormatAnimationFrames = setup.newFormatAnimationFrames || [];
    setup.newFormatRuntime = setup.newFormatRuntime || {};
    setup.newFormatPassages = setup.newFormatPassages || {};
    setup.newFormatPassageCounter = setup.newFormatPassageCounter || 0;
    setup.newFormatStageCache = setup.newFormatStageCache || {};
    setup.newFormatPreparedAssetUrls = setup.newFormatPreparedAssetUrls || {};
}());
