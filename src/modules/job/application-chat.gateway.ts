import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UserService } from '../user/user.service';
import { ApplicationChatService } from './application-chat.service';

interface JoinPayload {
  applicationId?: string;
}

interface ChatMessagePayload {
  applicationId: string;
  message: {
    id: string;
    body: string;
    createdAt: Date;
    senderId: string;
    sender: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
  };
}

@WebSocketGateway({
  namespace: 'application-chat',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ApplicationChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ApplicationChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => ApplicationChatService))
    private readonly applicationChatService: ApplicationChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
        {
          secret:
            this.configService.get<string>('JWT_ACCESS_SECRET') ||
            'access-secret',
        },
      );

      if (!payload?.sub) {
        client.disconnect(true);
        return;
      }

      const user = await this.userService.findById(payload.sub);
      if (!user) {
        client.disconnect(true);
        return;
      }

      client.data.userId = user.id;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    if (!client.data?.userId) {
      return;
    }
  }

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPayload,
  ) {
    try {
      const applicationId = payload?.applicationId;
      if (!applicationId) {
        client.emit('chat:error', { message: 'Thiếu applicationId' });
        return;
      }

      const userId = String(client.data.userId || '');
      if (!userId) {
        client.emit('chat:error', { message: 'Unauthorized' });
        return;
      }

      await this.applicationChatService.listMessages(applicationId, userId);
      await client.join(this.getRoom(applicationId));
      client.emit('chat:joined', { applicationId });
    } catch {
      client.emit('chat:error', {
        message: 'Bạn không có quyền truy cập phòng chat này.',
      });
    }
  }

  emitNewMessage(payload: ChatMessagePayload) {
    this.server
      .to(this.getRoom(payload.applicationId))
      .emit('chat:message', payload);
  }

  private getRoom(applicationId: string) {
    return `application:${applicationId}`;
  }

  private extractToken(client: Socket): string | null {
    const fromAuth =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : null;
    if (fromAuth) {
      return fromAuth;
    }

    const authHeader = client.handshake.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }
}
