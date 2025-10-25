import { User, UserRole, BuyerSegment } from './types';

// --- Whop Credentials (as provided by the user) ---
const WHOP_API_KEY = 'mn2p2seY4TcU-oKfpAUtG_VI5dlFBFLwsFWErCLPeEA';
const NEXT_PUBLIC_WHOP_APP_ID = 'app_nrC8u0nhX1OdjK';
const NEXT_PUBLIC_WHOP_AGENT_USER_ID = 'user_5zfkzDbl0Ahxq';
const NEXT_PUBLIC_WHOP_COMPANY_ID = 'biz_VNCw60ko8dtwPD';

// --- Mock Database for Whop Users and their metadata (credits) ---
// In a real application, this data would live on Whop's servers.
const mockWhopUsers: User[] = [
  { id: 'user-creator-1', name: 'SignalKing', avatarUrl: 'https://picsum.photos/seed/creator/100', role: UserRole.CREATOR, credits: 0 },
  { id: 'user-buyer-1', name: 'CryptoChad', avatarUrl: 'https://picsum.photos/seed/buyer1/100', role: UserRole.BUYER, credits: 1 },
  { id: 'user-buyer-2', name: 'StonksMom', avatarUrl: 'https://picsum.photos/seed/buyer2/100', role: UserRole.BUYER, credits: 0 },
  { id: 'user-buyer-3', name: 'DegenerateDeb', avatarUrl: 'https://picsum.photos/seed/buyer3/100', role: UserRole.BUYER, credits: 0 },
];

/**
 * Simulates a delay for API calls to feel more realistic.
 * @param ms Milliseconds to wait
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


class WhopService {
  private initialized = false;
  private currentUser: User | null = null;

  /**
   * Simulates initializing the Whop SDK.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log('Initializing Whop SDK with App ID:', NEXT_PUBLIC_WHOP_APP_ID);
    await sleep(300); // Simulate async initialization
    this.initialized = true;
    console.log('Whop SDK Initialized.');
  }

  /**
   * Simulates getting the current authenticated user from Whop.
   * For this demo, we'll default to the first buyer to showcase the purchase flow.
   * In a real app, this would be determined by the user's session.
   */
  async getCurrentUser(): Promise<User> {
    if (!this.initialized) await this.initialize();
    await sleep(200);

    // To simulate different users, you could change the index here.
    // e.g., mockWhopUsers[0] for the creator view.
    const user = mockWhopUsers[1]; 
    this.currentUser = user;
    console.log('Whop: Fetched current user:', user.name);
    return user;
  }

  /**
   * Simulates fetching all users. In a real scenario, you'd fetch members of your Whop community.
   */
  async getAllUsers(): Promise<User[]> {
      return mockWhopUsers;
  }

  /**
   * Simulates creating a Whop checkout session for a product.
   * @param price The price of the signal being sold.
   */
  async createCheckout(price: number): Promise<{ success: boolean }> {
    console.log(`Whop: Creating checkout for ${price} USD using Company ID: ${NEXT_PUBLIC_WHOP_COMPANY_ID}`);
    // This would typically redirect the user to a Whop checkout URL.
    // We'll simulate a successful payment after a delay.
    await sleep(1500); 
    console.log('Whop: Checkout successful.');
    return { success: true };
  }

  /**
   * Simulates sending a push notification to a segment of users via Whop.
   * @param segment The buyer segment to target.
   * @param message The message to send.
   */
  async sendNotification(segment: BuyerSegment, message: string): Promise<void> {
    console.log(`Whop: Sending notification to segment "${segment}"`);
    console.log(`-> Message: "${message}"`);
    console.log(`-> Authenticated with Agent User ID: ${NEXT_PUBLIC_WHOP_AGENT_USER_ID}`);
    // In a real app, this would be an API call to Whop's notification service.
    await sleep(500);
    console.log('Whop: Notification sent successfully.');
  }

  /**
   * Simulates adding a credit to a user's metadata on Whop.
   * @param userId The ID of the user to credit.
   */
  async addCredit(userId: string): Promise<void> {
    const userIndex = mockWhopUsers.findIndex(u => u.id === userId);
    if (userIndex > -1) {
      mockWhopUsers[userIndex].credits++;
      console.log(`Whop API (mock): Added 1 credit to ${mockWhopUsers[userIndex].name}. New balance: ${mockWhopUsers[userIndex].credits}.`);
    } else {
      console.error(`Whop API (mock): User with ID ${userId} not found.`);
    }
    await sleep(100); // Simulate API latency
  }

  /**
   * Simulates using a credit from a user's metadata on Whop.
   * @param userId The ID of the user using the credit.
   */
  async useCredit(userId: string): Promise<void> {
     const userIndex = mockWhopUsers.findIndex(u => u.id === userId);
    if (userIndex > -1 && mockWhopUsers[userIndex].credits > 0) {
      mockWhopUsers[userIndex].credits--;
      console.log(`Whop API (mock): Used 1 credit for ${mockWhopUsers[userIndex].name}. New balance: ${mockWhopUsers[userIndex].credits}.`);
    } else {
      console.error(`Whop API (mock): User with ID ${userId} not found or has no credits.`);
    }
    await sleep(100); // Simulate API latency
  }
}

export const whopService = new WhopService();
