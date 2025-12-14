
import { User, UserRole, BuyerSegment } from './types';

// --- Whop Credentials ---
// SECURITY: API keys should NEVER be in client-side code in production.
// These should be handled by a backend server that makes authenticated API calls.
// For now, we only expose the public app ID (which is safe to expose).
// The actual API key should be stored in environment variables on your server.
const WHOP_APP_ID = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_WHOP_APP_ID || 'app_nrC8u0nhX1OdjK';

// WARNING: In production, authenticated operations (checkout, notifications, credits)
// should go through YOUR backend server, not directly from the client.
// The backend would use: process.env.WHOP_API_KEY (never exposed to browser)

/**
 * Extracts the Whop context ID (experienceId or companyId) from the URL.
 * This is crucial for data isolation - each Whop installation gets its own data.
 * 
 * URL patterns (Whop passes these in the iframe URL):
 * - Experience View: /experiences/[experienceId] → exp_xxxxx
 * - Dashboard View: /dashboard/[companyId] → biz_xxxxx
 * 
 * The Whop iframe loads your app with the full path, so the experienceId/companyId
 * should be extractable from the pathname.
 */
function getWhopContextId(): string {
  const path = window.location.pathname;
  const fullUrl = window.location.href;
  
  console.log('[Whop Context] Extracting context from:', { path, fullUrl });
  
  // Pattern 1: /experiences/exp_xxx or /experiences/exp_xxx/... 
  const experienceMatch = path.match(/\/experiences\/(exp_[a-zA-Z0-9]+)/);
  if (experienceMatch) {
    console.log('[Whop Context] Found experienceId in path:', experienceMatch[1]);
    return experienceMatch[1];
  }
  
  // Pattern 2: /dashboard/biz_xxx or /dashboard/biz_xxx/...
  const dashboardMatch = path.match(/\/dashboard\/(biz_[a-zA-Z0-9]+)/);
  if (dashboardMatch) {
    console.log('[Whop Context] Found companyId in path:', dashboardMatch[1]);
    return dashboardMatch[1];
  }
  
  // Pattern 3: exp_xxx or biz_xxx anywhere in the path (flexible matching)
  const flexExpMatch = path.match(/(exp_[a-zA-Z0-9]+)/);
  if (flexExpMatch) {
    console.log('[Whop Context] Found experienceId (flex match):', flexExpMatch[1]);
    return flexExpMatch[1];
  }
  
  const flexBizMatch = path.match(/(biz_[a-zA-Z0-9]+)/);
  if (flexBizMatch) {
    console.log('[Whop Context] Found companyId (flex match):', flexBizMatch[1]);
    return flexBizMatch[1];
  }
  
  // Pattern 4: Check URL search params (some setups pass context this way)
  const urlParams = new URLSearchParams(window.location.search);
  const experienceId = urlParams.get('experienceId') || urlParams.get('experience_id') || urlParams.get('exp');
  if (experienceId) {
    console.log('[Whop Context] Found experienceId in query params:', experienceId);
    return experienceId;
  }
  
  const companyId = urlParams.get('companyId') || urlParams.get('company_id') || urlParams.get('biz');
  if (companyId) {
    console.log('[Whop Context] Found companyId in query params:', companyId);
    return companyId;
  }
  
  // Pattern 5: Check if we're in a Whop iframe by looking at referrer
  const referrer = document.referrer;
  if (referrer && referrer.includes('whop.com')) {
    // Try to extract from referrer URL
    const refExpMatch = referrer.match(/(exp_[a-zA-Z0-9]+)/);
    if (refExpMatch) {
      console.log('[Whop Context] Found experienceId in referrer:', refExpMatch[1]);
      return refExpMatch[1];
    }
    const refBizMatch = referrer.match(/(biz_[a-zA-Z0-9]+)/);
    if (refBizMatch) {
      console.log('[Whop Context] Found companyId in referrer:', refBizMatch[1]);
      return refBizMatch[1];
    }
  }
  
  // CRITICAL: In production, we should NOT use a shared fallback!
  // Generate a unique session-based fallback to prevent data leakage
  // This will reset on each page load, which is safer than sharing data
  const sessionFallback = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.error('[Whop Context] WARNING: Could not extract Whop context ID from URL!');
  console.error('[Whop Context] Path:', path);
  console.error('[Whop Context] Full URL:', fullUrl);
  console.error('[Whop Context] Using temporary session-based fallback:', sessionFallback);
  console.error('[Whop Context] Data will NOT persist between sessions.');
  console.error('[Whop Context] Ensure your app is loaded via the correct Whop iframe URL.');
  
  return sessionFallback;
}

// Get the context ID once at module load - this namespaces all storage
const WHOP_CONTEXT_ID = getWhopContextId();

// Namespaced storage keys - ensures data isolation per Whop installation
const getStorageKey = (key: string) => `whop_${WHOP_CONTEXT_ID}_${key}`;
const STORAGE_KEY_USERS = getStorageKey('users');
const STORAGE_KEY_CURRENT_USER_ID = getStorageKey('current_user_id');

// Export for use in App.tsx
export { getStorageKey, WHOP_CONTEXT_ID };

/**
 * Introduces a delay for API calls.
 * @param ms Milliseconds to wait
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Cleans up any old data that might have been stored with generic prefixes.
 * This helps ensure data isolation when the context extraction was previously failing.
 */
function cleanupStaleData(): void {
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      // Remove any data with the old dev_ prefix that wasn't properly scoped
      // But preserve data that's properly scoped to a real Whop context
      if (key.startsWith('whop_dev_') || key.startsWith('whop_session_')) {
        keysToRemove.push(key);
      }
    }
  }
  
  if (keysToRemove.length > 0) {
    console.log('[Whop Cleanup] Removing stale data from previous sessions:', keysToRemove);
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
}

class WhopService {
  private initialized = false;

  /**
   * Initializes the Whop SDK.
   * Also cleans up any stale data from improperly scoped sessions.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[Whop SDK] Initializing with App ID:', WHOP_APP_ID);
    console.log('[Whop SDK] Context ID:', WHOP_CONTEXT_ID);
    
    // Clean up any stale data from sessions that weren't properly scoped
    // This ensures fresh installs don't see data from other users/installations
    cleanupStaleData();
    
    await sleep(300); // Async initialization
    this.initialized = true;
    console.log('[Whop SDK] Initialized successfully.');
  }

  private getUsers(): User[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USERS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveUsers(users: User[]) {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  }

  /**
   * Gets the current authenticated user from Whop.
   * Uses localStorage to simulate a session.
   */
  async getCurrentUser(): Promise<User> {
    if (!this.initialized) await this.initialize();
    await sleep(200);

    let users = this.getUsers();
    let currentUserId = localStorage.getItem(STORAGE_KEY_CURRENT_USER_ID);
    let user = users.find(u => u.id === currentUserId);

    if (!user) {
      // Create a fresh user for this "install"
      user = {
        id: `user-${Date.now()}`,
        name: 'Creator',
        avatarUrl: `https://ui-avatars.com/api/?name=Creator&background=random`,
        role: UserRole.CREATOR,
        credits: 0
      };
      users.push(user);
      this.saveUsers(users);
      localStorage.setItem(STORAGE_KEY_CURRENT_USER_ID, user.id);
    }

    console.log('Whop: Fetched current user:', user.name);
    return user;
  }

  /**
   * Helper for demo purposes to switch roles/users
   */
  async switchUserRole(): Promise<User> {
      let users = this.getUsers();
      const currentUserId = localStorage.getItem(STORAGE_KEY_CURRENT_USER_ID);
      const currentUser = users.find(u => u.id === currentUserId);
      
      let newUser: User;

      // If we are currently a creator, switch to a buyer (create if needed)
      if (currentUser?.role === UserRole.CREATOR) {
          let buyer = users.find(u => u.role === UserRole.BUYER);
          if (!buyer) {
              buyer = {
                  id: `user-buyer-${Date.now()}`,
                  name: 'Buyer',
                  avatarUrl: `https://ui-avatars.com/api/?name=Buyer&background=random`,
                  role: UserRole.BUYER,
                  credits: 5 // Give some credits to test
              };
              users.push(buyer);
              this.saveUsers(users);
          }
          newUser = buyer;
      } else {
          // Switch back to creator
          let creator = users.find(u => u.role === UserRole.CREATOR);
          if (!creator) {
             // Should verify logic, but fallback to creating one
             creator = {
                id: `user-creator-${Date.now()}`,
                name: 'Creator',
                avatarUrl: `https://ui-avatars.com/api/?name=Creator&background=random`,
                role: UserRole.CREATOR,
                credits: 0
             };
             users.push(creator);
             this.saveUsers(users);
          }
          newUser = creator;
      }

      localStorage.setItem(STORAGE_KEY_CURRENT_USER_ID, newUser.id);
      return newUser;
  }

  /**
   * Fetches all users from the Whop community.
   */
  async getAllUsers(): Promise<User[]> {
      return this.getUsers();
  }

  /**
   * Creates a Whop checkout session for a product.
   * @param price The price of the signal being sold.
   */
  async createCheckout(price: number): Promise<{ success: boolean }> {
    console.log(`Whop: Creating checkout for ${price} USD using Context ID: ${WHOP_CONTEXT_ID}`);
    await sleep(1000); 
    console.log('Whop: Checkout successful.');
    return { success: true };
  }

  /**
   * Sends a push notification to a segment of users via Whop.
   * @param segment The buyer segment to target.
   * @param message The message to send.
   */
  async sendNotification(segment: BuyerSegment, message: string): Promise<void> {
    console.log(`Whop: Sending notification to segment "${segment}"`);
    console.log(`-> Message: "${message}"`);
    await sleep(500);
    console.log('Whop: Notification sent successfully.');
  }

  /**
   * Adds a credit to a user's metadata on Whop.
   * @param userId The ID of the user to credit.
   */
  async addCredit(userId: string): Promise<void> {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex > -1) {
      users[userIndex].credits++;
      this.saveUsers(users);
      console.log(`Whop API: Added 1 credit to ${users[userIndex].name}. New balance: ${users[userIndex].credits}.`);
    }
    await sleep(100); 
  }

  /**
   * Uses a credit from a user's metadata on Whop.
   * @param userId The ID of the user using the credit.
   */
  async useCredit(userId: string): Promise<void> {
     const users = this.getUsers();
     const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex > -1 && users[userIndex].credits > 0) {
      users[userIndex].credits--;
      this.saveUsers(users);
      console.log(`Whop API: Used 1 credit for ${users[userIndex].name}. New balance: ${users[userIndex].credits}.`);
    }
    await sleep(100);
  }
}

export const whopService = new WhopService();
