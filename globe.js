(function () {
  'use strict';

  window.EarthGlobeView = function (canvas) {
    if (typeof THREE === 'undefined') {
      throw new Error('Three.js failed to load.');
    }

    const AU_SCALE = 280;
    const EARTH_RADIUS = 8;
    const MOON_RADIUS = 2;
    const MOON_ORBIT_RADIUS = 22;
    const SUN_RADIUS = 36;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene.add(new THREE.AmbientLight(0x404060, 0.45));

    const sunLight = new THREE.PointLight(0xfff4dd, 2.4, 0, 0);
    scene.add(sunLight);

    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(SUN_RADIUS, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb347 })
    );
    scene.add(sunMesh);

    const sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(SUN_RADIUS * 2.2, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.22
      })
    );
    scene.add(sunGlow);

    const sunCorona = new THREE.Mesh(
      new THREE.SphereGeometry(SUN_RADIUS * 3.5, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.08
      })
    );
    scene.add(sunCorona);

    const earthTexture = new THREE.TextureLoader().load('images/earth_globe.jpg');
    earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 64, 64),
      new THREE.MeshPhongMaterial({
        map: earthTexture,
        specular: new THREE.Color(0x222222),
        shininess: 8
      })
    );
    scene.add(earthMesh);

    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_RADIUS, 24, 24),
      new THREE.MeshPhongMaterial({
        color: 0xb8b8b8,
        emissive: 0x111111
      })
    );
    scene.add(moonMesh);

    const orbitMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15
    });
    const orbitLine = new THREE.Line(new THREE.BufferGeometry(), orbitMaterial);
    scene.add(orbitLine);

    const northAxis = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      EARTH_RADIUS * 1.7,
      0x66ccff
    );
    earthMesh.add(northAxis);

    const tiltRing = new THREE.Mesh(
      new THREE.RingGeometry(EARTH_RADIUS * 1.35, EARTH_RADIUS * 1.42, 64),
      new THREE.MeshBasicMaterial({
        color: 0x66ccff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
      })
    );
    tiltRing.rotation.x = Math.PI / 2;
    earthMesh.add(tiltRing);

    const sunPosition = new THREE.Vector3(0, 0, 0);
    const earthPosition = new THREE.Vector3();
    const midpoint = new THREE.Vector3();
    const moonOffset = new THREE.Vector3();
    const northPole = new THREE.Vector3();
    const lineDirection = new THREE.Vector3();
    const sideDirection = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const cameraDirection = new THREE.Vector3();
    const defaultUp = new THREE.Vector3(0, 1, 0);
    const baseOrientation = new THREE.Quaternion();
    const spinQuaternion = new THREE.Quaternion();

    function eclipticToScene(eclipticVec) {
      return new THREE.Vector3(
        eclipticVec.x * AU_SCALE,
        -eclipticVec.y * AU_SCALE,
        eclipticVec.z * AU_SCALE
      );
    }

    function setOrbitPath(points) {
      const positions = new Float32Array(points.length * 3);
      for (let i = 0; i < points.length; i += 1) {
        positions[i * 3] = points[i].x;
        positions[i * 3 + 1] = points[i].y;
        positions[i * 3 + 2] = points[i].z;
      }
      orbitLine.geometry.dispose();
      orbitLine.geometry = new THREE.BufferGeometry();
      orbitLine.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
      );
    }

    function updateOrientation(earthAxis) {
      const northEcliptic = Astronomy.Ecliptic(earthAxis.north);
      northPole.set(
        northEcliptic.vec.x,
        -northEcliptic.vec.y,
        northEcliptic.vec.z
      ).normalize();

      baseOrientation.setFromUnitVectors(defaultUp, northPole);

      const spinDeg = ((earthAxis.spin % 360) + 360) % 360;
      spinQuaternion.setFromAxisAngle(defaultUp, THREE.MathUtils.degToRad(spinDeg));

      earthMesh.quaternion.copy(baseOrientation).multiply(spinQuaternion);
    }

    function update(state) {
      earthPosition.copy(eclipticToScene(state.earthEcliptic.vec));
      earthMesh.position.copy(earthPosition);

      updateOrientation(state.earthAxis);

      const moonLonRad = state.moon.lon * Math.PI / 180;
      moonOffset.set(
        MOON_ORBIT_RADIUS * Math.cos(moonLonRad),
        -MOON_ORBIT_RADIUS * Math.sin(moonLonRad),
        0
      );
      moonMesh.position.copy(earthPosition).add(moonOffset);

      midpoint.copy(earthPosition).multiplyScalar(0.5);
      lineDirection.copy(earthPosition).normalize();
      sideDirection.crossVectors(lineDirection, worldUp);

      if (sideDirection.lengthSq() < 1e-6) {
        sideDirection.set(0, 0, 1);
      } else {
        sideDirection.normalize();
      }

      const earthDistance = earthPosition.length();
      const cameraSide = earthDistance * 0.72;
      const cameraHeight = earthDistance * 0.28;

      cameraDirection
        .copy(sideDirection)
        .multiplyScalar(cameraSide);
      cameraDirection.y += cameraHeight;

      camera.position.copy(midpoint).add(cameraDirection);
      camera.lookAt(midpoint);

      sunLight.position.copy(sunPosition);
    }

    function render() {
      renderer.render(scene, camera);
    }

    function resize(width, height) {
      const w = width || canvas.clientWidth;
      const h = height || canvas.clientHeight;
      if (w === 0 || h === 0) {
        return;
      }
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }

    function dispose() {
      renderer.dispose();
      earthTexture.dispose();
      orbitLine.geometry.dispose();
    }

    resize();

    return {
      update: update,
      render: render,
      resize: resize,
      setOrbitPath: setOrbitPath,
      dispose: dispose
    };
  };
})();
