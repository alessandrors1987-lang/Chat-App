import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// This is an external script, so we need to declare it
declare const firebase: any;

// **IMPORTANTE**: Substitua com suas próprias credenciais do Firebase
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const database = firebase.database();

const rooms = [
  { id: 'general', name: 'Geral' },
  { id: 'esportes', name: 'Esportes' },
  { id: 'filmes', name: 'Filmes' },
  { id: 'jogos', name: 'Jogos' },
  { id: 'resenhas', name: 'Resenhas' },
];

const userStatuses = {
  available: { text: 'Disponível', color: '#28a745', icon: '🟢' },
  away: { text: 'Ausente', color: '#ffc107', icon: '🟡' },
  busy: { text: 'Ocupado', color: '#dc3545', icon: '🔴' },
  offline: { text: 'Offline', color: '#6c757d', icon: '⚪️' }
};

const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        if (!email || !password) {
          setError('Email e senha são obrigatórios.');
          return;
        }
        await auth.signInWithEmailAndPassword(email, password);
      } else {
        if (!email || !password || !displayName) {
          setError('Nome de usuário, email e senha são obrigatórios.');
          return;
        }
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({
          displayName: displayName
        });
        // Save user info to the database for profiles
        await database.ref('users/' + userCredential.user.uid).set({
          displayName: displayName,
          email: email,
          status: 'available' // Default status
        });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>{isLogin ? 'Login' : 'Cadastre-se'}</h1>
        <form className="auth-form" onSubmit={handleAuthAction}>
          {!isLogin && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nome de usuário"
              className="auth-input"
              aria-label="Display Name"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="auth-input"
            aria-label="Email"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="auth-input"
            aria-label="Password"
          />
          <button type="submit" className="auth-button">
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="auth-toggle">
          {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
        </button>
        {error && <p className="auth-error">{error}</p>}
      </div>
    </div>
  );
};

const UserProfileModal = ({ user, currentUser, onClose, onStartChat }) => {
    if (!user) return null;
    const statusKey = user.isOnline ? user.status : 'offline';
    const status = userStatuses[statusKey] || userStatuses.offline;

    return (
        <div className="profile-modal-overlay" onClick={onClose}>
            <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
                <header className="profile-modal-header">
                    <h2>Perfil do Usuário</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </header>
                <div className="profile-modal-body">
                    <h3>{user.displayName}</h3>
                    <p>{user.email || 'Email não disponível'}</p>
                    <div className="profile-status">
                        <span className="status-indicator" style={{ backgroundColor: status.color }}></span>
                        {status.text}
                    </div>
                    {currentUser && user.uid !== currentUser.uid && (
                        <button className="profile-message-button" onClick={() => onStartChat(user)}>
                            Enviar Mensagem
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const StatusSelector = ({ user, currentStatus, onStatusChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const status = userStatuses[currentStatus] || userStatuses.offline;

    const handleSelectStatus = (newStatus) => {
        onStatusChange(newStatus);
        setIsOpen(false);
    };

    return (
        <div className="status-selector-container">
            {isOpen && (
                <div className="status-selector-popup">
                    {Object.keys(userStatuses)
                        .filter(key => key !== 'offline')
                        .map(key => (
                            <div key={key} className="status-option" onClick={() => handleSelectStatus(key)}>
                                <span className="status-indicator" style={{ backgroundColor: userStatuses[key].color }}></span>
                                {userStatuses[key].text}
                            </div>
                        ))}
                </div>
            )}
            <div className="status-selector-display" onClick={() => setIsOpen(!isOpen)}>
                <span className="status-indicator" style={{ backgroundColor: status.color }}></span>
                <div className="status-selector-user-info">
                    <span className="status-selector-username">{user.displayName}</span>
                    <span className="status-selector-status-text">{status.text}</span>
                </div>
            </div>
        </div>
    );
};


const Chat = ({ user }) => {
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [joinedRooms, setJoinedRooms] = useState(new Set());
  const [privateChats, setPrivateChats] = useState([]);
  const [partnerStatuses, setPartnerStatuses] = useState({});
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [myStatus, setMyStatus] = useState('available');
  const [currentMessage, setCurrentMessage] = useState('');
  const [viewingProfile, setViewingProfile] = useState(null);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const messageListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mentionQueryRef = useRef('');

  useEffect(() => {
    database.ref(`users/${user.uid}/status`).once('value', (snapshot) => {
        setMyStatus(snapshot.val() || 'available');
    });
  }, [user.uid]);

  // Fetch private chats
  useEffect(() => {
    const privateChatsRef = database.ref(`users/${user.uid}/privateChats`);
    const listener = privateChatsRef.on('value', snapshot => {
        const data = snapshot.val();
        const chatList = data ? Object.entries(data).map(([uid, details]) => ({ uid, ...(details as object) })) : [];
        setPrivateChats(chatList);
    });
    return () => privateChatsRef.off('value', listener);
  }, [user.uid]);
  
  // Listen for partner status changes
  useEffect(() => {
    const listeners = {};
    privateChats.forEach(chat => {
        const partnerStatusRef = database.ref(`status/${chat.uid}`);
        listeners[chat.uid] = partnerStatusRef.on('value', snapshot => {
            const statusData = snapshot.val();
            setPartnerStatuses(prev => ({
                ...prev,
                [chat.uid]: statusData || { state: 'offline', status: 'offline' }
            }));
        });
    });

    return () => {
        Object.entries(listeners).forEach(([uid, listener]) => {
            database.ref(`status/${uid}`).off('value', listener);
        });
    };
  }, [privateChats]);

  // Presence, Message, and Typing Handling Effect
  useEffect(() => {
    if (!activeRoomId) {
      setOnlineUsers([]);
      setMessages([]);
      setTypingUsers([]);
      return;
    }

    const isPrivate = activeRoomId.startsWith('private_');
    const messagePath = isPrivate ? `private_messages/${activeRoomId}` : `messages/${activeRoomId}`;
    const presencePath = `presences/${activeRoomId}`;
    const typingPath = `typing/${activeRoomId}`;

    const roomMessagesRef = database.ref(messagePath);
    const roomTypingRef = database.ref(typingPath);
    const roomPresenceRef = database.ref(presencePath);

    const handleNewMessages = (snapshot) => {
      const messagesData = snapshot.val();
      setMessages(messagesData ? Object.values(messagesData) : []);
    };
    roomMessagesRef.on('value', handleNewMessages);

    const handleTypingUsers = (snapshot) => {
      const typingData = snapshot.val() || {};
      const typingDisplayNames = Object.keys(typingData)
        .filter(uid => uid !== user.uid && typingData[uid])
        .map(uid => typingData[uid].displayName);
      setTypingUsers(typingDisplayNames);
    };
    roomTypingRef.on('value', handleTypingUsers);

    const handleOnlineUsers = (snapshot) => {
      const usersData = snapshot.val();
      setOnlineUsers(usersData ? Object.values(usersData) : []);
    };
    if (!isPrivate) {
      roomPresenceRef.on('value', handleOnlineUsers);
    } else {
        const partnerUid = activeRoomId.replace('private_', '').replace(user.uid, '').replace('_','');
        database.ref(`users/${partnerUid}`).once('value', snapshot => {
            const partnerData = snapshot.val();
            if(partnerData) {
                setOnlineUsers([{uid: partnerUid, displayName: partnerData.displayName, status: 'available'}]);
            }
        });
    }

    const userTypingRef = database.ref(`${typingPath}/${user.uid}`);
    userTypingRef.onDisconnect().remove();

    if (!isPrivate) {
      const userPresenceRef = database.ref(`${presencePath}/${user.uid}`);
      userPresenceRef.set({ uid: user.uid, displayName: user.displayName, status: myStatus });
      userPresenceRef.onDisconnect().remove();
    }

    return () => {
      roomMessagesRef.off('value', handleNewMessages);
      roomTypingRef.off('value', handleTypingUsers);
      userTypingRef.remove();

      if (!isPrivate) {
        roomPresenceRef.off('value', handleOnlineUsers);
        const userPresenceRef = database.ref(`${presencePath}/${user.uid}`);
        userPresenceRef.remove();
      }
    };
  }, [activeRoomId, user.uid, user.displayName, myStatus]);

  // Scroll to bottom effect
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const handleRoomSelect = (roomId) => {
    if (roomId === activeRoomId) return;
    setMessages([]);
    setTypingUsers([]);
    setActiveRoomId(roomId);
  };

  const handleJoinRoom = (roomId) => {
    setJoinedRooms(prev => new Set(prev).add(roomId));
    handleRoomSelect(roomId);
  };

  const handleLeaveRoom = (roomId) => {
    setJoinedRooms(prev => {
        const newSet = new Set(prev);
        newSet.delete(roomId);
        return newSet;
    });
    if (activeRoomId === roomId) {
        setActiveRoomId(null);
    }
  };

  const handleLeavePrivateChat = (e, partnerId, partnerName) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza de que deseja remover a conversa com ${partnerName}? Esta ação removerá a conversa para ambos os usuários e não pode ser desfeita.`)) {
        const myUid = user.uid;
        database.ref(`users/${myUid}/privateChats/${partnerId}`).remove();
        database.ref(`users/${partnerId}/privateChats/${myUid}`).remove();

        const privateRoomId = `private_${[myUid, partnerId].sort().join('_')}`;
        if (activeRoomId === privateRoomId) {
            setActiveRoomId(null);
        }
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (currentMessage.trim() === '' || !activeRoomId) return;

    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
    }
    database.ref(`typing/${activeRoomId}/${user.uid}`).remove();

    const isPrivate = activeRoomId.startsWith('private_');
    const messagePath = isPrivate ? `private_messages/${activeRoomId}` : `messages/${activeRoomId}`;
    const roomMessagesRef = database.ref(messagePath);

    const newMessage = {
      text: currentMessage,
      senderId: user.uid,
      senderName: user.displayName || user.email,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    roomMessagesRef.push(newMessage);

    // Handle notifications for mentions
    const mentionedUsers = onlineUsers.filter(u => 
        currentMessage.includes(`@${u.displayName}`) && u.uid !== user.uid
    );

    mentionedUsers.forEach(mentionedUser => {
        database.ref(`notifications/${mentionedUser.uid}`).push({
            senderName: user.displayName,
            roomName: isPrivate ? `Direct Message` : rooms.find(r => r.id === activeRoomId)?.name,
            roomId: activeRoomId,
            message: currentMessage,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            read: false,
        });
    });

    setCurrentMessage('');
    setMentionSuggestions([]);
  };

  const handleTyping = (e) => {
    const text = e.target.value;
    setCurrentMessage(text);

    const mentionMatch = text.match(/@(\w*)$/);
    if (mentionMatch) {
      mentionQueryRef.current = mentionMatch[1].toLowerCase();
      const suggestions = onlineUsers.filter(u => 
        u.displayName.toLowerCase().includes(mentionQueryRef.current) && u.uid !== user.uid
      );
      setMentionSuggestions(suggestions);
    } else {
      setMentionSuggestions([]);
    }

    if (!activeRoomId) return;
    const userTypingRef = database.ref(`typing/${activeRoomId}/${user.uid}`);
    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
    }
    if (text.trim()) {
        userTypingRef.set({ displayName: user.displayName });
        typingTimeoutRef.current = setTimeout(() => {
            userTypingRef.remove();
        }, 2000);
    } else {
        userTypingRef.remove();
    }
  };

  const handleSelectMention = (displayName) => {
    const newText = currentMessage.replace(/@\w*$/, `@${displayName} `);
    setCurrentMessage(newText);
    setMentionSuggestions([]);
    (document.querySelector('.message-input') as HTMLInputElement)?.focus();
  };
  
  const formatTypingMessage = (users) => {
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} está digitando...`;
    if (users.length === 2) return `${users[0]} e ${users[1]} estão digitando...`;
    return `${users.slice(0, 2).join(', ')} e outros estão digitando...`;
  };

  const handleLogout = () => {
    auth.signOut();
  };
  
  const handleViewProfile = async (userId) => {
    if (!userId) return;
    setViewingProfile({ displayName: 'Carregando...' });
    try {
        const userSnapshot = await database.ref('users/' + userId).once('value');
        const statusSnapshot = await database.ref('status/' + userId).once('value');
        const userData = userSnapshot.val();
        const statusData = statusSnapshot.val();
        
        if (userData) {
            const isOnline = statusData && statusData.state === 'online';
            setViewingProfile({ ...userData, uid: userId, isOnline, status: isOnline ? statusData.status : 'offline' });
        } else {
            setViewingProfile({ displayName: 'Usuário não encontrado', uid: userId, isOnline: false, status: 'offline' });
        }
    } catch (error) {
        setViewingProfile({ displayName: 'Erro ao carregar', uid: userId, isOnline: false, status: 'offline' });
    }
  };
  
  const handleStartPrivateChat = async (otherUser) => {
    const sortedUIDs = [user.uid, otherUser.uid].sort();
    const privateRoomId = `private_${sortedUIDs[0]}_${sortedUIDs[1]}`;
    
    await database.ref(`users/${user.uid}/privateChats/${otherUser.uid}`).set({
      displayName: otherUser.displayName,
    });
    await database.ref(`users/${otherUser.uid}/privateChats/${user.uid}`).set({
      displayName: user.displayName,
    });
    
    handleRoomSelect(privateRoomId);
    handleCloseProfile();
  };

  const handleCloseProfile = () => setViewingProfile(null);

  const handleStatusChange = (newStatus) => {
    setMyStatus(newStatus);
    database.ref(`users/${user.uid}/status`).set(newStatus);
    database.ref(`status/${user.uid}/status`).set(newStatus);
  };
  
  const renderMessageWithMentions = (text) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, index) => {
        if (part.startsWith('@')) {
            const username = part.substring(1);
            const isMe = username === user.displayName;
            const isUserOnline = onlineUsers.some(u => u.displayName === username);

            if (isUserOnline) {
                return (
                    <span key={index} className={`mention-highlight ${isMe ? 'self' : ''}`}>
                        {part}
                    </span>
                );
            }
        }
        return part;
    });
  };

  const isPrivateChat = activeRoomId && activeRoomId.startsWith('private_');
  const activeRoom = !isPrivateChat ? rooms.find(r => r.id === activeRoomId) : null;
  
  let chatPartner = null;
  if(isPrivateChat) {
      const partnerUid = activeRoomId.replace('private_', '').replace(user.uid, '').replace('_','');
      chatPartner = privateChats.find(p => p.uid === partnerUid);
  }

  return (
    <div className="app-container">
      {viewingProfile && <UserProfileModal user={viewingProfile} currentUser={user} onStartChat={handleStartPrivateChat} onClose={handleCloseProfile} />}
      <aside className="sidebar">
        <div>
          <header className="sidebar-header">
            <h2>Salas</h2>
            <button onClick={handleLogout} className="logout-button">Sair</button>
          </header>
          <ul className="room-list">
            {rooms.map(room => (
              <li key={room.id} className={`room-item ${joinedRooms.has(room.id) ? 'joined' : 'unjoined'}`}>
                {joinedRooms.has(room.id) ? (
                  <span onClick={() => handleRoomSelect(room.id)} className={`room-name ${room.id === activeRoomId ? 'active' : ''}`}>
                    # {room.name}
                  </span>
                ) : (
                  <>
                    <span># {room.name}</span>
                    <button onClick={() => handleJoinRoom(room.id)} className="join-button">Entrar</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <h3 className="sidebar-subheader">Mensagens Diretas</h3>
          <ul className="room-list">
              {privateChats.map(chat => {
                  const privateRoomId = `private_${[user.uid, chat.uid].sort().join('_')}`;
                  const partnerStatus = partnerStatuses[chat.uid] || { state: 'offline', status: 'offline' };
                  const statusKey = partnerStatus.state === 'online' ? partnerStatus.status : 'offline';
                  const status = userStatuses[statusKey] || userStatuses.offline;
                  return (
                      <li key={chat.uid} className={`room-item joined ${privateRoomId === activeRoomId ? 'active' : ''}`} onClick={() => handleRoomSelect(privateRoomId)}>
                        <span className="room-name-wrapper">
                            <span className="status-indicator" style={{ backgroundColor: status.color, marginRight: '8px' }}></span>
                            {chat.displayName}
                        </span>
                        <button 
                            className="leave-private-chat-button" 
                            title={`Remover conversa com ${chat.displayName}`} 
                            onClick={(e) => handleLeavePrivateChat(e, chat.uid, chat.displayName)}
                        >
                            &times;
                        </button>
                      </li>
                  );
              })}
          </ul>
        </div>
        <StatusSelector user={user} currentStatus={myStatus} onStatusChange={handleStatusChange} />
      </aside>
      <main className="chat-container">
        <header className="chat-header">
          <h1>
            {isPrivateChat ? chatPartner?.displayName : (activeRoom ? activeRoom.name : 'Selecione uma sala')}
          </h1>
          {activeRoom && <button onClick={() => handleLeaveRoom(activeRoom.id)} className="leave-button">Sair da Sala</button>}
        </header>
        {activeRoomId ? (
          <>
            <section className="message-list" ref={messageListRef}>
              {messages.length === 0 && (
                <div className="message-wrapper theirs"><div className="message">Seja o primeiro a enviar uma mensagem!</div></div>
              )}
              {messages.map((msg, index) => (
                <div key={msg.id || index} className={`message-wrapper ${msg.senderId === user.uid ? 'mine' : 'theirs'}`}>
                  {msg.senderId !== user.uid && <div className="message-sender" onClick={() => handleViewProfile(msg.senderId)}>{msg.senderName}</div>}
                  <div className="message">
                    {renderMessageWithMentions(msg.text)}
                  </div>
                </div>
              ))}
            </section>
            <div className="typing-indicator-container">
                {typingUsers.length > 0 && 
                    <p className="typing-indicator">{formatTypingMessage(typingUsers)}</p>
                }
            </div>
            <div className="message-form-container">
              {mentionSuggestions.length > 0 && (
                <ul className="mention-suggestions">
                  {mentionSuggestions.map(u => (
                    <li key={u.uid} className="mention-suggestion-item" onClick={() => handleSelectMention(u.displayName)}>
                      {u.displayName}
                    </li>
                  ))}
                </ul>
              )}
              <form className="message-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="message-input"
                  value={currentMessage}
                  onChange={handleTyping}
                  placeholder="Digite sua mensagem..."
                  aria-label="Message input"
                  autoComplete="off"
                />
                <button type="submit" className="send-button" disabled={!currentMessage.trim()}>
                  Enviar
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="chat-placeholder">
            <h2>Bem-vindo ao Chat!</h2>
            <p>Junte-se a uma sala ou inicie uma conversa para começar a conversar.</p>
          </div>
        )}
      </main>
      {!isPrivateChat && activeRoomId && (
        <aside className="online-users-panel">
            <header className="online-users-header">
              <h3>Online ({onlineUsers.length})</h3>
            </header>
            <ul className="online-users-list">
              {onlineUsers.map(onlineUser => {
                  const statusKey = onlineUser.status || 'available';
                  const status = userStatuses[statusKey] || userStatuses.offline;
                  return (
                    <li key={onlineUser.uid} className="online-user-item" onClick={() => handleViewProfile(onlineUser.uid)}>
                        <span className="status-indicator" style={{backgroundColor: status.color }}></span>
                        {onlineUser.displayName}
                    </li>
                  );
              })}
            </ul>
        </aside>
      )}
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(currentUser => {
      if (currentUser) {
        // --- Firebase Presence System ---
        const userStatusDatabaseRef = database.ref('/status/' + currentUser.uid);

        const isOfflineForDatabase = {
            state: 'offline',
            last_changed: firebase.database.ServerValue.TIMESTAMP,
            status: 'offline'
        };
        const isOnlineForDatabase = {
            state: 'online',
            last_changed: firebase.database.ServerValue.TIMESTAMP,
            status: 'available' // Default status on login
        };

        database.ref('.info/connected').on('value', (snapshot) => {
            if (snapshot.val() === false) {
                return;
            };

            userStatusDatabaseRef.onDisconnect().set(isOfflineForDatabase).then(() => {
                userStatusDatabaseRef.set(isOnlineForDatabase);
                // Also update the persistent user profile status
                database.ref('users/' + currentUser.uid).update({ status: 'available' });
            });
        });
      }
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="app-wrapper">
      {user ? <Chat user={user} /> : <AuthScreen />}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);