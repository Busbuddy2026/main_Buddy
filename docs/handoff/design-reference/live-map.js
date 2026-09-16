(function () {
  const STOPS = {
    kondapur:   { name: 'Kondapur Main Road',      lat: 17.4615, lng: 78.3641 },
    botanical:  { name: 'Botanical Garden',        lat: 17.4635, lng: 78.3560 },
    greenvalley:{ name: 'Green Valley Apartments', lat: 17.4552, lng: 78.3583 },
    gachibowli: { name: 'Gachibowli Crossroads',   lat: 17.4401, lng: 78.3489 },
    madhapur:   { name: 'Madhapur Police Station', lat: 17.4483, lng: 78.3915 },
    hitec:      { name: 'HITEC City MMTS',         lat: 17.4485, lng: 78.3808 },
    lanco:      { name: 'Lanco Hills',             lat: 17.4192, lng: 78.3820 },
    school:     { name: 'Greenfield International School', lat: 17.4239, lng: 78.3374 }
  };

  const BUSES = [
    { id: '12', route: 'Kondapur → School', status: 'ontime', pos: 0.42,
      stops: ['kondapur', 'botanical', 'greenvalley', 'gachibowli', 'school'],
      students: 38, cap: 42, driver: 'Ramesh Kumar', speed: 32 },
    { id: '08', route: 'Gachibowli → School', status: 'delayed', pos: 0.26,
      stops: ['gachibowli', 'lanco', 'school'],
      students: 31, cap: 40, driver: 'Mahesh Yadav', speed: 12 },
    { id: '21', route: 'Madhapur → School', status: 'ontime', pos: 0.68,
      stops: ['madhapur', 'hitec', 'lanco', 'school'],
      students: 44, cap: 48, driver: 'Imran Baig', speed: 28 },
    { id: '04', route: 'Kondapur → School', status: 'offline', pos: 0.12,
      stops: ['kondapur', 'greenvalley', 'school'],
      students: 0, cap: 42, driver: 'Naveen Rao', speed: 0 }
  ];

  const COLOR = { ontime: '#1a73e8', delayed: '#f29900', offline: '#9aa0a6' };

  function lerp(a, b, t) { return a + (b - a) * t; }

  function pointAt(path, t) {
    if (path.length < 2) return path[0];
    const segs = path.length - 1;
    const s = Math.min(segs - 1, Math.floor(t * segs));
    const lt = t * segs - s;
    return [lerp(path[s][0], path[s + 1][0], lt), lerp(path[s][1], path[s + 1][1], lt)];
  }

  class LiveMap extends HTMLElement {
    connectedCallback() {
      if (this._built) return;
      this._built = true;
      this.style.display = 'block';
      this.style.position = this.style.position || 'absolute';
      this.style.inset = '0';
      this.style.zIndex = '0';
      this.style.isolation = 'isolate';
      this.style.background = '#e8eaed';
      this._host = document.createElement('div');
      this._host.style.cssText = 'position:absolute;inset:0';
      this.appendChild(this._host);
      this._boot();
    }

    static get observedAttributes() { return ['selected', 'mode', 'focus']; }
    attributeChangedCallback(n) { if (this._map) this._paint(); }

    async _boot() {
      let tries = 0;
      while (!window.L && tries++ < 200) await new Promise(r => setTimeout(r, 50));
      if (!window.L) return;
      const L = window.L;
      const mini = this.getAttribute('mode') === 'mini';
      const map = L.map(this._host, {
        zoomControl: !mini,
        attributionControl: true,
        dragging: !mini,
        scrollWheelZoom: !mini,
        doubleClickZoom: !mini,
        keyboard: !mini
      });
      this._map = map;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        attribution: '© OpenStreetMap · © CARTO',
        maxZoom: 20
      }).addTo(map);
      if (!mini) map.zoomControl.setPosition('bottomright');

      this._layer = L.layerGroup().addTo(map);
      this._paint(true);

      this._tick = setInterval(() => {
        BUSES.forEach(b => {
          if (b.status === 'offline') return;
          b.pos = (b.pos + (b.status === 'delayed' ? 0.0012 : 0.0028)) % 1;
        });
        this._paint();
      }, 900);
    }

    disconnectedCallback() { clearInterval(this._tick); }

    _paint(fit) {
      const L = window.L;
      const mini = this.getAttribute('mode') === 'mini';
      const sel = this.getAttribute('selected');
      const focus = this.getAttribute('focus');
      const wanted = focus ? focus.split(',').map(s => s.trim()).filter(Boolean) : null;
      const shown = wanted ? BUSES.filter(b => wanted.indexOf(b.id) > -1) : BUSES;
      this._layer.clearLayers();
      const all = [];

      shown.forEach(bus => {
        const path = bus.stops.map(k => [STOPS[k].lat, STOPS[k].lng]);
        path.forEach(p => all.push(p));
        const active = !sel || sel === bus.id;
        L.polyline(path, {
          color: COLOR[bus.status],
          weight: active ? 4 : 3,
          opacity: active ? 0.75 : 0.22,
          lineJoin: 'round'
        }).addTo(this._layer);

        bus.stops.forEach((k, i) => {
          const s = STOPS[k];
          const last = i === bus.stops.length - 1;
          L.marker([s.lat, s.lng], {
            icon: L.divIcon({
              className: '',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
              html: '<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid ' +
                (last ? '#1a1c1e' : '#5f6672') + ';opacity:' + (active ? 1 : 0.3) + '"></div>'
            })
          }).addTo(this._layer).bindTooltip(s.name, { direction: 'top', offset: [0, -8] });
        });

        const p = pointAt(path, bus.pos);
        const isSel = sel === bus.id;
        const pill = L.divIcon({
          className: '',
          iconSize: [58, 30],
          iconAnchor: [29, 15],
          html: '<div style="display:flex;align-items:center;gap:5px;padding:5px 9px 5px 6px;border-radius:999px;' +
            'background:' + COLOR[bus.status] + ';color:#fff;font:600 12px/1 \'DM Sans\',system-ui;' +
            'box-shadow:0 2px 10px rgba(0,0,0,.28);' +
            'outline:' + (isSel ? '3px solid rgba(26,115,232,.35)' : 'none') + ';' +
            'opacity:' + (active ? 1 : 0.35) + ';cursor:pointer;white-space:nowrap">' +
            '<span style="width:16px;height:16px;border-radius:4px;background:rgba(255,255,255,.28);' +
            'display:grid;place-items:center;font-size:9px">▲</span>' + bus.id + '</div>'
        });
        const m = L.marker([p[0], p[1]], { icon: pill, zIndexOffset: isSel ? 1000 : 0 }).addTo(this._layer);
        if (!mini) {
          m.on('click', () => {
            this.dispatchEvent(new CustomEvent('busselect', { detail: bus.id, bubbles: true, composed: true }));
          });
        }
      });

      if (fit && all.length) {
        this._map.fitBounds(L.latLngBounds(all), { padding: mini ? [28, 28] : [56, 56] });
      }
    }
  }

  if (!window.customElements.get('live-map')) window.customElements.define('live-map', LiveMap);
})();
