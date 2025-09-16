import { NodeType } from "./type";

export const STATUS_COLORS = {
    GREEN: "#4CAF50",
    YELLOW: "#FFC107", 
    RED: "#F44336",
    HOVER: "#FFD700",
};

export const getStatusColor = (node: NodeType): string => {
    // For debugging
    console.log("Evaluating status for node:", node.nodename || node.Hostname, node);

    // Check if node has MongoDB or PostgreSQL service status
    const mongoStatus = node.MongoStatus ? node.MongoStatus.toUpperCase() : "";
    const pgStatus = node.PGServiceStatus ? node.PGServiceStatus.toUpperCase() : "";
    
    // If any service status exists and is not RUNNING, show as critical
    if ((mongoStatus && mongoStatus !== "RUNNING") || 
        (pgStatus && pgStatus !== "RUNNING")) {
        return STATUS_COLORS.RED;
    }
    
    // Check node operational status
    const isHealthyStatus =
        node.status === "PRIMARY" ||
        node.status === "MASTER" ||
        node.status === "SECONDARY" ||
        node.status === "SLAVE" ||
        node.NodeStatus === "PRIMARY" ||
        node.NodeStatus === "MASTER" ||
        node.NodeStatus === "SECONDARY" ||
        node.NodeStatus === "SLAVE";
    
    // Check operational status
    if (!isHealthyStatus) {
        console.log(`Node ${node.nodename || node.Hostname} has unhealthy operational status`);
        return STATUS_COLORS.RED; // Kritik Durum
    }

    // Check disk space
    const freeDisk = node.freediskpercent || node.FDPercent || 100;
    const freeDiskData = parseDiskSize(node.freediskdata || node.FreeDisk);

    if (freeDisk < 25 && freeDiskData < 100) {
        console.log(`Node ${node.nodename || node.Hostname} has low disk space: ${freeDisk}% free, ${freeDiskData}GB`);
        return STATUS_COLORS.YELLOW; // Uyarı Durumu
    }

    return STATUS_COLORS.GREEN; // Sağlıklı Durum
};

const parseDiskSize = (diskData: string | undefined): number => {
    if (!diskData) return 0; // Eğer veri yoksa 0 döndür
    const tbMatch = diskData.match(/([\d.]+)\s*TB/i); // TB'yi eşleştir
    const gbMatch = diskData.match(/([\d.]+)\s*GB/i); // GB'yi eşleştir

    if (tbMatch) {
        return parseFloat(tbMatch[1]) * 1024; // TB'yi GB'ye çevir
    } else if (gbMatch) {
        return parseFloat(gbMatch[1]); // GB'yi direkt döndür
    }

    return 0; // Belirtilen birim yoksa varsayılan 0 döndür
}; 