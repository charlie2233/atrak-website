(() => {
    const target = document.querySelector('[data-three-hero]');
    const canvas = target?.querySelector('.hero-three-canvas');
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const coarsePointerQuery = window.matchMedia?.('(pointer: coarse)');
    const minWidth = 760;
    const threeModuleUrl = 'https://unpkg.com/three@0.160.0/build/three.module.js';

    const hasWebGL = () => {
        try {
            const testCanvas = document.createElement('canvas');
            return Boolean(testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'));
        } catch {
            return false;
        }
    };

    const shouldSkip = () => {
        return (
            !target ||
            !canvas ||
            motionQuery?.matches ||
            window.innerWidth < minWidth ||
            navigator.connection?.saveData ||
            (coarsePointerQuery?.matches && window.innerWidth < 1024) ||
            !hasWebGL()
        );
    };

    const init = async () => {
        if (shouldSkip()) {
            target?.classList.add('is-fallback');
            return;
        }

        let THREE;
        try {
            THREE = await import(threeModuleUrl);
        } catch {
            target.classList.add('is-fallback');
            return;
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        camera.position.set(0, 0.08, 7.4);

        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'low-power'
        });
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const group = new THREE.Group();
        scene.add(group);

        const core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(1.2, 2),
            new THREE.MeshStandardMaterial({
                color: 0x07111f,
                emissive: 0x0ea5e9,
                emissiveIntensity: 0.32,
                roughness: 0.36,
                metalness: 0.82,
                wireframe: true,
                transparent: true,
                opacity: 0.82
            })
        );
        group.add(core);

        const haloMaterial = new THREE.MeshBasicMaterial({
            color: 0x7c5cff,
            transparent: true,
            opacity: 0.42
        });

        const orbitA = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.012, 16, 160), haloMaterial);
        orbitA.rotation.set(1.08, 0.16, 0.72);
        group.add(orbitA);

        const orbitB = new THREE.Mesh(
            new THREE.TorusGeometry(2.38, 0.01, 16, 180),
            new THREE.MeshBasicMaterial({ color: 0x14f1ff, transparent: true, opacity: 0.34 })
        );
        orbitB.rotation.set(0.42, 1.12, -0.36);
        group.add(orbitB);

        const knot = new THREE.Mesh(
            new THREE.TorusKnotGeometry(1.08, 0.018, 180, 8, 2, 5),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.52 })
        );
        group.add(knot);

        const particleCount = 190;
        const particlePositions = new Float32Array(particleCount * 3);
        for (let index = 0; index < particleCount; index += 1) {
            const radius = 2.1 + Math.random() * 1.8;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            particlePositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
            particlePositions[(index * 3) + 1] = radius * Math.sin(phi) * Math.sin(theta);
            particlePositions[(index * 3) + 2] = radius * Math.cos(phi);
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        const particles = new THREE.Points(
            particleGeometry,
            new THREE.PointsMaterial({
                color: 0x67e8f9,
                size: 0.026,
                transparent: true,
                opacity: 0.74,
                depthWrite: false
            })
        );
        group.add(particles);

        scene.add(new THREE.AmbientLight(0x89b4ff, 0.55));
        const keyLight = new THREE.PointLight(0x14f1ff, 2.1, 12);
        keyLight.position.set(-2.8, 2.4, 4.2);
        scene.add(keyLight);
        const rimLight = new THREE.PointLight(0x8b5cf6, 1.7, 12);
        rimLight.position.set(3.2, -2.2, 3.6);
        scene.add(rimLight);

        const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
        const resize = () => {
            const rect = target.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };

        const onPointerMove = (event) => {
            const rect = target.getBoundingClientRect();
            pointer.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.7;
            pointer.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.7;
        };

        let frameId = 0;
        let visible = true;
        const clock = new THREE.Clock();

        const animate = () => {
            if (!visible) return;
            const elapsed = clock.getElapsedTime();
            pointer.x += (pointer.targetX - pointer.x) * 0.055;
            pointer.y += (pointer.targetY - pointer.y) * 0.055;

            group.rotation.y = elapsed * 0.16 + pointer.x;
            group.rotation.x = elapsed * 0.075 - pointer.y;
            core.rotation.z = elapsed * 0.11;
            orbitA.rotation.z = elapsed * 0.2;
            orbitB.rotation.y = elapsed * -0.16;
            knot.rotation.x = elapsed * 0.18;
            knot.rotation.y = elapsed * 0.24;
            particles.rotation.y = elapsed * 0.035;

            renderer.render(scene, camera);
            frameId = window.requestAnimationFrame(animate);
        };

        const onVisibilityChange = () => {
            visible = document.visibilityState === 'visible';
            if (visible && !frameId) {
                frameId = window.requestAnimationFrame(animate);
            }
        };

        resize();
        target.classList.add('is-ready');
        document.body.classList.add('three-hero-ready');
        window.addEventListener('resize', resize, { passive: true });
        target.addEventListener('pointermove', onPointerMove, { passive: true });
        document.addEventListener('visibilitychange', onVisibilityChange);
        frameId = window.requestAnimationFrame(animate);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
