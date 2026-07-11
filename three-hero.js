(() => {
    const target = document.querySelector('[data-three-hero]');
    const initialCanvas = target?.querySelector('.hero-three-canvas');
    const status = target?.querySelector('.hero-three-status');

    if (!target || !initialCanvas) return;
    if (target.dataset.threeInitialized === 'true') return;
    target.dataset.threeInitialized = 'true';

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const coarsePointerQuery = window.matchMedia?.('(pointer: coarse)');
    const minWidth = 720;
    const moduleUrls = [
        new URL('./vendor/three.module.js?v=160.1', document.baseURI).href,
        'https://unpkg.com/three@0.160.0/build/three.module.js',
        'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
    ];
    const state = {
        canvas: initialCanvas,
        runtime: null,
        modulePromise: null,
        bootPromise: null,
        frameId: 0,
        retryTimer: 0,
        recoveryTimer: 0,
        resizeFrameId: 0,
        retryCount: 0,
        contextLost: false,
        inView: true,
        resizeObserver: null,
        intersectionObserver: null,
        reduceMotion: Boolean(motionQuery?.matches),
        pointer: { x: 0, y: 0, targetX: 0, targetY: 0 }
    };

    const createSeededRandom = () => {
        let seed = 120428;
        return () => {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };
    };

    const setMode = (mode, message) => {
        target.classList.remove('is-loading', 'is-ready', 'is-static', 'is-recovering', 'is-fallback');

        if (mode === 'static') {
            target.classList.add('is-ready', 'is-static');
        } else {
            target.classList.add(`is-${mode}`);
        }

        if (status && message) status.textContent = message;

        if (mode === 'ready' || mode === 'static') {
            document.body.classList.add('three-hero-ready');
        } else {
            document.body.classList.remove('three-hero-ready');
        }
    };

    const getSkipReason = () => {
        if (window.innerWidth < minWidth) return 'viewport is too narrow';
        if (coarsePointerQuery?.matches && window.innerWidth < 900) return 'compact touch viewport';
        const rect = target.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return 'hero is not visible';
        return '';
    };

    const loadThree = async () => {
        if (state.modulePromise) return state.modulePromise;

        state.modulePromise = (async () => {
            let lastError;
            for (const moduleUrl of moduleUrls) {
                try {
                    return await new Promise((resolve, reject) => {
                        const timeoutId = window.setTimeout(() => {
                            reject(new Error(`Timed out loading Three.js from ${moduleUrl}`));
                        }, 6000);
                        import(moduleUrl).then((module) => {
                            window.clearTimeout(timeoutId);
                            resolve(module);
                        }).catch((error) => {
                            window.clearTimeout(timeoutId);
                            reject(error);
                        });
                    });
                } catch (error) {
                    lastError = error;
                }
            }
            throw lastError || new Error('Three.js could not be loaded.');
        })();

        try {
            return await state.modulePromise;
        } catch (error) {
            state.modulePromise = null;
            throw error;
        }
    };

    const stopAnimation = () => {
        if (!state.frameId) return;
        window.cancelAnimationFrame(state.frameId);
        state.frameId = 0;
    };

    const shouldAnimate = () => (
        state.runtime &&
        !state.reduceMotion &&
        !state.contextLost &&
        state.inView &&
        document.visibilityState === 'visible'
    );

    const animate = (timestamp) => {
        if (!shouldAnimate()) {
            state.frameId = 0;
            return;
        }

        const pointer = state.pointer;
        pointer.x += (pointer.targetX - pointer.x) * 0.052;
        pointer.y += (pointer.targetY - pointer.y) * 0.052;
        state.runtime.renderFrame(timestamp * 0.001, pointer);
        state.frameId = window.requestAnimationFrame(animate);
    };

    const startAnimation = () => {
        if (!shouldAnimate() || state.frameId) return;
        state.frameId = window.requestAnimationFrame(animate);
    };

    const createGlowTexture = (THREE) => {
        const textureCanvas = document.createElement('canvas');
        textureCanvas.width = 128;
        textureCanvas.height = 128;
        const context = textureCanvas.getContext('2d');
        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 63);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.12, 'rgba(111,245,255,0.98)');
        gradient.addColorStop(0.38, 'rgba(20,241,255,0.38)');
        gradient.addColorStop(0.72, 'rgba(124,92,255,0.12)');
        gradient.addColorStop(1, 'rgba(124,92,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 128, 128);
        const texture = new THREE.CanvasTexture(textureCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    };

    const makeOutline = (THREE, mesh, color, opacity, scale = 1.025) => {
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

    const createRenderer = (THREE) => {
        const antialias = state.retryCount === 0 && (window.devicePixelRatio || 1) <= 1.75;
        const contextAttributes = {
            alpha: true,
            antialias,
            depth: true,
            stencil: false,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            powerPreference: state.retryCount >= 2 ? 'low-power' : 'default',
            failIfMajorPerformanceCaveat: false
        };
        const context = state.retryCount >= 2
            ? (
                state.canvas.getContext('webgl', contextAttributes) ||
                state.canvas.getContext('experimental-webgl', contextAttributes) ||
                state.canvas.getContext('webgl2', contextAttributes)
            )
            : (
                state.canvas.getContext('webgl2', contextAttributes) ||
                state.canvas.getContext('webgl', contextAttributes) ||
                state.canvas.getContext('experimental-webgl', contextAttributes)
            );

        if (!context) throw new Error('This browser did not provide a WebGL context.');

        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({
                canvas: state.canvas,
                context,
                alpha: true,
                antialias
            });
        } catch (error) {
            context.getExtension('WEBGL_lose_context')?.loseContext();
            throw error;
        }
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;

        const debugExtension = context.getExtension('WEBGL_debug_renderer_info');
        const rendererName = debugExtension
            ? context.getParameter(debugExtension.UNMASKED_RENDERER_WEBGL)
            : context.getParameter(context.RENDERER);
        target.dataset.threeRenderer = String(rendererName || 'WebGL renderer');
        target.dataset.threeContext = renderer.capabilities.isWebGL2 ? 'webgl2' : 'webgl';

        return renderer;
    };

    const createSceneRuntime = (THREE, renderer) => {
        const random = createSeededRandom();
        const qualityTier = state.retryCount;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
        camera.position.set(0, 0.06, 7.6);

        const colors = {
            cyan: 0x14f1ff,
            blue: 0x2477ff,
            violet: 0x8b5cf6,
            magenta: 0xff2dc7,
            ice: 0xdffbff,
            dark: 0x020617,
            panel: 0x07142d
        };
        const stage = new THREE.Group();
        const coreRig = new THREE.Group();
        const haloRig = new THREE.Group();
        const debrisRig = new THREE.Group();
        stage.add(haloRig, debrisRig, coreRig);
        scene.add(stage);

        const glowTexture = createGlowTexture(THREE);

        const backdrop = new THREE.Mesh(
            new THREE.CircleGeometry(2.48, 96),
            new THREE.MeshBasicMaterial({
                color: colors.blue,
                transparent: true,
                opacity: 0.035,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        backdrop.position.z = -1.22;
        haloRig.add(backdrop);

        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture,
            color: colors.cyan,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        }));
        glow.scale.set(4.7, 4.7, 1);
        glow.position.z = -0.82;
        haloRig.add(glow);

        const addArc = ({ radius, tube, color, opacity, arc, rotation, offset }) => {
            const mesh = new THREE.Mesh(
                new THREE.TorusGeometry(radius, tube, 6, 96, arc),
                new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                })
            );
            mesh.rotation.set(rotation.x, rotation.y, rotation.z + offset);
            mesh.userData.baseRotationZ = rotation.z + offset;
            haloRig.add(mesh);
            return mesh;
        };

        const arcs = [
            addArc({ radius: 1.62, tube: 0.014, color: colors.cyan, opacity: 0.82, arc: Math.PI * 1.46, rotation: { x: 1.03, y: 0.08, z: 0.12 }, offset: 0.2 }),
            addArc({ radius: 1.62, tube: 0.007, color: colors.ice, opacity: 0.36, arc: Math.PI * 0.34, rotation: { x: 1.03, y: 0.08, z: 0.12 }, offset: 5.26 }),
            addArc({ radius: 2.05, tube: 0.012, color: colors.violet, opacity: 0.58, arc: Math.PI * 1.22, rotation: { x: 0.48, y: 0.92, z: -0.34 }, offset: 1.08 }),
            addArc({ radius: 2.05, tube: 0.006, color: colors.cyan, opacity: 0.3, arc: Math.PI * 0.44, rotation: { x: 0.48, y: 0.92, z: -0.34 }, offset: 5.12 }),
            addArc({ radius: 2.46, tube: 0.01, color: colors.magenta, opacity: 0.42, arc: Math.PI * 1.12, rotation: { x: 1.46, y: -0.26, z: 0.62 }, offset: 2.14 }),
            addArc({ radius: 2.46, tube: 0.006, color: colors.blue, opacity: 0.28, arc: Math.PI * 0.46, rotation: { x: 1.46, y: -0.26, z: 0.62 }, offset: 5.72 })
        ];

        const sigilShape = new THREE.Shape();
        sigilShape.moveTo(-1.02, -1.16);
        sigilShape.lineTo(-0.52, -1.16);
        sigilShape.lineTo(-0.25, -0.42);
        sigilShape.lineTo(0.34, -0.42);
        sigilShape.lineTo(0.62, -1.16);
        sigilShape.lineTo(1.12, -1.16);
        sigilShape.lineTo(0.25, 1.18);
        sigilShape.lineTo(-0.18, 1.18);
        sigilShape.lineTo(-1.02, -1.16);

        const aperture = new THREE.Path();
        aperture.moveTo(-0.04, 0.29);
        aperture.lineTo(0.24, -0.25);
        aperture.lineTo(-0.24, -0.25);
        aperture.lineTo(-0.04, 0.29);
        sigilShape.holes.push(aperture);

        const sigilGeometry = new THREE.ExtrudeGeometry(sigilShape, {
            depth: 0.3,
            bevelEnabled: true,
            bevelThickness: 0.045,
            bevelSize: 0.04,
            bevelSegments: 2,
            curveSegments: 2
        });
        sigilGeometry.center();

        const sigilMaterial = new THREE.MeshStandardMaterial({
            color: colors.panel,
            emissive: 0x064b71,
            emissiveIntensity: 1.12,
            metalness: 0.72,
            roughness: 0.22
        });
        const sigil = new THREE.Mesh(sigilGeometry, sigilMaterial);
        sigil.scale.set(1.12, 1.18, 1.12);
        sigil.rotation.set(0.04, -0.14, 0.015);
        makeOutline(THREE, sigil, colors.cyan, 0.32, 1.035);
        coreRig.add(sigil);

        const sigilEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(sigilGeometry, 24),
            new THREE.LineBasicMaterial({
                color: colors.cyan,
                transparent: true,
                opacity: 0.72,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        sigilEdges.scale.set(1.125, 1.185, 1.125);
        sigilEdges.rotation.copy(sigil.rotation);
        coreRig.add(sigilEdges);

        const shadowSigil = new THREE.Mesh(
            sigilGeometry,
            new THREE.MeshBasicMaterial({
                color: colors.dark,
                transparent: true,
                opacity: 0.58,
                depthWrite: false
            })
        );
        shadowSigil.position.set(0.1, -0.05, -0.28);
        shadowSigil.scale.set(1.2, 1.26, 1.08);
        shadowSigil.rotation.copy(sigil.rotation);
        coreRig.add(shadowSigil);

        const core = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.22, 1),
            new THREE.MeshBasicMaterial({
                color: colors.ice,
                transparent: true,
                opacity: 0.94,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        core.position.set(0.02, -0.06, 0.34);
        coreRig.add(core);

        const coreHalo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture,
            color: colors.cyan,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        }));
        coreHalo.position.set(0.02, -0.06, 0.1);
        coreHalo.scale.set(1.36, 1.36, 1);
        coreRig.add(coreHalo);

        const spine = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.12, 4.2, 20, 1, true),
            new THREE.MeshBasicMaterial({
                color: colors.cyan,
                transparent: true,
                opacity: 0.16,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        spine.position.set(0.02, 0, -0.62);
        coreRig.add(spine);

        const satelliteGroup = new THREE.Group();
        const satelliteSpecs = [
            { angle: 0.22, radius: 2.18, speed: 0.28, color: colors.cyan },
            { angle: 2.34, radius: 2.42, speed: 0.22, color: colors.magenta },
            { angle: 4.36, radius: 2.3, speed: 0.25, color: colors.violet }
        ];
        const satellites = satelliteSpecs.map((spec) => {
            const node = new THREE.Group();
            const nodeCore = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.12, 0),
                new THREE.MeshBasicMaterial({ color: spec.color })
            );
            const nodeHalo = new THREE.Mesh(
                new THREE.TorusGeometry(0.24, 0.009, 5, 36),
                new THREE.MeshBasicMaterial({
                    color: spec.color,
                    transparent: true,
                    opacity: 0.58,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                })
            );
            nodeHalo.rotation.x = Math.PI / 2;
            node.add(nodeCore, nodeHalo);
            node.userData = { ...spec, core: nodeCore, halo: nodeHalo };
            satelliteGroup.add(node);
            return node;
        });
        haloRig.add(satelliteGroup);

        const beamPositions = new Float32Array(satellites.length * 6);
        const beamGeometry = new THREE.BufferGeometry();
        beamGeometry.setAttribute('position', new THREE.BufferAttribute(beamPositions, 3));
        const beams = new THREE.LineSegments(
            beamGeometry,
            new THREE.LineBasicMaterial({
                color: colors.cyan,
                transparent: true,
                opacity: 0.2,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        haloRig.add(beams);

        const shardGeometry = new THREE.TetrahedronGeometry(0.12, 0);
        const shardMaterial = new THREE.MeshBasicMaterial({
            color: colors.cyan,
            transparent: true,
            opacity: 0.56,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const shards = new THREE.InstancedMesh(shardGeometry, shardMaterial, 10);
        const shardMatrix = new THREE.Matrix4();
        const shardPosition = new THREE.Vector3();
        const shardQuaternion = new THREE.Quaternion();
        const shardScale = new THREE.Vector3();
        const shardEuler = new THREE.Euler();
        const shardPalette = [colors.cyan, colors.violet, colors.magenta, colors.blue];

        for (let shardIndex = 0; shardIndex < 10; shardIndex += 1) {
            const angle = (shardIndex / 10) * Math.PI * 2 + random() * 0.42;
            const radius = 2.32 + random() * 0.82;
            shardPosition.set(
                Math.cos(angle) * radius,
                (random() - 0.5) * 1.78,
                Math.sin(angle) * radius * 0.44
            );
            shardEuler.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
            shardQuaternion.setFromEuler(shardEuler);
            shardScale.setScalar(0.58 + random() * 0.68);
            shardMatrix.compose(shardPosition, shardQuaternion, shardScale);
            shards.setMatrixAt(shardIndex, shardMatrix);
            shards.setColorAt(shardIndex, new THREE.Color(shardPalette[shardIndex % shardPalette.length]));
        }
        debrisRig.add(shards);

        const particleCount = 118;
        const particlePositions = new Float32Array(particleCount * 3);
        const particleColors = new Float32Array(particleCount * 3);
        const particlePalette = [
            new THREE.Color(colors.cyan),
            new THREE.Color(colors.violet),
            new THREE.Color(colors.magenta),
            new THREE.Color(colors.ice)
        ];

        for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
            const radius = 1.66 + random() * 2.15;
            const angle = random() * Math.PI * 2;
            particlePositions[particleIndex * 3] = Math.cos(angle) * radius;
            particlePositions[(particleIndex * 3) + 1] = (random() - 0.5) * 2.7;
            particlePositions[(particleIndex * 3) + 2] = Math.sin(angle) * radius * 0.52;
            const color = particlePalette[Math.floor(random() * particlePalette.length)];
            particleColors[particleIndex * 3] = color.r;
            particleColors[(particleIndex * 3) + 1] = color.g;
            particleColors[(particleIndex * 3) + 2] = color.b;
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
        const particles = new THREE.Points(
            particleGeometry,
            new THREE.PointsMaterial({
                map: glowTexture,
                size: 0.095,
                transparent: true,
                opacity: 0.72,
                depthWrite: false,
                vertexColors: true,
                blending: THREE.AdditiveBlending
            })
        );
        debrisRig.add(particles);

        scene.add(new THREE.AmbientLight(0xa9d9ff, 0.82));
        const cyanLight = new THREE.PointLight(colors.cyan, 2.8, 12);
        cyanLight.position.set(-2.6, 2.3, 3.5);
        scene.add(cyanLight);
        const magentaLight = new THREE.PointLight(colors.magenta, 1.75, 10);
        magentaLight.position.set(2.8, -1.8, 3.1);
        scene.add(magentaLight);
        const topLight = new THREE.DirectionalLight(0xffffff, 0.52);
        topLight.position.set(0.2, 3.2, 2.1);
        scene.add(topLight);

        let lastWidth = 0;
        let lastHeight = 0;
        let lastPixelRatio = 0;
        const resize = () => {
            const rect = target.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));
            const pixelBudgetRatio = Math.sqrt(1500000 / (width * height));
            const maxRatio = qualityTier > 0 ? 1 : (width < 900 ? 1.2 : 1.4);
            const pixelRatio = Math.max(0.85, Math.min(window.devicePixelRatio || 1, maxRatio, pixelBudgetRatio));

            if (width === lastWidth && height === lastHeight && Math.abs(pixelRatio - lastPixelRatio) < 0.01) {
                return false;
            }

            lastWidth = width;
            lastHeight = height;
            lastPixelRatio = pixelRatio;
            renderer.setDrawingBufferSize(width, height, pixelRatio);
            camera.aspect = width / height;
            camera.position.z = width < 900 ? 8.25 : 7.6;
            stage.scale.setScalar(width < 900 ? 0.86 : 1);
            camera.updateProjectionMatrix();
            return true;
        };

        const renderFrame = (elapsed, pointer) => {
            const pulse = 1 + Math.sin(elapsed * 1.85) * 0.06;
            stage.rotation.y = pointer.x * 0.52;
            stage.rotation.x = -pointer.y * 0.34;
            coreRig.rotation.y = Math.sin(elapsed * 0.26) * 0.12;
            coreRig.rotation.z = Math.sin(elapsed * 0.17) * 0.025;
            sigil.rotation.y = -0.14 + Math.sin(elapsed * 0.3) * 0.08;
            sigilEdges.rotation.y = sigil.rotation.y;
            shadowSigil.rotation.y = sigil.rotation.y;
            core.rotation.x = elapsed * -0.48;
            core.rotation.y = elapsed * 0.7;
            core.scale.setScalar(pulse);
            coreHalo.material.opacity = 0.62 + Math.sin(elapsed * 1.85) * 0.1;
            coreHalo.scale.setScalar(1.3 + Math.sin(elapsed * 1.85) * 0.12);
            glow.material.opacity = 0.36 + Math.sin(elapsed * 0.72) * 0.055;
            spine.material.opacity = 0.13 + Math.sin(elapsed * 1.6) * 0.035;

            arcs.forEach((arc, arcIndex) => {
                const direction = arcIndex % 2 === 0 ? 1 : -1;
                arc.rotation.z = arc.userData.baseRotationZ + elapsed * direction * (0.055 + arcIndex * 0.008);
            });

            satellites.forEach((node, nodeIndex) => {
                const nodeAngle = node.userData.angle + elapsed * node.userData.speed;
                const radius = node.userData.radius;
                const y = Math.sin(elapsed * 0.7 + nodeIndex * 1.9) * 0.28;
                node.position.set(Math.cos(nodeAngle) * radius, y, Math.sin(nodeAngle) * radius * 0.34);
                node.userData.core.rotation.x = elapsed * 0.52 + nodeIndex;
                node.userData.core.rotation.y = elapsed * 0.68 + nodeIndex;
                node.userData.halo.rotation.z = elapsed * (0.42 + nodeIndex * 0.06);
                const beamOffset = nodeIndex * 6;
                beamPositions[beamOffset] = 0;
                beamPositions[beamOffset + 1] = 0;
                beamPositions[beamOffset + 2] = -0.02;
                beamPositions[beamOffset + 3] = node.position.x;
                beamPositions[beamOffset + 4] = node.position.y;
                beamPositions[beamOffset + 5] = node.position.z;
            });
            beamGeometry.attributes.position.needsUpdate = true;

            debrisRig.rotation.y = elapsed * -0.045;
            debrisRig.rotation.z = Math.sin(elapsed * 0.22) * 0.045;
            particles.rotation.y = elapsed * 0.035;
            shards.rotation.x = Math.sin(elapsed * 0.18) * 0.08;
            renderer.render(scene, camera);
        };

        const dispose = () => {
            const geometries = new Set();
            const materials = new Set();
            const textures = new Set([glowTexture]);
            scene.traverse((object) => {
                if (object.geometry) geometries.add(object.geometry);
                const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
                objectMaterials.filter(Boolean).forEach((material) => {
                    materials.add(material);
                    Object.values(material).forEach((value) => {
                        if (value?.isTexture) textures.add(value);
                    });
                });
            });
            geometries.forEach((geometry) => geometry.dispose());
            materials.forEach((material) => material.dispose());
            textures.forEach((texture) => texture.dispose());
            renderer.dispose();
        };

        return { renderer, resize, renderFrame, dispose };
    };

    const teardownRuntime = () => {
        stopAnimation();
        if (!state.runtime) return;
        try {
            state.runtime.dispose();
        } catch (error) {
            console.info('Atrak 3D cleanup completed with a recoverable warning.', error);
        }
        state.runtime = null;
    };

    const detachCanvasEvents = (canvas) => {
        canvas.removeEventListener('webglcontextlost', onContextLost);
        canvas.removeEventListener('webglcontextrestored', onContextRestored);
        canvas.removeEventListener('webglcontextcreationerror', onContextCreationError);
    };

    const attachCanvasEvents = (canvas) => {
        canvas.addEventListener('webglcontextlost', onContextLost, false);
        canvas.addEventListener('webglcontextrestored', onContextRestored, false);
        canvas.addEventListener('webglcontextcreationerror', onContextCreationError, false);
    };

    const replaceCanvas = () => {
        const oldCanvas = state.canvas;
        detachCanvasEvents(oldCanvas);
        const nextCanvas = oldCanvas.cloneNode(false);
        oldCanvas.replaceWith(nextCanvas);
        state.canvas = nextCanvas;
        attachCanvasEvents(nextCanvas);
    };

    const clearRetryTimer = () => {
        window.clearTimeout(state.retryTimer);
        state.retryTimer = 0;
    };

    const clearRecoveryTimer = () => {
        window.clearTimeout(state.recoveryTimer);
        state.recoveryTimer = 0;
    };

    const scheduleRetry = () => {
        if (state.retryCount >= 2 || getSkipReason()) {
            setMode('fallback', 'Atrak visual · standby');
            return;
        }
        const retryDelays = [900, 2800];
        const delay = retryDelays[state.retryCount] || retryDelays[retryDelays.length - 1];
        state.retryCount += 1;
        state.retryTimer = window.setTimeout(() => {
            state.retryTimer = 0;
            boot(`retry-${state.retryCount}`);
        }, delay);
    };

    const boot = (reason = 'initial') => {
        if (state.bootPromise) return state.bootPromise;

        const skipReason = getSkipReason();
        if (skipReason) {
            setMode('fallback', 'Atrak visual · standby');
            console.info(`Atrak 3D hero skipped: ${skipReason}.`);
            return Promise.resolve();
        }

        clearRetryTimer();
        setMode('loading', 'Starting Atrak core');
        state.bootPromise = (async () => {
            try {
                const THREE = await loadThree();
                const latestSkipReason = getSkipReason();
                if (latestSkipReason) throw new Error(latestSkipReason);

                teardownRuntime();
                const renderer = createRenderer(THREE);
                try {
                    state.runtime = createSceneRuntime(THREE, renderer);
                } catch (error) {
                    renderer.dispose();
                    throw error;
                }
                state.contextLost = false;
                state.runtime.resize();
                state.runtime.renderFrame(state.reduceMotion ? 1.6 : performance.now() * 0.001, state.pointer);
                state.retryCount = 0;
                setMode(
                    state.reduceMotion ? 'static' : 'ready',
                    state.reduceMotion ? 'Atrak core · static' : 'Atrak core · online'
                );
                startAnimation();
                console.info('Atrak 3D hero ready.', {
                    context: target.dataset.threeContext,
                    renderer: target.dataset.threeRenderer,
                    reason
                });
            } catch (error) {
                console.warn('Atrak 3D hero could not start.', error);
                teardownRuntime();
                replaceCanvas();
                setMode('recovering', 'Restoring Atrak core');
                scheduleRetry();
            }
        })().finally(() => {
            state.bootPromise = null;
        });

        return state.bootPromise;
    };

    function onContextLost(event) {
        event.preventDefault();
        if (state.contextLost) return;
        state.contextLost = true;
        stopAnimation();
        setMode('recovering', 'Restoring Atrak core');
        console.warn('Atrak 3D hero lost its WebGL context. Recovery started.');
        state.recoveryTimer = window.setTimeout(() => {
            if (!state.contextLost) return;
            teardownRuntime();
            replaceCanvas();
            state.contextLost = false;
            state.retryCount = 0;
            boot('context-loss-timeout');
        }, 2400);
    }

    function onContextRestored() {
        clearRecoveryTimer();
        state.contextLost = false;
        window.setTimeout(() => {
            try {
                if (!state.runtime) throw new Error('The previous renderer is unavailable.');
                state.runtime.resize();
                state.runtime.renderFrame(performance.now() * 0.001, state.pointer);
                setMode(state.reduceMotion ? 'static' : 'ready', state.reduceMotion ? 'Atrak core · static' : 'Atrak core · online');
                startAnimation();
                console.info('Atrak 3D hero restored its WebGL context.');
            } catch (error) {
                console.warn('Atrak 3D hero is rebuilding after context restoration.', error);
                teardownRuntime();
                replaceCanvas();
                boot('context-restored-rebuild');
            }
        }, 120);
    }

    function onContextCreationError(event) {
        const detail = event.statusMessage || 'unknown WebGL creation error';
        target.dataset.threeError = detail;
        console.warn(`Atrak 3D context creation error: ${detail}`);
    }

    const onPointerMove = (event) => {
        const rect = target.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        state.pointer.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.72;
        state.pointer.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.58;
    };

    const onPointerLeave = () => {
        state.pointer.targetX = 0;
        state.pointer.targetY = 0;
    };

    const onVisibilityChange = () => {
        if (document.visibilityState !== 'visible') {
            stopAnimation();
            return;
        }
        if (state.contextLost) return;
        if (state.runtime && !state.contextLost) {
            state.runtime.resize();
            state.runtime.renderFrame(performance.now() * 0.001, state.pointer);
            startAnimation();
        } else if (!getSkipReason()) {
            state.retryCount = 0;
            boot('visibility-return');
        }
    };

    const onMotionChange = (event) => {
        state.reduceMotion = event.matches;
        if (!state.runtime) return;
        if (state.reduceMotion) {
            stopAnimation();
            state.runtime.renderFrame(1.6, state.pointer);
            setMode('static', 'Atrak core · static');
        } else {
            setMode('ready', 'Atrak core · online');
            startAnimation();
        }
    };

    const performResize = () => {
        state.resizeFrameId = 0;
        if (state.runtime) {
            const changed = state.runtime.resize();
            if (changed && (state.reduceMotion || !state.frameId)) {
                state.runtime.renderFrame(state.reduceMotion ? 1.6 : performance.now() * 0.001, state.pointer);
            }
        } else if (!getSkipReason()) {
            boot('resize-visible');
        }
    };

    const onResize = () => {
        if (state.resizeFrameId) return;
        state.resizeFrameId = window.requestAnimationFrame(performResize);
    };

    const destroy = () => {
        stopAnimation();
        clearRetryTimer();
        clearRecoveryTimer();
        if (state.resizeFrameId) {
            window.cancelAnimationFrame(state.resizeFrameId);
            state.resizeFrameId = 0;
        }
        state.resizeObserver?.disconnect();
        state.intersectionObserver?.disconnect();
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerleave', onPointerLeave);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('pageshow', onVisibilityChange);
        window.removeEventListener('online', onVisibilityChange);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pagehide', onPageHide);
        motionQuery?.removeEventListener?.('change', onMotionChange);
        detachCanvasEvents(state.canvas);
        teardownRuntime();
        target.dataset.threeInitialized = 'false';
    };

    function onPageHide(event) {
        stopAnimation();
        if (!event.persisted) destroy();
    }

    const start = () => {
        attachCanvasEvents(state.canvas);
        target.addEventListener('pointermove', onPointerMove, { passive: true });
        target.addEventListener('pointerleave', onPointerLeave, { passive: true });
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('pageshow', onVisibilityChange);
        window.addEventListener('online', onVisibilityChange);
        window.addEventListener('resize', onResize, { passive: true });
        window.addEventListener('pagehide', onPageHide);
        motionQuery?.addEventListener?.('change', onMotionChange);

        if ('ResizeObserver' in window) {
            state.resizeObserver = new ResizeObserver(onResize);
            state.resizeObserver.observe(target);
        }

        if ('IntersectionObserver' in window) {
            state.intersectionObserver = new IntersectionObserver((entries) => {
                state.inView = entries.some((entry) => entry.isIntersecting);
                if (state.inView) startAnimation();
                else stopAnimation();
            }, { rootMargin: '120px' });
            state.intersectionObserver.observe(target);
        }

        boot();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
