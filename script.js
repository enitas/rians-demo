document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start-btn");
    const demoBtn = document.getElementById("demo-btn");
    const backHomeBtn = document.getElementById("back-home-btn");
    const teamInput = document.getElementById("team-name");
    const screenWelcome = document.getElementById("screen-welcome");
    const screenGame = document.getElementById("screen-game");
    const gameHeader = document.getElementById("game-header");
    const displayTeamName = document.getElementById("display-team-name");
    const timerDisplay = document.getElementById("timer");
    const statusMessage = document.getElementById("status-message");
    const missionTitle = document.getElementById("mission-title");
    const missionDesc = document.getElementById("mission-desc");
    const demoPanel = document.getElementById("demo-panel");
    
    const actionContainer = document.getElementById("action-container") || createActionContainer();

    const TOTAL_TIME = 120 * 60; // 120 minutes

    // --- COORDONNÉES GPS ---
    const PARVIS_LAT = 47.18562;
    const PARVIS_LNG = 2.61295;
    const PARVIS_RADIUS = 15; // 15 mètres

    const TARGET_ACTE_II_LAT = 47.18475;
    const TARGET_ACTE_II_LNG = 2.61372;
    const ACTE_II_RADIUS = 20;

    let map = null;
    let playerMarker = null;
    let parvisCircle = null;
    let acteIICircle = null;

    let gameStep = 0; 
    let parvisUnlocked = false;
    let isDemoMode = false;

    let audioEnigme1 = new Audio('enigme1.mp3');

    // Forcer l'affichage de l'accueil au démarrage
    localStorage.removeItem("gameStarted");

    startBtn.addEventListener("click", () => {
        initGame(false);
    });

    demoBtn.addEventListener("click", () => {
        isDemoMode = true;
        initGame(true);
    });

    // Bouton de retour Accueil
    if (backHomeBtn) {
        backHomeBtn.addEventListener("click", () => {
            screenGame.classList.remove("active");
            gameHeader.classList.add("hidden");
            demoPanel.classList.add("hidden");
            screenWelcome.classList.add("active");
            if (map) {
                map.remove();
                map = null;
                playerMarker = null;
            }
        });
    }

    function initGame(demo) {
        const teamName = teamInput.value.trim() || (demo ? "Délégation Officielle (Mairie)" : "");
        if (!teamName) {
            alert("Veuillez entrer un nom d'équipe ou de délégation valide !");
            return;
        }

        localStorage.setItem("teamName", teamName);
        localStorage.setItem("startTime", Date.now());

        screenWelcome.classList.remove("active");
        screenGame.classList.add("active");
        gameHeader.classList.remove("hidden");
        displayTeamName.textContent = teamName;

        if (demo) {
            demoPanel.classList.remove("hidden");
            setupDemoControls();
        } else {
            demoPanel.classList.add("hidden");
        }

        startTimer();
        initMap();
        updateMissionDisplay();
    }

    function startTimer() {
        setInterval(() => {
            const startTime = parseInt(localStorage.getItem("startTime"), 10);
            const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
            const timeLeft = TOTAL_TIME - elapsedTime;

            if (timeLeft <= 0) {
                timerDisplay.textContent = "00:00:00";
                timerDisplay.style.color = "var(--accent-red)";
                statusMessage.textContent = "TEMPS ÉCOULÉ !";
                return;
            }

            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            const seconds = timeLeft % 60;

            timerDisplay.textContent = 
                String(hours).padStart(2, '0') + ":" +
                String(minutes).padStart(2, '0') + ":" +
                String(seconds).padStart(2, '0');
        }, 1000);
    }

    function initMap() {
        if (map) return;
        map = L.map('map').setView([PARVIS_LAT, PARVIS_LNG], 18);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);

        parvisCircle = L.circle([PARVIS_LAT, PARVIS_LNG], {
            color: '#2563eb',
            fillColor: '#2563eb',
            fillOpacity: 0.3,
            radius: PARVIS_RADIUS
        }).addTo(map).bindPopup("Parvis de l'Église");

        if ("geolocation" in navigator) {
            navigator.geolocation.watchPosition(
                (position) => {
                    if (isDemoMode) return; 
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    updatePlayerPosition(lat, lng);
                },
                (error) => {
                    console.error("Erreur GPS : ", error.message);
                },
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
            );
        }
    }

    function updatePlayerPosition(lat, lng) {
        if (!playerMarker) {
            playerMarker = L.marker([lat, lng]).addTo(map).bindPopup("Votre position");
        } else {
            playerMarker.setLatLng([lat, lng]);
        }
        checkGameZones(lat, lng);
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }

    function checkGameZones(lat, lng) {
        if (gameStep <= 1) {
            const distParvis = calculateDistance(lat, lng, PARVIS_LAT, PARVIS_LNG);
            if (distParvis <= PARVIS_RADIUS || isDemoMode) {
                if (!parvisUnlocked) {
                    parvisUnlocked = true;
                    if (gameStep === 0) gameStep = 1;
                    updateMissionDisplay();
                }
                statusMessage.textContent = "📍 Sur le Parvis ! Indices audio & assemblage débloqués.";
                statusMessage.style.color = "#10b981";
            } else {
                parvisUnlocked = false;
                statusMessage.textContent = `🗺️ Rejoignez le parvis (${Math.round(distParvis)} m restants)...`;
                statusMessage.style.color = "#60a5fa";
            }
        } else if (gameStep === 3) {
            const distActe2 = calculateDistance(lat, lng, TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG);
            if (distActe2 <= ACTE_II_RADIUS || isDemoMode) {
                gameStep = 4; 
                updateMissionDisplay();
            } else {
                statusMessage.textContent = `🗺️ Acte II : Rejoignez la zone (${Math.round(distActe2)} m restants)...`;
                statusMessage.style.color = "#3b82f6";
            }
        }
    }

    // --- CONTRÔLES DU MODE DÉMO (MAIRIE) ---
    function setupDemoControls() {
        document.getElementById("demo-step-1").addEventListener("click", () => {
            parvisUnlocked = true;
            gameStep = 1;
            updatePlayerPosition(PARVIS_LAT, PARVIS_LNG);
            map.setView([PARVIS_LAT, PARVIS_LNG], 18);
            updateMissionDisplay();
            statusMessage.textContent = "⚡ [DÉMO] Parvis atteint.";
        });

        document.getElementById("demo-step-2").addEventListener("click", () => {
            parvisUnlocked = true;
            gameStep = 2; // Écran d'assemblage tout-en-un
            updateMissionDisplay();
            statusMessage.textContent = "⚡ [DÉMO] Accès direct au formulaire d'assemblage.";
        });

        document.getElementById("demo-step-3").addEventListener("click", () => {
            gameStep = 3; 
            updatePlayerPosition(TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG);
            map.setView([TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG], 18);
            if (!acteIICircle) {
                acteIICircle = L.circle([TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG], {
                    color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.25, radius: ACTE_II_RADIUS
                }).addTo(map).bindPopup("Zone Acte II");
            }
            updateMissionDisplay();
            statusMessage.textContent = "⚡ [DÉMO] Téléportation Acte II (GPS).";
        });

        document.getElementById("demo-step-4").addEventListener("click", () => {
            gameStep = 6; 
            updateMissionDisplay();
            statusMessage.textContent = "⚡ [DÉMO] Capteurs validés.";
        });
    }

    function createActionContainer() {
        const container = document.createElement("div");
        container.id = "action-container";
        container.style.marginTop = "12px";
        document.querySelector(".mission-card").appendChild(container);
        return container;
    }

    function updateMissionDisplay() {
        if (gameStep === 0 || gameStep === 1) {
            if (!parvisUnlocked && !isDemoMode) {
                missionTitle.textContent = "Acte I : Rejoignez le Parvis";
                missionDesc.textContent = "Rendez-vous sur le parvis de l'église pour débloquer l'indice audio et l'enquête.";
                actionContainer.innerHTML = "";
            } else {
                if (!parvisUnlocked && isDemoMode) parvisUnlocked = true;
                missionTitle.textContent = "Acte I : Enquête Historique";
                missionDesc.textContent = "🎧 Écoutez l'indice audio et préparez l'assemblage des indices trouvés sur le terrain.";
                
                actionContainer.innerHTML = `
                    <button id="play-audio-btn" class="btn-demo" style="margin-bottom:10px;">🔊 Écouter l'indice audio</button>
                    <button id="go-assembly-btn" class="btn-primary">Procéder à l'assemblage global</button>
                `;

                document.getElementById("play-audio-btn").addEventListener("click", () => {
                    audioEnigme1.play().catch(e => alert("Interaction requise pour lire l'audio"));
                });

                document.getElementById("go-assembly-btn").addEventListener("click", () => {
                    gameStep = 2;
                    updateMissionDisplay();
                });
            }
        } 
        else if (gameStep === 2) {
            // FORMULAIRE TOUT-EN-UN
            missionTitle.textContent = "🧩 Assemblage des Indices (Tout-en-un)";
            missionDesc.textContent = "Saisissez les deux éléments récoltés pour reconstituer la formule :";
            
            actionContainer.innerHTML = `
                <div class="unified-form">
                    <div>
                        <label for="input-le">1. Premier mot-clé :</label>
                        <input type="text" id="input-le" placeholder="Ex: LE" autocomplete="off">
                    </div>
                    <div>
                        <label for="input-mur">2. Deuxième mot-clé :</label>
                        <input type="text" id="input-mur" placeholder="Ex: MURE ou MUR" autocomplete="off">
                    </div>
                    <button id="validate-assembly-btn" class="btn-primary" style="margin-top:5px;">Valider l'assemblage global</button>
                </div>
            `;

            document.getElementById("validate-assembly-btn").addEventListener("click", () => {
                const valLe = document.getElementById("input-le").value.trim().toUpperCase();
                const valMur = document.getElementById("input-mur").value.trim().toUpperCase();

                if (valLe === "LE" && (valMur === "MUR" || valMur === "MURE")) {
                    gameStep = 3;
                    statusMessage.textContent = "🎉 Assemblage réussi ! Passage à l'Acte II.";
                    statusMessage.style.color = "#10b981";
                    
                    missionTitle.textContent = "Acte II : L'Astrolabe Céleste";
                    missionDesc.textContent = "Rejoignez la zone GPS de l'Acte II indiquée sur la carte.";
                    
                    map.setView([TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG], 18);
                    if (!acteIICircle) {
                        acteIICircle = L.circle([TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG], {
                            color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.25, radius: ACTE_II_RADIUS
                        }).addTo(map).bindPopup("Zone Acte II");
                    }

                    actionContainer.innerHTML = `<p style="color:#60a5fa; font-weight:bold; text-align:center;">🗺️ Suivez la carte vers l'Acte II...</p>`;
                } else {
                    alert("❌ Saisie incorrecte. Vérifiez vos indices (Attendu : LE et MUR/MURE).");
                }
            });
        }
        else if (gameStep === 4) {
            missionTitle.textContent = "Acte II : L'Astrolabe (Gyroscope)";
            missionDesc.textContent = "Inclinez votre téléphone horizontalement pour stabiliser l'artefact.";
            
            actionContainer.innerHTML = `
                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; text-align: center; border:1px solid #334155;">
                    <button id="bypass-gyro" class="btn-demo">Forcer le gyroscope (Secours)</button>
                </div>
            `;

            document.getElementById("bypass-gyro").addEventListener("click", () => {
                gameStep = 5; 
                updateMissionDisplay();
            });

            if (window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientation', (event) => {
                    if (gameStep !== 4) return;
                    if (Math.abs(event.beta) < 15 && Math.abs(event.gamma) < 15) {
                        gameStep = 5; 
                        updateMissionDisplay();
                    }
                });
            }
        }
        else if (gameStep === 5) {
            missionTitle.textContent = "Acte II : Le Souffle Givré";
            missionDesc.textContent = "Soufflez fort dans le microphone pour dissiper la glace magique.";
            
            actionContainer.innerHTML = `
                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; text-align: center; border:1px solid #334155;">
                    <p style="margin-bottom: 8px; font-size: 0.8rem; color:#60a5fa;">❄️ Soufflez dans le micro...</p>
                    <button id="bypass-mic" class="btn-primary">Passer l'étape (Secours)</button>
                </div>
            `;

            document.getElementById("bypass-mic").addEventListener("click", () => {
                gameStep = 6;
                updateMissionDisplay();
            });

            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                .then((stream) => {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const analyser = audioContext.createAnalyser();
                    const microphone = audioContext.createMediaStreamSource(stream);
                    microphone.connect(analyser);
                    analyser.fftSize = 256;
                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);

                    function checkBreath() {
                        if (gameStep !== 5) return;
                        analyser.getByteFrequencyData(dataArray);
                        let sum = 0;
                        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
                        if ((sum / bufferLength) > 40) { 
                            stream.getTracks().forEach(track => track.stop());
                            gameStep = 6;
                            updateMissionDisplay();
                        } else {
                            requestAnimationFrame(checkBreath);
                        }
                    }
                    checkBreath();
                })
                .catch((err) => {
                    console.log("Micro non dispo, utilisez le bouton de secours.");
                });
        }
        else if (gameStep === 6) {
            missionTitle.textContent = "Acte II : Mission Réussie !";
            missionDesc.textContent = "L'artefact est activé et le secret du territoire est révélé.";
            actionContainer.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.15); padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #10b981;">
                    <p style="color: #10b981; font-weight: bold; font-size: 1rem; margin-bottom: 4px;">🎉 Parcours Validé avec Succès !</p>
                    <p style="color: white; font-size: 0.85rem;">Code secret final : <strong>749</strong></p>
                </div>
            `;
        }
    }
});