# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.0.8](https://github.com/arobson/consequent/compare/v2.0.7...v2.0.8) (2026-08-15)


### Bug Fixes

* replace the queue based event merge with a simple sort ([590bada](https://github.com/arobson/consequent/commit/590bada00bc4a6d3d152a7548f0cadec9f6ea340))

## [2.0.7](https://github.com/arobson/consequent/compare/v2.0.6...v2.0.7) (2026-08-15)


### Bug Fixes

* use for-await when draining an event adapter's fetchStream result ([ad56cee](https://github.com/arobson/consequent/commit/ad56cee835a5c938528ac654254273ce4c427969))

## [2.0.6](https://github.com/arobson/consequent/compare/v2.0.5...v2.0.6) (2026-08-14)


### Bug Fixes

* **ci:** bootstrap release-please from current HEAD ([dba7566](https://github.com/arobson/consequent/commit/dba7566e3ca4636dbaeb178034616e60235cbd53))
* **ci:** match release-please tags to publish.yml's trigger pattern ([44eedf5](https://github.com/arobson/consequent/commit/44eedf593831ea816fcf7d12fd8d6b31462c6ffa))

### [2.0.5](https://github.com/arobson/consequent/compare/v2.0.4...v2.0.5) (2026-08-14)


### Bug Fixes

* **ci:** approve install scripts for farmhash and esbuild ([2636b52](https://github.com/arobson/consequent/commit/2636b523e5a1ea598c13d38d3b711c89a3155378))

### [2.0.4](https://github.com/arobson/consequent/compare/v2.0.3...v2.0.4) (2026-08-14)


### Bug Fixes

* **ci:** stop setup-node's empty authToken from breaking OIDC publish ([a37f1a2](https://github.com/arobson/consequent/commit/a37f1a2952fd58125c1084a4bed3427a0b2a5a82))

### 2.0.3 (2026-08-14)


### Bug Fixes

* await search adapter's find() result instead of assuming it's synchronous ([87d55b5](https://github.com/arobson/consequent/commit/87d55b520f5493fc6027455c11e49457404c7b31))
* await the search index update before resolving handle() ([9d19b87](https://github.com/arobson/consequent/commit/9d19b8767a5741b7eb4744b68c0f8bbe8d62f6b4))
* repair getEventStream/getActorStream, broken since introduction ([a1c062f](https://github.com/arobson/consequent/commit/a1c062f3052b261b6a7fa985ea10c19bd1f82eb0))

### [1.2.4](https://github.com/arobson/consequent/compare/v1.2.0...v1.2.3) (2022-05-07)

### Bug Fixes

* add type and id to command if missing ([41199f8](https://github.com/arobson/consequent/commit/41199f8cf0a84e51e0840ba2001b065d6b06a981))
* correct defect that caused default instances to return as undefined in some cases ([151cca5](https://github.com/arobson/consequent/commit/151cca5fe5a40d6c3f0b3d1db94ae6868f918006))
* remove npmrc ([7b063bf](https://github.com/arobson/consequent/commit/7b063bf3a5d8d7f886520e83f67ce2153998ce6d))

### [1.2.3](https://github.com/arobson/consequent/compare/v1.2.1...v1.2.3) (2022-03-31)

### Bug Fixes

* correct defect that caused default instances to return as undefined in some cases ([151cca5](https://github.com/arobson/consequent/commit/151cca5fe5a40d6c3f0b3d1db94ae6868f918006))
* remove npmrc ([7b063bf](https://github.com/arobson/consequent/commit/7b063bf3a5d8d7f886520e83f67ce2153998ce6d))
* update version of fauxdash ([1c851cb](https://github.com/arobson/consequent/commit/1c851cb4992b2d49ccbe7f713ddc113ffcb478a6))

### [1.2.2](https://github.com/arobson/consequent/compare/v1.2.0...v1.2.2) (2022-03-30)


### Bug Fixes

* correct defect that caused default instances to return as undefined in some cases ([9da9f64](https://github.com/arobson/consequent/commit/9da9f6447a7c40ca30baffd9ebabb45f8e797f55))

### [1.2.1](https://github.com/arobson/consequent/compare/v1.2.0...v1.2.1) (2022-03-26)

<a name="1.2.0"></a>
# [1.2.0](https://github.com/arobson/consequent/compare/v1.1.0...v1.2.0) (2018-06-08)


### Features

* update io adapters to return a promise from create call in order to support async initialization for adapters. ([7f18b4b](https://github.com/arobson/consequent/commit/7f18b4b))



<a name="1.1.0"></a>
# 1.1.0 (2018-05-27)


### Bug Fixes

* bump globulesce to latest ([1dbe180](https://github.com/arobson/consequent/commit/1dbe180))
* update postal dependency ([9fa3fb8](https://github.com/arobson/consequent/commit/9fa3fb8))


### Features

* add search support ([ac6a98c](https://github.com/arobson/consequent/commit/ac6a98c))
* add system ids to models and specify natural ids in type metadata ([437c5a5](https://github.com/arobson/consequent/commit/437c5a5))
* land remaining functionality to get to a baseline release ([885f346](https://github.com/arobson/consequent/commit/885f346))
* rework streams as generators ([b583bc0](https://github.com/arobson/consequent/commit/b583bc0))
