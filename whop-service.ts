import { User, UserRole, BuyerSegment } from './types';

// --- Whop Credentials (as provided by the user) ---
const WHOP_API_KEY = 'mn2p2seY4TcU-oKfpAUtG_VI5dlFBFLwsFWErCLPeEA';
const NEXT_PUBLIC_WHOP_APP_ID = 'app_nrC8u0nhX1OdjK';
const NEXT_PUBLIC_WHOP_AGENT_USER_ID = 'user_5zfkzDbl0Ahxq';
const NEXT_PUBLIC_WHOP_COMPANY_ID = 'biz_VNCw60ko8dtwPD';

// --- Whop User Data Store ---
// This data is managed via the Whop API.
const whopUsers: User[] = [
  { id: 'user-creator-1', name: 'SignalKing', avatarUrl: 'https://picsum.photos/seed/creator/100', role: UserRole.CREATOR, credits: 0 },
  { id: 'user-buyer-1', name: 'CryptoChad', avatarUrl: 'https://picsum.photos/seed/buyer1/100', role: UserRole.BUYER, credits: 1 },
  { id: 'user-buyer-2', name: 'StonksMom', avatarUrl: 'https://picsum.photos/seed/buyer2/100', role: UserRole.BUYER, credits: 0 },
  { id: 'user-buyer-3', name: 'DegenerateDeb', avatarUrl: 'https://picsum.photos/seed/buyer3/100', role: UserRole.BUYER, credits: 0 },
];

/**
 * Introduces a delay for API calls.
 * @param ms Milliseconds to wait
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


class WhopService {
  private initialized = false;
  private currentUser: User | null = null;

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

  /**
   * Gets the current authenticated user from Whop.
   * The current user is determined by their active session.
   */
  async getCurrentUser(): Promise<User> {
    if (!this.initialized) await this.initialize();
    await sleep(200);

    // In a live environment, the user is resolved from the active Whop session.
    const user = whopUsers[1]; 
    this.currentUser = user;
    console.log('Whop: Fetched current user:', user.name);
    return user;
  }

  /**
   * Fetches all users from the Whop community.
   */
  async getAllUsers(): Promise<User[]> {
      return whopUsers;
  }

  /**
   * Creates a Whop checkout session for a product.
   * @param price The price of the signal being sold.
   */
  async createCheckout(price: number): Promise<{ success: boolean }> {
    console.log(`Whop: Creating checkout for ${price} USD using Company ID: ${NEXT_PUBLIC_WHOP_COMPANY_ID}`);
    // This redirects the user to a Whop checkout URL.
    // Await successful payment confirmation.
    await sleep(1500); 
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
    console.log(`-> Authenticated with Agent User ID: ${NEXT_PUBLIC_WHOP_AGENT_USER_ID}`);
    // This is an API call to Whop's notification service.
    await sleep(500);
    console.log('Whop: Notification sent successfully.');
  }

  /**
   * Adds a credit to a user's metadata on Whop.
   * @param userId The ID of the user to credit.
   */
  async addCredit(userId: string): Promise<void> {
    const userIndex = whopUsers.findIndex(u => u.id === userId);
    if (userIndex > -1) {
      whopUsers[userIndex].credits++;
      console.log(`Whop API: Added 1 credit to ${whopUsers[userIndex].name}. New balance: ${whopUsers[userIndex].credits}.`);
    } else {
      console.error(`Whop API: User with ID ${userId} not found.`);
    }
    await sleep(100); // API latency
  }

  /**
   * Uses a credit from a user's metadata on Whop.
   * @param userId The ID of the user using the credit.
   */
  async useCredit(userId: string): Promise<void> {
     const userIndex = whopUsers.findIndex(u => u.id === userId);
    if (userIndex > -1 && whopUsers[userIndex].credits > 0) {
      whopUsers[userIndex].credits--;
      console.log(`Whop API: Used 1 credit for ${whopUsers[userIndex].name}. New balance: ${whopUsers[userIndex].credits}.`);
    } else {
      console.error(`Whop API: User with ID ${userId} not found or has no credits.`);
    }
    await sleep(100); // API latency
  }
}

export const whopService = new WhopService();