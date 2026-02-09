// behaviour_fpsoverlay.js
// Simple behaviour that displays an FPS overlay using engine.GetFramePerSecond()
export default class BehaviourFPSOverlay {
  constructor(node, props) {
    this.node = node;
    this.props = props || {};
    this._div = null;
    this.engine = null;
  }

  start(engine) {
    this.engine = engine;
    try {
      const div = document.createElement('div');
      div.style.position = 'fixed';
      div.style.left = '8px';
      div.style.top = '8px';
      div.style.padding = '6px 8px';
      div.style.background = 'rgba(0,0,0,0.6)';
      div.style.color = '#0f0';
      div.style.fontFamily = 'monospace';
      div.style.fontSize = '13px';
      div.style.zIndex = '9999';
      div.style.pointerEvents = 'none';
      div.style.borderRadius = '4px';
      div.textContent = 'FPS: --';
      document.body.appendChild(div);
      this._div = div;
    } catch (e) { console.warn('behaviour_fpsoverlay: failed to create overlay', e); }
  }

  update(dt) {
    try {
      if (!this._div) return;
      if (this.engine && typeof this.engine.GetFramePerSecond === 'function') {
        const fps = this.engine.GetFramePerSecond();
        this._div.textContent = 'FPS: ' + fps;
      } else if (window && window.engine && typeof window.engine.GetFramePerSecond === 'function') {
        const fps = window.engine.GetFramePerSecond();
        this._div.textContent = 'FPS: ' + fps;
      }
    } catch (e) { /* ignore */ }
  }

  dispose() {
    try { if (this._div && this._div.parentNode) this._div.parentNode.removeChild(this._div); } catch (e) {}
    this._div = null;
    this.node = null;
    this.engine = null;
  }
}
