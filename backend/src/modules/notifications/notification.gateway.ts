import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ 
  cors: { origin: '*' },
  namespace: 'realtime'
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationGateway.name);
  
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Đăng ký User ID vào Room riêng để nhận thông báo cá nhân
   */
  @SubscribeMessage('identity')
  handleIdentity(@ConnectedSocket() client: Socket, @MessageBody() userId: string) {
    if (userId) {
      client.join(userId);
      this.logger.log(`User ${userId} joined their private room.`);
      return { status: 'ok', room: userId };
    }
  }

  /**
   * Gửi thông báo thời gian thực tới một User cụ thể
   */
  sendToUser(userId: string, data: any) {
    this.server.to(userId).emit('notify', data);
  }

  // ==========================================
  // 🎥 WEBRTC SIGNALING LOGIC (Giữ nguyên)
  // ==========================================

  @SubscribeMessage('join-call')
  handleJoinCall(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
    client.join(room);
    this.logger.log(`User joined call room: ${room}`);
    client.to(room).emit('user-joined', { userId: client.id });
  }

  @SubscribeMessage('webrtc-offer')
  handleOffer(@ConnectedSocket() client: Socket, @MessageBody() payload: { to: string, offer: any }) {
    this.server.to(payload.to).emit('webrtc-offer', {
      from: client.id,
      offer: payload.offer
    });
  }

  @SubscribeMessage('webrtc-answer')
  handleAnswer(@ConnectedSocket() client: Socket, @MessageBody() payload: { to: string, answer: any }) {
    this.server.to(payload.to).emit('webrtc-answer', {
      from: client.id,
      answer: payload.answer
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(@ConnectedSocket() client: Socket, @MessageBody() payload: { to: string, candidate: any }) {
    this.server.to(payload.to).emit('ice-candidate', {
      from: client.id,
      candidate: payload.candidate
    });
  }
}
