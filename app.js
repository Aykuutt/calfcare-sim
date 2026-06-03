// app.js
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const workerSlider = document.getElementById('worker-count');
    const workerVal = document.getElementById('worker-val');
    const ventSlider = document.getElementById('ventilation');
    const ventVal = document.getElementById('vent-val');
    const hygieneSlider = document.getElementById('hygiene');
    const hygieneVal = document.getElementById('hygiene-val');
    const budgetInput = document.getElementById('initial-budget');
    const barnSelect = document.getElementById('barn-type');
    const breedSelect = document.getElementById('calf-breed');
    const colostrumSlider = document.getElementById('colostrum-time');
    const colostrumVal = document.getElementById('colostrum-val');

    const btnStart = document.getElementById('btn-start');
    const btnSave = document.getElementById('btn-save');
    const btnExportCSV = document.getElementById('btn-export-csv');
    const btnAutoSimulate = document.getElementById('btn-auto-simulate');

    const timeVal = document.getElementById('time-val');
    const healthBar = document.getElementById('health-bar');
    const tempVal = document.getElementById('temp-val');
    const envTempVal = document.getElementById('env-temp-val');
    const budgetVal = document.getElementById('budget-val');
    const iggVal = document.getElementById('igg-val');
    const nh3Val = document.getElementById('nh3-val');
    const logContainer = document.getElementById('log-container');
    const dataTableBody = document.getElementById('data-table-body');

    // Chart.js Setup
    const ctx = document.getElementById('healthChart').getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Sağlık Skoru (%)',
                    data: [],
                    borderColor: '#38ef7d',
                    backgroundColor: 'rgba(56, 239, 125, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Bağışıklık (IgG)',
                    data: [],
                    borderColor: '#4facfe',
                    backgroundColor: 'rgba(79, 172, 254, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { labels: { color: '#e2e8f0' } }, tooltip: { mode: 'index', intersect: false } }
        }
    });

    const engine = new SimulationEngine();
    let simInterval = null;

    // Tracking multiple trials
    let trialCount = 0;
    let trialsHistory = [];
    let currentLogs = []; // Stores the logs generated in the CURRENT run
    let lastEventReason = "Bilinmiyor";

    // UI Listeners
    workerSlider.addEventListener('input', (e) => workerVal.innerText = e.target.value);
    ventSlider.addEventListener('input', (e) => ventVal.innerText = e.target.value);
    hygieneSlider.addEventListener('input', (e) => hygieneVal.innerText = e.target.value);
    colostrumSlider.addEventListener('input', (e) => colostrumVal.innerText = e.target.value);

    function logMessage(msg, type="system", pushToMemory=true) {
        // Ekrandaki kutuya ekle
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.innerText = `[Saat: ${engine.time}] ${msg}`;
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;

        // Hafızaya ekle (Eğer yeni bir log ise)
        if (pushToMemory) {
            currentLogs.push({ hour: engine.time, msg: msg, type: type });
        }
    }

    // Geçmiş bir denemenin loglarını ekranda göstermek için
    window.showLogsForTrial = function(trialId) {
        const trial = trialsHistory.find(t => t.id === trialId);
        if (!trial) return;

        logContainer.innerHTML = ''; // Ekranı temizle
        const titleDiv = document.createElement('div');
        titleDiv.className = 'log-entry system';
        titleDiv.style.fontWeight = 'bold';
        titleDiv.innerText = `--- DENEME ${trialId} GEÇMİŞ KAYITLARI ---`;
        logContainer.appendChild(titleDiv);

        trial.logs.forEach(log => {
            const div = document.createElement('div');
            div.className = `log-entry ${log.type}`;
            div.innerText = `[Saat: ${log.hour}] ${log.msg}`;
            logContainer.appendChild(div);
        });

        const endDiv = document.createElement('div');
        endDiv.className = 'log-entry system';
        endDiv.innerText = `--- KAYIT SONU ---`;
        logContainer.appendChild(endDiv);
        logContainer.scrollTop = 0;
    };

    function addSummaryRow(trial) {
        if (!dataTableBody) return;
        const tr = document.createElement('tr');
        
        let barnName = "";
        if(trial.barnType === 'open') barnName = "Açık";
        if(trial.barnType === 'semi') barnName = "Yarı Açık";
        if(trial.barnType === 'climate') barnName = "İklimlendirmeli";

        let breedName = "Bilinmiyor";
        if(trial.breed === 'holstein') breedName = "Holstein";
        if(trial.breed === 'simental') breedName = "Simental";
        if(trial.breed === 'angus') breedName = "Angus";

        let resultColor = trial.result === "SUCCESS" ? "#38ef7d" : "#ff4b2b";
        let resultText = trial.result === "SUCCESS" ? "Başarılı" : (trial.result === "BANKRUPT" ? "İflas" : "Ölüm");

        tr.innerHTML = `
            <td>Deneme ${trial.id}</td>
            <td>${breedName}</td>
            <td>${barnName}</td>
            <td>${trial.workers}</td>
            <td>%${trial.ventilation}</td>
            <td>${trial.colostrum !== false ? trial.colostrum + '. Saat' : 'Verilmedi'}</td>
            <td>${trial.finalHour}</td>
            <td>${trial.finalImmunity}</td>
            <td>%${trial.finalHealth}</td>
            <td>${trial.initialBudget} ₺</td>
            <td>${trial.finalBudget} ₺</td>
            <td style="color:${resultColor}; font-weight:bold;">${resultText}</td>
            <td>
                <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="showLogsForTrial(${trial.id})">Logları İncele</button>
            </td>
        `;
        dataTableBody.appendChild(tr);
        
        const tableWrapper = document.querySelector('.table-wrapper');
        if (tableWrapper) {
            tableWrapper.scrollTop = tableWrapper.scrollHeight;
        }
    }

    engine.subscribe((data) => {
        if (data.event) {
            lastEventReason = data.event;
            if (["DEATH", "BANKRUPT"].includes(data.event)) {
                logMessage(data.msg, "danger");
            } else if (data.event === "SUCCESS") {
                logMessage(data.msg, "success");
            }
            btnStart.innerText = "Yeniden Başlat";
            btnStart.className = "btn-primary";
            btnStart.disabled = false;
            disableActions();
            clearInterval(simInterval);
            return;
        }

        // Update UI
        timeVal.innerText = data.hour;
        healthBar.style.width = `${data.health}%`;
        healthBar.innerText = `${data.health}%`;
        tempVal.innerText = `${data.temp} °C`;
        if (envTempVal) envTempVal.innerText = `${data.envTemp} °C`;
        if (budgetVal) budgetVal.innerText = `${data.budget} ₺`;
        iggVal.innerText = data.immunity;
        nh3Val.innerText = `${data.ammonia} ppm`;

        // Update Chart
        chart.data.labels.push(data.hour);
        chart.data.datasets[0].data.push(data.health);
        chart.data.datasets[1].data.push(data.immunity);
        chart.update();

        // Color coding health bar
        if (data.health > 70) healthBar.style.background = "linear-gradient(to right, #38ef7d, #11998e)";
        else if (data.health > 30) healthBar.style.background = "linear-gradient(to right, #f2c94c, #f2994a)";
        else healthBar.style.background = "linear-gradient(to right, #ff4b2b, #ff416c)";

        // Logs (Eğlenceli / Şakalı Versiyon)
        if (data.hour === 3 && !engine.calf.colostrumFed) logMessage("Kritik Hata: İlk 2 saatte ağız sütü verilmedi! Buzağının bağışıklığı 'Ben iptal' diyor...", "danger");
        if (data.ammonia > 10 && data.ammonia <= 12.5) logMessage("Zehirli Hava: Ahırın içi o kadar pis ki amonyak kokusundan içeri girilemiyor! Maske takın!", "warning");
        
        if (data.colostrumGivenNow) {
            logMessage("Aksiyon: Planlanan saatte kolostrum verildi! IgG seviyesi desteklendi.", "success");
        }
        
        if (data.mistakeMade) {
            const mistakeMsgs = [
                "Uyarı: Nöbetçi bakıcı TikTok izlerken süt vermeyi unuttu! (-4 Sağlık)",
                "Uyarı: Bakıcı vardiyada uyuyakaldı, buzağı kendi kendini beslemeye çalışıyor! (-4 Sağlık)",
                "Uyarı: Bakıcı hijyeni boşverdi, inekler isyanda! (-4 Sağlık)"
            ];
            logMessage(mistakeMsgs[Math.floor(Math.random() * mistakeMsgs.length)], "danger");
        }
        
        if (data.thermalShock) logMessage(`Isı Şoku: Burdur'da sular dondu (${data.envTemp}°C)! Buzağı battaniye istiyor. (-2.5 Sağlık)`, "danger");
        if (parseFloat(data.budget) < 2000 && parseFloat(data.budget) > 1000) logMessage("Uyarı: Bütçe tükenmek üzere! Yakında traktörü satmak zorunda kalabiliriz.", "warning");
    });

    function disableActions() {
        btnSave.disabled = false; 
    }

    btnStart.addEventListener('click', () => {
        if (engine.isRunning) {
            engine.stop();
            clearInterval(simInterval);
            btnStart.innerText = "Simülasyona Devam Et";
            btnStart.className = "btn-success";
            return;
        }

        if (btnStart.innerText === "Yeniden Başlat" || btnStart.innerText === "Simülasyona Devam Et") {
            if (btnStart.innerText === "Yeniden Başlat") {
                chart.data.labels = [];
                chart.data.datasets[0].data = [];
                chart.data.datasets[1].data = [];
                chart.update();
                logContainer.innerHTML = '';
                currentLogs = []; // Yeni log kaydına başla
                lastEventReason = "Durduruldu";
                engine.init(workerSlider.value, ventSlider.value, hygieneSlider.value, budgetInput.value, barnSelect.value, breedSelect.value, colostrumSlider.value);
            }
        } else {
            currentLogs = [];
            lastEventReason = "Durduruldu";
            engine.init(workerSlider.value, ventSlider.value, hygieneSlider.value, budgetInput.value, barnSelect.value, breedSelect.value, colostrumSlider.value);
        }

        engine.start();
        
        btnStart.innerText = "Simülasyonu Durdur";
        btnStart.className = "btn-secondary";
        
        btnSave.disabled = true;

        logMessage("Simülasyon çalışıyor... İlk 6 saat kritik, dikkatli takip edin!", "system");

        function tickWrapper() {
            engine.tick();
            
            // 6. saatten sonra zamanı hızlandır (1 saniye yerine 250ms = 4x Hız)
            if (engine.time === 6 && engine.isRunning) {
                clearInterval(simInterval);
                simInterval = setInterval(tickWrapper, 200); // 5x hızlandı
                logMessage("Kritik ilk bakım evresi atlatıldı. Simülasyon hızı artırıldı (5x)...", "system");
            }
        }

        simInterval = setInterval(tickWrapper, 1000); 
    });

    btnSave.addEventListener('click', () => {
        trialCount++;
        
        let lastData = engine.history.length > 0 ? engine.history[engine.history.length - 1] : null;
        
        let trialObject = {
            id: trialCount,
            barnType: barnSelect.value,
            breed: breedSelect.value,
            workers: workerSlider.value,
            ventilation: ventSlider.value,
            colostrum: engine.calf && engine.calf.colostrumFed ? engine.colostrumTargetTime : false,
            initialBudget: budgetInput.value,
            finalHour: lastData ? lastData.hour : 0,
            finalHealth: lastData ? lastData.health : 0,
            finalImmunity: lastData ? lastData.immunity : 0,
            finalBudget: lastData ? lastData.budget : budgetInput.value,
            result: lastEventReason,
            logs: [...currentLogs] // Logların kopyasını al
        };
        
        trialsHistory.push(trialObject);
        addSummaryRow(trialObject);
        
        logMessage(`Deneme ${trialCount} sonuçları aşağıya kaydedildi. Yeni bir denemeye başlayabilirsiniz.`, "success");
        btnSave.disabled = true; // Aynı sonucu iki kere kaydetmemek için
    });

    btnExportCSV.addEventListener('click', () => {
        if (trialsHistory.length === 0) {
            alert("İndirilecek veri yok! Lütfen önce en az bir simülasyon tamamlayıp kaydedin.");
            return;
        }
        
        let csvContent = "Deneme No,Irk,Ahir Tipi,Bakici Sayisi,Havalandirma (%),Kolostrum,Son Saat,Final Bagisiklik,Final Saglik,Ilk Bilanco (TL),Final Bilanco (TL),Sonuc\n";
        
        trialsHistory.forEach(trial => {
            let row = [
                trial.id,
                trial.breed,
                trial.barnType,
                trial.workers,
                trial.ventilation,
                trial.colostrum !== false ? trial.colostrum + ". Saat" : "Verilmedi",
                trial.finalHour,
                trial.finalImmunity,
                trial.finalHealth,
                trial.initialBudget,
                trial.finalBudget,
                trial.result
            ];
            csvContent += row.join(",") + "\n";
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "calfcare_analiz_raporu.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    btnAutoSimulate.addEventListener('click', () => {
        let confirmAuto = confirm("Bu işlem arka planda 150 farklı rastgele senaryo oynatacak ve tabloya ekleyecektir. Raporlama ve CSV için idealdir. Onaylıyor musunuz?");
        if (!confirmAuto) return;
        
        const barnTypes = ['open', 'semi', 'climate'];
        const breeds = ['holstein', 'simental', 'angus'];
        
        for(let i = 0; i < 150; i++) {
            let rBarn = barnTypes[Math.floor(Math.random() * barnTypes.length)];
            let rBreed = breeds[Math.floor(Math.random() * breeds.length)];
            let rWorker = Math.floor(Math.random() * 8) + 1; // 1-8 işçi
            let rVent = Math.floor(Math.random() * 101); // 0-100
            let rHygiene = Math.floor(Math.random() * 61) + 40; // 40-100
            let rBudget = Math.floor(Math.random() * 20000) + 5000;
            let rColostrumTime = Math.floor(Math.random() * 12); // 0-11
            
            let tempEngine = new SimulationEngine();
            // Log basmasını (UI güncellemelerini) engelle
            tempEngine.notify = function() {}; 
            
            // skipFetch=true ile API isteğini engelle
            tempEngine.init(rWorker, rVent, rHygiene, rBudget, rBarn, rBreed, rColostrumTime, true);
            tempEngine.start();
            
            while(tempEngine.isRunning) {
                tempEngine.tick();
            }
            
            trialCount++;
            let lastData = tempEngine.history.length > 0 ? tempEngine.history[tempEngine.history.length - 1] : null;
            
            let resMsg = "Bilinmiyor";
            if (tempEngine.time >= 72) resMsg = "SUCCESS";
            else if (tempEngine.calf && tempEngine.calf.healthScore <= 0) resMsg = "DEATH";
            else if (tempEngine.budget <= 0) resMsg = "BANKRUPT";

            let trialObject = {
                id: trialCount,
                barnType: rBarn,
                breed: rBreed,
                workers: rWorker,
                ventilation: rVent,
                colostrum: tempEngine.calf && tempEngine.calf.colostrumFed ? tempEngine.colostrumTargetTime : false,
                initialBudget: rBudget,
                finalHour: lastData ? lastData.hour : 0,
                finalHealth: lastData ? lastData.health : 0,
                finalImmunity: lastData ? lastData.immunity : 0,
                finalBudget: lastData ? lastData.budget : rBudget,
                result: resMsg,
                logs: [] 
            };
            
            trialsHistory.push(trialObject);
            addSummaryRow(trialObject);
        }
        
        logMessage("150 rastgele senaryo başarıyla simüle edildi ve tabloya eklendi. Tüm tabloyu CSV olarak indirebilirsiniz.", "success");
    });
});
