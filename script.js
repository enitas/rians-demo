document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start-btn");
    const demoBtn = document.getElementById("demo-btn");
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
    const ACTE_II_RADIUS = 20; // 20 mètres

    const nfcTargets = [
        { name: "Parc de l'église", lat: 47.18567, lng: 2.61322, clue: "Indice 'bois'", code: "LE" },
        { name: "Banc de l'église", lat: 47.18578, lng: 2.61313, clue: "Niveau du banc", code: "MUR" },
        { name: "Zone 'En dessous'", lat: 47.18517, lng: 2.61380, clue: "Indice 'en dessous'", code: "MURE" }
    ];

    let map = null;
    let playerMarker = null;
    let parvisCircle = null;
    let acteIICircle = null;

    let gameStep = 0; 
    let parvisUnlocked = false;
    let currentNfcIndex = 0;
    let collectedFragments = [];
    let isDemoMode = false;

    let audioEnigme1 = new Audio('enigme1.mp3');

    // Nettoyage au chargement pour forcer l'affichage propre de l'accueil pro
    localStorage.removeItem("gameStarted");

    startBtn.addEventListener("click", () => {
        initGame(false);
    });

    demoBtn.addEventListener("click", () => {
        isDemoMode = true;
        initGame(true);
    });

    function initGame(demo) {
        const teamName = teamInput.value.trim() || (demo ? "Délégation Officielle (Mairie)" : "");
        if (!teamName) {
            alert("Veuillez entrer un nom d'équipe ou de délégation valide !");
            return;
        }

        localStorage.setItem("teamName", teamName);
        localStorage.setItem("gameStarted", "true");
        localStorage.setItem("startTime", Date.now());
        localStorage.setItem("isDemoMode", demo ? "true" : "false");

        startGameSession(teamName, demo);
    }

    function startGameSession(teamName, demo) {
        isDemoMode = (localStorage.getItem("isDemoMode") === "true") || demo;

        screenWelcome.classList.remove("active");
        screenGame.classList.add("active");
        gameHeader.classList.remove("hidden");
        displayTeamName.textContent = teamName;

        if (isDemoMode) {
            demoPanel.classList.remove("hidden");
            setupDemoControls();
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
                statusMessage.textContent = "TEMPS ÉCOULÉ ! Mission échouée.";
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
        }).addTo(map).bindPopup("Parvis de l'Église (Point Audio)");

        if ("geolocation" in navigator) {
            navigator.geolocation.watchPosition(
                (position) => {
                    if (isDemoMode) return; // En mode démo, on ignore le GPS réel
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    updatePlayerPosition(lat, lng);
                },
                (error) => {
                    console.error("Erreur GPS : ", error.message);
                    if (!isDemoMode) statusMessage.textContent = "⚠️ Activez la géolocalisation.";
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
                statusMessage.textContent = "📍 Sur le Parvis ! Audio et recherche NFC activés.";
                statusMessage.style.color = "#10b981";
            } else {
                if (parvisUnlocked && !audioEnigme1.paused) audioEnigme1.pause();
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
                statusMessage.textContent = `🗺️ Acte II : Rejoignez le point astral (${Math.round(distActe2)} m restants)...`;
                statusMessage.style.color = "#3b82f6";
            }
        }
    }

    // --- CONTRÔLES DU MODE DÉMO (PRÉSENTATION ÉLUS) ---
    function setupDemoControls() {
        document.getElementById("demo-step-1").addEventListener("click", () => {
            parvisUnlocked = true;
            gameStep = 1;
            currentNfcIndex = 0;
            collectedFragments = [];
            updatePlayerPosition(PARVIS_LAT, PARVIS_LNG);
            map.setView([PARVIS_LAT, PARVIS_LNG], 18);
            updateMissionDisplay();
            statusMessage.textContent = "⚡ [DÉMO] Parvis débloqué (Étape 1/3 NFC).";
        });

        document.getElementById("demo-step-2").addEventListener("click", () => {
            parvisUnlocked = true;
            gameStep = 2; // Validation finale Acte I
            collectedFragments = ["LE", "MUR", "MURE"];
            updateMissionDisplay();
            statusMessage.textContent = "⚡ [DÉMO] NFC validés. Entrez 'LEMURMURE' et '12'.";
        });

        document.getElementById("demo-step-3").addEventListener("click", () => {
            gameStep = 3; // Acte II GPS
            updatePlayerPosition(TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG);
            map.setView([TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG], 18);
            if (!acteIICircle) {
                acteIICircle = L.circle([TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG], {
                    color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.25, radius: ACTE_II_RADIUS
                }).addTo(map).bindPopup("Zone de l'Acte II");
            }
            updateMissionDisplay();
            statusMessage.textContent = "⚡ [DÉMO] Téléporté sur la zone Acte II.";
        });

        document.getElementById("demo-step-4").addEventListener("click", () => {
            gameStep = 6; // Victoire Acte II directe
            updateMissionDisplay();
            statusMessage.textContent = "⚡ [DÉMO] Capteurs validés avec succès !";
        });
    }

    function createActionContainer() {
        const container = document.createElement("div");
        container.id = "action-container";
        container.style.marginTop = "15px";
        document.querySelector(".mission-card").appendChild(container);
        return container;
    }

    function updateMissionDisplay() {
        if (gameStep === 0 || gameStep === 1) {
            if (!parvisUnlocked && !isDemoMode) {
                missionTitle.textContent = "Acte I : Rejoignez le Parvis";
                missionDesc.textContent = "Rendez-vous sur le parvis de l'église pour débloquer l'indice audio et la zone de recherche.";
                actionContainer.innerHTML = "";
            } else {
                if (!parvisUnlocked && isDemoMode) parvisUnlocked = true;
                const currentTarget = nfcTargets[currentNfcIndex];
                missionTitle.textContent = `Acte I : Balise NFC ${currentNfcIndex + 1} / 3 (${currentTarget.name})`;
                missionDesc.textContent = `🎧 Indice audio 'enigme1.mp3' disponible !\nIndice : ${currentTarget.clue}\n\nFragments trouvés : [ ${collectedFragments.join(" - ")} ]`;
                
                actionContainer.innerHTML = `
                    <button id="play-audio-btn" class="btn-secondary" style="margin-bottom:10px; width:100%; padding:10px; background:#1e293b; color:white; border:1px solid #334155; border-radius:6px; cursor:pointer;">🔊 Écouter l'indice audio</button>
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="nfc-input" placeholder="Code NFC (ex: LE)..." style="flex:1; padding:10px; background:#020408; border:1px solid #334155; border-radius:6px; color:white;">
                        <button id="validate-nfc-btn" class="btn-primary" style="padding:10px 15px;">Valider</button>
                    </div>
                `;

                document.getElementById("play-audio-btn").addEventListener("click", () => {
                    audioEnigme1.play().catch(e => alert("Interaction requise pour lire l'audio"));
                });

                document.getElementById("validate-nfc-btn").addEventListener("click", () => {
                    const val = document.getElementById("nfc-input").value.trim().toUpperCase();
                    if (val === currentTarget.code) {
                        collectedFragments.push(currentTarget.code);
                        currentNfcIndex++;
                        if (currentNfcIndex < nfcTargets.length) {
                            alert(`⚡ Fragment '${val}' validé !`);
                            updateMissionDisplay();
                        } else {
                            gameStep = 2; 
                            updateMissionDisplay();
                        }
                    } else {
                        alert("❌ Code NFC incorrect ! (Indice attendu : " + currentTarget.code + ")");
                    }
                });
            }
        } 
        else if (gameStep === 2) {
            missionTitle.textContent = "Acte I : Validation Finale";
            missionDesc.textContent = "Entrez les deux codes pour valider l'Acte I et passer à l'Acte II :";
            
            actionContainer.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <input type="text" id="final-word-input" placeholder="Mot assemblé (ex: LEMURMURE)..." style="padding:10px; background:#020408; border:1px solid #334155; border-radius:6px; color:white;">
                    <input type="text" id="final-code-input" placeholder="Code audio secret (ex: 12)..." style="padding:10px; background:#020408; border:1px solid #334155; border-radius:6px; color:white;">
                    <button id="validate-final-btn" class="btn-primary">Valider l'Acte I</button>
                </div>
            `;

            document.getElementById("validate-final-btn").addEventListener("click", () => {
                const wordVal = document.getElementById("final-word-input").value.trim().toUpperCase();
                const codeVal = document.getElementById("final-code-input").value.trim();

                if ((wordVal === "LEMURMURE" || wordVal === "LE MURMURE") && codeVal === "12") {
                    gameStep = 3;
                    statusMessage.textContent = "🏆 Acte I réussi ! Passage à l'Acte II.";
                    statusMessage.style.color = "#10b981";
                    
                    missionTitle.textContent = "Acte II : L'Astrolabe Céleste";
                    missionDesc.textContent = "Rejoignez le nouveau point GPS pour débloquer l'astrolabe.";
                    
                    map.setView([TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG], 18);
                    if (!acteIICircle) {
                        acteIICircle = L.circle([TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG], {
                            color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.25, radius: ACTE_II_RADIUS
                        }).addTo(map).bindPopup("Zone de l'Acte II");
                    }

                    actionContainer.innerHTML = `<p style="color:#60a5fa; font-weight:bold; text-align:center;">🗺️ Suivez la carte GPS vers l'Acte II...</p>`;
                } else {
                    alert("❌ Code incorrect (Rappel : LEMURMURE et 12).");
                }
            });
        }
        else if (gameStep === 4) {
            missionTitle.textContent = "Acte II : L'Astrolabe (Gyroscope)";
            missionDesc.textContent = "Inclinez votre téléphone horizontalement pour stabiliser la sphère.";
            
            actionContainer.innerHTML = `
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; text-align: center; border:1px solid #334155;">
                    <p style="margin-bottom: 10px; font-weight: bold; color:#60a5fa;">🔄 Stabilisation de l'artefact...</p>
                    <button id="bypass-gyro" class="btn-secondary" style="padding:8px 12px; background:#334155; color:white; border:none; border-radius:6px; cursor:pointer;">Forcer le gyroscope (Secours)</button>
                </div>
            `;

            document.getElementById("bypass-gyro").addEventListener("click", () => {
                gameStep = 5; 
                updateMissionDisplay();
            });

            if (window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientation', (event) => {
                    if (gameStep !== 4) return;
                    const beta = event.beta;   
                    const gamma = event.gamma; 
                    if (Math.abs(beta) < 15 && Math.abs(gamma) < 15) {
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
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; text-align: center; border:1px solid #334155;">
                    <p style="margin-bottom: 10px; font-weight: bold; color:#60a5fa;">❄️ Glace active... Soufflez dans le micro !</p>
                    <button id="bypass-mic" class="btn-primary" style="margin-top:10px;">Passer l'étape (Secours)</button>
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
                        let average = sum / bufferLength;

                        if (average > 40) { 
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
                    console.log("Micro non accessible, utilisez le bouton de secours.");
                });
        }
        else if (gameStep === 6) {
            missionTitle.textContent = "Acte II : Mission Réussie !";
            missionDesc.textContent = "L'artefact est activé et le secret du territoire est révélé.";
            actionContainer.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.15); padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #10b981;">
                    <p style="color: #10b981; font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">🎉 Parcours Validé avec Succès !</p>
                    <p style="color: white; font-size: 0.9rem;">Code secret final : <strong>749</strong></p>
                </div>
            `;
        }
    }
});