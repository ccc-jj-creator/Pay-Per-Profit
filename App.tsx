import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Signal, User, Purchase, Outcome, UserRole, BuyerSegment } from './types';
import { ChartBarIcon, PlusCircleIcon, BookOpenIcon, UsersIcon, CheckCircleIcon, XCircleIcon, ClockIcon, LockClosedIcon, TagIcon, TrophyIcon, ArrowUpDownIcon, MagnifyingGlassIcon, LinkIcon, GlobeIcon } from './components/icons';
import { whopService } from './whop-service';

// --- UTILITY FUNCTIONS ---
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; 
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

// --- HELPER COMPONENTS ---

const Toast: React.FC<{ message: string; show: boolean; onClose: () => void }> = ({ message, show, onClose }) => {
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [show, onClose]);

    if (!show) return null;
    return (
        <div className="fixed bottom-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50">
            {message}
        </div>
    );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors duration-200 ${
            active ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
        }`}
    >
        {icon}
        <span className="ml-4 font-semibold">{label}</span>
    </button>
);

const AnalyticsCard: React.FC<{ title: string; value: string; subtext?: string }> = ({ title, value, subtext }) => (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <p className="text-3xl font-bold text-white mt-2">{value}</p>
        {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
);

const OutcomeBadge: React.FC<{ outcome: Outcome }> = ({ outcome }) => {
    const baseClasses = 'px-3 py-1 text-xs font-bold rounded-full inline-flex items-center';
    switch (outcome) {
        case Outcome.WIN: return <span className={`${baseClasses} bg-green-500/20 text-green-400`}><CheckCircleIcon className="w-4 h-4 mr-1.5" /> WIN</span>;
        case Outcome.LOSS: return <span className={`${baseClasses} bg-red-500/20 text-red-400`}><XCircleIcon className="w-4 h-4 mr-1.5" /> LOSS</span>;
        default: return <span className={`${baseClasses} bg-yellow-500/20 text-yellow-400`}><ClockIcon className="w-4 h-4 mr-1.5" /> PENDING</span>;
    }
};

const PerformanceBadge: React.FC<{ winRate: number }> = ({ winRate }) => {
    const badge = useMemo(() => {
        if (isNaN(winRate)) return { label: 'Rookie', color: 'bg-gray-500/20 text-gray-400' };
        if (winRate >= 0.75) return { label: 'Elite', color: 'bg-green-500/20 text-green-400' };
        if (winRate >= 0.6) return { label: 'Sharpshooter', color: 'bg-sky-500/20 text-sky-400' };
        if (winRate > 0) return { label: 'Proven', color: 'bg-yellow-500/20 text-yellow-400' };
        return { label: 'Rookie', color: 'bg-gray-500/20 text-gray-400' };
    }, [winRate]);

    return <span className={`px-3 py-1 text-xs font-bold rounded-full inline-flex items-center ${badge.color}`}><TrophyIcon className="w-4 h-4 mr-1.5" /> {badge.label}</span>;
};


const SimpleBarChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="bg-gray-900/50 p-6 rounded-xl h-full flex items-end space-x-4">
            {data.map(item => (
                <div key={item.label} className="flex-1 flex flex-col items-center justify-end">
                    <div className="text-sm font-bold text-white mb-1">{item.value}</div>
                    <div
                        className="w-full rounded-t-md transition-all duration-500"
                        style={{ height: `${(item.value / maxValue) * 80}%`, backgroundColor: item.color }}
                        title={`${item.label}: ${item.value}`}
                    ></div>
                    <span className="text-xs font-bold text-gray-400 mt-2">{item.label}</span>
                </div>
            ))}
        </div>
    );
};

const PlatformBadge: React.FC<{ platform: string }> = ({ platform }) => {
    if (!platform) return null;
    const p = platform.toLowerCase();
    let colors = 'bg-gray-700 text-gray-300';
    
    if (p.includes('polymarket')) colors = 'bg-blue-600/30 text-blue-300 border border-blue-500/50';
    else if (p.includes('kalshi')) colors = 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50';
    else if (p.includes('predictit')) colors = 'bg-sky-900/40 text-sky-200 border border-sky-700/50';
    else if (p.includes('manifold')) colors = 'bg-purple-600/30 text-purple-300 border border-purple-500/50';
    
    return (
        <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded flex items-center gap-1 ${colors}`}>
            <GlobeIcon className="w-3 h-3" />
            {platform}
        </span>
    );
};


const SignalCard: React.FC<{
    signal: Signal;
    creator?: User;
    isPurchased: boolean;
    isSettled: boolean;
    onPurchase: (signal: Signal) => void;
    currentUser: User;
}> = ({ signal, creator, isPurchased, isSettled, onPurchase, currentUser }) => {

    const canView = isPurchased || currentUser.role === UserRole.CREATOR;

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500 transition-all duration-300">
            <div>
                <div className="flex justify-between items-start mb-4">
                    {creator ? (
                        <div className="flex items-center">
                            <img src={creator.avatarUrl} alt={creator.name} className="w-10 h-10 rounded-full" />
                            <div className="ml-3">
                                <span className="block font-semibold text-white leading-tight">{creator.name}</span>
                                <span className="text-xs text-gray-400">{signal.category}</span>
                            </div>
                        </div>
                    ) : <span></span>}
                     {signal.platform && <PlatformBadge platform={signal.platform} />}
                </div>

                {canView ? (
                    <div className="space-y-3">
                         <p className="text-lg text-gray-100">{signal.content}</p>
                         {signal.marketUrl && (
                             <a 
                                href={signal.marketUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                             >
                                 <LinkIcon className="w-4 h-4 mr-1.5" />
                                 View Market on {signal.platform || 'Platform'}
                             </a>
                         )}
                    </div>
                ) : (
                    <div className="text-center py-8 bg-gray-900/50 rounded-lg flex flex-col items-center justify-center">
                        <LockClosedIcon className="w-8 h-8 text-gray-500 mb-2" />
                        <p className="text-gray-400 font-medium">Signal Locked</p>
                        <div className="flex items-center gap-2 mt-2">
                             <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{signal.category}</span>
                             {signal.platform && <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{signal.platform}</span>}
                        </div>
                    </div>
                )}
            </div>
            <div className="mt-6">
                <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
                    <span>{new Date(signal.timestamp).toLocaleString()}</span>
                    <OutcomeBadge outcome={signal.outcome} />
                </div>
                {!isPurchased && currentUser.role === UserRole.BUYER && !isSettled && (
                     <button
                        onClick={() => onPurchase(signal)}
                        className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                        Unlock Signal {formatCurrency(signal.price)}
                    </button>
                )}
            </div>
        </div>
    );
};


// --- VIEWS ---

const CreatorDashboard: React.FC<{
    creator: User;
    signals: Signal[];
    purchases: Purchase[];
    onSettle: (signalId: string, outcome: Outcome) => void;
    onNotify: (segment: BuyerSegment) => void;
}> = ({ creator, signals, purchases, onSettle, onNotify }) => {
    const creatorSignals = signals.filter(s => s.creatorId === creator.id);
    const pendingSignals = creatorSignals.filter(s => s.outcome === Outcome.PENDING).sort((a,b) => b.timestamp - a.timestamp);
    const settledSignals = creatorSignals.filter(s => s.outcome !== Outcome.PENDING).sort((a,b) => b.timestamp - a.timestamp);

    const analytics = useMemo(() => {
        const creatorSignalIds = new Set(creatorSignals.map(s => s.id));
        const relevantPurchases = purchases.filter(p => creatorSignalIds.has(p.signalId));
        const totalRevenue = relevantPurchases.reduce((sum, p) => sum + p.pricePaid, 0);
        const signalsSold = relevantPurchases.length;
        const wins = settledSignals.filter(s => s.outcome === Outcome.WIN).length;
        const losses = settledSignals.filter(s => s.outcome === Outcome.LOSS).length;
        const winRateNum = wins + losses > 0 ? wins / (wins + losses) : NaN;
        const winRate = isNaN(winRateNum) ? 'N/A' : `${Math.round(winRateNum * 100)}%`;
        const reputation = (isNaN(winRateNum) ? 0 : winRateNum * 70) + Math.min(settledSignals.length, 30);

        return { totalRevenue, signalsSold, winRate, winRateNum, wins, losses, reputation: reputation.toFixed(0) };
    }, [creatorSignals, purchases, settledSignals]);
    
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                 <h1 className="text-4xl font-bold text-white">Creator Dashboard</h1>
                 <PerformanceBadge winRate={analytics.winRateNum} />
            </div>

            {/* Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <AnalyticsCard title="Total Revenue" value={formatCurrency(analytics.totalRevenue)} />
                <AnalyticsCard title="Signals Sold" value={analytics.signalsSold.toString()} />
                <AnalyticsCard title="Win/Loss Ratio" value={analytics.winRate} subtext={`${analytics.wins}W / ${analytics.losses}L`} />
                <AnalyticsCard title="Reputation Score" value={analytics.reputation} subtext="Based on performance & volume"/>
                <div className="lg:col-span-4 bg-gray-800 p-6 rounded-xl border border-gray-700 h-80">
                    <h3 className="text-sm font-medium text-gray-400 mb-4">Performance Breakdown</h3>
                    <SimpleBarChart data={[
                        { label: 'Wins', value: analytics.wins, color: '#22c55e' },
                        { label: 'Losses', value: analytics.losses, color: '#ef4444' }
                    ]} />
                </div>
            </div>

            {/* Buyer Segmentation & Whop Integration */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4">Buyer Engagement</h2>
                <p className="text-gray-400 mb-6">One-click push notifications to your Whop community based on buyer lifecycle.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(Object.values(BuyerSegment) as BuyerSegment[]).map(segment => (
                        <button key={segment} onClick={() => onNotify(segment)} className="bg-indigo-600/80 text-white font-semibold py-3 px-2 rounded-lg text-sm hover:bg-indigo-600 transition-colors">
                            Notify {segment}
                        </button>
                    ))}
                </div>
            </div>

            {/* Pending Signals */}
            <div>
                <h2 className="text-2xl font-bold mb-4">Pending Settlement</h2>
                {pendingSignals.length > 0 ? (
                    <div className="space-y-4">
                        {pendingSignals.map(signal => (
                            <div key={signal.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 md:flex items-center justify-between">
                                <div className="mb-4 md:mb-0">
                                    <div className="flex items-center gap-2 mb-1">
                                         <p className="font-semibold text-lg">{signal.content}</p>
                                         {signal.platform && <PlatformBadge platform={signal.platform} />}
                                    </div>
                                    <p className="text-sm text-gray-400">Posted: {new Date(signal.timestamp).toLocaleString()}</p>
                                    {signal.marketUrl && <p className="text-xs text-indigo-400 truncate max-w-md">{signal.marketUrl}</p>}
                                </div>
                                <div className="flex space-x-3">
                                    <button onClick={() => onSettle(signal.id, Outcome.WIN)} className="bg-green-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-600 transition-colors">Win</button>
                                    <button onClick={() => onSettle(signal.id, Outcome.LOSS)} className="bg-red-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-600 transition-colors">Loss</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-gray-500">No signals awaiting settlement.</p>}
            </div>
            
        </div>
    );
};

type BatchSignal = { content: string; price: string; category: string; platform?: string; marketUrl?: string };

const PostSignalView: React.FC<{
    creator: User;
    onPostSignal: (content: string, price: number, category: string, platform?: string, marketUrl?: string) => void;
}> = ({ creator, onPostSignal }) => {
    const [mode, setMode] = useState<'STANDARD' | 'PREDICTION'>('STANDARD');
    
    // Form state
    const [content, setContent] = useState('');
    const [price, setPrice] = useState('50');
    const [category, setCategory] = useState('Crypto');
    
    // Prediction Market specific state
    const [platform, setPlatform] = useState('Polymarket');
    const [marketUrl, setMarketUrl] = useState('');
    
    const [batch, setBatch] = useState<BatchSignal[]>([]);

    const handleAddToBatch = (e: React.FormEvent) => {
        e.preventDefault();
        if (content && price) {
            const isPred = mode === 'PREDICTION';
            setBatch(prev => [...prev, { 
                content, 
                price, 
                category: isPred ? 'Prediction' : category,
                platform: isPred ? platform : undefined,
                marketUrl: isPred ? marketUrl : undefined
            }]);
            
            // Reset fields
            setContent('');
            setPrice('50');
            if (!isPred) setCategory('Crypto');
            setMarketUrl('');
        }
    };
    
    const handlePostBatch = () => {
        batch.forEach(signal => {
            onPostSignal(signal.content, parseFloat(signal.price), signal.category, signal.platform, signal.marketUrl);
        });
        setBatch([]);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-white mb-6">Post Signals</h1>
                
                {/* Mode Toggle */}
                <div className="flex space-x-4 mb-6">
                    <button 
                        onClick={() => setMode('STANDARD')}
                        className={`px-6 py-2 rounded-lg font-bold transition-colors ${mode === 'STANDARD' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                        Standard Signal
                    </button>
                    <button 
                        onClick={() => setMode('PREDICTION')}
                        className={`px-6 py-2 rounded-lg font-bold transition-colors ${mode === 'PREDICTION' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                        Prediction Market
                    </button>
                </div>

                <form onSubmit={handleAddToBatch} className="bg-gray-800 border border-gray-700 rounded-2xl p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {mode === 'STANDARD' ? (
                            <div>
                                <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                                <input
                                    type="text"
                                    id="category"
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                    placeholder="e.g., Crypto, Stocks, Sports"
                                    required
                                />
                            </div>
                         ) : (
                            <div>
                                <label htmlFor="platform" className="block text-sm font-medium text-gray-300 mb-2">Platform</label>
                                <select
                                    id="platform"
                                    value={platform}
                                    onChange={e => setPlatform(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-white"
                                >
                                    <option value="Polymarket">Polymarket</option>
                                    <option value="Kalshi">Kalshi</option>
                                    <option value="PredictIt">PredictIt</option>
                                    <option value="Manifold">Manifold</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                         )}
                        
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-gray-300 mb-2">Price (USD)</label>
                            <input
                                type="number"
                                id="price"
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                required
                                min="0"
                                step="1"
                            />
                        </div>
                    </div>

                    {mode === 'PREDICTION' && (
                        <div>
                            <label htmlFor="marketUrl" className="block text-sm font-medium text-gray-300 mb-2">Market URL</label>
                            <input
                                type="url"
                                id="marketUrl"
                                value={marketUrl}
                                onChange={e => setMarketUrl(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                placeholder="https://polymarket.com/event/..."
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="content" className="block text-sm font-medium text-gray-300 mb-2">
                            {mode === 'PREDICTION' ? 'Your Prediction' : 'Signal Content'}
                        </label>
                        <textarea
                            id="content"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={3}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            placeholder={mode === 'PREDICTION' ? "e.g., Yes on Trump winning PA..." : "e.g., Long $BTC, entry at $68,500..."}
                            required
                        />
                    </div>
                    
                    <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-500 transition-colors duration-200">
                        Add to Batch
                    </button>
                </form>
            </div>
            {batch.length > 0 && (
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8">
                    <h2 className="text-2xl font-bold mb-4">Signal Batch ({batch.length})</h2>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {batch.map((signal, index) => (
                            <div key={index} className="bg-gray-900 p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2">
                                        {signal.platform && <span className="text-xs bg-gray-700 px-1.5 rounded">{signal.platform}</span>}
                                        <p className="text-gray-300">{signal.content}</p>
                                    </div>
                                    {signal.marketUrl && <p className="text-xs text-indigo-500 mt-1 truncate max-w-sm">{signal.marketUrl}</p>}
                                </div>
                                <span className="text-sm font-semibold">{formatCurrency(parseFloat(signal.price))}</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={handlePostBatch} className="mt-6 w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-500 transition-colors duration-200">
                        Publish {batch.length} Signal{batch.length > 1 ? 's' : ''}
                    </button>
                </div>
            )}
        </div>
    );
};

const PublicLedgerView: React.FC<{ signals: Signal[], users: User[] }> = ({ signals, users }) => {
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('timestamp');
    
    const getCreator = (creatorId: string) => users.find(u => u.id === creatorId);

    const filteredAndSortedSignals = useMemo(() => {
        return signals
            .filter(s => 
                s.content.toLowerCase().includes(search.toLowerCase()) ||
                getCreator(s.creatorId)?.name.toLowerCase().includes(search.toLowerCase()) ||
                s.outcome.toLowerCase().includes(search.toLowerCase()) ||
                (s.platform && s.platform.toLowerCase().includes(search.toLowerCase()))
            )
            .sort((a, b) => {
                if (sortKey === 'timestamp') return b.timestamp - a.timestamp;
                if (sortKey === 'outcome') return a.outcome.localeCompare(b.outcome);
                return 0;
            });
    }, [signals, search, sortKey, users]);

    return (
        <div>
            <h1 className="text-4xl font-bold text-white mb-2">Public Ledger</h1>
            <p className="text-gray-400 mb-6 max-w-3xl">A transparent, immutable record of all signals and their outcomes.</p>
            <div className="flex space-x-4 mb-4">
                <div className="relative flex-grow">
                     <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search ledger..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 pl-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    />
                </div>
                <select 
                    value={sortKey} 
                    onChange={e => setSortKey(e.target.value)}
                    className="bg-gray-900 border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                >
                    <option value="timestamp">Sort by Date</option>
                    <option value="outcome">Sort by Outcome</option>
                </select>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50">
                            <tr>
                                <th className="p-4 font-semibold text-sm text-gray-300">Signal</th>
                                <th className="p-4 font-semibold text-sm text-gray-300">Platform</th>
                                <th className="p-4 font-semibold text-sm text-gray-300">Creator</th>
                                <th className="p-4 font-semibold text-sm text-gray-300">Timestamp</th>
                                <th className="p-4 font-semibold text-sm text-gray-300">Outcome</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredAndSortedSignals.length > 0 ? (
                                filteredAndSortedSignals.map(signal => {
                                    const creator = getCreator(signal.creatorId);
                                    return (
                                        <tr key={signal.id} className="hover:bg-gray-700/50">
                                            <td className="p-4 text-gray-100 font-medium">
                                                {signal.content}
                                            </td>
                                            <td className="p-4">
                                                {signal.platform ? <PlatformBadge platform={signal.platform} /> : <span className="text-xs text-gray-500">-</span>}
                                            </td>
                                            <td className="p-4 text-gray-300">{creator?.name || 'Unknown'}</td>
                                            <td className="p-4 text-gray-400 text-sm">{new Date(signal.timestamp).toLocaleString()}</td>
                                            <td className="p-4"><OutcomeBadge outcome={signal.outcome} /></td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-6 text-center text-gray-500">No signals found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const BuyerDashboard: React.FC<{
    buyer: User;
    signals: Signal[];
    users: User[];
    purchases: Purchase[];
    onPurchase: (signal: Signal) => void;
}> = ({ buyer, signals, users, purchases, onPurchase }) => {
    const [filter, setFilter] = useState('');
    const [sort, setSort] = useState('timestamp-desc');

    const purchasedSignalIds = useMemo(() => new Set(purchases.filter(p => p.userId === buyer.id).map(p => p.signalId)), [purchases, buyer.id]);
    
    const availableSignals = useMemo(() => {
        return signals
            .filter(s => s.outcome === Outcome.PENDING && !purchasedSignalIds.has(s.id))
            .filter(s => 
                s.content.toLowerCase().includes(filter.toLowerCase()) || 
                s.category.toLowerCase().includes(filter.toLowerCase()) ||
                (s.platform && s.platform.toLowerCase().includes(filter.toLowerCase()))
            )
            .sort((a,b) => {
                switch(sort) {
                    case 'price-asc': return a.price - b.price;
                    case 'price-desc': return b.price - a.price;
                    case 'timestamp-asc': return a.timestamp - b.timestamp;
                    default: return b.timestamp - a.timestamp;
                }
            });
    }, [signals, purchasedSignalIds, filter, sort]);

    const purchaseHistory = useMemo(() => {
        return purchases
            .filter(p => p.userId === buyer.id)
            .map(p => signals.find(s => s.id === p.signalId))
            .filter((s): s is Signal => s !== undefined)
            .sort((a, b) => b!.timestamp - a!.timestamp);
    }, [purchases, signals, buyer.id]);

    const getCreator = (creatorId: string) => users.find(u => u.id === creatorId);

    const creatorStats = useMemo(() => {
        const creatorIds = [...new Set(signals.map(s => s.creatorId))];
        return creatorIds.map(id => {
            const creatorSignals = signals.filter(s => s.creatorId === id);
            const settled = creatorSignals.filter(s => s.outcome !== Outcome.PENDING);
            const wins = settled.filter(s => s.outcome === Outcome.WIN).length;
            const losses = settled.filter(s => s.outcome === Outcome.LOSS).length;
            const winRate = wins + losses > 0 ? wins / (wins + losses) : NaN;
            return {
                creator: getCreator(id),
                wins,
                losses,
                winRate,
                lossProtectionCount: losses, // Each loss triggers a credit
            };
        });
    }, [signals, users]);

    return (
        <div className="space-y-12">
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-4xl font-bold text-white">Available Signals</h1>
                    <div className="bg-indigo-500/20 text-indigo-300 font-bold py-2 px-4 rounded-lg flex items-center">
                        <TagIcon className="w-5 h-5 mr-2"/>
                        <span>{buyer.credits} Credit{buyer.credits !== 1 ? 's' : ''} Available</span>
                    </div>
                </div>
                 <div className="flex space-x-4 mb-6">
                    <div className="relative flex-grow">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" placeholder="Filter by content, category, or platform..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-4 focus:ring-indigo-500"/>
                    </div>
                    <select value={sort} onChange={e => setSort(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 focus:ring-indigo-500">
                        <option value="timestamp-desc">Newest</option>
                        <option value="timestamp-asc">Oldest</option>
                        <option value="price-desc">Price: High to Low</option>
                        <option value="price-asc">Price: Low to High</option>
                    </select>
                </div>
                {availableSignals.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {availableSignals.map(signal => (
                            <SignalCard
                                key={signal.id}
                                signal={signal}
                                creator={getCreator(signal.creatorId)}
                                isPurchased={false}
                                isSettled={signal.outcome !== Outcome.PENDING}
                                onPurchase={onPurchase}
                                currentUser={buyer}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-800 rounded-2xl border border-gray-700">
                        <p className="text-gray-400">No new signals available matching your criteria. Check back soon!</p>
                    </div>
                )}
            </div>

            <div className="space-y-6">
                 <h2 className="text-2xl font-bold">Creator Stats</h2>
                 {creatorStats.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {creatorStats.map(stat => stat.creator && (
                            <div key={stat.creator.id} className="bg-gray-800 border border-gray-700 p-4 rounded-xl flex items-center space-x-4">
                                <img src={stat.creator.avatarUrl} alt={stat.creator.name} className="w-12 h-12 rounded-full" />
                                <div>
                                    <p className="font-bold text-white">{stat.creator.name}</p>
                                    <div className="flex items-center space-x-2 text-sm mt-1">
                                        <PerformanceBadge winRate={stat.winRate} />
                                        <span className="text-gray-400" title="Loss Protection Credits Issued">{stat.lossProtectionCount} Credits Issued</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                 ) : <p className="text-gray-500">No active creators yet.</p>}
            </div>

            <div>
                <h2 className="text-2xl font-bold mb-6">Your Purchase History</h2>
                {purchaseHistory.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {purchaseHistory.map(signal => (
                            <SignalCard
                                key={signal.id}
                                signal={signal}
                                creator={getCreator(signal.creatorId)}
                                isPurchased={true}
                                isSettled={signal.outcome !== Outcome.PENDING}
                                onPurchase={() => {}} // No action needed
                                currentUser={buyer}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-800 rounded-2xl border border-gray-700">
                        <p className="text-gray-400">You haven't purchased any signals yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


// --- MAIN APP COMPONENT ---
type View = 'creator-dashboard' | 'post-signal' | 'public-ledger' | 'buyer-dashboard';

export default function App() {
    // --- PERSISTENT STATE ---
    // Using localStorage to maintain state across reloads, simulating a backend database
    const [signals, setSignals] = useState<Signal[]>(() => {
        try {
            const saved = localStorage.getItem('signals');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    
    const [purchases, setPurchases] = useState<Purchase[]>(() => {
        try {
            const saved = localStorage.getItem('purchases');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    // Save to localStorage whenever state changes
    useEffect(() => {
        localStorage.setItem('signals', JSON.stringify(signals));
    }, [signals]);

    useEffect(() => {
        localStorage.setItem('purchases', JSON.stringify(purchases));
    }, [purchases]);

    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeView, setActiveView] = useState<View>('buyer-dashboard');
    const [toast, setToast] = useState({ show: false, message: '' });

    useEffect(() => {
        const initApp = async () => {
            await whopService.initialize();
            refreshUserData();
        };
        initApp();
    }, []);

    const refreshUserData = async () => {
        const user = await whopService.getCurrentUser();
        const allUsers = await whopService.getAllUsers();
        setCurrentUser(user);
        setUsers(allUsers);
        if (user) {
            // Default view based on role, but prioritize current view if set
            setActiveView(prev => prev || (user.role === UserRole.CREATOR ? 'creator-dashboard' : 'buyer-dashboard'));
        }
    }

    const showToast = (message: string) => {
        setToast({ show: true, message });
    };

    const handlePostSignal = (content: string, price: number, category: string, platform?: string, marketUrl?: string) => {
        if (!currentUser) return;
        const newSignal: Signal = {
            id: `sig-${Date.now()}${Math.random()}`,
            creatorId: currentUser.id,
            content,
            price,
            timestamp: Date.now(),
            commitHash: simpleHash(`${content}${Date.now()}`),
            outcome: Outcome.PENDING,
            category,
            platform,
            marketUrl
        };
        setSignals(prev => [...prev, newSignal]);
        showToast('Signal successfully posted!');
        setActiveView('creator-dashboard');
    };

    const handleSettleSignal = async (signalId: string, outcome: Outcome) => {
        try {
            setSignals(prev => prev.map(s => s.id === signalId ? { ...s, outcome } : s));
    
            if (outcome === Outcome.LOSS) {
                const buyersToCredit = purchases.filter(p => p.signalId === signalId).map(p => p.userId);
                let creditedCount = 0;
                for (const userId of buyersToCredit) {
                    await whopService.addCredit(userId);
                    creditedCount++;
                }
                showToast(`Signal settled as LOSS. ${creditedCount} buyers have been credited via Whop.`);
                refreshUserData(); // Refresh to see updated credits
            } else {
                 showToast('Signal settled as WIN.');
            }
        } catch (error: any) {
            console.error("Failed to settle signal:", error);
            const errorMessage = error?.message || 'An error occurred while settling the signal.';
            showToast(String(errorMessage));
        }
    };

    const handlePurchaseSignal = async (signal: Signal) => {
        if (!currentUser) return;

        // Refresh user data to get latest credits
        const freshUser = await whopService.getCurrentUser();
        
        const hasCredits = freshUser.credits > 0;
        let purchaseSuccessful = false;
        let pricePaid = 0;

        if (hasCredits) {
            await whopService.useCredit(freshUser.id);
            purchaseSuccessful = true;
            pricePaid = 0;
            showToast(`Unlocked with 1 credit!`);
        } else {
            showToast(`Redirecting to Whop checkout...`);
            const checkoutResult = await whopService.createCheckout(signal.price);
            if (checkoutResult.success) {
                purchaseSuccessful = true;
                pricePaid = signal.price;
                showToast(`Successfully purchased signal via Whop!`);
            } else {
                showToast(`Purchase failed or was cancelled.`);
            }
        }

        if (purchaseSuccessful) {
            const newPurchase: Purchase = {
                id: `pur-${Date.now()}`,
                userId: freshUser.id,
                signalId: signal.id,
                pricePaid,
                timestamp: Date.now(),
            };
            setPurchases(prev => [...prev, newPurchase]);
            refreshUserData();
        }
    };

    const handleSwitchRole = async () => {
        const newUser = await whopService.switchUserRole();
        await refreshUserData();
        setActiveView(newUser.role === UserRole.CREATOR ? 'creator-dashboard' : 'buyer-dashboard');
        showToast(`Switched to ${newUser.role} mode`);
    };

    const handleResetData = () => {
        if(window.confirm("This will clear all local data and reset the app to a fresh state. Continue?")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    const handleNotify = async (segment: BuyerSegment) => {
        await whopService.sendNotification(segment, "A new high-value signal is available. Check it out!");
        showToast(`Notifying "${segment}" segment via Whop...`);
    };
    
    if (!currentUser) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading User via Whop...</div>
    }

    const navItemsMap: { [key in UserRole]: { view: View; label: string; icon: React.ReactNode }[] } = {
        [UserRole.CREATOR]: [
            { view: 'creator-dashboard', label: 'Dashboard', icon: <ChartBarIcon className="w-6 h-6" /> },
            { view: 'post-signal', label: 'Post Signal', icon: <PlusCircleIcon className="w-6 h-6" /> },
            { view: 'public-ledger', label: 'Public Ledger', icon: <BookOpenIcon className="w-6 h-6" /> },
        ],
        [UserRole.BUYER]: [
            { view: 'buyer-dashboard', label: 'Signals', icon: <TagIcon className="w-6 h-6" /> },
            { view: 'public-ledger', label: 'Public Ledger', icon: <BookOpenIcon className="w-6 h-6" /> },
        ],
    };

    const currentNavItems = navItemsMap[currentUser.role];

    return (
        <div className="min-h-screen flex">
            <Toast message={toast.message} show={toast.show} onClose={() => setToast({show: false, message: ''})}/>
            {/* Sidebar */}
            <aside className="w-72 bg-gray-900 border-r border-gray-800 p-6 flex-shrink-0 flex flex-col justify-between">
                <div>
                    <div className="flex items-center space-x-3 mb-10">
                        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">S</div>
                        <h1 className="text-2xl font-bold text-white">Signals</h1>
                    </div>
                    <nav className="space-y-2">
                         {currentNavItems.map(item => (
                            <NavItem
                                key={item.view}
                                icon={item.icon}
                                label={item.label}
                                active={activeView === item.view}
                                onClick={() => setActiveView(item.view)}
                            />
                        ))}
                    </nav>
                </div>
                <div className="border-t border-gray-700 pt-6">
                    <p className="text-sm text-gray-400 mb-3">Logged in via Whop</p>
                    <div className={`w-full flex items-center p-2 rounded-lg text-left bg-gray-800 mb-4`}>
                        <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full" />
                        <div className="ml-3">
                            <p className="font-semibold text-white text-sm">{currentUser.name}</p>
                            <p className="text-xs text-gray-400">{currentUser.role}</p>
                        </div>
                    </div>
                    <div className="flex space-x-2">
                         <button 
                            onClick={handleSwitchRole}
                            className="flex-1 text-xs text-indigo-400 hover:text-indigo-300 underline"
                        >
                            Switch Role
                        </button>
                        <button 
                            onClick={handleResetData}
                            className="flex-1 text-xs text-red-400 hover:text-red-300 underline"
                        >
                            Reset Data
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-12 overflow-y-auto">
                 {activeView === 'creator-dashboard' && currentUser.role === UserRole.CREATOR && (
                    <CreatorDashboard creator={currentUser} signals={signals} purchases={purchases} onSettle={handleSettleSignal} onNotify={handleNotify}/>
                 )}
                 {activeView === 'post-signal' && currentUser.role === UserRole.CREATOR && (
                    <PostSignalView creator={currentUser} onPostSignal={handlePostSignal} />
                 )}
                 {activeView === 'public-ledger' && (
                    <PublicLedgerView signals={signals} users={users} />
                 )}
                 {activeView === 'buyer-dashboard' && currentUser.role === UserRole.BUYER && (
                    <BuyerDashboard buyer={currentUser} signals={signals} users={users} purchases={purchases} onPurchase={handlePurchaseSignal} />
                 )}
            </main>
        </div>
    );
}