(function () {
  "use strict";

  var modules = setup.newFormatModules = setup.newFormatModules || {};

modules.githubAssetConfig = setup.projectWho && setup.projectWho.assets
      ? setup.projectWho.assets
      : {
        owner: "AidenSwave",
        repository: "MP3DOC",
        branch: "main",
        root: "Assets"
      };
    modules.githubAssetExtensions = /\.(?:avif|gif|jpe?g|m4a|mp3|mp4|ogg|otf|png|svg|wav|webm|webp|woff2?)$/i;
    modules.imageAssetExtensions = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

    setup.githubAssetIndex = setup.githubAssetIndex || null;
    setup.githubAssetIndexPromise = setup.githubAssetIndexPromise || null;
    setup.githubAssetRevision = setup.githubAssetRevision || "session";
    setup.imagePreloadCache = setup.imagePreloadCache || {};
    setup.newFormatMediaCache = setup.newFormatMediaCache || {};
    setup.newFormatAllAssetsPromise = setup.newFormatAllAssetsPromise || null;

    modules.cleanAssetPath = function cleanAssetPath(path) {
      return String(path || "")
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "")
        .replace(/\/{2,}/g, "/");
    };

    modules.assetKey = function assetKey(path) {
      return modules.cleanAssetPath(path).replace(/\.[^./]+$/, "")
        .toLowerCase()
        .split("/")
        .map(function (part) { return part.replace(/[^a-z0-9]+/g, ""); })
        .join("/");
    };

    modules.encodedGithubPath = function encodedGithubPath(path) {
      return modules.cleanAssetPath(path).split("/").map(function (part) {
        return encodeURIComponent(part);
      }).join("/");
    };

    modules.githubAssetPath = function githubAssetPath(path) {
      var root = modules.cleanAssetPath(modules.githubAssetConfig.root || "Assets");
      var cleanPath = modules.cleanAssetPath(path);

      if (!root || cleanPath.toLowerCase() === root.toLowerCase() ||
          cleanPath.toLowerCase().startsWith(root.toLowerCase() + "/")) {
        return cleanPath;
      }
      return modules.cleanAssetPath(root + "/" + cleanPath);
    };

    modules.githubRawAssetUrl = function githubRawAssetUrl(path) {
      return "https://raw.githubusercontent.com/" +
        encodeURIComponent(modules.githubAssetConfig.owner) + "/" +
        encodeURIComponent(modules.githubAssetConfig.repository) + "/" +
        encodeURIComponent(modules.githubAssetConfig.branch) + "/" +
        modules.encodedGithubPath(modules.githubAssetPath(path)) + "?v=" +
        encodeURIComponent(setup.githubAssetRevision);
    };

    setup.loadGithubAssetIndex = function (forceRefresh) {
      var apiUrl;

      if (!forceRefresh && setup.githubAssetIndex) {
        return Promise.resolve(setup.githubAssetIndex);
      }
      if (setup.githubAssetIndexPromise) {
        return setup.githubAssetIndexPromise;
      }

      apiUrl = "https://api.github.com/repos/" +
        encodeURIComponent(modules.githubAssetConfig.owner) + "/" +
        encodeURIComponent(modules.githubAssetConfig.repository) + "/git/trees/" +
        encodeURIComponent(modules.githubAssetConfig.branch) + "?recursive=1";

      setup.githubAssetIndexPromise = fetch(apiUrl, {
        headers: { Accept: "application/vnd.github+json" }
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("GitHub asset scan failed with HTTP " + response.status);
        }
        return response.json();
      }).then(function (payload) {
        if (!payload || !Array.isArray(payload.tree)) {
          throw new Error("GitHub returned an invalid repository tree");
        }

        var assetRoot = modules.cleanAssetPath(modules.githubAssetConfig.root || "Assets");
        var assetPrefix = assetRoot.toLowerCase() + "/";

        setup.githubAssetIndex = payload.tree.filter(function (item) {
          var path = modules.cleanAssetPath(item && item.path);
          return item && item.type === "blob" &&
            (!assetRoot || path.toLowerCase().startsWith(assetPrefix)) &&
            modules.githubAssetExtensions.test(path);
        }).map(function (item) { return modules.cleanAssetPath(item.path); });
        setup.githubAssetRevision = String(payload.sha || Date.now());
        setup.githubAssetIndexPromise = null;
        return setup.githubAssetIndex;
      }).catch(function (error) {
        setup.githubAssetIndexPromise = null;
        throw error;
      });

      return setup.githubAssetIndexPromise;
    };

    setup.preloadImage = function (source) {
      var url = String(source || "").trim().replace(/^["']|["']$/g, "");
      var image;

      if (!url) {
        return null;
      }
      if (setup.imagePreloadCache[url]) {
        return setup.imagePreloadCache[url];
      }

      image = new Image();
      image.decoding = "async";
      image.loading = "eager";
      setup.imagePreloadCache[url] = image;
      image.src = url;
      return image;
    };

    modules.storyVariable = function storyVariable(name) {
      return State && State.variables ? State.variables[name] : undefined;
    };


    modules.newFormatAssetPath = function newFormatAssetPath(stage, category, reference) {
      return modules.cleanAssetPath([
        modules.cleanAssetPath(stage),
        modules.cleanAssetPath(category),
        modules.cleanAssetPath(reference)
      ].filter(Boolean).join("/"));
    };

    modules.newFormatAssetMatch = function newFormatAssetMatch(paths, requested) {
      var requestedKey = modules.assetKey(requested);
      var extensionOrder = [".png", ".webp", ".jpg", ".jpeg", ".gif", ".avif", ".svg"];

      return paths.filter(function (path) {
        var pathKey = modules.assetKey(path);
        return pathKey === requestedKey || pathKey.endsWith("/" + requestedKey);
      }).sort(function (left, right) {
        var leftExtension = (left.match(/\.[^./]+$/) || [""])[0].toLowerCase();
        var rightExtension = (right.match(/\.[^./]+$/) || [""])[0].toLowerCase();
        var leftRank = extensionOrder.indexOf(leftExtension);
        var rightRank = extensionOrder.indexOf(rightExtension);

        leftRank = leftRank < 0 ? extensionOrder.length : leftRank;
        rightRank = rightRank < 0 ? extensionOrder.length : rightRank;
        return leftRank - rightRank || left.length - right.length;
      })[0] || "";
    };

    setup.resolveNewFormatAsset = function (reference) {
      var requested = modules.cleanAssetPath(reference);

      if (!requested) {
        return Promise.reject(new Error("New-format asset reference is empty"));
      }

      return setup.loadGithubAssetIndex().then(function (paths) {
        var match = modules.newFormatAssetMatch(paths, requested);

        if (!match) {
          throw new Error("No GitHub asset matches " + requested);
        }
        return modules.githubRawAssetUrl(match);
      });
    };

    modules.newFormatSequenceFrames = function newFormatSequenceFrames(paths, stage, sequence) {
      var folder = modules.newFormatAssetPath(stage, "Sequences", sequence);
      var folderKey = modules.assetKey(folder);
      var numberedFrames = paths.map(function (path) {
        var cleanPath = modules.cleanAssetPath(path);
        var slash = cleanPath.lastIndexOf("/");
        var directory = slash >= 0 ? cleanPath.slice(0, slash) : "";
        var filename = slash >= 0 ? cleanPath.slice(slash + 1) : cleanPath;
        var frameMatch = filename.match(/^Frame[\s_-]*(\d+)\.(?:avif|gif|jpe?g|png|svg|webp)$/i);
        var directoryKey = modules.assetKey(directory);

        if (!frameMatch || (directoryKey !== folderKey && !directoryKey.endsWith("/" + folderKey))) {
          return null;
        }

        return {
          number: Number(frameMatch[1]),
          path: cleanPath
        };
      }).filter(Boolean).sort(function (left, right) {
        return left.number - right.number;
      });
      var contiguous = [];

      for (var expected = 1; expected <= numberedFrames.length; expected++) {
        var frame = numberedFrames.find(function (candidate) {
          return candidate.number === expected;
        });

        if (!frame) {
          break;
        }

        contiguous.push({
          number: frame.number,
          path: frame.path,
          url: modules.githubRawAssetUrl(frame.path)
        });
      }

      return contiguous;
    };

    setup.loadNewFormatSequence = function (stage, sequence) {
      return setup.loadGithubAssetIndex().then(function (paths) {
        var frames = modules.newFormatSequenceFrames(paths, stage, sequence);
        if (!frames.length) {
          throw new Error("No sequence frames found in " +
            modules.newFormatAssetPath(stage, "Sequences", sequence));
        }
        return frames;
      });
    };

    modules.newFormatVideoFrames = function newFormatVideoFrames(paths, stage, video) {
      var folderKeys = [
        modules.assetKey(modules.newFormatAssetPath(stage, "Video", video)),
        modules.assetKey(modules.newFormatAssetPath(stage, "Videos", video))
      ];
      var numberedFrames = paths.map(function (path) {
        var cleanPath = modules.cleanAssetPath(path);
        var slash = cleanPath.lastIndexOf("/");
        var directory = slash >= 0 ? cleanPath.slice(0, slash) : "";
        var filename = slash >= 0 ? cleanPath.slice(slash + 1) : cleanPath;
        var frameMatch = filename.match(/^Frame[\s_-]*(\d+)\.(?:avif|gif|jpe?g|png|svg|webp)$/i);
        var directoryKey = modules.assetKey(directory);
        var folderMatch = folderKeys.some(function (folderKey) {
          return directoryKey === folderKey || directoryKey.endsWith("/" + folderKey);
        });

        if (!frameMatch || !folderMatch) {
          return null;
        }

        return {
          number: Number(frameMatch[1]),
          path: cleanPath
        };
      }).filter(Boolean).sort(function (left, right) {
        return left.number - right.number;
      });
      var contiguous = [];

      for (var expected = 0; expected <= numberedFrames.length; expected++) {
        var frame = numberedFrames.find(function (candidate) {
          return candidate.number === expected;
        });

        if (!frame) {
          break;
        }

        contiguous.push({
          number: frame.number,
          path: frame.path,
          url: modules.githubRawAssetUrl(frame.path)
        });
      }

      return contiguous;
    };

    setup.loadNewFormatVideo = function (stage, video) {
      function requireFrames(paths) {
        var frames = modules.newFormatVideoFrames(paths, stage, video);

        if (!frames.length) {
          throw new Error("No video frames found in " +
            modules.newFormatAssetPath(stage, "Videos", video));
        }

        return frames;
      }

      return setup.loadGithubAssetIndex().then(requireFrames).then(function (frames) {
        return Promise.all(frames.map(function (frame) {
          return modules.preloadNewFormatUrl(frame.url).catch(function (error) {
            console.warn("New-format video preload warning:", error.message || String(error));
          });
        })).then(function () {
          return frames;
        });
      });
    };

    modules.newFormatStageRegistry = function newFormatStageRegistry(paths, stage) {
      var stageName = modules.cleanAssetPath(stage);
      var stageKey = stageName.toLowerCase();
      var registry = {
        stage: stageName,
        paths: [],
        audioPaths: [],
        soundPaths: [],
        scenes: [],
        characters: [],
        sequences: [],
        videos: [],
        dialogues: [],
        sounds: []
      };

      paths.forEach(function (path) {
        var cleanPath = modules.cleanAssetPath(path);
        var parts = cleanPath.split("/");
        var stageIndex = parts.findIndex(function (part) {
          return part.toLowerCase() === stageKey;
        });

        if (stageIndex < 0 || stageIndex + 2 >= parts.length) {
          return;
        }

        var category = parts[stageIndex + 1].toLowerCase();
        var name;

        if (category === "scenes" || category === "characters") {
          name = parts.slice(stageIndex + 2).join("/").replace(/\.[^./]+$/, "");

          if (!name) {
            return;
          }

          if (category === "characters" && parts.length > stageIndex + 3) {
            name = parts[stageIndex + 2];
          }

          if (!registry[category].includes(name)) {
            registry[category].push(name);
          }
          if (!registry.paths.includes(cleanPath)) {
            registry.paths.push(cleanPath);
          }
          return;
        }

        if (category === "sequences") {
          name = parts[stageIndex + 2];

          if (!name) {
            return;
          }

          if (!registry.sequences.includes(name)) {
            registry.sequences.push(name);
          }
          if (!registry.paths.includes(cleanPath)) {
            registry.paths.push(cleanPath);
          }
          return;
        }

        if (category === "video" || category === "videos") {
          name = parts[stageIndex + 2];

          if (!name) {
            return;
          }

          if (!registry.videos.includes(name)) {
            registry.videos.push(name);
          }
          if (!registry.paths.includes(cleanPath)) {
            registry.paths.push(cleanPath);
          }
          return;
        }

        if (category === "dialogue" || category === "dialogues") {
          name = parts[stageIndex + 2];

          if (!name || !/\.wav$/i.test(cleanPath)) {
            return;
          }

          if (!registry.dialogues.includes(name)) {
            registry.dialogues.push(name);
          }
          if (!registry.audioPaths.includes(cleanPath)) {
            registry.audioPaths.push(cleanPath);
          }
          return;
        }

        if (category === "audio" || category === "audios") {
          name = parts.slice(stageIndex + 2).join("/").replace(/\.(?:mp3|wav)$/i, "");

          if (!name || !/\.(?:mp3|wav)$/i.test(cleanPath)) {
            return;
          }

          if (!registry.sounds.includes(name)) {
            registry.sounds.push(name);
          }
          if (!registry.soundPaths.includes(cleanPath)) {
            registry.soundPaths.push(cleanPath);
          }
        }
      });

      [registry.scenes, registry.characters, registry.sequences, registry.videos,
        registry.dialogues, registry.sounds].forEach(function (names) {
        names.sort(function (left, right) {
          return left.localeCompare(right);
        });
      });

      registry.audioPaths.sort(function (left, right) {
        return left.localeCompare(right, undefined, { numeric: true });
      });
      registry.soundPaths.sort(function (left, right) {
        return left.localeCompare(right, undefined, { numeric: true });
      });

      return registry;
    };

    modules.preloadNewFormatUrl = function preloadNewFormatUrl(url, attempt) {
      attempt = Number(attempt || 0);

      return new Promise(function (resolve, reject) {
        var cached = setup.imagePreloadCache[url];
        var image = cached || new Image();

        function loaded() {
          if (typeof image.decode === "function") {
            image.decode().then(finishLoaded, finishLoaded);
            return;
          }

          finishLoaded();
        }

        function finishLoaded() {
          cleanup();
          resolve(url);
        }

        function failed() {
          cleanup();

          if (setup.imagePreloadCache[url] === image) {
            delete setup.imagePreloadCache[url];
          }

          if (attempt < 1) {
            resolve(modules.preloadNewFormatUrl(url, attempt + 1));
            return;
          }

          reject(new Error("Could not preload " + url));
        }

        function cleanup() {
          image.removeEventListener("load", loaded);
          image.removeEventListener("error", failed);
        }

        if (image.complete) {
          if (image.naturalWidth > 0) {
            resolve(url);
          } else {
            failed();
          }
          return;
        }

        image.addEventListener("load", loaded);
        image.addEventListener("error", failed);

        if (!cached) {
          image.decoding = "async";
          image.loading = "eager";
          setup.imagePreloadCache[url] = image;
          image.src = url;
        }
      });
    };

    modules.updateNewFormatLoading = function updateNewFormatLoading(done, total, label) {
      var percent = total ? Math.round(done / total * 100) : 100;

      $(".new-format-prestage").each(function () {
        $(this).find(".new-format-prestage-status").text(
          label || (done < total ? "Caching the story…" : "Story ready")
        );
        $(this).find(".new-format-load-meter").attr({
          "aria-valuenow": percent,
          "aria-valuetext": done + " of " + total + " assets"
        }).find(".new-format-load-bar").css("width", percent + "%");
        $(this).find(".new-format-load-count").text(percent + "%");
      });
    };

    modules.cacheNewFormatAsset = function cacheNewFormatAsset(path) {
      var url = modules.githubRawAssetUrl(path);

      if (setup.newFormatMediaCache[url]) {
        return setup.newFormatMediaCache[url];
      }

      setup.newFormatMediaCache[url] = fetch(url, { cache: "force-cache" })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("HTTP " + response.status + " for " + path);
          }
          return response.blob();
        }).then(function (blob) {
          if (!modules.imageAssetExtensions.test(path)) {
            return url;
          }

          return new Promise(function (resolve) {
            var objectUrl = URL.createObjectURL(blob);
            var image = new Image();

            function finish() {
              URL.revokeObjectURL(objectUrl);
              resolve(url);
            }

            image.onload = function () {
              if (typeof image.decode === "function") {
                image.decode().then(finish, finish);
              } else {
                finish();
              }
            };
            image.onerror = finish;
            image.src = objectUrl;
          });
        }).catch(function (error) {
          delete setup.newFormatMediaCache[url];
          throw error;
        });

      return setup.newFormatMediaCache[url];
    };

    setup.prepareAllNewFormatAssets = function () {
      if (setup.newFormatAllAssetsPromise) {
        return setup.newFormatAllAssetsPromise;
      }

      setup.newFormatAllAssetsPromise = setup.loadGithubAssetIndex(true).then(function (paths) {
        var next = 0;
        var done = 0;
        var failures = [];
        var workerCount = Math.min(6, paths.length);

        paths.forEach(function (path) {
          setup.newFormatPreparedAssetUrls[modules.assetKey(path)] = modules.githubRawAssetUrl(path);
        });
        modules.updateNewFormatLoading(0, paths.length, "Caching the complete story…");

        function worker() {
          var index = next++;
          var path;

          if (index >= paths.length) {
            return Promise.resolve();
          }
          path = paths[index];
          return modules.cacheNewFormatAsset(path).catch(function (error) {
            failures.push({ path: path, message: error.message || String(error) });
          }).then(function () {
            done += 1;
            modules.updateNewFormatLoading(done, paths.length);
            return worker();
          });
        }

        return Promise.all(Array.apply(null, { length: workerCount }).map(worker))
          .then(function () {
            failures.forEach(function (failure) {
              console.warn("New-format preload warning:", failure.path, failure.message);
            });
            modules.updateNewFormatLoading(paths.length, paths.length, "Story ready");
            return paths;
          });
      }).catch(function (error) {
        setup.newFormatAllAssetsPromise = null;
        throw error;
      });

      return setup.newFormatAllAssetsPromise;
    };

    setup.prepareNewFormatStage = function (stage) {
      var stageName = modules.cleanAssetPath(stage);
      var cacheKey = stageName.toLowerCase();

      if (!stageName) {
        return Promise.reject(new Error("No @stage has been set"));
      }

      if (setup.newFormatStageCache[cacheKey]) {
        return setup.newFormatStageCache[cacheKey];
      }

      setup.newFormatStageCache[cacheKey] = setup.prepareAllNewFormatAssets().then(function (paths) {
        var registry = modules.newFormatStageRegistry(paths, stageName);
        if (!registry.paths.length) {
          throw new Error("No assets registered for stage " + stageName);
        }
        return registry;
      }).catch(function (error) {
        delete setup.newFormatStageCache[cacheKey];
        throw error;
      });

      return setup.newFormatStageCache[cacheKey];
    };

    setup.hydrateNewFormatImages = function (root) {
      $(root).filter("img[data-new-format-asset]")
        .add($(root).find("img[data-new-format-asset]"))
        .each(function () {
          var image = this;
          var reference = image.getAttribute("data-new-format-asset");

          if (!reference || image.getAttribute("data-new-format-state")) {
            return;
          }

          image.setAttribute("data-new-format-state", "resolving");
          setup.resolveNewFormatAsset(reference).then(function (url) {
            if (image.getAttribute("data-new-format-asset") !== reference) {
              return;
            }

            image.src = url;
            image.alt = reference;
            image.removeAttribute("aria-busy");
            image.setAttribute("data-new-format-state", "loaded");
            image.classList.remove("is-loading", "is-error");
            setup.preloadImage(url);
          }).catch(function (error) {
            if (image.getAttribute("data-new-format-asset") !== reference) {
              return;
            }

            image.alt = "Asset not found: " + reference;
            image.removeAttribute("aria-busy");
            image.setAttribute("data-new-format-state", "error");
            image.classList.remove("is-loading");
            image.classList.add("is-error");
            console.warn(error);
          });
        });
    };
}());
