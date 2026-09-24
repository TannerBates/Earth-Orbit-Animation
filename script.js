(function () {
  'use strict';

  const VERSION = 3;
  window.__orbitVersion = VERSION;

  const AU_IN_KM = 149597870.7;
  const AU_SCALE = 280;
  const MOON_ORBIT_RADIUS_PX = 60;

  const errorBannerEl = document.getElementById('error-banner');
  const viewClassicEl = document.getElementById('view-classic');
  const globeCanvasEl = document.getElementById('globe-canvas');
  const earthWrapEl = document.getElementById('earth-wrap');
  const earthEl = document.getElementById('earth');
  const moonEl = document.getElementById('moon');
  const orbitPathEl = document.getElementById('orbit-path');
  const infoEl = document.getElementById('info-panel');
  const timeSpeedInput = document.getElementById('time-speed');
  const speedLabelEl = document.getElementById('speed-label');
  const earthModelSelect = document.getElementById('earth-model');
  const globeControlsEl = document.getElementById('globe-controls');
  const resetViewBtn = document.getElementById('reset-view');

  let globeView = null;
  let currentModel = 'globe';

  function showError(message) {
    if (!errorBannerEl) {
      return;
    }
    errorBannerEl.hidden = false;
    errorBannerEl.textContent = 'Error: ' + message;
  }

  if (typeof Astronomy === 'undefined') {
    showError('Astronomy Engine failed to load. Make sure lib/astronomy.browser.min.js is present.');
    return;
  }

  if (!earthWrapEl || !earthEl || !moonEl || !infoEl || !timeSpeedInput || !speedLabelEl) {
    showError('Page structure is outdated. Hard-refresh or re-download orbit.html from main.');
    return;
  }

  let simulationTime = new Date();
  let lastFrameTime = performance.now();

  const centralTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });

  function formatCentralTime(date) {
    return centralTimeFormatter.format(date);
  }

  function formatNumber(value, digits) {
    return Number(value).toFixed(digits);
  }

  function speedToLabel(speed) {
    if (speed < 60) {
      return speed === 1 ? 'Real time' : speed + '× real time';
    }
    if (speed < 3600) {
      return formatNumber(speed / 60, 1) + ' min/sec';
    }
    if (speed < 86400) {
      return formatNumber(speed / 3600, 1) + ' hr/sec';
    }
    return formatNumber(speed / 86400, 1) + ' day/sec';
  }

  function auPerDayToKmPerSec(speedAuPerDay) {
    return speedAuPerDay * AU_IN_KM / 86400;
  }

  function computeAxialTilt(earthAxis) {
    const northEcliptic = Astronomy.Ecliptic(earthAxis.north);
    return 90 - Math.abs(northEcliptic.elat);
  }

  function buildOrbitPath(referenceDate) {
    const points = [];
    for (let day = 0; day <= 365; day += 1) {
      const date = new Date(referenceDate.getTime() + day * 86400000);
      const ecliptic = Astronomy.Ecliptic(
        Astronomy.HelioVector(Astronomy.Body.Earth, date)
      );
      points.push({
        x: ecliptic.vec.x * AU_SCALE,
        y: -ecliptic.vec.y * AU_SCALE,
        z: ecliptic.vec.z * AU_SCALE
      });
    }
    return points;
  }

  function renderClassicOrbitPath(points) {
    if (!orbitPathEl || points.length === 0) {
      return;
    }

    const pathData = points
      .map(function (point, index) {
        return (index === 0 ? 'M' : 'L') + point.x + ' ' + point.y;
      })
      .join(' ');

    orbitPathEl.setAttribute('viewBox', '-400 -400 800 800');
    orbitPathEl.innerHTML =
      '<path d="' + pathData + '" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />';
  }

  function computeState() {
    const earthVector = Astronomy.HelioVector(Astronomy.Body.Earth, simulationTime);
    const earthEcliptic = Astronomy.Ecliptic(earthVector);
    const earthState = Astronomy.HelioState(Astronomy.Body.Earth, simulationTime);
    const earthAxis = Astronomy.RotationAxis(Astronomy.Body.Earth, simulationTime);
    const siderealHours = Astronomy.SiderealTime(simulationTime);
    const moon = Astronomy.EclipticGeoMoon(simulationTime);

    const earthX = earthEcliptic.vec.x * AU_SCALE;
    const earthY = -earthEcliptic.vec.y * AU_SCALE;
    const distanceAu = earthVector.Length();
    const distanceKm = distanceAu * AU_IN_KM;
    const orbitalSpeedKmS = auPerDayToKmPerSec(
      Math.hypot(earthState.vx, earthState.vy, earthState.vz)
    );
    const spinDeg = ((earthAxis.spin % 360) + 360) % 360;
    const axialTilt = computeAxialTilt(earthAxis);

    return {
      earthVector: earthVector,
      earthEcliptic: earthEcliptic,
      earthState: earthState,
      earthAxis: earthAxis,
      siderealHours: siderealHours,
      moon: moon,
      earthX: earthX,
      earthY: earthY,
      distanceAu: distanceAu,
      distanceKm: distanceKm,
      orbitalSpeedKmS: orbitalSpeedKmS,
      spinDeg: spinDeg,
      axialTilt: axialTilt
    };
  }

  function updateInfoPanel(state) {
    const modelLabel = currentModel === 'globe' ? 'Globe (3D)' : 'Classic (flat)';

    infoEl.innerHTML =
      '<h2>Earth–Sun System (v' + VERSION + ')</h2>' +
      '<dl>' +
      '<dt>Earth model</dt><dd>' + modelLabel + '</dd>' +
      '<dt>Simulation time</dt><dd>' + formatCentralTime(simulationTime) + '</dd>' +
      '<dt>Heliocentric ecliptic longitude</dt><dd>' + formatNumber(state.earthEcliptic.elon, 4) + '°</dd>' +
      '<dt>Heliocentric ecliptic latitude</dt><dd>' + formatNumber(state.earthEcliptic.elat, 4) + '°</dd>' +
      '<dt>Distance from Sun</dt><dd>' + formatNumber(state.distanceAu, 6) + ' AU (' + formatNumber(state.distanceKm / 1e6, 3) + ' million km)</dd>' +
      '<dt>Orbital speed</dt><dd>' + formatNumber(state.orbitalSpeedKmS, 3) + ' km/s</dd>' +
      '<dt>Axial tilt</dt><dd>' + formatNumber(state.axialTilt, 2) + '°</dd>' +
      '<dt>Earth axial spin (IAU W)</dt><dd>' + formatNumber(state.spinDeg, 4) + '°</dd>' +
      '<dt>Greenwich apparent sidereal time</dt><dd>' + formatNumber(state.siderealHours, 4) + ' h (' + formatNumber(state.siderealHours * 15, 4) + '°)</dd>' +
      '<dt>Moon geocentric ecliptic longitude</dt><dd>' + formatNumber(state.moon.lon, 4) + '°</dd>' +
      '<dt>Moon distance</dt><dd>' + formatNumber(state.moon.dist * AU_IN_KM, 1) + ' km</dd>' +
      '</dl>' +
      '<p class="note">Globe mode uses a textured 3D Earth with real axial tilt, spin, and Sun lighting. Moon uses accurate orbital angle with a fixed display radius.</p>';
  }

  function updateClassicView(state) {
    const moonLonRad = state.moon.lon * Math.PI / 180;
    const moonX = MOON_ORBIT_RADIUS_PX * Math.cos(moonLonRad);
    const moonY = -MOON_ORBIT_RADIUS_PX * Math.sin(moonLonRad);

    earthWrapEl.style.transform =
      'translate(calc(-50% + ' + state.earthX + 'px), calc(-50% + ' + state.earthY + 'px))';
    earthEl.style.transform = 'rotate(' + state.spinDeg + 'deg)';
    moonEl.style.transform =
      'translate(calc(-50% + ' + moonX + 'px), calc(-50% + ' + moonY + 'px))';
  }

  function setEarthModel(model) {
    currentModel = model === 'classic' ? 'classic' : 'globe';

    if (viewClassicEl) {
      viewClassicEl.hidden = currentModel !== 'classic';
      viewClassicEl.style.display = currentModel === 'classic' ? 'block' : 'none';
    }
    if (globeCanvasEl) {
      globeCanvasEl.hidden = currentModel !== 'globe';
      globeCanvasEl.style.display = currentModel === 'globe' ? 'block' : 'none';
    }
    if (globeControlsEl) {
      globeControlsEl.hidden = currentModel !== 'globe';
      globeControlsEl.style.display = currentModel === 'globe' ? 'flex' : 'none';
    }

    if (currentModel === 'globe') {
      if (!globeView && globeCanvasEl && typeof window.EarthGlobeView === 'function') {
        try {
          globeView = window.EarthGlobeView(globeCanvasEl);
          globeView.setOrbitPath(buildOrbitPath(simulationTime));
          globeView.resize(globeCanvasEl.clientWidth, globeCanvasEl.clientHeight);
        } catch (err) {
          showError(err.message || String(err));
          currentModel = 'classic';
          if (viewClassicEl) {
            viewClassicEl.hidden = false;
          }
          if (globeCanvasEl) {
            globeCanvasEl.hidden = true;
          }
        }
      }
    }
  }

  function updateSimulation() {
    const now = performance.now();
    const elapsedMs = now - lastFrameTime;
    lastFrameTime = now;

    const speed = Number(timeSpeedInput.value);

    if (speed === 1) {
      simulationTime = new Date();
    } else {
      simulationTime = new Date(simulationTime.getTime() + elapsedMs * speed);
    }

    const state = computeState();
    updateInfoPanel(state);

    if (currentModel === 'globe' && globeView) {
      globeView.update(state);
      globeView.render();
    } else {
      updateClassicView(state);
    }
  }

  function frame() {
    try {
      updateSimulation();
    } catch (err) {
      showError(err.message || String(err));
      return;
    }
    requestAnimationFrame(frame);
  }

  function onResize() {
    if (globeView && globeCanvasEl) {
      globeView.resize(globeCanvasEl.clientWidth, globeCanvasEl.clientHeight);
    }
  }

  timeSpeedInput.addEventListener('input', function () {
    speedLabelEl.textContent = speedToLabel(Number(timeSpeedInput.value));
  });

  if (earthModelSelect) {
    earthModelSelect.addEventListener('change', function () {
      setEarthModel(earthModelSelect.value);
    });
    setEarthModel(earthModelSelect.value);
  } else {
    setEarthModel('globe');
  }

  if (resetViewBtn) {
    resetViewBtn.addEventListener('click', function () {
      if (globeView && typeof globeView.resetView === 'function') {
        globeView.resetView();
      }
    });
  }

  window.addEventListener('resize', onResize);

  speedLabelEl.textContent = speedToLabel(Number(timeSpeedInput.value));
  requestAnimationFrame(frame);

  window.setTimeout(function () {
    try {
      renderClassicOrbitPath(buildOrbitPath(simulationTime));
      if (globeView) {
        globeView.setOrbitPath(buildOrbitPath(simulationTime));
      }
    } catch (err) {
      showError('Could not draw orbit path: ' + (err.message || String(err)));
    }
  }, 0);
})();
