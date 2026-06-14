import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('EventsGateway');

  // Map: companyId → Set of socketIds (admin/hr sockets only)
  private adminRooms = new Map<string, Set<string>>();

  constructor(private jwtService: JwtService) {}

  afterInit() {
    this.logger.log('✅ WebSocket Gateway initialized');
  }

  // ─── On Client Connect ────────────────────────────────────
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      }) as any;

      // Store user info on socket
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      client.data.companyId = payload.companyId;
      client.data.email = payload.email;

      // Join company room — all users join their company room
      client.join(`company:${payload.companyId}`);

      // If ADMIN or HR — also join admin room for sensitive events
      if (['ADMIN', 'HR'].includes(payload.role)) {
        client.join(`admin:${payload.companyId}`);

        if (!this.adminRooms.has(payload.companyId)) {
          this.adminRooms.set(payload.companyId, new Set());
        }
        this.adminRooms.get(payload.companyId)?.add(client.id);
      }

      this.logger.log(
        `Client connected: ${payload.email} (${payload.role}) | Socket: ${client.id}`,
      );

      // Send connection confirmation
      client.emit('connected', {
        message: 'Connected to ZeroProxy real-time server',
        userId: payload.sub,
        role: payload.role,
      });
    } catch (err) {
      this.logger.warn(`Unauthorized WebSocket connection: ${client.id}`);
      client.disconnect();
    }
  }

  // ─── On Client Disconnect ─────────────────────────────────
  handleDisconnect(client: Socket) {
    const companyId = client.data?.companyId;
    if (companyId && this.adminRooms.has(companyId)) {
      this.adminRooms.get(companyId)?.delete(client.id);
    }
    this.logger.log(`Client disconnected: ${client.data?.email} | Socket: ${client.id}`);
  }

  // ─── Subscribe: Client ping (heartbeat) ───────────────────
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  // ─── Emit: Employee Checked In ────────────────────────────
  emitCheckIn(companyId: string, data: {
    userId: string;
    userName: string;
    userEmail: string;
    checkIn: Date;
    deviceInfo: string;
    ipAddress: string;
  }) {
    this.server.to(`admin:${companyId}`).emit('employee:checkin', {
      event: 'employee:checkin',
      timestamp: new Date().toISOString(),
      ...data,
    });
    this.logger.log(`Emitted checkin event for ${data.userName}`);
  }

  // ─── Emit: Employee Checked Out ───────────────────────────
  emitCheckOut(companyId: string, data: {
    userId: string;
    userName: string;
    userEmail: string;
    checkOut: Date;
    totalHours: number;
  }) {
    this.server.to(`admin:${companyId}`).emit('employee:checkout', {
      event: 'employee:checkout',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  // ─── Emit: Employee Logged In ─────────────────────────────
  emitUserLogin(companyId: string, data: {
    userId: string;
    userName: string;
    userEmail: string;
    role: string;
    ipAddress: string;
    deviceInfo: string;
  }) {
    this.server.to(`admin:${companyId}`).emit('user:login', {
      event: 'user:login',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  // ─── Emit: Employee Logged Out ────────────────────────────
  emitUserLogout(companyId: string, data: {
    userId: string;
    userName: string;
    userEmail: string;
  }) {
    this.server.to(`admin:${companyId}`).emit('user:logout', {
      event: 'user:logout',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  // ─── Emit: Session Force Logout ───────────────────────────
  emitForceLogout(companyId: string, data: {
    targetUserId: string;
    targetUserName: string;
    byAdminEmail: string;
    sessionId?: string;
    allSessions?: boolean;
  }) {
    // Notify admin room
    this.server.to(`admin:${companyId}`).emit('session:force-logout', {
      event: 'session:force-logout',
      timestamp: new Date().toISOString(),
      ...data,
    });

    // Notify the affected user directly
    this.server.to(`company:${companyId}`).emit(`user:kicked:${data.targetUserId}`, {
      message: 'Your session has been terminated by admin.',
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Emit: New User Created ───────────────────────────────
  emitUserCreated(companyId: string, data: {
    userId: string;
    userName: string;
    userEmail: string;
    role: string;
  }) {
    this.server.to(`admin:${companyId}`).emit('user:created', {
      event: 'user:created',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  // ─── Emit: User Deactivated ───────────────────────────────
  emitUserDeactivated(companyId: string, data: {
    userId: string;
    userName: string;
    userEmail: string;
  }) {
    this.server.to(`admin:${companyId}`).emit('user:deactivated', {
      event: 'user:deactivated',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  // ─── Emit: Live Stats Update ──────────────────────────────
  emitLiveStats(companyId: string, stats: {
    onlineNow: number;
    checkedInToday: number;
  }) {
    this.server.to(`admin:${companyId}`).emit('stats:update', {
      event: 'stats:update',
      timestamp: new Date().toISOString(),
      ...stats,
    });
  }
}
