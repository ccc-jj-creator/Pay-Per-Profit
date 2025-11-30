
import { User, UserRole, BuyerSegment } from './types';

// --- HELPERS ---

/**
 * StorageHelper ensures the app works even if localStorage is blocked 
 * (common in iframes/incognito mode).
 */
class StorageHelper {
    private memory: Record<string, string> = {};

    getItem(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch {
            try {
                return sessionStorage.getItem(key);
            } catch {
                return this.memory[key] || null;
            }
        }
    }

    setItem(key: string, value: string): void {
        try {
            localStorage.setItem(key, value);
        } catch {
            try {
                sessionStorage.setItem(key, value);
            } catch {
                this.memory[key] = value;
            }
        }
    }

    removeItem(key: string): void {
        try {
            localStorage.removeItem(key);
        } catch {
            try {
                sessionStorage.removeItem(key);
            } catch {
                delete this.memory[key];
            }
        }
    }
}

const storage = new StorageHelper();

// Helper to get company ID from URL (simulating Whop iframe context)
const getParamFromUrl = (keys: string[]) => {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        for (const key of keys) {
            const val = params.get(key);
            if (val) return val;
        }
    }
    return null;
};

// Storage keys are now functions to ensure multi-tenancy
const getStorageKey = (key: string, companyId: string) => `whop_data_${companyId}_${key}`;

/**
 * Introduces a delay for API calls.
 * @param ms Milliseconds to wait
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class WhopService {
  private initialized = false;
  private currentCompanyId: string = 'unknown_biz';

  /**
   * Initializes the Whop SDK.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Whop typically passes the business ID as 'bizId' or 'companyId'
    const urlId = getParamFromUrl(['bizId', 'companyId', 'experienceId']);
    this.currentCompanyId = urlId || 'dev_default_biz';
    
    console.log(`[WhopService] Initializing for Company: ${this.currentCompanyId}`);
    
    // Simulate SDK initialization
    await sleep(300); 
    this.initialized = true;
  }

  getCompanyId(): string {
      return this.currentCompanyId;
  }

  private getUsers(): User[] {
    try {
      const stored = storage.getItem(getStorageKey('users', this.currentCompanyId));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveUsers(users: User[]) {
    storage.setItem(getStorageKey('users', this.currentCompanyId), JSON.stringify(users));
  }

  /**
   * Gets the current authenticated user from Whop.
   * STRICTLY USES URL PARAMS TO DETERMINE IDENTITY AND ROLE
   */
  async getCurrentUser(): Promise<User> {
    if (!this.initialized) await this.initialize();
    
    // 1. Try to get identity from URL (iframe context)
    const userId = getParamFromUrl(['user_id', 'userId', 'sub']);
    const name = getParamFromUrl(['name', 'username', 'full_name']);
    const avatar = getParamFromUrl(['avatar', 'picture', 'image_url']);
    const roleParam = getParamFromUrl(['role', 'roles']);

    // 2. Determine Role strictly
    let role = UserRole.BUYER; // Default to Buyer for safety
    if (roleParam) {
        const r = roleParam.toLowerCase();
        if (r.includes('admin') || r.includes('creator') || r.includes('owner')) {
            role = UserRole.CREATOR;
        }
    }

    // 3. Hydrate or Load User
    // If we have a userId from URL, we prioritize that.
    // If not, we fallback to a stored session (only for dev/testing outside iframe).
    
    let users = this.getUsers();
    let user: User | undefined;

    if (userId) {
        user = users.find(u => u.id === userId);
        if (!user) {
            // New user entering the app
            user = {
                id: userId,
                name: name || `User ${userId.substr(0,4)}`,
                avatarUrl: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`,
                role: role,
                credits: role === UserRole.BUYER ? 0 : 0 // Start with 0 credits
            };
            users.push(user);
            this.saveUsers(users);
        } else {
            // Update role if changed in URL
            if (user.role !== role) {
                user.role = role;
                this.saveUsers(users);
            }
        }
    } else {
        // FALLBACK FOR DEV/LOCALHOST ONLY (When no URL params exist)
        // Check if we have a persisted session
        const sessionKey = getStorageKey('current_user_id', this.currentCompanyId);
        let storedId = storage.getItem(sessionKey);
        user = users.find(u => u.id === storedId);

        if (!user) {
             // Create a dummy user for dev
             const isFirstUser = users.length === 0;
             const devRole = isFirstUser ? UserRole.CREATOR : UserRole.BUYER;
             user = {
                 id: `dev-${Date.now()}`,
                 name: isFirstUser ? 'Dev Admin' : 'Dev Member',
                 avatarUrl: `https://ui-avatars.com/api/?name=Dev&background=random`,
                 role: devRole,
                 credits: 5
             };
             users.push(user);
             this.saveUsers(users);
             storage.setItem(sessionKey, user.id);
        }
    }

    return user;
  }

  async getAllUsers(): Promise<User[]> {
      return this.getUsers();
  }

  /**
   * Creates a Whop checkout session for a product.
   */
  async createCheckout(price: number): Promise<{ success: boolean }> {
    console.log(`[WhopService] Creating checkout for ${price} USD`);
    
    // Post message to parent to trigger native checkout
    if (typeof window !== 'undefined' && window.parent) {
        window.parent.postMessage({
            type: 'WHOP_OPEN_CHECKOUT',
            payload: { price }
        }, '*');
    }

    await sleep(800); 
    return { success: true };
  }

  /**
   * Sends a push notification to a segment of users via Whop.
   */
  async sendNotification(segment: BuyerSegment, message: string): Promise<void> {
    console.log(`[WhopService] Sending notification: "${message}" to ${segment}`);
    
    if (typeof window !== 'undefined' && window.parent) {
        window.parent.postMessage({
            type: 'WHOP_SEND_NOTIFICATION',
            payload: { segment, message }
        }, '*');
    }

    await sleep(800);
    return Promise.resolve();
  }

  async addCredit(userId: string): Promise<void> {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex > -1) {
      users[userIndex].credits++;
      this.saveUsers(users);
    }
    await sleep(100); 
  }

  async useCredit(userId: string): Promise<void> {
     const users = this.getUsers();
     const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex > -1 && users[userIndex].credits > 0) {
      users[userIndex].credits--;
      this.saveUsers(users);
    }
    await sleep(100);
  }
}

export const whopService = new WhopService();
