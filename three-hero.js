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
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(0, 0.08, 7.65);

        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'low-power'
        });
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.22;

        const stageGroup = new THREE.Group();
        stageGroup.position.set(0.05, 0.02, 0);
        scene.add(stageGroup);

        const portalGroup = new THREE.Group();
        const sigilRig = new THREE.Group();
        stageGroup.add(portalGroup, sigilRig);

        const neonColors = {
            cyan: 0x14f1ff,
            blue: 0x0f6bff,
            violet: 0x8b5cf6,
            magenta: 0xff2dc7,
            dark: 0x030716,
            white: 0xf8fbff
        };

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

        const createPortal = () => {
            const portalUniforms = {
                uTime: { value: 0 },
                uAccentA: { value: new THREE.Color(neonColors.cyan) },
                uAccentB: { value: new THREE.Color(neonColors.magenta) }
            };

            const portal = new THREE.Mesh(
                new THREE.PlaneGeometry(5.6, 4.0, 1, 1),
                new THREE.ShaderMaterial({
                    uniforms: portalUniforms,
                    transparent: true,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending,
                    vertexShader: `
                        varying vec2 vUv;

                        void main() {
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform float uTime;
                        uniform vec3 uAccentA;
                        uniform vec3 uAccentB;
                        varying vec2 vUv;

                        float neonRing(float distanceValue, float radius, float width) {
                            return 1.0 - smoothstep(0.0, width, abs(distanceValue - radius));
                        }

                        void main() {
                            vec2 centered = vUv - 0.5;
                            centered.x *= 1.42;
                            float distanceValue = length(centered);
                            float angle = atan(centered.y, centered.x);
                            float outerMask = 1.0 - smoothstep(0.44, 0.62, distanceValue);
                            float coreGlow = smoothstep(0.42, 0.02, distanceValue) * 0.28;
                            float rings = neonRing(distanceValue, 0.16, 0.012) * 0.72;
                            rings += neonRing(distanceValue, 0.29, 0.008) * 0.58;
                            rings += neonRing(distanceValue, 0.42, 0.006) * 0.42;
                            float radialTicks = smoothstep(0.985, 1.0, abs(sin((angle + uTime * 0.22) * 18.0)));
                            radialTicks *= smoothstep(0.08, 0.36, distanceValue) * outerMask * 0.18;
                            float sweep = pow(max(0.0, cos(angle - uTime * 0.78)), 10.0);
                            sweep *= smoothstep(0.45, 0.08, distanceValue) * 0.42;
                            float scan = smoothstep(0.965, 1.0, sin((centered.y - uTime * 0.08) * 46.0)) * 0.08;
                            vec3 colorValue = mix(uAccentB, uAccentA, smoothstep(-0.8, 0.8, centered.x + sin(uTime * 0.25) * 0.18));
                            float alphaValue = (coreGlow + rings + radialTicks + sweep + scan) * outerMask;
                            gl_FragColor = vec4(colorValue, alphaValue);
                        }
                    `
                })
            );
            portal.position.set(0, 0, -1.08);
            portal.userData.uniforms = portalUniforms;
            portalGroup.add(portal);

            const portalBackplate = new THREE.Mesh(
                new THREE.CircleGeometry(2.08, 96),
                new THREE.MeshBasicMaterial({
                    color: neonColors.violet,
                    transparent: true,
                    opacity: 0.045,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            portalBackplate.position.set(0, 0, -1.1);
            portalGroup.add(portalBackplate);

            return portal;
        };

        const createAtrakSigil = () => {
            const sigilGroup = new THREE.Group();

            const sigilShape = new THREE.Shape();
            sigilShape.moveTo(-1.02, -1.08);
            sigilShape.lineTo(-0.53, -1.08);
            sigilShape.lineTo(-0.29, -0.44);
            sigilShape.lineTo(0.35, -0.44);
            sigilShape.lineTo(0.6, -1.08);
            sigilShape.lineTo(1.12, -1.08);
            sigilShape.lineTo(0.24, 1.12);
            sigilShape.lineTo(-0.12, 1.12);
            sigilShape.lineTo(-1.02, -1.08);

            const aperture = new THREE.Path();
            aperture.moveTo(-0.04, 0.22);
            aperture.lineTo(0.22, -0.24);
            aperture.lineTo(-0.22, -0.24);
            aperture.lineTo(-0.04, 0.22);
            sigilShape.holes.push(aperture);

            const sigilGeometry = new THREE.ExtrudeGeometry(sigilShape, {
                depth: 0.2,
                bevelEnabled: true,
                bevelThickness: 0.036,
                bevelSize: 0.032,
                bevelSegments: 2,
                curveSegments: 2
            });
            sigilGeometry.center();

            const sigilMaterial = new THREE.MeshToonMaterial({
                color: 0x07152d,
                emissive: 0x063f68,
                emissiveIntensity: 0.88
            });
            const sigil = new THREE.Mesh(sigilGeometry, sigilMaterial);
            sigil.scale.set(0.95, 0.95, 0.95);
            sigil.rotation.set(0.06, -0.17, 0.01);
            makeOutline(sigil, 1.032, neonColors.cyan, 0.34);

            const sigilEdges = new THREE.LineSegments(
                new THREE.EdgesGeometry(sigilGeometry, 26),
                new THREE.LineBasicMaterial({
                    color: neonColors.cyan,
                    transparent: true,
                    opacity: 0.54,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            sigilEdges.scale.setScalar(1.003);
            sigil.add(sigilEdges);
            sigilGroup.add(sigil);

            const core = new THREE.Mesh(
                new THREE.IcosahedronGeometry(0.2, 1),
                new THREE.MeshBasicMaterial({
                    color: neonColors.cyan,
                    transparent: true,
                    opacity: 0.86,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            core.position.set(0.02, -0.08, 0.18);
            core.userData.baseScale = 1;
            sigilGroup.add(core);

            const aura = new THREE.Mesh(
                new THREE.IcosahedronGeometry(0.74, 2),
                new THREE.MeshBasicMaterial({
                    color: neonColors.magenta,
                    transparent: true,
                    opacity: 0.055,
                    wireframe: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            aura.position.set(0.02, -0.02, -0.04);
            sigilGroup.add(aura);

            const bladeMaterial = new THREE.MeshToonMaterial({
                color: neonColors.blue,
                emissive: neonColors.cyan,
                emissiveIntensity: 0.38
            });
            const bladeGeometry = new THREE.ConeGeometry(0.12, 0.82, 4);
            const bladeData = [
                { position: [-0.98, 0.45, -0.05], rotation: [0.18, 0.0, -0.72], scale: [0.8, 1.0, 0.62] },
                { position: [0.98, 0.42, -0.06], rotation: [-0.18, 0.0, 0.72], scale: [0.8, 1.0, 0.62] },
                { position: [0.06, 1.1, -0.08], rotation: [0.0, 0.0, -0.03], scale: [0.72, 0.78, 0.54] }
            ];

            bladeData.forEach((bladeItem) => {
                const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
                blade.position.set(...bladeItem.position);
                blade.rotation.set(...bladeItem.rotation);
                blade.scale.set(...bladeItem.scale);
                makeOutline(blade, 1.16, neonColors.dark, 0.62);
                sigilGroup.add(blade);
            });

            sigilGroup.userData = { sigil, core, aura };
            return sigilGroup;
        };

        const createRibbon = ({ color, radius, depthScale, tubeRadius, rotation, phase, opacity, yOffset }) => {
            const points = [];
            const pointTotal = 136;
            for (let pointIndex = 0; pointIndex <= pointTotal; pointIndex += 1) {
                const progress = pointIndex / pointTotal;
                const angle = progress * Math.PI * 2;
                const wave = Math.sin(angle * 2 + phase) * 0.24 + Math.sin(angle * 5 + phase) * 0.045;
                points.push(new THREE.Vector3(
                    Math.cos(angle) * radius,
                    wave + yOffset,
                    Math.sin(angle) * radius * depthScale
                ));
            }

            const curve = new THREE.CatmullRomCurve3(points, true);
            const geometry = new THREE.TubeGeometry(curve, 190, tubeRadius, 8, true);
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
            sigilRig.add(ribbon);
            return ribbon;
        };

        const createSatelliteSystem = () => {
            const satelliteGroup = new THREE.Group();
            const beamPositions = new Float32Array(4 * 2 * 3);
            const beamGeometry = new THREE.BufferGeometry();
            beamGeometry.setAttribute('position', new THREE.BufferAttribute(beamPositions, 3));
            const beams = new THREE.LineSegments(
                beamGeometry,
                new THREE.LineBasicMaterial({
                    color: neonColors.cyan,
                    transparent: true,
                    opacity: 0.34,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            satelliteGroup.add(beams);

            const nodeSpecs = [
                { color: neonColors.cyan, baseAngle: 0.18, radius: 2.22, speed: 0.52, vertical: 0.28 },
                { color: neonColors.magenta, baseAngle: 1.92, radius: 2.48, speed: 0.44, vertical: 0.36 },
                { color: neonColors.violet, baseAngle: 3.34, radius: 2.36, speed: 0.48, vertical: 0.24 },
                { color: neonColors.blue, baseAngle: 4.78, radius: 2.62, speed: 0.38, vertical: 0.32 }
            ];

            const satellites = nodeSpecs.map((nodeSpec, nodeIndex) => {
                const node = new THREE.Group();
                const core = new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.17, 0),
                    new THREE.MeshToonMaterial({
                        color: nodeSpec.color,
                        emissive: nodeSpec.color,
                        emissiveIntensity: 0.36
                    })
                );
                makeOutline(core, 1.16, neonColors.dark, 0.64);
                node.add(core);

                const halo = new THREE.Mesh(
                    new THREE.TorusGeometry(0.32, 0.01, 8, 48),
                    new THREE.MeshBasicMaterial({
                        color: nodeSpec.color,
                        transparent: true,
                        opacity: 0.52,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    })
                );
                halo.rotation.x = Math.PI / 2;
                node.add(halo);

                const labelTick = new THREE.Mesh(
                    new THREE.BoxGeometry(0.34, 0.018, 0.018),
                    new THREE.MeshBasicMaterial({
                        color: nodeSpec.color,
                        transparent: true,
                        opacity: 0.72,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    })
                );
                labelTick.position.set(0.36, 0.02, 0);
                node.add(labelTick);

                node.userData = {
                    baseAngle: nodeSpec.baseAngle,
                    nodeIndex,
                    radius: nodeSpec.radius,
                    speed: nodeSpec.speed,
                    vertical: nodeSpec.vertical,
                    core,
                    halo,
                    labelTick
                };
                satelliteGroup.add(node);
                return node;
            });

            satelliteGroup.userData = { satellites, beamPositions, beamGeometry };
            sigilRig.add(satelliteGroup);
            return satelliteGroup;
        };

        const createSparkTexture = () => {
            const sparkCanvas = document.createElement('canvas');
            sparkCanvas.width = 64;
            sparkCanvas.height = 64;
            const context = sparkCanvas.getContext('2d');
            const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.18, 'rgba(20,241,255,0.95)');
            gradient.addColorStop(0.5, 'rgba(255,45,199,0.36)');
            gradient.addColorStop(1, 'rgba(255,45,199,0)');
            context.fillStyle = gradient;
            context.beginPath();
            context.arc(32, 32, 31, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = 'rgba(255,255,255,0.78)';
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(32, 7);
            context.lineTo(32, 57);
            context.moveTo(7, 32);
            context.lineTo(57, 32);
            context.stroke();
            const texture = new THREE.CanvasTexture(sparkCanvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            return texture;
        };

        const portal = createPortal();
        const sigil = createAtrakSigil();
        sigilRig.add(sigil);

        const ribbons = [
            createRibbon({
                color: neonColors.cyan,
                radius: 1.86,
                depthScale: 0.52,
                tubeRadius: 0.016,
                rotation: { x: 1.05, y: 0.02, z: 0.7 },
                phase: 0.2,
                opacity: 0.62,
                yOffset: 0.02
            }),
            createRibbon({
                color: neonColors.magenta,
                radius: 2.16,
                depthScale: 0.46,
                tubeRadius: 0.012,
                rotation: { x: 0.46, y: 1.02, z: -0.42 },
                phase: 1.7,
                opacity: 0.46,
                yOffset: -0.02
            }),
            createRibbon({
                color: neonColors.violet,
                radius: 2.54,
                depthScale: 0.38,
                tubeRadius: 0.01,
                rotation: { x: 0.82, y: -0.74, z: 0.24 },
                phase: 3.2,
                opacity: 0.34,
                yOffset: 0.04
            }),
            createRibbon({
                color: neonColors.white,
                radius: 1.44,
                depthScale: 0.5,
                tubeRadius: 0.006,
                rotation: { x: 1.32, y: -0.22, z: -0.18 },
                phase: 4.7,
                opacity: 0.2,
                yOffset: -0.01
            })
        ];

        const satellites = createSatelliteSystem();

        const shardGeometries = [
            new THREE.TetrahedronGeometry(0.19, 0),
            new THREE.OctahedronGeometry(0.14, 0),
            new THREE.ConeGeometry(0.11, 0.32, 5)
        ];
        const shardColors = [neonColors.cyan, neonColors.magenta, neonColors.violet, 0x67e8f9];
        const shards = [];
        const shardTotal = 20;

        for (let shardIndex = 0; shardIndex < shardTotal; shardIndex += 1) {
            const geometry = shardGeometries[shardIndex % shardGeometries.length];
            const color = shardColors[shardIndex % shardColors.length];
            const material = new THREE.MeshToonMaterial({
                color,
                emissive: color,
                emissiveIntensity: 0.2
            });
            const shard = new THREE.Mesh(geometry, material);
            makeOutline(shard, 1.12, neonColors.dark, 0.68);

            const angle = (shardIndex / shardTotal) * Math.PI * 2 + random() * 0.35;
            const radius = 2.16 + random() * 1.45;
            const height = (random() - 0.5) * 1.92;
            shard.position.set(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius * 0.56
            );
            shard.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
            shard.scale.setScalar(0.65 + random() * 0.72);
            shard.userData = {
                basePosition: shard.position.clone(),
                floatOffset: random() * Math.PI * 2,
                spinSpeed: 0.42 + random() * 0.86
            };
            shards.push(shard);
            sigilRig.add(shard);
        }

        const particleCount = 380;
        const particlePositions = new Float32Array(particleCount * 3);
        const particleColors = new Float32Array(particleCount * 3);
        const colorOptions = [
            new THREE.Color(neonColors.cyan),
            new THREE.Color(neonColors.magenta),
            new THREE.Color(neonColors.violet),
            new THREE.Color(neonColors.white)
        ];

        for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
            const radius = 1.9 + random() * 2.8;
            const angle = random() * Math.PI * 2;
            const verticalOffset = (random() - 0.5) * 3.1;
            particlePositions[particleIndex * 3] = Math.cos(angle) * radius;
            particlePositions[(particleIndex * 3) + 1] = verticalOffset;
            particlePositions[(particleIndex * 3) + 2] = Math.sin(angle) * radius * 0.62;

            const color = colorOptions[Math.floor(random() * colorOptions.length)];
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
                map: createSparkTexture(),
                size: 0.075,
                transparent: true,
                opacity: 0.84,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                vertexColors: true
            })
        );
        sigilRig.add(particles);

        const streakTotal = 58;
        const streakPositions = new Float32Array(streakTotal * 2 * 3);
        for (let streakIndex = 0; streakIndex < streakTotal; streakIndex += 1) {
            const angle = random() * Math.PI * 2;
            const radius = 2.7 + random() * 1.8;
            const length = 0.26 + random() * 0.58;
            const verticalOffset = (random() - 0.5) * 2.3;
            const startOffset = streakIndex * 6;
            const startX = Math.cos(angle) * radius;
            const startY = verticalOffset;
            const startZ = Math.sin(angle) * radius * 0.48;
            streakPositions[startOffset] = startX;
            streakPositions[startOffset + 1] = startY;
            streakPositions[startOffset + 2] = startZ;
            streakPositions[startOffset + 3] = startX + Math.cos(angle + 0.85) * length;
            streakPositions[startOffset + 4] = startY + length * 0.18;
            streakPositions[startOffset + 5] = startZ + Math.sin(angle + 0.85) * length;
        }

        const streakGeometry = new THREE.BufferGeometry();
        streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
        const streaks = new THREE.LineSegments(
            streakGeometry,
            new THREE.LineBasicMaterial({
                color: neonColors.white,
                transparent: true,
                opacity: 0.2,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        sigilRig.add(streaks);

        scene.add(new THREE.AmbientLight(0x90c6ff, 0.76));
        const keyLight = new THREE.PointLight(neonColors.cyan, 2.8, 12);
        keyLight.position.set(-2.8, 2.5, 4.2);
        scene.add(keyLight);
        const rimLight = new THREE.PointLight(neonColors.magenta, 2.1, 12);
        rimLight.position.set(3.0, -1.8, 3.4);
        scene.add(rimLight);
        const topLight = new THREE.DirectionalLight(0xffffff, 0.48);
        topLight.position.set(0.4, 2.8, 1.8);
        scene.add(topLight);

        const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
        const resize = () => {
            const rect = target.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));
            const compact = width < 900;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.35 : 1.6));
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.position.z = compact ? 8.28 : 7.65;
            stageGroup.scale.setScalar(compact ? 0.86 : 1);
            camera.updateProjectionMatrix();
        };

        const onPointerMove = (event) => {
            const rect = target.getBoundingClientRect();
            pointer.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.68;
            pointer.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.68;
        };

        let frameId = 0;
        let visible = true;
        const clock = new THREE.Clock();

        const updateSatellites = (elapsed) => {
            const nodeList = satellites.userData.satellites;
            const beamPositions = satellites.userData.beamPositions;
            nodeList.forEach((node, nodeIndex) => {
                const nodeAngle = node.userData.baseAngle + elapsed * node.userData.speed + pointer.x * 0.12;
                const orbitRadius = node.userData.radius;
                const orbitY = Math.sin(elapsed * 1.08 + node.userData.baseAngle) * node.userData.vertical;
                const orbitZ = Math.sin(nodeAngle) * orbitRadius * 0.36;
                node.position.set(Math.cos(nodeAngle) * orbitRadius, orbitY, orbitZ);
                node.rotation.x = elapsed * 0.42 + nodeIndex;
                node.rotation.y = elapsed * 0.64 + nodeIndex * 0.5;
                node.userData.halo.rotation.z = elapsed * (0.58 + nodeIndex * 0.08);
                node.userData.labelTick.rotation.z = Math.sin(elapsed * 1.4 + nodeIndex) * 0.18;

                const beamOffset = nodeIndex * 6;
                beamPositions[beamOffset] = Math.cos(nodeAngle) * 0.34;
                beamPositions[beamOffset + 1] = orbitY * 0.18;
                beamPositions[beamOffset + 2] = 0.02;
                beamPositions[beamOffset + 3] = node.position.x;
                beamPositions[beamOffset + 4] = node.position.y;
                beamPositions[beamOffset + 5] = node.position.z;
            });
            satellites.userData.beamGeometry.attributes.position.needsUpdate = true;
        };

        const animate = () => {
            if (!visible) {
                frameId = 0;
                return;
            }

            const elapsed = clock.getElapsedTime();
            pointer.x += (pointer.targetX - pointer.x) * 0.055;
            pointer.y += (pointer.targetY - pointer.y) * 0.055;

            portal.userData.uniforms.uTime.value = elapsed;
            portalGroup.rotation.z = Math.sin(elapsed * 0.12) * 0.08;
            portalGroup.scale.setScalar(1 + Math.sin(elapsed * 0.72) * 0.018);

            sigilRig.rotation.y = elapsed * 0.1 + pointer.x;
            sigilRig.rotation.x = elapsed * 0.038 - pointer.y;
            sigilRig.rotation.z = Math.sin(elapsed * 0.18) * 0.035;

            const sigilCore = sigil.userData.core;
            const sigilAura = sigil.userData.aura;
            const sigilMesh = sigil.userData.sigil;
            sigilMesh.rotation.y = Math.sin(elapsed * 0.36) * 0.1;
            sigilCore.rotation.x = elapsed * -0.6;
            sigilCore.rotation.y = elapsed * 0.82;
            sigilCore.scale.setScalar(1 + Math.sin(elapsed * 2.7) * 0.16);
            sigilAura.rotation.x = elapsed * -0.22;
            sigilAura.rotation.y = elapsed * 0.34;
            sigilAura.material.opacity = 0.045 + Math.sin(elapsed * 1.9) * 0.012;

            ribbons.forEach((ribbon, ribbonIndex) => {
                const baseRotation = ribbon.userData.baseRotation;
                const pulse = Math.sin(elapsed * 1.4 + ribbon.userData.pulseOffset) * 0.08;
                ribbon.rotation.x = baseRotation.x + Math.sin(elapsed * 0.25 + ribbonIndex) * 0.05;
                ribbon.rotation.y = baseRotation.y + elapsed * (0.1 + ribbonIndex * 0.025);
                ribbon.rotation.z = baseRotation.z + elapsed * (0.16 - ribbonIndex * 0.035);
                ribbon.material.opacity = Math.max(0.08, ribbon.userData.baseOpacity + pulse);
            });

            updateSatellites(elapsed);

            shards.forEach((shard, shardIndex) => {
                const basePosition = shard.userData.basePosition;
                const floatOffset = shard.userData.floatOffset;
                const bob = Math.sin(elapsed * 1.15 + floatOffset) * 0.13;
                shard.position.set(
                    basePosition.x + Math.sin(elapsed * 0.45 + shardIndex) * 0.06,
                    basePosition.y + bob,
                    basePosition.z + Math.cos(elapsed * 0.38 + shardIndex) * 0.05
                );
                shard.rotation.x += 0.004 * shard.userData.spinSpeed;
                shard.rotation.y += 0.006 * shard.userData.spinSpeed;
            });

            particles.rotation.y = elapsed * 0.038;
            particles.rotation.z = Math.sin(elapsed * 0.25) * 0.08;
            streaks.rotation.y = elapsed * -0.048;
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
