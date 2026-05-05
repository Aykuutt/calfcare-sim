// simulation.js
class CalfAgent {
    constructor(initialHygiene) {
        this.immunityScore = parseInt(initialHygiene); // IgG (0-100)
        this.bodyTemp = 39.0; // Normal is 38.5-39.5
        this.hunger = 0; // 0-100
        this.healthScore = 100; // 0-100
        this.colostrumFed = false;
    }

    update(time, envAgent, workerAgent) {
        this.hunger += 2;
        let isTakingDamage = false;
        
        if (!this.colostrumFed && time > 2) {
            this.immunityScore -= 5; 
            if (this.immunityScore < 0) this.immunityScore = 0;
        }

        if (envAgent.ammonia > 10) {
            let damage = (envAgent.ammonia - 10) * 0.5;
            // Nem %80 üzerindeyse Pnömoni riski (Zatürre) sebebiyle hasar ikiye katlanır
            if (envAgent.humidity > 80) {
                damage *= 2;
            }
            this.healthScore -= damage;
            isTakingDamage = true;
        }

        if (this.immunityScore < 50) {
            this.healthScore -= 1;
            isTakingDamage = true;
        }

        if (this.hunger > 50) {
            this.healthScore -= 2;
            isTakingDamage = true;
        }
        
        // Termal Şok Etkisi
        if (envAgent.thermalShock) {
            this.healthScore -= 2.5; // Solunum riski eksi yazıyor
            isTakingDamage = true;
        }

        // Doğal İyileşme (Seçenek A)
        // Eğer o an hasar almıyorsa ve bağışıklığı yüksekse sağlığını toparlar
        if (!isTakingDamage && this.immunityScore >= 80) {
            this.healthScore += 1;
        }

        if (this.healthScore < 0) this.healthScore = 0;
        if (this.healthScore > 100) this.healthScore = 100;
        
        return {
            temp: this.bodyTemp,
            immunity: this.immunityScore,
            health: this.healthScore,
            hunger: this.hunger
        };
    }
}

class WorkerAgent {
    constructor(id) {
        this.id = id;
        this.fatigue = 0; 
        this.isWorking = false; // O an vardiyada mı?
    }

    update(time, totalWorkers) {
        // Vardiya mantığı: Çalışıyorsa yorulur, dinleniyorsa toparlar
        if (this.isWorking) {
            this.fatigue += 5; // Nöbetteki adam saatte 5 yorulur
        } else {
            this.fatigue -= 8; // Dinlenen adam hızla toparlar
        }

        if (this.fatigue > 100) this.fatigue = 100;
        if (this.fatigue < 0) this.fatigue = 0;

        // Sadece çalışan kişi hata yapabilir
        if (this.isWorking) {
            return this.fatigue * 0.4; 
        }
        return 0;
    }
    
    cleanBarn(envAgent) {
        if(this.fatigue < 80) {
            envAgent.ammonia = Math.max(0, envAgent.ammonia - 15);
            this.fatigue += 20; // Ağır fiziksel iş, anlık yorgunluk verir
            return true;
        }
        return false;
    }
}

class EnvironmentAgent {
    constructor(ventilationPower, barnType, breed) {
        this.ventilationPower = parseInt(ventilationPower); 
        this.barnType = barnType; // 'open', 'semi', 'climate'
        this.breed = breed; // 'holstein', 'simental', 'angus'
        this.ammonia = 5; 
        this.envTemp = 15; 
        this.baseTemp = 15; // API çökmesi durumunda varsayılan sıcaklık
        this.humidity = 50; // API çökmesi durumunda varsayılan nem
        this.thermalShock = false;
        
        // Burdur, Türkiye için gerçek zamanlı hava durumu çekme (API)
        this.fetchRealWeather();
    }

    async fetchRealWeather() {
        try {
            // Open-Meteo API (Burdur) Sıcaklık ve Nem
            const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.7183&longitude=30.2823&current=temperature_2m,relative_humidity_2m');
            const data = await response.json();
            if (data && data.current) {
                this.baseTemp = data.current.temperature_2m;
                this.envTemp = this.baseTemp;
                this.humidity = data.current.relative_humidity_2m;
                console.log(`Gerçek veri API'den başarıyla çekildi. Burdur Sıcaklığı: ${this.baseTemp}°C, Nem: %${this.humidity}`);
            }
        } catch (error) {
            console.log("Hava durumu API'sine ulaşılamadı, sistem varsayılan değerlere döndü.", error);
        }
    }

    update(time) {
        this.ammonia += 2.5;
        let clearRate = this.ventilationPower * 0.04;
        this.ammonia -= clearRate;
        if (this.ammonia < 0) this.ammonia = 0;
        
        // Gündüz / Gece Döngüsü
        let hourOfDay = time % 24;
        let tempAmplitude = 8; // Dalgalanma şiddeti
        
        // İklimlendirmeli ahırsa sıcaklık sabittir ve termal şok olmaz
        if (this.barnType === 'climate') {
            this.envTemp = 22; // Sabit ideal sıcaklık
            this.thermalShock = false;
        } else {
            // Açık ve yarı açıkta API'den gelen gerçek sıcaklık üzerinden dalgalanma
            let fluctuation = Math.sin((hourOfDay - 6) * Math.PI / 12) * tempAmplitude;
            this.envTemp = this.baseTemp + fluctuation;
            
            // Yarı açık ahırda rüzgar kesildiği için ısı farkı biraz daha az hissedilir
            if(this.barnType === 'semi') {
                this.envTemp = this.baseTemp + (fluctuation * 0.6);
            }

            // Genetik Faktörler (Irk Toleransı)
            let threshold = 10;
            if (this.breed === 'holstein') threshold = 12;
            else if (this.breed === 'simental') threshold = 8;
            else if (this.breed === 'angus') threshold = 5;

            // Termal Şok: Çevre sıcaklığı ırkın sınırının altına düşerse stres
            this.thermalShock = this.envTemp < threshold;
        }
        
        return {
            ammonia: this.ammonia,
            envTemp: this.envTemp,
            thermalShock: this.thermalShock
        };
    }
}

class SimulationEngine {
    constructor() {
        this.time = 0;
        this.isRunning = false;
        this.history = []; 
        this.listeners = [];
        
        this.calf = null;
        this.workers = []; // Artık çoklu ajan (Multi-Agent) dizisi
        this.env = null;
        
        this.budget = 0;
        this.barnType = '';
        this.cleanCount = 0;
        this.vetCount = 0;
    }

    init(workerCount, ventilation, hygiene, budget, barnType, breed) {
        this.time = 0;
        this.history = [];
        this.budget = parseInt(budget);
        this.barnType = barnType;
        this.cleanCount = 0;
        this.vetCount = 0;
        
        this.calf = new CalfAgent(hygiene);
        
        // Multi-Agent: Seçilen bakıcı sayısı kadar otonom ajan oluşturulur
        this.workers = [];
        for(let i=0; i<parseInt(workerCount); i++) {
            this.workers.push(new WorkerAgent(i+1));
        }

        this.env = new EnvironmentAgent(ventilation, barnType, breed);
    }

    tick() {
        if (!this.isRunning) return;
        
        this.time += 1;
        
        let envStats = this.env.update(this.time);
        
        // VARDİYA (Multi-Agent) YÖNETİMİ
        // En az 1 kişi nöbetçi olmalı. Her saat başı en dinç olan kişi nöbete atanır.
        this.workers.forEach(w => w.isWorking = false); // Önce herkesi dinlenmeye al
        // Yorgunluğa göre küçükten büyüğe sırala
        let sortedWorkers = [...this.workers].sort((a,b) => a.fatigue - b.fatigue);
        if (sortedWorkers.length > 0) {
            sortedWorkers[0].isWorking = true; // En dinç olan nöbete başlar
        }

        // Ajanların kendi iç güncellemeleri ve hata riskleri
        let mistakeProb = 0;
        this.workers.forEach(w => {
            let prob = w.update(this.time, this.workers.length);
            if (prob > mistakeProb) mistakeProb = prob; // Nöbetçinin hata riski alınır
        });
        
        // Bakıcının otomatik rutin beslemesi (Her 6 saatte bir)
        if (this.time % 6 === 0) {
            this.calf.hunger = 0; // Buzağıyı besledi
        }
        
        let calfStats = this.calf.update(this.time, this.env, null); // workerAgent parametresi artık kullanılmıyor
        
        let mistakeMade = false;
        // Bakıcı hata yaparsa sağlığa eksi yazar
        if (Math.random() * 100 < mistakeProb) {
            mistakeMade = true;
            this.calf.healthScore -= 4; 
        }

        // Bilanço Hesaplama
        // İşçi maaş maliyeti (saatlik)
        this.budget -= (this.workers.length * 10);
        
        // Ahır tipi maliyeti
        if (this.barnType === 'climate') this.budget -= 50; // Elektrik/iklimlendirme
        else if (this.barnType === 'semi') this.budget -= 20;
        else this.budget -= 5;
        
        // İlaç/Veteriner Masrafı
        if (calfStats.health < 70) {
            this.budget -= 100; // Tedavi masrafı
        } else if (calfStats.health > 80) {
            this.budget += 150; // Sağlıklı gelişim değer artışı
        }

        let currentData = {
            hour: this.time,
            health: calfStats.health.toFixed(1),
            immunity: calfStats.immunity.toFixed(1),
            temp: calfStats.temp.toFixed(1),
            envTemp: envStats.envTemp.toFixed(1),
            ammonia: envStats.ammonia.toFixed(1),
            // Ortalama yorgunluğu arayüze yansıt
            workerFatigue: (this.workers.reduce((sum, w) => sum + w.fatigue, 0) / this.workers.length).toFixed(1),
            mistakeMade: mistakeMade,
            thermalShock: envStats.thermalShock,
            budget: this.budget.toFixed(2)
        };
        
        this.history.push(currentData);
        this.notify(currentData);
        
        if (this.budget <= 0) {
            this.stop();
            this.notify({ event: "BANKRUPT", msg: "İFLAS: Bütçe sıfırlandı! Banka ahıra haciz getirdi, traktörü satıyoruz..." });
        } else if (this.calf.healthScore <= 0) {
            this.stop();
            this.notify({ event: "DEATH", msg: "KRİTİK: Buzağı hayatını kaybetti. Fakülteyi baştan okumanız gerekebilir." });
        } else if (this.time >= 240) {
            this.stop();
            this.notify({ event: "SUCCESS", msg: "TEBRİKLER! 10 gün dayandınız. Yılın Ziraat Ödülü size gidiyor!" });
        }
    }

    start() {
        this.isRunning = true;
    }

    stop() {
        this.isRunning = false;
    }

    feedColostrum() {
        if (this.calf && !this.calf.colostrumFed) {
            this.calf.colostrumFed = true;
            this.calf.hunger = 0;
            this.calf.immunityScore += 20; 
            if(this.calf.immunityScore > 100) this.calf.immunityScore = 100;
            return true;
        }
        return false;
    }

    cleanBarn() {
        if (this.workers.length > 0 && this.env) {
            this.budget -= 50; // Temizlik malzemesi masrafı
            
            // Otonom Karar: Temizlik işi her zaman en az yorgun olan ajana atanır
            let bestWorker = [...this.workers].sort((a,b) => a.fatigue - b.fatigue)[0];
            
            let cleaned = bestWorker.cleanBarn(this.env);
            if (cleaned) this.cleanCount++;
            return cleaned;
        }
        return false;
    }

    callVet() {
        if (this.calf && this.calf.healthScore > 0 && this.budget >= 500) {
            this.budget -= 500;
            this.calf.healthScore += 40;
            if (this.calf.healthScore > 100) this.calf.healthScore = 100;
            this.vetCount++;
            return true;
        }
        return false;
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify(data) {
        this.listeners.forEach(cb => cb(data));
    }
    
    getCSV() {
        if (this.history.length === 0) return "";
        let header = Object.keys(this.history[0]).join(",") + "\n";
        let rows = this.history.map(row => Object.values(row).join(",")).join("\n");
        return header + rows;
    }
}
