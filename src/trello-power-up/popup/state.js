export const state = {
  currentAttachmentIndex: 0,
  m4aAttachments: [],
  currentLoadRequest: 0,
  desiredPitchSemitones: 0,
  desiredPlaybackSpeed: 1,
  isAudioLoaded: false,
  abPointA: null,
  abPointB: null,
  abRepeatActive: false,
  isClearingAbRegion: false,
  trelloToken: null,
  apiKey: '',
  currentObjectUrl: null,
  popup: null,
  authMessageHandler: null,
  audioContext: null,
  soundtouchNode: null,
  audioSourceNode: null,
  soundtouchModulePromise: null
};

export const caches = {
  audioBlobCache: new Map(),
  attachmentDurations: new Map()
};
