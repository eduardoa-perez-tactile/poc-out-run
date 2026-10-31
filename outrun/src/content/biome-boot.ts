import {assets} from '@gameengine/runtime';
import {loadMap01,loadSourceBiomeCatalog} from './biome.ts';

// Above the engine's 4 MiB data cap, automatic raw preload is disabled for ALL
// records. Request only current startup data and prime its public versioned
// cache outside SIM. Explicit protocol steps do not await async group loading.
assets.load(['biome-map01-data','biome-catalog-data']);
loadMap01();
loadSourceBiomeCatalog();
