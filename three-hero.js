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

    const createSeededRandom = () => {
        let seed = 120428;
        return () => {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };
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

        const random = createSeededRandom();
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
        camera.position.set(0, 0.06, 7.55);

        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'low-power'
        });
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.14;

        const group = new THREE.Group();
        scene.add(group);

        const makeOutline = (mesh, scale, color, opacity) => {
            const outline = new THREE.Mesh(
                mesh.geometry,
                new THREE.MeshBasicMaterial({
                    color,
                    side: THREE.BackSide,
                    transparent: true,
                    opacity,
                    depthWrite: false
                })
            );
            outline.scale.setScalar(scale);
            mesh.add(outline);
            return outline;
        };

        const coreMaterial = new THREE.MeshToonMaterial({
            color: 0x081226,
            emissive: 0x064e75,
            emissiveIntensity: 0.72
        });

        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.12, 2), coreMaterial);
        makeOutline(core, 1.045, 0x14f1ff, 0.28);
        group.add(core);

        const innerCore = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.48, 0),
            new THREE.MeshBasicMaterial({
                color: 0x14f1ff,
                transparent: true,
                opacity: 0.48,
                wireframe: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        group.add(innerCore);

        const createRibbon = ({ color, radius, depthScale, tubeRadius, rotation, phase, opacity }) => {
            const points = [];
            const pointTotal = 112;
            for (let pointIndex = 0; pointIndex <= pointTotal; pointIndex += 1) {
                const progress = pointIndex / pointTotal;
                const angle = progress * Math.PI * 2;
                const wave = Math.sin(angle * 2 + phase) * 0.24 + Math.sin(angle * 5 + phase) * 0.045;
                points.push(new THREE.Vector3(
                    Math.cos(angle) * radius,
                    wave,
                    Math.sin(angle) * radius * depthScale
                ));
            }

            const curve = new THREE.CatmullRomCurve3(points, true);
            const geometry = new THREE.TubeGeometry(curve, 168, tubeRadius, 8, true);
            const material = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const ribbon = new THREE.Mesh(geometry, material);
            ribbon.rotation.set(rotation.x, rotation.y, rotation.z);
            ribbon.userData = {
                baseRotation: rotation,
                baseOpacity: opacity,
                pulseOffset: phase
            };
            group.add(ribbon);
            return ribbon;
        };

        const ribbons = [
            createRibbon({
                color: 0x14f1ff,
                radius: 1.78,
                depthScale: 0.54,
                tubeRadius: 0.014,
                rotation: { x: 1.12, y: 0.04, z: 0.66 },
                phase: 0.1,
                opacity: 0.58
            }),
            createRibbon({
                color: 0xff2dc7,
                radius: 2.08,
                depthScale: 0.46,
                tubeRadius: 0.011,
                rotation: { x: 0.48, y: 1.02, z: -0.34 },
                phase: 1.7,
                opacity: 0.42
            }),
            createRibbon({
                color: 0x8b5cf6,
                radius: 2.42,
                depthScale: 0.38,
                tubeRadius: 0.01,
                rotation: { x: 0.86, y: -0.74, z: 0.26 },
                phase: 3.2,
                opacity: 0.36
            })
        ];

        const shardGeometries = [
            new THREE.TetrahedronGeometry(0.2, 0),
            new THREE.OctahedronGeometry(0.16, 0),
            new THREE.ConeGeometry(0.12, 0.34, 5)
        ];
        const shardColors = [0x14f1ff, 0xff2dc7, 0x8b5cf6, 0x67e8f9];
        const shards = [];
        const shardTotal = 16;

        for (let shardIndex = 0; shardIndex < shardTotal; shardIndex += 1) {
            const geometry = shardGeometries[shardIndex % shardGeometries.length];
            const color = shardColors[shardIndex % shardColors.length];
            const material = new THREE.MeshToonMaterial({
                color,
                emissive: color,
                emissiveIntensity: 0.18
            });
            const shard = new THREE.Mesh(geometry, material);
            makeOutline(shard, 1.12, 0x020617, 0.7);

            const angle = (shardIndex / shardTotal) * Math.PI * 2 + random() * 0.35;
            const radius = 2.1 + random() * 1.35;
            const height = (random() - 0.5) * 1.75;
            shard.position.set(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius * 0.58
            );
            shard.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
            shard.scale.setScalar(0.7 + random() * 0.7);
            shard.userData = {
                basePosition: shard.position.clone(),
                floatOffset: random() * Math.PI * 2,
                spinSpeed: 0.42 + random() * 0.86
            };
            shards.push(shard);
            group.add(shard);
        }

        const createSparkTexture = () => {
            const sparkCanvas = document.createElement('canvas');
            sparkCanvas.width = 64;
            sparkCanvas.height = 64;
            const context = sparkCanvas.getContext('2d');
            const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.25, 'rgba(20,241,255,0.9)');
            gradient.addColorStop(0.58, 'rgba(255,45,199,0.34)');
            gradient.addColorStop(1, 'rgba(255,45,199,0)');
            context.fillStyle = gradient;
            context.beginPath();
            context.arc(32, 32, 31, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = 'rgba(255,255,255,0.72)';
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(32, 6);
            context.lineTo(32, 58);
            context.moveTo(6, 32);
            context.lineTo(58, 32);
            context.stroke();
            const texture = new THREE.CanvasTexture(sparkCanvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            return texture;
        };

        const particleCount = 280;
        const particlePositions = new Float32Array(particleCount * 3);
        for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
            const radius = 2.0 + random() * 2.4;
            const angle = random() * Math.PI * 2;
            const verticalOffset = (random() - 0.5) * 2.9;
            particlePositions[particleIndex * 3] = Math.cos(angle) * radius;
            particlePositions[(particleIndex * 3) + 1] = verticalOffset;
            particlePositions[(particleIndex * 3) + 2] = Math.sin(angle) * radius * 0.62;
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        const particles = new THREE.Points(
            particleGeometry,
            new THREE.PointsMaterial({
                map: createSparkTexture(),
                color: 0x9ffbff,
                size: 0.07,
                transparent: true,
                opacity: 0.78,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        group.add(particles);

        const streakTotal = 42;
        const streakPositions = new Float32Array(streakTotal * 2 * 3);
        for (let streakIndex = 0; streakIndex < streakTotal; streakIndex += 1) {
            const angle = random() * Math.PI * 2;
            const radius = 2.6 + random() * 1.6;
            const length = 0.28 + random() * 0.52;
            const verticalOffset = (random() - 0.5) * 2.1;
            const startOffset = streakIndex * 6;
            const startX = Math.cos(angle) * radius;
            const startY = verticalOffset;
            const startZ = Math.sin(angle) * radius * 0.48;
            streakPositions[startOffset] = startX;
            streakPositions[startOffset + 1] = startY;
            streakPositions[startOffset + 2] = startZ;
            streakPositions[startOffset + 3] = startX + Math.cos(angle + 0.85) * length;
            streakPositions[startOffset + 4] = startY + length * 0.2;
            streakPositions[startOffset + 5] = startZ + Math.sin(angle + 0.85) * length;
        }

        const streakGeometry = new THREE.BufferGeometry();
        streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
        const streaks = new THREE.LineSegments(
            streakGeometry,
            new THREE.LineBasicMaterial({
                color: 0xf8fbff,
                transparent: true,
                opacity: 0.18,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        group.add(streaks);

        scene.add(new THREE.AmbientLight(0x8bb8ff, 0.72));
        const keyLight = new THREE.PointLight(0x14f1ff, 2.4, 12);
        keyLight.position.set(-2.8, 2.5, 4.2);
        scene.add(keyLight);
        const rimLight = new THREE.PointLight(0xff2dc7, 1.8, 12);
        rimLight.position.set(3.0, -1.8, 3.4);
        scene.add(rimLight);
        const topLight = new THREE.DirectionalLight(0xffffff, 0.42);
        topLight.position.set(0.4, 2.6, 1.8);
        scene.add(topLight);

        const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
        const resize = () => {
            const rect = target.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };

        const onPointerMove = (event) => {
            const rect = target.getBoundingClientRect();
            pointer.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.72;
            pointer.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.72;
        };

        let frameId = 0;
        let visible = true;
        const clock = new THREE.Clock();

        const animate = () => {
            if (!visible) {
                frameId = 0;
                return;
            }

            const elapsed = clock.getElapsedTime();
            pointer.x += (pointer.targetX - pointer.x) * 0.055;
            pointer.y += (pointer.targetY - pointer.y) * 0.055;

            group.rotation.y = elapsed * 0.13 + pointer.x;
            group.rotation.x = elapsed * 0.055 - pointer.y;
            core.rotation.x = elapsed * 0.12;
            core.rotation.y = elapsed * 0.18;
            innerCore.rotation.x = elapsed * -0.34;
            innerCore.rotation.y = elapsed * 0.48;
            innerCore.scale.setScalar(1 + Math.sin(elapsed * 2.4) * 0.07);

            ribbons.forEach((ribbon, ribbonIndex) => {
                const baseRotation = ribbon.userData.baseRotation;
                const pulse = Math.sin(elapsed * 1.4 + ribbon.userData.pulseOffset) * 0.08;
                ribbon.rotation.x = baseRotation.x + Math.sin(elapsed * 0.25 + ribbonIndex) * 0.05;
                ribbon.rotation.y = baseRotation.y + elapsed * (0.1 + ribbonIndex * 0.025);
                ribbon.rotation.z = baseRotation.z + elapsed * (0.16 - ribbonIndex * 0.035);
                ribbon.material.opacity = ribbon.userData.baseOpacity + pulse;
            });

            shards.forEach((shard, shardIndex) => {
                const basePosition = shard.userData.basePosition;
                const floatOffset = shard.userData.floatOffset;
                const bob = Math.sin(elapsed * 1.15 + floatOffset) * 0.12;
                shard.position.set(
                    basePosition.x + Math.sin(elapsed * 0.45 + shardIndex) * 0.05,
                    basePosition.y + bob,
                    basePosition.z + Math.cos(elapsed * 0.38 + shardIndex) * 0.04
                );
                shard.rotation.x += 0.004 * shard.userData.spinSpeed;
                shard.rotation.y += 0.006 * shard.userData.spinSpeed;
            });

            particles.rotation.y = elapsed * 0.035;
            particles.rotation.z = Math.sin(elapsed * 0.25) * 0.08;
            streaks.rotation.y = elapsed * -0.045;
            streaks.rotation.z = Math.sin(elapsed * 0.34) * 0.08;

            renderer.render(scene, camera);
            frameId = window.requestAnimationFrame(animate);
        };

        const onVisibilityChange = () => {
            visible = document.visibilityState === 'visible';
            if (!visible && frameId) {
                window.cancelAnimationFrame(frameId);
                frameId = 0;
                return;
            }
            if (visible && !frameId) {
                frameId = window.requestAnimationFrame(animate);
            }
        };

        const onContextLost = (event) => {
            event.preventDefault();
            visible = false;
            if (frameId) {
                window.cancelAnimationFrame(frameId);
                frameId = 0;
            }
            target.classList.add('is-fallback');
            document.body.classList.remove('three-hero-ready');
        };

        resize();
        target.classList.add('is-ready');
        document.body.classList.add('three-hero-ready');
        window.addEventListener('resize', resize, { passive: true });
        target.addEventListener('pointermove', onPointerMove, { passive: true });
        canvas.addEventListener('webglcontextlost', onContextLost, false);
        document.addEventListener('visibilitychange', onVisibilityChange);
        frameId = window.requestAnimationFrame(animate);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
