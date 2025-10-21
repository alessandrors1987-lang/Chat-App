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
    { urls: 'stun:stun1.l.google.com:19302' },
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
                        <span key={statusKey} className="status-indicator" style={{ backgroundColor: status.color }}></span>
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

const CallView = ({ onEndCall, localStream, remoteStream, isMuted, isCameraOff, toggleMute, toggleCamera }) => {
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
                <button onClick={onEndCall} className="call-control-button end-call">
                    Encerrar
                </button>
            </div>
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
  
  // Modals state
  const [isCreateRoomModalOpen, setCreateRoomModalOpen] = useState(false);
  const [isJoinRoomModalOpen, setJoinRoomModalOpen] = useState(false);
  const [isInviteCodeModalOpen, setInviteCodeModalOpen] = useState(false);
  const [isDiscoverModalOpen, setDiscoverModalOpen] = useState(false);
  const [enrichedPublicRooms, setEnrichedPublicRooms] = useState([]);
  const [isEnrichingRooms, setIsEnrichingRooms] = useState(false);

  // User Search State
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);


  // WebRTC State
  const [callState, setCallState] = useState('idle'); // idle, calling, ringing, connected
  const [incomingCall, setIncomingCall] = useState(null);
  const [callPartnerUid, setCallPartnerUid] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const messageListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mentionQueryRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const callSignalingRef = useRef(null);
  
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
                             .limitToFirst(10); // Limit results for performance

        const listener = query.on('value', snapshot => {
            const results = [];
            const data = snapshot.val();
            if (data) {
                for (const uid in data) {
                    if (uid !== user.uid) { // Exclude current user from results
                        results.push({ uid, ...data[uid] });
                    }
                }
            }
            setUserSearchResults(results);
            setIsSearchLoading(false);
        });

        return () => query.off('value', listener);
    }, [userSearchQuery, user.uid]);

  const cleanupCall = () => {
      localStream?.getTracks().forEach(track => track.stop());
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      setLocalStream(null);
      setRemoteStream(null);
      setCallState('idle');
      setIncomingCall(null);
      setCallPartnerUid(null);
      if (callSignalingRef.current) {
          database.ref(`calls/${callSignalingRef.current}`).remove();
          callSignalingRef.current = null;
      }
  };

  const createPeerConnection = (callId: string, stream: MediaStream) => {
      const pc = new RTCPeerConnection(peerConnectionConfig);
      pc.onicecandidate = event => {
          if (event.candidate) {
              database.ref(`calls/${callId}/iceCandidates/${user.uid}`).push(event.candidate.toJSON());
          }
      };
      pc.ontrack = event => {
          setRemoteStream(event.streams[0]);
      };
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      return pc;
  };
  
  const handleStartCall = async () => {
      const partnerUid = activeRoomId.replace('private_', '').replace(user.uid, '').replace('_','');
      if (!partnerUid) return;

      setCallPartnerUid(partnerUid);
      setCallState('calling');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);

        const callId = `call_${user.uid}_${partnerUid}`;
        callSignalingRef.current = callId;
        peerConnectionRef.current = createPeerConnection(callId, stream);

        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);

        const callData = {
            offer: offer.toJSON(),
            from: user.uid,
            fromName: user.displayName,
            target: partnerUid
        };
        await database.ref(`calls/${callId}`).set(callData);
        setCallState('connected');
      } catch (err) {
        console.error("Error starting call:", err);
        alert("Não foi possível iniciar a chamada. Verifique as permissões da câmera/microfone e tente novamente.");
        cleanupCall();
      }
  };

  const handleAnswerCall = async () => {
      if (!incomingCall) return;
      
      setCallPartnerUid(incomingCall.from);
      setCallState('connecting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);

        callSignalingRef.current = incomingCall.callId;
        peerConnectionRef.current = createPeerConnection(incomingCall.callId, stream);

        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        await database.ref(`calls/${incomingCall.callId}`).update({ answer: answer.toJSON() });
        setCallState('connected');
        setIncomingCall(null);
      } catch (err) {
        console.error("Error answering call:", err);
        alert("Não foi possível atender a chamada. Verifique as permissões da câmera/microfone e tente novamente.");
        cleanupCall();
      }
  };
  
  const handleDeclineCall = () => {
      if (incomingCall) {
          database.ref(`calls/${incomingCall.callId}`).update({ status: 'ended' });
      }
      cleanupCall();
  };

  const handleEndCall = (notify = true) => {
      if (notify && callSignalingRef.current) {
          database.ref(`calls/${callSignalingRef.current}`).update({ status: 'ended' });
      }
      cleanupCall();
  };

  const toggleMute = () => {
      if (localStream) {
          localStream.getAudioTracks()[0].enabled = !isMuted;
          setIsMuted(!isMuted);
      }
  };

  const toggleCamera = () => {
      if (localStream) {
          localStream.getVideoTracks()[0].enabled = !isCameraOff;
          setIsCameraOff(!isCameraOff);
      }
  };

  const handleRoomSelect = (roomId) => {
    if (roomId === activeRoomId) return;
    setMessages([]);
    setTypingUsers([]);
    setActiveRoomId(roomId);
  };
  
  const handleCreateRoom = async (name: string, isPrivate: boolean) => {
    const newRoomRef = database.ref('rooms').push();
    const newRoomId = newRoomRef.key;
    
    const newRoomData: any = {
        id: newRoomId,
        name: name,
        type: isPrivate ? 'private' : 'public',
        creator: user.uid,
    };
    
    if (isPrivate) {
        newRoomData.inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await database.ref(`users/${user.uid}/privateRooms/${newRoomId}`).set(true);
    } else {
        await database.ref(`users/${user.uid}/publicRooms/${newRoomId}`).set(true);
    }
    
    await newRoomRef.set(newRoomData);
    
    handleRoomSelect(newRoomId);
    setCreateRoomModalOpen(false);
  };
  
  const handleJoinRoomWithCode = async (code: string) => {
      const roomsRef = database.ref('rooms');
      const snapshot = await roomsRef.orderByChild('inviteCode').equalTo(code).limitToFirst(1).once('value');
      
      if (snapshot.exists()) {
          const [roomId, roomData] = Object.entries(snapshot.val())[0];
          await database.ref(`users/${user.uid}/privateRooms/${roomId}`).set(true);
          handleRoomSelect(roomId);
          setJoinRoomModalOpen(false);
          return true;
      }
      return false;
  };
  
  const handleJoinPublicRoom = (roomId) => {
      database.ref(`users/${user.uid}/publicRooms/${roomId}`).set(true);
  };

  const handleLeavePublicRoom = (roomId: string) => {
    if (window.confirm("Tem certeza de que deseja sair desta sala pública?")) {
        database.ref(`users/${user.uid}/publicRooms/${roomId}`).remove();
        if (activeRoomId === roomId) {
            setActiveRoomId(null);
        }
    }
  };


  const handleLeavePrivateRoom = (roomId: string) => {
    if (window.confirm("Tem certeza de que deseja sair desta sala privada?")) {
        database.ref(`users/${user.uid}/privateRooms/${roomId}`).remove();
        if (activeRoomId === roomId) {
            setActiveRoomId(null);
        }
    }
  };

  const handleLeavePrivateChat = async (e, partnerId, partnerName) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza de que deseja remover a conversa com ${partnerName}? Esta ação removerá a conversa para ambos os usuários e não pode ser desfeita.`)) {
        const myUid = user.uid;
        try {
            await database.ref(`users/${myUid}/privateChats/${partnerId}`).remove();
            await database.ref(`users/${partnerId}/privateChats/${myUid}`).remove();
    
            const privateRoomId = `private_${[myUid, partnerId].sort().join('_')}`;
            if (activeRoomId === privateRoomId) {
                setActiveRoomId(null);
            }
        } catch (error) {
            console.error("Error leaving private chat:", error);
            alert("Não foi possível remover a conversa. Tente novamente.");
        }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((currentMessage.trim() === '' && !imageToSend) || !activeRoomId || isUploading) return;

    setIsUploading(true);

    let imageUrl = null;
    if (imageToSend) {
        try {
            const filePath = `chat_images/${activeRoomId}/${user.uid}_${Date.now()}_${imageToSend.name}`;
            const fileRef = storage.ref(filePath);
            const uploadTask = await fileRef.put(imageToSend);
            imageUrl = await uploadTask.ref.getDownloadURL();
        } catch (error) {
            console.error("Erro ao enviar imagem:", error);
            setIsUploading(false);
            return;
        }
    }

    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
    }
    database.ref(`typing/${activeRoomId}/${user.uid}`).remove();

    const isPrivateChat = activeRoomId.startsWith('private_');
    const messagePath = isPrivateChat ? `private_messages/${activeRoomId}` : `messages/${activeRoomId}`;
    const roomMessagesRef = database.ref(messagePath);

    const newMessage = {
      text: currentMessage,
      senderId: user.uid,
      senderName: user.displayName || user.email,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      imageUrl: imageUrl
    };

    roomMessagesRef.push(newMessage);

    // Handle notifications for mentions
    const currentActiveRoom = [...joinedPublicRooms, ...privateRooms].find(r => r.id === activeRoomId);
    const mentionedUsers = onlineUsers.filter(u => 
        currentMessage.includes(`@${u.displayName}`) && u.uid !== user.uid
    );

    mentionedUsers.forEach(mentionedUser => {
        database.ref(`notifications/${mentionedUser.uid}`).push({
            senderName: user.displayName,
            roomName: isPrivateChat ? `Direct Message` : currentActiveRoom?.name,
            roomId: activeRoomId,
            message: currentMessage,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            read: false,
        });
    });

    setCurrentMessage('');
    setImageToSend(null);
    setImagePreviewUrl('');
    setMentionSuggestions([]);
    setIsUploading(false);
  };

  const handleDeleteMessage = async (messageId) => {
    if (!activeRoomId || !messageId) return;

    if (window.confirm("Tem certeza de que deseja excluir esta mensagem?")) {
        const isPrivate = activeRoomId.startsWith('private_');
        const messagePath = isPrivate ? `private_messages/${activeRoomId}` : `messages/${activeRoomId}`;
        const messageRef = database.ref(`${messagePath}/${messageId}`);

        try {
            await messageRef.update({
                text: 'Esta mensagem foi excluída.',
                imageUrl: null, // Ensure image is removed
                deleted: true
            });
        } catch (error) {
            console.error("Error deleting message:", error);
            alert("Não foi possível excluir a mensagem. Tente novamente.");
        }
    }
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
        
        if (userData && typeof userData === 'object') {
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

  const handleSelectSearchedUser = (searchedUser) => {
      handleViewProfile(searchedUser.uid);
      // Clear search after selection to hide the dropdown
      setUserSearchQuery('');
      setUserSearchResults([]);
  };

  const handleCloseProfile = () => setViewingProfile(null);

  const handleStatusChange = (newStatus) => {
    setMyStatus(newStatus);
    database.ref(`users/${user.uid}/status`).set(newStatus);
    database.ref(`status/${user.uid}/status`).set(newStatus);
  };
  
  const handleOpenDiscoverModal = async () => {
    setDiscoverModalOpen(true);
    setIsEnrichingRooms(true);

    const enrichedDataPromises = allPublicRooms.map(async (room: any) => {
      // Fetch user count from presences
      const presenceRef = database.ref(`presences/${room.id}`);
      const presenceSnapshot = await presenceRef.once('value');
      const userCount = presenceSnapshot.numChildren();

      // Fetch creator's display name
      let creatorName = 'Sistema';
      if (room.creator && room.creator !== 'system') {
        try {
          const userRef = database.ref(`users/${room.creator}/displayName`);
          const userSnapshot = await userRef.once('value');
          creatorName = userSnapshot.val() || 'Desconhecido';
        } catch (e) {
          console.error(`Could not fetch creator name for user ${room.creator}`, e);
          creatorName = 'Desconhecido';
        }
      }
      
      return { ...room, userCount, creatorName };
    });

    try {
      const results = await Promise.all(enrichedDataPromises);
      setEnrichedPublicRooms(results);
    } catch (error) {
      console.error("Error enriching public rooms data:", error);
      setEnrichedPublicRooms(allPublicRooms.map((room: any) => ({...room, userCount: 0, creatorName: 'N/A'})));
    } finally {
      setIsEnrichingRooms(false);
    }
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
  
  const handleImageSelectClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
          setImageToSend(file);
          setImagePreviewUrl(URL.createObjectURL(file));
      }
      e.target.value = '';
  };

  const removeImageToSend = () => {
      setImageToSend(null);
      setImagePreviewUrl('');
  };


  const isPrivateChat = activeRoomId && activeRoomId.startsWith('private_');
  const allRooms = [...joinedPublicRooms, ...privateRooms];
  const activeRoom = !isPrivateChat ? allRooms.find(r => r.id === activeRoomId) : null;
  
  let chatPartner = null;
  if(isPrivateChat) {
      const partnerUid = activeRoomId.replace('private_', '').replace(user.uid, '').replace('_','');
      chatPartner = privateChats.find(p => p.uid === partnerUid);
  }

  return (
    <div className="app-container">
      {viewingProfile && <UserProfileModal user={viewingProfile} currentUser={user} onStartChat={handleStartPrivateChat} onClose={handleCloseProfile} />}
      {viewingImage && <ImageModal imageUrl={viewingImage} onClose={() => setViewingImage(null)} />}
      {isCreateRoomModalOpen && <CreateRoomModal onCreate={handleCreateRoom} onClose={() => setCreateRoomModalOpen(false)} />}
      {isJoinRoomModalOpen && <JoinRoomModal onJoin={handleJoinRoomWithCode} onClose={() => setJoinRoomModalOpen(false)} />}
      {isInviteCodeModalOpen && activeRoom?.inviteCode && <InviteCodeModal code={activeRoom.inviteCode} onClose={() => setInviteCodeModalOpen(false)} />}
      {isDiscoverModalOpen && 
        <DiscoverRoomsModal 
            allPublicRooms={enrichedPublicRooms}
            isLoading={isEnrichingRooms}
            joinedRoomIds={joinedPublicRooms.map(r => r.id)}
            onJoin={handleJoinPublicRoom}
            onClose={() => setDiscoverModalOpen(false)} 
        />
      }
      {callState === 'ringing' && incomingCall && (
          <IncomingCallModal 
              caller={incomingCall.fromName}
              onAccept={handleAnswerCall}
              onDecline={handleDeclineCall}
          />
      )}
      <aside className="sidebar">
        <div>
          <header className="sidebar-header">
            <h2>Salas</h2>
            <button onClick={handleLogout} className="logout-button">Sair</button>
          </header>
          <div className="sidebar-actions">
              <button onClick={() => setCreateRoomModalOpen(true)} className="sidebar-action-button">Criar Sala</button>
              <button onClick={() => setJoinRoomModalOpen(true)} className="sidebar-action-button">Entrar com Código</button>
              <button onClick={handleOpenDiscoverModal} className="sidebar-action-button">Descobrir Salas</button>
          </div>
          <div className="user-search-container">
              <input
                  type="text"
                  placeholder="Buscar usuários..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="user-search-input"
              />
              {userSearchQuery.trim().length > 1 && (
                  <ul className="user-search-results">
                      {isSearchLoading && <li className="search-result-item loading">Buscando...</li>}
                      {!isSearchLoading && userSearchResults.length === 0 && (
                          <li className="search-result-item none">Nenhum usuário encontrado.</li>
                      )}
                      {userSearchResults.map(u => (
                          <li key={u.uid} className="search-result-item" onClick={() => handleSelectSearchedUser(u)}>
                              {u.displayName}
                          </li>
                      ))}
                  </ul>
              )}
          </div>
          <h3 className="sidebar-subheader">Salas Públicas</h3>
          <ul className="room-list">
            {joinedPublicRooms.map(room => (
              <li key={room.id} className={`room-item joined ${room.id === activeRoomId ? 'active' : ''}`} onClick={() => handleRoomSelect(room.id)}>
                <span className="room-name"># {room.name}</span>
                 <button 
                    className="leave-private-chat-button" 
                    title={`Sair da sala ${room.name}`} 
                    onClick={(e) => { e.stopPropagation(); handleLeavePublicRoom(room.id); }}
                >
                    Sair
                </button>
              </li>
            ))}
          </ul>
           <h3 className="sidebar-subheader">Salas Privadas</h3>
          <ul className="room-list">
              {privateRooms.map(room => (
                  <li key={room.id} className={`room-item joined ${room.id === activeRoomId ? 'active' : ''}`} onClick={() => handleRoomSelect(room.id)}>
                    <span className="room-name-wrapper">
                        <svg className="private-room-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
                        {room.name}
                    </span>
                    <button 
                        className="leave-private-chat-button" 
                        title={`Sair da sala ${room.name}`} 
                        onClick={(e) => { e.stopPropagation(); handleLeavePrivateRoom(room.id); }}
                    >
                        Sair
                    </button>
                  </li>
              ))}
          </ul>
          <h3 className="sidebar-subheader">Mensagens Diretas</h3>
          <ul className="room-list">
{/* FIX: The file was truncated here, causing a syntax error. Completed the code to properly render the list of private chats. */}
              {privateChats.map(chat => {
                  const partnerStatus = partnerStatuses[chat.uid] || { state: 'offline', status: 'offline' };
                  const isOnline = partnerStatus.state === 'online';
                  const statusInfo = isOnline ? userStatuses[partnerStatus.status] : userStatuses.offline;
                  const privateRoomId = `private_${[user.uid, chat.uid].sort().join('_')}`;
                  
                  return (
                      <li key={chat.uid} className={`room-item private-chat ${privateRoomId === activeRoomId ? 'active' : ''}`} onClick={() => handleRoomSelect(privateRoomId)}>
                          <div className="private-chat-info">
                            <span className="status-indicator" style={{ backgroundColor: statusInfo?.color || '#6c757d' }}></span>
                            <span className="room-name">{chat.displayName}</span>
                          </div>
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
        <div className="sidebar-footer">
          <StatusSelector user={user} currentStatus={myStatus} onStatusChange={handleStatusChange} />
        </div>
      </aside>

      <main className="main-content">
        {!activeRoomId ? (
          <div className="welcome-screen">
            <h2>Bem-vindo ao Chat!</h2>
            <p>Selecione uma sala ou uma pessoa para começar a conversar.</p>
          </div>
        ) : (
          <>
            <header className="chat-header">
                <div className="chat-header-info">
                    {isPrivateChat && chatPartner ? (
                        <>
                            <h2>{chatPartner.displayName}</h2>
                            <p className="online-users-count">
                                {partnerStatuses[chatPartner.uid]?.state === 'online' ? 'Online' : 'Offline'}
                            </p>
                        </>
                    ) : activeRoom ? (
                        <>
                            <h2>{activeRoom.name}</h2>
                            <p className="online-users-count">{onlineUsers.length} online</p>
                        </>
                    ) : null}
                </div>
                <div className="chat-header-actions">
                    {isPrivateChat && callState === 'idle' && (
                        <button onClick={handleStartCall} className="video-call-button" title="Iniciar chamada de vídeo">
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738L14.33 5H14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-.33l1.823 2.43a.5.5 0 0 1-.364.801L15 12V9.5l.33-.44a1 1 0 0 1 1-1V5a1 1 0 0 1-1-1h-.5a2 2 0 0 1-2-2H2a2 2 0 0 1-2 2v6a2 2 0 0 1 2 2h7.5a2 2 0 0 1 1.983-1.738L13.67 11H14a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h.33l-1.823-2.43a.5.5 0 0 1 .364-.801L11 5V2.5l-.33.44a1 1 0 0 1-1 .56V5H2a1 1 0 0 1-1-1V5zm11.5 2.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1z"/></svg>
                        </button>
                    )}
                    {activeRoom?.type === 'private' && (
                       <button onClick={() => setInviteCodeModalOpen(true)} className="invite-button" title="Gerar código de convite">
                            Convidar
                       </button>
                    )}
                </div>
            </header>
            
            {callState === 'connected' ? (
                <CallView 
                    onEndCall={handleEndCall}
                    localStream={localStream}
                    remoteStream={remoteStream}
                    isMuted={isMuted}
                    isCameraOff={isCameraOff}
                    toggleMute={toggleMute}
                    toggleCamera={toggleCamera}
                />
            ) : (
                <>
                    <ul className="message-list" ref={messageListRef}>
                        {messages.map(msg => {
                            const isMine = msg.senderId === user.uid;
                            return (
                                <li key={msg.id} className={`message-wrapper ${isMine ? 'mine' : 'theirs'}`}>
                                    {!isMine && !msg.deleted && (
                                        <div className="message-sender" onClick={() => handleViewProfile(msg.senderId)}>
                                            {msg.senderName}
                                        </div>
                                    )}
                                    <div className="message-content-wrapper">
                                        <div className={`message ${msg.deleted ? 'deleted' : ''}`}>
                                            {msg.imageUrl && !msg.deleted && (
                                                <img src={msg.imageUrl} alt="Anexo" className="message-image" onClick={() => setViewingImage(msg.imageUrl)} />
                                            )}
                                            {msg.text && (
                                                <p className="message-text">{renderMessageWithMentions(msg.text)}</p>
                                            )}
                                            {!msg.deleted && (
                                                <div className="message-timestamp">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                        </div>
                                        {isMine && !msg.deleted && (
                                            <button className="delete-message-button" title="Excluir" onClick={() => handleDeleteMessage(msg.id)}>
                                                &times;
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="typing-indicator">
                    {formatTypingMessage(typingUsers)}
                    </div>

                    <form className="message-form" onSubmit={handleSendMessage}>
                        {mentionSuggestions.length > 0 && (
                            <div className="mention-suggestions">
                                {mentionSuggestions.map(u => (
                                    <div key={u.uid} className="mention-item" onClick={() => handleSelectMention(u.displayName)}>
                                        {u.displayName}
                                    </div>
                                ))}
                            </div>
                        )}
                        {imagePreviewUrl && (
                            <div className="image-preview-container">
                                <img src={imagePreviewUrl} alt="Prévia" className="image-preview" />
                                <button type="button" onClick={removeImageToSend} className="remove-image-button">&times;</button>
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                        <button type="button" className="attach-button" onClick={handleImageSelectClick}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        </button>
                        <input
                            type="text"
                            value={currentMessage}
                            onChange={handleTyping}
                            placeholder="Digite uma mensagem..."
                            className="message-input"
                            disabled={isUploading}
                        />
                        <button type="submit" className="send-button" disabled={isUploading}>
                            {isUploading ? 'Enviando...' : 'Enviar'}
                        </button>
                    </form>
                </>
            )}
          </>
        )}
      </main>

    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [consentGiven, setConsentGiven] = useState(localStorage.getItem('privacyConsent') === 'true');
  const [isFirebaseConfigured, setIsFirebaseConfigured] = useState(false);

  useEffect(() => {
    // Check if Firebase config has been replaced from placeholders
    const isConfigured = firebaseConfig.apiKey !== "YOUR_API_key" && 
                         firebaseConfig.projectId !== "YOUR_PROJECT_ID";
    setIsFirebaseConfigured(isConfigured);

    if (isConfigured) {
      const unsubscribe = auth.onAuthStateChanged(user => {
        setUser(user);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const handleConsent = () => {
    localStorage.setItem('privacyConsent', 'true');
    setConsentGiven(true);
  };
  
  // Set up presence management
  useEffect(() => {
    if (!user) return;
    const myUid = user.uid;
    const userStatusRef = database.ref(`/status/${myUid}`);
    const userStatusDBRef = database.ref(`/users/${myUid}/status`);

    const isOfflineForDatabase = {
      state: 'offline',
      status: 'offline',
      last_changed: firebase.database.ServerValue.TIMESTAMP,
    };
    const isOnlineForDatabase = {
      state: 'online',
      status: 'available', // Default to available on login
      last_changed: firebase.database.ServerValue.TIMESTAMP,
    };
    
    database.ref('.info/connected').on('value', (snapshot) => {
      if (snapshot.val() === false) {
        return;
      }
      userStatusRef.onDisconnect().set(isOfflineForDatabase).then(() => {
        userStatusRef.set(isOnlineForDatabase);
        // Also update the status text in the user profile
        userStatusDBRef.once('value', (snap) => {
            const currentStatus = snap.val() || 'available';
            isOnlineForDatabase.status = currentStatus;
            userStatusRef.set(isOnlineForDatabase);
        });
      });
    });

  }, [user]);

  if (!isFirebaseConfigured) {
    return <ConfigWarning />;
  }

  if (loading) {
    return <div className="loading-screen">Carregando...</div>;
  }
  
  if (!consentGiven) {
      return <PrivacyConsentModal onAccept={handleConsent} />;
  }

  return user ? <Chat user={user} /> : <AuthScreen />;
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);