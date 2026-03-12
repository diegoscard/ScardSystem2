
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  LayoutDashboard, Package, ShoppingCart, ArrowRightLeft, 
  LogOut, TrendingUp, Truck, Plus, Trash2, Edit, Search, X, 
  DollarSign, Box, AlertTriangle, CreditCard, Banknote, QrCode,
  Tag, User as UserIcon, ReceiptText, Percent, Wallet, ArrowUpCircle, ArrowDownCircle,
  BarChart3, RefreshCw, ClipboardList, Copy, Filter, Layers, Settings, Users,
  ShieldCheck, Landmark, PercentCircle, Eye, Lock, ShieldAlert, Calendar,
  History, Clock, UserCheck, RotateCcw, Award, Zap, Calculator, Trophy, Star, Medal,
  ChevronLeft, ChevronRight, ListOrdered, Download, Upload, Save, FileWarning,
  Megaphone, CalendarDays, CheckCircle2, TicketPercent, Gift, ShieldCheck as ShieldIcon,
  Printer, Check, Key, Shield, Monitor, UserPlus, HandCoins, Share2, FileText, Target
} from 'lucide-react';

// --- CONFIGURAÇÃO DE SEGURANÇA (CHAVES DE ACESSO) ---
const VALID_ACCESS_KEYS = [
  'QJ4UC-6G0HA-25T07-0KK4R-SJPPA', //-- LM PARTS
  'Master',
];

// --- UTILITÁRIOS DE SEGURANÇA DE HARDWARE ---

const getDeviceFingerprint = () => {
  const { userAgent, language, hardwareConcurrency, platform } = navigator;
  const { width, height, colorDepth, availWidth, availHeight } = window.screen;
  return `${userAgent}|${language}|${hardwareConcurrency}|${platform}|${width}x${height}|${availWidth}x${availHeight}|${colorDepth}`;
};

const generateHWID = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; 
  }
  return Math.abs(hash).toString(36).toUpperCase();
};

// --- UTILITÁRIOS DE FORMATAÇÃO ---

const formatCurrency = (val: number) => {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrency = (val: string) => {
  const clean = val.replace(/\D/g, '');
  return Number(clean) / 100;
};

// --- DEFINIÇÃO DE TIPOS ---

type UserRole = 'admin' | 'atendente';

interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  createdAt: string;
}

interface AppSettings {
  maxGlobalDiscount: number;
  cardFees: {
    debit: number;
    credit1x: number;
    credit1xLabel?: string;
    creditInstallments: number;
  };
  sellerPermissions: string[]; 
  storeAddress?: string;
  storeCnpj?: string;
  storeName?: string; 
  storeTagline?: string; 
}

interface Product {
  id: number;
  name: string;
  category: string;
  sku: string;
  price: number;
  cost: number;
  markup: number; 
  stock: number;
  size: string;
  color: string;
  active: boolean;
  supplierId?: number;
  discountBlocked?: boolean; // Bloqueio de desconto no produto
}

interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  type: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  reason: string;
  date: string;
  user: string;
}

interface SaleItem {
  cartId: string;
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
  discountValue: number; 
  manualDiscountValue: number; 
  manualDiscountInput?: number; // Valor bruto digitado no input do item
  manualDiscountType?: 'value' | 'percent'; // Tipo de desconto do item
  isExchanged?: boolean; 
  campaignName?: string; 
  campaignType?: 'percentage' | 'buy_x_get_y' | 'voucher' | 'bundle' | 'fixed_price';
  discountBlocked?: boolean; // Herdado do produto
}

interface PaymentRecord {
  method: string;
  amount: number;
  installments?: number;
  installmentValue?: number;
  netAmount: number;
  voucherCode?: string;
  f12ClientName?: string;
  f12Description?: string;
  f12DueDate?: string;
}

interface FiadoRecord {
  id: string;
  saleId: number;
  clientName: string;
  description: string;
  totalAmount: number;
  remainingAmount: number;
  createdAt: string;
  dueDate: string;
  vendedor: string;
  status: 'pending' | 'paid';
  items: SaleItem[];
}

interface CashLog {
  id: string;
  type: 'entrada' | 'retirada' | 'venda' | 'abertura' | 'ajuste';
  amount: number;
  description: string;
  time: string;
  user: string;
}

interface CashSession {
  isOpen: boolean;
  openingBalance: number;
  currentBalance: number;
  openedAt: string;
  openedBy: string;
  logs: CashLog[];
}

interface CashHistoryEntry {
  id: string;
  openedBy: string;
  openedAt: string;
  openingBalance: number;
  closedBy: string;
  closedAt: string;
  closingBalance: number;
  logs: CashLog[];
}

interface Sale {
  id: number;
  date: string;
  subtotal: number;
  discount: number;
  discountPercent: number;
  total: number;
  payments: PaymentRecord[];
  user: string; 
  adminUser: string; 
  items: SaleItem[];
  change: number; 
  exchangeCreditUsed?: number; 
}

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface Campaign {
  id: number;
  name: string;
  description: string;
  type: 'percentage' | 'buy_x_get_y' | 'voucher' | 'bundle' | 'fixed_price';
  discountPercent: number;
  pagueX?: number; 
  leveY?: number;  
  voucherCode?: string;
  voucherValue?: number;
  voucherQuantity?: number;
  bundleQuantity?: number; // Qtd para o combo (ex: 3)
  bundlePrice?: number;    // Preço fixo do combo (ex: 100)
  fixedPriceValue?: number; // Preço fixo por item
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: string;
  productIds: number[]; 
}

interface CommissionTier {
  min: number;
  rate: number;
}

// --- DADOS INICIAIS ---

const DEFAULT_SETTINGS: AppSettings = {
  maxGlobalDiscount: 10,
  cardFees: {
    debit: 1.99,
    credit1x: 3.49,
    creditInstallments: 4.99
  },
  sellerPermissions: ['exchange_sale'],
  storeAddress: 'Rua da Moda, 123 - Centro',
  storeCnpj: '00.000.000/0001-00',
  storeName: 'SCARD SYS',
  storeTagline: 'ENTERPRISE SOLUTION'
};

const INITIAL_CATEGORIES = [
  'Sem Categoria'
];

// --- COMPONENTE PRINCIPAL ---

const App = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [rememberKey, setRememberKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const usePersistedState = <T,>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [state, setState] = useState<T>(() => {
      const stored = localStorage.getItem(key);
      try {
        if (!stored) return initial;
        const parsed = JSON.parse(stored);
        if (key === 'db_settings') {
          const initialAny = initial as any;
          return { ...initial, ...parsed, cardFees: { ...initialAny.cardFees, ...(parsed.cardFees || {}) } } as T;
        }
        return parsed;
      } catch (e) {
        return initial;
      }
    });
    useEffect(() => { localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);
    return [state, setState];
  };

  const [dbUsers, setDbUsers] = usePersistedState<User[]>('db_users', []);
  const [products, setProducts] = usePersistedState<Product[]>('db_products', []);
  const [suppliers, setSuppliers] = usePersistedState<Supplier[]>('db_suppliers', []);
  const [categories, setCategories] = usePersistedState<string[]>('db_categories', INITIAL_CATEGORIES);
  const [movements, setMovements] = usePersistedState<StockMovement[]>('db_movements', []);
  const [sales, setSales] = usePersistedState<Sale[]>('db_sales', []);
  const [campaigns, setCampaigns] = usePersistedState<Campaign[]>('db_campaigns', []);
  const [cashSession, setCashSession] = usePersistedState<CashSession | null>('db_cash_session', null);
  const [cashHistory, setCashHistory] = usePersistedState<CashHistoryEntry[]>('db_cash_history', []);
  const [settings, setSettings] = usePersistedState<AppSettings>('db_settings', DEFAULT_SETTINGS);
  const [exchangeCredit, setExchangeCredit] = usePersistedState<number>('db_exchange_credit', 0);
  const [keyRegistrations, setKeyRegistrations] = usePersistedState<Record<string, string>>('db_key_registrations', {});
  const [fiados, setFiados] = usePersistedState<FiadoRecord[]>('db_fiados', []);
  const [currentView, setCurrentView] = useState('dashboard');
  
  const [openingBalanceInput, setOpeningBalanceInput] = useState(0);
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);

  const deviceHwid = useMemo(() => generateHWID(getDeviceFingerprint()), []);

  useEffect(() => {
    const savedKey = localStorage.getItem('scard_saved_access_key');
    if (savedKey && VALID_ACCESS_KEYS.includes(savedKey)) {
      if (keyRegistrations[savedKey] && keyRegistrations[savedKey] !== deviceHwid) {
        localStorage.removeItem('scard_saved_access_key');
        return;
      }
      setIsUnlocked(true);
    }
  }, [keyRegistrations, deviceHwid]);

  const handleVerifyAccessKey = (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    const trimmedKey = accessKeyInput.trim();

    setTimeout(() => {
      if (VALID_ACCESS_KEYS.includes(trimmedKey)) {
        const registeredHwid = keyRegistrations[trimmedKey];
        
        if (registeredHwid && registeredHwid !== deviceHwid) {
          alert('ERRO DE SEGURANÇA: Esta licença/chave já está vinculada a outro dispositivo. Chaves de acesso SCARDPRO são de uso exclusivo por terminal único (HWID Lock).');
          setIsValidating(false);
          setAccessKeyInput('');
          return;
        }

        if (!registeredHwid) {
          setKeyRegistrations(prev => ({ ...prev, [trimmedKey]: deviceHwid }));
        }

        if (rememberKey) {
          localStorage.setItem('scard_saved_access_key', trimmedKey);
        }
        setIsUnlocked(true);
      } else {
        alert('Chave de acesso inválida ou expirada. Entre em contato com o suporte SCARD.');
        setAccessKeyInput('');
      }
      setIsValidating(false);
    }, 1200);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    if (email === 'master' && password === '965088') {
      setUser({
        id: 0,
        name: 'MASTER SYSTEM',
        email: 'master@internal',
        role: 'admin',
        createdAt: new Date().toISOString()
      });
      setCurrentView('dashboard');
      return;
    }

    const foundUser = dbUsers.find(u => u.email === email && u.password === password);
    if (foundUser) {
      setUser(foundUser);
      if (foundUser.role === 'atendente') {
        setCurrentView('sales');
      } else {
        setCurrentView('dashboard');
      }
    } else { 
      alert('E-mail ou senha incorretos!'); 
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('regName') as HTMLInputElement).value;
    const email = (form.elements.namedItem('regEmail') as HTMLInputElement).value;
    const password = (form.elements.namedItem('regPassword') as HTMLInputElement).value;

    if (dbUsers.some(u => u.email === email)) {
      alert('E-mail já cadastrado!');
      return;
    }

    const newUser: User = {
      id: Date.now(),
      name,
      email,
      password,
      role: dbUsers.length === 0 ? 'admin' : 'atendente', 
      createdAt: new Date().toISOString()
    };

    setDbUsers([...dbUsers, newUser]);
    alert(`Usuário ${name} cadastrado com sucesso! Agora faça login.`);
    form.reset();
    setAuthMode('login');
  };

  const handleExportBackup = () => {
    const dataKeys = [
      'db_users', 'db_products', 'db_suppliers', 'db_categories', 
      'db_movements', 'db_sales', 'db_cash_session', 'db_cash_history', 
      'db_settings', 'db_exchange_credit', 'db_campaigns', 'db_key_registrations', 'db_fiados'
    ];
    
    const backupData: Record<string, any> = {};
    dataKeys.forEach(key => {
      const stored = localStorage.getItem(key);
      backupData[key] = stored ? JSON.parse(stored) : null;
    });

    const jsonString = JSON.stringify(backupData);
    const encodedData = btoa(unescape(encodeURIComponent(jsonString)));
    const secureContent = `SCARDSYS_SECURE_BKPV1:${encodedData}`;

    const blob = new Blob([secureContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const datePart = `${day}-${month}-${year}`;
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timePart = `${hours}-${minutes}-${seconds}`;
    
    const fileName = `backup_scardsys_${datePart}_${timePart}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("ATENÇÃO: Restaurar o backup irá sobrescrever TODOS os dados atuais (estoque, vendas, usuários e licenças). Deseja continuar?")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content.startsWith('SCARDSYS_SECURE_BKPV1:')) {
          throw new Error("Formato de arquivo inválido ou corrompido.");
        }
        const encodedData = content.replace('SCARDSYS_SECURE_BKPV1:', '');
        const decodedString = decodeURIComponent(escape(atob(encodedData)));
        const data = JSON.parse(decodedString);
        Object.entries(data).forEach(([key, value]) => {
          if (value !== null) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        });
        alert("Backup restaurado com sucesso! O sistema será reiniciado.");
        window.location.reload();
      } catch (err) {
        alert("Erro ao importar: O arquivo selecionado não é um backup válido ou está corrompido.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenCash = (amount: number) => {
    if (!user) return;

    // --- REGRAS DE SEGURANÇA PARA ABERTURA DE CAIXA ---
    if (cashHistory.length > 0) {
      const lastSession = cashHistory[0]; 
      const previousClosingBalance = lastSession.closingBalance;
      
      if (Math.abs(amount - previousClosingBalance) > 0.01) {
        alert(`BLOQUEIO DE ABERTURA: O saldo inicial informado (R$ ${formatCurrency(amount)}) NÃO confere com o saldo de fechamento da sessão anterior (R$ ${formatCurrency(previousClosingBalance)}). Por favor, verifique o saldo físico e informe o valor correto.`);
        return;
      }
    }

    const newSession: CashSession = {
      isOpen: true,
      openingBalance: amount,
      currentBalance: amount,
      openedAt: new Date().toISOString(),
      openedBy: user.name,
      logs: [{
        id: Math.random().toString(36).substr(2, 9),
        type: 'abertura',
        amount: amount,
        description: 'Abertura de Caixa',
        time: new Date().toISOString(),
        user: user.name
      }]
    };
    setCashSession(newSession);
    setOpeningBalanceInput(0); 
  };

  const handleCloseCashAction = () => {
    if (!user || !cashSession) return;
    setShowCloseCashModal(true);
  };

  const confirmCloseCash = () => {
    if (!user || !cashSession) return;
    const historyEntry: CashHistoryEntry = {
      id: Math.random().toString(36).substr(2, 9),
      openedBy: cashSession.openedBy,
      openedAt: cashSession.openedAt,
      openingBalance: cashSession.openingBalance,
      closedBy: user.name,
      closedAt: new Date().toISOString(),
      closingBalance: cashSession.currentBalance,
      logs: [...cashSession.logs]
    };
    setCashHistory(prev => [historyEntry, ...prev]);
    setCashSession(null);
    setShowCloseCashModal(false);
    alert('Caixa encerrado e registrado com sucesso!');
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] p-6 font-sans text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-red-800/10 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2 animate-pulse"></div>
        
        <div className="bg-zinc-900/40 backdrop-blur-3xl p-10 rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-sm border border-zinc-800/50 relative z-10 animate-in fade-in zoom-in-95 duration-500 text-center">
          <div className="mb-10 inline-flex p-5 rounded-3xl bg-red-600/20 border border-red-500/30 text-red-400">
            {isValidating ? <RefreshCw size={48} className="animate-spin text-red-500" /> : <Shield size={48} strokeWidth={1.5} />}
          </div>
          
          <div className="mb-10">
            <h1 className="text-4xl font-black text-white tracking-tighter italic mb-2">SCARD<span className="text-red-500">PRO</span></h1>
            <p className="text-zinc-500 font-black uppercase text-[9px] tracking-[0.3em]">Hardware Access Protection</p>
          </div>

          <form onSubmit={handleVerifyAccessKey} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1 text-center">Insira sua Chave de Acesso</label>
              <div className="relative group">
                <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500/50 group-focus-within:text-red-400 transition-colors" />
                <input 
                  type="password" 
                  autoFocus 
                  disabled={isValidating}
                  placeholder="••••••••••••" 
                  className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-950/50 px-12 py-5 text-red-400 focus:border-red-500 outline-none transition-all font-mono font-bold text-center tracking-widest placeholder:text-zinc-800"
                  value={accessKeyInput}
                  onChange={(e) => setAccessKeyInput(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3 bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/50 cursor-pointer hover:bg-zinc-950/60 transition-colors" onClick={() => setRememberKey(!rememberKey)}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${rememberKey ? 'bg-red-600 border-red-600' : 'border-zinc-700 bg-transparent'}`}>
                    {rememberKey && <Check size={14} className="text-white" />}
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider text-left">Concordo com os Termos de Uso e Licença de Terminal Único</span>
            </div>
            
            <button 
                type="submit" 
                disabled={!rememberKey || isValidating}
                className={`w-full rounded-2xl py-5 text-white font-black shadow-[0_10px_30px_rgba(220,38,38,0.3)] transition-all active:scale-95 uppercase text-xs tracking-[0.2em] ${(!rememberKey || isValidating) ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed shadow-none' : 'bg-red-600 hover:bg-red-50'}`}
            >
              {isValidating ? 'Validando HWID...' : 'Validar Acesso'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-zinc-800/50 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-zinc-500 opacity-60">
              <Monitor size={12} />
              <span className="text-[8px] font-black uppercase tracking-widest">Identificador do Terminal</span>
            </div>
            <code className="bg-zinc-950/80 px-3 py-1.5 rounded-lg text-[9px] font-mono font-black text-red-500/80 border border-zinc-800/50">{deviceHwid}</code>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 p-6 font-sans text-zinc-900 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-96 h-96 bg-red-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-rose-600/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-zinc-200 relative z-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black text-zinc-800 tracking-tighter italic mb-2">SCARD<span className="text-red-600">SYS</span></h1>
            <p className="text-zinc-400 font-black uppercase text-[10px] tracking-[0.2em]">Enterprise Solution</p>
          </div>
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-1">E-mail ou Master</label>
                <input name="email" type="text" placeholder="usuário" className="w-full rounded-2xl border-2 border-zinc-100 px-5 py-4 text-zinc-800 bg-zinc-50 focus:border-red-500 outline-none transition-all font-bold text-sm shadow-sm" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-1">Senha</label>
                <input name="password" type="password" placeholder="••••••••" className="w-full rounded-2xl border-2 border-zinc-100 px-5 py-4 text-zinc-800 bg-zinc-50 focus:border-red-500 outline-none transition-all font-bold text-sm shadow-sm" required />
              </div>
              <button type="submit" className="w-full rounded-2xl bg-red-600 py-5 text-white font-black hover:bg-red-700 shadow-xl shadow-red-100 transition-all active:scale-95 uppercase text-xs tracking-widest mt-2">
                Acessar Terminal
              </button>
              <div className="text-center mt-6">
                <button type="button" onClick={() => setAuthMode('register')} className="text-xs font-black text-zinc-400 hover:text-red-600 transition-colors uppercase tracking-widest">
                  Cadastrar Usuário
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
               <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-1">Nome Completo</label>
                <input name="regName" type="text" placeholder="Nome" className="w-full rounded-2xl border-2 border-zinc-100 px-5 py-4 text-zinc-800 bg-zinc-50 focus:border-red-500 outline-none transition-all font-bold text-sm shadow-sm" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-1">E-mail</label>
                <input name="regEmail" type="email" placeholder="admin@loja.com" className="w-full rounded-2xl border-2 border-zinc-100 px-5 py-4 text-zinc-800 bg-zinc-50 focus:border-red-500 outline-none transition-all font-bold text-sm shadow-sm" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-1">Senha</label>
                <input name="regPassword" type="password" placeholder="••••••••" className="w-full rounded-2xl border-2 border-zinc-100 px-5 py-4 text-zinc-800 bg-zinc-50 focus:border-red-500 outline-none transition-all font-bold text-sm shadow-sm" required />
              </div>
              <button type="submit" className="w-full rounded-2xl bg-zinc-800 py-5 text-white font-black hover:bg-zinc-900 shadow-xl shadow-zinc-200 transition-all active:scale-95 uppercase text-xs tracking-widest mt-2">
                Criar Conta
              </button>
              <div className="text-center mt-6">
                <button type="button" onClick={() => setAuthMode('login')} className="text-xs font-black text-zinc-400 hover:text-red-600 transition-colors uppercase tracking-widest">
                  Voltar para Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  const isMasterUser = user.id === 0 || user.email === 'master@internal';
  const isAdmin = user.role === 'admin' || isMasterUser;
  const isCashOpen = cashSession && cashSession.isOpen;

  const hasPermission = (viewId: string) => {
    if (isAdmin || viewId === 'sales' || viewId === 'reports' || viewId === 'product_search') return true; 
    return (settings.sellerPermissions || []).includes(viewId);
  };

  return (
    <div className="flex h-screen bg-[#f4f4f5] font-sans text-zinc-900 selection:bg-red-100 overflow-hidden">
      <aside className="w-64 bg-zinc-950 text-white flex flex-col shrink-0 border-r border-zinc-800 shadow-2xl relative z-20">
        <div className="p-8">
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">SCARD<span className="text-red-500 font-normal">SYS</span></h2>
          <div className="flex items-center gap-3 mt-6 bg-zinc-900 p-3 rounded-2xl border border-zinc-800/50 group">
             <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center font-black text-xs shadow-lg">
                {user.name.charAt(0).toUpperCase()}
             </div>
             <div className="flex flex-col min-w-0">
                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest leading-none">{user.role === 'admin' ? 'Administrador' : 'Vendedor'}</span>
                <p className="text-xs font-black text-zinc-100 uppercase tracking-tight truncate mt-1">{user.name}</p>
             </div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scroll">
          <NavBtn active={currentView === 'sales'} onClick={() => setCurrentView('sales')} icon={<ShoppingCart size={18}/>} label="Caixa PDV" />
          <NavBtn active={currentView === 'product_search'} onClick={() => setCurrentView('product_search')} icon={<Search size={18}/>} label="Consultar" />
          <NavBtn active={currentView === 'reports'} onClick={() => setCurrentView('reports')} icon={<TrendingUp size={18}/>} label="Relatórios" />
          {hasPermission('stock') && <NavBtn active={currentView === 'stock'} onClick={() => setCurrentView('stock')} icon={<Package size={18}/>} label="Estoque" />}
          
          {(isAdmin || hasPermission('dashboard')) && (
            <div className="pt-6 mt-6 border-t border-zinc-900 space-y-1">
               <p className="px-4 text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-4">Admin</p>
               {hasPermission('dashboard') && <NavBtn active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} icon={<LayoutDashboard size={18}/>} label="Dashboard" />}
               {isAdmin && <NavBtn active={currentView === 'team'} onClick={() => setCurrentView('team')} icon={<Users size={18}/>} label="Equipe" />}
               {isAdmin && <NavBtn active={currentView === 'settings'} onClick={() => setCurrentView('settings')} icon={<Settings size={18}/>} label="Ajustes" />}
            </div>
          )}
        </nav>

        <div className="p-4 mt-auto space-y-2 border-t border-zinc-800/50">
          <button type="button" title="Gerar backup protegido dos dados" onClick={handleExportBackup} className="flex items-center space-x-3 text-emerald-400 hover:text-emerald-300 transition-all w-full px-4 py-2.5 rounded-xl hover:bg-emerald-400/5 group">
            <Download size={16} />
            <span className="font-black uppercase text-[9px] tracking-widest">Salvar Backup</span>
          </button>
          {isMasterUser && (
            <button type="button" title="Restaurar dados de um arquivo de backup" onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-3 text-orange-400 hover:text-orange-300 transition-all w-full px-4 py-2.5 rounded-xl hover:bg-orange-400/5 group">
              <Upload size={16} />
              <span className="font-black uppercase text-[9px] tracking-widest">Restaurar Backup</span>
              <input ref={fileInputRef} type="file" accept=".json,.scard" className="hidden" onChange={handleImportBackup} />
            </button>
          )}
          {isCashOpen && (
            <button type="button" onClick={handleCloseCashAction} className="flex items-center space-x-3 text-amber-500 hover:text-amber-400 transition-all w-full px-4 py-3 rounded-xl hover:bg-amber-500/5 group">
              <Wallet size={18} />
              <span className="font-black uppercase text-[9px] tracking-widest">Fechar Caixa</span>
            </button>
          )}
          <button type="button" onClick={() => { setIsUnlocked(false); setUser(null); }} className="flex items-center space-x-3 text-zinc-500 hover:text-red-400 transition-all w-full px-4 py-3 rounded-xl hover:bg-red-500/5 group">
            <LogOut size={18} />
            <span className="font-black uppercase text-[9px] tracking-widest">Sair</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto relative">
        <div className="max-w-[1550px] mx-auto px-10 py-12 h-full flex flex-col">
          {currentView === 'sales' && (
            !isCashOpen ? (
              <div className="flex-1 flex items-center justify-center animate-in fade-in">
                <div className="bg-white p-12 rounded-[3rem] shadow-xl w-full max-w-lg border border-zinc-200">
                  <div className="flex flex-col items-center mb-10">
                    <div className="p-6 bg-red-50 text-red-600 rounded-[2rem] mb-6 shadow-inner border border-red-100">
                      <Wallet size={48} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase italic">Abertura de Caixa</h2>
                    <p className="text-zinc-400 font-bold text-xs text-center mt-3 px-10 leading-relaxed uppercase tracking-widest opacity-70">Informe o saldo inicial disponível em espécie.</p>
                  </div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleOpenCash(openingBalanceInput);
                  }} className="space-y-8">
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-zinc-300">R$</span>
                      <input 
                        name="amount" 
                        type="text" 
                        autoComplete="off" 
                        autoFocus 
                        className="w-full text-center text-5xl font-black bg-zinc-50 rounded-3xl border-2 border-zinc-100 focus:border-red-500 outline-none py-8 transition-all text-red-700 shadow-inner pl-14" 
                        placeholder="0,00" 
                        required 
                        value={formatCurrency(openingBalanceInput)}
                        onChange={(e) => setOpeningBalanceInput(parseCurrency(e.target.value))}
                      />
                    </div>
                    <button type="submit" className="w-full rounded-2xl bg-red-600 py-6 text-white font-black hover:bg-red-700 shadow-xl shadow-red-100 transition-all active:scale-95 uppercase text-sm tracking-[0.2em]">
                      Abrir Caixa
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <SalesViewComponent 
                user={user} 
                products={products} 
                setProducts={setProducts} 
                setSales={setSales} 
                setMovements={setMovements} 
                vendedores={dbUsers}
                cashSession={cashSession}
                setCashSession={setCashSession}
                settings={settings}
                exchangeCredit={exchangeCredit}
                setExchangeCredit={setExchangeCredit}
                campaigns={campaigns}
                setCampaigns={setCampaigns}
                fiados={fiados}
                setFiados={setFiados}
              />
            )
          )}
          {currentView === 'product_search' && (
            <ProductSearchViewComponent products={products} categories={categories} />
          )}
          {currentView === 'fiado' && (
             <FiadoManagementView 
               user={user}
               fiados={fiados} 
               setFiados={setFiados} 
               cashSession={cashSession} 
               setCashSession={setCashSession} 
               cashHistory={cashHistory}
             />
          )}
          {currentView === 'stock' && (
            <StockManagementView
              user={user}
              products={products}
              setProducts={setProducts}
              movements={movements}
              setMovements={setMovements}
              categories={categories}
              setCategories={setCategories}
            />
          )}
          {currentView === 'campaigns' && (
            <CampaignsViewComponent campaigns={campaigns} setCampaigns={setCampaigns} products={products} />
          )}
          {currentView === 'dashboard' && (
            <DashboardViewComponent products={products} sales={sales} cashSession={cashSession} fiados={fiados} cashHistory={cashHistory} />
          )}
          {currentView === 'reports' && (
            <ReportsViewComponent 
              user={user}
              sales={sales} 
              setSales={setSales} 
              products={products}
              setProducts={setProducts}
              setMovements={setMovements}
              cashHistory={cashHistory}
              cashSession={cashSession}
              setCashSession={setCashSession}
              setCashHistory={setCashHistory}
              settings={settings}
              setExchangeCredit={setExchangeCredit}
              setCurrentView={setCurrentView}
              vendedores={dbUsers}
            />
          )}
          {currentView === 'team' && (
            <TeamViewComponent currentUser={user} users={dbUsers} setUsers={setDbUsers} />
          )}
          {currentView === 'settings' && (
            <SettingsViewComponent 
              settings={settings} 
              setSettings={setSettings} 
              categories={categories}
              setCategories={setCategories}
              products={products}
              setProducts={setProducts}
            />
          )}
        </div>
      </main>

      {showCloseCashModal && cashSession && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[200] animate-in fade-in">
          <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setShowCloseCashModal(false)}></div>
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl relative z-10 space-y-8 border border-zinc-100">
            <div className="flex flex-col items-center text-center">
              <div className="p-5 bg-amber-50 text-amber-600 rounded-3xl mb-6 border border-amber-100">
                <Wallet size={40} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 uppercase italic tracking-tight">Resumo de Fechamento</h3>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mt-2">Confira os valores antes de encerrar</p>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-zinc-400 uppercase">Saldo Inicial</span>
                  <span className="text-sm font-black text-zinc-600 font-mono">R$ {formatCurrency(cashSession.openingBalance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-zinc-400 uppercase">Movimentação Líquida</span>
                  <span className={`text-sm font-black font-mono ${cashSession.currentBalance >= cashSession.openingBalance ? 'text-green-600' : 'text-red-600'}`}>
                    {cashSession.currentBalance >= cashSession.openingBalance ? '+' : '-'} R$ {formatCurrency(Math.abs(cashSession.currentBalance - cashSession.openingBalance))}
                  </span>
                </div>
                <div className="h-px bg-zinc-200"></div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs font-black text-zinc-900 uppercase italic">Saldo Final em Caixa</span>
                  <span className="text-2xl font-black text-red-600 font-mono tracking-tighter">R$ {formatCurrency(cashSession.currentBalance)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-4 bg-red-50 rounded-2xl border border-red-100">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-red-400" />
                  <span className="text-[10px] font-black text-red-600 uppercase">Sessão iniciada há {Math.floor((new Date().getTime() - new Date(cashSession.openedAt).getTime()) / (1000 * 60 * 60))}h {Math.floor(((new Date().getTime() - new Date(cashSession.openedAt).getTime()) % (1000 * 60 * 60)) / (1000 * 60))}m</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowCloseCashModal(false)} 
                className="flex-1 py-5 text-zinc-400 font-black uppercase text-[10px] hover:text-zinc-600 transition-colors"
              >
                Voltar
              </button>
              <button 
                onClick={confirmCloseCash} 
                className="flex-[2] py-5 bg-amber-500 text-white font-black rounded-2xl uppercase text-[10px] shadow-xl shadow-amber-200 hover:bg-amber-600 transition-all active:scale-95"
              >
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center space-x-4 w-full px-5 py-3 rounded-xl transition-all font-bold text-sm ${active ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100'}`}>
    <span>{icon}</span>
    <span className="tracking-tight">{label}</span>
  </button>
);

// --- COMPONENTE GESTÃO DE PENDENTES (F12) ---

const FiadoManagementView = ({ user, fiados, setFiados, cashSession, setCashSession, cashHistory }: any) => {
  const [search, setSearch] = useState('');
  const [receivingModal, setReceivingModal] = useState<FiadoRecord | null>(null);
  const [receiveAmount, setReceiveAmount] = useState(0);
  const [receiveMethod, setReceiveMethod] = useState('Dinheiro');

  const pendingFiados = useMemo(() => {
    return fiados.filter((f: FiadoRecord) => f.status === 'pending' && 
      (f.clientName.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase())));
  }, [fiados, search]);

  const handleReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingModal) return;

    if (receiveAmount <= 0 || receiveAmount > receivingModal.remainingAmount + 0.01) {
      alert('Valor inválido para recebimento.');
      return;
    }

    const newRemaining = Math.max(0, receivingModal.remainingAmount - receiveAmount);
    const isFullyPaid = newRemaining <= 0.01;

    const updatedFiados = fiados.map((f: FiadoRecord) => {
       if (f.id === receivingModal.id) {
          return {
            ...f,
            remainingAmount: newRemaining,
            status: isFullyPaid ? 'paid' : 'pending'
          };
       }
       return f;
    });

    setFiados(updatedFiados);

    if (cashSession && (receiveMethod === 'Dinheiro' || receiveMethod === 'Pix')) {
       const newLog: CashLog = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'entrada',
          amount: receiveAmount,
          description: `Rec. Pendente: ${receivingModal.clientName} (${receiveMethod})`,
          time: new Date().toISOString(),
          user: user.name
       };

       setCashSession((prev: CashSession) => ({
          ...prev,
          currentBalance: prev.currentBalance + (receiveMethod === 'Dinheiro' ? receiveAmount : 0),
          logs: [newLog, ...prev.logs]
       }));
    }

    alert(isFullyPaid ? 'Dívida quitada com sucesso!' : 'Pagamento parcial registrado!');
    setReceivingModal(null);
    setReceiveAmount(0);
  };

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0 animate-in fade-in">
       <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase italic">Gestão de Pendentes (F12)</h2>
          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Controle de pagamentos pendentes de clientes</p>
       </div>

       <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex gap-4 shrink-0">
          <div className="relative group flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Buscar por cliente ou descrição..." 
              className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border rounded-xl text-xs font-bold outline-none focus:border-red-500" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
       </div>

       <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-zinc-200 flex-1 flex flex-col min-h-0">
          <div className="overflow-auto flex-1 custom-scroll">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="bg-zinc-50 sticky top-0 z-10 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b">
                <tr>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Acordo / Descrição</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4 text-right">Valor Inicial</th>
                  <th className="px-6 py-4 text-right">Pendente</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pendingFiados.map((f: FiadoRecord) => (
                  <tr key={f.id} className="hover:bg-zinc-50 transition-all">
                    <td className="px-6 py-4">
                       <div className="flex flex-col">
                          <span className="font-bold text-zinc-800 text-sm uppercase">{f.clientName}</span>
                          <span className="text-[9px] font-black text-red-500">VENDA #{f.id.toString().slice(-4)}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-xs font-bold text-zinc-500 italic max-w-xs">{f.description}</p>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-1 rounded text-[10px] font-black border ${new Date(f.dueDate) < new Date() ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : 'bg-zinc-100 text-zinc-500'}`}>
                          {new Date(f.dueDate).toLocaleDateString()}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-zinc-400 text-sm">R$ {formatCurrency(f.totalAmount)}</td>
                    <td className="px-6 py-4 text-right">
                       <span className="font-black text-red-600 font-mono text-sm">R$ {formatCurrency(f.remainingAmount)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button 
                        onClick={() => { setReceivingModal(f); setReceiveAmount(f.remainingAmount); }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase shadow-md hover:bg-green-700 active:scale-95 transition-all"
                       >
                          Dar Baixa
                       </button>
                    </td>
                  </tr>
                ))}
                {pendingFiados.length === 0 && (
                   <tr>
                     <td colSpan={6} className="py-20 text-center text-zinc-300 font-bold italic uppercase tracking-widest">Nenhum registro pendente encontrado...</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
       </div>

       {receivingModal && (
          <div className="fixed inset-0 flex items-center justify-center p-6 z-[200] animate-in fade-in">
             <form onSubmit={handleReceive} className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                   <h3 className="text-xl font-black text-zinc-900 uppercase italic">Baixa de Pagamento</h3>
                   <button type="button" onClick={() => setReceivingModal(null)} className="text-zinc-300 hover:text-zinc-500"><X size={24}/></button>
                </div>
                
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                   <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Cliente</span>
                   <p className="text-lg font-black text-red-700 uppercase">{receivingModal.clientName}</p>
                   <div className="mt-2 flex justify-center gap-4">
                      <div>
                         <span className="text-[8px] font-black text-zinc-400 uppercase block">Total Devido</span>
                         <span className="font-mono font-black text-red-600">R$ {formatCurrency(receivingModal.remainingAmount)}</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Valor do Pagamento</label>
                      <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-zinc-300">R$</span>
                         <input 
                           type="text" 
                           className="w-full pl-12 pr-4 py-4 bg-zinc-50 border-2 rounded-2xl text-2xl font-black text-red-700 outline-none focus:border-red-500"
                           value={formatCurrency(receiveAmount)}
                           onChange={(e) => setReceiveAmount(parseCurrency(e.target.value))}
                           onFocus={(e) => e.target.select()}
                         />
                      </div>
                   </div>

                   <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Meio de Recebimento</label>
                      <select 
                        className="w-full border-2 rounded-2xl px-4 py-3 text-sm font-black uppercase bg-zinc-50 outline-none"
                        value={receiveMethod}
                        onChange={(e) => setReceiveMethod(e.target.value)}
                      >
                         <option>Dinheiro</option>
                         <option>Pix</option>
                         <option>Cartão</option>
                      </select>
                   </div>
                </div>

                <div className="flex gap-3 pt-4">
                   <button type="button" onClick={() => setReceivingModal(null)} className="flex-1 py-4 text-zinc-400 font-black uppercase text-[10px]">Cancelar</button>
                   <button type="submit" className="flex-[2] py-4 bg-green-600 text-white font-black rounded-2xl uppercase text-[10px] shadow-xl hover:bg-green-700">Confirmar Recebimento</button>
                </div>
             </form>
          </div>
       )}
    </div>
  );
};

// --- COMPONENTE BUSCA RÁPIDA DE PRODUTOS ---

const ProductSearchViewComponent = ({ products, categories }: { products: Product[], categories: string[] }) => {
  const [search, setSearch] = useState('');
  const [isExact, setIsExact] = useState(false);
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterSize, setFilterSize] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [summaryModal, setSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  const sortedCategories = useMemo(() => { 
    return [...categories].sort((a, b) => { 
      if (a === 'Sem Categoria') return -1; 
      if (b === 'Sem Categoria') return 1; 
      return a.localeCompare(b); 
    }); 
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const t = search.toLowerCase();
    const s = filterSize.toLowerCase();
    const c = filterColor.toLowerCase();
    return products.filter((p: Product) => {
      let matchSearch = false;
      if (!t) {
        matchSearch = p.active;
      } else {
        if (isExact) {
          matchSearch = p.active && (p.name.toLowerCase() === t || p.sku.toLowerCase() === t);
        } else {
          matchSearch = p.active && (p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t));
        }
      }

      const matchCategory = filterCategory === 'Todas' ? true : p.category === filterCategory;
      const matchSize = s ? p.size?.toLowerCase().includes(s) : true;
      const matchColor = c ? p.color?.toLowerCase().includes(c) : true;
      return matchSearch && matchCategory && matchSize && matchColor;
    });
  }, [products, search, isExact, filterCategory, filterSize, filterColor]);

  const generateWppSummary = () => {
    if (filteredProducts.length === 0) {
      alert('Nenhum produto visível para gerar resumo!');
      return;
    }
    const now = new Date().toLocaleDateString();
    let text = `📦 *PEÇAS - ${now}*\n`;
    text += `--------------------------------\n`;
    filteredProducts.forEach((p: Product) => {
      text += `*${p.name}* | Qld: ${p.size || '-'} | _R$ ${formatCurrency(p.price)}_\n`;
    });
    text += `--------------------------------\n`;
    text += `*LM PARTS*\n`;
    
    setSummaryText(text);
    setSummaryModal(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summaryText);
    alert('Resumo copiado para a área de transferência!');
  };

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0 animate-in fade-in">
       <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase italic">Consulta de Produtos</h2>
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Verificação rápida de preço e estoque</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsExact(!isExact)} 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${isExact ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white border-zinc-200 text-zinc-400 hover:border-red-300'}`}
            >
              <Target size={14} className={isExact ? 'animate-pulse' : ''} />
              {isExact ? 'Exato' : 'Exato'}
            </button>
            <button type="button" onClick={generateWppSummary} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg active:scale-95 text-[10px] uppercase">
              <Share2 size={16}/> Resumo WhatsApp
            </button>
          </div>
       </div>
       
       <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4 shrink-0">
          <div className="flex gap-4">
            <div className="relative group flex-[3]">
              <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isExact ? 'text-red-500' : 'text-zinc-400'}`} />
              <input 
                type="text" 
                placeholder={isExact ? "Digite o nome exato ou SKU..." : "Buscar por SKU ou nome..."} 
                className={`w-full pl-11 pr-4 py-2.5 bg-zinc-50 border rounded-xl text-xs font-bold outline-none transition-all ${isExact ? 'border-red-500 ring-2 ring-red-50' : 'focus:border-red-500'}`} 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                autoFocus 
              />
            </div>
            <select className="flex-1 bg-zinc-50 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase outline-none focus:border-red-500" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
               <option value="Todas">Todas Categorias</option>
               {sortedCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          
          <div className="flex gap-6 items-center border-t pt-4">
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">QUALIDADE</label>
              <input 
                type="text" 
                placeholder="" 
                className="w-32 px-3 py-2 bg-zinc-50 border rounded-lg text-xs font-bold outline-none focus:border-red-500 uppercase"
                value={filterSize}
                onChange={e => setFilterSize(e.target.value)}
              />
            </div>
            {(filterSize || filterColor) && (
              <button onClick={() => { setFilterSize(''); setFilterColor(''); }} className="text-[9px] font-black text-red-400 uppercase hover:text-red-600 transition-colors flex items-center gap-1">
                <X size={12} /> Limpar Filtros
              </button>
            )}
          </div>
       </div>

       <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-zinc-200 flex-1 flex flex-col min-h-0">
          <div className="overflow-auto flex-1 custom-scroll">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="bg-zinc-50 sticky top-0 z-10 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b">
                <tr>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Detalhes</th>
                  <th className="px-6 py-4 text-right">Preço de Venda</th>
                  <th className="px-6 py-4 text-center">Estoque Atual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-800 text-sm">{p.name}</span>
                        <span className="text-[10px] font-black text-red-500 font-mono">{p.sku}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="px-2.5 py-1 rounded-lg bg-zinc-50 text-zinc-500 text-[8px] font-black uppercase border">{p.category || 'Sem Categoria'}</span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-col text-[11px] font-bold text-zinc-600">
                          {p.size && <span>QLD: {p.size}</span>}
                          {p.color && <span>COR: {p.color}</span>}
                          {!p.size && !p.color && <span className="text-zinc-300">-</span>}
                       </div>
                    </td>
                    <td className="px-6 py-4 font-black text-zinc-900 font-mono text-sm text-right">R$ {formatCurrency(p.price)}</td>
                    <td className="px-6 py-4 text-center">
                       <span className={`px-4 py-1.5 rounded-xl text-[11px] font-black ${p.stock <= 5 ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                          {p.stock} un
                       </span>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-zinc-300 font-bold italic uppercase tracking-widest">Nenhum produto {isExact ? 'idêntico' : ''} encontrado...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
       </div>

       {summaryModal && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[100] animate-in fade-in bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-xl shadow-2xl space-y-6 flex flex-col relative">
            <div className="flex justify-between items-center border-b pb-4 shrink-0">
               <h3 className="text-xl font-black text-zinc-900 uppercase italic flex items-center gap-2">
                 <Share2 size={24} className="text-emerald-600" /> Resumo WhatsApp
               </h3>
               <button type="button" onClick={() => setSummaryModal(false)} className="text-zinc-300 hover:text-zinc-500 transition-colors"><X size={24}/></button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Conteúdo do Resumo (Filtrado)</p>
              <textarea 
                readOnly
                className="w-full flex-1 border-2 rounded-2xl p-6 text-sm font-mono bg-zinc-50 focus:outline-none custom-scroll resize-none leading-relaxed focus:border-emerald-500"
                value={summaryText}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t shrink-0">
              <button type="button" onClick={copyToClipboard} className="w-full py-4 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-xl flex items-center justify-center gap-2 shadow-xl hover:bg-emerald-700 transition-all active:scale-95">
                <Copy size={16} /> Copiar para WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
// --- COMPONENTE CAMPANHAS ---

const CampaignsViewComponent = ({ campaigns, setCampaigns, products }: { campaigns: Campaign[], setCampaigns: any, products: Product[] }) => {
  const [modal, setModal] = useState(false);
  const [prodSearch, setProdSearch] = useState('');
  const [form, setForm] = useState<Partial<Campaign>>({
    name: '', description: '', type: 'percentage', discountPercent: 0, pagueX: 0, leveY: 0, voucherCode: '', voucherValue: 0, voucherQuantity: 1, bundleQuantity: 1, bundlePrice: 0, fixedPriceValue: 0, startDate: '', endDate: '', active: true, productIds: []
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const id = form.id || Date.now();
    const c: Campaign = { 
      ...form, 
      id, 
      createdAt: form.createdAt || new Date().toISOString() 
    } as Campaign;

    if (form.id) setCampaigns((prev: Campaign[]) => prev.map(x => x.id === id ? c : x));
    else setCampaigns((prev: Campaign[]) => [...prev, c]);
    
    setModal(false);
    setForm({ name: '', description: '', type: 'percentage', discountPercent: 0, pagueX: 0, leveY: 0, voucherCode: '', voucherValue: 0, voucherQuantity: 1, bundleQuantity: 1, bundlePrice: 0, fixedPriceValue: 0, startDate: '', endDate: '', active: true, productIds: [] });
  };

  const filteredProds = products.filter(p => p.active && (p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.sku.toLowerCase().includes(prodSearch.toLowerCase())));

  const toggleProduct = (pid: number) => {
    const current = form.productIds || [];
    if (current.includes(pid)) {
      setForm({ ...form, productIds: current.filter(id => id !== pid) });
    } else {
      setForm({ ...form, productIds: [...current, pid] });
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0 animate-in fade-in">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase italic">Campanhas</h2>
          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Gestão de promoções e eventos</p>
        </div>
        <button onClick={() => { setForm({ name: '', description: '', type: 'percentage', discountPercent: 0, pagueX: 0, leveY: 0, voucherCode: '', voucherValue: 0, voucherQuantity: 1, bundleQuantity: 1, bundlePrice: 0, fixedPriceValue: 0, startDate: '', endDate: '', active: true, productIds: [] }); setModal(true); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg active:scale-95 text-[10px] uppercase">
          <Plus size={16} /> Nova Campanha
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-zinc-200 flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1 custom-scroll">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="bg-zinc-50 sticky top-0 z-10 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b">
              <tr>
                <th className="px-6 py-4">Campanha</th>
                <th className="px-6 py-4">Tipo/Regra</th>
                <th className="px-6 py-4">Itens/Validade</th>
                <th className="px-6 py-4">Período</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {campaigns.map((c: Campaign) => (
                <tr key={c.id} className="hover:bg-zinc-50 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-800 text-sm uppercase italic">{c.name}</span>
                      <span className="text-[10px] text-zinc-400 truncate max-w-xs">{c.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     {c.type === 'percentage' ? (
                       <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-black border border-red-100 uppercase">
                          {c.discountPercent}% OFF
                       </span>
                     ) : c.type === 'buy_x_get_y' ? (
                       <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-black border border-red-100 uppercase flex items-center gap-1.5 w-fit">
                          <TicketPercent size={12} /> PAGUE {c.pagueX} LEVE {c.leveY}
                       </span>
                     ) : c.type === 'bundle' ? (
                        <div className="flex flex-col gap-1">
                            <span className="bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-[10px] font-black border border-purple-100 uppercase flex items-center gap-1.5 w-fit">
                                <Package size={12} /> {c.bundleQuantity} POR R$ {formatCurrency(c.bundlePrice || 0)}
                            </span>
                        </div>
                     ) : c.type === 'fixed_price' ? (
                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black border border-emerald-100 uppercase flex items-center gap-1.5 w-fit">
                           <Tag size={12} /> PREÇO FIXO: R$ {formatCurrency(c.fixedPriceValue || 0)}
                        </span>
                     ) : (
                        <div className="flex flex-col gap-1">
                            <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black border border-amber-100 uppercase flex items-center gap-1.5 w-fit">
                                <Gift size={12} /> VOUCHER: {c.voucherCode}
                            </span>
                            <span className="text-[10px] font-black text-zinc-500 font-mono">VALOR: R$ {formatCurrency(c.voucherValue || 0)}</span>
                        </div>
                     )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                        <span className="bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded text-[10px] font-black w-fit uppercase">
                            {c.productIds?.length || 0} PRODS
                        </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                      <CalendarDays size={12} className="text-red-400" />
                      {new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const now = new Date();
                      const start = new Date(c.startDate);
                      const end = new Date(c.endDate);
                      end.setHours(23, 59, 59, 999);
                      
                      if (now > end) return <span className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border bg-red-50 text-red-600 border-red-100">Encerrada</span>;
                      if (now < start) return <span className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border bg-red-50 text-red-600 border-red-100">Agendada</span>;
                      return <span className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border bg-green-50 text-green-600 border-green-100">Ativa</span>;
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setForm(c); setModal(true); }} className="p-2 text-zinc-400 hover:text-red-600"><Edit size={14} /></button>
                      <button onClick={() => setCampaigns(campaigns.filter((x: any) => x.id !== c.id))} className="p-2 text-zinc-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-zinc-300 font-bold italic">Nenhuma campanha cadastrada...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[100] animate-in fade-in">
          <form onSubmit={save} className="bg-white p-8 rounded-[2.5rem] w-full max-w-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-hidden flex flex-col relative z-20">
            <div className="flex justify-between items-center border-b pb-4 shrink-0">
               <h3 className="text-xl font-black text-zinc-900 uppercase italic">
                  {form.id ? 'Ajustar' : 'Nova'} Campanha
               </h3>
               <button type="button" onClick={() => setModal(false)} className="text-zinc-300 hover:text-zinc-500 transition-colors"><X size={24}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scroll pr-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-400 uppercase block ml-1">Nome da Campanha</label>
                      <input className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold uppercase focus:border-red-500 outline-none" placeholder="Ex: Black Friday" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-400 uppercase block ml-1">Descrição</label>
                      <textarea className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold h-20 resize-none focus:border-red-500 outline-none" placeholder="Detalhes da promoção..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-zinc-400 uppercase block ml-1">Tipo de Campanha</label>
                        <select className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold uppercase focus:border-red-500 outline-none" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}>
                           <option value="percentage">Desconto Percentual (%)</option>
                           <option value="fixed_price">Preço Fixo (R$)</option>
                           <option value="buy_x_get_y">Pague X, Leve Y (Item Grátis)</option>
                           <option value="bundle">Combo / Bundle (Ex: 3 por 100)</option>
                        </select>
                    </div>

                    {form.type === 'percentage' && (
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-400 uppercase block ml-1">Desconto (%)</label>
                          <div className="relative">
                            <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                            <input 
                              type="number" 
                              step="0.5" 
                              className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-red-600 focus:border-red-300 outline-none" 
                              value={form.discountPercent} 
                              onFocus={() => { if(form.discountPercent === 0) setForm(prev => ({...prev, discountPercent: '' as any})); }} 
                              onBlur={() => { if(form.discountPercent as any === '') setForm(prev => ({...prev, discountPercent: 0})); }}
                              onChange={e => setForm(prev => ({ ...prev, discountPercent: e.target.value === '' ? '' as any : Number(e.target.value) }))} 
                              required 
                            />
                          </div>
                       </div>
                    )}

                    {form.type === 'fixed_price' && (
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-400 uppercase block ml-1">Preço Final (R$)</label>
                          <div className="relative">
                            <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                            <input 
                              type="text" 
                              className="w-full border-2 rounded-xl pl-12 pr-4 py-2.5 text-sm font-black text-emerald-600 focus:border-emerald-300 outline-none bg-zinc-50" 
                              value={formatCurrency(form.fixedPriceValue || 0)} 
                              onFocus={(e) => e.target.select()}
                              onChange={e => setForm(prev => ({ ...prev, fixedPriceValue: parseCurrency(e.target.value) }))} 
                              required 
                            />
                          </div>
                          <p className="text-[8px] font-bold text-zinc-400 uppercase mt-1 italic">Todos os itens selecionados custarão este valor no caixa.</p>
                       </div>
                    )}

                    {form.type === 'buy_x_get_y' && (
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Pague (Qtd)</label>
                            <input 
                              type="number" 
                              className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-red-600 focus:border-red-300 outline-none bg-zinc-50" 
                              value={form.pagueX} 
                              onFocus={(e) => e.target.select()}
                              onChange={e => setForm(prev => ({ ...prev, pagueX: Number(e.target.value) }))} 
                              required 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Leve (Qtd)</label>
                            <input 
                              type="number" 
                              className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-green-600 focus:border-green-300 outline-none bg-zinc-50" 
                              value={form.leveY} 
                              onFocus={(e) => e.target.select()}
                              onChange={e => setForm(prev => ({ ...prev, leveY: Number(e.target.value) }))} 
                              required 
                            />
                          </div>
                          <p className="col-span-2 text-[8px] font-bold text-zinc-400 italic uppercase">
                             O sistema dará desconto de 100% nas {(form.leveY || 0) - (form.pagueX || 0)} unidades mais baratas a cada {form.leveY} itens.
                          </p>
                       </div>
                    )}

                    {form.type === 'bundle' && (
                       <div className="grid grid-cols-2 gap-4 bg-purple-50 p-4 rounded-2xl border border-purple-100">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-purple-600 uppercase block ml-1">Qtd Itens</label>
                            <input 
                              type="number" 
                              min="1"
                              className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-purple-700 focus:border-purple-300 outline-none" 
                              value={form.bundleQuantity} 
                              onChange={e => setForm(prev => ({ ...prev, bundleQuantity: Number(e.target.value) }))} 
                              required 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-purple-600 uppercase block ml-1">Preço do Combo (R$)</label>
                            <input 
                              type="text" 
                              className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-purple-700 focus:border-purple-300 outline-none" 
                              value={formatCurrency(form.bundlePrice || 0)} 
                              onChange={e => setForm(prev => ({ ...prev, bundlePrice: parseCurrency(e.target.value) }))} 
                              required 
                            />
                          </div>
                       </div>
                    )}



                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-400 uppercase block ml-1">Início</label>
                          <input type="date" className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-red-500 outline-none" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-400 uppercase block ml-1">Término</label>
                          <input type="date" className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-red-500 outline-none" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 flex flex-col min-h-0">
                    <label className="text-[9px] font-black text-zinc-400 uppercase block ml-1">Selecionar Produtos Participantes</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input type="text" placeholder="Buscar produto por nome ou SKU..." className="w-full border-2 rounded-xl pl-9 pr-4 py-2 text-xs font-bold bg-zinc-50 outline-none focus:border-red-500" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                    </div>
                    <div className="flex-1 border-2 rounded-2xl overflow-y-auto custom-scroll bg-zinc-50 p-2 space-y-1 max-h-[300px]">
                        {filteredProds.map(p => (
                          <div key={p.id} onClick={() => toggleProduct(p.id)} className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${form.productIds?.includes(p.id) ? 'bg-red-600 text-white shadow-md' : 'bg-white hover:bg-red-50 text-zinc-700'}`}>
                             <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-black uppercase truncate">{p.name}</span>
                                <span className={`text-[8px] font-mono ${form.productIds?.includes(p.id) ? 'text-red-200' : 'text-zinc-400'}`}>SKU: {p.sku}</span>
                             </div>
                             {form.productIds?.includes(p.id) ? <CheckCircle2 size={14} /> : <Plus size={14} className="text-zinc-300" />}
                          </div>
                        ))}
                        {filteredProds.length === 0 && <p className="text-center py-4 text-[10px] text-zinc-400 font-bold uppercase italic">Nenhum produto encontrado...</p>}
                    </div>
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex justify-between items-center">
                       <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Selecionados</span>
                       <span className="text-xs font-black text-red-600">{form.productIds?.length || 0} Peças</span>
                    </div>
                  </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-4 shrink-0">
              <button type="button" onClick={() => setModal(false)} className="px-5 py-2 text-zinc-400 font-black uppercase text-[10px]">DESCARTAR</button>
              <button type="submit" className="bg-red-600 text-white px-10 py-3 rounded-xl font-black uppercase text-[10px] shadow-xl hover:bg-red-700 active:scale-95">SALVAR CAMPANHA</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE PDV ---

const SalesViewComponent = ({ user, products, setProducts, setSales, setMovements, vendedores, cashSession, setCashSession, settings, exchangeCredit, setExchangeCredit, campaigns, setCampaigns, fiados, setFiados }: any) => {
  const isMasterUser = user.id === 0 || user.email === 'master@internal';
  const isAdmin = user.role === 'admin' || isMasterUser;
  
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [isExact, setIsExact] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [appliedPayments, setAppliedPayments] = useState<PaymentRecord[]>([]);
  const [currentPayMethod, setCurrentPayMethod] = useState('Pix');
  const [currentPayAmount, setCurrentPayAmount] = useState(0);
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [f12Client, setF12Client] = useState('');
  const [f12Desc, setF12Desc] = useState('');
  const [f12Date, setF12Date] = useState('');
  const [installments, setInstallments] = useState(1);
  const [assignedVendedor, setAssignedVendedor] = useState(user.name);
  const [modalFluxo, setModalFluxo] = useState<'entrada' | 'retirada' | null>(null);
  const [authRequest, setAuthRequest] = useState<'entrada' | 'retirada' | null>(null);
  const [fluxoDesc, setFluxoDesc] = useState('');
  const [fluxoVal, setFluxoVal] = useState(0);
  const [receiptData, setReceiptData] = useState<Sale | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('percent');
  const [discountInput, setDiscountInput] = useState<number>(0);

  const filtered = useMemo(() => {
    const active = products.filter((p: Product) => p.active && p.stock > 0);
    if (!search) return active;
    const t = search.toLowerCase();
    return active.filter((p: Product) => {
      if (isExact) {
        return p.name.toLowerCase() === t || p.sku.toLowerCase() === t;
      }
      return p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t);
    });
  }, [products, search, isExact]);

  const getQualifyingCampaign = useCallback((productId: number) => {
    const now = new Date();
    return (campaigns || []).find((c: Campaign) => {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end && c.productIds?.includes(productId);
    });
  }, [campaigns]);

  const applyAutomaticCampaigns = useCallback((currentCart: SaleItem[]) => {
    let newCart = [...currentCart];
    
    newCart = newCart.map(item => ({ 
      ...item, 
      discountValue: 0, 
      campaignName: undefined, 
      campaignType: undefined 
    }));

    const activeXYCampaigns = (campaigns || []).filter((c: Campaign) => {
      const now = new Date();
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      end.setHours(23, 59, 59, 999);
      return c.type === 'buy_x_get_y' && now >= start && now <= end;
    });

    activeXYCampaigns.forEach((camp: Campaign) => {
      const qualifyingItems = newCart.filter(item => camp.productIds.includes(item.productId));
      const totalUnits = qualifyingItems.reduce((acc, item) => acc + item.quantity, 0);
      
      const leveY = camp.leveY || 1;
      const pagueX = camp.pagueX || 0;
      
      if (totalUnits >= leveY) {
        const freePerBundle = leveY - pagueX;
        const freeUnitsTotal = Math.floor(totalUnits / leveY) * freePerBundle;
        
        let allUnits: { cartId: string, price: number }[] = [];
        qualifyingItems.forEach(item => {
          for(let k = 0; k < item.quantity; k++) {
            allUnits.push({ cartId: item.cartId, price: item.price });
          }
        });

        allUnits.sort((a, b) => a.price - b.price);
        
        const unitsToDiscount = allUnits.slice(0, freeUnitsTotal);
        
        unitsToDiscount.forEach(unit => {
          const cartIdx = newCart.findIndex(it => it.cartId === unit.cartId);
          if (cartIdx !== -1) {
            newCart[cartIdx].discountValue += unit.price;
            newCart[cartIdx].campaignName = camp.name;
            newCart[cartIdx].campaignType = 'buy_x_get_y';
          }
        });
      }
    });

    const activeBundleCampaigns = (campaigns || []).filter((c: Campaign) => {
      const now = new Date();
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      end.setHours(23, 59, 59, 999);
      return c.type === 'bundle' && now >= start && now <= end;
    });

    activeBundleCampaigns.forEach((camp: Campaign) => {
      const qualifyingItems = newCart.filter(item => camp.productIds.includes(item.productId));
      const totalQty = qualifyingItems.reduce((acc, item) => acc + item.quantity, 0);
      const bundleQty = camp.bundleQuantity || 1;

      if (totalQty >= bundleQty) {
        const setsCount = Math.floor(totalQty / bundleQty);
        const targetPricePerSet = camp.bundlePrice || 0;
        
        let allUnits: { cartId: string, price: number }[] = [];
        qualifyingItems.forEach(item => {
          for(let k = 0; k < item.quantity; k++) {
            allUnits.push({ cartId: item.cartId, price: item.price });
          }
        });

        allUnits.sort((a, b) => b.price - a.price);

        const unitsInBundles = allUnits.slice(0, setsCount * bundleQty);
        const originalBundlesTotal = unitsInBundles.reduce((acc, u) => acc + u.price, 0);
        const targetBundlesTotal = setsCount * targetPricePerSet;
        const totalDiscountToApply = Math.max(0, originalBundlesTotal - targetBundlesTotal);

        unitsInBundles.forEach(unit => {
          const cartIdx = newCart.findIndex(it => it.cartId === unit.cartId);
          if (cartIdx !== -1) {
            const proportionalDiscount = totalDiscountToApply / unitsInBundles.length;
            newCart[cartIdx].discountValue += proportionalDiscount;
            newCart[cartIdx].campaignName = camp.name;
            newCart[cartIdx].campaignType = 'bundle';
          }
        });
      }
    });

    newCart = newCart.map(item => {
      if (item.campaignType) return item; 
      const camp = getQualifyingCampaign(item.productId);
      if (camp && camp.type === 'fixed_price') {
        const fixedVal = camp.fixedPriceValue || 0;
        const disc = Math.max(0, (item.price - fixedVal) * item.quantity);
        return { ...item, discountValue: disc, campaignName: camp.name, campaignType: 'fixed_price' };
      }
      return item;
    });

    newCart = newCart.map(item => {
      if (item.campaignType) return item; 
      const camp = getQualifyingCampaign(item.productId);
      if (camp && camp.type === 'percentage') {
        const disc = (item.price * item.quantity) * (camp.discountPercent / 100);
        return { ...item, discountValue: disc, campaignName: camp.name, campaignType: 'percentage' };
      }
      return item;
    });

    return newCart;
  }, [campaigns, getQualifyingCampaign]);

  const addDirectly = useCallback((p: Product) => {
    const totalInCart = cart.filter(item => item.productId === p.id).reduce((acc, item) => acc + item.quantity, 0);
    if (totalInCart + 1 > p.stock) {
        alert('Estoque insuficiente para este produto!');
        return;
    }

    const newItem: SaleItem = { 
      cartId: Math.random().toString(36).substr(2, 9),
      productId: p.id, 
      name: p.name, 
      sku: p.sku,
      quantity: 1,
      price: p.price,
      size: p.size,
      color: p.color,
      discountValue: 0,
      manualDiscountValue: 0,
      manualDiscountInput: 0,
      manualDiscountType: 'value',
      discountBlocked: p.discountBlocked || false
    };

    const updatedCart = applyAutomaticCampaigns([...cart, newItem]);
    setCart(updatedCart);
    setSelectedId(''); 
    setSearch(''); 
    setTimeout(() => searchInputRef.current?.focus(), 10);
  }, [cart, applyAutomaticCampaigns]);

  const updateQuantity = (cartId: string, delta: number) => {
    const item = cart.find(i => i.cartId === cartId);
    if (!item) return;
    
    const prod = products.find((p: Product) => p.id === item.productId);
    if (!prod) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      const updated = applyAutomaticCampaigns(cart.filter(i => i.cartId !== cartId));
      setCart(updated);
      return;
    }

    if (delta > 0) {
       const totalInCart = cart.filter(i => i.productId === item.productId).reduce((acc, it) => acc + it.quantity, 0);
       if (totalInCart + 1 > prod.stock) return alert('Limite de estoque!');
    }

    const updatedItems = cart.map(i => i.cartId === cartId ? { ...i, quantity: newQty } : i);
    setCart(applyAutomaticCampaigns(updatedItems));
  };

  const removeFromCart = (cartId: string) => {
    setCart(applyAutomaticCampaigns(cart.filter(i => i.cartId !== cartId)));
  };

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length >= 3) {
      const match = products.find((p: Product) => p.active && p.sku.toLowerCase() === trimmed.toLowerCase());
      if (match) { addDirectly(match); }
    }
  }, [search, products, addDirectly]);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, i) => acc + (i.price * i.quantity) - i.discountValue - i.manualDiscountValue, 0);
  }, [cart]);

  const totalGrossDiscretionaryBase = useMemo(() => {
    return cart.filter(it => !it.discountBlocked).reduce((acc, i) => acc + (i.price * i.quantity), 0);
  }, [cart]);

  const totalManualItemDiscounts = useMemo(() => {
    return cart.reduce((acc, it) => acc + it.manualDiscountValue, 0);
  }, [cart]);
  
  const globalDiscountValue = useMemo(() => {
    const inputVal = Number(discountInput) || 0;
    const limitPct = isAdmin ? 100 : settings.maxGlobalDiscount;
    
    const maxTotalBudget = totalGrossDiscretionaryBase * (limitPct / 100);
    const availableForGlobal = Math.max(0, maxTotalBudget - totalManualItemDiscounts);

    let requested = 0;
    if (discountType === 'percent') {
      requested = totalGrossDiscretionaryBase * (inputVal / 100);
    } else {
      requested = inputVal;
    }

    return Math.min(requested, availableForGlobal);
  }, [cart, discountInput, discountType, settings.maxGlobalDiscount, isAdmin, totalGrossDiscretionaryBase, totalManualItemDiscounts]);

  const totalCartBeforeCredit = Math.max(0, subtotal - globalDiscountValue);
  const creditToUse = Math.min(totalCartBeforeCredit, exchangeCredit);
  const remainingExchangeCredit = Math.max(0, exchangeCredit - creditToUse);
  const totalFinalToPay = Math.max(0, totalCartBeforeCredit - exchangeCredit);
  
  const totalPaid = appliedPayments.reduce((acc, p) => acc + p.amount, 0);
  const remainingBalanceToSettle = Math.max(0, totalFinalToPay - totalPaid);
  const changeValue = Math.max(0, totalPaid - totalFinalToPay);

  useEffect(() => {
    setCurrentPayAmount(parseFloat(remainingBalanceToSettle.toFixed(2)));
  }, [totalFinalToPay, totalPaid, remainingBalanceToSettle]);

  const calculatedInstallment = useMemo(() => {
    if (currentPayMethod !== 'C. Parcelado' || installments < 1) return currentPayAmount;
    const totalWithInterest = currentPayAmount * (1 + (settings.cardFees.creditInstallments / 100));
    return totalWithInterest / installments;
  }, [currentPayAmount, currentPayMethod, installments, settings.cardFees.creditInstallments]);

  const handleFinish = () => {
    if (cart.length === 0) return;
    if (totalPaid < totalFinalToPay - 0.01 && totalFinalToPay > 0) {
      alert(`Pendente de recebimento: R$ ${remainingBalanceToSettle.toFixed(2)}`);
      return;
    }
    
    const totalDiscountRecorded = cart.reduce((acc, i) => acc + i.discountValue + i.manualDiscountValue, 0) + globalDiscountValue;
    const initialBruto = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const sale: Sale = { 
      id: Date.now(), 
      date: new Date().toISOString(), 
      subtotal: initialBruto, 
      discount: totalDiscountRecorded, 
      discountPercent: initialBruto > 0 ? (totalDiscountRecorded / initialBruto) * 100 : 0,
      total: totalFinalToPay, 
      payments: [...appliedPayments], 
      user: assignedVendedor, 
      adminUser: user.name, 
      items: [...cart], 
      change: changeValue,
      exchangeCreditUsed: creditToUse
    };
    setSales((prev: any) => [sale, ...prev]);

    const f12Payments = appliedPayments.filter(p => p.method === 'F12');
    if (f12Payments.length > 0) {
       const newFiados: FiadoRecord[] = f12Payments.map(p => ({
          id: Math.random().toString(36).substr(2, 9),
          saleId: sale.id,
          clientName: p.f12ClientName || 'Desconhecido',
          description: p.f12Description || 'Sem observação',
          totalAmount: p.amount,
          remainingAmount: p.amount,
          createdAt: new Date().toISOString(),
          dueDate: p.f12DueDate || new Date().toISOString(),
          vendedor: assignedVendedor,
          status: 'pending',
          items: [...cart]
       }));
       setFiados((prev: FiadoRecord[]) => [...newFiados, ...prev]);
    }

    setProducts(products.map((p: Product) => {
      const items = cart.filter(i => i.productId === p.id);
      const totalQty = items.reduce((acc, i) => acc + i.quantity, 0);
      return totalQty > 0 ? { ...p, stock: p.stock - totalQty } : p;
    }));

    setMovements((prev: any) => [...cart.map(i => ({
      id: Math.random(), productId: i.productId, productName: i.name, type: 'saida', quantity: i.quantity, reason: 'Venda PDV', date: new Date().toISOString(), user: assignedVendedor
    })), ...prev]);



    const cashPaid = appliedPayments.filter(p => p.method === 'Dinheiro').reduce((acc, p) => acc + p.amount, 0) - changeValue;
    if (cashPaid !== 0 && (cashSession || isMasterUser)) {
      const newLog: CashLog = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'venda',
        amount: Math.abs(cashPaid),
        description: `Venda #${sale.id.toString().slice(-4)}`,
        time: new Date().toISOString(),
        user: assignedVendedor
      };
      if (cashSession) {
          setCashSession((prev: CashSession) => ({
            ...prev,
            currentBalance: prev.currentBalance + cashPaid,
            logs: [newLog, ...prev.logs]
          }));
      }
    }
    
    setReceiptData(sale);
    setCart([]); 
    setAppliedPayments([]); 
    setDiscountInput(0); 
    setExchangeCredit(remainingExchangeCredit);
  };

  const addPayment = () => {
    if (currentPayAmount <= 0) return;
    
    if (currentPayMethod === 'F12') {
       if (!f12Client.trim()) {
          alert('Por favor, informe o nome do cliente para o registro F12.');
          return;
       }
    }

    let net = currentPayAmount;
    if (currentPayMethod === 'C. Débito') net = currentPayAmount * (1 - settings.cardFees.debit / 100);
    else if (currentPayMethod === 'C. Crédito') net = currentPayAmount * (1 - settings.cardFees.credit1x / 100);
    else if (currentPayMethod === 'C. Parcelado') net = currentPayAmount * (1 - settings.cardFees.creditInstallments / 100);
    else if (currentPayMethod === 'F12') net = 0; 
    
    setAppliedPayments([...appliedPayments, { 
      method: currentPayMethod, 
      amount: currentPayAmount,
      installments: currentPayMethod === 'C. Parcelado' ? installments : undefined,
      installmentValue: currentPayMethod === 'C. Parcelado' ? calculatedInstallment : undefined,
      netAmount: parseFloat(net.toFixed(2)),
      f12ClientName: currentPayMethod === 'F12' ? f12Client.trim().toUpperCase() : undefined,
      f12Description: currentPayMethod === 'F12' ? f12Desc.trim() : undefined,
      f12DueDate: currentPayMethod === 'F12' ? f12Date : undefined
    }]);

    setF12Client('');
    setF12Desc('');
    setF12Date('');
    setInstallments(1);
    setCurrentPayAmount(0);
    setVoucherCodeInput('');
  };

  const removePayment = (index: number) => {
    setAppliedPayments(prev => prev.filter((_, i) => i !== index));
  };

  const requestFluxo = (type: 'entrada' | 'retirada') => {
    if (type === 'entrada' || isAdmin) {
      setModalFluxo(type);
    } else {
      setAuthRequest(type);
    }
  };

  const handleAuthorization = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const userOrEmail = (form.elements.namedItem('authUser') as HTMLInputElement).value;
    const pass = (form.elements.namedItem('authPass') as HTMLInputElement).value;
    const isAuthMaster = userOrEmail === 'master' && pass === '965088';
    const authAdmin = vendedores.find((v: User) => (v.email === userOrEmail || v.name === userOrEmail) && v.password === pass && v.role === 'admin');
    if (isAuthMaster || authAdmin) {
      setModalFluxo(authRequest);
      setAuthRequest(null);
    } else {
      alert('Credenciais de Administrador inválidas!');
    }
  };

  const creditBalanceResult = exchangeCredit - totalCartBeforeCredit;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between shrink-0">
         <h2 className="text-xl font-black text-zinc-900 tracking-tighter italic uppercase">Caixa - Painel de Vendas</h2>
         <div className="flex items-center gap-3">
            {exchangeCredit > 0 && (
              <div className={`${creditBalanceResult >= 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'} px-4 py-1.5 rounded-lg border flex items-center gap-2 animate-pulse shadow-sm`}>
                <RotateCcw size={14} />
                <span className="text-xs font-black uppercase">
                  {creditBalanceResult >= 0 
                    ? `CRÉDITO RESTANTE: R$ ${creditBalanceResult.toFixed(2)}` 
                    : `PENDENTE: R$ ${Math.abs(creditBalanceResult).toFixed(2)}`}
                </span>
                <button onClick={() => setExchangeCredit(0)} className="ml-1 hover:opacity-70 transition-opacity"><X size={14}/></button>
              </div>
            )}
            <div className="bg-zinc-950 text-white px-4 py-1.5 rounded-lg shadow-lg border border-zinc-800 flex items-center gap-2">
               <Wallet size={14} className="text-red-400"/>
               <span className="text-base font-black font-mono">R$ {cashSession?.currentBalance?.toFixed(2) || '0.00'}</span>
            </div>
            {(cashSession || isMasterUser) && (
              <div className="flex gap-1">
                 <button type="button" onClick={() => requestFluxo('entrada')} className="bg-white border border-zinc-200 p-2 rounded-lg text-green-600 hover:bg-green-50 transition-all shadow-sm" title="Entrada de Caixa"><ArrowUpCircle size={18}/></button>
                 <button type="button" onClick={() => requestFluxo('retirada')} className="bg-white border border-zinc-200 p-2 rounded-lg text-red-500 hover:bg-red-50 transition-all shadow-sm" title="Sangria de Caixa"><ArrowDownCircle size={18}/></button>
              </div>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        <div className="lg:col-span-8 flex flex-col gap-3 min-h-0">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-zinc-200">
            <div className="flex gap-3 items-end">
              <div className="flex-[5] space-y-0.5">
                <div className="flex justify-between items-center ml-1">
                   <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">BUSCAR</label>
                   <button 
                    type="button" 
                    onClick={() => setIsExact(!isExact)}
                    className={`text-[8px] font-black uppercase px-2 py-0.5 rounded transition-all flex items-center gap-1 ${isExact ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'}`}
                   >
                     <Target size={10} /> {isExact ? 'EXATA' : 'PARCIAL'}
                   </button>
                </div>
                <div className="relative group">
                  <Search size={14} className={`absolute left-3 top-2.5 transition-colors ${isExact ? 'text-red-500' : 'text-zinc-400'}`} />
                  <input 
                    ref={searchInputRef} 
                    type="text" 
                    placeholder={isExact ? "Nome Exato ou SKU..." : "Nome ou SKU..."} 
                    className={`w-full border rounded-lg pl-9 pr-3 py-2 bg-zinc-50 text-zinc-800 outline-none transition-all font-bold text-[11px] ${isExact ? 'border-red-500 ring-2 ring-red-50' : 'focus:border-red-500'}`} 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    autoFocus 
                  />
                </div>
              </div>
              <div className="flex-[7] space-y-0.5">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">SELECIONAR</label>
                <select className="w-full border rounded-lg px-3 py-2 bg-zinc-50 text-zinc-800 font-bold outline-none focus:border-red-500 transition-all text-[11px] cursor-pointer" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                  <option value="">Lista de itens...</option>
                  {filtered.map((p: Product) => (<option key={p.id} value={p.id}>[{p.sku}] {p.name} - R$ {formatCurrency(p.price)}</option>))}
                </select>
              </div>
              <div className="flex items-end">
                <button type="button" onClick={() => { const p = products.find((x: Product) => x.id === Number(selectedId)); if (p) addDirectly(p); }} className="px-8 py-2 bg-red-600 text-white font-black rounded-lg hover:bg-red-700 transition-all uppercase text-[10px] tracking-widest shadow active:scale-95 h-[34px]">OK</button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-2 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
               <h3 className="text-[9px] font-black text-zinc-500 uppercase flex items-center gap-1.5"><ShoppingCart size={12} className="text-red-600"/>CHECKOUT</h3>
               <span className="text-[8px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{cart.length} itens</span>
            </div>
            <div className="flex-1 overflow-auto custom-scroll">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="bg-zinc-50 sticky top-0 z-10 text-[8px] font-black text-zinc-400 uppercase tracking-widest border-b">
                  <tr>
                    <th className="px-4 py-2">ITEM</th>
                    <th className="px-4 py-2 text-center">UN</th>
                    <th className="px-4 py-2 text-right">PREÇO</th>
                    <th className="px-4 py-2 text-center">DESC. AUTO</th>
                    <th className="px-4 py-2 text-center">DESC. ITEM</th>
                    <th className="px-4 py-2 text-right">TOTAL</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {cart.map((item) => (
                    <tr key={item.cartId} className="hover:bg-zinc-50 transition-all group">
                      <td className="px-4 py-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-800 text-[11px] leading-tight">{item.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[8px] font-black text-red-600 uppercase font-mono">{item.sku}</span>
                            {(item.size || item.color) && (
                              <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter">
                                • {item.size ? `QLD: ${item.size}` : ''} {item.color ? ` / COR: ${item.color}` : ''}
                              </span>
                            )}
                          </div>
                          {item.campaignName && (
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md w-fit mt-1 uppercase italic shadow-sm animate-in zoom-in ${
                                item.campaignType === 'buy_x_get_y' ? 'bg-red-100 text-red-700' : 
                                item.campaignType === 'percentage' ? 'bg-red-100 text-red-600' : 
                                item.campaignType === 'bundle' ? 'bg-purple-100 text-purple-700' : 
                                item.campaignType === 'fixed_price' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-amber-100 text-amber-700'}`}>
                                {item.campaignType === 'buy_x_get_y' ? 'Promo Leve+' : 
                                 item.campaignType === 'percentage' ? 'Promo' : 
                                 item.campaignType === 'bundle' ? 'Combo' : 
                                 item.campaignType === 'fixed_price' ? 'Preço Fixo' :
                                 'Cupom'}: {item.campaignName}
                            </span>
                          )}
                          {item.discountBlocked && (
                            <span className="text-[7px] font-black px-1.5 py-0.5 rounded-md w-fit mt-1 uppercase bg-zinc-900 text-white shadow-sm flex items-center gap-1">
                               <ShieldAlert size={8} /> Desconto Bloqueado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5 bg-zinc-100 rounded-md p-0.5 w-fit mx-auto">
                           <button onClick={() => updateQuantity(item.cartId, -1)} className="p-0.5 hover:text-red-500 transition-colors"><ChevronLeft size={14}/></button>
                           <span className="font-black text-zinc-600 text-[11px] min-w-[12px] text-center">{item.quantity}</span>
                           <button onClick={() => updateQuantity(item.cartId, 1)} className="p-0.5 hover:text-red-600 transition-colors"><ChevronRight size={14}/></button>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[10px] text-zinc-400">R$ {formatCurrency(item.price)}</td>
                      <td className="px-4 py-2 text-center">
                         <span className={`text-[10px] font-black font-mono ${item.discountValue > 0 ? 'text-red-500' : 'text-zinc-300'}`}>
                           - R$ {formatCurrency(item.discountValue)}
                         </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`relative w-40 mx-auto flex items-center bg-zinc-50 border rounded-lg transition-all ${item.discountBlocked ? 'opacity-30 pointer-events-none' : 'focus-within:border-red-400'}`}>
                            <div className="flex bg-zinc-100 rounded-l-lg border-r overflow-hidden h-full shrink-0">
                               <button 
                                 type="button" 
                                 onClick={() => {
                                   setCart(prev => prev.map(it => it.cartId === item.cartId ? { ...it, manualDiscountType: 'percent', manualDiscountValue: 0, manualDiscountInput: 0 } : it));
                                 }} 
                                 className={`w-8 py-1 flex items-center justify-center ${item.manualDiscountType === 'percent' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:bg-zinc-200'}`}
                               >
                                 <Percent size={14} />
                               </button>
                               <button 
                                 type="button" 
                                 onClick={() => {
                                   setCart(prev => prev.map(it => it.cartId === item.cartId ? { ...it, manualDiscountType: 'value', manualDiscountValue: 0, manualDiscountInput: 0 } : it));
                                 }} 
                                 className={`w-8 py-1 flex items-center justify-center ${item.manualDiscountType === 'value' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:bg-zinc-200'}`}
                               >
                                 <DollarSign size={14} />
                               </button>
                            </div>
                            <input 
                              type="text"
                              disabled={item.discountBlocked}
                              className="w-full px-2 py-1 text-[10px] font-black font-mono text-center outline-none bg-transparent"
                              placeholder="0"
                              value={item.manualDiscountType === 'value' ? formatCurrency(item.manualDiscountInput || 0) : (item.manualDiscountInput || 0)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                let val = 0;
                                if (item.manualDiscountType === 'value') {
                                  val = parseCurrency(raw);
                                } else {
                                  val = Number(raw.replace(/\D/g, '')) || 0;
                                }

                                const totalGross = cart.filter(it => !it.discountBlocked).reduce((acc, i) => acc + (i.price * i.quantity), 0);
                                const limitPct = isAdmin ? 100 : settings.maxGlobalDiscount;
                                const maxTotalBudget = isAdmin ? totalGross : (totalGross * (limitPct / 100));

                                const otherManualItems = cart.filter(it => it.cartId !== item.cartId).reduce((acc, it) => acc + it.manualDiscountValue, 0);
                                
                                let currentGlobalVal = 0;
                                if (discountType === 'percent') { currentGlobalVal = totalGross * (discountInput / 100); }
                                else { currentGlobalVal = discountInput; }
                                currentGlobalVal = Math.min(currentGlobalVal, maxTotalBudget);

                                const budgetRemainingForThisItem = Math.max(0, maxTotalBudget - otherManualItems - currentGlobalVal);

                                const itemGross = item.price * item.quantity;
                                let absoluteRequested = 0;
                                if (item.manualDiscountType === 'percent') { absoluteRequested = itemGross * (val / 100); }
                                else { absoluteRequested = val; }

                                const clampedAbsolute = Math.min(absoluteRequested, budgetRemainingForThisItem, itemGross);
                                
                                let clampedInput = val;
                                if (clampedAbsolute < absoluteRequested) {
                                   if (item.manualDiscountType === 'percent') {
                                      clampedInput = itemGross > 0 ? (clampedAbsolute / itemGross) * 100 : 0;
                                   } else {
                                      clampedInput = clampedAbsolute;
                                   }
                                }
                                
                                setCart(prev => prev.map(it => it.cartId === item.cartId ? { ...it, manualDiscountInput: clampedInput, manualDiscountValue: clampedAbsolute } : it));
                              }}
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right"><span className="font-black text-zinc-900 font-mono text-[11px]">R$ {formatCurrency((item.price * item.quantity) - item.discountValue - item.manualDiscountValue)}</span></td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={() => removeFromCart(item.cartId)} className="p-1 text-zinc-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-3 min-0">
          <div className="bg-white p-4 rounded-xl shadow-xl border border-zinc-200 flex flex-col h-full overflow-hidden">
            <h3 className="text-[11px] font-black text-zinc-800 mb-3 flex items-center gap-2 border-b pb-2 uppercase tracking-tighter italic"><ReceiptText size={14} className="text-red-600" /> RESUMO</h3>
            <div className="space-y-4 flex-1 overflow-auto custom-scroll pr-1">
              <div className="bg-zinc-950 p-4 rounded-xl text-white relative overflow-hidden shadow-xl">
                 <div className="relative z-10 space-y-2">
                   <div className="flex justify-between items-center opacity-40">
                      <span className="text-[8px] font-black uppercase">SUBTOTAL (C/ DESC. ITENS)</span>
                      <span className="text-[9px] font-mono font-black">R$ {formatCurrency(subtotal)}</span>
                   </div>
                   {creditToUse > 0 && (
                     <div className="flex justify-between items-center border-t border-white/10 pt-1">
                       <span className="text-[8px] font-black uppercase text-amber-400">CRÉDITO UTILIZADO</span>
                       <span className="text-[9px] font-mono font-black text-amber-400">- R$ {formatCurrency(creditToUse)}</span>
                     </div>
                   )}
                   <div className="space-y-1 pt-1 border-t border-zinc-800">
                      <label className="text-[8px] font-black text-red-400 uppercase">DESCONTO GERAL</label>
                      <div className="flex items-center gap-1.5">
                         <div className="flex bg-zinc-900 rounded-md overflow-hidden border border-zinc-800">
                            <button type="button" onClick={() => setDiscountType('percent')} className={`px-1.5 py-1 text-[9px] ${discountType === 'percent' ? 'bg-red-600' : 'text-zinc-500'}`}><Percent size={10}/></button>
                            <button type="button" onClick={() => setDiscountType('value')} className={`px-1.5 py-1 text-[9px] ${discountType === 'value' ? 'bg-red-600' : 'text-zinc-500'}`}><DollarSign size={10}/></button>
                         </div>
                         <div className="relative flex-1">
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] text-zinc-500 font-mono mr-1">{discountType === 'percent' ? '%' : 'R$'}</span>
                            <input 
                              type="text" 
                              onFocus={(e) => e.target.select()} 
                              className="w-full bg-transparent border-b border-zinc-800 outline-none text-red-400 font-black text-sm pr-4 text-right font-mono" 
                              value={discountType === 'value' ? formatCurrency(discountInput) : discountInput} 
                              onChange={e => {
                                if (discountType === 'value') {
                                  setDiscountInput(parseCurrency(e.target.value));
                                } else {
                                  const val = e.target.value.replace(/\D/g, '');
                                  setDiscountInput(Number(val));
                                }
                              }} 
                            />
                         </div>
                      </div>
                   </div>
                   <div className="flex justify-between items-end pt-1 border-b border-zinc-800 pb-2">
                      <span className="text-[8px] font-black uppercase text-red-300">TOTAL FINAL</span>
                      <span className="text-2xl font-black text-white font-mono">R$ {formatCurrency(totalFinalToPay)}</span>
                   </div>
                   <div className="flex justify-between items-center pt-2 mt-1 bg-white/5 p-2 rounded-lg">
                      <span className="text-[9px] font-black uppercase text-amber-400">TROCO</span>
                      <span className="text-xl font-black text-amber-500 font-mono italic">R$ {formatCurrency(changeValue)}</span>
                   </div>
                 </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-zinc-400 uppercase ml-1">VENDEDOR RESPONSÁVEL</label>
                  <select className="w-full border rounded-lg px-2.5 py-2 bg-zinc-50 text-zinc-800 font-black text-[10px] uppercase cursor-pointer focus:border-red-500 outline-none transition-all" value={assignedVendedor} onChange={e => setAssignedVendedor(e.target.value)}>
                    {vendedores.map((v: User) => (<option key={v.id} value={v.name}>{v.name}</option>))}
                    {user.id === 0 && !vendedores.find((v: User) => v.name === user.name) && (<option value={user.name}>{user.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-zinc-400 uppercase ml-1">FORMA DE PAGAMENTO</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    <select className="w-full border rounded-lg px-2.5 py-2 bg-zinc-50 text-zinc-800 font-black text-[10px] uppercase cursor-pointer focus:border-red-500 outline-none transition-all" value={currentPayMethod} onChange={e => {
                        const val = e.target.value;
                        setCurrentPayMethod(val);
                    }}>
                      <option>Pix</option><option>Dinheiro</option><option>C. Débito</option><option>C. Crédito</option><option>C. Parcelado</option><option>F12</option>
                    </select>

                    {currentPayMethod === 'F12' && (
                        <div className="animate-in fade-in slide-in-from-top-1 bg-red-50 p-3 rounded-lg border border-red-200 space-y-2">
                           <div>
                              <label className="text-[8px] font-black uppercase text-red-600">Nome do Cliente</label>
                              <input 
                                type="text" 
                                placeholder="CLIENTE AMIGO"
                                className="w-full border rounded-md px-2 py-1.5 text-[10px] font-black uppercase bg-white outline-none focus:border-red-400 mt-0.5"
                                value={f12Client}
                                onChange={e => setF12Client(e.target.value.toUpperCase())}
                              />
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                              <div>
                                 <label className="text-[8px] font-black uppercase text-red-600">Vencimento</label>
                                 <input 
                                    type="date" 
                                    className="w-full border rounded-md px-2 py-1 text-[10px] font-black bg-white outline-none focus:border-red-400 mt-0.5"
                                    value={f12Date}
                                    onChange={e => setF12Date(e.target.value)}
                                 />
                              </div>
                              <div>
                                 <label className="text-[8px] font-black uppercase text-red-600">Condições/Desc.</label>
                                 <input 
                                    type="text" 
                                    placeholder="Ex: 2x no mês"
                                    className="w-full border rounded-md px-2 py-1 text-[10px] font-black bg-white outline-none focus:border-red-400 mt-0.5"
                                    value={f12Desc}
                                    onChange={e => setF12Desc(e.target.value)}
                                 />
                              </div>
                           </div>
                        </div>
                    )}

                    {currentPayMethod === 'C. Parcelado' && (
                      <div className="animate-in fade-in slide-in-from-top-1 space-y-1 bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                          <div className="flex items-center justify-between">
                              <label className="text-[8px] font-black uppercase text-zinc-400">Parcelas</label>
                              <input type="number" min="1" max="12" onFocus={(e) => e.target.select()} className="w-14 border rounded px-1.5 py-0.5 text-[11px] text-center font-black" value={installments} onChange={e => setInstallments(Math.min(12, Math.max(1, Number(e.target.value))))} />
                          </div>
                          <div className="text-center pt-0.5 border-t border-zinc-100">
                              <p className="text-[9px] font-black text-red-600 leading-none">{installments}x R$ {formatCurrency(calculatedInstallment)}</p>
                              <p className="text-[7px] text-zinc-400 italic">Taxa: {settings.cardFees.creditInstallments}%</p>
                          </div>
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-zinc-300">R$</span>
                        <input 
                          type="text" 
                          onFocus={(e) => e.target.select()} 
                          className="w-full border rounded-lg pl-7 pr-2.5 py-2 bg-zinc-50 text-zinc-800 font-black text-[11px] text-right font-mono focus:border-red-500 outline-none transition-all" 
                          value={formatCurrency(currentPayAmount)} 
                          onChange={e => setCurrentPayAmount(parseCurrency(e.target.value))} 
                        />
                      </div>
                      <button type="button" onClick={addPayment} className={`px-3 ${currentPayMethod === 'F12' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600 hover:bg-red-700'} text-white rounded-lg active:scale-90 flex items-center justify-center shadow transition-all`} title="Adicionar Pagamento"><Plus size={16}/></button>
                    </div>
                    {appliedPayments.length > 0 && (
                      <div className="mt-3 bg-red-50/50 p-3 rounded-xl border border-dashed border-red-200 space-y-2 animate-in fade-in">
                        <p className="text-[8px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Wallet size={10} /> Pagamentos Lançados
                        </p>
                        <div className="space-y-1.5">
                          {appliedPayments.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm border border-red-50 group">
                              <div className="flex flex-col min-w-0">
                                <span className="text-[9px] font-black text-zinc-700 uppercase truncate">
                                    {p.method}
                                    {p.method === 'F12' ? ` (${p.f12ClientName})` : ''}
                                </span>
                                {p.installments && <span className="text-[7px] text-zinc-400 font-bold">{p.installments}x de R$ {formatCurrency(p.installmentValue || 0)}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className={`text-[10px] font-black font-mono ${p.method === 'F12' ? 'text-purple-600' : 'text-red-600'}`}>R$ {formatCurrency(p.amount)}</span>
                                <button type="button" onClick={() => removePayment(idx)} className="text-zinc-300 hover:text-red-500 transition-colors p-0.5 hover:bg-red-50 rounded">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <button 
              type="button" 
              onClick={handleFinish} 
              disabled={(totalFinalToPay > 0 && totalPaid < totalFinalToPay - 0.01) || cart.length === 0} 
              className={`w-full py-3 rounded-lg font-black text-xs shadow-lg transition-all uppercase tracking-[0.2em] mt-3 active:scale-95 ${((totalFinalToPay > 0 && totalPaid < totalFinalToPay - 0.01) || cart.length === 0) ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
            >
              Concluir
            </button>
          </div>
        </div>
      </div>

      {receiptData && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[150] animate-in fade-in no-print-overlay">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl space-y-6 animate-in zoom-in-95 overflow-hidden">
             <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full mx-auto flex items-center justify-center border border-green-100">
                    <Check size={32} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-black text-zinc-900 uppercase italic">Venda Concluída!</h3>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-relaxed">Os dados foram lançados com sucesso no sistema.</p>
             </div>

             <div id="printable-receipt" className="bg-white border-2 border-dashed border-zinc-200 p-6 rounded-2xl font-mono text-[11px] text-zinc-700 space-y-4 shadow-inner">
                <div className="text-center space-y-1">
                    <p className="font-black text-base italic leading-none">{settings.storeName || 'SCARD SYS'}</p>
                    <p className="text-[9px] uppercase tracking-[0.2em] opacity-60">{settings.storeTagline || 'ENTERPRISE SOLUTION'}</p>
                    <p className="text-[8px] opacity-40">{settings.storeAddress || 'Rua da Moda, 123 - Centro'}</p>
                    {settings.storeCnpj && <p className="text-[8px] opacity-40">CNPJ: {settings.storeCnpj}</p>}
                </div>
                
                <div className="pt-2 border-t border-zinc-200 flex justify-between items-center text-[10px] font-bold">
                    <span>CUPOM: #{receiptData.id.toString().slice(-6)}</span>
                    <span>{new Date(receiptData.date).toLocaleDateString()} {new Date(receiptData.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>

                <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1 mb-1">
                        <span>DESCRIÇÃO</span>
                        <span>TOTAL</span>
                    </div>
                    {receiptData.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-start leading-tight">
                            <span className="flex-1 pr-4 uppercase">
                                {it.quantity}x {it.name}
                                {it.size && <span className="text-[8px] block text-zinc-400">QLD: {it.size} | COR: {it.color}</span>}
                            </span>
                            <span className="font-black">R$ {formatCurrency((it.price * it.quantity) - it.discountValue - it.manualDiscountValue)}</span>
                        </div>
                    ))}
                </div>

                <div className="pt-2 border-t border-zinc-200 space-y-1">
                    <div className="flex justify-between text-zinc-500">
                        <span>SUBTOTAL</span>
                        <span>R$ {formatCurrency(receiptData.subtotal)}</span>
                    </div>
                    {receiptData.discount > 0 && (
                        <div className="flex justify-between text-red-500 font-bold">
                            <span>DESCONTO GERAL</span>
                            <span>- R$ {formatCurrency(receiptData.discount)}</span>
                        </div>
                    )}
                    {receiptData.exchangeCreditUsed && receiptData.exchangeCreditUsed > 0 && (
                        <div className="flex justify-between text-amber-600 font-bold">
                            <span>CRÉDITO TROCA</span>
                            <span>- R$ {formatCurrency(receiptData.exchangeCreditUsed)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-base font-black text-zinc-900 border-t border-zinc-300 pt-1 mt-1">
                        <span>TOTAL PAGO</span>
                        <span>R$ {formatCurrency(receiptData.total)}</span>
                    </div>
                </div>

                <div className="pt-2 border-t border-zinc-200 space-y-1">
                    <p className="text-[9px] font-black text-zinc-400 uppercase">FORMA(S) DE PAGAMENTO:</p>
                    {receiptData.payments.map((p, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                            <span>{p.method} {p.installments ? `(${p.installments}x)` : ''}{p.method === 'F12' ? ` (${p.f12ClientName})` : ''}</span>
                            <span className="font-bold">R$ {formatCurrency(p.amount)}</span>
                        </div>
                    ))}
                    {receiptData.change > 0 && (
                        <div className="flex justify-between text-amber-600 font-bold">
                            <span>TROCO</span>
                            <span>R$ {formatCurrency(receiptData.change)}</span>
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t border-zinc-200 text-center">
                    <p className="text-[9px] font-black text-zinc-400 uppercase mb-1">VENDEDOR:</p>
                    <p className="text-[10px] font-bold uppercase">{receiptData.user}</p>
                    <p className="text-[8px] mt-4 opacity-40">Obrigado pela preferência!</p>
                </div>
             </div>

             <div className="flex gap-3 pt-2">
                <button 
                    onClick={() => { setReceiptData(null); setTimeout(() => searchInputRef.current?.focus(), 100); }} 
                    className="flex-1 px-4 py-4 border-2 border-zinc-100 text-zinc-400 font-black uppercase text-[10px] rounded-2xl hover:bg-zinc-50 transition-all active:scale-95"
                >
                    Fechar
                </button>
                <button 
                    onClick={() => { window.print(); setReceiptData(null); setTimeout(() => searchInputRef.current?.focus(), 100); }} 
                    className="flex-[2] px-4 py-4 bg-red-600 text-white font-black uppercase text-[10px] rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95"
                >
                    <Printer size={18} />
                    Confirmar & Imprimir
                </button>
             </div>
          </div>
        </div>
      )}

      {authRequest && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[120] animate-in fade-in">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl mx-auto flex items-center justify-center border border-amber-100"><ShieldAlert size={32} /></div>
              <h3 className="text-xl font-black text-zinc-900 uppercase italic">Autorização Necessária</h3>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-relaxed">Operação restrita a administradores.</p>
            </div>
            <form onSubmit={handleAuthorization} className="space-y-4">
              <input name="authUser" type="text" placeholder="Usuário ou 'master'" className="w-full border-2 rounded-xl px-4 py-3 text-sm font-bold bg-zinc-50 outline-none focus:border-red-500" required autoFocus />
              <input name="authPass" type="password" placeholder="Senha" className="w-full border-2 rounded-xl px-4 py-3 text-sm font-bold bg-zinc-50 outline-none focus:border-red-500" required />
              <div className="flex gap-2">
                <button type="button" onClick={() => setAuthRequest(null)} className="flex-1 px-4 py-3 border-2 border-zinc-100 text-zinc-400 font-black uppercase text-[10px] rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-red-600 text-white font-black uppercase text-[10px] rounded-xl">Validar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalFluxo && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[110] animate-in fade-in">
          <form onSubmit={(e) => {
             e.preventDefault();
             if (fluxoVal <= 0) return alert('Valor inválido!');
             const amt = modalFluxo === 'retirada' ? -fluxoVal : fluxoVal;
             const log: CashLog = { id: Math.random().toString(36).substr(2, 9), type: modalFluxo, amount: fluxoVal, description: fluxoDesc || (modalFluxo === 'retirada' ? 'Sangria manual' : 'Entrada manual'), time: new Date().toISOString(), user: user.name };
             setCashSession((prev: CashSession) => ({ ...prev, currentBalance: prev.currentBalance + amt, logs: [log, ...prev.logs] }));
             setModalFluxo(null); setFluxoVal(0); setFluxoDesc('');
          }} className="bg-white p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl space-y-8 animate-in fade-in zoom-in-95">
             <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
               <h3 className="text-2xl font-black text-zinc-900 uppercase italic tracking-tighter">
                {modalFluxo === 'retirada' ? 'Sangria de Caixa' : 'Entrada de Caixa'}
               </h3>
               <button type="button" onClick={() => setModalFluxo(null)} className="text-zinc-300 hover:text-zinc-500 transition-colors"><X size={24}/></button>
             </div>
             <div className="space-y-6">
                <div className="relative group">
                   <div className="absolute inset-0 bg-red-600/5 rounded-2xl border-2 border-red-600/20 group-focus-within:border-red-600 group-focus-within:bg-red-600/10 transition-all"></div>
                   <div className="relative px-6 py-8 flex items-center gap-4">
                      <span className="text-xl font-black text-zinc-400">R$</span>
                      <input 
                        type="text" 
                        className="flex-1 bg-transparent text-5xl font-black text-red-700 outline-none font-mono" 
                        value={formatCurrency(fluxoVal)} 
                        onChange={e => setFluxoVal(parseCurrency(e.target.value))} 
                        required autoFocus onFocus={(e) => e.target.select()}
                      />
                   </div>
                </div>
                <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
                  <textarea 
                    className="w-full bg-transparent text-sm font-bold text-zinc-600 outline-none h-32 resize-none placeholder:text-zinc-400" 
                    placeholder="Digite o motivo ou observação..." 
                    value={fluxoDesc} 
                    onChange={e => setFluxoDesc(e.target.value)} 
                  />
                </div>
             </div>
             <button 
              type="submit" 
              className={`w-full py-5 rounded-2xl text-white font-black uppercase text-xs tracking-[0.2em] shadow-2xl transition-all active:scale-95 ${modalFluxo === 'retirada' ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30' : 'bg-green-600 hover:bg-green-700 shadow-green-600/30'}`}
             >
                Confirmar Lançamento
             </button>
          </form>
        </div>
      )}
    </div>
  );
};

// --- ESTOQUE ---

const StockManagementView = ({ products, setProducts, categories, setCategories }: any) => {
  const [modal, setModal] = useState(false);
  const [summaryModal, setSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [form, setForm] = useState<any>({ cost: 0, price: 0, markup: 2.0, category: 'Sem Categoria', stock: 0, size: '', color: '', discountBlocked: false });
  const [search, setSearch] = useState('');
  const [isExact, setIsExact] = useState(false);
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterSize, setFilterSize] = useState('');
  const [filterColor, setFilterColor] = useState('');

  const sortedCategories = useMemo(() => { 
    return [...categories].sort((a, b) => { if (a === 'Sem Categoria') return -1; if (b === 'Sem Categoria') return 1; return a.localeCompare(b); }); 
  }, [categories]);

  const updatePrice = useCallback((cost: number, markup: number) => {
    const newPrice = parseFloat((cost * markup).toFixed(2));
    setForm((prev: any) => ({ ...prev, cost, markup, price: newPrice }));
  }, []);
  const updateMarkup = useCallback((cost: number, price: number) => {
    const newMarkup = cost > 0 ? parseFloat((price / cost).toFixed(4)) : 0;
    setForm((prev: any) => ({ ...prev, cost, price, markup: newMarkup }));
  }, []);
  const generateRandomSku = () => {
    const code = Math.floor(100000 + Math.random() * 900000);
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetters = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
    setForm({ ...form, sku: `${code}${randomLetters}` });
  };
  const handleClone = (p: Product) => {
    setForm({ ...p, id: undefined, sku: '' });
    setModal(true);
  };
  const save = (e: any) => {
    e.preventDefault();
    if (products.some((p: Product) => p.sku === form.sku && p.id !== form.id)) return alert('SKU duplicado!');
    // Correct variable assignment typo
    const id = form.id || Date.now();
    const p = { ...form, id, active: true, price: Number(form.price) || 0, cost: Number(form.cost) || 0, markup: Number(form.markup) || 1, stock: Number(form.stock) || 0, discountBlocked: !!form.discountBlocked };
    if (form.id) setProducts((prev: any) => prev.map((x: any) => x.id === id ? p : x));
    else setProducts((prev: any) => [...prev, p]);
    setModal(false); setForm({ cost: 0, price: 0, markup: 2.0, category: 'Sem Categoria', stock: 0, size: '', color: '', discountBlocked: false });
  };
  const filteredProducts = useMemo(() => {
    const t = search.toLowerCase();
    const s = filterSize.toLowerCase();
    const c = filterColor.toLowerCase();
    return products.filter((p: Product) => {
      let matchSearch = false;
      if (!t) {
        matchSearch = p.active;
      } else {
        if (isExact) {
          matchSearch = p.active && (p.name.toLowerCase() === t || p.sku.toLowerCase() === t);
        } else {
          matchSearch = p.active && (p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t));
        }
      }

      const matchCategory = filterCategory === 'Todas' ? true : p.category === filterCategory;
      const matchSize = s ? p.size?.toLowerCase().includes(s) : true;
      const matchColor = c ? p.color?.toLowerCase().includes(c) : true;
      return matchSearch && matchCategory && matchSize && matchColor;
    });
  }, [products, search, isExact, filterCategory, filterSize, filterColor]);

  const generateWppSummary = () => {
    if (filteredProducts.length === 0) {
      alert('Nenhum produto visível para gerar resumo!');
      return;
    }
    const now = new Date().toLocaleDateString();
    let text = `📦 *PEÇAS - ${now}*\n`;
    text += `--------------------------------\n`;
    filteredProducts.forEach((p: Product) => {
      text += `*${p.name}* | Qld: ${p.size || '-'} | _R$ ${formatCurrency(p.price)}_\n`;
    });
    text += `--------------------------------\n`;
    text += `*LM PARTS*\n`;
    
    setSummaryText(text);
    setSummaryModal(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summaryText);
    alert('Resumo copiado para a área de transferência!');
  };

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0">
      {!modal && (
        <div className="flex justify-between items-center shrink-0 animate-in fade-in">
            <div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase italic">Estoque</h2>
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Controle de mercadorias</p>
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={() => setIsExact(!isExact)} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${isExact ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white border-zinc-200 text-zinc-400 hover:border-red-300'}`}
                >
                  <Target size={14} className={isExact ? 'animate-pulse' : ''} />
                  {isExact ? 'Exato' : 'Exato'}
                </button>
                <button type="button" onClick={generateWppSummary} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg active:scale-95 text-[10px] uppercase">
                  <Share2 size={16}/> Resumo WhatsApp
                </button>
                <button type="button" onClick={() => { setForm({stock: 0, cost: 0, price: 0, markup: 2.0, size: '', color: '', sku: '', category: 'Sem Categoria', discountBlocked: false}); setModal(true); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg active:scale-95 text-[10px] uppercase">
                  <Plus size={16}/> Novo Cadastro
                </button>
            </div>
        </div>
      )}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4 shrink-0">
        <div className="flex gap-4">
          <div className="relative group flex-[3]">
            <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isExact ? 'text-red-500' : 'text-zinc-400'}`} />
            <input 
              type="text" 
              placeholder={isExact ? "Código SKU ou nome exato..." : "SKU ou nome..."} 
              className={`w-full pl-11 pr-4 py-2.5 bg-zinc-50 border rounded-xl text-xs font-bold outline-none transition-all ${isExact ? 'border-red-500 ring-2 ring-red-50' : 'focus:border-red-500'}`} 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <select className="flex-1 bg-zinc-50 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase outline-none focus:border-red-500" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
               <option value="Todas">Todas Categorias</option>
               {sortedCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        <div className="flex gap-6 items-center border-t pt-4">
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">QUALIDADE</label>
            <input 
              type="text" 
              placeholder="" 
              className="w-32 px-3 py-2 bg-zinc-50 border rounded-lg text-xs font-bold outline-none focus:border-red-500 uppercase"
              value={filterSize}
              onChange={e => setFilterSize(e.target.value)}
            />
          </div>
          {(filterSize || filterColor) && (
            <button onClick={() => { setFilterSize(''); setFilterColor(''); }} className="text-[9px] font-black text-red-400 uppercase hover:text-red-600 transition-colors flex items-center gap-1">
              <X size={12} /> Limpar Filtros
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-zinc-200 flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1 custom-scroll">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="bg-zinc-50 sticky top-0 z-10 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b">
              <tr>
                <th className="px-6 py-3">Produto</th>
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3">Qualidade</th>
                <th className="px-6 py-3 text-right">Custo</th>
                <th className="px-6 py-3 text-right">Venda</th>
                <th className="px-6 py-3 text-center">Qtd</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredProducts.map((p: Product) => (
                <tr key={p.id} className={`hover:bg-zinc-50 transition-all group ${p.stock === 0 ? 'bg-red-50/30' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`font-bold text-xs ${p.stock === 0 ? 'text-red-700' : 'text-zinc-800'}`}>{p.name}</span>
                      <span className={`text-[8px] font-black font-mono ${p.stock === 0 ? 'text-red-400' : 'text-red-400'}`}>{p.sku}</span>
                      {p.discountBlocked && <span className="text-[7px] text-red-500 font-black uppercase mt-0.5">Sem Desconto</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border ${p.stock === 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-zinc-50 text-zinc-500 border'}`}>{p.category || 'Sem Categoria'}</span>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex flex-col leading-tight">
                        {p.size && <span className={`text-[12px] font-black uppercase ${p.stock === 0 ? 'text-red-700' : 'text-zinc-900'}`}>QLD: {p.size}</span>}
                        {p.color && <span className={`text-[12px] font-bold mt-0.5 ${p.stock === 0 ? 'text-red-600' : 'text-zinc-600'}`}>{p.color}</span>}
                        {!p.size && !p.color && <span className="text-[10px] text-zinc-300">-</span>}
                     </div>
                  </td>
                  <td className={`px-6 py-4 font-black font-mono text-xs text-right ${p.stock === 0 ? 'text-red-700' : 'text-zinc-500'}`}>R$ {formatCurrency(p.cost)}</td>
                  <td className={`px-6 py-4 font-black font-mono text-xs text-right ${p.stock === 0 ? 'text-red-700' : 'text-zinc-900'}`}>R$ {formatCurrency(p.price)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-4 py-1 rounded-xl text-[10px] font-black ${p.stock === 0 ? 'text-white bg-red-600 animate-pulse' : p.stock <= 5 ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>{p.stock}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleClone(p)} className="p-2 text-zinc-400 hover:text-green-600" title="Clonar"><Copy size={14}/></button>
                      <button onClick={() => { setForm(p); setModal(true); }} className={`p-2 transition-colors ${p.stock === 0 ? 'text-red-400 hover:text-red-600' : 'text-zinc-400 hover:text-red-600'}`}><Edit size={14}/></button>
                      <button onClick={() => setProducts(products.filter((x: any) => x.id !== p.id))} className="p-2 text-zinc-400 hover:text-red-600"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[100] animate-in fade-in">
          <form onSubmit={save} className="bg-white p-8 rounded-[2rem] w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-auto custom-scroll">
            <h3 className="text-xl font-black text-zinc-900 uppercase italic border-b pb-4">{form.id ? 'Ajustar' : 'Novo'} Registro de Peça</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="md:col-span-2"><label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Descrição Comercial</label><input placeholder="Ex: Camiseta Slim Masculina" className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-red-500 outline-none" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
              <div><label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">SKU / Referência</label><div className="flex gap-2"><input className="flex-1 border-2 rounded-xl px-4 py-2.5 text-sm font-mono focus:border-red-500 outline-none" value={form.sku || ''} onChange={e => setForm({...form, sku: e.target.value})} required /><button type="button" onClick={generateRandomSku} className="bg-zinc-100 p-3 rounded-xl hover:bg-zinc-200"><RefreshCw size={16}/></button></div></div>
              <div>
                <label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Categoria</label>
                <div className="flex gap-2">
                  <select className="flex-1 border-2 rounded-xl px-4 py-3 text-sm font-bold focus:border-red-500 outline-none" value={form.category || 'Sem Categoria'} onChange={e => setForm({...form, category: e.target.value})} required>
                    {sortedCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => {
                      const newCat = prompt('Digite o nome da nova categoria:');
                      if (newCat && newCat.trim()) {
                        const trimmed = newCat.trim();
                        if (categories.includes(trimmed)) return alert('Esta categoria já existe!');
                        setCategories([...categories, trimmed]);
                        setForm({...form, category: trimmed});
                      }
                    }} 
                    className="bg-zinc-100 p-3 rounded-xl hover:bg-zinc-200 text-zinc-600"
                    title="Adicionar Categoria"
                  >
                    <Plus size={16}/>
                  </button>
                  {form.category && form.category !== 'Sem Categoria' && (
                    <button 
                      type="button" 
                      onClick={() => {
                        if (window.confirm(`Remover "${form.category}"? Todos os produtos desta categoria serão movidos para "Sem Categoria".`)) {
                          const catToDelete = form.category;
                          setCategories(categories.filter((c: string) => c !== catToDelete));
                          setProducts((prev: Product[]) => prev.map(p => p.category === catToDelete ? { ...p, category: 'Sem Categoria' } : p ));
                          setForm({...form, category: 'Sem Categoria'});
                        }
                      }} 
                      className="bg-red-50 p-3 rounded-xl hover:bg-red-100 text-red-600"
                      title="Remover Categoria"
                    >
                      <Trash2 size={16}/>
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:col-span-2"><div><label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Qualidade</label><input placeholder="" className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-red-500 outline-none" value={form.size || ''} onChange={e => setForm({...form, size: e.target.value})} /></div></div>
              <div className="grid grid-cols-3 gap-4 md:col-span-2 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                <div><label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Custo (R$)</label><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-zinc-300">R$</span><input type="text" onFocus={(e) => e.target.select()} className="w-full border-2 rounded-xl pl-7 pr-3 py-2 text-sm font-black focus:border-red-500 outline-none" value={formatCurrency(form.cost || 0)} onChange={e => updatePrice(parseCurrency(e.target.value), form.markup)} /></div></div>
                <div><label className="text-[9px] font-black text-red-400 uppercase block mb-1">Markup</label><input type="number" step="0.1" onFocus={(e) => e.target.select()} className="w-full border-2 border-red-100 rounded-xl px-3 py-2 text-sm font-black text-red-700 focus:border-red-500 outline-none" value={form.markup || 0} onChange={e => updatePrice(form.cost, Number(e.target.value))} /></div>
                <div><label className="text-[9px] font-black text-green-600 uppercase block mb-1">Venda (R$)</label><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-zinc-300">R$</span><input type="text" onFocus={(e) => e.target.select()} className="w-full border-2 border-green-100 rounded-xl pl-7 pr-3 py-2 text-sm font-black text-green-700 focus:border-green-500 outline-none" value={formatCurrency(form.price || 0)} onChange={e => updateMarkup(form.cost, parseCurrency(e.target.value))} /></div></div>
              </div>
              <div className="md:col-span-2">
                <label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Qtd em Estoque</label>
                <input type="number" onFocus={(e) => e.target.select()} className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-center focus:border-red-500 outline-none" value={form.stock || 0} onChange={e => setForm({...form, stock: Number(e.target.value)})} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t mt-4"><button type="button" onClick={() => setModal(false)} className="px-5 py-2 text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-zinc-600 transition-colors">DESCARTAR</button><button type="submit" className="bg-red-600 text-white px-10 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-red-700 active:scale-95 transition-all">SALVAR ALTERAÇÕES</button></div>
          </form>
        </div>
      )}

      {summaryModal && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[100] animate-in fade-in bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-xl shadow-2xl space-y-6 flex flex-col relative">
            <div className="flex justify-between items-center border-b pb-4 shrink-0">
               <h3 className="text-xl font-black text-zinc-900 uppercase italic flex items-center gap-2">
                 <Share2 size={24} className="text-emerald-600" /> Resumo WhatsApp
               </h3>
               <button type="button" onClick={() => setSummaryModal(false)} className="text-zinc-300 hover:text-zinc-500 transition-colors"><X size={24}/></button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Conteúdo do Resumo (Filtrado)</p>
              <textarea 
                readOnly
                className="w-full flex-1 border-2 rounded-2xl p-6 text-sm font-mono bg-zinc-50 focus:outline-none custom-scroll resize-none leading-relaxed focus:border-emerald-500"
                value={summaryText}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t shrink-0">
              <button type="button" onClick={copyToClipboard} className="w-full py-4 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-xl flex items-center justify-center gap-2 shadow-xl hover:bg-emerald-700 transition-all active:scale-95">
                <Copy size={16} /> Copiar para WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE DASHBOARD ---

const DashboardViewComponent = ({ products, sales, cashSession, fiados, cashHistory }: any) => {
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('day');
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const [commFilterMonth, setCommFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [commTiers, setCommTiers] = useState<CommissionTier[]>(() => {
    const saved = localStorage.getItem('dash_comm_tiers');
    return saved ? JSON.parse(saved) : [
      { min: 0, rate: 1 },
      { min: 20000, rate: 2 },
      { min: 30000, rate: 3 },
      { min: 40000, rate: 4 },
      { min: 50000, rate: 5 }
    ];
  });

  useEffect(() => {
    localStorage.setItem('dash_comm_tiers', JSON.stringify(commTiers));
  }, [commTiers]);

  const filteredSales = useMemo(() => {
    return sales.filter((s: Sale) => {
      const d = new Date(s.date);
      if (period === 'day') {
        const [y, m, day] = selectedDay.split('-').map(Number);
        return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day;
      }
      if (period === 'month') {
        const [y, m] = selectedMonth.split('-').map(Number);
        return d.getFullYear() === y && (d.getMonth() + 1) === m;
      }
      if (period === 'year') {
        return d.getFullYear() === Number(selectedYear);
      }
      return true;
    });
  }, [sales, period, selectedDay, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    let totals = { total: 0, cash: 0, pix: 0, card: 0, f12: 0, count: 0 };
    let productsCount: Record<number, { name: string, qty: number, size?: string, color?: string }> = {};

    filteredSales.forEach((s: Sale) => {
      totals.count += 1;
      s.payments.forEach(p => {
        if (p.method === 'F12') {
           totals.f12 += p.amount;
        } else {
           totals.total += p.amount;
           
           if (p.method === 'Dinheiro') totals.cash += p.amount; 
           else if (p.method === 'Pix') totals.pix += p.amount; 
           else totals.card += p.amount;
        }
      });
      s.items.forEach(item => {
        if (!productsCount[item.productId]) { productsCount[item.productId] = { name: item.name, qty: 0, size: item.size, color: item.color }; }
        productsCount[item.productId].qty += item.quantity;
      });
    });

    const allLogs = [
      ...(cashSession?.logs || []),
      ...(cashHistory?.flatMap((h: any) => h.logs) || [])
    ];

    allLogs.forEach(log => {
       const logDate = new Date(log.time);
       let matchPeriod = false;
       if (period === 'day') {
          const [y, m, d] = selectedDay.split('-').map(Number);
          matchPeriod = logDate.getFullYear() === y && (logDate.getMonth() + 1) === m && logDate.getDate() === d;
       } else if (period === 'month') {
          const [y, m] = selectedMonth.split('-').map(Number);
          matchPeriod = logDate.getFullYear() === y && (logDate.getMonth() + 1) === m;
       } else {
          matchPeriod = logDate.getFullYear() === Number(selectedYear);
       }

       if (matchPeriod && log.description.startsWith('Rec. Pendente:')) {
          totals.total += log.amount;
          if (log.description.includes('(Dinheiro)')) totals.cash += log.amount;
          else if (log.description.includes('(Pix)')) totals.pix += log.amount;
          else totals.card += log.amount;
       }
    });

    const productsRank = Object.values(productsCount).sort((a, b) => b.qty - a.qty).slice(0, 5);
    return { totals, productsRank };
  }, [filteredSales, cashSession, cashHistory, period, selectedDay, selectedMonth, selectedYear]);

  const commissionContext = useMemo(() => {
    let sellersMap: Record<string, number> = {};
    let totalMonthly = 0;
    
    const [y, m] = commFilterMonth.split('-').map(Number);
    
    sales.forEach((s: Sale) => {
      const sd = new Date(s.date);
      if (sd.getFullYear() === y && (sd.getMonth() + 1) === m) {
        if (!sellersMap[s.user]) sellersMap[s.user] = 0;
        sellersMap[s.user] += s.total;
        totalMonthly += s.total;
      }
    });
    return { sellers: Object.entries(sellersMap).sort((a, b) => b[1] - a[1]), total: totalMonthly };
  }, [sales, commFilterMonth]);

  const getTierForValue = (val: number) => {
    const sorted = [...commTiers].sort((a, b) => b.min - a.min);
    return sorted.find(t => val >= t.min) || commTiers[0];
  };

  const handleUpdateTier = (index: number, field: 'min' | 'rate', value: number) => {
    const newTiers = [...commTiers];
    newTiers[index][field] = value;
    setCommTiers(newTiers);
  };

  const handleAddTier = () => {
    const maxMin = Math.max(...commTiers.map(t => t.min), 0);
    setCommTiers([...commTiers, { min: maxMin + 10000, rate: 1 }]);
  };

  const handleRemoveTier = (index: number) => {
    if (commTiers.length <= 1) return;
    setCommTiers(commTiers.filter((_, i) => i !== index));
  };

  const totalStock = products.reduce((acc: number, p: any) => acc + p.stock, 0);
  const totalStockCost = products.reduce((acc: number, p: any) => acc + (p.cost * p.stock), 0);
  const totalStockSaleValue = products.reduce((acc: number, p: any) => acc + (p.price * p.stock), 0);
  const totalFiadoPending = fiados.filter((f: FiadoRecord) => f.status === 'pending').reduce((acc: number, f: FiadoRecord) => acc + f.remainingAmount, 0);
  
  const totalReceivedForBadges = stats.totals.cash + stats.totals.pix + stats.totals.card;

  return (
    <div className="space-y-8 animate-in fade-in h-full flex flex-col pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col"><h2 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase italic">Painel Indicadores</h2><p className="text-zinc-400 font-black text-[10px] uppercase tracking-[0.2em]">Visão estratégica do negócio</p></div>
        <div className="flex flex-col items-end gap-2">
            <div className="flex bg-white p-1.5 rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                {(['day', 'month', 'year'] as const).map((p) => (
                    <button key={p} onClick={() => setPeriod(p)} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${period === p ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-zinc-400 hover:bg-zinc-50'}`}>{p === 'day' ? 'DIA' : p === 'month' ? 'MÊS' : 'ANO'}</button>
                ))}
            </div>
            <div className="flex items-center gap-3">
              {period === 'day' && (<div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-xl border border-red-100 animate-in fade-in shadow-sm"><span className="text-[10px] font-black text-red-400 uppercase tracking-widest">ESCOLHA O DIA:</span><input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="bg-transparent text-sm font-black text-red-700 outline-none cursor-pointer" /></div>)}
              {period === 'month' && (<div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-xl border border-red-100 animate-in fade-in shadow-sm"><span className="text-[10px] font-black text-red-400 uppercase tracking-widest">ESCOLHA O MÊS:</span><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent text-sm font-black text-red-700 outline-none cursor-pointer" /></div>)}
              {period === 'year' && (<div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-xl border border-red-100 animate-in fade-in shadow-sm"><span className="text-[10px] font-black text-red-400 uppercase tracking-widest">ESCOLHA O ANO:</span><input type="number" min="2000" max="2100" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent text-sm font-black text-red-700 outline-none cursor-pointer w-20" /></div>)}
            </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CardStat icon={<TrendingUp size={24}/>} label="Faturamento Real" val={`R$ ${stats.totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="green" />
        <CardStat icon={<Box size={24}/>} label="Total Estoque" val={`${totalStock} peças`} subVal={
          <div className="flex flex-col">
            <span className="text-red-500">Custo Total R$ {formatCurrency(totalStockCost)}</span>
            <span className="text-emerald-600 mt-0.5">Venda Total R$ {formatCurrency(totalStockSaleValue)}</span>
          </div>
        } color="blue" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm space-y-8">
              <div className="flex justify-between items-center"><h3 className="text-lg font-black text-zinc-800 uppercase italic flex items-center gap-2"><CreditCard size={20} className="text-red-600" /> Meios de Recebimento</h3><span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Período Selecionado</span></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <PaymentBadge label="Dinheiro" val={stats.totals.cash} color="green" total={totalReceivedForBadges} icon={<Banknote size={16}/>} />
                 <PaymentBadge label="Pix" val={stats.totals.pix} color="blue" total={totalReceivedForBadges} icon={<QrCode size={16}/>} />
                 <PaymentBadge label="Cartão" val={stats.totals.card} color="red" total={totalReceivedForBadges} icon={<CreditCard size={16}/>} />
              </div>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <h3 className="text-lg font-black text-zinc-800 uppercase italic mb-8 flex items-center gap-2"><Trophy size={20} className="text-amber-500" /> Ranking de Produtos</h3>
              <div className="space-y-4">
                 {stats.productsRank.length > 0 ? stats.productsRank.map((p, idx) => (
                    <div key={idx} className="bg-zinc-50 p-5 rounded-3xl flex items-center justify-between border border-zinc-100 hover:border-amber-200 transition-all group">
                       <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-white transition-all group-hover:scale-110 ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-zinc-100 text-zinc-500' : 'bg-orange-50 text-orange-600'}`}>
                             {idx === 0 ? <Medal size={24}/> : idx === 1 ? <Medal size={24}/> : <Award size={24}/>}
                          </div>
                          <div>
                             <div className="flex items-center gap-2"><span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{idx + 1}º mais vendido</span></div>
                             <h4 className="text-lg font-black text-zinc-900 uppercase italic leading-tight">{p.name}</h4>
                             {(p.size || p.color) && (<p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-1 italic opacity-80 flex items-center gap-2">{p.size && <span>qld: <span className="text-red-500">{p.size}</span></span>}{p.color && <span>/ cor: <span className="text-red-500">{p.color}</span></span>}</p>)}
                          </div>
                       </div>
                       <div className="text-right"><p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 opacity-60">Qtd Saída</p><p className="text-xl font-black text-red-600">{p.qty} <span className="text-[10px] text-zinc-400 uppercase">un</span></p></div>
                    </div>
                 )) : (<div className="py-12 text-center text-zinc-300 font-bold italic">Sem movimentação de produtos no período...</div>)}
              </div>
           </div>
        </div>
        <div className="bg-zinc-950 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col h-fit">
           <div className="absolute top-0 right-0 w-40 h-40 bg-red-600/20 rounded-full blur-[80px] -mr-20 -mt-20"></div>
           <div className="relative z-10 flex flex-col">
              <div className="mb-8">
                 <h3 className="text-lg font-black uppercase italic flex items-center gap-2"><Calculator size={20} className="text-red-400" /> Equipe & Comissões</h3>
                 <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1 mb-2">Configuração de metas escalonadas</p>
                 
                 <div className="flex items-center gap-2 mb-4 bg-white/5 p-3 rounded-2xl border border-white/10 group focus-within:border-red-500 transition-colors">
                    <Calendar size={14} className="text-zinc-500 group-focus-within:text-red-400" />
                    <input 
                      type="month" 
                      value={commFilterMonth} 
                      onChange={(e) => setCommFilterMonth(e.target.value)}
                      className="bg-transparent text-[10px] font-black text-red-400 outline-none uppercase cursor-pointer flex-1"
                    />
                 </div>

                 <div className="space-y-3 mb-6 bg-white/5 p-4 rounded-3xl border border-white/10">
                    <div className="flex justify-between items-center">
                        <span className="text-[8px] font-black text-zinc-400 uppercase">Ajuste de Faixas</span>
                        <button onClick={handleAddTier} className="text-[8px] font-black text-red-400 hover:text-red-300 uppercase flex items-center gap-1">
                          <Plus size={10} /> Adicionar
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scroll pr-1">
                        {commTiers.sort((a,b) => a.min - b.min).map((tier, idx) => (
                          <div key={idx} className="flex items-center gap-2 animate-in slide-in-from-right-1">
                             <div className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-2 py-1.5 flex items-center gap-1.5">
                                <span className="text-[8px] font-black text-zinc-600 uppercase">Min</span>
                                <input 
                                  type="text" 
                                  className="w-full bg-transparent text-[10px] font-black text-white outline-none" 
                                  value={formatCurrency(tier.min)} 
                                  onChange={e => handleUpdateTier(idx, 'min', parseCurrency(e.target.value))}
                                />
                             </div>
                             <div className="w-16 bg-zinc-900 border border-white/5 rounded-xl px-2 py-1.5 flex items-center gap-1">
                                <input 
                                  type="number" 
                                  className="w-full bg-transparent text-[10px] font-black text-red-400 outline-none text-center" 
                                  value={tier.rate} 
                                  onChange={e => handleUpdateTier(idx, 'rate', Number(e.target.value))}
                                />
                                <Percent size={10} className="text-zinc-600"/>
                             </div>
                             <button onClick={() => handleRemoveTier(idx)} className="p-1.5 text-red-500/50 hover:text-red-500"><Trash2 size={12}/></button>
                          </div>
                        ))}
                    </div>
                 </div>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-auto custom-scroll pr-2">
                 {commissionContext.sellers.map(([name, val], idx) => {
                    const tier = getTierForValue(val);
                    const rate = tier.rate;
                    const commission = val * (rate / 100);
                    const isTop = idx === 0 && val > 0;
                    
                    return (
                       <div key={idx} className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                          <div className="flex justify-between items-center mb-3">
                             <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border ${isTop ? 'bg-amber-600/30 text-amber-400 border-amber-600/20' : 'bg-red-600/30 text-red-400 border-red-600/20'}`}>
                                    {idx + 1}º
                                </div>
                                <span className="text-xs font-black uppercase tracking-tight group-hover:text-red-300 transition-colors">{name}</span>
                             </div>
                             <span className="text-xs font-black font-mono">R$ {val.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/5 rounded-full mb-3 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${rate >= 4 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (val / (commissionContext.total || 1)) * 100)}%` }}></div>
                          </div>
                          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter text-zinc-500">
                            <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded-md ${rate >= 4 ? 'bg-amber-500/10 text-amber-500' : 'bg-white/10 text-zinc-400'}`}>Taxa: {rate}%</span>
                                {rate >= 4 && <Zap size={8} className="text-amber-500 animate-pulse" />}
                            </div>
                            <div className="text-right">
                                <span className={`${rate >= 4 ? 'text-amber-400' : 'text-red-400'} text-[10px] font-mono italic`}>Comissão: R$ {formatCurrency(commission)}</span>
                            </div>
                          </div>
                       </div>
                    );
                 })}
                 {commissionContext.sellers.length === 0 && (<div className="h-full flex items-center justify-center py-20"><p className="text-zinc-700 font-bold uppercase text-[10px] tracking-widest">Sem movimentação</p></div>)}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const CardStat = ({ icon, label, val, color, subVal }: any) => (
  <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-zinc-200 flex items-center gap-5 hover:shadow-xl hover:-translate-y-1 transition-all group">
    <div className={`p-4 rounded-2xl bg-${color}-50 text-${color}-600 group-hover:scale-110 transition-transform`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 opacity-60">{label}</p>
      <p className="text-2xl font-black text-zinc-900 font-mono italic tracking-tighter leading-tight truncate">{val}</p>
      {subVal && <div className="text-[9px] font-black uppercase mt-1 tracking-tight">{subVal}</div>}
    </div>
  </div>
);

const PaymentBadge = ({ label, val, color, total, icon }: any) => {
  const percent = total > 0 ? (val / total) * 100 : 0;
  return (
    <div className="space-y-4">
       <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className={`p-1.5 rounded-lg bg-${color}-50 text-${color}-500`}>{icon}</div><span className="text-[10px] font-black text-zinc-600 uppercase tracking-tight">{label}</span></div><span className="text-[10px] font-black text-zinc-400">{percent.toFixed(1)}%</span></div>
       <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 group hover:border-red-100 transition-colors"><p className="text-base font-black text-zinc-800 font-mono">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
       <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden"><div className={`h-full bg-${color}-500 rounded-full transition-all duration-700`} style={{ width: `${percent}%` }}></div></div>
    </div>
  );
};

// --- RELATÓRIOS ---

const ReportsViewComponent = ({ user, sales, setSales, products, setProducts, setMovements, cashHistory, cashSession, setCashSession, settings, setExchangeCredit, setCurrentView, vendedores, setCashHistory }: any) => {
  const [tab, setTab] = useState<'sales' | 'cash' | 'fluxo'>('sales'); const [search, setSearch] = useState(''); const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [reprintSale, setReprintSale] = useState<Sale | null>(null); 
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editSeller, setEditSeller] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');

  // Estados para edição de fluxo (entrada/sangria) - MASTER ONLY
  const [editingCashLog, setEditingCashLog] = useState<CashLog | null>(null);
  const [editCashLogVal, setEditCashLogVal] = useState(0);
  const [editCashLogDesc, setEditCashLogDesc] = useState('');

  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('day'); const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10)); const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const isAdmin = user.role === 'admin' || user.id === 0; 
  const isMasterUser = user.id === 0 || user.email === 'master@internal';
  const canDelete = isAdmin || (settings.sellerPermissions || []).includes('delete_sale'); const canExchange = isAdmin || (settings.sellerPermissions || []).includes('exchange_sale');
  const hasSubPermission = (permId: string) => isAdmin || (settings.sellerPermissions || []).includes(permId);
  const showSalesTab = true; const showFluxoTab = hasSubPermission('reports_fluxo'); const showCashTab = hasSubPermission('reports_cash');
  useEffect(() => { if (!showSalesTab) { if (showFluxoTab) setTab('fluxo'); else if (showCashTab) setTab('cash'); } }, [showSalesTab, showFluxoTab, showCashTab]);
  const filteredSalesByPeriod = useMemo(() => {
    return sales.filter((s: Sale) => {
      const d = new Date(s.date);
      if (period === 'day') { const [y, m, day] = selectedDay.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day; }
      if (period === 'month') { const [y, m] = selectedMonth.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m; }
      if (period === 'year') { return d.getFullYear() === Number(selectedYear); }
      return true;
    });
  }, [sales, period, selectedDay, selectedMonth, selectedYear]);
  const filteredSales = useMemo(() => { if (!search) return filteredSalesByPeriod; const t = search.toLowerCase(); return filteredSalesByPeriod.filter((s: Sale) => s.id.toString().includes(t) || s.user.toLowerCase().includes(t) || s.items.some(i => i.name.toLowerCase().includes(t))); }, [filteredSalesByPeriod, search]);
  const cashLogs = useMemo(() => {
    let allLogs: CashLog[] = []; if (cashSession) allLogs = [...cashSession.logs]; cashHistory.forEach((h: CashHistoryEntry) => { allLogs = [...allLogs, ...h.logs]; });
    const movements = allLogs.filter(l => l.type === 'entrada' || l.type === 'retirada');
    return movements.filter(l => {
        const d = new Date(l.time); if (period === 'day') { const [y, m, day] = selectedDay.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day; }
        if (period === 'month') { const [y, m] = selectedMonth.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m; }
        if (period === 'year') { return d.getFullYear() === Number(selectedYear); }
        return true;
    }).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [cashSession, cashHistory, period, selectedDay, selectedMonth, selectedYear]);
  const filteredCashHistory = useMemo(() => {
    return cashHistory.filter((h: CashHistoryEntry) => {
      const d = new Date(h.closedAt); if (period === 'day') { const [y, m, day] = selectedDay.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day; }
      if (period === 'month') { const [y, m] = selectedMonth.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m; }
      if (period === 'year') { return d.getFullYear() === Number(selectedYear); }
      return true;
    }).sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  }, [cashHistory, period, selectedDay, selectedMonth, selectedYear]);

  // Excluir venda silenciosamente (sem logs de estorno)
  const handleDeleteSale = (sale: Sale) => {
    if (!canDelete) return alert('Sem permissão para excluir vendas!'); 
    if (!window.confirm('Deseja realmente excluir esta venda? O estoque será devolvido.')) return;
    
    // Devolução de Estoque (Apenas itens NÃO trocados, pois trocados já voltaram ao estoque)
    setProducts((prev: Product[]) => prev.map(p => { 
      const items = sale.items.filter(i => i.productId === p.id && !i.isExchanged); 
      const totalQty = items.reduce((acc, i) => acc + i.quantity, 0); 
      return totalQty > 0 ? { ...p, stock: p.stock + totalQty } : p; 
    }));
    
    // Reverter saldo do caixa silenciosamente
    const cashValue = sale.payments.filter(p => p.method === 'Dinheiro').reduce((acc, p) => acc + p.amount, 0) - (sale.change || 0);
    if (cashValue !== 0 && cashSession) {
      setCashSession((prev: CashSession) => ({
        ...prev,
        currentBalance: prev.currentBalance - cashValue,
      }));
    }

    // Devolver crédito de troca ao sistema se tiver sido usado
    if (sale.exchangeCreditUsed && sale.exchangeCreditUsed > 0) {
      setExchangeCredit((prev: number) => prev + sale.exchangeCreditUsed!);
    }

    setSales((prev: Sale[]) => prev.filter(s => s.id !== sale.id)); 
    alert('Venda removida com sucesso!');
  };

  const handleItemExchange = (sale: Sale, item: SaleItem) => {
    if (!canExchange) return alert('Sem permissão para realizar trocas!'); if (item.isExchanged) return alert('Este item já foi trocado!');
    const itemSubtotal = (item.price * item.quantity) - item.discountValue - item.manualDiscountValue; const totalItemsSubtotal = sale.items.reduce((acc, it) => acc + (it.price * it.quantity - it.discountValue - it.manualDiscountValue), 0); const proportionalFactor = totalItemsSubtotal > 0 ? itemSubtotal / totalItemsSubtotal : 0; const netItemValue = sale.total * proportionalFactor;
    if (!window.confirm(`Deseja realizar a troca do item ${item.name}?\nCrédito a ser gerado: R$ ${formatCurrency(netItemValue)}`)) return;
    setProducts((prev: Product[]) => prev.map(p => p.id === item.productId ? { ...p, stock: p.stock + item.quantity } : p ));
    setMovements((prev: any) => [{ id: Math.random(), productId: item.productId, productName: item.name, type: 'entrada', quantity: item.quantity, reason: `Troca Item Venda #${sale.id.toString().slice(-4)}`, date: new Date().toISOString(), user: user.name }, ...prev]);
    setSales((prev: Sale[]) => prev.map(s => { if (s.id === sale.id) { return { ...s, items: s.items.map(it => it.cartId === item.cartId ? { ...it, isExchanged: true } : it) }; } return s; }));
    setExchangeCredit((prev: number) => prev + netItemValue); setSelectedSale(null); setCurrentView('sales'); alert(`Sucesso! R$ ${formatCurrency(netItemValue)} de crédito adicionado ao sistema.`);
  };

  const handleUpdateSaleMaster = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;
    
    const oldCashContribution = editingSale.payments
        .filter(p => p.method === 'Dinheiro')
        .reduce((acc, p) => acc + p.amount, 0) - (editingSale.change || 0);

    const totalSalePayments = editingSale.payments.reduce((acc, p) => acc + p.amount, 0);
    const newCashContribution = (editPaymentMethod === 'Dinheiro' ? totalSalePayments : 0) - (editPaymentMethod === 'Dinheiro' ? (editingSale.change || 0) : 0);

    const cashDifference = newCashContribution - oldCashContribution;

    if (cashDifference !== 0 && cashSession && setCashSession) {
        const adjustmentLog: CashLog = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'ajuste',
            amount: Math.abs(cashDifference),
            description: `Ajuste Master Venda #${editingSale.id.toString().slice(-4)} (${editingSale.payments[0]?.method} -> ${editPaymentMethod})`,
            time: new Date().toISOString(),
            user: user.name
        };

        setCashSession((prev: CashSession) => ({
            ...prev,
            currentBalance: prev.currentBalance + cashDifference,
            logs: [adjustmentLog, ...prev.logs]
        }));
    }

    const updatedSales = sales.map((s: Sale) => {
      if (s.id === editingSale.id) {
        return {
          ...s,
          user: editSeller,
          payments: s.payments.map(p => ({ ...p, method: editPaymentMethod }))
        };
      }
      return s;
    });

    setSales(updatedSales);
    setEditingSale(null);
    alert('Venda atualizada com sucesso pelo MASTER SYSTEM! O saldo do caixa foi ajustado.');
  };

  const handleDeleteCashLog = (log: CashLog) => {
    if (!isMasterUser) return;
    if (!window.confirm(`Deseja realmente EXCLUIR este registro de ${log.type === 'entrada' ? 'Entrada' : 'Sangria'}?\nMotivo: ${log.description}\nValor: R$ ${formatCurrency(log.amount)}\n\nO saldo do caixa será ajustado automaticamente.`)) return;

    const valDiff = log.type === 'entrada' ? -log.amount : log.amount;

    if (cashSession && cashSession.logs.some(l => l.id === log.id)) {
        setCashSession((prev: CashSession) => ({
            ...prev,
            currentBalance: prev.currentBalance + valDiff,
            logs: prev.logs.filter(l => l.id !== log.id)
        }));
    } else {
        setCashHistory((prev: CashHistoryEntry[]) => prev.map(h => {
            if (h.logs.some(l => l.id === log.id)) {
                return {
                    ...h,
                    closingBalance: h.closingBalance + valDiff,
                    logs: h.logs.filter(l => l.id !== log.id)
                };
            }
            return h;
        }));
    }
    alert('Registro removido e caixa ajustado!');
  };

  const handleSaveEditCashLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCashLog || !isMasterUser) return;

    const oldVal = editingCashLog.amount;
    const newVal = editCashLogVal;
    
    let diff = 0;
    if (editingCashLog.type === 'entrada') {
        diff = newVal - oldVal;
    } else {
        diff = oldVal - newVal;
    }

    const updatedLog = { ...editingCashLog, amount: newVal, description: editCashLogDesc };

    if (cashSession && cashSession.logs.some(l => l.id === editingCashLog.id)) {
        setCashSession((prev: CashSession) => ({
            ...prev,
            currentBalance: prev.currentBalance + diff,
            logs: prev.logs.map(l => l.id === editingCashLog.id ? updatedLog : l)
        }));
    } else {
        setCashHistory((prev: CashHistoryEntry[]) => prev.map(h => {
            if (h.logs.some(l => l.id === editingCashLog.id)) {
                return {
                    ...h,
                    closingBalance: h.closingBalance + diff,
                    logs: h.logs.map(l => l.id === editingCashLog.id ? updatedLog : l)
                };
            }
            return h;
        }));
    }

    setEditingCashLog(null);
    alert('Registro atualizado e caixa ajustado!');
  };

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0">
      <div className="flex flex-col gap-6 md:flex-row md:items-end justify-between shrink-0">
        <div><h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase italic">Relatórios & Histórico</h2><p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Acompanhamento operacional detalhado</p></div>
        <div className="flex flex-col items-end gap-2">
            <div className="flex bg-white p-1.5 rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                {(['day', 'month', 'year'] as const).map((p) => (<button key={p} onClick={() => setPeriod(p)} className={`px-8 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${period === p ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-zinc-400 hover:bg-zinc-50'}`}>{p === 'day' ? 'DIA' : p === 'month' ? 'MÊS' : 'ANO'}</button>))}
            </div>
            <div className="flex items-center gap-3">
              {period === 'day' && (<div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100 animate-in fade-in"><span className="text-[8px] font-black text-red-400 uppercase tracking-widest">DIA:</span><input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="bg-transparent text-[11px] font-black text-red-700 outline-none cursor-pointer" /></div>)}
              {period === 'month' && (<div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100 animate-in fade-in"><span className="text-[8px] font-black text-red-400 uppercase tracking-widest">MÊS:</span><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent text-[11px] font-black text-red-700 outline-none cursor-pointer" /></div>)}
              {period === 'year' && (<div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100 animate-in fade-in"><span className="text-[8px] font-black text-red-400 uppercase tracking-widest">ANO:</span><input type="number" min="2000" max="2100" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent text-[11px] font-black text-red-700 outline-none cursor-pointer w-16" /></div>)}
            </div>
        </div>
      </div>
      <div className="flex bg-white p-1 rounded-2xl border border-zinc-200 shadow-sm self-start">
           {showSalesTab && <button onClick={() => setTab('sales')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${tab === 'sales' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-zinc-400 hover:bg-zinc-50'}`}><ShoppingCart size={14}/> Vendas</button>}
           {showFluxoTab && <button onClick={() => setTab('fluxo')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${tab === 'fluxo' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-zinc-400 hover:bg-zinc-50'}`}><RefreshCw size={14}/> Entradas/Sangrias</button>}
           {showCashTab && <button onClick={() => setTab('cash')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${tab === 'cash' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-zinc-400 hover:bg-zinc-50'}`}><History size={14}/> Histórico de Caixa</button>}
      </div>
      {tab === 'sales' && showSalesTab && (<><div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex gap-4 shrink-0"><div className="relative group flex-1"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" /><input type="text" placeholder="Filtrar por ID, vendedor ou produto..." className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border rounded-xl text-xs font-bold outline-none focus:border-red-500" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div><div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-zinc-200 flex-1 flex flex-col min-h-0"><div className="overflow-auto flex-1 custom-scroll"><table className="w-full text-left border-separate border-spacing-0"><thead className="bg-zinc-50 sticky top-0 z-10 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b"><tr><th className="px-6 py-4">Data/Hora</th><th className="px-6 py-4">ID</th><th className="px-6 py-4">Vendedor</th><th className="px-6 py-4 text-right">Total</th><th className="px-6 py-4 text-center">Itens</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-zinc-100">{filteredSales.map((s: Sale) => (<tr key={s.id} className="hover:bg-zinc-50 transition-all group"><td className="px-6 py-4"><div className="flex flex-col"><span className="text-xs font-bold text-zinc-800">{new Date(s.date).toLocaleDateString()}</span><span className="text-[9px] text-zinc-400 font-mono">{new Date(s.date).toLocaleTimeString()}</span></div></td><td className="px-6 py-4 text-[10px] font-mono font-black text-red-600">#{s.id.toString().slice(-6)}</td><td className="px-6 py-4 text-xs font-bold text-zinc-600 uppercase">{s.user}</td><td className="px-6 py-4 text-right font-black text-zinc-900 font-mono text-xs">R$ {formatCurrency(s.total)}</td><td className="px-6 py-4 text-center"><span className="bg-zinc-100 px-2 py-0.5 rounded text-[10px] font-black text-zinc-500">{s.items.length}</span></td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => setSelectedSale(s)} className="p-2 text-zinc-400 hover:text-red-600" title="Ver Detalhes"><Eye size={16}/></button>{isMasterUser && <button onClick={() => { setEditingSale(s); setEditSeller(s.user); setEditPaymentMethod(s.payments[0]?.method || 'Dinheiro'); }} className="p-2 text-zinc-400 hover:text-amber-500" title="Editar Venda (MASTER)"><Edit size={16}/></button>}{canDelete && <button onClick={() => handleDeleteSale(s)} className="p-2 text-zinc-400 hover:text-red-600" title="Excluir"><Trash2 size={16}/></button>}</div></td></tr>))}{filteredSales.length === 0 && (<tr><td colSpan={6} className="py-20 text-center text-zinc-300 font-bold italic">Nenhuma venda encontrada para este período...</td></tr>)}</tbody></table></div></div></>)}
      {tab === 'fluxo' && showFluxoTab && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-zinc-200 flex-1 flex flex-col min-h-0 animate-in fade-in">
          <div className="overflow-auto flex-1 custom-scroll">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="bg-zinc-50 sticky top-0 z-10 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b">
                <tr>
                  <th className="px-6 py-4">Data e Hora</th>
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Descrição/Motivo</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                  {isMasterUser && <th className="px-6 py-4 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {cashLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800">{new Date(log.time).toLocaleDateString()}</span>
                        <span className="text-[9px] text-zinc-400 font-mono">{new Date(log.time).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-zinc-600 uppercase italic tracking-tight">{log.user}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${log.type === 'entrada' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {log.type === 'entrada' ? 'Entrada' : 'Sangria'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-zinc-500 max-w-xs truncate">{log.description || '-'}</td>
                    <td className={`px-6 py-4 text-right font-black font-mono text-xs ${log.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                      {log.type === 'entrada' ? '+' : '-'} R$ {formatCurrency(log.amount)}
                    </td>
                    {isMasterUser && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                           <button 
                             onClick={() => { setEditingCashLog(log); setEditCashLogVal(log.amount); setEditCashLogDesc(log.description); }} 
                             className="p-1.5 text-zinc-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                             title="Editar Registro"
                           >
                             <Edit size={14}/>
                           </button>
                           <button 
                             onClick={() => handleDeleteCashLog(log)} 
                             className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                             title="Excluir Registro"
                           >
                             <Trash2 size={14}/>
                           </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {cashLogs.length === 0 && (
                  <tr>
                    <td colSpan={isMasterUser ? 6 : 5} className="py-20 text-center text-zinc-300 font-bold italic">Nenhuma movimentação de caixa encontrada...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'cash' && showCashTab && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 animate-in fade-in">
          {cashSession && (
            <div className="bg-red-600 rounded-[2rem] p-8 text-white shadow-xl shadow-red-200 relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                    <Wallet size={32} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                      <h3 className="text-xl font-black uppercase italic tracking-tight">Caixa Aberto Agora</h3>
                    </div>
                    <p className="text-red-100 text-[10px] font-black uppercase tracking-widest opacity-80">
                      Iniciado em {new Date(cashSession.openedAt).toLocaleString()} por {cashSession.openedBy}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-red-200 uppercase tracking-widest mb-1">Saldo Inicial</p>
                    <p className="text-xl font-black font-mono">R$ {formatCurrency(cashSession.openingBalance)}</p>
                  </div>
                  <div className="w-px h-10 bg-white/20"></div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-red-200 uppercase tracking-widest mb-1">Saldo Atual</p>
                    <p className="text-3xl font-black font-mono tracking-tighter">R$ {formatCurrency(cashSession.currentBalance)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-zinc-200 flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1 custom-scroll">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="bg-zinc-50 sticky top-0 z-10 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b">
                  <tr>
                    <th className="px-6 py-4">Sessão de Caixa</th>
                    <th className="px-6 py-4">Responsáveis</th>
                    <th className="px-6 py-4 text-right">Saldo Inicial</th>
                    <th className="px-6 py-4 text-right">Saldo Final</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredCashHistory.map((h: CashHistoryEntry) => {
                    const durationMs = new Date(h.closedAt).getTime() - new Date(h.openedAt).getTime();
                    const hours = Math.floor(durationMs / (1000 * 60 * 60));
                    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                    
                    return (
                      <tr key={h.id} className="hover:bg-zinc-50 transition-all group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                              <div className="w-0.5 h-4 bg-zinc-200" />
                              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-zinc-900 uppercase leading-none">Abertura</span>
                                <span className="text-[10px] font-bold text-zinc-500">{new Date(h.openedAt).toLocaleString()}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-zinc-900 uppercase leading-none">Fechamento</span>
                                <span className="text-[10px] font-bold text-zinc-500">{new Date(h.closedAt).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="ml-4 px-2 py-1 bg-red-50 rounded-lg border border-red-100">
                              <span className="text-[8px] font-black text-red-400 uppercase block leading-none mb-0.5">Duração</span>
                              <span className="text-[10px] font-black text-red-600 font-mono">
                                {hours}h {minutes}m
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center text-[8px] font-black text-zinc-400 border border-zinc-200">AB</div>
                              <span className="text-[10px] font-black uppercase text-zinc-600">{h.openedBy}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center text-[8px] font-black text-zinc-400 border border-zinc-200">FC</div>
                              <span className="text-[10px] font-black uppercase text-zinc-600">{h.closedBy}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black text-zinc-400 uppercase mb-0.5">Inicial</span>
                            <span className="text-xs font-mono font-bold text-zinc-500">R$ {formatCurrency(h.openingBalance)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black text-zinc-400 uppercase mb-0.5">Final</span>
                            <span className="text-xs font-mono font-black text-zinc-900">R$ {formatCurrency(h.closingBalance)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="px-3 py-1 bg-zinc-100 rounded-full text-[9px] font-black text-zinc-400 uppercase border border-zinc-200">Encerrado</span>
                            {h.closingBalance > h.openingBalance ? (
                              <span className="text-[8px] font-black text-green-500 uppercase">+ R$ {formatCurrency(h.closingBalance - h.openingBalance)}</span>
                            ) : h.closingBalance < h.openingBalance ? (
                              <span className="text-[8px] font-black text-red-500 uppercase">- R$ {formatCurrency(h.openingBalance - h.closingBalance)}</span>
                            ) : (
                              <span className="text-[8px] font-black text-zinc-300 uppercase">Sem variação</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCashHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-zinc-300 font-bold italic">Nenhum histórico de caixa encontrado para este período...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {editingSale && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[120] animate-in fade-in">
          <form onSubmit={handleUpdateSaleMaster} className="bg-white p-10 rounded-[2.5rem] w-full max-w-sm shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
               <h3 className="text-xl font-black text-zinc-900 uppercase italic">Ajustar Venda (MASTER)</h3>
               <button type="button" onClick={() => setEditingSale(null)} className="text-zinc-300 hover:text-zinc-500"><X size={24}/></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Vendedor</label>
                <select 
                  className="w-full border-2 rounded-xl px-4 py-3 text-sm font-black uppercase bg-zinc-50 outline-none focus:border-red-500"
                  value={editSeller}
                  onChange={(e) => setEditSeller(e.target.value)}
                  required
                >
                  {vendedores.map((v: User) => (<option key={v.id} value={v.name}>{v.name}</option>))}
                  <option value="MASTER SYSTEM">MASTER SYSTEM</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setEditingSale(null)} className="flex-1 py-4 text-zinc-400 font-black uppercase text-[10px]">Cancelar</button>
              <button type="submit" className="flex-[2] py-4 bg-amber-500 text-white font-black rounded-2xl uppercase text-[10px] shadow-xl hover:bg-amber-600">Salvar Alterações</button>
            </div>
          </form>
        </div>
      )}

      {editingCashLog && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[120] animate-in fade-in">
          <form onSubmit={handleSaveEditCashLog} className="bg-white p-10 rounded-[2.5rem] w-full max-w-sm shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
               <h3 className="text-xl font-black text-zinc-900 uppercase italic">Ajustar {editingCashLog.type === 'entrada' ? 'Entrada' : 'Sangria'}</h3>
               <button type="button" onClick={() => setEditingCashLog(null)} className="text-zinc-300 hover:text-zinc-500"><X size={24}/></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Valor (R$)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-zinc-300">R$</span>
                  <input 
                    type="text" 
                    className="w-full border-2 rounded-xl pl-12 pr-4 py-3 text-lg font-black bg-zinc-50 outline-none focus:border-red-500 font-mono"
                    value={formatCurrency(editCashLogVal)}
                    onChange={(e) => setEditCashLogVal(parseCurrency(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Descrição / Motivo</label>
                <textarea 
                  className="w-full border-2 rounded-xl px-4 py-3 text-sm font-bold bg-zinc-50 outline-none focus:border-red-500 h-24 resize-none"
                  value={editCashLogDesc}
                  onChange={(e) => setEditCashLogDesc(e.target.value)}
                  placeholder="Motivo da alteração..."
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setEditingCashLog(null)} className="flex-1 py-4 text-zinc-400 font-black uppercase text-[10px]">Cancelar</button>
              <button type="submit" className="flex-[2] py-4 bg-amber-500 text-white font-black rounded-2xl uppercase text-[10px] shadow-xl hover:bg-amber-600">Salvar Alterações</button>
            </div>
          </form>
        </div>
      )}
      
      {selectedSale && (<div className="fixed inset-0 flex items-center justify-center p-6 z-[100] animate-in fade-in"><div className="bg-white p-8 rounded-[2rem] w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-auto custom-scroll"><div className="flex justify-between items-center border-b pb-4"><h3 className="text-xl font-black text-zinc-900 uppercase italic">Detalhes da Venda #{selectedSale.id.toString().slice(-6)}</h3><div className="flex items-center gap-2"><button onClick={() => setReprintSale(selectedSale)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Reimprimir Cupom"><Printer size={20}/></button><button onClick={() => setSelectedSale(null)} className="text-zinc-300 hover:text-zinc-500"><X size={24}/></button></div></div><div className="grid grid-cols-2 gap-6 bg-zinc-50 p-4 rounded-2xl border"><div><p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Data / Hora</p><p className="text-xs font-bold text-zinc-700">{new Date(selectedSale.date).toLocaleString()}</p></div><div><p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Vendedor</p><p className="text-xs font-black text-red-600 uppercase">{selectedSale.user}</p></div></div><div className="space-y-3"><h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Produtos Vendidos</h4><div className="border rounded-2xl overflow-hidden"><table className="w-full text-left text-xs"><thead className="bg-zinc-50 font-black text-zinc-500 uppercase text-[9px]"><tr><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-center">Qtd</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-center">Troca</th></tr></thead><tbody className="divide-y">{selectedSale.items.map((it, i) => (<tr key={i} className={`bg-white ${it.isExchanged ? 'opacity-50 grayscale' : ''}`}><td className="px-4 py-3"><div className="flex flex-col"><span className="font-bold">{it.name}</span><span className="text-[9px] text-zinc-400 font-mono">{it.sku}</span><span className="text-[8px] text-zinc-500 italic mt-0.5 uppercase tracking-tighter">qld: {it.size || '-'} / cor: {it.color || '-'}</span>{it.isExchanged && <span className="text-[7px] font-black text-red-500 uppercase mt-0.5 animate-pulse">Item Trocado</span>}</div></td><td className="px-4 py-3 text-center font-bold">{it.quantity}</td><td className="px-4 py-3 text-right font-mono font-bold text-red-600">R$ {formatCurrency((it.price * it.quantity) - it.discountValue - it.manualDiscountValue)}</td><td className="px-4 py-3 text-center">{canExchange && !it.isExchanged && (<button onClick={() => handleItemExchange(selectedSale, it)} className="p-1.5 bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white rounded-lg transition-all shadow-sm" title="Trocar Item"><RotateCcw size={14}/></button>)}</td></tr>))}</tbody></table></div></div><div className="border-t pt-6 flex flex-col items-end gap-2"><div className="flex justify-between w-64 text-xs font-bold text-zinc-400"><span>Subtotal</span><span className="font-mono">R$ {formatCurrency(selectedSale.subtotal)}</span></div><div className="flex justify-between w-64 text-xs font-bold text-red-400"><span>Desconto ({selectedSale.discountPercent.toFixed(1)}%)</span><span className="font-mono">- R$ {formatCurrency(selectedSale.discount)}</span></div>{selectedSale.exchangeCreditUsed && selectedSale.exchangeCreditUsed > 0 && (<div className="flex justify-between w-64 text-xs font-bold text-amber-500"><span>Crédito Utilizado</span><span className="font-mono">- R$ {formatCurrency(selectedSale.exchangeCreditUsed)}</span></div>)}<div className="flex justify-between w-64 text-xl font-black text-zinc-900 border-t pt-2"><span className="italic uppercase tracking-tighter">Total Pago</span><span className="font-mono">R$ {formatCurrency(selectedSale.total)}</span></div></div><div className="space-y-3"><h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Meios de Pagamento</h4><div className="flex flex-wrap gap-2">{selectedSale.payments.map((p, i) => (<div key={i} className={`bg-${p.method === 'F12' ? 'purple' : 'red'}-50 border border-${p.method === 'F12' ? 'purple' : 'red'}-100 px-3 py-2 rounded-xl flex flex-col`}><span className={`text-[8px] font-black text-${p.method === 'F12' ? 'purple' : 'red'}-400 uppercase`}>{p.method} {p.installments ? `${p.installments}x` : ''} {p.method === 'F12' ? ` (${p.f12ClientName})` : ''}</span><span className={`text-xs font-black text-${p.method === 'F12' ? 'purple' : 'red'}-600 font-mono`}>R$ {formatCurrency(p.amount)}</span></div>))}</div></div></div></div>)}

      {reprintSale && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[150] animate-in fade-in no-print-overlay">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl space-y-6 animate-in zoom-in-95 overflow-hidden">
             <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full mx-auto flex items-center justify-center border border-red-100">
                    <Printer size={32} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-black text-zinc-900 uppercase italic">Reimpressão</h3>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-relaxed">Confirme a impressão do cupom de venda.</p>
             </div>

             <div id="printable-receipt" className="bg-white border-2 border-dashed border-zinc-200 p-6 rounded-2xl font-mono text-[11px] text-zinc-700 space-y-4 shadow-inner">
                <div className="text-center space-y-1">
                    <p className="font-black text-base italic leading-none">{settings.storeName || 'SCARD SYS'}</p>
                    <p className="text-[9px] uppercase tracking-[0.2em] opacity-60">{settings.storeTagline || 'ENTERPRISE SOLUTION'}</p>
                    <p className="text-[8px] opacity-40">{settings.storeAddress || 'Rua da Moda, 123 - Centro'}</p>
                    {settings.storeCnpj && <p className="text-[8px] opacity-40">CNPJ: {settings.storeCnpj}</p>}
                </div>
                
                <div className="pt-2 border-t border-zinc-200 flex justify-between items-center text-[10px] font-bold">
                    <span>CUPOM: #{reprintSale.id.toString().slice(-6)}</span>
                    <span>{new Date(reprintSale.date).toLocaleDateString()} {new Date(reprintSale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>

                <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1 mb-1">
                        <span>DESCRIÇÃO</span>
                        <span>TOTAL</span>
                    </div>
                    {reprintSale.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-start leading-tight">
                            <span className="flex-1 pr-4 uppercase">
                                {it.quantity}x {it.name}
                                {it.size && <span className="text-[8px] block text-zinc-400">QLD: {it.size} | COR: {it.color}</span>}
                            </span>
                            <span className="font-black">R$ {formatCurrency((it.price * it.quantity) - it.discountValue - it.manualDiscountValue)}</span>
                        </div>
                    ))}
                </div>

                <div className="pt-2 border-t border-zinc-200 space-y-1">
                    <div className="flex justify-between text-zinc-500">
                        <span>SUBTOTAL</span>
                        <span>R$ {formatCurrency(reprintSale.subtotal)}</span>
                    </div>
                    {reprintSale.discount > 0 && (
                        <div className="flex justify-between text-red-500 font-bold">
                            <span>DESCONTO GERAL</span>
                            <span>- R$ {formatCurrency(reprintSale.discount)}</span>
                        </div>
                    )}
                    {reprintSale.exchangeCreditUsed && reprintSale.exchangeCreditUsed > 0 && (
                        <div className="flex justify-between text-amber-600 font-bold">
                            <span>CRÉDITO TROCA</span>
                            <span>- R$ {formatCurrency(reprintSale.exchangeCreditUsed)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-base font-black text-zinc-900 border-t border-zinc-300 pt-1 mt-1">
                        <span>TOTAL PAGO</span>
                        <span>R$ {formatCurrency(reprintSale.total)}</span>
                    </div>
                </div>

                <div className="pt-2 border-t border-zinc-200 space-y-1">
                    <p className="text-[9px] font-black text-zinc-400 uppercase">FORMA(S) DE PAGAMENTO:</p>
                    {reprintSale.payments.map((p, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                            <span>{p.method} {p.installments ? `(${p.installments}x)` : ''}{p.method === 'F12' ? ` (${p.f12ClientName})` : ''}</span>
                            <span className="font-bold">R$ {formatCurrency(p.amount)}</span>
                        </div>
                    ))}
                    {reprintSale.change > 0 && (
                        <div className="flex justify-between text-amber-600 font-bold">
                            <span>TROCO</span>
                            <span>R$ {formatCurrency(reprintSale.change)}</span>
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t border-zinc-200 text-center">
                    <p className="text-[9px] font-black text-zinc-400 uppercase mb-1">VENDEDOR:</p>
                    <p className="text-[10px] font-bold uppercase">{reprintSale.user}</p>
                    <p className="text-[8px] mt-4 opacity-40">Obrigado pela preferência!</p>
                </div>
             </div>

             <div className="flex gap-3 pt-2">
                <button 
                    onClick={() => setReprintSale(null)} 
                    className="flex-1 px-4 py-4 border-2 border-zinc-100 text-zinc-400 font-black uppercase text-[10px] rounded-2xl hover:bg-zinc-50 transition-all active:scale-95"
                >
                    Fechar
                </button>
                <button 
                    onClick={() => { window.print(); setReprintSale(null); }} 
                    className="flex-[2] px-4 py-4 bg-red-600 text-white font-black uppercase text-[10px] rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95"
                >
                    <Printer size={18} />
                    Imprimir Agora
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- CONFIGURAÇÕES ---

const SettingsViewComponent = ({ settings, setSettings, categories, setCategories, products, setProducts }: any) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>({ 
    maxGlobalDiscount: settings?.maxGlobalDiscount ?? 10, 
    cardFees: { 
      debit: settings?.cardFees?.debit ?? 1.99, 
      credit1x: settings?.cardFees?.credit1x ?? 3.49, 
      creditInstallments: settings?.cardFees?.creditInstallments ?? 4.99 
    }, 
    sellerPermissions: settings?.sellerPermissions ?? DEFAULT_SETTINGS.sellerPermissions,
    storeAddress: settings?.storeAddress ?? DEFAULT_SETTINGS.storeAddress,
    storeCnpj: settings?.storeCnpj ?? DEFAULT_SETTINGS.storeCnpj,
    storeName: settings?.storeName ?? DEFAULT_SETTINGS.storeName,
    storeTagline: settings?.storeTagline ?? DEFAULT_SETTINGS.storeTagline
  });
  const [newCategory, setNewCategory] = useState('');
  const sortedCategories = useMemo(() => { return [...categories].sort((a, b) => { if (a === 'Sem Categoria') return -1; if (b === 'Sem Categoria') return 1; return a.localeCompare(b); }); }, [categories]);
  const handleAddCategory = () => { const trimmed = newCategory.trim(); if (!trimmed) return; if (categories.includes(trimmed)) return alert('Já existe!'); setCategories([...categories, trimmed]); setNewCategory(''); };
  const handleDeleteCategory = (cat: string) => { if (window.confirm(`Remover "${cat}"? Todos os produtos desta categoria serão movidos para "Sem Categoria".`)) { setCategories(categories.filter((c: string) => c !== cat)); setProducts((prev: Product[]) => prev.map(p => p.category === cat ? { ...p, category: 'Sem Categoria' } : p )); } };
  const handleSave = () => { setSettings(localSettings); alert('Ajustes salvos!'); };
  const togglePermission = (viewId: string) => { const perms = (localSettings.sellerPermissions || []).includes(viewId) ? localSettings.sellerPermissions.filter(p => p !== viewId) : [...(localSettings.sellerPermissions || []), viewId]; setLocalSettings({ ...localSettings, sellerPermissions: perms }); };
  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-end"><div className="flex flex-col"><h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase italic">Configurações</h2><p className="text-zinc-400 font-black text-[9px] uppercase tracking-[0.2em]">Ajustes de taxas e sistema</p></div><button onClick={handleSave} className="bg-red-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px]">Salvar Alterações</button></div>
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm space-y-8">
              <div className="space-y-6">
                <h3 className="text-lg font-black text-zinc-800 uppercase italic border-b pb-4">Dados da Empresa (Recibo)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Nome da Empresa</label>
                    <input type="text" className="w-full border-2 rounded-xl px-4 py-3 text-zinc-800 font-bold text-sm" value={localSettings.storeName} onChange={e => setLocalSettings({...localSettings, storeName: e.target.value})} placeholder="SCARD SYS" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Subtítulo / Slogan</label>
                    <input type="text" className="w-full border-2 rounded-xl px-4 py-3 text-zinc-800 font-bold text-sm" value={localSettings.storeTagline} onChange={e => setLocalSettings({...localSettings, storeTagline: e.target.value})} placeholder="ENTERPRISE SOLUTION" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Endereço Completo</label>
                    <input type="text" className="w-full border-2 rounded-xl px-4 py-3 text-zinc-800 font-bold text-sm" value={localSettings.storeAddress} onChange={e => setLocalSettings({...localSettings, storeAddress: e.target.value})} placeholder="Rua ..., Nº ..., Bairro, Cidade-UF" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">CNPJ</label>
                    <input type="text" className="w-full border-2 rounded-xl px-4 py-3 text-zinc-800 font-bold text-sm" value={localSettings.storeCnpj} onChange={e => setLocalSettings({...localSettings, storeCnpj: e.target.value})} placeholder="00.000.000/0001-00" />
                  </div>
                </div>
              </div>
              <div className="space-y-6 border-t pt-6"><h3 className="text-lg font-black text-zinc-800 uppercase italic border-b pb-4">Taxas Bancárias (%)</h3><div className="grid grid-cols-3 gap-4">{['debit', 'credit1x', 'creditInstallments'].map(key => (<div key={key}><label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">{key === 'debit' ? 'Débito' : key === 'credit1x' ? 'Crédito 1x' : 'C. Parcelado'}</label><input type="number" step="0.01" onFocus={(e) => e.target.select()} className="w-full border-2 rounded-xl px-4 py-3 text-red-600 font-black text-sm" value={(localSettings.cardFees as any)[key]} onChange={e => setLocalSettings({...localSettings, cardFees: {...localSettings.cardFees, [key]: Number(e.target.value)}})} /></div>))}</div></div><div className="space-y-6 border-t pt-6"><h3 className="text-lg font-black text-zinc-800 uppercase italic border-b pb-4">Política de Desconto</h3><div><label className="text-[9px] font-black text-zinc-400 uppercase block mb-1">Limite Máximo de Desconto (%)</label><div className="flex items-center gap-3"><input type="number" step="1" onFocus={(e) => e.target.select()} className="w-32 border-2 rounded-xl px-4 py-3 text-red-600 font-black text-sm" value={localSettings.maxGlobalDiscount} onChange={e => setLocalSettings({...localSettings, maxGlobalDiscount: Number(e.target.value)})} /><span className="text-xs font-bold text-zinc-400">Limite apenas para vendedor, administrador não se aplica.</span></div></div></div></div>
           <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm space-y-6"><h3 className="text-lg font-black text-zinc-800 uppercase italic border-b pb-4">Permissões do Vendedor</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[{id: 'reports_fluxo', label: 'RELATÓRIOS - ENTRADAS/SANGRIAS'}, {id: 'reports_cash', label: 'RELATÓRIOS - HISTÓRICO CAIXA'}, {id: 'stock', label: 'ESTOQUE'}, {id: 'dashboard', label: 'DASHBOARD'}, {id: 'delete_sale', label: 'EXCLUIR VENDA'}, {id: 'exchange_sale', label: 'REALIZAR TROCA'}].map(v => (<label key={v.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100 cursor-pointer hover:bg-red-50 transition-colors"><input type="checkbox" className="w-4 h-4 rounded text-red-600" checked={(localSettings.sellerPermissions || []).includes(v.id)} onChange={() => togglePermission(v.id)} /><span className="text-xs font-black text-zinc-700 uppercase">{v.label}</span></label>))}</div><p className="text-[9px] font-bold text-zinc-400 uppercase italic">Configure o que é relevante para o vendedor acessar.</p></div>
        </div>
      </div>
    </div>
  );
};

// --- GESTÃO DE EQUIPE ---

const TeamViewComponent = ({ currentUser, users, setUsers }: any) => {
  const [editModal, setEditModal] = useState<User | null>(null);
  const [showPass, setShowPass] = useState(false);
  
  const [changingPass, setChangingPass] = useState(false);
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');

  const isMaster = currentUser.id === 0 || currentUser.email === 'master@internal';

  const handleToggleShowPass = () => {
    if (showPass) {
      setShowPass(false);
      return;
    }
    if (isMaster) {
      setShowPass(true);
    } else {
      alert("Apenas o usuário MASTER tem permissão para visualizar senhas cadastradas diretamente.");
    }
  };

  const handleDeleteUser = (id: number) => { 
    if (id === currentUser.id) return alert('Você não pode excluir seu próprio usuário!'); 
    if (window.confirm('Excluir este colaborador?')) setUsers(users.filter((u: User) => u.id !== id)); 
  };

  const handleUpdateProfile = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (!editModal) return; 

    let updatedUser = { ...editModal };

    if (!isMaster && changingPass) {
      if (currentPassInput !== currentUser.password) {
        alert("Sua senha atual está incorreta. Autorização negada para alteração.");
        return;
      }
      if (!newPassInput.trim()) {
        alert("Informe a nova senha desejada.");
        return;
      }
      updatedUser.password = newPassInput;
    }

    setUsers(users.map((u: User) => u.id === updatedUser.id ? updatedUser : u)); 
    setEditModal(null); 
    setShowPass(false);
    setChangingPass(false);
    setCurrentPassInput('');
    setNewPassInput('');
    alert('Perfil updated com sucesso!'); 
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col">
        <h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase italic">Gestão de Equipe</h2>
        <p className="text-zinc-400 font-black text-[9px] uppercase tracking-[0.2em]">Controle de acessos</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u: User) => (
          <div key={u.id} className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm hover:shadow-xl transition-all text-center">
            <div className="w-16 h-16 bg-zinc-50 text-zinc-300 rounded-2xl mx-auto mb-4 flex items-center justify-center border">
              <UserIcon size={28} />
            </div>
            <h3 className="text-lg font-black text-zinc-800 uppercase mb-1">{u.name}</h3>
            <p className="text-[10px] font-bold text-zinc-400 mb-4">{u.email}</p>
            <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase border ${u.role === 'admin' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}>
              {u.role}
            </span>
            <div className="border-t border-zinc-100 mt-6 pt-4 flex justify-center gap-3">
              <button onClick={() => { setEditModal(u); setShowPass(false); setChangingPass(false); }} className="text-[9px] font-black uppercase text-red-600 hover:text-red-700">Editar</button>
              {u.id !== currentUser.id && (
                <button onClick={() => handleDeleteUser(u.id)} className="text-[9px] font-black uppercase text-red-400 hover:text-red-500">Excluir</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {editModal && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[100] animate-in fade-in">
          <form onSubmit={handleUpdateProfile} className="bg-white p-10 rounded-[2rem] w-full max-w-sm shadow-2xl space-y-5 relative">
            <h3 className="text-2xl font-black text-zinc-900 uppercase italic">Editar Usuário</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-zinc-400 uppercase ml-1">Nome</label>
                <input className="w-full border-2 rounded-xl px-4 py-3 text-sm font-bold bg-zinc-50/50" value={editModal.name} onChange={e => setEditModal({...editModal, name: e.target.value})} required placeholder="Nome" />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-zinc-400 uppercase ml-1">E-mail</label>
                <input type="email" className="w-full border-2 rounded-xl px-4 py-3 text-sm font-bold bg-zinc-50/50" value={editModal.email} onChange={e => setEditModal({...editModal, email: e.target.value})} required placeholder="E-mail" />
              </div>

              {isMaster ? (
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-zinc-400 uppercase ml-1">Senha (Visível para Master)</label>
                   <div className="relative">
                      <input 
                        type={showPass ? "text" : "password"} 
                        className="w-full border-2 rounded-xl px-4 py-3 text-sm pr-12 font-bold bg-zinc-50" 
                        value={editModal.password || ''} 
                        onChange={e => editModal.id === 0 ? null : setEditModal({...editModal, password: e.target.value})} 
                        placeholder="Senha" 
                        disabled={editModal.id === 0}
                      />
                      <button 
                        type="button" 
                        onClick={handleToggleShowPass}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-red-600">
                        {showPass ? <Eye size={18} /> : <Lock size={18} />}
                      </button>
                   </div>
                </div>
              ) : currentUser.id === editModal.id && (
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={changingPass} onChange={e => setChangingPass(e.target.checked)} className="w-4 h-4 rounded text-red-600" />
                    <span className="text-[10px] font-black uppercase text-zinc-500">Alterar minha senha</span>
                  </label>
                  {changingPass && (
                    <div className="space-y-3 animate-in slide-in-from-top-2">
                       <input type="password" placeholder="Senha Atual" className="w-full border-2 rounded-xl px-4 py-2 text-xs font-bold" value={currentPassInput} onChange={e => setCurrentPassInput(e.target.value)} />
                       <input type="password" placeholder="Nova Senha" className="w-full border-2 rounded-xl px-4 py-2 text-xs font-bold" value={newPassInput} onChange={e => setNewPassInput(e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                 <label className="text-[8px] font-black text-zinc-400 uppercase ml-1">Nível de Acesso</label>
                 <select 
                   disabled={editModal.id === 0 || !isMaster} 
                   className="w-full border-2 rounded-xl px-4 py-3 text-sm font-bold bg-zinc-50/50 appearance-none disabled:opacity-50"
                   value={editModal.role}
                   onChange={e => setEditModal({...editModal, role: e.target.value as UserRole})}
                 >
                    <option value="atendente">Vendedor (Atendente)</option>
                    <option value="admin">Administrador</option>
                 </select>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button type="button" onClick={() => setEditModal(null)} className="flex-1 py-3 text-zinc-400 font-black uppercase text-[10px]">Cancelar</button>
              <button type="submit" className="flex-1 py-3 bg-red-600 text-white font-black uppercase text-[10px] rounded-xl shadow-lg shadow-red-100">Atualizar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = (window as any)._root || createRoot(rootElement);
  (window as any)._root = root;
  root.render(<App />);
}