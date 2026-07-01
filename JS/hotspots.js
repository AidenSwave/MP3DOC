(function () {
  "use strict";

  var modules = setup.newFormatModules = setup.newFormatModules || {};

modules.cleanHotspotTarget = function cleanHotspotTarget(target) {
      return String(target || "").trim().replace(/^['"]|['"]$/g, "").trim();
    };

    modules.parseHotspotNumberMap = function parseHotspotNumberMap(text) {
      var values = {};
      var match;
      var pattern = /\b(x|y|r)\s*:?\s*(-?\d+(?:\.\d+)?)\b/gi;

      while ((match = pattern.exec(String(text || "")))) {
        values[match[1].toLowerCase()] = Number(match[2]);
      }
      return values;
    };

    modules.parseHotspotLine = function parseHotspotLine(line) {
      var match = String(line || "").match(
        /^\s*@hotspot\s+\[\[([^\]]+?)\]\]\s*\{\s*([^{}]+)\s*\}\s*$/i
      );
      var values;
      var target;

      if (!match) {
        return null;
      }
      target = modules.cleanHotspotTarget(match[1]);
      values = modules.parseHotspotNumberMap(match[2]);
      if (!target || !isFinite(values.x) || !isFinite(values.y) ||
          !isFinite(values.r) || values.r <= 0) {
        return null;
      }
      return { label: target, target: target, x: values.x, y: values.y, r: values.r };
    };

    modules.extractHotspotDirectives = function extractHotspotDirectives(text) {
      var hotspots = [];
      var cleaned = [];

      String(text || "").replace(/\r\n?/g, "\n").split("\n").forEach(function (line) {
        var hotspot = modules.parseHotspotLine(line);

        if (/^\s*@hotspot\b/i.test(line)) {
          if (hotspot) {
            hotspots.push(hotspot);
          } else {
            console.warn("Invalid @hotspot ignored:", line);
          }
          return;
        }
        cleaned.push(line);
      });

      return { hotspots: hotspots, cleanText: cleaned.join("\n") };
    };

    modules.passageTitle = function passageTitle(passage) {
      return String((passage && (passage.title || passage.name)) ||
        (window.State && State.passage) || "");
    };

    setup.nfHotspots = setup.nfHotspots || {};


    modules.cleanupHotspots = function cleanupHotspots(root) {
      $(root || document).find(".new-format-stage").each(function () {
        if (this.nfHotspotObserver) {
          this.nfHotspotObserver.disconnect();
          this.nfHotspotObserver = null;
        }
        $(this)
          .removeClass("nf-hotspots-active nf-hotspots-blocked")
          .removeData("nf-hotspot-navigating nf-hotspots-blocked")
          .find(".nf-hotspot-layer")
          .remove();
      });
    };

    modules.fadeToHotspotTarget = function fadeToHotspotTarget($stage, target) {
      var $fade;
      var finalTarget = target;

      if (!finalTarget || $stage.data("nf-hotspot-navigating")) {
        return;
      }

      $stage.data("nf-hotspot-navigating", true);
      $stage.find(".nf-hotspot-layer").addClass("is-disabled");

      $fade = $stage.children(".new-format-black-fade").last();
      if (!$fade.length) {
        $fade = $('<div class="new-format-black-fade" aria-hidden="true"></div>').appendTo($stage);
      }

      $fade.css("transition", "opacity 200ms ease");
      if ($fade.get(0)) {
        $fade.get(0).offsetWidth;
      }
      $fade.addClass("is-active");

      setTimeout(function () {
        Engine.play(finalTarget);
      }, 200);
    };

    modules.positionLabelWithinStage = function positionLabelWithinStage(hotspot) {
      var label = hotspot.querySelector(".nf-hotspot-label");
      var stage = $(hotspot).closest(".new-format-stage").get(0);
      var stageRect;
      var labelRect;
      var shift = 0;

      if (!label || !stage) {
        return;
      }

      label.classList.remove("is-below");
      label.style.setProperty("--nf-label-shift", "0px");

      stageRect = stage.getBoundingClientRect();
      labelRect = label.getBoundingClientRect();

      if (labelRect.left < stageRect.left + 8) {
        shift = (stageRect.left + 8) - labelRect.left;
      } else if (labelRect.right > stageRect.right - 8) {
        shift = (stageRect.right - 8) - labelRect.right;
      }

      if (labelRect.top < stageRect.top + 8) {
        label.classList.add("is-below");
      }

      label.style.setProperty("--nf-label-shift", shift + "px");
    };

    modules.updateHotspotState = function updateHotspotState(stage) {
      var $stage = $(stage);
      var blocked = $stage.is("[hidden]") ||
        $stage.closest(".new-format-flow").find(".new-format-prestage, .new-format-validation-error").length > 0;

      if ($stage.data("nf-hotspots-blocked") === blocked) {
        return;
      }
      $stage.data("nf-hotspots-blocked", blocked)
        .toggleClass("nf-hotspots-blocked", blocked);
      $stage.find(".nf-hotspot").prop("disabled", blocked);
    };

    modules.watchHotspotState = function watchHotspotState($stage) {
      var stage = $stage.get(0);

      if (!stage || !window.MutationObserver) {
        modules.updateHotspotState(stage);
        return;
      }

      if (stage.nfHotspotObserver) {
        stage.nfHotspotObserver.disconnect();
      }

      stage.nfHotspotObserver = new MutationObserver(function () {
        modules.updateHotspotState(stage);
      });
      stage.nfHotspotObserver.observe(stage, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "hidden"]
      });

      modules.updateHotspotState(stage);
    };

    modules.addHotspotElement = function addHotspotElement($layer, $stage, hotspot) {
      var diameter = hotspot.r * 2;
      var $hotspot = $('<button type="button" class="nf-hotspot"></button>')
        .attr("aria-label", hotspot.label)
        .css({
          left: "calc(50% + " + hotspot.x + "px - " + hotspot.r + "px)",
          top: "calc(50% + " + hotspot.y + "px - " + hotspot.r + "px)",
          width: diameter + "px",
          height: diameter + "px"
        });
      var $label = $('<span class="nf-hotspot-label"></span>').text(hotspot.label);

      $hotspot.append($label)
        .on("mouseenter focus", function () { modules.positionLabelWithinStage(this); })
        .on("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          modules.fadeToHotspotTarget($stage, hotspot.target);
        });
      $layer.append($hotspot);
    };

    modules.renderHotspotsForPassage = function renderHotspotsForPassage(passage, root, attempt) {
      var title = modules.passageTitle(passage);
      var data = setup.nfHotspots[title];
      var $root = $(root || document);
      var $stage = $root.find(".new-format-stage").last();
      var $layer;

      attempt = Number(attempt || 0);
      modules.cleanupHotspots($root);

      if (!$stage.length) {
        if (attempt < 20) {
          setTimeout(function () {
            modules.renderHotspotsForPassage(passage, document, attempt + 1);
          }, 50);
        }
        return;
      }

      if (!data || !data.hotspots.length) {
        return;
      }

      $stage.addClass("nf-hotspots-active");
      $layer = $('<div class="nf-hotspot-layer" aria-label="Point and click hotspots"></div>').css({
        position: "absolute",
        inset: 0,
        zIndex: 10,
        pointerEvents: "none",
        opacity: 1
      });

      data.hotspots.forEach(function (hotspot) {
        modules.addHotspotElement($layer, $stage, hotspot);
      });

      $stage.append($layer);

      modules.watchHotspotState($stage);
      requestAnimationFrame(function () { modules.updateHotspotState($stage.get(0)); });
    };
}());
