document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start-btn");
    const teamInput = document.getElementById("team-name");
    const screenWelcome = document.getElementById("screen-welcome");
    const screenGame = document.getElementById("screen-game");
    const gameHeader = document.getElementById("game-header");
    const displayTeamName = document.getElementById("display-team-name");
    const timerDisplay = document.getElementById("timer");
    const statusMessage = document.getElementById("status-message");
    const missionTitle = document.getElementById("mission-title");
    const missionDesc = document.getElementById("mission-desc");
    
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
    const NFC_RADIUS = 25;

    let map = null;
    let playerMarker = null;
    let parvisCircle = null;
    let acteIICircle = null;

    let gameStep = 0; 
    let parvisUnlocked = false;
    let currentNfcIndex = 0;
    let collectedFragments = [];

    let audioEnigme1 = new Audio('enigme1.mp3');

    if (localStorage.getItem("gameStarted") === "true") {
        restoreGameState();
    }

    startBtn.addEventListener("click", () => {
        const teamName = teamInput.value.trim();
        if (!teamName) {
            alert("Veuillez entrer un nom d'équipe valide !");
            return;
        }

        localStorage.setItem("teamName", teamName);
        localStorage.setItem("gameStarted", "true");
        localStorage.setItem("startTime", Date.now());

        startGameSession(teamName);
    });

    function startGameSession(teamName) {
        screenWelcome.classList.remove("active");
        screenGame.classList.add("active");
        gameHeader.classList.remove("hidden");
        displayTeamName.textContent = teamName;

        startTimer();
        initMap();
        updateMissionDisplay();
    }

    function restoreGameState() {
        const teamName = localStorage.getItem("teamName") || "Agents";
        startGameSession(teamName);
    }

    function startTimer() {
        setInterval(() => {
            const startTime = parseInt(localStorage.getItem("startTime"), 10);
            const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
            const timeLeft = TOTAL_TIME - elapsedTime;

            if (timeLeft <= 0) {
                timerDisplay.textContent = "00:00:00";
                timerDisplay.style.color = "var(--danger-color)";
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
            color: '#d4af37',
            fillColor: '#d4af37',
            fillOpacity: 0.3,
            radius: PARVIS_RADIUS
        }).addTo(map).bindPopup("Parvis de l'Église (Point Audio)");

        if ("geolocation" in navigator) {
            navigator.geolocation.watchPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    if (!playerMarker) {
                        playerMarker = L.marker([lat, lng]).addTo(map).bindPopup("Votre position");
                    } else {
                        playerMarker.setLatLng([lat, lng]);
                    }

                    checkGameZones(lat, lng);
                },
                (error) => {
                    console.error("Erreur GPS : ", error.message);
                    statusMessage.textContent = "⚠️ Activez la géolocalisation.";
                },
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
            );
        }
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
            if (distParvis <= PARVIS_RADIUS) {
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
                statusMessage.style.color = "var(--accent-color)";
            }
        } else if (gameStep === 3) {
            const distActe2 = calculateDistance(lat, lng, TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG);
            if (distActe2 <= ACTE_II_RADIUS) {
                gameStep = 4; 
                updateMissionDisplay();
            } else {
                statusMessage.textContent = `🗺️ Acte II : Rejoignez le point astral (${Math.round(distActe2)} m restants)...`;
                statusMessage.style.color = "#3b82f6";
            }
        }
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
            if (!parvisUnlocked) {
                missionTitle.textContent = "Acte I : Rejoignez le Parvis";
                missionDesc.textContent = "Rendez-vous sur le parvis de l'église pour débloquer l'indice audio et la zone de recherche.";
                actionContainer.innerHTML = "";
            } else {
                const currentTarget = nfcTargets[currentNfcIndex];
                missionTitle.textContent = `Acte I : Balise NFC ${currentNfcIndex + 1} / 3 (${currentTarget.name})`;
                missionDesc.textContent = `🎧 Indice audio 'enigme1.mp3' disponible !\n${currentTarget.clue}\n\nFragments trouvés : [ ${collectedFragments.join(" - ")} ]`;
                
                actionContainer.innerHTML = `
                    <button id="play-audio-btn" class="btn-secondary" style="margin-bottom:10px; width:100%;">🔊 Écouter enigme1.mp3</button>
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="nfc-input" placeholder="Code NFC (ex: LE)..." style="flex:1; padding:8px;">
                        <button id="validate-nfc-btn" class="btn-primary">Valider</button>
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
                        alert("❌ Code NFC incorrect !");
                    }
                });
            }
        } 
        else if (gameStep === 2) {
            missionTitle.textContent = "Acte I : Validation Finale";
            missionDesc.textContent = "Entrez les deux mots clés pour valider l'Acte I et passer à l'Acte II :";
            
            actionContainer.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <input type="text" id="final-word-input" placeholder="Mot assemblé (ex: LEMURMURE)..." style="padding:8px;">
                    <input type="text" id="final-code-input" placeholder="Code audio secret (ex: 12)..." style="padding:8px;">
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
                    missionDesc.textContent = "Rejoignez le nouveau point GPS (N 47° 11,085' E 2° 36,823') pour débloquer l'astrolabe.";
                    
                    map.setView([TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG], 18);
                    acteIICircle = L.circle([TARGET_ACTE_II_LAT, TARGET_ACTE_II_LNG], {
                        color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.25, radius: ACTE_II_RADIUS
                    }).addTo(map).bindPopup("Zone de l'Acte II");

                    actionContainer.innerHTML = `<p style="color:#3b82f6; font-weight:bold;">🗺️ Suivez la carte GPS...</p>`;
                } else {
                    alert("❌ L'un des codes est incorrect (Vérifiez LEMURMURE et le code 12).");
                }
            });
        }
        else if (gameStep === 4) {
            missionTitle.textContent = "Acte II : L'Astrolabe (Gyroscope)";
            missionDesc.textContent = "Inclinez votre téléphone horizontalement pour stabiliser la sphère.";
            
            actionContainer.innerHTML = `
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; text-align: center;">
                    <p id="gyro-status" style="margin-bottom: 10px; font-weight: bold; color:#3b82f6;">🔄 En attente d'inclinaison...</p>
                    <button id="bypass-gyro" class="btn-secondary" style="font-size:0.8rem; padding:6px;">Forcer le gyroscope (Secours)</button>
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
            missionDesc.textContent = "Soufflez fort dans le microphone pour dissiper la glace.";
            
            actionContainer.innerHTML = `
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; text-align: center;">
                    <p style="margin-bottom: 10px; font-weight: bold; color:#3b82f6;">❄️ Glace active... Soufflez dans le micro !</p>
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
            missionTitle.textContent = "Acte II : Réussi !";
            missionDesc.textContent = "La glace a fondu et l'astrolabe est activé.";
            actionContainer.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.2); padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #10b981;">
                    <p style="color: #10b981; font-weight: bold; font-size: 1.1em;">🎉 Acte II Validé !</p>
                    <p>Code secret révélé : <strong>749</strong></p>
                </div>
            `;
        }
    }
});