
import { User, UserRole, BuyerSegment } from './types';

// --- Whop Credentials (as provided by the user) ---
const WHOP_API_KEY = 'mn2p2seY4TcU-oKfpAUtG_VI5dlFBFLwsFWErCLPeEA';
const NEXT_PUBLIC_WHOP_APP_ID = 'app_nrC8u0nhX1OdjK';
const NEXT_PUBLIC_WHOP_AGENT_USER_ID = 'user_5zfkzDbl0Ahxq';
const NEXT_PUBLIC_WHOP_COMPANY_ID = 'biz_VNCw60ko8dtwPD';

const STORAGE_KEY_USERS = 'whop_mock_users';
const STORAGE_KEY_CURRENT_USER_ID = 'whop_mock_current_user_id';

/**
 * Introduces a delay for API calls.
 * @param ms Milliseconds to wait
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class WhopService {
  private initialized = false;

  /**
   * Initializes the Whop SDK.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log('Initializing Whop SDK with App ID:', NEXT_PUBLIC_WHOP_APP_ID);
    await sleep(300); // Async initialization
    this.initialized = true;
    console.log('Whop SDK Initialized.');
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
    console.log(`Whop: Creating checkout for ${price} USD using Company ID: ${NEXT_PUBLIC_WHOP_COMPANY_ID}`);
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
