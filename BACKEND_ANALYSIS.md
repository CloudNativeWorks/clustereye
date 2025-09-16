# ClusterEye Agent Backend Projesi Analizi

## 🎯 Proje Genel Bakışı

ClusterEye Agent, çeşitli veritabanı sistemlerini (PostgreSQL, MongoDB, MSSQL) izlemek ve performans metriklerini toplamak için tasarlanmış bir Go tabanlı monitoring agent'ıdır. Agent, gRPC protokolü üzerinden merkezi sunucuya veri gönderir ve uzaktan komutları çalıştırabilir.

## 📁 Proje Yapısı

```
clustereye-agent/
├── main.go                    # Ana giriş noktası
├── go.mod                     # Go modül tanımlaması
├── internal/                  # İç paketler
│   ├── agent/                 # Agent temel fonksiyonları
│   ├── alarm/                 # Alarm sistemi
│   ├── collector/             # Veri toplama modülleri
│   │   ├── collector.go       # Ana collector interface
│   │   ├── mongo/             # MongoDB collector
│   │   ├── mssql/             # MSSQL collector
│   │   └── postgres/          # PostgreSQL collector
│   ├── config/                # Konfigürasyon yönetimi
│   ├── logger/                # Loglama sistemi
│   ├── model/                 # Veri modelleri
│   └── reporter/              # Veri raporlama
├── pkg/                       # Dış paketler
│   └── utils/                 # Yardımcı fonksiyonlar
├── cmd/                       # Komut satırı araçları
└── docs/                      # Dokümantasyon
```

## 🛠 Teknik Mimarisi

### Core Teknolojiler
- **Dil**: Go 1.24.1
- **İletişim**: gRPC (Protocol Buffers)
- **Veritabanı Sürücüleri**:
  - PostgreSQL: `github.com/lib/pq`
  - MSSQL: `github.com/microsoft/go-mssqldb`
  - MongoDB: `go.mongodb.org/mongo-driver`
- **Servis Yönetimi**: `github.com/kardianos/service`
- **Konfigürasyon**: YAML (`gopkg.in/yaml.v2`)

### Bağımlılıklar
```go
require (
    github.com/StackExchange/wmi v1.2.1           // Windows WMI
    github.com/google/uuid v1.6.0                 // UUID üretimi
    github.com/kardianos/service v1.2.2           // Servis yönetimi
    github.com/lib/pq v1.10.9                     // PostgreSQL
    github.com/microsoft/go-mssqldb v1.8.0        // MSSQL
    github.com/sefaphlvn/clustereye-test v1.0.170 // gRPC proto
    go.mongodb.org/mongo-driver v1.17.3           // MongoDB
    google.golang.org/grpc v1.72.0                // gRPC framework
    google.golang.org/protobuf v1.36.6            // Protobuf
    gopkg.in/yaml.v2 v2.4.0                      // YAML parser
)
```

## 🔧 Ana Bileşenler

### 1. Main Application (`main.go`)
- **Başlatma Sırası**:
  1. Log sistemi kurulumu
  2. Konfigürasyon yükleme
  3. Veritabanı platform tespiti (PostgreSQL → MongoDB → MSSQL)
  4. gRPC bağlantısı kurulumu
  5. Agent bilgilerinin gönderilmesi
  6. Komut alma döngüsü başlatma

- **Özel Komut İşleme**:
  - `PATRONI_CMD`: PostgreSQL Patroni komutları
  - `PATRONI_STATUS`: Patroni cluster durumu
  - `PATRONI_COMMANDS`: Mevcut komutlar listesi
  - `analyze_mongo_log`: MongoDB log analizi

### 2. Configuration Management (`internal/config/config.go`)

```yaml
# agent.yml örnek yapılandırma
key: "agent_key"
name: "Agent"

postgresql:
  host: "localhost"
  port: "5432"
  user: "postgres"
  pass: "password"
  cluster: "postgres"
  location: ""
  replication_user: ""
  replication_password: ""

mongo:
  host: "localhost"
  port: "27017"
  user: ""
  pass: ""
  replset: "rs0"
  location: ""

mssql:
  host: "localhost"
  port: "1433"
  user: ""
  pass: ""
  instance: ""
  database: "master"
  location: ""
  trust_cert: true
  windows_auth: false

grpc:
  server_address: "localhost:50051"
```

**Konfigürasyon Dosyası Konumları**:
- **Windows**: Executable dizini veya `C:\Clustereye\`
- **Linux/macOS**: Mevcut dizin, `/etc/clustereye/`, `$HOME/.clustereye/`

### 3. Collector System

#### MongoDB Collector (`internal/collector/mongo/`)
- **Özellikler**:
  - Replica Set durumu
  - Performance metrikleri
  - Log analizi
  - Oplog durumu
  - Connection pooling

#### PostgreSQL Collector (`internal/collector/postgres/`)
- **Özellikler**:
  - Patroni entegrasyonu
  - High Availability kontrolleri
  - Replication lag izleme
  - Query performance
  - Connection monitoring

#### MSSQL Collector (`internal/collector/mssql/`)
- **Özellikler**:
  - Always On Availability Groups
  - Performance counters
  - Wait statistics
  - Blocking sessions
  - Windows/SQL Authentication

### 4. Reporter System (`internal/reporter/`)
- **İşlevler**:
  - Metriklerin gRPC üzerinden gönderilmesi
  - Query execution
  - Log processing
  - Real-time data streaming
  - Connection management with retry logic

## 🔄 Veri Akışı

```
[Database] → [Collector] → [Reporter] → [gRPC Client] → [Cloud Server]
                                     ←                 ←
```

1. **Collection Phase**: Her collector kendi veritabanından metrik toplar
2. **Processing Phase**: Veriler standardize edilir ve hazırlanır
3. **Transmission Phase**: gRPC stream üzerinden cloud server'a gönderilir
4. **Command Phase**: Server'dan gelen komutlar işlenir

## 🔍 İzlenen Metrikler

### PostgreSQL
- Connection counts
- Replication lag
- Database size
- Query performance
- Lock information
- Patroni cluster status

### MongoDB
- Replica set status
- Oplog information
- Collection statistics
- Index usage
- Connection pools
- Slow query logs

### MSSQL
- Always On AG status
- Wait statistics
- Blocking sessions
- Performance counters
- Database file usage
- Memory usage

### System Metrics
- CPU usage
- Memory utilization
- Disk I/O
- Network statistics

## 🛡 Güvenlik Özellikleri

- **Authentication**: Her platform için farklı auth yöntemleri
- **SSL/TLS**: Güvenli veritabanı bağlantıları
- **gRPC Security**: İsteğe bağlı TLS encryption
- **Windows Integration**: Windows Authentication desteği
- **Connection Pooling**: Güvenli bağlantı yönetimi

## 📊 Platform Tespiti

Agent başlangıçta şu sırayla platform tespiti yapar:

1. **PostgreSQL Test**: Bağlantı + `SELECT version()` sorgusu
2. **MongoDB Test**: TCP bağlantısı kontrolü
3. **MSSQL Test**: Bağlantı + `SELECT @@VERSION` sorgusu

İlk başarılı olan platform seçilir ve kullanılır.

## 🔄 Service Integration

- **Windows**: Windows Service olarak çalıştırılabilir
- **Linux**: systemd service desteği
- **Cross-platform**: Manuel çalıştırma desteği

## 📝 Logging System

**Log Konumları**:
- **Windows**: `C:\Clustereye\clustereye-agent.log`
- **Linux**: `/var/log/clustereye-agent.log` veya `$HOME/.clustereye/agent.log`

**Log Seviyeleri**:
- Başlatma/kapatma bilgileri
- Bağlantı durumları
- Error handling
- Debug information

## 🎛 Patroni Integration (PostgreSQL)

Agent, PostgreSQL high-availability için Patroni entegrasyonu sağlar:

- **Cluster Management**: Cluster durumu izleme
- **Failover Operations**: Manuel failover komutları
- **Node Control**: Primary/replica yönetimi
- **Health Checks**: Sürekli cluster health kontrolü

## 📈 Performance Considerations

- **Connection Pooling**: Veritabanı bağlantılarının verimli yönetimi
- **Goroutine Management**: Concurrent operations
- **Memory Optimization**: Büyük veri setleri için streaming
- **Retry Logic**: Network kesintilerinde otomatik yeniden deneme
- **Circuit Breaker**: Unhealthy connections için koruma

## 🚀 Deployment

### Build Komutu
```bash
go build -o clustereye-agent main.go
```

### Cross-Platform Build
```bash
# Windows
GOOS=windows GOARCH=amd64 go build -o clustereye-agent.exe main.go

# Linux
GOOS=linux GOARCH=amd64 go build -o clustereye-agent-linux main.go
```

## 🔧 Konfigürasyon Önerileri

### Production Environment
- Dedicated monitoring user accounts
- Connection limits
- Log rotation
- Health check intervals
- Backup configurations

### Security Hardening
- SSL/TLS enforcement
- Certificate validation
- Network firewalling
- Minimal permissions

## 🐛 Troubleshooting

### Yaygın Problemler
1. **Connection Issues**: Database connectivity
2. **Permission Errors**: Insufficient database permissions
3. **Network Problems**: gRPC connection failures
4. **Resource Issues**: Memory/CPU constraints

### Debug Modları
- Verbose logging
- Connection tracing
- Performance profiling
- Health monitoring

## 📋 Öneriler ve İyileştirmeler

### Mevcut Güçlü Yönler
- ✅ Multi-platform database support
- ✅ Robust error handling
- ✅ Extensible architecture
- ✅ Real-time monitoring
- ✅ High availability integration

### Potansiyel İyileştirmeler
- 🔄 Configuration hot-reload
- 📊 Built-in metrics dashboard
- 🔐 Enhanced security features
- 📦 Container deployment support
- 🎯 Custom alert thresholds

---

**Son Güncelleme**: 2025-01-15  
**Agent Version**: 1.0.23  
**Go Version**: 1.24.1