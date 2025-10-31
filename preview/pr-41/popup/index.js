import { registerWaveformPreview } from './waveform-preview.js';
import { createAbLoopController } from './ab-loop.js';
import { createPlayerController } from './player.js';
import { setupAuth } from './auth.js';

registerWaveformPreview();

const abLoop = createAbLoopController();
abLoop.init();

const player = createPlayerController(abLoop);
player.init();

const { initAuth } = setupAuth(player);
initAuth();
