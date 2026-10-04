/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "index.html",
    "revision": "cccf855b2e2afe9170360dd7981193ac"
  }, {
    "url": "icons.svg",
    "revision": "3b4fcfcf393eca4d264dca4a4663bc37"
  }, {
    "url": "icon-maskable-512.png",
    "revision": "9abaf673d57beba1d24e93d2e30899ce"
  }, {
    "url": "icon-maskable-192.png",
    "revision": "cf14b48e69f8f16673aea4e1e5d897d0"
  }, {
    "url": "icon-512.png",
    "revision": "c4488c59d4ea485592f1d95a2f7a641b"
  }, {
    "url": "icon-192.png",
    "revision": "28e61c99ffbc511d921ca8df866d9db1"
  }, {
    "url": "favicon.svg",
    "revision": "d95da854ea45271e800e02002e5a859f"
  }, {
    "url": "favicon.png",
    "revision": "1cfc0bbe4e6b14e3e811cfcf445279c1"
  }, {
    "url": "favicon.ico",
    "revision": "8eef79b223e67481015690e80ef0e9f5"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "1cf1646af4e066159843c1bbbfc9a898"
  }, {
    "url": "app-icon.png",
    "revision": "c4488c59d4ea485592f1d95a2f7a641b"
  }, {
    "url": "assets/web-pJhOo84u.js",
    "revision": null
  }, {
    "url": "assets/index-CsN49JuD.js",
    "revision": null
  }, {
    "url": "assets/index-0M5SJoBZ.css",
    "revision": null
  }, {
    "url": "app-icon.png",
    "revision": "c4488c59d4ea485592f1d95a2f7a641b"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "1cf1646af4e066159843c1bbbfc9a898"
  }, {
    "url": "favicon.ico",
    "revision": "8eef79b223e67481015690e80ef0e9f5"
  }, {
    "url": "favicon.png",
    "revision": "1cfc0bbe4e6b14e3e811cfcf445279c1"
  }, {
    "url": "favicon.svg",
    "revision": "d95da854ea45271e800e02002e5a859f"
  }, {
    "url": "icon-192.png",
    "revision": "28e61c99ffbc511d921ca8df866d9db1"
  }, {
    "url": "icon-512.png",
    "revision": "c4488c59d4ea485592f1d95a2f7a641b"
  }, {
    "url": "manifest.webmanifest",
    "revision": "599f66c6a9b5f8ffb40c71f97d4999e1"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//]
  }));

}));
