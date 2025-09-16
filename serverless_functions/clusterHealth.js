const fetch = require('node-fetch');

/**
 * ClusterEye Sağlık Durumu Kontrolü
 * 
 * Bu fonksiyon ClusterEye API'sini kullanarak cluster'ların sağlık durumunu kontrol eder.
 * Doğrudan Digital Ocean Functions olarak kullanılabilir.
 * 
 * @param {Object} args - Input parameters
 * @param {string} args.apiUrl - ClusterEye API URL
 * @param {string} args.apiToken - ClusterEye API Token
 * @param {string} args.dbType - Belirli bir veritabanı tipi ("mongodb", "postgresql", "mssql", null=tümü)
 * @param {string} args.clusterName - Belirli bir cluster ismi (opsiyonel)
 * @param {string} args.healthType - Kontrol edilecek sağlık tipi: "all", "nodes", "agents", "alarms" (default: "all")
 * @returns {Object} Sağlık durumu verileri
 */
async function main(args) {
  try {
    // Parametreleri al
    const apiUrl = args.apiUrl || "https://clabapi.clustereye.com/api/v1";
    const apiToken = args.apiToken || process.env.CLUSTEREYE_API_TOKEN;
    const dbType = args.dbType || null; // mongodb, postgresql, mssql
    const clusterName = args.clusterName || null;
    const healthType = args.healthType || "all";
    
    // Sonuç objesi
    const result = {
      statusCode: 200,
      body: {
        clusterHealth: {},
        message: "Sağlık bilgileri başarıyla alındı."
      }
    };
    
    // Temel API isteği özellikleri
    const requestOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`
      }
    };
    
    // Agent durumlarını kontrol etme
    if (healthType === "all" || healthType === "agents") {
      const agentUrl = `${apiUrl}/status/agents`;
      const agentResponse = await fetch(agentUrl, requestOptions);
      
      if (!agentResponse.ok) {
        throw new Error(`Agent bilgileri alınamadı: ${agentResponse.status}`);
      }
      
      const agentData = await agentResponse.json();
      
      // API'den gelen agent listesini kontrol et
      if (agentData?.data?.agents) {
        result.body.clusterHealth.agents = agentData.data.agents;
        
        // Agent durumlarını say
        const agentStatus = {
          total: agentData.data.agents.length,
          connected: 0,
          disconnected: 0,
          warning: 0
        };
        
        agentData.data.agents.forEach(agent => {
          if (agent.status === "connected") agentStatus.connected++;
          else if (agent.status === "disconnected") agentStatus.disconnected++;
          else if (agent.status === "warning") agentStatus.warning++;
        });
        
        result.body.clusterHealth.agentStatus = agentStatus;
      } else {
        result.body.clusterHealth.agents = [];
        result.body.clusterHealth.agentStatus = { total: 0, connected: 0, disconnected: 0, warning: 0 };
      }
    }
    
    // Veritabanı node sağlık durumlarını kontrol etme
    if (healthType === "all" || healthType === "nodes") {
      const nodeHealthUrl = `${apiUrl}/status/nodeshealth`;
      const nodeHealthResponse = await fetch(nodeHealthUrl, requestOptions);
      
      if (!nodeHealthResponse.ok) {
        throw new Error(`Node sağlık bilgileri alınamadı: ${nodeHealthResponse.status}`);
      }
      
      const nodeHealthData = await nodeHealthResponse.json();
      
      // Tüm veritabanı türleri için özet oluştur
      const dbTypes = ["mongodb", "postgresql", "mssql"];
      let filteredDbTypes = dbTypes;
      
      // Eğer belirli bir db tipi isteniyorsa sadece onu ele al
      if (dbType && dbTypes.includes(dbType)) {
        filteredDbTypes = [dbType];
      }
      
      // Her veritabanı tipi için toplam ve işletim durumları
      const nodeStatus = {
        total: 0,
        running: 0,
        degraded: 0,
        stopped: 0,
        unknown: 0
      };
      
      // Her veritabanı tipi için replikasyon durumları
      const replicationStatus = {
        total: 0,
        clusters: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 0
      };
      
      // Analiz edilecek veritabanı node'ları
      result.body.clusterHealth.databaseNodes = {};
      
      // Her veritabanı tipi için node sağlık durumlarını analiz et
      filteredDbTypes.forEach(type => {
        if (nodeHealthData[type]) {
          const clusters = nodeHealthData[type];
          
          // Her bir cluster'ı işle
          clusters.forEach(clusterObj => {
            // Her cluster tek bir key-value içeriyor
            const clusterNames = Object.keys(clusterObj);
            
            clusterNames.forEach(cName => {
              // Eğer belirli bir cluster isteniyorsa ve bu değilse atla
              if (clusterName && clusterName !== cName) {
                return;
              }
              
              const nodes = clusterObj[cName];
              replicationStatus.clusters++;
              
              // Her cluster için sağlık durumu
              let clusterHealth = "healthy";
              
              // Node'ları işle
              nodes.forEach(node => {
                nodeStatus.total++;
                replicationStatus.total++;
                
                // PostgreSQL node durumu kontrolü
                if (type === "postgresql") {
                  if (node.PGServiceStatus === "RUNNING") {
                    nodeStatus.running++;
                  } else if (node.PGServiceStatus === "DEGRADED") {
                    nodeStatus.degraded++;
                    clusterHealth = "degraded";
                  } else if (node.PGServiceStatus === "STOPPED") {
                    nodeStatus.stopped++;
                    clusterHealth = "unhealthy";
                  } else {
                    nodeStatus.unknown++;
                  }
                  
                  // Replikasyon gecikmesi kontrolü
                  if (node.ReplicationLagSec > 300) { // 5 dakikadan fazla gecikme
                    clusterHealth = "degraded";
                  }
                } 
                // MongoDB node durumu kontrolü
                else if (type === "mongodb") {
                  if (node.MongoStatus === "RUNNING") {
                    nodeStatus.running++;
                  } else if (node.MongoStatus === "DEGRADED") {
                    nodeStatus.degraded++;
                    clusterHealth = "degraded";
                  } else if (node.MongoStatus === "STOPPED") {
                    nodeStatus.stopped++;
                    clusterHealth = "unhealthy";
                  } else {
                    nodeStatus.unknown++;
                  }
                  
                  // Replikasyon gecikmesi kontrolü
                  if (node.ReplicationLagSec > 300) {
                    clusterHealth = "degraded";
                  }
                } 
                // MSSQL node durumu kontrolü
                else if (type === "mssql") {
                  if (node.Status === "RUNNING") {
                    nodeStatus.running++;
                  } else if (node.Status === "DEGRADED") {
                    nodeStatus.degraded++;
                    clusterHealth = "degraded";
                  } else if (node.Status === "STOPPED" || node.Status === "STOPPED") {
                    nodeStatus.stopped++;
                    clusterHealth = "unhealthy";
                  } else {
                    nodeStatus.unknown++;
                  }
                }
              });
              
              // Cluster sağlık durumunu kaydet
              if (clusterHealth === "healthy") {
                replicationStatus.healthy++;
              } else if (clusterHealth === "degraded") {
                replicationStatus.degraded++;
              } else {
                replicationStatus.unhealthy++;
              }
              
              // Eğer belirli bir cluster isteniyorsa detayları kaydet
              if (clusterName === cName) {
                result.body.clusterHealth.selectedCluster = {
                  name: cName,
                  type: type,
                  health: clusterHealth,
                  nodes: nodes
                };
              }
            });
          });
          
          // DB tipine göre verileri kaydet
          result.body.clusterHealth.databaseNodes[type] = {
            clusters: clusters.map(c => Object.keys(c)[0]), // Sadece cluster isimlerini al
            count: nodeStatus.total
          };
        }
      });
      
      // Node durumlarını kaydet
      result.body.clusterHealth.nodeStatus = nodeStatus;
      result.body.clusterHealth.replicationStatus = replicationStatus;
    }
    
    // Alarm durumlarını kontrol etme
    if (healthType === "all" || healthType === "alarms") {
      const alarmUrl = `${apiUrl}/status/alarms`;
      const alarmResponse = await fetch(alarmUrl, requestOptions);
      
      if (!alarmResponse.ok) {
        throw new Error(`Alarm bilgileri alınamadı: ${alarmResponse.status}`);
      }
      
      const alarmData = await alarmResponse.json();
      const alarms = alarmData.data?.alarms || [];
      
      // Alarmları özetleme
      const alarmStatus = {
        total: alarms.length,
        critical: 0,
        warning: 0,
        info: 0
      };
      
      alarms.forEach(alarm => {
        if (alarm.severity === "critical") alarmStatus.critical++;
        else if (alarm.severity === "warning") alarmStatus.warning++;
        else if (alarm.severity === "info") alarmStatus.info++;
      });
      
      result.body.clusterHealth.alarms = alarms.slice(0, 5);  // Son 5 alarmı göster
      result.body.clusterHealth.alarmStatus = alarmStatus;
    }
    
    // Herhangi bir veri dönmediyse
    if (Object.keys(result.body.clusterHealth).length === 0) {
      result.body.message = "İstenilen sağlık bilgileri bulunamadı.";
    }
    
    // Özet durumu
    result.body.summary = createSummary(result.body.clusterHealth);
    
    return result;
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        error: error.message,
        message: "Sağlık durumu bilgileri alınırken bir hata oluştu."
      }
    };
  }
}

/**
 * Sağlık durumu özeti oluşturma
 */
function createSummary(healthData) {
  const summary = {
    status: "healthy", // Varsayılan olarak sağlıklı
    message: "Tüm sistemler normal çalışıyor."
  };
  
  // Kritik alarm varsa
  if (healthData.alarmStatus && healthData.alarmStatus.critical > 0) {
    summary.status = "critical";
    summary.message = `${healthData.alarmStatus.critical} kritik alarm mevcut!`;
  }
  // Kritik alarm yoksa ama uyarı alarmı varsa
  else if (healthData.alarmStatus && healthData.alarmStatus.warning > 0) {
    summary.status = "warning";
    summary.message = `${healthData.alarmStatus.warning} uyarı alarmı mevcut.`;
  }
  
  // Offline agent varsa
  if (healthData.agentStatus && healthData.agentStatus.disconnected > 0) {
    summary.status = "critical";
    summary.message = `${healthData.agentStatus.disconnected} agent bağlantısı kayıp!`;
  }
  // Warning durumunda agent varsa
  else if (healthData.agentStatus && healthData.agentStatus.warning > 0 && summary.status !== "critical") {
    summary.status = "warning";
    summary.message = `${healthData.agentStatus.warning} agent uyarı durumunda.`;
  }
  
  // Node durumları kritik durumdaysa
  if (healthData.nodeStatus && healthData.nodeStatus.stopped > 0) {
    summary.status = "critical";
    summary.message = `${healthData.nodeStatus.stopped} veritabanı servisi çalışmıyor!`;
  }
  // Node durumları uyarı durumundaysa
  else if (healthData.nodeStatus && healthData.nodeStatus.degraded > 0 && summary.status !== "critical") {
    summary.status = "warning";
    summary.message = `${healthData.nodeStatus.degraded} veritabanı servisi sorunlu durumda.`;
  }
  
  // Replikasyon durumları kritik durumdaysa
  if (healthData.replicationStatus && healthData.replicationStatus.unhealthy > 0 && summary.status !== "critical") {
    summary.status = "critical";
    summary.message = `${healthData.replicationStatus.unhealthy} veritabanı kümesi sağlıksız durumda!`;
  }
  // Replikasyon durumları uyarı durumundaysa
  else if (healthData.replicationStatus && healthData.replicationStatus.degraded > 0 && summary.status !== "critical") {
    summary.status = "warning";
    summary.message = `${healthData.replicationStatus.degraded} veritabanı kümesinde replikasyon sorunları var.`;
  }
  
  return summary;
}

exports.main = main; 