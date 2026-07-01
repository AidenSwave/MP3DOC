(function () {
  "use strict";

  var modules = setup.newFormatModules = setup.newFormatModules || {};

  modules.renderStaticMarkup = setup.projectWho.static.renderMarkup;
  modules.escapeHtml = setup.projectWho.static.escapeHtml;
  modules.initStaticFlicker = setup.projectWho.static.init;
  modules.observeStaticFlicker = setup.projectWho.static.observe;

Config.macros.typeVisitedPassages = true;
    Config.macros.typeSkipKey = "Control";

    modules.viewportMeta = document.querySelector('meta[name="viewport"]');
    if (modules.viewportMeta && !/viewport-fit\s*=\s*cover/i.test(modules.viewportMeta.content)) {
      modules.viewportMeta.content += ",viewport-fit=cover";
    }


    Config.passages.onProcess = function (passage) {
      var title = modules.passageTitle(passage);
      var extracted = modules.extractHotspotDirectives(passage.text);
      var cleanPassage = Object.create(passage);

      Object.defineProperty(cleanPassage, "text", {
        value: extracted.cleanText,
        configurable: true
      });
      if (extracted.hotspots.length) {
        setup.nfHotspots[title] = { hotspots: extracted.hotspots };
      } else {
        delete setup.nfHotspots[title];
      }

      return /^\s*@stage\s+.+$/im.test(extracted.cleanText)
        ? modules.renderNewFormatScreenplay(cleanPassage)
        : extracted.cleanText;
    };

    $(document).on("click", ".new-format-option", function (event) {
      event.preventDefault();
      setup.startNewFormatPassage($(this).attr("data-new-format-id"));
    });

    $(document).on("click", ".new-format-character-option", function (event) {
      event.preventDefault();

      var $button = $(this);
      var id = $button.attr("data-new-format-runtime-id");
      var runtime = setup.newFormatRuntime[id];
      var choiceIndex = Number($button.attr("data-new-format-choice-index"));
      var choice;
      var branchSteps;

      if (!runtime || !Number.isInteger(choiceIndex)) {
        return;
      }
      choice = runtime.currentChoices && runtime.currentChoices[choiceIndex];
      branchSteps = choice ? modules.cloneNewFormatSteps(choice.steps) : [];
      State.variables.lastNewFormatChoice = choice ? choice.label : $button.text().trim();
      $button.closest(".new-format-character-options-wrap").remove();
      if (branchSteps.length) {
        Array.prototype.splice.apply(runtime.steps, [runtime.index, 0].concat(branchSteps));
      }
      modules.runNextNewFormatStep(id);
    });

    $(document).on(":passageinit", function () {
      setup.clearNewFormatFlow();
    });

    $(modules.observeStaticFlicker);

    $(document).on(":passageend", function () {
      modules.initStaticFlicker(document);
      setup.hydrateNewFormatImages(document);
    });

    $(document)
      .on(":passagestart.nf-hotspots", function (event) {
        modules.cleanupHotspots(event && event.content ? event.content : document);
      })
      .on(":passageend.nf-hotspots", function (event) {
        modules.renderHotspotsForPassage(event && event.passage, event && event.content);
      });
}());
