import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// This is an external script, so we need to declare it
declare const firebase: any;

// **IMPORTANTE**: Substitua com suas próprias credenciais do Firebase
const firebaseConfig = {
  apiKey: "YOUR_API_key",
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
const storage = firebase.storage();

// Public STUN servers provided by Google
const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun1.l.google.com:19302' },
  ],
};


const initialPublicRooms = [
  { id: 'general', name: 'Geral', description: 'Um lugar para conversas gerais e conhecer pessoas.' },
  { id: 'esportes', name: 'Esportes', description: 'Discuta sobre futebol, basquete, F1 e mais.' },
  { id: 'filmes', name: 'Filmes', description: 'Debates sobre os últimos lançamentos e clássicos do cinema.' },
  { id: 'jogos', name: 'Jogos', description: 'Encontre parceiros para jogar e fale sobre seus games favoritos.' },
  { id: 'resenhas', name: 'Resenhas', description: 'Compartilhe suas opiniões sobre livros, séries e produtos.' },
];

const userStatuses = {
  available: { text: 'Disponível', color: '#28a745', icon: '🟢' },
  away: { text: 'Ausente', color: '#ffc107', icon: '🟡' },
  busy: { text: 'Ocupado', color: '#dc3545', icon: '🔴' },
  offline: { text: 'Offline', color: '#6c757d', icon: '⚪️' }
};

const PrivacyConsentModal = ({ onAccept }) => (
  <div className="privacy-modal-overlay">
    <div className="privacy-modal-content">
      <h2>Aviso de Privacidade</h2>
      <p>
        Para usar nosso chat, você precisa concordar com nossos termos. Nós coletamos
        dados como mensagens, informações de perfil e usamos armazenamento local
        (como cookies) para melhorar sua experiência e garantir a
        funcuncionalidade do serviço.
      </p>
      <p>
        Ao clicar em "Aceitar e Continuar", você confirma que leu e concorda
        com a nossa política de privacidade.
      </p>
      <button onClick={onAccept} className="privacy-accept-button">
        Aceitar e Continuar
      </button>
    </div>
  </div>
);

const ConfigWarning = () => (
  <div className="config-warning-overlay">
    <div className="config-warning-content">
      <h2>⚠️ Configuração Necessária do Firebase</h2>
      <p>
        Para que o chat funcione, você precisa conectá-lo ao seu projeto Firebase. Parece que as credenciais ainda não foram configuradas.
      </p>
      
      <h3>Passo 1: Encontre suas credenciais</h3>
      <p>
        Vá para as configurações do seu projeto no Firebase para encontrar o objeto <code>firebaseConfig</code>.
      </p>
      <a href="https://console.firebase.google.com/u/0/project/_/settings/general/" target="_blank" rel="noopener noreferrer" className="config-link-button">
        Abrir Configurações do Firebase
      </a>
      <p className="config-note">
        No Firebase, certifique-se de que você: <br/>
        1. Criou um <strong>Aplicativo Web</strong> (ícone {`</>`}). <br/>
        2. Habilitou <strong>E-mail/Senha</strong> e <strong>Google</strong> como métodos de login (em <i>Authentication</i>). <br/>
        3. Criou um <strong>Realtime Database</strong> em modo de teste.
      </p>
      
      <h3>Passo 2: Atualize o código</h3>
      <p>
        Copie o objeto <code>firebaseConfig</code> do Firebase e cole-o no arquivo <code>index.tsx</code>, substituindo o conteúdo de exemplo.
      </p>

      <p className="config-success-note">
        Após fazer isso, a tela de login aparecerá automaticamente.
      </p>
    </div>
  </div>
);


const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validatePassword = (password) => {
    if (password.length < 10) {
        return "A senha deve ter pelo menos 10 caracteres.";
    }
    if (!/\d/.test(password)) {
        return "A senha deve conter pelo menos um número.";
    }
    if (!/[a-zA-Z]/.test(password)) {
        return "A senha deve conter pelo menos uma letra.";
    }
    return null; // Password is valid
  };

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
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
        const passwordError = validatePassword(password);
        if (passwordError) {
          setError(passwordError);
          return;
        }
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({
          displayName: displayName
        });
        await database.ref('users/' + userCredential.user.uid).set({
          displayName: displayName,
          email: email,
          status: 'available',
          publicRooms: { 'general': true }
        });
      }
    } catch (err) {
       if (err.code === 'auth/unauthorized-domain') {
        setError('Erro: Este domínio não está autorizado para autenticação. Verifique as configurações do seu projeto Firebase.');
      } else {
        setError(err.message);
      }
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email) {
      setError('Por favor, insira seu email para redefinir a senha.');
      return;
    }
    try {
      await auth.sendPasswordResetEmail(email);
      setSuccess('Link de redefinição de senha enviado! Verifique seu email.');
      setIsResetMode(false);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result = await auth.signInWithPopup(provider);
      const user = result.user;
      const userRef = database.ref('users/' + user.uid);
      const snapshot = await userRef.once('value');
      if (!snapshot.exists()) {
        await userRef.set({
          displayName: user.displayName,
          email: user.email,
          status: 'available',
          publicRooms: { 'general': true }
        });
      }
    } catch (err) {
      if (err.code === 'auth/unauthorized-domain') {
        setError('Erro: Este domínio não está autorizado para autenticação. Verifique as configurações do seu projeto Firebase.');
      } else {
        setError(err.message);
      }
    }
  };
  
  const toggleMode = (mode) => {
      setIsLogin(mode === 'login');
      setIsResetMode(false);
      setError('');
      setSuccess('');
  };

  if (isResetMode) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h1>Redefinir Senha</h1>
          <form className="auth-form" onSubmit={handlePasswordReset}>
            <p className="auth-info">Insira seu email e enviaremos um link para você voltar a acessar sua conta.</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="auth-input"
              aria-label="Email"
            />
            <button type="submit" className="auth-button">
              Enviar Link de Redefinição
            </button>
          </form>
          <button onClick={() => setIsResetMode(false)} className="auth-toggle">
            Voltar para o Login
          </button>
          {error && <p className="auth-error">{error}</p>}
          {success && <p className="auth-success">{success}</p>}
        </div>
      </div>
    );
  }

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
          {!isLogin && (
            <p className="password-hint">Mínimo de 10 caracteres, com letras e números.</p>
          )}
          {isLogin && (
            <a href="#" onClick={() => setIsResetMode(true)} className="auth-forgot-password">
              Esqueceu a senha?
            </a>
          )}
          <button type="submit" className="auth-button">
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>

        <div className="auth-separator">ou</div>
        
        <button onClick={handleGoogleSignIn} className="google-auth-button">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="google-icon"><g><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.42-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></g></svg>
          <span>Entrar com o Google</span>
        </button>

        <button onClick={() => setIsLogin(!isLogin)} className="auth-toggle">
          {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
        </button>
        {error && <p className="auth-error">{error}</p>}
        {success && <p className="auth-success">{success}</p>}
      </div>
    </div>
  );
};

const UserProfileModal = ({ user, currentUser, onClose, onStartChat, onStartVideoCall }) => {
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
                        <span key={statusKey} className="status-indicator" style={{ backgroundColor: status.color }}></span>
                        {status.text}
                    </div>
                    {currentUser && user.uid !== currentUser.uid && (
                        <div className="profile-modal-actions">
                            <button className="profile-message-button" onClick={() => onStartChat(user)}>
                                Enviar Mensagem
                            </button>
                             <button className="profile-call-button" onClick={() => onStartVideoCall(user)}>
                                Iniciar Chamada
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CreateRoomModal = ({ onClose, onCreate }) => {
    const [roomName, setRoomName] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (roomName.trim()) {
            onCreate(roomName.trim(), isPrivate);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Criar Nova Sala</h2>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="Nome da sala"
                        className="modal-input"
                        required
                    />
                    <div className="modal-checkbox">
                        <input
                            type="checkbox"
                            id="private-room-checkbox"
                            checked={isPrivate}
                            onChange={(e) => setIsPrivate(e.target.checked)}
                        />
                        <label htmlFor="private-room-checkbox">Sala Privada (apenas por convite)</label>
                    </div>
                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="modal-button secondary">Cancelar</button>
                        <button type="submit" className="modal-button primary">Criar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const JoinRoomModal = ({ onClose, onJoin }) => {
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (inviteCode.trim()) {
            const success = await onJoin(inviteCode.trim());
            if (!success) {
                setError('Código de convite inválido ou expirado.');
            }
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Entrar com Código</h2>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="Insira o código de convite"
                        className="modal-input"
                        required
                    />
                    {error && <p className="modal-error">{error}</p>}
                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="modal-button secondary">Cancelar</button>
                        <button type="submit" className="modal-button primary">Entrar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const InviteCodeModal = ({ code, onClose }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Código de Convite</h2>
                <p className="invite-code-description">Compartilhe este código para convidar outros para esta sala.</p>
                <div className="invite-code-display" onClick={handleCopy}>
                    <span>{code}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zM-1 7a.5.5 0 0 1 .5-.5h15a.5.5 0 0 1 0 1h-15a.5.5 0 0 1-.5-.5z"/></svg>
                </div>
                 {copied && <p className="copy-success-message">Copiado!</p>}
                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="modal-button primary">Fechar</button>
                </div>
            </div>
        </div>
    );
};

const DiscoverRoomsModal = ({ allPublicRooms, isLoading, joinedRoomIds, onJoin, onClose }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content discover-modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Descobrir Salas Públicas</h2>
                <ul className="discover-room-list">
                    {isLoading ? (
                        <p className="loading-message">Carregando detalhes das salas...</p>
                    ) : allPublicRooms.length > 0 ? allPublicRooms.map(room => {
                        const isJoined = joinedRoomIds.includes(room.id);
                        return (
                            <li key={room.id} className="discover-room-item">
                                <div className="discover-room-info">
                                    <span className="discover-room-name"># {room.name}</span>
                                    {room.description && <p className="discover-room-description">{room.description}</p>}
                                    <div className="discover-room-meta">
                                        <span className="user-count">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
                                                <path fillRule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
                                            </svg>
                                            {room.userCount || 0} online
                                        </span>
                                        {room.creatorName && (
                                            <span className="creator-info">
                                                Criado por: {room.creatorName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => onJoin(room.id)}
                                    disabled={isJoined}
                                    className="discover-join-button"
                                >
                                    {isJoined ? 'Entrou' : 'Entrar'}
                                </button>
                            </li>
                        );
                    }) : <p className="no-rooms-message">Nenhuma sala pública para descobrir.</p>}
                </ul>
                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="modal-button primary">Fechar</button>
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
                <span key={currentStatus} className="status-indicator" style={{ backgroundColor: status.color }}></span>
                <div className="status-selector-user-info">
                    <span className="status-selector-username">{user.displayName}</span>
                    <span className="status-selector-status-text">{status.text}</span>
                </div>
            </div>
        </div>
    );
};

const ImageModal = ({ imageUrl, onClose }) => (
    <div className="image-modal-overlay" onClick={onClose}>
        <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={imageUrl} alt="Visualização em tela cheia" className="full-image" />
            <button onClick={onClose} className="close-button image-modal-close-button">&times;</button>
        </div>
    </div>
);

const IncomingCallModal = ({ caller, onAccept, onDecline }) => (
    <div className="call-modal-overlay">
        <div className="call-modal-content">
            <h3>Chamada de Vídeo Recebida</h3>
            <p><strong>{caller}</strong> está te ligando.</p>
            <div className="call-modal-actions">
                <button onClick={onDecline} className="call-decline-button">Recusar</button>
                <button onClick={onAccept} className="call-accept-button">Aceitar</button>
            </div>
        </div>
    </div>
);

const CallView = ({ onEndCall, localStream, remoteStream, isMuted, isCameraOff, toggleMute, toggleCamera, isScreenSharing, toggleScreenShare }) => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    return (
        <div className="call-view-container">
            <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
            <video ref={localVideoRef} className="local-video" autoPlay playsInline muted />
            <div className="call-controls">
                <button onClick={toggleMute} className={`call-control-button ${isMuted ? 'active' : ''}`}>
                    {isMuted ? 'Ativar Som' : 'Silenciar'}
                </button>
                <button onClick={toggleCamera} className={`call-control-button ${isCameraOff ? 'active' : ''}`}>
                    {isCameraOff ? 'Ligar Câmera' : 'Desligar Câmera'}
                </button>
                <button onClick={toggleScreenShare} className={`call-control-button ${isScreenSharing ? 'active' : ''}`}>
                    {isScreenSharing ? 'Parar Apresentação' : 'Apresentar Tela'}
                </button>
                <button onClick={onEndCall} className="call-control-button end-call">
                    Encerrar
                </button>
            </div>
        </div>
    );
};

const RoomContextMenu = ({ x, y, room, user, onClose, onRename, onLeave, onDelete }) => {
    const menuRef = useRef(null);
    const isCreator = user.uid === room.creator;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    return (
        <div ref={menuRef} className="context-menu" style={{ top: y, left: x }}>
            <ul>
                {isCreator && (
                    <li onClick={() => { onRename(room.id, room.name); onClose(); }}>Renomear Sala</li>
                )}
                <li onClick={() => { onLeave(room.id); onClose(); }}>Sair da Sala</li>
                {isCreator && room.id !== 'general' && ( // Prevent deleting the general room
                    <li className="destructive" onClick={() => { onDelete(room.id); onClose(); }}>Excluir Sala</li>
                )}
            </ul>
        </div>
    );
};

const Chat = ({ user }) => {
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [allPublicRooms, setAllPublicRooms] = useState([]);
  const [joinedPublicRooms, setJoinedPublicRooms] = useState([]);
  const [privateRooms, setPrivateRooms] = useState([]);
  const [privateChats, setPrivateChats] = useState([]);
  const [partnerStatuses, setPartnerStatuses] = useState({});
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [myStatus, setMyStatus] = useState('available');
  const [currentMessage, setCurrentMessage] = useState('');
  const [viewingProfile, setViewingProfile] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const [imageToSend, setImageToSend] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  
  // Modals state
  const [isCreateRoomModalOpen, setCreateRoomModalOpen] = useState(false);
  const [isJoinRoomModalOpen, setJoinRoomModalOpen] = useState(false);
  const [isInviteCodeModalOpen, setInviteCodeModalOpen] = useState(false);
  const [generatedInviteCode, setGeneratedInviteCode] = useState('');
  const [isDiscoverModalOpen, setDiscoverModalOpen] = useState(false);
  const [enrichedPublicRooms, setEnrichedPublicRooms] = useState([]);
  const [isEnrichingRooms, setIsEnrichingRooms] = useState(false);

  // Sidebar sections state
  const [isPublicRoomsOpen, setPublicRoomsOpen] = useState(true);
  const [isPrivateRoomsOpen, setPrivateRoomsOpen] = useState(true);
  const [isDmsOpen, setDmsOpen] = useState(true);

  // User Search State
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; room: any; } | null>(null);

  // WebRTC State
  const [callState, setCallState] = useState('idle'); // idle, calling, ringing, connected
  const [incomingCall, setIncomingCall] = useState(null);
  const [callPartnerUid, setCallPartnerUid] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localDisplayStream, setLocalDisplayStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const messageListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mentionQueryRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const callSignalingRef = useRef(null);
  const callTimerRef = useRef(null);

  const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

    const ReactionPicker = ({ onSelect }) => (
        <div className="reaction-picker">
            {REACTION_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => onSelect(emoji)} className="reaction-button" title={emoji}>
                    {emoji}
                </button>
            ))}
        </div>
    );

    const ReactionsDisplay = ({ reactions, currentUserUid, onSelect }) => (
        <div className="reactions-container">
            {Object.entries(reactions).map(([emoji, users]) => {
                const userList = users ? Object.keys(users) : [];
                if (userList.length === 0) return null;
                const userHasReacted = userList.includes(currentUserUid);
                return (
                    <div 
                        key={emoji} 
                        className={`reaction-pill ${userHasReacted ? 'reacted' : ''}`}
                        onClick={() => onSelect(emoji)}
                        title={userList.length + ' reaction' + (userList.length > 1 ? 's' : '')}
                    >
                        <span>{emoji}</span>
                        <span>{userList.length}</span>
                    </div>
                );
            })}
        </div>
    );
  
  // One-time setup for public rooms
  useEffect(() => {
    const roomsRef = database.ref('rooms');
    roomsRef.child('general').once('value', snapshot => {
        if (!snapshot.exists()) {
            const updates = {};
            initialPublicRooms.forEach(room => {
                updates[room.id] = { ...room, type: 'public', creator: 'system' };
            });
            roomsRef.update(updates);
        }
    });
  }, []);

  useEffect(() => {
    database.ref(`users/${user.uid}/status`).once('value', (snapshot) => {
        setMyStatus(snapshot.val() || 'available');
    });
  }, [user.uid]);

  // Fetch ALL public rooms (for discover modal)
  useEffect(() => {
    const roomsRef = database.ref('rooms');
    const listener = roomsRef.orderByChild('type').equalTo('public').on('value', snapshot => {
        const data = snapshot.val();
        const roomList = data ? Object.values(data) : [];
        setAllPublicRooms(roomList);
    });
    return () => roomsRef.off('value', listener);
  }, []);
  
  // Fetch user's JOINED public rooms
  useEffect(() => {
    const userPublicRoomsRef = database.ref(`users/${user.uid}/publicRooms`);
    const listener = userPublicRoomsRef.on('value', async snapshot => {
        const roomIds = snapshot.val();
        if (roomIds) {
            const roomsData = await Promise.all(
                Object.keys(roomIds).map(async roomId => {
                    const roomSnapshot = await database.ref(`rooms/${roomId}`).once('value');
                    if (roomSnapshot.exists() && roomSnapshot.val().type === 'public') {
                        return { id: roomId, ...roomSnapshot.val() };
                    }
                    return null; // In case room was deleted
                })
            );
            setJoinedPublicRooms(roomsData.filter(Boolean));
        } else {
            setJoinedPublicRooms([]);
        }
    });
    return () => userPublicRoomsRef.off('value', listener);
  }, [user.uid]);


  // Fetch user's private rooms
  useEffect(() => {
    const userPrivateRoomsRef = database.ref(`users/${user.uid}/privateRooms`);
    const listener = userPrivateRoomsRef.on('value', async snapshot => {
        const roomIds = snapshot.val();
        if (roomIds) {
            const roomsData = await Promise.all(
                Object.keys(roomIds).map(async roomId => {
                    const roomSnapshot = await database.ref(`rooms/${roomId}`).once('value');
                    return { id: roomId, ...roomSnapshot.val() };
                })
            );
            setPrivateRooms(roomsData.filter(Boolean));
        } else {
            setPrivateRooms([]);
        }
    });
    return () => userPrivateRoomsRef.off('value', listener);
  }, [user.uid]);


  // Fetch private chats
  useEffect(() => {
    const privateChatsRef = database.ref(`users/${user.uid}/privateChats`);
    const listener = privateChatsRef.on('value', snapshot => {
        const data = snapshot.val();
        const chatList = data 
            ? Object.entries(data)
                .filter(([, details]) => details && typeof details === 'object')
                .map(([uid, details]) => ({ uid, ...(details as object) })) 
            : [];
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
      const loadedMessages = messagesData 
        ? Object.entries(messagesData)
            .filter(([, data]) => data && typeof data === 'object')
            .map(([id, data]) => ({ id, ...(data as object) })) 
        : [];
      setMessages(loadedMessages);
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
            if(partnerData && typeof partnerData === 'object') {
                setOnlineUsers([{uid: partnerUid, displayName: (partnerData as any).displayName, status: 'available'}]);
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

  // WebRTC Signaling Effect
  useEffect(() => {
      const myUid = user.uid;
      const signalingRef = database.ref('calls');

      const listener = signalingRef.on('value', snapshot => {
          const calls: Record<string, any> = snapshot.val() || {};
          Object.entries(calls).forEach(([callId, callData]) => {
              if (callData.target === myUid && callData.offer && callState === 'idle') {
                  setIncomingCall({ callId, from: callData.from, fromName: callData.fromName, offer: callData.offer });
                  setCallState('ringing');
              } else if (callId === callSignalingRef.current && callData.answer) {
                  peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(callData.answer))
                      .catch(e => console.error("Error setting remote description:", e));
              } else if (callId === callSignalingRef.current && callData.status === 'ended') {
                  handleEndCall(false);
              }
          });
      });
      return () => signalingRef.off('value', listener);
  }, [user.uid, callState]);

  // ICE Candidate listener
  useEffect(() => {
    if (!callSignalingRef.current || !callPartnerUid) return;

    const candidatesRef = database.ref(`calls/${callSignalingRef.current}/iceCandidates/${callPartnerUid}`);
    const listener = (snapshot: any) => {
        const candidate = snapshot.val();
        if (candidate && peerConnectionRef.current?.remoteDescription) {
            peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
                .catch(e => console.error("Error adding received ICE candidate:", e));
        }
    };
    candidatesRef.on('child_added', listener);

    return () => {
        candidatesRef.off('child_added', listener);
    };
}, [callPartnerUid]);


  // Scroll to bottom effect
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

    // User Search Effect
    useEffect(() => {
        const trimmedQuery = userSearchQuery.trim();
        if (trimmedQuery.length < 2) {
            setUserSearchResults([]);
            return;
        }

        setIsSearchLoading(true);
        const usersRef = database.ref('users');
        const query = usersRef.orderByChild('displayName')
                             .startAt(trimmedQuery)
                             .endAt(trimmedQuery + '\uf8ff')
                             .limitToFirst(10);

        const listener = query.on('value', async snapshot => {
            const data = snapshot.val();
            if (data) {
                const userPromises = Object.keys(data).map(async (uid) => {
                    if (uid === user.uid) return null;

                    const userObject = { uid, ...data[uid] };
                    const statusSnapshot = await database.ref(`status/${uid}`).once('value');
                    const statusData = statusSnapshot.val();
                    
                    userObject.isOnline = statusData?.state === 'online';
                    if (!userObject.status) {
                        userObject.status = statusData?.status || 'offline';
                    }
                    return userObject;
                });

                const enrichedUsers = (await Promise.all(userPromises)).filter(Boolean);
                setUserSearchResults(enrichedUsers);
            } else {
                setUserSearchResults([]);
            }
            setIsSearchLoading(false);
        });

        return () => query.off('value', listener);
    }, [userSearchQuery, user.uid]);
    
    // Call Duration Timer
    useEffect(() => {
        if (callState === 'connected') {
            callTimerRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(callTimerRef.current);
            setCallDuration(0);
        }
        return () => clearInterval(callTimerRef.current);
    }, [callState]);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const handleViewProfile = async (uid) => {
        if (!uid) return;
        try {
            const userSnapshot = await database.ref(`users/${uid}`).once('value');
            if (!userSnapshot.exists()) return;

            const userData = { uid, ...userSnapshot.val() };
            const statusSnapshot = await database.ref(`status/${uid}`).once('value');
            const statusData = statusSnapshot.val();

            userData.isOnline = statusData?.state === 'online';
            setViewingProfile(userData);
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }
    };
  
  const handleStopScreenShare = () => {
        if (!peerConnectionRef.current || !localStream) {
            return;
        }
        if (isScreenSharing && localDisplayStream) {
            localDisplayStream.getTracks().forEach(track => track.stop());
        }
        setLocalDisplayStream(localStream);
        const cameraTrack = localStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender && cameraTrack) {
            sender.replaceTrack(cameraTrack).catch(err => {
                console.error("Error replacing track back to camera:", err);
            });
        }
        setIsScreenSharing(false);
  };
  
  const toggleScreenShare = async () => {
        if (isScreenSharing) {
            handleStopScreenShare();
        } else {
            if (!peerConnectionRef.current) return;
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = screenStream.getVideoTracks()[0];
                const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');

                if (sender) {
                    await sender.replaceTrack(screenTrack);
                    setLocalDisplayStream(screenStream);
                    setIsScreenSharing(true);
                }

                screenTrack.onended = () => {
                    handleStopScreenShare();
                };
            } catch (err) {
                console.error("Error starting screen share:", err);
            }
        }
    };
    
    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(prev => !prev);
        }
    };

    const toggleCamera = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsCameraOff(prev => !prev);
        }
    };

    const setupPeerConnection = (stream) => {
        const pc = new RTCPeerConnection(peerConnectionConfig);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
            if (event.candidate && callSignalingRef.current) {
                database.ref(`calls/${callSignalingRef.current}/iceCandidates/${user.uid}`).push(event.candidate.toJSON());
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };
        
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                setCallState('connected');
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                handleEndCall(false);
            }
        };

        return pc;
    };
    
    const handleStartVideoCall = async (targetUser) => {
        if (!targetUser || callState !== 'idle') return;
        
        setCallPartnerUid(targetUser.uid);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            setLocalDisplayStream(stream);

            peerConnectionRef.current = setupPeerConnection(stream);
            
            const callId = database.ref('calls').push().key;
            callSignalingRef.current = callId;
            
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);

            await database.ref(`calls/${callId}`).set({
                from: user.uid,
                fromName: user.displayName,
                target: targetUser.uid,
                offer: offer.toJSON(),
                status: 'calling',
            });

            setCallState('calling');
            setViewingProfile(null);

        } catch (error) {
            console.error("Error starting video call:", error);
            // Reset state on error
            setCallState('idle');
            setCallPartnerUid(null);
        }
    };
    
    const handleAcceptCall = async () => {
        if (!incomingCall) return;

        setCallPartnerUid(incomingCall.from);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            setLocalDisplayStream(stream);

            peerConnectionRef.current = setupPeerConnection(stream);

            callSignalingRef.current = incomingCall.callId;

            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);

            await database.ref(`calls/${incomingCall.callId}`).update({
                answer: answer.toJSON(),
                status: 'connected',
            });

            setCallState('connected');
            setIncomingCall(null);
        } catch (error) {
            console.error("Error accepting call:", error);
        }
    };
    
    const handleDeclineCall = async () => {
        if (incomingCall) {
            await database.ref(`calls/${incomingCall.callId}`).update({ status: 'declined' });
        }
        setIncomingCall(null);
        setCallState('idle');
    };

    const handleEndCall = (isInitiator = true) => {
        if (isInitiator && callSignalingRef.current) {
            database.ref(`calls/${callSignalingRef.current}`).update({ status: 'ended' });
        }
        
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        
        localStream?.getTracks().forEach(track => track.stop());
        localDisplayStream?.getTracks().forEach(track => track.stop());
        
        setLocalStream(null);
        setRemoteStream(null);
        setLocalDisplayStream(null);
        setCallState('idle');
        setIncomingCall(null);
        setCallPartnerUid(null);
        callSignalingRef.current = null;
        setIsMuted(false);
        setIsCameraOff(false);
        setIsScreenSharing(false);
    };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!currentMessage.trim() && !imageToSend) return;

    // FIX: Explicitly type messageData as 'any' to allow adding the 'imageUrl' property dynamically.
    const messageData: any = {
      text: currentMessage,
      sender: user.displayName,
      uid: user.uid,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };
    
    const isPrivate = activeRoomId.startsWith('private_');
    const messagePath = isPrivate ? `private_messages/${activeRoomId}` : `messages/${activeRoomId}`;
    const messagesRef = database.ref(messagePath);

    if (imageToSend) {
        setIsUploading(true);
        const filePath = `images/${activeRoomId}/${new Date().getTime()}-${imageToSend.name}`;
        const storageRef = storage.ref(filePath);
        const uploadTask = storageRef.put(imageToSend);

        uploadTask.on(
            'state_changed',
            null,
            (error) => {
                console.error('Upload failed:', error);
                setIsUploading(false);
            },
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    messageData.imageUrl = downloadURL;
                    messagesRef.push(messageData);
                    setImageToSend(null);
                    setImagePreviewUrl('');
                    setIsUploading(false);
                });
            }
        );
    } else {
        messagesRef.push(messageData);
    }

    setCurrentMessage('');
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      database.ref(`typing/${activeRoomId}/${user.uid}`).remove();
    }
  };

  const handleInputChange = (e) => {
    setCurrentMessage(e.target.value);

    const isPrivate = activeRoomId && activeRoomId.startsWith('private_');
    const typingRef = database.ref(`typing/${activeRoomId}/${user.uid}`);
    
    if (e.target.value.trim().length > 0) {
      typingRef.set({ displayName: user.displayName });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        typingRef.remove();
        typingTimeoutRef.current = null;
      }, 3000);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingRef.remove();
    }
  };
  
    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageToSend(file);
            setImagePreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleReaction = (messageId, emoji) => {
        if (!messageId) return;
        const isPrivate = activeRoomId.startsWith('private_');
        const messagePath = isPrivate ? `private_messages/${activeRoomId}` : `messages/${activeRoomId}`;
        const reactionRef = database.ref(`${messagePath}/${messageId}/reactions/${emoji}/${user.uid}`);

        reactionRef.once('value', snapshot => {
            if (snapshot.exists()) {
                reactionRef.remove();
            } else {
                reactionRef.set(true);
            }
        });
        setHoveredMessageId(null);
    };

    const handleStartPrivateChat = async (targetUser) => {
        const chatId = user.uid < targetUser.uid 
            ? `private_${user.uid}_${targetUser.uid}` 
            : `private_${targetUser.uid}_${user.uid}`;
        
        const currentUserChatRef = database.ref(`users/${user.uid}/privateChats/${targetUser.uid}`);
        const targetUserChatRef = database.ref(`users/${targetUser.uid}/privateChats/${user.uid}`);

        await currentUserChatRef.update({
            displayName: targetUser.displayName,
            uid: targetUser.uid,
        });

        await targetUserChatRef.update({
            displayName: user.displayName,
            uid: user.uid,
        });
        
        setActiveRoomId(chatId);
        setViewingProfile(null); // Close profile modal after starting chat
    };
    
    const handleCreateRoom = async (name, isPrivate) => {
      const newRoomRef = database.ref('rooms').push();
      const newRoomId = newRoomRef.key;
      const newRoom = {
          id: newRoomId,
          name,
          type: isPrivate ? 'private' : 'public',
          creator: user.uid,
          createdAt: firebase.database.ServerValue.TIMESTAMP
      };

      const updates = {};
      updates[`/rooms/${newRoomId}`] = newRoom;
      const roomTypeKey = isPrivate ? 'privateRooms' : 'publicRooms';
      updates[`/users/${user.uid}/${roomTypeKey}/${newRoomId}`] = true;

      if (isPrivate) {
          const code = Math.random().toString(36).substring(2, 8).toUpperCase();
          updates[`/invites/${code}`] = { roomId: newRoomId, creator: user.uid };
          setGeneratedInviteCode(code);
          setInviteCodeModalOpen(true);
      }

      await database.ref().update(updates);
      setCreateRoomModalOpen(false);
      setActiveRoomId(newRoomId);
    };

    const handleJoinRoomByCode = async (code) => {
      const inviteRef = database.ref(`invites/${code}`);
      const snapshot = await inviteRef.once('value');
      if (snapshot.exists()) {
          const { roomId } = snapshot.val();
          const roomRef = database.ref(`rooms/${roomId}`);
          const roomSnapshot = await roomRef.once('value');
          if(roomSnapshot.exists()) {
             const roomTypeKey = roomSnapshot.val().type === 'private' ? 'privateRooms' : 'publicRooms';
             await database.ref(`users/${user.uid}/${roomTypeKey}/${roomId}`).set(true);
             setJoinRoomModalOpen(false);
             setActiveRoomId(roomId);
             return true;
          }
      }
      return false;
    };

    const handleJoinPublicRoomFromDiscover = async (roomId) => {
      await database.ref(`users/${user.uid}/publicRooms/${roomId}`).set(true);
      setActiveRoomId(roomId);
    };
  
  if (callState === 'connected' || callState === 'calling') {
    return <CallView 
                onEndCall={handleEndCall}
                localStream={localDisplayStream}
                remoteStream={remoteStream}
                isMuted={isMuted}
                isCameraOff={isCameraOff}
                toggleMute={toggleMute}
                toggleCamera={toggleCamera}
                isScreenSharing={isScreenSharing}
                toggleScreenShare={toggleScreenShare}
            />;
  }

  return (
    <div className="app-container">
      {isCreateRoomModalOpen && <CreateRoomModal onClose={() => setCreateRoomModalOpen(false)} onCreate={handleCreateRoom} />}
      {isJoinRoomModalOpen && <JoinRoomModal onClose={() => setJoinRoomModalOpen(false)} onJoin={handleJoinRoomByCode} />}
      {isInviteCodeModalOpen && <InviteCodeModal code={generatedInviteCode} onClose={() => setInviteCodeModalOpen(false)} />}
      {isDiscoverModalOpen && 
        <DiscoverRoomsModal 
            allPublicRooms={allPublicRooms}
            isLoading={isEnrichingRooms}
            joinedRoomIds={joinedPublicRooms.map(r => r.id)}
            onJoin={handleJoinPublicRoomFromDiscover}
            onClose={() => setDiscoverModalOpen(false)}
        />}
      {incomingCall && (
        <IncomingCallModal
          caller={incomingCall.fromName}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}
      {viewingProfile && (
        <UserProfileModal 
            user={viewingProfile} 
            currentUser={user}
            onClose={() => setViewingProfile(null)}
            onStartChat={handleStartPrivateChat}
            onStartVideoCall={handleStartVideoCall}
        />
      )}
      <div className="sidebar">
        <div>
          <div className="sidebar-header">
            <span>Chat</span>
            <button onClick={() => auth.signOut()} className="logout-button">Sair</button>
          </div>
          <div className="sidebar-actions">
             <button onClick={() => setCreateRoomModalOpen(true)} className="sidebar-action-button">Criar Sala</button>
             <button onClick={() => setJoinRoomModalOpen(true)} className="sidebar-action-button">Entrar com Código</button>
             <button onClick={() => setDiscoverModalOpen(true)} className="sidebar-action-button">Descobrir Salas</button>
          </div>
          <div className="user-search-container">
            <input
                type="search"
                placeholder="Buscar usuários..."
                className="user-search-input"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                aria-label="Buscar usuários"
            />
            {userSearchQuery.length >= 2 && (
                <div className="user-search-results">
                    {isSearchLoading && <div className="user-search-item loading">Buscando...</div>}
                    {!isSearchLoading && userSearchResults.length === 0 && (
                        <div className="user-search-item not-found">Nenhum usuário encontrado.</div>
                    )}
                    {!isSearchLoading && userSearchResults.map(foundUser => (
                        <div
                            key={foundUser.uid}
                            className="user-search-item"
                            onClick={() => {
                                setViewingProfile(foundUser);
                                setUserSearchQuery('');
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                   setViewingProfile(foundUser);
                                   setUserSearchQuery('');
                                }
                            }}
                        >
                            {foundUser.displayName}
                        </div>
                    ))}
                </div>
            )}
          </div>
          
            <div className="sidebar-section-header" onClick={() => setPublicRoomsOpen(!isPublicRoomsOpen)}>
                <h4>Canais Públicos</h4>
                 <svg className={`section-toggle-icon ${!isPublicRoomsOpen ? 'collapsed' : ''}`} xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z" transform="rotate(90 8 8) translate(0 4)"/></svg>
            </div>
             <ul className={`room-list ${!isPublicRoomsOpen ? 'collapsed' : ''}`}>
                {joinedPublicRooms.map(room => (
                  <li key={room.id} className={`room-item joined ${activeRoomId === room.id ? 'active' : ''}`} onClick={() => setActiveRoomId(room.id)}>
                    <div className="room-name-wrapper">
                         <svg className="room-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8.38 5.68a.5.5 0 0 1 .64-.02l.01.02A3.5 3.5 0 0 1 12.5 9V5.5a.5.5 0 0 1 1 0V9a4.5 4.5 0 0 1-4.5 4.5h-.01a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h.01a3.5 3.5 0 0 1 3.5-3.5H12a.5.5 0 0 1 0-1H9.03a.5.5 0 0 1-.64.02l-.01-.02zm-5.32-1a.5.5 0 0 1-.02.64l.02.01A3.5 3.5 0 0 1 3.5 7H7a.5.5 0 0 1 0 1H3.5a4.5 4.5 0 0 1-4.5-4.5v-.01a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v.01a3.5 3.5 0 0 1 3.5 3.5h.01a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-.01A4.5 4.5 0 0 1 3.5 7V3.5a.5.5 0 0 1 1 0V7a3.5 3.5 0 0 1-3.5-3.5h-.01a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h.01a4.5 4.5 0 0 1 4.5 4.5zm-2.06 6.52a.5.5 0 0 1 .64-.02l.01.02a3.5 3.5 0 0 1 3.45 3.45h.01a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-.01a4.5 4.5 0 0 1-4.5-4.5v-.01a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v.01a3.5 3.5 0 0 1 3.5 3.5zm7.38-3.98a.5.5 0 0 1 .02.64l-.02.01a3.5 3.5 0 0 1-3.45-3.45h-.01a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h.01a4.5 4.5 0 0 1 4.5 4.5v.01a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-.01a3.5 3.5 0 0 1-3.5-3.5z"/></svg>
                        <span className="room-name">{room.name}</span>
                    </div>
                  </li>
                ))}
              </ul>

            <div className="sidebar-section-header" onClick={() => setPrivateRoomsOpen(!isPrivateRoomsOpen)}>
                <h4>Salas Privadas</h4>
                <svg className={`section-toggle-icon ${!isPrivateRoomsOpen ? 'collapsed' : ''}`} xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z" transform="rotate(90 8 8) translate(0 4)"/></svg>
            </div>
            <ul className={`room-list ${!isPrivateRoomsOpen ? 'collapsed' : ''}`}>
                {privateRooms.map(room => (
                  <li key={room.id} className={`room-item joined ${activeRoomId === room.id ? 'active' : ''}`} onClick={() => setActiveRoomId(room.id)}>
                    <div className="room-name-wrapper">
                        <svg className="room-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
                        <span className="room-name">{room.name}</span>
                    </div>
                  </li>
                ))}
            </ul>

            <div className="sidebar-section-header" onClick={() => setDmsOpen(!isDmsOpen)}>
                <h4>Conversas</h4>
                <svg className={`section-toggle-icon ${!isDmsOpen ? 'collapsed' : ''}`} xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z" transform="rotate(90 8 8) translate(0 4)"/></svg>
            </div>
            <ul className={`room-list ${!isDmsOpen ? 'collapsed' : ''}`}>
                {privateChats.map(chat => {
                    const chatId = user.uid < chat.uid 
                        ? `private_${user.uid}_${chat.uid}` 
                        : `private_${chat.uid}_${user.uid}`;
                    const partnerStatus = partnerStatuses[chat.uid] || { state: 'offline' };
                    return (
                        <li key={chat.uid} className={`room-item joined ${activeRoomId === chatId ? 'active' : ''}`} onClick={() => setActiveRoomId(chatId)}>
                            <div className="room-name-wrapper">
                                <span 
                                    className="status-indicator room-icon" 
                                    style={{ 
                                        backgroundColor: partnerStatus.state === 'online' ? '#28a745' : '#6c757d',
                                    }}
                                    title={partnerStatus.state === 'online' ? 'Online' : 'Offline'}
                                ></span>
                                <span className="room-name">{chat.displayName}</span>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
        <StatusSelector user={user} currentStatus={myStatus} onStatusChange={() => {}} />
      </div>
      <div className="main-content">
        {activeRoomId ? (
          <>
            <div className="chat-header">
                <h2>{activeRoomId}</h2>
                <button className="video-call-button" onClick={() => handleStartVideoCall(onlineUsers.find(u => u.uid !== user.uid))}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738L14.396 5.2a.5.5 0 0 1 .604.604l-1.464 2.928a.5.5 0 0 1-.604-.604l1.103-2.206a1 1 0 0 0-.992-.862H2a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1.5a.5.5 0 0 1 0 1H2a2 2 0 0 1-2-2V5zm11.5 5.175V14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3.825a.5.5 0 0 1 .943-.24l.435.87a.5.5 0 0 1-.443.745H2.5a.5.5 0 0 1 0-1H4a.5.5 0 0 1 .443.255l.435.87a.5.5 0 0 1-.443.745H4.5a.5.5 0 0 1 0-1H6a.5.5 0 0 1 .443.255l.435.87a.5.5 0 0 1-.443.745H6.5a.5.5 0 0 1 0-1H8a.5.5 0 0 1 .443.255l.435.87a.5.5 0 0 1-.443.745H8.5a.5.5 0 0 1 0-1h1.443a.5.5 0 0 1 .443.745l.435-.87a.5.5 0 0 1 .943.24z"/></svg>
                </button>
            </div>
            <ul className="message-list" ref={messageListRef}>
              {messages.map(message => (
                <li key={message.id} 
                    className={`message-wrapper ${message.uid === user.uid ? 'mine' : 'theirs'}`}
                    onMouseEnter={() => setHoveredMessageId(message.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                >
                    {message.uid !== user.uid && <span className="message-sender" onClick={() => handleViewProfile(message.uid)}>{message.sender}</span>}
                    <div className="message-content-wrapper">
                        <div className="message">
                            {message.imageUrl && (
                                <img src={message.imageUrl} alt="Uploaded content" className="message-image" onClick={() => setViewingImage(message.imageUrl)} />
                            )}
                            {message.text && <p className="message-text">{message.text}</p>}
                            <span className="message-timestamp">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                             {message.reactions && <ReactionsDisplay reactions={message.reactions} currentUserUid={user.uid} onSelect={(emoji) => handleReaction(message.id, emoji)} />}
                        </div>
                         {hoveredMessageId === message.id && <ReactionPicker onSelect={(emoji) => handleReaction(message.id, emoji)} />}
                    </div>
                </li>
              ))}
            </ul>
            <div className="typing-indicator">{typingUsers.length > 0 && `${typingUsers.join(', ')} is typing...`}</div>
            <form className="message-form" onSubmit={handleSendMessage}>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*" />
               <button type="button" className="attach-button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0V3z"/></svg>
                </button>
              <input type="text" value={currentMessage} onChange={handleInputChange} className="message-input" placeholder="Digite uma mensagem..." />
              <button type="submit" className="send-button" disabled={(!currentMessage.trim() && !imageToSend) || isUploading}>{isUploading ? 'Enviando...' : 'Enviar'}</button>
            </form>
          </>
        ) : (
          <div className="welcome-screen">
            <h2>Bem-vindo ao Chat!</h2>
            <p>Selecione uma sala para começar a conversar.</p>
          </div>
        )}
      </div>
    </div>
  );
};


const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [consentGiven, setConsentGiven] = useState(() => localStorage.getItem('chat_consent') === 'true');

  useEffect(() => {
     // Check if the config is just placeholders
    const isPlaceholder = (
      firebaseConfig.apiKey === "YOUR_API_key" ||
      firebaseConfig.authDomain === "YOUR_PROJECT_ID.firebaseapp.com" ||
      firebaseConfig.databaseURL === "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com" ||
      firebaseConfig.projectId === "YOUR_PROJECT_ID"
    );
    setIsConfigured(!isPlaceholder);

    const unsubscribe = auth.onAuthStateChanged(user => {
        if (user) {
            const userRef = database.ref(`users/${user.uid}`);
            userRef.once('value', snapshot => {
                const userData = snapshot.val();
                if (userData) {
                    setUser({ uid: user.uid, ...userData });
                } else {
                    // This case handles Google sign-in for users who don't have a DB entry yet
                    const newUser = {
                        uid: user.uid,
                        displayName: user.displayName,
                        email: user.email,
                        status: 'available',
                        publicRooms: { 'general': true }
                    };
                    userRef.set(newUser);
                    setUser(newUser);
                }
            });
        } else {
            setUser(null);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const myStatusRef = database.ref(`status/${user.uid}`);
    myStatusRef.set({ state: 'online', status: 'available' });

    const onOffline = { state: 'offline', last_changed: firebase.database.ServerValue.TIMESTAMP };
    myStatusRef.onDisconnect().set(onOffline);

    const connectedRef = database.ref('.info/connected');
    const listener = connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            myStatusRef.set({ state: 'online', status: 'available' });
        }
    });

    return () => {
        myStatusRef.set(onOffline);
        connectedRef.off('value', listener);
    };
  }, [user]);

  const handleConsent = () => {
    localStorage.setItem('chat_consent', 'true');
    setConsentGiven(true);
  };

  if (!isConfigured) {
    return <ConfigWarning />;
  }
  
  if (loading) {
    return <div className="loading-screen">Carregando...</div>;
  }
  
  if (!user) {
      return <AuthScreen />;
  }
  
  if (!consentGiven) {
    return <PrivacyConsentModal onAccept={handleConsent} />;
  }

  return <Chat user={user} />;
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);