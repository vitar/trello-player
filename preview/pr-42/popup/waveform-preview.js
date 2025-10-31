import { dom } from './dom.js';

class WaveformPreview extends HTMLElement {
  constructor() {
    super();
    const template = dom.waveformTemplate;
    if (template) {
      const frag = template.content.cloneNode(true);
      this.appendChild(frag);
    }
    this.canvas = this.querySelector('.waveform-canvas');
    this.wrench = this.querySelector('.wrench');
    this.placeholder = this.querySelector('.waveform-placeholder');
    this.status = this.querySelector('.waveform-status');
    this.loadingTimer = null;
    this.regionsPlugin = null;
    this.abLoopRegion = null;
    this.abRegionUpdateListener = null;
    this.abRegionRemovalListener = null;
  }

  createPlayer(options = {}) {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
    }
    if (this.canvas) {
      this.canvas.innerHTML = '';
    }
    this.abLoopRegion = null;
    this.regionsPlugin = null;
    this.zoomPlugin = null;
    const abortController = new AbortController();
    const signal = abortController.signal;
    const plugins = [];
    if (WaveSurfer?.Regions?.create) {
      this.regionsPlugin = WaveSurfer.Regions.create({
        dragSelection: false
      });
      plugins.push(this.regionsPlugin);
    }
    if (WaveSurfer?.Zoom?.create) {
      this.zoomPlugin = WaveSurfer.Zoom.create({
        scale: 0.5,
        maxZoom: 100,
        exponentialZooming: true
      });
      plugins.push(this.zoomPlugin);
    }
    const mergedOptions = {
      container: this.canvas,
      height: 80,
      normalize: true,
      minPxPerSec: 1,
      fetchParams: { signal },
      ...options
    };
    const optionPlugins = Array.isArray(mergedOptions.plugins) ? mergedOptions.plugins : [];
    if (plugins.length > 0 || optionPlugins.length > 0) {
      mergedOptions.plugins = [...optionPlugins, ...plugins];
    }
    this.wavesurfer = WaveSurfer.create(mergedOptions);
    this.wavesurfer.on('destroy', () => {
      abortController.abort();
    });
    if (this.regionsPlugin) {
      this.regionsPlugin.on('region-updated', (region) => {
        if (this.abLoopRegion && region && region.id === this.abLoopRegion.id) {
          this.abLoopRegion = region;
          if (this.abRegionUpdateListener) {
            this.abRegionUpdateListener(region.start, region.end);
          }
        }
      });
      this.regionsPlugin.on('region-removed', (region) => {
        if (this.abLoopRegion && region && region.id === this.abLoopRegion.id) {
          this.abLoopRegion = null;
          if (this.abRegionRemovalListener) {
            this.abRegionRemovalListener();
          }
        }
      });
    }
    return this.wavesurfer;
  }

  loadFromData(peaks, duration, options = {}) {
    this.createPlayer({
      ...options,
      peaks,
      duration
    });
    this.hideLoading();
    this.hideStatus();
  }

  loadFromUrl(url, options = {}) {
    this.showLoading();
    this.createPlayer({
      ...options,
      url
    });
    if (this.wavesurfer) {
      this.wavesurfer.once('ready', () => {
        this.hideLoading();
      });
      this.wavesurfer.once('error', () => {
        this.hideLoading();
      });
    }
  }

  clear() {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
    this.abLoopRegion = null;
    this.regionsPlugin = null;
    this.zoomPlugin = null;
    if (this.canvas) {
      this.canvas.innerHTML = '';
    }
    this.hideLoading();
    this.hideStatus();
  }

  showLoading() {
    this.classList.add('loading');
    this.hideStatus();
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.placeholder) {
      this.placeholder.classList.add('hidden');
      const timer = setTimeout(() => {
        if (this.classList.contains('loading') && this.placeholder) {
          this.placeholder.classList.remove('hidden');
        }
        if (this.loadingTimer === timer) {
          this.loadingTimer = null;
        }
      }, 3000);
      this.loadingTimer = timer;
    }
  }

  hideLoading() {
    this.classList.remove('loading');
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.placeholder) {
      this.placeholder.classList.add('hidden');
    }
  }

  showStatus(message) {
    if (!this.status) return;
    this.hideLoading();
    this.status.textContent = message;
    this.status.classList.remove('hidden');
  }

  hideStatus() {
    if (!this.status) return;
    this.status.textContent = '';
    this.status.classList.add('hidden');
  }

  setAbRegionUpdateHandler(handler) {
    this.abRegionUpdateListener = handler;
  }

  setAbRegionRemovalHandler(handler) {
    this.abRegionRemovalListener = handler;
  }

  setAbLoopRegion(start, end) {
    if (!this.regionsPlugin || !this.wavesurfer) {
      return null;
    }
    const sanitizedStart = Math.max(0, Number(start) || 0);
    const sanitizedEnd = Math.max(sanitizedStart, Number(end) || sanitizedStart);
    const styles = getComputedStyle(document.documentElement);
    const regionColor = styles.getPropertyValue('--waveform-region-color')?.trim() || 'rgba(110, 170, 255, 0.3)';
    const handleColor = styles.getPropertyValue('--waveform-region-handle-color')?.trim() || 'rgba(150, 190, 255, 0.75)';
    if (this.abLoopRegion) {
      this.abLoopRegion.remove();
      this.abLoopRegion = null;
    }
    this.abLoopRegion = this.regionsPlugin.addRegion({
      start: sanitizedStart,
      end: sanitizedEnd,
      drag: true,
      resize: true,
      color: regionColor,
      handleColor
    });
    if (this.abRegionUpdateListener) {
      this.abRegionUpdateListener(this.abLoopRegion.start, this.abLoopRegion.end);
    }
    return this.abLoopRegion;
  }

  clearAbLoopRegion() {
    if (this.abLoopRegion) {
      this.abLoopRegion.remove();
      this.abLoopRegion = null;
    }
  }

  exportPeaks() {
    return this.wavesurfer.exportPeaks({ channels: 1, maxLength: 600, precision: 1000 });
  }

  getDuration() {
    return this.wavesurfer?.getDuration();
  }

  setWrenchHandler(handler) {
    if (this.wrench) this.wrench.onclick = handler;
  }
}

export function registerWaveformPreview() {
  if (!customElements.get('waveform-preview')) {
    customElements.define('waveform-preview', WaveformPreview);
  }
}
