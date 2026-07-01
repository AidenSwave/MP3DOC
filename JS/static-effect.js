(function () {
  "use strict";

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderStaticMarkup(text) {
    return String(text).replace(/\{static\}([\s\S]*?)\{\/static\}/gi, function (_, payload) {
      var original = String(payload || "");
      var characters = original.split("").map(function (character) {
        var displayedCharacter = /^[A-Za-z0-9]$/.test(character)
          ? offsetStaticCharacter(character)
          : character;
        var escapedOriginal = escapeHtml(character);
        var escapedDisplayed = escapeHtml(displayedCharacter);
        var alteredClass = displayedCharacter !== character ? " is-static-altered" : "";
        var ghostAttribute = displayedCharacter !== character
          ? ' data-static-ghost="' + escapedDisplayed + '"'
          : "";

        return '<span class="dialogue-static-character' + alteredClass +
          '" data-static-original="' + escapedOriginal + '"' + ghostAttribute +
          ' aria-hidden="true">' + escapedDisplayed + '</span>';
      }).join("");

      return '<span class="dialogue-static" aria-label="' + escapeHtml(original) + '">' +
        characters + '</span>';
    });
  }

  function offsetStaticCharacter(character) {
    var code = character.charCodeAt(0);
    var alphabetStart;
    var alphabetSize;
    var distance = Math.random() < 0.82 ? 1 : 2;
    var direction = Math.random() < 0.5 ? -1 : 1;

    if (code >= 65 && code <= 90) {
      alphabetStart = 65;
      alphabetSize = 26;
    } else if (code >= 97 && code <= 122) {
      alphabetStart = 97;
      alphabetSize = 26;
    } else if (code >= 48 && code <= 57) {
      alphabetStart = 48;
      alphabetSize = 10;
    } else {
      return character;
    }

    return String.fromCharCode(
      alphabetStart + (code - alphabetStart + direction * distance + alphabetSize) % alphabetSize
    );
  }

  function updateStaticCharacters(element) {
    var characters = Array.prototype.slice.call(
      element.querySelectorAll(".dialogue-static-character")
    );
    var mutable = characters.filter(function (character) {
      return /^[A-Za-z0-9]$/.test(character.getAttribute("data-static-original"));
    });
    var altered = mutable.filter(function (character) {
      return character.textContent !== character.getAttribute("data-static-original");
    });
    var unaltered = mutable.filter(function (character) {
      return character.textContent === character.getAttribute("data-static-original");
    });
    var minimumAltered = Math.max(1, Math.ceil(mutable.length * 0.72));
    var maximumAltered = Math.max(minimumAltered, Math.ceil(mutable.length * 0.92));
    var actionRoll = Math.random();
    var target;
    var replacementCandidates;

    if (!mutable.length) {
      return;
    }

    if (altered.length && actionRoll < 0.32) {
      target = altered[Math.floor(Math.random() * altered.length)];
      target.textContent = target.getAttribute("data-static-original");

      if (altered.length <= minimumAltered) {
        replacementCandidates = mutable.filter(function (character) {
          return character !== target &&
            character.textContent === character.getAttribute("data-static-original");
        });

        if (replacementCandidates.length) {
          target = replacementCandidates[Math.floor(Math.random() * replacementCandidates.length)];
          target.textContent = offsetStaticCharacter(target.textContent);
        }
      }

      return;
    }

    if (actionRoll < 0.83) {
      if (altered.length >= maximumAltered) {
        target = altered[Math.floor(Math.random() * altered.length)];
      } else if (unaltered.length && Math.random() < 0.72) {
        target = unaltered[Math.floor(Math.random() * unaltered.length)];
      } else {
        target = mutable[Math.floor(Math.random() * mutable.length)];
      }

      target.textContent = offsetStaticCharacter(target.textContent);
    }
  }

  function disturbStaticCharacters(element) {
    var characters = element.querySelectorAll(".dialogue-static-character.is-static-altered");

    Array.prototype.forEach.call(characters, function (character) {
      var intensity = Math.random();
      var horizontalRange = intensity < 0.24 ? 12 : 6.4;
      var verticalRange = intensity < 0.24 ? 5.2 : 3.4;

      character.setAttribute("data-static-ghost", character.textContent);
      character.style.setProperty(
        "--static-x",
        ((Math.random() - 0.5) * horizontalRange).toFixed(2) + "px"
      );
      character.style.setProperty(
        "--static-y",
        ((Math.random() - 0.5) * verticalRange).toFixed(2) + "px"
      );
      character.style.setProperty(
        "--static-skew",
        ((Math.random() - 0.5) * 12).toFixed(2) + "deg"
      );
      character.style.setProperty(
        "--static-blur",
        (0.6 + Math.random() * 1.55).toFixed(2) + "px"
      );
      character.style.setProperty(
        "--static-opacity",
        (0.16 + Math.random() * 0.56).toFixed(2)
      );
      character.style.setProperty(
        "--static-ghost-x",
        ((Math.random() - 0.5) * 10).toFixed(2) + "px"
      );
      character.style.setProperty(
        "--static-ghost-y",
        ((Math.random() - 0.5) * 4).toFixed(2) + "px"
      );
      character.style.setProperty(
        "--static-ghost-back-x",
        ((Math.random() - 0.5) * 8).toFixed(2) + "px"
      );
      character.style.setProperty(
        "--static-ghost-back-y",
        ((Math.random() - 0.5) * 3.2).toFixed(2) + "px"
      );
    });
  }

  function enforceStaticCorruptionFloor(element) {
    var mutable = Array.prototype.slice.call(
      element.querySelectorAll(".dialogue-static-character")
    ).filter(function (character) {
      return /^[A-Za-z0-9]$/.test(character.getAttribute("data-static-original"));
    });
    var minimumAltered = Math.max(1, Math.ceil(mutable.length * 0.72));
    var alteredCount = mutable.filter(function (character) {
      return character.textContent !== character.getAttribute("data-static-original");
    }).length;
    var candidates;
    var target;

    while (alteredCount < minimumAltered) {
      candidates = mutable.filter(function (character) {
        return character.textContent === character.getAttribute("data-static-original");
      });

      if (!candidates.length) {
        return;
      }

      target = candidates[Math.floor(Math.random() * candidates.length)];
      target.textContent = offsetStaticCharacter(target.textContent);
      alteredCount += 1;
    }
  }

  function refreshStaticCharacterStates(element) {
    var visualProperties = [
      "--static-x",
      "--static-y",
      "--static-skew",
      "--static-blur",
      "--static-opacity",
      "--static-ghost-x",
      "--static-ghost-y",
      "--static-ghost-back-x",
      "--static-ghost-back-y"
    ];
    var characters = element.querySelectorAll(".dialogue-static-character");

    Array.prototype.forEach.call(characters, function (character) {
      var original = character.getAttribute("data-static-original");

      if (character.textContent !== original) {
        character.classList.add("is-static-altered");
        character.setAttribute("data-static-ghost", character.textContent);
        return;
      }

      character.classList.remove("is-static-altered");
      character.removeAttribute("data-static-ghost");
      visualProperties.forEach(function (property) {
        character.style.removeProperty(property);
      });
    });
  }

  function startStaticFlicker(element) {
    var flickerPhase = false;

    if (element.getAttribute("data-static-flicker") === "active") {
      return;
    }

    element.setAttribute("data-static-flicker", "active");
    refreshStaticCharacterStates(element);

    function moveAlteredCharacters() {
      if (!document.documentElement.contains(element)) {
        return;
      }

      disturbStaticCharacters(element);
      setTimeout(moveAlteredCharacters, 18 + Math.random() * 95);
    }

    function flicker() {
      var delay;
      var timingRoll;

      if (!document.documentElement.contains(element)) {
        return;
      }

      flickerPhase = !flickerPhase;
      updateStaticCharacters(element);
      enforceStaticCorruptionFloor(element);
      refreshStaticCharacterStates(element);
      timingRoll = Math.random();

      if (flickerPhase) {
        if (timingRoll < 0.35) {
          delay = 8 + Math.random() * 22;
        } else if (timingRoll < 0.85) {
          delay = 25 + Math.random() * 65;
        } else {
          delay = 95 + Math.random() * 100;
        }
      } else {
        if (timingRoll < 0.45) {
          delay = 8 + Math.random() * 30;
        } else if (timingRoll < 0.9) {
          delay = 40 + Math.random() * 90;
        } else {
          delay = 140 + Math.random() * 180;
        }
      }

      setTimeout(flicker, delay);
    }

    setTimeout(moveAlteredCharacters, Math.random() * 90);
    setTimeout(flicker, Math.random() * 180);
  }

  function initStaticFlicker(root) {
    var staticElements = $(root).filter(".dialogue-static")
      .add($(root).find(".dialogue-static"));

    staticElements.each(function () {
      startStaticFlicker(this);
    });
  }

  function observeStaticFlicker() {
    var observationRoot = document.getElementById("passages") || document.body;
    var observer;

    if (!observationRoot || !window.MutationObserver || setup.staticFlickerObserver) {
      return;
    }

    observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.prototype.forEach.call(mutation.addedNodes, function (node) {
          var containingStatic;

          if (node.nodeType !== 1) {
            return;
          }

          containingStatic = $(node).closest(".dialogue-static");

          if (containingStatic.length) {
            startStaticFlicker(containingStatic[0]);
          }

          initStaticFlicker(node);
        });
      });
    });

    observer.observe(observationRoot, {
      childList: true,
      subtree: true
    });

    setup.staticFlickerObserver = observer;
    initStaticFlicker(observationRoot);
  }

  setup.projectWho.static = {
    escapeHtml: escapeHtml,
    renderMarkup: renderStaticMarkup,
    init: initStaticFlicker,
    observe: observeStaticFlicker
  };
}());
