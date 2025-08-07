import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from './authStore'

interface Message {
  id: string
  content: string
  senderId: string
  receiverId?: string
  channelId?: string
  messageType: string
  timestamp: string
  metadata: any
  sender?: {
    id: string
    name: string
    role: string
  }
}

interface Channel {
  id: string
  name: string
  type: string
  projectId: string
  members: string[]
  messages: Message[]
}

interface SocketState {
  socket: Socket | null
  isConnected: boolean
  messages: Record<string, Message[]>
  channels: Channel[]
  currentChannel: string | null
  typingUsers: Record<string, string[]>
  initializeSocket: () => void
  disconnectSocket: () => void
  joinChannel: (channelId: string) => void
  leaveChannel: (channelId: string) => void
  sendMessage: (content: string, channelId?: string, receiverId?: string) => void
  setCurrentChannel: (channelId: string | null) => void
  startTyping: (channelId?: string, receiverId?: string) => void
  stopTyping: (channelId?: string, receiverId?: string) => void
  clearMessages: (channelId: string) => void
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  messages: {},
  channels: [],
  currentChannel: null,
  typingUsers: {},

  initializeSocket: () => {
    const { token } = useAuthStore.getState()
    
    if (!token) {
      console.error('No authentication token available')
      return
    }

    const socket = io(WS_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      console.log('Connected to WebSocket server')
      set({ isConnected: true })
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server')
      set({ isConnected: false })
    })

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      set({ isConnected: false })
    })

    socket.on('new-message', (data: { message: Message; channelId?: string; type?: string }) => {
      const { messages } = get()
      const { message, channelId } = data

      if (channelId) {
        const channelMessages = messages[channelId] || []
        set({
          messages: {
            ...messages,
            [channelId]: [...channelMessages, message],
          },
        })
      } else if (data.type === 'direct') {
        const directKey = `direct-${message.senderId}`
        const directMessages = messages[directKey] || []
        set({
          messages: {
            ...messages,
            [directKey]: [...directMessages, message],
          },
        })
      }
    })

    socket.on('channel-joined', (data: { channelId: string; channelName: string }) => {
      console.log(`Joined channel: ${data.channelName}`)
    })

    socket.on('channel-left', (data: { channelId: string }) => {
      console.log(`Left channel: ${data.channelId}`)
    })

    socket.on('user-typing', (data: { userId: string; channelId?: string; type?: string }) => {
      const { typingUsers } = get()
      const { userId, channelId } = data

      if (channelId) {
        const currentTyping = typingUsers[channelId] || []
        if (!currentTyping.includes(userId)) {
          set({
            typingUsers: {
              ...typingUsers,
              [channelId]: [...currentTyping, userId],
            },
          })
        }
      }
    })

    socket.on('user-stopped-typing', (data: { userId: string; channelId?: string; type?: string }) => {
      const { typingUsers } = get()
      const { userId, channelId } = data

      if (channelId) {
        const currentTyping = typingUsers[channelId] || []
        set({
          typingUsers: {
            ...typingUsers,
            [channelId]: currentTyping.filter((id) => id !== userId),
          },
        })
      }
    })

    socket.on('task-updated', (data: { task: any; updatedBy: string }) => {
      console.log('Task updated:', data.task.title)
      // You can add task update handling here
    })

    socket.on('agent-status-updated', (data: { agent: any; updatedAt: string }) => {
      console.log('Agent status updated:', data.agent.name, data.agent.status)
      // You can add agent status update handling here
    })

    socket.on('system-message', (data: { message: string; timestamp: string; type: string }) => {
      console.log('System message:', data.message)
      // You can add system message handling here
    })

    socket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message)
    })

    set({ socket })
  },

  disconnectSocket: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, isConnected: false })
    }
  },

  joinChannel: (channelId: string) => {
    const { socket } = get()
    if (socket && socket.connected) {
      socket.emit('join-channel', channelId)
    }
  },

  leaveChannel: (channelId: string) => {
    const { socket } = get()
    if (socket && socket.connected) {
      socket.emit('leave-channel', channelId)
    }
  },

  sendMessage: (content: string, channelId?: string, receiverId?: string) => {
    const { socket } = get()
    if (socket && socket.connected) {
      socket.emit('send-message', {
        content,
        channelId,
        receiverId,
        messageType: 'TEXT',
      })
    }
  },

  setCurrentChannel: (channelId: string | null) => {
    set({ currentChannel: channelId })
  },

  startTyping: (channelId?: string, receiverId?: string) => {
    const { socket } = get()
    if (socket && socket.connected) {
      socket.emit('typing-start', { channelId, receiverId })
    }
  },

  stopTyping: (channelId?: string, receiverId?: string) => {
    const { socket } = get()
    if (socket && socket.connected) {
      socket.emit('typing-stop', { channelId, receiverId })
    }
  },

  clearMessages: (channelId: string) => {
    const { messages } = get()
    const newMessages = { ...messages }
    delete newMessages[channelId]
    set({ messages: newMessages })
  },
}))