
import { User, UserRole, BuyerSegment } from './types';

// --- CONSTANTS ---
const MOCK_COMPANY_ID_DEFAULT = 'biz_default_demo';

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
const getCompanyIdFromUrl = () => {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        // Check all common Whop parameter names
        return params.get('companyId') || 
               params.get('bizId') || 
               params.get('company_id') || 
               params.get('experienceId') ||
               storage.getItem('whop_debug_company_id');
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
  private currentCompanyId: string = MOCK_COMPANY_ID_DEFAULT;

  /**
   * Initializes the Whop SDK.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    const urlId = getCompanyIdFromUrl();
    this.currentCompanyId = urlId || MOCK_COMPANY_ID_DEFAULT;
    
    // Persist context
    if (urlId) {
        storage.setItem('whop_debug_company_id', urlId);
    }

    console.log(`[WhopService] Initializing for Company: ${this.currentCompanyId}`);
    
    // In a real app, this is where we would await window.Whop.init()
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
   */
  async getCurrentUser(): Promise<User> {
    if (!this.initialized) await this.initialize();
    
    let users = this.getUsers();
    
    // Check if we have a persisted session for this company
    const sessionKey = getStorageKey('current_user_id', this.currentCompanyId);
    let currentUserId = storage.getItem(sessionKey);
    
    let user = users.find(u => u.id === currentUserId);

    // LIVE SIMULATION LOGIC:
    // If no user is found in storage, we create a new one.
    // Rule: The FIRST user created for a Company is the CREATOR (Admin).
    // All subsequent users are BUYERS (Members).
    if (!user) {
      const isFirstUser = users.length === 0;
      
      const role = isFirstUser ? UserRole.CREATOR : UserRole.BUYER;
      const name = isFirstUser ? 'Creator (You)' : `Member ${users.length + 1}`;

      user = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
        role: role,
        credits: role === UserRole.BUYER ? 5 : 0
      };
      
      users.push(user);
      this.saveUsers(users);
      storage.setItem(sessionKey, user.id);
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
    
    // LIVE COMPATIBILITY:
    // If inside an iframe, try to message parent to open native checkout
    if (window.parent !== window) {
        window.parent.postMessage({
            type: 'WHOP_OPEN_CHECKOUT',
            payload: { price }
        }, '*');
    }

    await sleep(1000); 
    return { success: true };
  }

  /**
   * Sends a push notification to a segment of users via Whop.
   */
  async sendNotification(segment: BuyerSegment, message: string): Promise<void> {
    console.log(`[WhopService] Sending notification: "${message}" to ${segment}`);
    
    // LIVE COMPATIBILITY: 
    // Signal the parent window (Whop) about the notification event
    if (window.parent !== window) {
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

  /**
   * DEBUG ONLY: Reset company data
   */
  async resetCompanyData(): Promise<void> {
      storage.removeItem(getStorageKey('users', this.currentCompanyId));
      storage.removeItem(getStorageKey('current_user_id', this.currentCompanyId));
  }
  
  /**
   * DEBUG ONLY: Switch local user role to test other views
   * This persists only for this session/browser
   */
  async debugSwitchRole(userId: string, newRole: UserRole): Promise<void> {
      const users = this.getUsers();
      const user = users.find(u => u.id === userId);
      if (user) {
          user.role = newRole;
          // If switching to buyer, ensure they have credits to test with
          if (newRole === UserRole.BUYER && user.credits === 0) {
              user.credits = 5;
          }
          this.saveUsers(users);
      }
  }
}

export const whopService = new WhopService();
