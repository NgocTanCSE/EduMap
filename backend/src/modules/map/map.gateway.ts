import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/map-realtime',
})
export class MapGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private vehicleInterval: NodeJS.Timeout;

  // Giả lập tọa độ của chiếc "Xe Thư viện Lưu động" đang chạy vòng quanh Quận 1
  private currentVehiclePosition = { lat: 10.7769, lng: 106.7009 };

  handleConnection(client: Socket) {
    console.log(`📡 Client connected to Map Realtime: ${client.id}`);
    
    // Nếu có người kết nối thì bắt đầu cho xe chạy
    if (!this.vehicleInterval) {
      this.startMovingVehicle();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);
  }

  // Hàm này giả lập việc lấy GPS từ thiết bị gắn trên xe và phát sóng cho toàn bộ Client
  private startMovingVehicle() {
    this.vehicleInterval = setInterval(() => {
      // Cho xe di chuyển ngẫu nhiên một chút (Khoảng 1-5 mét)
      this.currentVehiclePosition.lat += (Math.random() - 0.5) * 0.0005;
      this.currentVehiclePosition.lng += (Math.random() - 0.5) * 0.0005;

      // Broadcast tọa độ mới cho tất cả những ai đang mở trang Bản đồ
      this.server.emit('vehicle_location_update', {
        vehicleId: 'EDU-BUS-01',
        name: 'Xe Thư viện Lưu động 01',
        position: this.currentVehiclePosition,
        status: 'Đang di chuyển'
      });
    }, 2000); // Bắn tín hiệu 2 giây / lần
  }
}
