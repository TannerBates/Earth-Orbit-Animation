(function () {
  'use strict';

  const AU_IN_KM = 149597870.7;
  const AU_SCALE = 280;
  const MOON_DISPLAY_SCALE = 5000;

  const earthWrapEl = document.getElementById('earth-wrap');
  const earthEl = document.getElementById('earth');
  const moonEl = document.getElementById('moon');
  const orbitPathEl = document.getElementById('orbit-path');
  const infoEl = document.getElementById('info-panel');
  const timeSpeedInput = document.getElementById('time-speed');
  const speedLabelEl = document.getElementById('speed-label');

  let simulationTime = new Date();
  let lastFrameTime = performance.now();

  function formatUtc(date) {
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
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

  function buildOrbitPath(referenceDate) {
    const points = [];
    for (let day = 0; day <= 365; day += 1) {
      const date = new Date(referenceDate.getTime() + day * 86400000);
      const ecliptic = Astronomy.Ecliptic(
        Astronomy.HelioVector(Astronomy.Body.Earth, date)
      );
      points.push({
        x: ecliptic.vec.x * AU_SCALE,
        y: -ecliptic.vec.y * AU_SCALE
      });
    }
    return points;
  }

  function renderOrbitPath(points) {
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

  function updateSimulation() {
    const now = performance.now();
    const elapsedMs = now - lastFrameTime;
    lastFrameTime = now;

    const speed = Number(timeSpeedInput.value);
    simulationTime = new Date(simulationTime.getTime() + elapsedMs * speed);

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

    const moonLonRad = moon.lon * Math.PI / 180;
    const moonLatRad = moon.lat * Math.PI / 180;
    const moonDisplayRadius = moon.dist * AU_SCALE * MOON_DISPLAY_SCALE;
    const moonX = moonDisplayRadius * Math.cos(moonLatRad) * Math.cos(moonLonRad);
    const moonY = -moonDisplayRadius * Math.cos(moonLatRad) * Math.sin(moonLonRad);

    const spinDeg = ((earthAxis.spin % 360) + 360) % 360;

    earthWrapEl.style.transform =
      'translate(calc(-50% + ' + earthX + 'px), calc(-50% + ' + earthY + 'px))';
    earthEl.style.transform = 'rotate(' + spinDeg + 'deg)';
    moonEl.style.transform =
      'translate(calc(-50% + ' + moonX + 'px), calc(-50% + ' + moonY + 'px))';

    infoEl.innerHTML =
      '<h2>Earth–Sun System</h2>' +
      '<dl>' +
      '<dt>Simulation time</dt><dd>' + formatUtc(simulationTime) + '</dd>' +
      '<dt>Heliocentric ecliptic longitude</dt><dd>' + formatNumber(earthEcliptic.elon, 4) + '°</dd>' +
      '<dt>Heliocentric ecliptic latitude</dt><dd>' + formatNumber(earthEcliptic.elat, 4) + '°</dd>' +
      '<dt>Distance from Sun</dt><dd>' + formatNumber(distanceAu, 6) + ' AU (' + formatNumber(distanceKm / 1e6, 3) + ' million km)</dd>' +
      '<dt>Orbital speed</dt><dd>' + formatNumber(orbitalSpeedKmS, 3) + ' km/s</dd>' +
      '<dt>Earth axial spin (IAU W)</dt><dd>' + formatNumber(spinDeg, 4) + '°</dd>' +
      '<dt>Greenwich apparent sidereal time</dt><dd>' + formatNumber(siderealHours, 4) + ' h (' + formatNumber(siderealHours * 15, 4) + '°)</dd>' +
      '<dt>Moon geocentric ecliptic longitude</dt><dd>' + formatNumber(moon.lon, 4) + '°</dd>' +
      '<dt>Moon distance</dt><dd>' + formatNumber(moon.dist * AU_IN_KM, 1) + ' km</dd>' +
      '</dl>' +
      '<p class="note">Positions from Astronomy Engine (VSOP87 / IAU rotation models). Moon orbit is scaled up for visibility.</p>';

    speedLabelEl.textContent = speedToLabel(speed);
  }

  function frame() {
    updateSimulation();
    requestAnimationFrame(frame);
  }

  timeSpeedInput.addEventListener('input', function () {
    speedLabelEl.textContent = speedToLabel(Number(timeSpeedInput.value));
  });

  renderOrbitPath(buildOrbitPath(simulationTime));
  speedLabelEl.textContent = speedToLabel(Number(timeSpeedInput.value));
  requestAnimationFrame(frame);
})();
