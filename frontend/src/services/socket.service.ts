import { io, Socket } from 'socket.io-client';
import { authService } from './auth.service';
class SocketService {
    private socket: Socket | null = null;
    connect() {
        if (this.socket?.connected)
            return;
        const socketBase = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BACKEND_URL) ||
            (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SOCKET_URL) ||
            (typeof window !== 'undefined' && window.location.origin.includes('vercel.app')
                ? 'https://tancse2005-edumap.hf.space'
                : '');
        this.socket = io(`${socketBase}/realtime`, {
            path: '/api/socket.io',
            transports: ['websocket', 'polling'],
        });
        this.socket.on('connect', () => {
            console.log('Connected to realtime gateway');
            const user = authService.getUser();
            if (user) {
                this.socket?.emit('identity', user.id);
            }
        });
        this.socket.on('notify', (data: any) => {
            console.log('New notification:', data);
            this.showToast(data.title, data.body);
        });
    }
    private showToast(title: string, body: string) {
        const event = new CustomEvent('edumap-notification', {
            detail: { title, body }
        });
        window.dispatchEvent(event);
    }
    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }
}
export const socketService = new SocketService();
