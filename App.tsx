
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Signal, User, Purchase, Outcome, UserRole, BuyerSegment } from './types';
import { ChartBarIcon, PlusCircleIcon, BookOpenIcon, UsersIcon, CheckCircleIcon, XCircleIcon, ClockIcon, LockClosedIcon, TagIcon, TrophyIcon, ArrowUpDownIcon, MagnifyingGlassIcon } from './components/icons';
import { whopService } from './whop-service';

// --- MOCK DATA (Initial state, will be managed by whop-service) ---
const initialSignals: Signal[] = [
  { id: 'sig-1', creatorId: 'user-creator-1', content: 'Long $BTC, entry at $68,500, target $72,000', price: 50, timestamp: Date.now() - 86400000 * 3, commitHash: 'a1b2c3d4', outcome: Outcome.WIN, category: 'Crypto' },
  { id: 'sig-2', creatorId: 'user-creator-1', content: 'Short $ETH, entry at $3,500, target $3,300', price: 50, timestamp: Date.now() - 86400000 * 2, commitHash: 'e5f6g7h8', outcome: Outcome.LOSS, category: 'Crypto' },
  { id: 'sig-3', creatorId: 'user-creator-1', content: 'Lakers to win vs. Celtics', price: 25, timestamp: Date.now() - 86400000 * 1, commitHash: 'i9j0k1l2', outcome: Outcome.WIN, category: 'Sports' },
  { id: 'sig-4', creatorId: 'user-creator-1', content: 'Buy $NVDA calls, strike $950, expiry next Friday', price: 75, timestamp: Date.now() - 3600000, commitHash: 'm3n4o5p6', outcome: Outcome.PENDING, category: 'Stocks' },
];

const initialPurchases: Purchase[] = [
    { id: 'pur-1', userId: 'user-buyer-1', signalId: 'sig-1', pricePaid: 50, timestamp: Date.now() - 86400000 * 3 },
    { id: 'pur-2', userId: 'user-buyer-2', signalId: 'sig-1', pricePaid: 50, timestamp: Date.now() - 86400000 * 3 },
    { id: 'pur-3', userId: 'user-buyer-1', signalId: 'sig-2', pricePaid: 50, timestamp: Date.now() - 86400000 * 2 },
    { id: 'pur-4', userId: 'user-buyer-2', signalId: 'sig-3', pricePaid: 25, timestamp: Date.now() - 86400000 * 1 },
    { id: 'pur-5', userId: 'user-buyer-3', signalId: 'sig-2', pricePaid: 0, timestamp: Date.now() - 86400000 * 2 }, // This user had a credit
];


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


const SignalCard: React.FC<{
    signal: Signal;
    creator?: User;
    isPurchased: boolean;
    isSettled: boolean;
    onPurchase: (signal: Signal) => void;
    currentUser: User;
}> = ({ signal, creator, isPurchased, isSettled, onPurchase, currentUser }) => {

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500 transition-all duration-300">
            <div>
                {creator && (
                    <div className="flex items-center mb-4">
                        <img src={creator.avatarUrl} alt={creator.name} className="w-10 h-10 rounded-full" />
                        <span className="ml-3 font-semibold text-white">{creator.name}</span>
                    </div>
                )}
                {isPurchased || currentUser.role === UserRole.CREATOR ? (
                    <p className="text-lg text-gray-100">{signal.content}</p>
                ) : (
                    <div className="text-center py-8 bg-gray-900/50 rounded-lg flex flex-col items-center justify-center">
                        <LockClosedIcon className="w-8 h-8 text-gray-500 mb-2" />
                        <p className="text-gray-400 font-medium">Signal Locked</p>
                        <p className="text-sm text-indigo-400 mt-1">{signal.category}</p>
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
                        Unlock Signal
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
                    {(Object.values(BuyerSegment)).map(segment => (
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
                                    <p className="font-semibold text-lg">{signal.content}</p>
                                    <p className="text-sm text-gray-400">Posted: {new Date(signal.timestamp).toLocaleString()}</p>
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

type BatchSignal = { content: string; price: string; category: string };
const PostSignalView: React.FC<{
    creator: User;
    onPostSignal: (content: string, price: number, category: string) => void;
}> = ({ creator, onPostSignal }) => {
    const [content, setContent] = useState('');
    const [price, setPrice] = useState('50');
    const [category, setCategory] = useState('Crypto');
    const [batch, setBatch] = useState<BatchSignal[]>([]);

    const handleAddToBatch = (e: React.FormEvent) => {
        e.preventDefault();
        if (content && price && category) {
            setBatch(prev => [...prev, { content, price, category }]);
            setContent('');
            setPrice('50');
            setCategory('Crypto');
        }
    };
    
    const handlePostBatch = () => {
        batch.forEach(signal => {
            onPostSignal(signal.content, parseFloat(signal.price), signal.category);
        });
        setBatch([]);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-white mb-8">Post Signals</h1>
                <form onSubmit={handleAddToBatch} className="bg-gray-800 border border-gray-700 rounded-2xl p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <div>
                        <label htmlFor="content" className="block text-sm font-medium text-gray-300 mb-2">Signal Content</label>
                        <textarea
                            id="content"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={3}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            placeholder="e.g., Long $BTC, entry at $68,500..."
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
                                <p className="text-gray-300">{signal.content}</p>
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
                s.outcome.toLowerCase().includes(search.toLowerCase())
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
                                <th className="p-4 font-semibold text-sm text-gray-300">Creator</th>
                                <th className="p-4 font-semibold text-sm text-gray-300">Timestamp</th>
                                <th className="p-4 font-semibold text-sm text-gray-300">Commit Hash</th>
                                <th className="p-4 font-semibold text-sm text-gray-300">Outcome</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredAndSortedSignals.map(signal => {
                                const creator = getCreator(signal.creatorId);
                                return (
                                    <tr key={signal.id} className="hover:bg-gray-700/50">
                                        <td className="p-4 text-gray-100 font-medium">{signal.content}</td>
                                        <td className="p-4 text-gray-300">{creator?.name}</td>
                                        <td className="p-4 text-gray-400 text-sm">{new Date(signal.timestamp).toLocaleString()}</td>
                                        <td className="p-4 text-gray-400 text-sm font-mono">{signal.commitHash.substring(0, 8)}</td>
                                        <td className="p-4"><OutcomeBadge outcome={signal.outcome} /></td>
                                    </tr>
                                );
                            })}
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
            .filter(s => s.content.toLowerCase().includes(filter.toLowerCase()) || s.category.toLowerCase().includes(filter.toLowerCase()))
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
                        <input type="text" placeholder="Filter by content or category..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-4 focus:ring-indigo-500"/>
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
    const [signals, setSignals] = useState<Signal[]>(initialSignals);
    const [users, setUsers] = useState<User[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeView, setActiveView] = useState<View>('buyer-dashboard');
    const [toast, setToast] = useState({ show: false, message: '' });

    useEffect(() => {
        const initApp = async () => {
            await whopService.initialize();
            const user = await whopService.getCurrentUser();
            const allUsers = await whopService.getAllUsers();
            setCurrentUser(user);
            setUsers(allUsers);
            if (user) {
                setActiveView(user.role === UserRole.CREATOR ? 'creator-dashboard' : 'buyer-dashboard');
            }
        };
        initApp();
    }, []);

    const showToast = (message: string) => {
        setToast({ show: true, message });
    };

    const handlePostSignal = (content: string, price: number, category: string) => {
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
        };
        setSignals(prev => [...prev, newSignal]);
        showToast('Signal successfully posted!');
        setActiveView('creator-dashboard');
    };

    const handleSettleSignal = async (signalId: string, outcome: Outcome) => {
        // FIX: Wrap async logic in a try-catch block to handle potential API errors.
        try {
            setSignals(prev => prev.map(s => s.id === signalId ? { ...s, outcome } : s));
    
            if (outcome === Outcome.LOSS) {
                const buyersToCredit = purchases.filter(p => p.signalId === signalId).map(p => p.userId);
                let creditedCount = 0;
                for (const userId of buyersToCredit) {
                    await whopService.addCredit(userId);
                    creditedCount++;
                }
                // In a real app, you'd refetch user data to see updated credits. Here we just show a message.
                showToast(`Signal settled as LOSS. ${creditedCount} buyers have been credited via Whop.`);
            } else {
                 showToast('Signal settled as WIN.');
            }
        } catch (error) {
            console.error("Failed to settle signal:", error);
            showToast('An error occurred while settling the signal.');
        }
    };

    const handlePurchaseSignal = async (signal: Signal) => {
        if (!currentUser) return;

        const hasCredits = currentUser.credits > 0;
        let purchaseSuccessful = false;
        let pricePaid = 0;

        if (hasCredits) {
            await whopService.useCredit(currentUser.id);
            setCurrentUser(prev => prev ? { ...prev, credits: prev.credits - 1 } : null);
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
                userId: currentUser.id,
                signalId: signal.id,
                pricePaid,
                timestamp: Date.now(),
            };
            setPurchases(prev => [...prev, newPurchase]);
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
                    <div className={`w-full flex items-center p-2 rounded-lg text-left bg-gray-800`}>
                        <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full" />
                        <div className="ml-3">
                            <p className="font-semibold text-white text-sm">{currentUser.name}</p>
                            <p className="text-xs text-gray-400">{currentUser.role}</p>
                        </div>
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
