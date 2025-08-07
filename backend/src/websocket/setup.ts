import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket {
  userId?: string;
  agentId?: string;
  projectId?: string;
  role?: string;
}

export const setupWebSocket = (io: SocketIOServer) => {
  // Authentication middleware
  io.use(async (socket: any, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      if (!process.env.JWT_SECRET) {
        return next(new Error('JWT secret not configured'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      
      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true }
      });

      if (user) {
        socket.userId = user.id;
        socket.role = user.role;
      } else {
        // Check if agent exists
        const agent = await prisma.agent.findUnique({
          where: { id: decoded.agentId },
          select: { id: true, name: true, role: true, projectId: true }
        });

        if (agent) {
          socket.agentId = agent.id;
          socket.role = agent.role;
          socket.projectId = agent.projectId;
        } else {
          return next(new Error('Invalid token'));
        }
      }

      next();
    } catch (error) {
      logger.error('WebSocket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: any) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    // Join project room if user/agent has a project
    if (socket.projectId) {
      socket.join(`project:${socket.projectId}`);
      logger.info(`Client ${socket.id} joined project room: ${socket.projectId}`);
    }

    // Join general room for system-wide messages
    socket.join('general');

    // Handle joining specific channels
    socket.on('join-channel', async (channelId: string) => {
      try {
        const channel = await prisma.channel.findUnique({
          where: { id: channelId },
          include: { members: true }
        });

        if (channel) {
          // Check if user/agent is a member of the channel
          const isMember = channel.members.some(member => 
            member.agentId === socket.agentId || member.userId === socket.userId
          );

          if (isMember) {
            socket.join(`channel:${channelId}`);
            logger.info(`Client ${socket.id} joined channel: ${channelId}`);
            
            socket.emit('channel-joined', {
              channelId,
              channelName: channel.name
            });
          } else {
            socket.emit('error', {
              message: 'Not authorized to join this channel'
            });
          }
        }
      } catch (error) {
        logger.error('Error joining channel:', error);
        socket.emit('error', {
          message: 'Failed to join channel'
        });
      }
    });

    // Handle leaving channels
    socket.on('leave-channel', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
      logger.info(`Client ${socket.id} left channel: ${channelId}`);
      
      socket.emit('channel-left', {
        channelId
      });
    });

    // Handle sending messages
    socket.on('send-message', async (data: {
      content: string;
      channelId?: string;
      receiverId?: string;
      messageType?: string;
    }) => {
      try {
        const messageData = {
          senderId: socket.agentId || socket.userId,
          receiverId: data.receiverId,
          channelId: data.channelId,
          content: data.content,
          messageType: data.messageType || 'TEXT',
          metadata: {
            senderType: socket.agentId ? 'agent' : 'user',
            senderRole: socket.role,
            timestamp: new Date().toISOString()
          }
        };

        // Save message to database
        const message = await prisma.agentMessage.create({
          data: messageData,
          include: {
            sender: true,
            receiver: true,
            channel: true
          }
        });

        // Emit message to appropriate recipients
        if (data.channelId) {
          // Channel message
          io.to(`channel:${data.channelId}`).emit('new-message', {
            message,
            channelId: data.channelId
          });
        } else if (data.receiverId) {
          // Direct message
          socket.to(data.receiverId).emit('new-message', {
            message,
            type: 'direct'
          });
          socket.emit('new-message', {
            message,
            type: 'direct'
          });
        }

        logger.info(`Message sent: ${message.id}`);
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', {
          message: 'Failed to send message'
        });
      }
    });

    // Handle task updates
    socket.on('task-update', async (data: {
      taskId: string;
      status: string;
      progress?: number;
      notes?: string;
    }) => {
      try {
        const task = await prisma.task.update({
          where: { id: data.taskId },
          data: {
            status: data.status as any,
            metadata: {
              ...data,
              updatedBy: socket.agentId || socket.userId,
              updatedAt: new Date().toISOString()
            }
          },
          include: {
            project: true,
            assignedAgent: true
          }
        });

        // Emit task update to project room
        if (task.projectId) {
          io.to(`project:${task.projectId}`).emit('task-updated', {
            task,
            updatedBy: socket.agentId || socket.userId
          });
        }

        logger.info(`Task updated: ${task.id} - ${task.status}`);
      } catch (error) {
        logger.error('Error updating task:', error);
        socket.emit('error', {
          message: 'Failed to update task'
        });
      }
    });

    // Handle agent status updates
    socket.on('agent-status-update', async (data: {
      status: string;
      currentTask?: string;
    }) => {
      try {
        if (socket.agentId) {
          const agent = await prisma.agent.update({
            where: { id: socket.agentId },
            data: {
              status: data.status as any,
              lastActiveAt: new Date(),
              memory: {
                currentTask: data.currentTask,
                lastStatusUpdate: new Date().toISOString()
              }
            }
          });

          // Emit agent status update to project room
          if (agent.projectId) {
            io.to(`project:${agent.projectId}`).emit('agent-status-updated', {
              agent,
              updatedAt: new Date().toISOString()
            });
          }

          logger.info(`Agent status updated: ${agent.id} - ${agent.status}`);
        }
      } catch (error) {
        logger.error('Error updating agent status:', error);
        socket.emit('error', {
          message: 'Failed to update agent status'
        });
      }
    });

    // Handle typing indicators
    socket.on('typing-start', (data: { channelId?: string; receiverId?: string }) => {
      if (data.channelId) {
        socket.to(`channel:${data.channelId}`).emit('user-typing', {
          userId: socket.userId || socket.agentId,
          channelId: data.channelId
        });
      } else if (data.receiverId) {
        socket.to(data.receiverId).emit('user-typing', {
          userId: socket.userId || socket.agentId,
          type: 'direct'
        });
      }
    });

    socket.on('typing-stop', (data: { channelId?: string; receiverId?: string }) => {
      if (data.channelId) {
        socket.to(`channel:${data.channelId}`).emit('user-stopped-typing', {
          userId: socket.userId || socket.agentId,
          channelId: data.channelId
        });
      } else if (data.receiverId) {
        socket.to(data.receiverId).emit('user-stopped-typing', {
          userId: socket.userId || socket.agentId,
          type: 'direct'
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
      
      // Update agent status to offline if it was an agent
      if (socket.agentId) {
        prisma.agent.update({
          where: { id: socket.agentId },
          data: {
            status: 'OFFLINE',
            lastActiveAt: new Date()
          }
        }).catch(error => {
          logger.error('Error updating agent status on disconnect:', error);
        });
      }
    });
  });

  // Broadcast system messages
  const broadcastSystemMessage = (message: string, projectId?: string) => {
    const targetRoom = projectId ? `project:${projectId}` : 'general';
    io.to(targetRoom).emit('system-message', {
      message,
      timestamp: new Date().toISOString(),
      type: 'system'
    });
  };

  // Export broadcast function for use in other parts of the application
  (io as any).broadcastSystemMessage = broadcastSystemMessage;

  logger.info('WebSocket server setup complete');
};